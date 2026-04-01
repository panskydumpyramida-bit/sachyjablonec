import { PrismaClient } from '@prisma/client';
import { Chess } from 'chess.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const PLAYER_NAME_FILTER = 'Duda';
const BLUNDER_THRESHOLD_W_PCT = 12; // 12% drop in win probability = blunder pro účely testu
const MISS_THRESHOLD_W_PCT = 12;    // 12% drop after opponent gave us +12%
const MAX_GAMES = 5;
const OUTPUT_FILE = path.join(__dirname, '../public/data/duda-blunders.json');

// Helper to fetch eval from Lichess Cloud API with fallback to chess-api.com
async function getLichessCloudEval(fen) {
    try {
        const response = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.pvs && data.pvs[0]) {
                return {
                    cp: data.pvs[0].cp,
                    mate: data.pvs[0].mate,
                    bestMove: data.pvs[0].moves.split(' ')[0],
                    source: 'lichess'
                };
            }
        }
    } catch (e) {
        // silent
    }

    // Fallback if not in Lichess Cloud
    try {
        const chessApiRes = await fetch('https://chess-api.com/v1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: fen, depth: 12 }) // Lower depth for speed
        });
        
        if (chessApiRes.ok) {
            const data = await chessApiRes.json();
            if (data && data.eval !== undefined) {
                // Return CP format. chess-api returns eval in typical float (+1.5)
                // Wait, chess-api.com sometimes returns cp as an integer if it's stored, or eval float.
                // Or maybe data.eval is already a float like 1.5. Lichess uses int 150. we multiply by 100.
                let cpVal = Math.round(data.eval * 100);
                return {
                    cp: cpVal,
                    mate: data.mate, // It provides mate as integer
                    bestMove: data.move, // the uci move e.g. "e2e4"
                    source: 'chess-api'
                };
            }
        }
    } catch (e) {
        console.error("Chess-API fallback failed:", e.message);
    }
    
    return null;
}

// Lichess formula to convert CP to Win Probability (0 to 100)
function getWinProbability(evalObj) {
    if (!evalObj) return 50;
    if (evalObj.mate !== undefined && evalObj.mate !== null) {
        return evalObj.mate > 0 ? 100 : 0;
    }
    const cp = evalObj.cp;
    if (cp === undefined || cp === null) return 50;
    // Lichess winning chances formula
    const expValue = Math.exp(-0.00368208 * cp);
    return 50 + 50 * (2 / (1 + expValue) - 1);
}

async function main() {
    console.log(`🔍 Hledám partie hráče: ${PLAYER_NAME_FILTER}`);

    const recordedGames = await prisma.gameRecorded.findMany({
        where: {
            OR: [
                { white: { contains: PLAYER_NAME_FILTER, mode: 'insensitive' } },
                { black: { contains: PLAYER_NAME_FILTER, mode: 'insensitive' } }
            ]
        },
        take: MAX_GAMES
    });

    console.log(`Nalezeno ${recordedGames.length} partií k analýze.`);
    const allPuzzles = [];

    // Process each game
    for (const game of recordedGames) {
        console.log(`\n♟ Analýza: ${game.white} vs ${game.black}`);
        const chess = new Chess();
        try {
            chess.loadPgn(game.pgn);
        } catch (e) {
            continue;
        }

        const history = chess.history({ verbose: true });
        const tempChess = new Chess();
        let evals = []; // Store evals for each ply

        // First pass: gather all evaluations (this could be slow due to rate limits, but ok for prototype)
        process.stdout.write('Stahuji analýzu (Lichess Clous + Chess-API.com fallback)... ');
        for (let i = 0; i <= history.length; i++) {
            const fen = tempChess.fen();
            
            // Fix: API rejects FEN with EP square if no capture is possible (strict validation)
            const fenParts = fen.split(' ');
            if (fenParts.length >= 4 && fenParts[3] !== '-') {
                fenParts[3] = '-';
            }
            const safeFen = fenParts.join(' ');
            
            let ev = await getLichessCloudEval(safeFen);
            evals.push(ev);
            if (i < history.length) {
                tempChess.move(history[i]);
            }
            if (ev && ev.source === 'chess-api') {
                process.stdout.write('C'); // C pro chess-api call
                await new Promise(r => setTimeout(r, 600)); // Delší rate limit pro chess-api.com
            } else {
                process.stdout.write('.'); // . pro lichess cache
                await new Promise(r => setTimeout(r, 50)); 
            }
        }
        console.log(' Hotovo.\n');

        // Second pass: Find blunders and misses
        for (let i = 0; i < history.length; i++) {
            const move = history[i];
            const isWhiteToMove = (i % 2 === 0);
            const activePlayer = isWhiteToMove ? game.white : game.black;
            const isTargetPlayerMove = activePlayer.toLowerCase().includes(PLAYER_NAME_FILTER.toLowerCase());
            
            const currentEval = evals[i];
            const nextEval = evals[i+1];
            
            if (!currentEval || !nextEval) continue;

            // Probabilities from WHITE's perspective
            const probWBefore = getWinProbability(currentEval);
            const probWAfter = getWinProbability(nextEval);
            
            // Probability from the ACTIVE PLAYER's perspective
            const probBefore = isWhiteToMove ? probWBefore : (100 - probWBefore);
            const probAfter = isWhiteToMove ? probWAfter : (100 - probWAfter);
            
            const probDrop = probBefore - probAfter;

            // Type 1: BLUNDER
            // The target player just made a move that dropped their own win probability significantly
            if (isTargetPlayerMove && probDrop >= BLUNDER_THRESHOLD_W_PCT) {
                
                // Zajisti jediný legální tah?
                // Pokud byla na tahu absolutní brzda a byl to nucený tah (jen 1 rozumný nebo vůbec 1 tah exisuje),
                // Lichess/blunder checker by to mohl chybně označit... my neukážem tah, kde the bestMoveLAN is identical to blunderMoveLAN
                
                if (currentEval.bestMove && currentEval.bestMove !== move.lan) {
                     allPuzzles.push({
                        type: "blunder",
                        gameId: game.id,
                        white: game.white,
                        black: game.black,
                        result: game.result,
                        fenBefore: history[i].before || evals[i].fen, // will be reconstructed
                        blunderMoveSAN: move.san,
                        blunderMoveLAN: move.lan,
                        bestMoveLAN: currentEval.bestMove,
                        evalBefore: currentEval.cp !== undefined ? currentEval.cp / 100.0 : null,
                        evalAfter: nextEval.cp !== undefined ? nextEval.cp / 100.0 : null,
                        winProbDrop: probDrop.toFixed(1),
                        playerColor: isWhiteToMove ? 'white' : 'black',
                        ply: i + 1,
                        hint: "Hrubá chyba! Zkus najít tah, který neprohrává partii."
                    });
                    console.log(`🚨 Blunder (${move.san}) na tahu ${Math.ceil((i+1)/2)}. Propad: -${probDrop.toFixed(1)}%`);
                }
                continue;
            }

            // Type 2: MISS
            // Opponent made a move on (i-1) that gave US an advantage, but on move (i) we failed to find the best response and lost the advantage.
            if (isTargetPlayerMove && i >= 1) {
                const prevEval = evals[i-1];
                if (!prevEval) continue;
                
                // Probabilities from ACTIVE PLAYER's (target player's) perspective
                const probW_Prev = getWinProbability(prevEval);
                const probTarget_Prev = isWhiteToMove ? probW_Prev : (100 - probW_Prev);
                
                // If opponent blundered, probTarget went up
                if (probBefore - probTarget_Prev >= MISS_THRESHOLD_W_PCT) {
                    // Opponent blundered. Did we capitalize?
                    if (probDrop >= MISS_THRESHOLD_W_PCT) {
                        if (currentEval.bestMove && currentEval.bestMove !== move.lan) {
                            allPuzzles.push({
                                type: "miss",
                                gameId: game.id,
                                white: game.white,
                                black: game.black,
                                result: game.result,
                                fenBefore: "RECONSTRUCT", 
                                blunderMoveSAN: move.san,
                                blunderMoveLAN: move.lan,
                                bestMoveLAN: currentEval.bestMove,
                                evalBefore: currentEval.cp !== undefined ? currentEval.cp / 100.0 : null,
                                evalAfter: nextEval.cp !== undefined ? nextEval.cp / 100.0 : null,
                                winProbDrop: probDrop.toFixed(1),
                                playerColor: isWhiteToMove ? 'white' : 'black',
                                ply: i + 1,
                                hint: "Propásnutá příležitost! Soupeř udělal chybu, ty jsi ji ale nepotrestal."
                            });
                            console.log(`❌ Miss (${move.san}) na tahu ${Math.ceil((i+1)/2)}. Soupeř udělal chybu, ale my to přehlédli.`);
                        }
                    }
                }
            }
        }
        
        // Reconstruct FENs for the puzzles
        const tc2 = new Chess();
        for (let i = 0; i < history.length; i++) {
            const fen = tc2.fen();
            for (let p of allPuzzles) {
                if (p.gameId === game.id && p.ply === i + 1) {
                    p.fenBefore = fen;
                }
            }
            tc2.move(history[i]);
        }
    }

    console.log(`\n✅ Hotovo! Nalezeno ${allPuzzles.length} situací celkem.`);
    
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allPuzzles, null, 2));
    console.log(`Uloženo do ${OUTPUT_FILE}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
