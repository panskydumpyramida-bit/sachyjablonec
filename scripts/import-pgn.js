/**
 * PGN Import Script for Chess Database
 * 
 * Usage: node scripts/import-pgn.js [--file=path/to/file.pgn] [--limit=N] [--skip-moves]
 * 
 * Imports PGN games into the chess_games table.
 * Optionally extracts moves into chess_moves table for opening tree.
 */

import { PrismaClient } from '@prisma/client';
import { parse } from 'pgn-parser';
import fs from 'fs';
import readline from 'readline';

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.replace('--', '').split('=');
    acc[key] = value || true;
    return acc;
}, {});

const PGN_FILE = args.file || 'data/SSCR_2003_2025.pgn';
const BATCH_SIZE = 500;
const LIMIT = args.limit ? parseInt(args.limit) : null;
const SKIP_MOVES = args['skip-moves'] || false;

/**
 * Parse date from PGN format (YYYY.MM.DD or ????.??.??)
 */
function parseDate(dateStr) {
    if (!dateStr || dateStr.includes('?')) return null;
    try {
        const [year, month, day] = dateStr.split('.');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } catch {
        return null;
    }
}

/**
 * Extract moves as SAN string from parsed game
 */
function extractMoves(game) {
    if (!game.moves || game.moves.length === 0) return '';

    return game.moves.map(move => move.move).filter(Boolean).join(' ');
}

/**
 * Split large PGN file into individual game strings
 */
async function* readGamesFromFile(filePath) {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let currentGame = '';
    let inMoves = false;

    for await (const line of rl) {
        if (line.startsWith('[Event ') && currentGame.trim()) {
            // New game starting, yield the previous one
            yield currentGame.trim();
            currentGame = '';
            inMoves = false;
        }

        currentGame += line + '\n';

        // Track if we're past the headers into moves
        if (line.startsWith('1.') || (inMoves && line.trim())) {
            inMoves = true;
        }
    }

    // Yield the last game
    if (currentGame.trim()) {
        yield currentGame.trim();
    }
}

/**
 * Parse a single PGN game string
 */
function parseGame(pgnString) {
    try {
        const parsed = parse(pgnString);
        if (!parsed || parsed.length === 0) return null;
        return parsed[0];
    } catch (e) {
        // Silent fail for malformed games
        return null;
    }
}

/**
 * Extract header value from parsed game
 */
function getHeader(game, name) {
    if (!game.headers) return null;
    const header = game.headers.find(h => h.name === name);
    return header ? header.value : null;
}

/**
 * Main import function
 */
async function importPGN() {
    console.log(`📂 Reading PGN file: ${PGN_FILE}`);
    console.log(`📊 Batch size: ${BATCH_SIZE}`);
    if (LIMIT) console.log(`🔢 Limit: ${LIMIT} games`);
    if (SKIP_MOVES) console.log(`⏭️ Skipping move extraction`);

    const startTime = Date.now();
    let totalGames = 0;
    let importedGames = 0;
    let failedGames = 0;
    let batch = [];

    // Clear existing data (optional - remove if you want incremental import)
    console.log('\n🗑️ Clearing existing chess data...');
    await prisma.chessMove.deleteMany();
    await prisma.chessGame.deleteMany();
    console.log('✅ Cleared.\n');

    console.log('🚀 Starting import...\n');

    for await (const pgnString of readGamesFromFile(PGN_FILE)) {
        totalGames++;

        if (LIMIT && totalGames > LIMIT) break;

        const game = parseGame(pgnString);
        if (!game) {
            failedGames++;
            continue;
        }

        const whitePlayer = getHeader(game, 'White');
        const blackPlayer = getHeader(game, 'Black');
        const result = getHeader(game, 'Result');

        // Skip games without essential data
        if (!whitePlayer || !blackPlayer) {
            failedGames++;
            continue;
        }

        const gameData = {
            event: getHeader(game, 'Event'),
            site: getHeader(game, 'Site'),
            date: parseDate(getHeader(game, 'Date')),
            round: getHeader(game, 'Round'),
            whitePlayer,
            blackPlayer,
            result: result || '*',
            eco: getHeader(game, 'ECO'),
            whiteElo: parseInt(getHeader(game, 'WhiteElo')) || null,
            blackElo: parseInt(getHeader(game, 'BlackElo')) || null,
            plyCount: parseInt(getHeader(game, 'PlyCount')) || null,
            moves: extractMoves(game)
        };

        batch.push(gameData);
        importedGames++;

        // Batch insert
        if (batch.length >= BATCH_SIZE) {
            await prisma.chessGame.createMany({ data: batch });
            process.stdout.write(`\r📥 Imported: ${importedGames.toLocaleString()} games...`);
            batch = [];
        }
    }

    // Insert remaining batch
    if (batch.length > 0) {
        await prisma.chessGame.createMany({ data: batch });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n\n✅ Import complete!`);
    console.log(`   📊 Total games processed: ${totalGames.toLocaleString()}`);
    console.log(`   ✅ Successfully imported: ${importedGames.toLocaleString()}`);
    console.log(`   ❌ Failed/skipped: ${failedGames.toLocaleString()}`);
    console.log(`   ⏱️ Time: ${elapsed}s`);
    console.log(`   📈 Speed: ${(importedGames / parseFloat(elapsed)).toFixed(0)} games/sec`);

    // Extract moves for opening tree (if not skipped)
    if (!SKIP_MOVES && importedGames > 0) {
        console.log('\n🌲 Extracting moves for opening tree...');
        await extractMovesForTree();
    }
}

/**
 * Extract individual moves for opening tree
 */
async function extractMovesForTree() {
    const MAX_PLY = 20; // First 10 full moves
    const MOVE_BATCH_SIZE = 5000;

    let moveBatch = [];
    let totalMoves = 0;
    let gameCount = 0;

    // Process games in chunks
    const games = await prisma.chessGame.findMany({
        select: { id: true, moves: true }
    });

    for (const game of games) {
        gameCount++;

        if (!game.moves) continue;

        const moves = game.moves.split(' ').slice(0, MAX_PLY);

        for (let i = 0; i < moves.length; i++) {
            const san = moves[i];
            if (!san || san.includes('.')) continue; // Skip move numbers

            moveBatch.push({
                gameId: game.id,
                plyNum: i + 1,
                san
            });
            totalMoves++;

            if (moveBatch.length >= MOVE_BATCH_SIZE) {
                await prisma.chessMove.createMany({ data: moveBatch });
                process.stdout.write(`\r🌲 Extracted: ${totalMoves.toLocaleString()} moves from ${gameCount.toLocaleString()} games...`);
                moveBatch = [];
            }
        }
    }

    // Insert remaining
    if (moveBatch.length > 0) {
        await prisma.chessMove.createMany({ data: moveBatch });
    }

    console.log(`\n✅ Move extraction complete: ${totalMoves.toLocaleString()} moves`);
}

// Run
importPGN()
    .catch(e => {
        console.error('❌ Import failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
