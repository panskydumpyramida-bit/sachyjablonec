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

function tryFirstMove(fen, uci) {
    try {
        const c = new Chess(fen);
        return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || 'q' });
    } catch {
        return null;
    }
}
function capturedVal(mv) {
    return mv && mv.captured ? ({ p: 1, n: 3, b: 3, r: 5, q: 9 }[mv.captured] || 0) : 0;
}

function bestMoveSan(fen, uci) {
    try {
        const c = new Chess(fen);
        const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || 'q' });
        return m ? m.san : uci;
    } catch {
        return uci;
    }
}

function lineSan(fen, uciList) {
    const c = new Chess(fen);
    const sans = [];
    for (const u of uciList) {
        try { const mv = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.slice(4) || 'q' }); if (!mv) break; sans.push(mv.san); } catch { break; }
    }
    return sans;
}
function formatSolutionSan(sans, startNo, moverWhite) {
    const out = [];
    let no = startNo, white = moverWhite;
    for (const s of sans) {
        if (white) out.push(`${no}.${s}`);
        else { out.push(s); no++; }
        white = !white;
    }
    return out.join(' ');
}

// Délka řešení v půltazích (z uložené UCI linie, fallback z forcingLen).
function lineHalfMoves(c) {
    if (c.solutionLine) return c.solutionLine.split(/\s+/).filter(Boolean).length || 1;
    return c.forcingLen ? Math.max(1, 2 * c.forcingLen - 1) : 1;
}

// DEDUPLIKACE: jedna vynucená kombinace se v partii detekuje na víc plynech
// (úder na ply p, ale i pokračovací pozice p+2, p+4 jsou "decisive+unique").
// Tady je sloučíme: pro každou stranu vezmeme kandidáty seřazené dle plynu a
// souvislý řetěz (další start padne dovnitř/těsně za pokrytí předchozího) bereme
// jako TUTÉŽ kombinaci — necháme jen nejstarší start (celou kombinaci), zbytek = fragmenty.
// Funguje pro čerstvé kandidáty i pro uložené řádky (mají ply/toMove/score/solutionLine).
function dedupeFragments(cands) {
    const byMover = {};
    for (const c of cands) (byMover[c.toMove] || (byMover[c.toMove] = [])).push(c);
    const keep = [], dropped = [];
    for (const mv of Object.keys(byMover)) {
        const arr = byMover[mv].slice().sort((a, b) => a.ply - b.ply || (b.score || 0) - (a.score || 0));
        let anchor = null, coverUpto = -Infinity;
        for (const c of arr) {
            const cEnd = c.ply + Math.max(0, lineHalfMoves(c) - 1);
            if (anchor && c.ply <= coverUpto + 2) {
                dropped.push({ drop: c, anchor });
                coverUpto = Math.max(coverUpto, cEnd);
            } else {
                anchor = c; coverUpto = cEnd; keep.push(c);
            }
        }
    }
    return { keep, dropped };
}

// Postaví kandidáta z pozice (start hádanky); vrátí objekt nebo null (neprošel filtry kombinace).
function buildCandidate(startFen, sf, opLast, ply, white, black, g) {
    const best = sf[0];
    if (!best || !best.firstMove) return null;
    const mover = startFen.split(' ')[1];
    const bestCp = (best.mate !== null) ? null : best.cp;
    const mateIn = (best.mate !== null && best.mate > 0) ? best.mate : null;
    const pvMoves = (best.pv && best.pv.length) ? best.pv : [best.firstMove];
    const m = detectMotifs(startFen, opLast, pvMoves);

    const bigAdvantage = bestCp !== null && bestCp >= 500;
    const hasPunch = mateIn !== null || m.motifs.length > 0 || bigAdvantage;
    const isCombination = (mateIn !== null && mateIn >= 2) || m.motifs.includes('sacrifice') || m.forcingLen >= 2;
    if (m.obviousRecapture || !(hasPunch && isCombination && !m.hangingGrab)) return null;

    const uniqMargin = (sf.length >= 2) ? winChance(best.cp, best.mate) - winChance(sf[1].cp, sf[1].mate) : 1;
    const isSac = m.motifs.includes('sacrifice');
    const fmv = tryFirstMove(startFen, best.firstMove);
    const fCheck = fmv ? (fmv.san.includes('+') || fmv.san.includes('#')) : false;
    const quiet = !!(fmv && !fmv.captured && !fCheck);
    let surprise;
    if (isSac) surprise = 1.0;
    else if (quiet) surprise = 0.85;
    else if (fmv && fmv.captured) {
        const leadsToStrong = (mateIn !== null) || (bestCp !== null && bestCp >= 350) || m.motifs.some((x) => x !== 'mate');
        surprise = leadsToStrong ? 0.7 : clamp(0.5 - capturedVal(fmv) * 0.04, 0.25, 0.5);
    } else surprise = 0.5;
    const uniqScore = clamp(uniqMargin / 0.9, 0, 1);
    const decScore = mateIn !== null ? 1 : clamp(winChance(bestCp, null) / 0.95, 0, 1);
    const motifBonus = clamp(m.motifs.length * 0.22 + (isSac ? 0.4 : 0) + (mateIn ? 0.3 : 0), 0, 1);
    const score = Math.round(100 * (0.28 * uniqScore + 0.18 * decScore + 0.26 * motifBonus + 0.18 * surprise + 0.10 * (mateIn ? 1 : 0.6)));
    const difficulty = (mateIn !== null && mateIn <= 2) ? 'lehká' : ((uniqMargin < 0.6 || isSac) ? 'těžká' : 'střední');
    const solLen = Math.max(1, 2 * (m.forcingLen || 1) - 1);
    const solUci = pvMoves.slice(0, solLen);
    const solSan = formatSolutionSan(lineSan(startFen, solUci), Math.floor(ply / 2) + 1, mover === 'w');

    return {
        fenBefore: startFen, bestMoveLAN: best.firstMove, bestSan: bestMoveSan(startFen, best.firstMove),
        toMove: mover, uniqMargin: Math.round(uniqMargin * 100) / 100, mateIn, bestSolverCp: bestCp,
        playedBest: false, ply, moveNo: Math.floor(ply / 2) + 1, white, black,
        newsId: g.newsId, newsTitle: g.news?.title || null, gameDate: g.news?.publishedDate || null,
        score, difficulty, motifs: m.motifs, forcingLen: m.forcingLen,
        cpGap: (best.mate === null && sf.length >= 2 && sf[1].mate === null) ? (best.cp - sf[1].cp) : null,
        solutionLine: solUci.join(' '), solutionSan: solSan,
    };
}

// Posun startu zpět: pokud úderu předchází vynucená příprava, jejíž PV pokračuje
// právě tímto úderem (kontinuita) a je sama jediná/silná → vrátí dřívější start.
async function extendStartBackward(history, candPly, povColor, urderUci) {
    let result = null, ply = candPly, urder = urderUci;
    for (let back = 0; back < 2; back++) {
        const pi = ply - 2;
        if (pi < MIN_PLY) break;
        const c = new Chess();
        let ok = true;
        for (let h = 0; h < pi; h++) { try { c.move(history[h].san); } catch { ok = false; break; } }
        if (!ok || c.turn() !== povColor || c.isCheck()) break;
        const fenPi = c.fen();
        const sfP = await analyzePosition(fenPi, { depth: GAME_DEPTH, multiPv: 2 });
        if (!sfP || !sfP.length) break;
        const b = sfP[0];
        // PV přípravy musí pokračovat ÚDEREM (3. půltah) = tatáž kombinace rozšířená zpět
        if (!b.pv || b.pv.length < 3 || b.pv[2] !== urder) break;
        const bCp = b.mate !== null ? null : b.cp;
        const mate = b.mate !== null && b.mate > 0;
        const decisive = mate || (bCp !== null && bCp >= DECISIVE_CP);
        let uniq;
        if (mate) uniq = sfP.length < 2 || sfP[1].mate === null || sfP[1].mate > b.mate + 1;
        else if (sfP.length >= 2 && sfP[1].mate === null) uniq = (b.cp - sfP[1].cp) >= UNIQ_GAP_CP;
        else uniq = sfP.length < 2 || (sfP.length >= 2 && sfP[1].mate < 0);
        if (!decisive || !uniq) break;
        result = { fen: fenPi, sf: sfP, opLast: pi > 0 ? history[pi - 1] : null, ply: pi };
        ply = pi;
        urder = b.firstMove;
    }
    return result;
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
                    // POSUN STARTU ZPĚT: zkus, jestli úderu předchází vynucená příprava,
                    // jejíž PV pokračuje právě tímto úderem → hádanka začne dřív (méně očividná).
                    const ext = await extendStartBackward(history, i, mover, best.firstMove);
                    const sFen = ext ? ext.fen : fenBefore;
                    const sSf = ext ? ext.sf : sf;
                    const sPly = ext ? ext.ply : i;
                    const sOpLast = ext ? ext.opLast : (i > 0 ? history[i - 1] : null);
                    const cand = buildCandidate(sFen, sSf, sOpLast, sPly, white, black, g);
                    if (cand) {
                        cand.playedBest = history[cand.ply] ? (history[cand.ply].lan === cand.bestMoveLAN) : false;
                        found.push(cand);
                    }
                }
                prevDecisive[mover] = (best.mate !== null) ? (best.mate > 0 ? 9999 : -9999) : (best.cp ?? 0);
            }
        }

        try { replay.move(history[i].san); } catch { break; }
    }
    // Slouč fragmenty téže kombinace → jen celé kombinace (nejstarší start).
    return dedupeFragments(found).keep;
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
                    forcingLen: t.forcingLen ?? null, cpGap: t.cpGap ?? null,
                    solutionLine: t.solutionLine ?? null, solutionSan: t.solutionSan ?? null,
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

    // Self-heal: slouč případné rozkouskované kombinace / duplicity z tohoto i dřívějších scanů.
    try {
        const dd = await dedupeStoredCandidates();
        if (dd.removed) console.log(`[WeeklyPuzzles] dedupe: sloučeno ${dd.removed} fragmentů, hlasů přesunuto ${dd.votesMoved}`);
    } catch (e) {
        console.error('[WeeklyPuzzles] dedupe po scanu selhal:', e.message);
    }

    scanState.running = false;
    scanState.finishedAt = Date.now();
}

// Dashboard: čte uložené kombinace z DB (okamžité). Řazeno dle hodnocení, pak skóre.
export async function getStoredCandidates({ limit = 60, userId = null } = {}) {
    const rows = await prisma.puzzleCandidate.findMany({
        where: { dismissed: false },
        orderBy: [{ rating: 'desc' }, { score: 'desc' }],
        take: limit,
    });
    let myVotes = {};
    if (userId) {
        const votes = await prisma.puzzleVote.findMany({
            where: { userId, candidateId: { in: rows.map((r) => r.id) } },
            select: { candidateId: true, value: true },
        });
        myVotes = Object.fromEntries(votes.map((v) => [v.candidateId, v.value]));
    }
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
        forcingLen: r.forcingLen,
        cpGap: r.cpGap,
        solutionSan: r.solutionSan,
        solutionLine: r.solutionLine,
        rating: r.rating,
        voteCount: r.voteCount,
        myVote: myVotes[r.id] ?? 0,
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

// Hlasování — upsert hlasu uživatele (value: -1 špatná / 1 dobrá / 2 skvělá) + přepočet agregátu
export async function voteCandidate(candidateId, userId, value, source = 'admin') {
    const v = [-1, 1, 2].includes(value) ? value : (value > 0 ? 1 : -1);
    await prisma.puzzleVote.upsert({
        where: { candidateId_userId: { candidateId, userId } },
        create: { candidateId, userId, value: v, source },
        update: { value: v, source },
    });
    const agg = await prisma.puzzleVote.aggregate({
        where: { candidateId },
        _sum: { value: true },
        _count: { _all: true },
    });
    const rating = agg._sum.value || 0;
    const voteCount = agg._count._all || 0;
    await prisma.puzzleCandidate.update({ where: { id: candidateId }, data: { rating, voteCount } });
    return { rating, voteCount, myVote: v };
}

// Přesune hlasy z fragmentu na ponechaného kandidáta (řeší unikátnost [candidate,user]).
async function moveVotes(fromId, toId) {
    let moved = 0;
    const fragVotes = await prisma.puzzleVote.findMany({ where: { candidateId: fromId } });
    for (const fv of fragVotes) {
        if (fv.userId == null) {
            // anonymní hlas — nehrozí kolize unikátnosti, prostě přesměruj
            await prisma.puzzleVote.update({ where: { id: fv.id }, data: { candidateId: toId } });
            moved++;
            continue;
        }
        const existing = await prisma.puzzleVote.findUnique({
            where: { candidateId_userId: { candidateId: toId, userId: fv.userId } },
        });
        if (existing) {
            // kotva už hlas od tohoto uživatele má → fragmentový zahoď
            await prisma.puzzleVote.delete({ where: { id: fv.id } });
        } else {
            await prisma.puzzleVote.update({ where: { id: fv.id }, data: { candidateId: toId } });
            moved++;
        }
    }
    return moved;
}

// ÚKLID ULOŽENÝCH DAT: sloučí rozkouskované kombinace + identické pozice napříč
// partiemi. Hlasy zachová (přesune na ponechaného kandidáta), fragmenty smaže.
// Idempotentní — opakované spuštění už nic nenajde. Nepotřebuje Stockfish.
export async function dedupeStoredCandidates() {
    const rows = await prisma.puzzleCandidate.findMany({
        select: { id: true, gameId: true, ply: true, toMove: true, fen: true, solutionLine: true, forcingLen: true, score: true },
    });

    const pairs = []; // { dropId, keepId }  — pořadí: nejdřív fragmenty v partii, pak shodné FENy

    // 1) per-partii: rozkouskované kombinace
    const byGame = {};
    for (const r of rows) (byGame[r.gameId] || (byGame[r.gameId] = [])).push(r);
    for (const gid of Object.keys(byGame)) {
        const { dropped } = dedupeFragments(byGame[gid]);
        for (const d of dropped) pairs.push({ dropId: d.drop.id, keepId: d.anchor.id });
    }

    // 2) globálně: úplně identické pozice (např. táž partie ve dvou článcích)
    const droppedSoFar = new Set(pairs.map((p) => p.dropId));
    const survivors = rows.filter((r) => !droppedSoFar.has(r.id));
    const byFen = {};
    for (const r of survivors) (byFen[r.fen] || (byFen[r.fen] = [])).push(r);
    for (const fen of Object.keys(byFen)) {
        const grp = byFen[fen].sort((a, b) => (b.score || 0) - (a.score || 0));
        for (let i = 1; i < grp.length; i++) pairs.push({ dropId: grp[i].id, keepId: grp[0].id });
    }

    const droppedIds = new Set(pairs.map((p) => p.dropId));
    const anchors = new Set();
    let votesMoved = 0;
    for (const { dropId, keepId } of pairs) {
        anchors.add(keepId);
        votesMoved += await moveVotes(dropId, keepId);
        await prisma.puzzleCandidate.delete({ where: { id: dropId } }); // cascade smaže případné zbylé hlasy
    }
    // přepočet agregátů u ponechaných (které samy nebyly smazány)
    for (const keepId of anchors) {
        if (droppedIds.has(keepId)) continue;
        const agg = await prisma.puzzleVote.aggregate({
            where: { candidateId: keepId }, _sum: { value: true }, _count: { _all: true },
        });
        await prisma.puzzleCandidate.update({
            where: { id: keepId },
            data: { rating: agg._sum.value || 0, voteCount: agg._count._all || 0 },
        });
    }
    return { removed: pairs.length, anchors: anchors.size, votesMoved };
}

// Učení: rysy ohodnocených kandidátů (pro analýzu, co odlišuje dobré od špatných)
export async function getRatingInsights() {
    const rated = await prisma.puzzleCandidate.findMany({
        where: { voteCount: { gt: 0 } },
        select: {
            id: true, rating: true, voteCount: true, motifs: true, forcingLen: true, cpGap: true,
            mateIn: true, bestCp: true, playedBest: true, difficulty: true, score: true,
            bestSan: true, whitePlayer: true, blackPlayer: true, fen: true,
        },
        orderBy: { rating: 'desc' },
    });
    return { rated, count: rated.length };
}

// HÁDANKA DNE (veřejná, pro homepage modal).
// Mix: pokud admin připnul konkrétní (setting daily_puzzle_pinned), vrátí ji;
// jinak auto = z nejlépe hodnocených rotace podle dne.
export async function getDailyPuzzle(offset = 0) {
    offset = Math.max(0, Math.min(13, parseInt(offset, 10) || 0)); // 0 = dnes, max 13 dní zpět

    const pool = await prisma.puzzleCandidate.findMany({
        where: { dismissed: false },
        orderBy: [{ rating: 'desc' }, { score: 'desc' }],
        take: 14,
    });
    const maxOffset = Math.max(0, Math.min(13, pool.length - 1));

    let cand = null;
    if (offset === 0) {
        // připnutá hádanka platí jen pro dnešek
        try {
            const s = await prisma.systemSetting.findUnique({ where: { key: 'daily_puzzle_pinned' } });
            const pinnedId = s && s.value ? parseInt(s.value) : null;
            if (pinnedId) cand = await prisma.puzzleCandidate.findFirst({ where: { id: pinnedId, dismissed: false } });
        } catch { /* setting nemusí existovat */ }
    }

    if (!cand && pool.length) {
        const dayIdx = Math.floor(Date.now() / 86400000) - offset; // pořadové číslo dne → rotace
        cand = pool[((dayIdx % pool.length) + pool.length) % pool.length];
    }
    if (!cand) return null;

    const date = new Date(Date.now() - offset * 86400000);

    return {
        date: date.toISOString().slice(0, 10),
        offset,
        maxOffset,
        id: cand.id,
        fen: cand.fen,
        toMove: cand.toMove,
        solutionUci: cand.bestMoveLan,   // řešení (1. tah) — validace na klientu
        solutionSan: cand.bestSan,
        solutionLine: cand.solutionSan,  // celá varianta v SAN pro zobrazení
        motifs: cand.motifs ? cand.motifs.split(',') : [],
        white: cand.whitePlayer,
        black: cand.blackPlayer,
        moveNo: cand.moveNo,
        difficulty: cand.difficulty,
        source: cand.newsTitle || null,
        newsId: cand.newsId || null,
    };
}
