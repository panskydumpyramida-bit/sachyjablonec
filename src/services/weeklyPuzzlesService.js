/**
 * Weekly Puzzles Service — "Úloha týdne"
 *
 * Z BlunderAnalysis (1. síto: pozice, kde taktika reálně byla a tah byl přehlédnut)
 * vybírá KOMBINACE (2. síto: jediné úzké řešení = uniqueness gate) vhodné jako
 * interaktivní taktické úlohy "najdi nejlepší tah".
 *
 * Metodika ověřena deep-research proti lichess-puzzler / Play Magnus / DeepMind
 * (arXiv 2510.23881) / Chess-Tactic-Finder. Viz WEEKLY-PUZZLES-PLAN.md §3.
 *
 * Uniqueness zdroj pro F1: Lichess cloud-eval multiPv (zdarma, cache pozice).
 * Pozice mimo cache → uniqMargin=null ("nepotvrzeno"). Plný multiPV pro libovolnou
 * pozici vyžaduje lokální Stockfish (F1.5).
 */

import { PrismaClient } from '@prisma/client';
import { Chess } from 'chess.js';

const prisma = new PrismaClient();

// === Prahy (win-chance škála [-1,+1], viz §3) ===
const ALREADY_WON_PAWNS = 2.5;   // řešitel už drtivě vyhrával PŘED tahem → ne úloha
const DECISIVE_MIN_CP = 180;     // řešení musí vést k rozhodující výhodě (~+1.8 pawn)
const UNIQ_MARGIN_MIN = 0.5;     // wc(best) - wc(second); mezi DeepMind 0.5 a lichess 0.7
const VERIFY_POOL = 28;          // kolik top kandidátů ověřit přes Lichess (rate-limit šetrné)
const LICHESS_DELAY_MS = 130;

// Win-chance z centipawnů (Lichess sigmoid), rozsah [-1, +1]. Mat = ±1.
function winChance(cp, mate) {
    if (mate !== undefined && mate !== null) return mate > 0 ? 1 : -1;
    if (cp === undefined || cp === null) return 0;
    return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
}

// Eval z pohledu řešitele (uložené evaly jsou white-perspective).
function toSolver(cpWhite, mateWhite, solverIsWhite) {
    const cp = (cpWhite === undefined || cpWhite === null) ? null : (solverIsWhite ? cpWhite : -cpWhite);
    const mate = (mateWhite === undefined || mateWhite === null) ? null : (solverIsWhite ? mateWhite : -mateWhite);
    return { cp, mate };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// UCI ("g1f3" / "e7e8q") → chess.js move; vrací move obj nebo null (nelegální).
function tryMove(fen, uci) {
    try {
        const c = new Chess(fen);
        const mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || 'q' });
        return mv || null;
    } catch {
        return null;
    }
}

// Lichess cloud-eval multiPv → pvs z pohledu BÍLÉHO (cp), seřazené nejlepší-pro-hráče první.
async function lichessMultiPv(fen, multiPv = 5) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(
            `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=${multiPv}`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (!res.ok) return null; // 404 = pozice není v cache
        const data = await res.json();
        if (!data?.pvs?.length) return null;
        return data.pvs.map(pv => ({
            cp: pv.cp ?? null,
            mate: pv.mate ?? null,
            firstMove: pv.moves?.split(' ')[0] || null,
        }));
    } catch {
        return null;
    }
}

/**
 * Hlavní vstup pro dashboard: vrátí seřazené kandidáty na úlohu.
 * @param {object} opts { threshold, limit }
 */
export async function getPuzzleCandidates({ threshold = 10, limit = 30 } = {}) {
    // 1. síto — BlunderAnalysis (taktika reálně byla, tah přehlédnut)
    const raw = await prisma.blunderAnalysis.findMany({
        where: { type: { in: ['blunder', 'miss'] }, probDrop: { gte: threshold } },
        orderBy: { probDrop: 'desc' },
        take: 400,
    });

    // game date pro freshness
    const gameIds = [...new Set(raw.map(r => r.gameId))];
    const games = await prisma.chessGame.findMany({
        where: { id: { in: gameIds } },
        select: { id: true, date: true, event: true },
    });
    const gameMap = new Map(games.map(g => [g.id, g]));

    // 2. předfiltr zadarmo (chess.js): legalita bestMove + dedup + ne-už-vyhrané
    const seenFen = new Set();
    const gamesUsed = new Map(); // gameId -> count
    const prelim = [];
    for (const r of raw) {
        if (!r.bestMoveLAN || !r.fenBefore) continue;
        if (seenFen.has(r.fenBefore)) continue;

        const parts = r.fenBefore.split(' ');
        const solverIsWhite = parts[1] === 'w';

        // bestMove MUSÍ být legální ve fenBefore (vyřadí posunuté 'miss' pozice)
        const mv = tryMove(r.fenBefore, r.bestMoveLAN);
        if (!mv) continue;

        // řešitel už drtivě vyhrával před tahem? → ne úloha
        const before = toSolver(r.evalBefore !== null ? r.evalBefore : null, null, solverIsWhite);
        if (before.cp !== null && before.cp > ALREADY_WON_PAWNS) continue;

        seenFen.add(r.fenBefore);
        prelim.push({
            row: r,
            solverIsWhite,
            bestSan: mv.san,
            isCapture: !!mv.captured,
            isCheck: mv.san.includes('+') || mv.san.includes('#'),
        });
    }

    // ohodnotit nejprve podle probDrop, ověřovat jen top VERIFY_POOL (Lichess rate-limit)
    const toVerify = prelim.slice(0, VERIFY_POOL);

    const scored = [];
    for (const cand of toVerify) {
        const { row: r, solverIsWhite } = cand;

        // 3. UNIQUENESS GATE + decisive — Lichess multiPv (cache), jinak chess-api eval
        let uniqMargin = null;
        let uniqSource = 'none';
        let bestSolverCp = null;
        let mateIn = null;

        const pvs = await lichessMultiPv(r.fenBefore, 5);
        if (pvs && pvs.length) {
            const best = toSolver(pvs[0].cp, pvs[0].mate, solverIsWhite);
            bestSolverCp = best.cp;
            if (best.mate !== null && best.mate > 0) mateIn = best.mate;
            if (pvs.length >= 2) {
                const second = toSolver(pvs[1].cp, pvs[1].mate, solverIsWhite);
                uniqMargin = winChance(best.cp, best.mate) - winChance(second.cp, second.mate);
            } else {
                uniqMargin = 1; // jen 1 legální/rozumný tah dle Lichess = jedinečné
            }
            uniqSource = 'lichess';
            await delay(LICHESS_DELAY_MS);
        }
        // F1: pozice mimo Lichess cache NEřešíme drahým chess-api fallbackem (timeout risk
        // při desítkách pozic) — projdou jako "jedinečnost nepotvrzena", skóre dle probDrop.
        // Plný multiPV pro libovolnou pozici = F1.5 (lokální Stockfish, viz deep-research).

        // decisive: po nejlepším tahu má řešitel rozhodující výhodu (nebo mat)
        const decisive = (mateIn !== null) || (bestSolverCp !== null && bestSolverCp >= DECISIVE_MIN_CP);
        // pozice mimo cache bez evalu necháme projít (decisive=neznámé), ať je v dashboardu vidět
        if (bestSolverCp !== null && !decisive && mateIn === null) continue;

        // 4. skóre kvality
        const game = gameMap.get(r.gameId);
        const freshness = freshnessScore(game?.date || r.createdAt);
        const uniqScore = uniqMargin !== null ? clamp(uniqMargin / 0.9, 0, 1) : 0.45;
        const decisiveScore = bestSolverCp !== null
            ? clamp(winChance(bestSolverCp, mateIn) / 0.95, 0, 1)
            : clamp(r.probDrop / 40, 0, 1);
        const forcingLite = (cand.isCapture || cand.isCheck) ? 0.6 : 1.0;
        const score = Math.round(100 * (
            0.40 * uniqScore + 0.30 * decisiveScore + 0.15 * forcingLite + 0.15 * freshness
        ));

        const verified = uniqSource === 'lichess' && uniqMargin !== null && uniqMargin >= UNIQ_MARGIN_MIN;

        scored.push({
            id: r.id,
            gameId: r.gameId,
            fenBefore: r.fenBefore,
            bestMoveLAN: r.bestMoveLAN,
            bestSan: cand.bestSan,
            toMove: solverIsWhite ? 'w' : 'b',
            type: r.type,
            white: r.white,
            black: r.black,
            result: r.result,
            event: game?.event || null,
            gameDate: game?.date || null,
            createdAt: r.createdAt,
            probDrop: r.probDrop,
            evalBefore: r.evalBefore,
            evalAfter: r.evalAfter,
            bestSolverCp,
            mateIn,
            uniqMargin: uniqMargin !== null ? Math.round(uniqMargin * 100) / 100 : null,
            uniqSource,
            verified,
            isCapture: cand.isCapture,
            isCheck: cand.isCheck,
            difficulty: difficultyOf(uniqMargin, cand, mateIn),
            score,
        });
    }

    // řadit: ověřené nahoru, pak podle skóre
    scored.sort((a, b) => (b.verified - a.verified) || (b.score - a.score));

    return {
        candidates: scored.slice(0, limit),
        meta: {
            poolTotal: prelim.length,
            verified: toVerify.length,
            lichessHits: scored.filter(c => c.uniqSource === 'lichess').length,
            confirmedUnique: scored.filter(c => c.verified).length,
            threshold,
        },
    };
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function freshnessScore(date) {
    if (!date) return 0.3;
    const days = (Date.now() - new Date(date).getTime()) / 86400000;
    return clamp(1 - days / 180, 0, 1);
}

function difficultyOf(uniqMargin, cand, mateIn) {
    if (mateIn !== null && mateIn <= 2) return 'lehká';
    const quiet = !cand.isCapture && !cand.isCheck;
    if (uniqMargin !== null && uniqMargin < 0.6 && quiet) return 'těžká';
    if ((cand.isCapture || cand.isCheck)) return 'lehká';
    return 'střední';
}
