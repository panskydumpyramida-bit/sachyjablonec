/**
 * Chess Database API Controller
 * Provides endpoints for searching players, games, and building opening trees
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Search players by name (fulltext)
 * GET /api/chess/players?q=searchterm&limit=20
 */
export const searchPlayers = async (req, res) => {
    try {
        const { q, limit = 20 } = req.query;

        if (!q || q.length < 2) {
            return res.json([]);
        }

        // Get unique player names matching the query
        const whiteResults = await prisma.chessGame.findMany({
            where: {
                whitePlayer: {
                    contains: q,
                    mode: 'insensitive'
                }
            },
            select: { whitePlayer: true },
            distinct: ['whitePlayer'],
            take: parseInt(limit)
        });

        const blackResults = await prisma.chessGame.findMany({
            where: {
                blackPlayer: {
                    contains: q,
                    mode: 'insensitive'
                }
            },
            select: { blackPlayer: true },
            distinct: ['blackPlayer'],
            take: parseInt(limit)
        });

        // Combine and deduplicate
        const allPlayers = new Set([
            ...whiteResults.map(r => r.whitePlayer),
            ...blackResults.map(r => r.blackPlayer)
        ]);

        // Get game counts for each player
        const playersWithCounts = await Promise.all(
            Array.from(allPlayers).slice(0, parseInt(limit)).map(async (name) => {
                const [asWhite, asBlack] = await Promise.all([
                    prisma.chessGame.count({ where: { whitePlayer: name } }),
                    prisma.chessGame.count({ where: { blackPlayer: name } })
                ]);
                return {
                    name,
                    gamesAsWhite: asWhite,
                    gamesAsBlack: asBlack,
                    totalGames: asWhite + asBlack
                };
            })
        );

        // Sort by total games descending
        playersWithCounts.sort((a, b) => b.totalGames - a.totalGames);

        res.json(playersWithCounts);
    } catch (error) {
        console.error('Error searching players:', error);
        res.status(500).json({ error: 'Failed to search players' });
    }
};

/**
 * Get games with filtering
 * GET /api/chess/games?player=name&color=white|black|both&eco=A00&limit=50&offset=0
 */
export const getGames = async (req, res) => {
    try {
        const { player, color = 'both', eco, year, sort = 'date_desc', limit = 50, offset = 0 } = req.query;

        const where = {};

        // Player filter
        if (player) {
            if (color === 'white') {
                where.whitePlayer = { contains: player, mode: 'insensitive' };
            } else if (color === 'black') {
                where.blackPlayer = { contains: player, mode: 'insensitive' };
            } else {
                where.OR = [
                    { whitePlayer: { contains: player, mode: 'insensitive' } },
                    { blackPlayer: { contains: player, mode: 'insensitive' } }
                ];
            }
        }

        // ECO filter
        if (eco) {
            where.eco = { startsWith: eco.toUpperCase() };
        }

        // Year filter
        if (year) {
            const yearStart = new Date(parseInt(year), 0, 1);
            const yearEnd = new Date(parseInt(year) + 1, 0, 1);
            where.date = { gte: yearStart, lt: yearEnd };
        }

        // Dynamic sort
        let orderBy = { date: 'desc' };
        if (sort === 'date_asc') orderBy = { date: 'asc' };
        else if (sort === 'eco_asc') orderBy = [{ eco: 'asc' }, { date: 'desc' }];

        const [games, totalCount] = await Promise.all([
            prisma.chessGame.findMany({
                where,
                orderBy,
                take: parseInt(limit),
                skip: parseInt(offset),
                select: {
                    id: true,
                    event: true,
                    date: true,
                    round: true,
                    whitePlayer: true,
                    blackPlayer: true,
                    result: true,
                    eco: true,
                    whiteElo: true,
                    blackElo: true
                }
            }),
            prisma.chessGame.count({ where })
        ]);

        res.json({
            games,
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error getting games:', error);
        res.status(500).json({ error: 'Failed to get games' });
    }
};

/**
 * Get single game with full PGN
 * GET /api/chess/games/:id
 */
export const getGameById = async (req, res) => {
    try {
        const { id } = req.params;

        const game = await prisma.chessGame.findUnique({
            where: { id: parseInt(id) }
        });

        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Reconstruct PGN
        const pgn = reconstructPGN(game);

        res.json({ ...game, pgn });
    } catch (error) {
        console.error('Error getting game:', error);
        res.status(500).json({ error: 'Failed to get game' });
    }
};

/**
 * Reconstruct PGN from game data
 */
function reconstructPGN(game) {
    const headers = [
        `[Event "${game.event || '?'}"]`,
        `[Site "${game.site || '?'}"]`,
        `[Date "${game.date ? game.date.toISOString().split('T')[0].replace(/-/g, '.') : '????.??.??'}"]`,
        `[Round "${game.round || '?'}"]`,
        `[White "${game.whitePlayer}"]`,
        `[Black "${game.blackPlayer}"]`,
        `[Result "${game.result}"]`
    ];

    if (game.eco) headers.push(`[ECO "${game.eco}"]`);
    if (game.whiteElo) headers.push(`[WhiteElo "${game.whiteElo}"]`);
    if (game.blackElo) headers.push(`[BlackElo "${game.blackElo}"]`);

    // Format moves with move numbers
    const moves = game.moves.split(' ');
    let formattedMoves = '';
    for (let i = 0; i < moves.length; i++) {
        if (i % 2 === 0) {
            formattedMoves += `${Math.floor(i / 2) + 1}. `;
        }
        formattedMoves += moves[i] + ' ';
    }
    formattedMoves += game.result;

    return headers.join('\n') + '\n\n' + formattedMoves.trim();
}

/**
 * Get player statistics
 * GET /api/chess/players/:name/stats
 */
export const getPlayerStats = async (req, res) => {
    try {
        const { name } = req.params;

        // Games as white
        const whiteGames = await prisma.chessGame.findMany({
            where: { whitePlayer: { equals: name, mode: 'insensitive' } },
            select: { result: true, eco: true, blackPlayer: true, date: true, whiteElo: true }
        });

        // Games as black
        const blackGames = await prisma.chessGame.findMany({
            where: { blackPlayer: { equals: name, mode: 'insensitive' } },
            select: { result: true, eco: true, whitePlayer: true, date: true, blackElo: true }
        });

        // Calculate stats
        const stats = {
            name,
            totalGames: whiteGames.length + blackGames.length,
            asWhite: {
                games: whiteGames.length,
                wins: whiteGames.filter(g => g.result === '1-0').length,
                draws: whiteGames.filter(g => g.result === '1/2-1/2').length,
                losses: whiteGames.filter(g => g.result === '0-1').length
            },
            asBlack: {
                games: blackGames.length,
                wins: blackGames.filter(g => g.result === '0-1').length,
                draws: blackGames.filter(g => g.result === '1/2-1/2').length,
                losses: blackGames.filter(g => g.result === '1-0').length
            },
            // ECO distribution
            topOpenings: getTopOpenings([...whiteGames, ...blackGames]),
            // Peak Elo
            peakElo: Math.max(
                ...whiteGames.map(g => g.whiteElo || 0),
                ...blackGames.map(g => g.blackElo || 0)
            ) || null,
            // Most common opponents
            topOpponents: getTopOpponents(whiteGames, blackGames)
        };

        res.json(stats);
    } catch (error) {
        console.error('Error getting player stats:', error);
        res.status(500).json({ error: 'Failed to get player stats' });
    }
};

function getTopOpenings(games) {
    const ecoCounts = {};
    games.forEach(g => {
        if (g.eco) {
            ecoCounts[g.eco] = (ecoCounts[g.eco] || 0) + 1;
        }
    });
    return Object.entries(ecoCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([eco, count]) => ({ eco, count }));
}

function getTopOpponents(whiteGames, blackGames) {
    const opponents = {};
    whiteGames.forEach(g => {
        opponents[g.blackPlayer] = (opponents[g.blackPlayer] || 0) + 1;
    });
    blackGames.forEach(g => {
        opponents[g.whitePlayer] = (opponents[g.whitePlayer] || 0) + 1;
    });
    return Object.entries(opponents)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));
}

/**
 * Get opening tree for a player
 * GET /api/chess/tree?player=name&color=white|black&fen=starting_position
 */
export const getOpeningTree = async (req, res) => {
    try {
        const { player, color = 'white', depth = 1 } = req.query;

        if (!player) {
            return res.status(400).json({ error: 'Player name required' });
        }

        // Get all games for this player with the specified color
        const where = color === 'white'
            ? { whitePlayer: { equals: player, mode: 'insensitive' } }
            : { blackPlayer: { equals: player, mode: 'insensitive' } };

        const games = await prisma.chessGame.findMany({
            where,
            select: { id: true, moves: true, result: true, date: true, whitePlayer: true, blackPlayer: true },
            orderBy: { date: 'desc' }
        });

        // Build tree from moves
        const tree = buildOpeningTree(games, color, parseInt(depth));

        res.json(tree);
    } catch (error) {
        console.error('Error getting opening tree:', error);
        res.status(500).json({ error: 'Failed to get opening tree' });
    }
};

/**
 * Build opening tree from games
 */
function buildOpeningTree(games, color, maxDepth = 10) {
    const root = { move: 'start', children: {}, games: 0, wins: 0, draws: 0, losses: 0, recentGames: [] };
    const isWhite = color === 'white';

    games.forEach(game => {
        const moves = game.moves.split(' ').filter(m => m && !m.includes('.'));
        let node = root;

        // Traverse/build tree
        for (let i = 0; i < Math.min(moves.length, maxDepth * 2); i++) {
            const move = moves[i];
            const isMyMove = isWhite ? (i % 2 === 0) : (i % 2 === 1);

            if (!node.children[move]) {
                node.children[move] = {
                    move,
                    children: {},
                    games: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    isMyMove,
                    recentGames: []
                };
            }

            node = node.children[move];
            node.games++;

            // Track recent games (keep only 2 newest)
            const gameRef = {
                id: game.id,
                date: game.date,
                white: game.whitePlayer,
                black: game.blackPlayer,
                result: game.result
            };
            if (node.recentGames.length < 2) {
                node.recentGames.push(gameRef);
            }

            // Count results
            if (game.result === '1-0') {
                isWhite ? node.wins++ : node.losses++;
            } else if (game.result === '0-1') {
                isWhite ? node.losses++ : node.wins++;
            } else if (game.result === '1/2-1/2') {
                node.draws++;
            }
        }
    });

    return {
        totalGames: games.length,
        color,
        tree: formatTree(root)
    };
}

function formatTree(node) {
    const children = Object.values(node.children)
        .map(child => ({
            ...child,
            children: formatTree(child).children,
            winRate: child.games > 0 ? ((child.wins + child.draws * 0.5) / child.games * 100).toFixed(1) : 0
        }))
        .sort((a, b) => b.games - a.games);

    return { ...node, children };
}

/**
 * Import games from PGN text (with duplicate detection)
 * POST /api/chess/import
 * Body: { pgn: "..." }
 */
export const importGames = async (req, res) => {
    try {
        const { pgn } = req.body;

        if (!pgn || typeof pgn !== 'string') {
            return res.status(400).json({ error: 'PGN text required' });
        }

        // Use chess.js for more robust parsing
        const { Chess } = await import('chess.js');

        // Split PGN into individual games
        // This regex looks for [Event "..."] which typically starts a PGN game
        // We add a newline to ensure we catch the first one if it doesn't have a newline before it
        const rawGames = ('\n' + pgn).split(/\n(?=\[Event\s+)/g).filter(g => g.trim().length > 0);

        if (rawGames.length === 0) {
            // Try fallback - maybe it doesn't have Event tags?
            // If it's just one game without headers or just moves, try parsing it as one
            rawGames.push(pgn);
        }

        let imported = 0;
        let duplicates = 0;
        let failed = 0;

        for (const rawGame of rawGames) {
            const chess = new Chess();

            try {
                // Load PGN - heuristics to clean up potentially messy input
                // chess.js 1.0+ uses camelCase methods and throws on error
                if (!rawGame.trim()) continue;

                // Attempt to load - chess.js 1.0+ throws on invalid PGN
                chess.loadPgn(rawGame);

            } catch (e) {
                // chess.js 1.0+ throws exceptions for invalid PGN
                console.log('[ChessDB Import] Parse failed for game:', e.message);
                failed++;
                continue;
            }

            const header = chess.header();
            const whitePlayer = header['White'] || '?';
            const blackPlayer = header['Black'] || '?';
            const result = header['Result'] || '*';
            const event = header['Event'] || '?';
            const dateStr = header['Date'];

            // Skip if crucial info matches emptiness (game skeleton)
            if (whitePlayer === '?' && blackPlayer === '?' && result === '*') {
                // Likely empty or failed parse resulting in default object
                failed++;
                continue;
            }

            // Parse date
            let date = null;
            if (dateStr && !dateStr.includes('?')) {
                try {
                    const [y, m, d] = dateStr.split('.');
                    if (y && m && d) {
                        date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                    }
                } catch (e) { }
            }

            // Check for duplicate
            const existingWhere = {
                whitePlayer: { equals: whitePlayer, mode: 'insensitive' },
                blackPlayer: { equals: blackPlayer, mode: 'insensitive' },
                result: result
            };

            // Add date to duplicate check only if we have a valid date
            // otherwise we might have many games without dates
            if (date) existingWhere.date = date;

            // Optional: check event if present
            if (event && event !== '?') existingWhere.event = event;

            // Optional: check exact moves count or string if we want strict deduplication
            // For now, metadata is usually enough

            const existing = await prisma.chessGame.findFirst({ where: existingWhere });

            if (existing) {
                duplicates++;
                continue;
            }

            // Extract moves: chess.pgn() reconstructs it, but we can also use history
            // history() gives array of moves. pgn() gives full string with headers.
            // We want just the movetext usually, or headers cleaned.
            // Let's use chess.history() to rebuild a clean move string
            const history = chess.history();
            const moves = history.join(' ');

            // Or better, use cleaned PGN from chess.js if we want to store full PGN including comments?
            // chess.js load_pgn parses comments too.
            // But our DB schema stores `moves` as string.
            // Let's stick to simple move string for now to match previous logic

            // Insert new game
            await prisma.chessGame.create({
                data: {
                    event: event !== '?' ? event : null,
                    site: header['Site'] && header['Site'] !== '?' ? header['Site'] : null,
                    date,
                    round: header['Round'] && header['Round'] !== '?' ? header['Round'] : null,
                    whitePlayer,
                    blackPlayer,
                    result,
                    eco: header['ECO'],
                    whiteElo: parseInt(header['WhiteElo']) || null,
                    blackElo: parseInt(header['BlackElo']) || null,
                    plyCount: history.length,
                    moves
                }
            });
            imported++;
        }

        res.json({
            success: true,
            total: rawGames.length,
            imported,
            duplicates,
            failed
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Import failed', details: error.message });
    }
};

/**
 * Check for duplicate games (same players, same date)
 * GET /api/chess/duplicates
 */
export const checkDuplicates = async (req, res) => {
    try {
        // Get all games with date
        const games = await prisma.chessGame.findMany({
            where: {
                date: { not: null }
            },
            select: {
                id: true,
                whitePlayer: true,
                blackPlayer: true,
                date: true,
                result: true,
                event: true
            }
        });

        const groups = {};

        // Group games
        for (const game of games) {
            const dateStr = game.date.toISOString().split('T')[0];
            const key = `${game.whitePlayer.trim().toLowerCase()}|${game.blackPlayer.trim().toLowerCase()}|${dateStr}`;

            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(game);
        }

        // Filter duplicates
        const duplicates = [];
        for (const [key, group] of Object.entries(groups)) {
            if (group.length > 1) {
                const [white, black, date] = key.split('|');
                duplicates.push({
                    signature: { white, black, date },
                    count: group.length,
                    ids: group.map(g => g.id),
                    games: group
                });
            }
        }

        res.json({
            count: duplicates.length,
            duplicates
        });

    } catch (error) {
        console.error('Error checking duplicates:', error);
        res.status(500).json({ error: 'Check failed' });
    }
};

/**
 * Clean duplicate games (keep one, delete others)
 * DELETE /api/chess/duplicates
 */
export const cleanDuplicates = async (req, res) => {
    try {
        const games = await prisma.chessGame.findMany({
            where: { date: { not: null } },
            select: { id: true, whitePlayer: true, blackPlayer: true, date: true }
        });

        const groups = {};
        for (const game of games) {
            const dateStr = game.date.toISOString().split('T')[0];
            const key = `${game.whitePlayer.trim().toLowerCase()}|${game.blackPlayer.trim().toLowerCase()}|${dateStr}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(game.id);
        }

        let deletedCount = 0;
        const idsToDelete = [];

        for (const group of Object.values(groups)) {
            if (group.length > 1) {
                // Keep the first one (lowest ID usually), delete rest
                const [keep, ...remove] = group.sort((a, b) => a - b);
                idsToDelete.push(...remove);
            }
        }

        if (idsToDelete.length > 0) {
            const result = await prisma.chessGame.deleteMany({
                where: {
                    id: { in: idsToDelete }
                }
            });
            deletedCount = result.count;
        }

        res.json({
            success: true,
            deleted: deletedCount,
            message: `Deleted ${deletedCount} duplicate games.`
        });

    } catch (error) {
        console.error('Error cleaning duplicates:', error);
        res.status(500).json({ error: 'Cleanup failed' });
    }
};
