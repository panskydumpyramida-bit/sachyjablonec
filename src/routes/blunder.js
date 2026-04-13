/**
 * Blunder Analysis API Routes
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getPlayerBlunders, getPlayerStatus, scanPlayerGames } from '../services/blunderService.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get cached blunders for player
router.get('/:playerName', async (req, res) => {
    try {
        const { playerName } = req.params;
        const threshold = parseFloat(req.query.threshold) || 12;
        const blunders = await getPlayerBlunders(playerName, threshold);
        res.json(blunders);
    } catch (error) {
        console.error('[Blunder] Get error:', error);
        res.status(500).json({ error: 'Failed to fetch blunders' });
    }
});

// Get featured blunders for player
router.get('/:playerName/featured', async (req, res) => {
    try {
        const { playerName } = req.params;
        const featured = await prisma.blunderAnalysis.findMany({
            where: { playerName: playerName.toLowerCase(), isFeatured: true, type: { not: 'clean' } },
            orderBy: { probDrop: 'desc' }
        });
        res.json(featured);
    } catch (error) {
        console.error('[Blunder] Featured error:', error);
        res.status(500).json({ error: 'Failed to fetch featured' });
    }
});

// Get scan status + games list for player
router.get('/:playerName/status', async (req, res) => {
    try {
        const { playerName } = req.params;
        const status = await getPlayerStatus(playerName);
        res.json(status);
    } catch (error) {
        console.error('[Blunder] Status error:', error);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// Get games list with scan status
router.get('/:playerName/games', async (req, res) => {
    try {
        const { playerName } = req.params;

        // All games for player
        const allGames = await prisma.chessGame.findMany({
            where: {
                OR: [
                    { whitePlayer: { contains: playerName, mode: 'insensitive' } },
                    { blackPlayer: { contains: playerName, mode: 'insensitive' } }
                ]
            },
            select: { id: true, whitePlayer: true, blackPlayer: true, result: true, date: true, event: true },
            orderBy: { date: 'desc' }
        });

        // Which games have been analyzed
        const analyzed = await prisma.blunderAnalysis.groupBy({
            by: ['gameId'],
            where: { playerName: playerName.toLowerCase() },
            _count: { id: true },
            _max: { type: true }
        });

        const analyzedMap = {};
        for (const a of analyzed) {
            analyzedMap[a.gameId] = {
                count: a._count.id,
                hasBlunders: a._max.type !== 'clean'
            };
        }

        // Blunder counts per game (excluding clean markers)
        const blunderCounts = await prisma.blunderAnalysis.groupBy({
            by: ['gameId'],
            where: { playerName: playerName.toLowerCase(), type: { not: 'clean' } },
            _count: { id: true }
        });
        const blunderMap = {};
        for (const b of blunderCounts) {
            blunderMap[b.gameId] = b._count.id;
        }

        const games = allGames.map(g => ({
            id: g.id,
            white: g.whitePlayer,
            black: g.blackPlayer,
            result: g.result,
            date: g.date,
            event: g.event,
            scanned: !!analyzedMap[g.id],
            blunderCount: blunderMap[g.id] || 0
        }));

        res.json(games);
    } catch (error) {
        console.error('[Blunder] Games error:', error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});

// Trigger scan — either next batch or specific game IDs
router.post('/:playerName/scan', async (req, res) => {
    try {
        const { playerName } = req.params;
        const { gameIds } = req.body || {};

        const result = await scanPlayerGames(playerName, gameIds);

        if (result.error === 'daily_limit') {
            return res.status(429).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('[Blunder] Scan error:', error);
        res.status(500).json({ error: 'Scan failed' });
    }
});

// Toggle featured status
router.put('/:id/featured', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const current = await prisma.blunderAnalysis.findUnique({ where: { id } });
        if (!current) return res.status(404).json({ error: 'Not found' });

        const updated = await prisma.blunderAnalysis.update({
            where: { id },
            data: { isFeatured: !current.isFeatured }
        });
        res.json({ id: updated.id, isFeatured: updated.isFeatured });
    } catch (error) {
        console.error('[Blunder] Toggle featured error:', error);
        res.status(500).json({ error: 'Failed to toggle featured' });
    }
});

export default router;
