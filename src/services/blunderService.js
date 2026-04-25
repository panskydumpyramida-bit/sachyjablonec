/**
 * Blunder Analysis Service
 * Server-side eval logic with heuristic pre-filter + two-stage evaluation.
 * Results stored in BlunderAnalysis DB table.
 */

import { PrismaClient } from '@prisma/client';
import { Chess } from 'chess.js';

const prisma = new PrismaClient();

const DAILY_SCAN_LIMIT = 10; // max new games per player per day
const BATCH_SIZE = 1; // games per single request (Cloudflare 100s timeout — full eval ~40s per game)
const BLUNDER_THRESHOLD = 5; // Minimální Win% drop pro uložení do DB (slider začíná na 5)
const MISS_THRESHOLD = 8; // Misses můžou být o něco mírnější

// === Position-based blunder rule (pawn units, target player's perspective) ===
// Symetrické prahy: |1.5| = "jasná převaha" / "jasná prohra".
// Mezi -1.5 a +1.5 = gray zone (cca remíza).
//
// Tři kumulativní podmínky (všechny musí platit):
//
//   (1) Pozice před tahem nebyla už předtím jasně prohraná: evalBefore ≥ -1.5
//   (2) Drop v evalu byl ≥ 2.5 pawnů (ne drobné posuny)
//   (3) Konečná pozice je buď:
//       (a) Vypuštěná jasná výhra: evalBefore ≥ +1.5 AND evalAfter < +1.5
//           (vypadl z clear-win zóny do gray nebo prohry)
//       (b) NEBO jasně prohraná pozice: evalAfter ≤ -1.5
//
// Příklady ✓ blunder:
//   +5 → +1     (vypuštěná výhra, drop 4)
//   +1 → -2     (z výhry do prohry)
//   0 → -3      (z remízy do prohry)
//   -1 → -4     (ze slabší pozice do drtivé prohry)
//   -1.5 → -4   (boundary: before na hranici clearly-lost ≥ -1.5)
//
// Příklady ✗ NE blunder:
//   +5 → +2     (pořád jasná výhra ≥ +1.5)
//   +2 → +1     (drop jen 1, malý rozdíl)
//   +0.5 → -1.2 (drop 1.7 < 2.5, gray zone)
//   -1 → -3     (drop 2 < 2.5, hraniční)
//   -2 → -5     (před tahem už jasně prohraná, evalBefore < -1.5)
//   0 → -0.8    (mírné kolísání, drop < 2.5)
const BLUNDER_BEFORE_AT_LEAST = -1.5;
const BLUNDER_MIN_DROP = 2.5;
const BLUNDER_CLEAR_WIN = 1.5;
const BLUNDER_CLEAR_LOSS = -1.5;

// Převede eval na target-perspective pawns (z Lichess white-perspective cp).
function evalToTargetPawns(evalObj, targetIsWhite) {
    if (!evalObj) return null;
    if (evalObj.mate !== undefined && evalObj.mate !== null) {
        // Lichess konvence: mate > 0 = white mates
        const whiteView = evalObj.mate > 0 ? 999 : -999;
        return targetIsWhite ? whiteView : -whiteView;
    }
    if (evalObj.cp === undefined || evalObj.cp === null) return null;
    return targetIsWhite ? evalObj.cp / 100 : -evalObj.cp / 100;
}

export function matchesBlunderRule(evalBeforeTarget, evalAfterTarget) {
    if (evalBeforeTarget === null || evalAfterTarget === null) return false;
    // (1) Před tahem nebyla pozice už jasně prohraná (≥ -1.5)
    if (evalBeforeTarget < BLUNDER_BEFORE_AT_LEAST) return false;
    // (2) Drop ≥ 2.5 pawnů — ne drobné posuny
    const drop = evalBeforeTarget - evalAfterTarget;
    if (drop < BLUNDER_MIN_DROP) return false;
    // (3) Buď vypuštěná jasná výhra, nebo nyní jasná prohra
    const gaveUpWin = evalBeforeTarget >= BLUNDER_CLEAR_WIN && evalAfterTarget < BLUNDER_CLEAR_WIN;
    const nowLosing = evalAfterTarget <= BLUNDER_CLEAR_LOSS;
    return gaveUpWin || nowLosing;
}

// === Win probability from centipawns (Lichess formula) ===
function getWinProbability(evalObj) {
    if (!evalObj) return 50;
    if (evalObj.mate !== undefined && evalObj.mate !== null) {
        return evalObj.mate > 0 ? 100 : 0;
    }
    const cp = evalObj.cp;
    if (cp === undefined || cp === null) return 50;
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

// === Heuristic pre-filter ===
function isSuspiciousMove(move, prevMove, moveIndex, totalMoves) {
    if (moveIndex < 4 || moveIndex > totalMoves - 4) return true;
    if (move.captured) return true;
    if (move.san.includes('+') || move.san.includes('#')) return true;
    if (move.piece === 'p' && (move.to[1] === '7' || move.to[1] === '2')) return true;
    if (move.promotion) return true;
    if (move.piece !== 'p') {
        const fromRank = parseInt(move.from[1]);
        const toRank = parseInt(move.to[1]);
        const isWhite = move.color === 'w';
        if ((isWhite && toRank < fromRank - 1) || (!isWhite && toRank > fromRank + 1)) return true;
    }
    if (prevMove && prevMove.captured) return true;
    if (move.piece === 'q' && moveIndex < 16) return true;
    if (moveIndex % 5 === 0) return true;
    return false;
}

// === Position eval (Lichess Cloud → chess-api.com fallback) ===
async function getPositionEval(fen, depth = 8) {
    // 1. Lichess Cloud
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`, {
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (res.ok) {
            const data = await res.json();
            if (data?.pvs?.[0]) {
                return { cp: data.pvs[0].cp, mate: data.pvs[0].mate, bestMove: data.pvs[0].moves?.split(' ')[0], source: 'lichess' };
            }
        }
    } catch { /* ignore */ }

    // 2. Chess-API.com fallback (with retry on rate limit)
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            if (attempt > 0) await delay(1000 * attempt); // backoff: 1s, 2s

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const res = await fetch('https://chess-api.com/v1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen, depth }),
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (res.status === 429) {
                console.warn(`[BlunderEval] Chess-API rate limited, attempt ${attempt + 1}/3`);
                continue; // retry with backoff
            }

            if (res.ok) {
                const data = await res.json();
                if (data && !data.error) {
                    let cpVal = data.centipawns !== undefined ? parseInt(data.centipawns) : (data.eval !== undefined ? Math.round(data.eval * 100) : null);
                    if (cpVal === null) continue;
                    return { cp: cpVal, mate: data.mate || null, bestMove: data.move, source: 'chess-api' };
                }
                if (data?.error) {
                    console.warn(`[BlunderEval] Chess-API error: ${data.error}, attempt ${attempt + 1}/3`);
                    continue;
                }
            }
        } catch (e) {
            console.warn(`[BlunderEval] Chess-API exception, attempt ${attempt + 1}/3:`, e.message);
        }
    }

    return null;
}

function getMoveLAN(moveObj) {
    return moveObj.lan || (moveObj.from + moveObj.to + (moveObj.promotion || ''));
}

function safeFen(fen) {
    const parts = fen.split(' ');
    if (parts.length >= 4 && parts[3] !== '-') parts[3] = '-';
    return parts.join(' ');
}

// === Analyze a single game ===
async function analyzeGame(gameData, playerName) {
    const chess = new Chess();
    const movesArr = gameData.moves.split(' ').filter(m => m);
    for (const m of movesArr) {
        try { chess.move(m); } catch { break; }
    }

    const history = chess.history({ verbose: true });
    if (history.length < 4) return [];

    // Phase 1 + 2: Quick eval (depth 8) pro VŠECHNY pozice (zrušena chybná agresivní heuristika)
    const tempChess = new Chess();
    const evals = new Array(history.length + 1).fill(null);

    for (let i = 0; i <= history.length; i++) {
        const ev = await getPositionEval(safeFen(tempChess.fen()), 8);
        evals[i] = ev;
        if (ev?.source === 'chess-api') await delay(500);
        else if (ev?.source === 'lichess') await delay(50);
        else await delay(200);
        
        if (i < history.length) tempChess.move(history[i]);
    }

    const evalOk = evals.filter(e => e !== null).length;
    const evalNull = evals.filter(e => e === null).length;
    const lichessCount = evals.filter(e => e?.source === 'lichess').length;
    const chessApiCount = evals.filter(e => e?.source === 'chess-api').length;
    console.log(`[BlunderAnalysis] Game ${gameData.id}: ${history.length} moves, evals: ${evalOk} ok (${lichessCount} lichess, ${chessApiCount} chess-api), ${evalNull} null`);

    // Phase 3: Deep eval where CP jumped > 30
    const deepIndices = new Set();
    for (let i = 0; i < history.length; i++) {
        if (evals[i] && evals[i + 1]) {
            if (Math.abs((evals[i + 1].cp || 0) - (evals[i].cp || 0)) > 30) {
                deepIndices.add(i);
                deepIndices.add(i + 1);
            }
        }
    }

    if (deepIndices.size > 0) {
        const tempChess2 = new Chess();
        for (let i = 0; i <= history.length; i++) {
            if (deepIndices.has(i)) {
                const ev = await getPositionEval(safeFen(tempChess2.fen()), 14);
                if (ev) evals[i] = ev;
                if (ev?.source === 'chess-api') await delay(350);
                else await delay(50);
            }
            if (i < history.length) tempChess2.move(history[i]);
        }
    }

    // Phase 4: Detect blunders and misses
    const results = [];
    for (let i = 0; i < history.length; i++) {
        const move = history[i];
        const isWhiteToMove = (i % 2 === 0);
        const activePlayer = isWhiteToMove ? gameData.whitePlayer : gameData.blackPlayer;
        const isTargetPlayerMove = activePlayer.toLowerCase().includes(playerName.toLowerCase());

        const curr = evals[i];
        const next = evals[i + 1];
        if (!curr || !next) continue;

        const probWBefore = getWinProbability(curr);
        const probWAfter = getWinProbability(next);
        const probBefore = isWhiteToMove ? probWBefore : (100 - probWBefore);
        const probAfter = isWhiteToMove ? probWAfter : (100 - probWAfter);
        const probDrop = probBefore - probAfter;

        // Reconstruct FEN before move
        const fenChess = new Chess();
        for (let h = 0; h < i; h++) fenChess.move(history[h]);
        const fenBefore = fenChess.fen();

        const moveLAN = getMoveLAN(move);

        if (isTargetPlayerMove && curr.bestMove && curr.bestMove !== moveLAN) {
            // Target player's absolute eval (pawn units, from their perspective)
            const evalBeforeTarget = evalToTargetPawns(curr, isWhiteToMove);
            const evalAfterTarget = evalToTargetPawns(next, isWhiteToMove);
            // Nová pravidla: blunder JEN když hráč vypustil výhru nebo obrátil partii.
            // Win% drop threshold zůstává jako sanity check (≥5%), ale skutečný rozhodující
            // filtr je absolutní eval přechod z výhry do prohry.
            const isReversal = matchesBlunderRule(evalBeforeTarget, evalAfterTarget);
            if (isReversal && probDrop >= BLUNDER_THRESHOLD) {
                results.push({
                    type: 'blunder',
                    gameId: gameData.id,
                    fenBefore,
                    movePlayed: move.san,
                    movePlayedLAN: moveLAN,
                    bestMoveLAN: curr.bestMove,
                    evalBefore: curr.cp !== undefined ? curr.cp / 100 : null,
                    evalAfter: next.cp !== undefined ? next.cp / 100 : null,
                    probDrop: Math.round(probDrop * 10) / 10,
                    white: gameData.whitePlayer,
                    black: gameData.blackPlayer,
                    result: gameData.result,
                });
            }
        }

        if (!isTargetPlayerMove && probDrop <= -MISS_THRESHOLD) {
            const nextMoveLAN = (i + 1 < history.length) ? getMoveLAN(history[i + 1]) : null;
            if (next.bestMove && nextMoveLAN && next.bestMove !== nextMoveLAN) {
                results.push({
                    type: 'miss',
                    gameId: gameData.id,
                    fenBefore: next.cp !== undefined ? fenBefore : fenBefore, // FEN after opponent's blunder
                    movePlayed: (i + 1 < history.length) ? history[i + 1].san : move.san,
                    movePlayedLAN: nextMoveLAN || moveLAN,
                    bestMoveLAN: next.bestMove,
                    evalBefore: next.cp !== undefined ? next.cp / 100 : null,
                    evalAfter: evals[i + 2]?.cp !== undefined ? evals[i + 2].cp / 100 : null,
                    probDrop: Math.round(Math.abs(probDrop) * 10) / 10,
                    white: gameData.whitePlayer,
                    black: gameData.blackPlayer,
                    result: gameData.result,
                });
            }
        }
    }

    return results;
}

function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// === Main scan function ===
export async function scanPlayerGames(playerName, specificGameIds = null, overrideLimit = false) {
    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayScans = await prisma.blunderScanLog.aggregate({
        where: {
            playerName: playerName.toLowerCase(),
            scannedAt: { gte: today }
        },
        _sum: { gamesScanned: true }
    });
    const scannedToday = todayScans._sum.gamesScanned || 0;
    let remaining = Math.max(0, DAILY_SCAN_LIMIT - scannedToday);

    if (overrideLimit) {
        remaining = 9999;
    }

    if (remaining === 0) {
        return { error: 'daily_limit', message: 'Denní limit 10 partií vyčerpán. Zkuste zítra.' };
    }

    // Find games not yet analyzed
    const analyzedGameIds = (await prisma.blunderAnalysis.findMany({
        where: { playerName: playerName.toLowerCase() },
        select: { gameId: true },
        distinct: ['gameId']
    })).map(a => a.gameId);

    const scannedGameIds = new Set(analyzedGameIds);

    // Get all games for this player
    const allGames = await prisma.chessGame.findMany({
        where: {
            OR: [
                { whitePlayer: { contains: playerName, mode: 'insensitive' } },
                { blackPlayer: { contains: playerName, mode: 'insensitive' } }
            ]
        },
        orderBy: { date: 'desc' },
        select: { id: true }
    });

    const totalGames = allGames.length;

    let toScan;
    const maxThisBatch = Math.min(remaining, BATCH_SIZE);
    if (specificGameIds && specificGameIds.length > 0) {
        toScan = specificGameIds
            .filter(id => !scannedGameIds.has(id))
            .slice(0, maxThisBatch)
            .map(id => ({ id }));
    } else {
        const unscannedGames = allGames.filter(g => !scannedGameIds.has(g.id));
        toScan = unscannedGames.slice(0, maxThisBatch);
    }

    if (toScan.length === 0) {
        return { done: true, message: 'Všechny partie jsou analyzované.', totalGames, gamesScanned: totalGames };
    }

    // Analyze each game
    let newBlunders = 0;
    for (const gameSummary of toScan) {
        const gameData = await prisma.chessGame.findUnique({ where: { id: gameSummary.id } });
        if (!gameData || !gameData.moves) continue;

        const results = await analyzeGame(gameData, playerName);

        // Save to DB — even if 0 results, save a "clean" marker so we don't rescan
        if (results.length > 0) {
            await prisma.blunderAnalysis.createMany({
                data: results.map(r => ({
                    playerName: playerName.toLowerCase(),
                    ...r
                }))
            });
            newBlunders += results.length;
        } else {
            // Clean game — save placeholder with probDrop=0 so we know it was scanned
            await prisma.blunderAnalysis.create({
                data: {
                    playerName: playerName.toLowerCase(),
                    gameId: gameSummary.id,
                    type: 'clean',
                    fenBefore: '',
                    movePlayed: '',
                    movePlayedLAN: '',
                    evalBefore: null,
                    evalAfter: null,
                    probDrop: 0,
                    white: gameData.whitePlayer,
                    black: gameData.blackPlayer,
                    result: gameData.result,
                }
            });
        }

        scannedGameIds.add(gameSummary.id);
    }

    // Log scan
    await prisma.blunderScanLog.create({
        data: {
            playerName: playerName.toLowerCase(),
            gamesScanned: toScan.length,
            totalGames,
            lastGameId: toScan[toScan.length - 1]?.id || null
        }
    });

    return {
        done: scannedGameIds.size >= totalGames,
        scanned: toScan.length,
        newBlunders,
        totalGames,
        gamesScanned: scannedGameIds.size,
        remainingToday: remaining - toScan.length
    };
}

// === Get player status ===
export async function getPlayerStatus(playerName) {
    const allGames = await prisma.chessGame.count({
        where: {
            OR: [
                { whitePlayer: { contains: playerName, mode: 'insensitive' } },
                { blackPlayer: { contains: playerName, mode: 'insensitive' } }
            ]
        }
    });

    const analyzedCount = await prisma.blunderAnalysis.groupBy({
        by: ['gameId'],
        where: { playerName: playerName.toLowerCase() }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayScans = await prisma.blunderScanLog.aggregate({
        where: { playerName: playerName.toLowerCase(), scannedAt: { gte: today } },
        _sum: { gamesScanned: true }
    });

    const lastScan = await prisma.blunderScanLog.findFirst({
        where: { playerName: playerName.toLowerCase() },
        orderBy: { scannedAt: 'desc' }
    });

    return {
        totalGames: allGames,
        gamesScanned: analyzedCount.length,
        scannedToday: todayScans._sum.gamesScanned || 0,
        canScanMore: (todayScans._sum.gamesScanned || 0) < DAILY_SCAN_LIMIT && analyzedCount.length < allGames,
        lastScanDate: lastScan?.scannedAt || null
    };
}

// === Get cached results ===
// Nově filtruje i podle position-based pravidla (vypuštěná výhra / obrácená partie),
// i pro záznamy co jsou v DB ještě z doby kdy platil jen probDrop threshold.
export async function getPlayerBlunders(playerName, threshold = 12) {
    const records = await prisma.blunderAnalysis.findMany({
        where: {
            playerName: playerName.toLowerCase(),
            type: { not: 'clean' },
            probDrop: { gte: threshold }
        },
        orderBy: { probDrop: 'desc' }
    });
    return records.filter(b => {
        // Miss detection má jinou logiku (soupeř udělal chybu) — necháme projít
        if (b.type === 'miss') return true;
        if (b.evalBefore === null || b.evalAfter === null) return false;
        // Target color — hráč je buď white nebo black v uložené partii
        const pnLower = playerName.toLowerCase();
        const isWhite = (b.white || '').toLowerCase() === pnLower;
        // Stored eval je v pawn units z white perspective (viz scan logic)
        const evalBeforeTarget = isWhite ? b.evalBefore : -b.evalBefore;
        const evalAfterTarget = isWhite ? b.evalAfter : -b.evalAfter;
        return matchesBlunderRule(evalBeforeTarget, evalAfterTarget);
    });
}
