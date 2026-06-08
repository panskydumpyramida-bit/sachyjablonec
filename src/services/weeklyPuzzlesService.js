/**
 * Weekly Puzzles Service — "Úloha týdne"
 *
 * Zdroj = PARTIE Z ČLÁNKŮ (model Game, pgn, vázané na publikované News).
 * NE Blunder Grid. Projde partie Stockfishem a hledá v nich KOMBINACE —
 * pozice s jediným úzkým řešením (uniqueness gate) vedoucím k rozhodující
 * výhodě / matu, ZAHRANÉ I PŘEHLÉDNUTÉ.
 *
 * Metodika ověřena deep-research (lichess-puzzler / Play Magnus / DeepMind).
 * Vyžaduje lokální Stockfish (self-host, viz stockfishEngine.js).
 */

import { PrismaClient } from '@prisma/client';
import { Chess } from 'chess.js';
import { isEngineAvailable, analyzePosition } from './stockfishEngine.js';
import { detectMotifs } from './puzzleMotifs.js';

const prisma = new PrismaClient();

const MIN_PLY = 12;            // přeskoč otevírku (~6 tahů)
const GAME_DEPTH = 12;         // hloubka Stockfishe při scanu partií
const DECISIVE_CP = 200;       // řešení musí vést k rozhodující výhodě (~+2)
const ALREADY_WON_CP = 450;    // pokud strana už DRTIVĚ vyhrávala (+4.5) → ne kombinace
const UNIQ_GAP_CP = 150;       // best − second (centipawny) = "jediné řešení" (nesaturuje jako win-chance)
const UNIQ_MARGIN_MIN = 0.4;   // jen pro zobrazení 'verified' (win-chance margin)

// Win-chance z centipawnů (Lichess sigmoid), [-1,+1]. Mat = ±1.
function winChance(cp, mate) {
    if (mate !== undefined && mate !== null) return mate > 0 ? 1 : -1;
    if (cp === undefined || cp === null) return 0;
    return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
}
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function bestMoveSan(fen, uci) {
    try {
        const c = new Chess(fen);
        const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || 'q' });
        return m ? m.san : uci;
    } catch {
        return uci;
    }
}

// Projde jednu partii a najde taktické kombinace (pozice = úlohy).
async function findTacticsInGame(g) {
    let chess;
    try {
        chess = new Chess();
        chess.loadPgn(g.pgn);
    } catch {
        return [];
    }
    const history = chess.history({ verbose: true });
    if (history.length < MIN_PLY + 2) return [];

    const hdr = (typeof chess.header === 'function') ? chess.header() : {};
    const white = g.whitePlayer || hdr.White || '?';
    const black = g.blackPlayer || hdr.Black || '?';

    const replay = new Chess();
    const found = [];
    const prevDecisive = { w: null, b: null }; // poslední eval (mover-pov) pro každou stranu

    for (let i = 0; i < history.length; i++) {
        const fenBefore = replay.fen();
        const mover = (i % 2 === 0) ? 'w' : 'b';
        const moverInCheck = (typeof replay.isCheck === 'function') ? replay.isCheck() : replay.in_check();
        const legalCount = replay.moves().length;

        // přeskoč otevírku, konec, vynucené pozice (v šachu / jediný tah = ne kombinace)
        if (i >= MIN_PLY && i < history.length - 1 && !moverInCheck && legalCount > 1) {
            const sf = await analyzePosition(fenBefore, { depth: GAME_DEPTH, multiPv: 2 });
            if (sf && sf.length) {
                const best = sf[0]; // Stockfish UCI score = pohled strany na tahu (= řešitel)
                const bestCp = (best.mate !== null) ? null : best.cp;
                const mateIn = (best.mate !== null && best.mate > 0) ? best.mate : null;
                const decisive = (mateIn !== null) || (bestCp !== null && bestCp >= DECISIVE_CP);
                const prev = prevDecisive[mover];
                const alreadyWon = prev !== null && prev >= ALREADY_WON_CP;
                // UNIQUENESS přes CENTIPAWN GAP — win-chance margin saturuje a vyřazoval
                // vyhrané taktiky (best +600 vs +400 = celá figura, ale wc margin jen ~0.17).
                let unique;
                if (best.mate !== null && best.mate > 0) {
                    // mat: jediné řešení, jen pokud druhý tah nematuje (nebo matuje výrazně pomaleji)
                    unique = (sf.length < 2) || (sf[1].mate === null) || (sf[1].mate > best.mate + 1);
                } else if (sf.length >= 2 && sf[1].mate === null) {
                    unique = (best.cp - sf[1].cp) >= UNIQ_GAP_CP;
                } else if (sf.length >= 2) {
                    unique = sf[1].mate < 0; // druhý tah prohrává → nejlepší je jasně jediný
                } else {
                    unique = true; // jen jeden rozumný tah
                }
                const uniqMargin = (sf.length >= 2)
                    ? winChance(best.cp, best.mate) - winChance(sf[1].cp, sf[1].mate)
                    : 1;

                // mate kombinace (oběť → mat) bereme i z vyhrané pozice; ne-mate jen když ne-už-vyhrané
                if (decisive && (mateIn !== null || !alreadyWon) && unique && best.firstMove) {
                    const opLast = i > 0 ? history[i - 1] : null;
                    const pvMoves = (best.pv && best.pv.length) ? best.pv : [best.firstMove];
                    const m = detectMotifs(fenBefore, opLast, pvMoves);

                    // ÚDER (pointa): mat, taktický motiv, nebo drtivá výhoda
                    const bigAdvantage = bestCp !== null && bestCp >= 500;
                    const hasPunch = mateIn !== null || m.motifs.length > 0 || bigAdvantage;
                    // KOMBINACE musí mít SEKVENCI (ne 1-tahový úder): mat ve 2+, oběť,
                    // nebo vynucená sekvence ≥2 pov tahů (oběť/šach/hrozba → vynucené odpovědi → pointa)
                    const isCombination = (mateIn !== null && mateIn >= 2)
                        || m.motifs.includes('sacrifice')
                        || m.forcingLen >= 2;
                    const isPuzzle = hasPunch && isCombination && !m.hangingGrab;

                    if (!m.obviousRecapture && isPuzzle) {
                        const playedBest = history[i].lan === best.firstMove;
                        const um = Math.round(uniqMargin * 100) / 100;
                        const isSac = m.motifs.includes('sacrifice');
                        const uniqScore = clamp(uniqMargin / 0.9, 0, 1);
                        const decScore = mateIn !== null ? 1 : clamp(winChance(bestCp, null) / 0.95, 0, 1);
                        const motifBonus = clamp(m.motifs.length * 0.25 + (isSac ? 0.4 : 0) + (mateIn ? 0.3 : 0), 0, 1);
                        const score = Math.round(100 * (0.34 * uniqScore + 0.22 * decScore + 0.30 * motifBonus + 0.14 * (mateIn ? 1 : 0.6)));
                        const difficulty = (mateIn !== null && mateIn <= 2) ? 'lehká' : ((uniqMargin < 0.6 || isSac) ? 'těžká' : 'střední');
                        found.push({
                            fenBefore,
                            bestMoveLAN: best.firstMove,
                            bestSan: bestMoveSan(fenBefore, best.firstMove),
                            toMove: mover,
                            uniqMargin: um,
                            mateIn,
                            bestSolverCp: bestCp,
                            playedBest,
                            ply: i,
                            moveNo: Math.floor(i / 2) + 1,
                            white, black,
                            newsId: g.newsId,
                            newsTitle: g.news?.title || null,
                            gameDate: g.news?.publishedDate || null,
                            score,
                            difficulty,
                            motifs: m.motifs,
                        });
                    }
                }
                prevDecisive[mover] = (best.mate !== null) ? (best.mate > 0 ? 9999 : -9999) : (best.cp ?? 0);
            }
        }

        try { replay.move(history[i].san); } catch { break; }
    }
    return found;
}

// ===== Background scan + cache v DB =====

let scanState = { running: false, total: 0, done: 0, found: 0, startedAt: null, finishedAt: null, error: null };

export function getScanState() {
    return { ...scanState };
}

// Spustí scan NA POZADÍ (nečeká na dokončení). rescanAll=true projede i už naskenované.
export async function startScan({ rescanAll = false } = {}) {
    if (scanState.running) return { alreadyRunning: true, state: getScanState() };
    const engineOk = await isEngineAvailable();
    if (!engineOk) return { error: 'Stockfish není dostupný na serveru.' };
    runScan(rescanAll).catch((e) => {
        console.error('[WeeklyPuzzles] scan error:', e);
        scanState.running = false;
        scanState.error = e.message;
        scanState.finishedAt = Date.now();
    });
    return { started: true, state: getScanState() };
}

async function runScan(rescanAll) {
    scanState = { running: true, total: 0, done: 0, found: 0, startedAt: Date.now(), finishedAt: null, error: null };

    const where = { pgn: { not: null }, newsId: { not: null }, news: { is: { isPublished: true } } };
    if (!rescanAll) where.puzzleScannedAt = null;

    const games = await prisma.game.findMany({
        where,
        include: { news: { select: { id: true, title: true, publishedDate: true } } },
        orderBy: { id: 'desc' },
    });
    scanState.total = games.length;

    for (const g of games) {
        try {
            const tactics = await findTacticsInGame(g);
            for (const t of tactics) {
                const data = {
                    gameId: g.id, newsId: t.newsId ?? null, fen: t.fenBefore,
                    bestMoveLan: t.bestMoveLAN, bestSan: t.bestSan, toMove: t.toMove,
                    uniqMargin: t.uniqMargin, mateIn: t.mateIn, bestCp: t.bestSolverCp,
                    playedBest: t.playedBest, ply: t.ply, moveNo: t.moveNo,
                    whitePlayer: t.white, blackPlayer: t.black,
                    newsTitle: t.newsTitle, gameDate: t.gameDate,
                    score: t.score, difficulty: t.difficulty,
                    motifs: (t.motifs && t.motifs.length) ? t.motifs.join(',') : null,
                };
                await prisma.puzzleCandidate.upsert({
                    where: { gameId_ply: { gameId: g.id, ply: t.ply } },
                    create: data,
                    update: data,
                });
            }
            scanState.found += tactics.length;
            await prisma.game.update({ where: { id: g.id }, data: { puzzleScannedAt: new Date() } });
        } catch (e) {
            console.error(`[WeeklyPuzzles] scan game ${g.id} failed:`, e.message);
        }
        scanState.done++;
    }

    scanState.running = false;
    scanState.finishedAt = Date.now();
}

// Dashboard: čte uložené kombinace z DB (okamžité).
export async function getStoredCandidates({ limit = 60 } = {}) {
    const rows = await prisma.puzzleCandidate.findMany({
        where: { dismissed: false },
        orderBy: { score: 'desc' },
        take: limit,
    });
    const candidates = rows.map((r) => ({
        id: r.id,
        fenBefore: r.fen,
        bestMoveLAN: r.bestMoveLan,
        bestSan: r.bestSan,
        toMove: r.toMove,
        uniqMargin: r.uniqMargin,
        mateIn: r.mateIn,
        bestSolverCp: r.bestCp,
        playedBest: r.playedBest,
        moveNo: r.moveNo,
        white: r.whitePlayer,
        black: r.blackPlayer,
        newsId: r.newsId,
        newsTitle: r.newsTitle,
        gameDate: r.gameDate,
        score: r.score,
        difficulty: r.difficulty,
        motifs: r.motifs ? r.motifs.split(',') : [],
        verified: r.uniqMargin >= UNIQ_MARGIN_MIN,
        usedInNewsId: r.usedInNewsId,
    }));

    const unscanned = await prisma.game.count({
        where: { pgn: { not: null }, newsId: { not: null }, news: { is: { isPublished: true } }, puzzleScannedAt: null },
    });

    return {
        candidates,
        meta: { stored: candidates.length, unscanned, scan: getScanState() },
    };
}
