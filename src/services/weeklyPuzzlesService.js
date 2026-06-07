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

const prisma = new PrismaClient();

const MIN_PLY = 12;            // přeskoč otevírku (~6 tahů)
const GAME_DEPTH = 12;         // hloubka Stockfishe při scanu partií
const DECISIVE_CP = 200;       // řešení musí vést k rozhodující výhodě (~+2)
const ALREADY_WON_CP = 250;    // pokud strana už předtím vyhrávala → ne kombinace
const UNIQ_MARGIN_MIN = 0.4;   // wc(best) - wc(second), [-1,+1] škála
const DEFAULT_MAX_GAMES = 3;   // kolik nejnovějších článkových partií projít naráz

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
                const uniqMargin = (sf.length >= 2)
                    ? winChance(best.cp, best.mate) - winChance(sf[1].cp, sf[1].mate)
                    : 1;

                // mate kombinace (oběť → mat) bereme i z vyhrané pozice; ne-mate jen když ne-už-vyhrané
                if (decisive && (mateIn !== null || !alreadyWon) && uniqMargin >= UNIQ_MARGIN_MIN && best.firstMove) {
                    const playedBest = history[i].lan === best.firstMove;
                    found.push({
                        id: `${g.id}_${i}`,
                        fenBefore,
                        bestMoveLAN: best.firstMove,
                        bestSan: bestMoveSan(fenBefore, best.firstMove),
                        toMove: mover,
                        uniqMargin: Math.round(uniqMargin * 100) / 100,
                        mateIn,
                        bestSolverCp: bestCp,
                        playedBest,
                        ply: i,
                        moveNo: Math.floor(i / 2) + 1,
                        white, black,
                        gameTitle: g.gameTitle,
                        newsId: g.newsId,
                        newsTitle: g.news?.title || null,
                        gameDate: g.news?.publishedDate || null,
                    });
                }
                prevDecisive[mover] = (best.mate !== null) ? (best.mate > 0 ? 9999 : -9999) : (best.cp ?? 0);
            }
        }

        try { replay.move(history[i].san); } catch { break; }
    }
    return found;
}

/**
 * Dashboard: projde nejnovější článkové partie a vrátí nalezené kombinace.
 */
export async function getPuzzleCandidates({ maxGames = DEFAULT_MAX_GAMES, limit = 30 } = {}) {
    const engineOk = await isEngineAvailable();
    if (!engineOk) {
        return { candidates: [], meta: { engine: 'none', error: 'Stockfish není dostupný na serveru.' } };
    }

    const games = await prisma.game.findMany({
        where: { pgn: { not: null }, newsId: { not: null }, news: { is: { isPublished: true } } },
        include: { news: { select: { id: true, title: true, publishedDate: true } } },
        orderBy: { id: 'desc' },
        take: maxGames,
    });

    const all = [];
    for (const g of games) {
        const tactics = await findTacticsInGame(g);
        all.push(...tactics);
    }

    // dedup podle pozice
    const seen = new Set();
    const dedup = [];
    for (const c of all) {
        if (seen.has(c.fenBefore)) continue;
        seen.add(c.fenBefore);
        dedup.push(c);
    }

    // skóre + obtížnost
    for (const c of dedup) {
        const uniqScore = clamp(c.uniqMargin / 0.9, 0, 1);
        const decScore = c.mateIn !== null ? 1 : clamp(winChance(c.bestSolverCp, null) / 0.95, 0, 1);
        c.score = Math.round(100 * (0.50 * uniqScore + 0.30 * decScore + 0.20 * (c.mateIn ? 1 : 0.6)));
        c.difficulty = (c.mateIn !== null && c.mateIn <= 2) ? 'lehká' : (c.uniqMargin < 0.6 ? 'těžká' : 'střední');
        c.verified = c.uniqMargin >= UNIQ_MARGIN_MIN;
    }
    dedup.sort((a, b) => b.score - a.score);

    return {
        candidates: dedup.slice(0, limit),
        meta: {
            engine: 'stockfish',
            gamesScanned: games.length,
            found: dedup.length,
        },
    };
}
