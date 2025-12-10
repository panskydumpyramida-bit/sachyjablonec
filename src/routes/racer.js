import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Puzzle cache to avoid hitting Lichess API rate limits
let puzzleCache = {
    puzzles: [],
    lastFetch: 0,
    ttl: 1 * 60 * 1000 // 1 minute cache for testing
};

// GET /api/racer/puzzles - Proxy to fetch puzzles from Lichess with caching
router.get('/puzzles', async (req, res) => {
    try {
        const now = Date.now();

        // Return cached puzzles if still valid
        if (puzzleCache.puzzles.length > 0 && (now - puzzleCache.lastFetch) < puzzleCache.ttl) {
            console.log('Returning cached puzzles');
            return res.json({ puzzles: puzzleCache.puzzles, cached: true });
        }

        console.log('Fetching fresh puzzles from Lichess...');

        // Lichess API token from environment variable
        const LICHESS_TOKEN = process.env.LICHESS_API_TOKEN;
        const headers = LICHESS_TOKEN ? {
            'Authorization': `Bearer ${LICHESS_TOKEN}`,
            'Accept': 'application/json'
        } : { 'Accept': 'application/json' };

        let allPuzzles = [];

        // Fetch daily puzzle (always works)
        try {
            const dailyRes = await fetch('https://lichess.org/api/puzzle/daily', { headers });
            if (dailyRes.ok) {
                const puzzle = await dailyRes.json();
                allPuzzles.push(puzzle);
                console.log('Fetched daily puzzle');
            }
        } catch (e) {
            console.error('Failed to fetch daily puzzle:', e.message);
        }

        // Fetch multiple puzzles by ID (verified working puzzle IDs from Lichess)
        // These are real puzzle IDs from popular Lichess puzzles
        const puzzleIds = [
            '00008', '00009', '0000D', '0000J', '0000K', '0000P',
            '0000U', '0000a', '0000e', '0000i', '0000k', '0000l',
            '0000n', '0000o', '0000p', '0000q', '0000r', '0000s',
            '0000t', '0000u', '0000v', '0000w', '0000x', '0000y'
        ];

        for (const puzzleId of puzzleIds.slice(0, 20)) {
            try {
                await new Promise(r => setTimeout(r, 100)); // Small delay between requests
                const res = await fetch(`https://lichess.org/api/puzzle/${puzzleId}`, { headers });
                if (res.ok) {
                    const puzzle = await res.json();
                    allPuzzles.push(puzzle);
                    console.log(`Fetched puzzle ${puzzleId}`);
                } else {
                    console.warn(`Puzzle ${puzzleId} returned ${res.status}`);
                }
            } catch (e) {
                console.error(`Failed puzzle ${puzzleId}:`, e.message);
            }
        }

        console.log(`Fetched ${allPuzzles.length} puzzles total`);

        if (allPuzzles.length > 0) {
            puzzleCache.puzzles = allPuzzles;
            puzzleCache.lastFetch = now;
            console.log(`Cached ${allPuzzles.length} puzzles`);
        } else {
            console.warn('No puzzles fetched, returning cached or empty');
        }

        res.json({
            puzzles: puzzleCache.puzzles.length > 0 ? puzzleCache.puzzles : [],
            cached: false,
            count: puzzleCache.puzzles.length
        });

    } catch (error) {
        console.error('Error in puzzle proxy:', error);
        res.status(500).json({ error: 'Failed to fetch puzzles', puzzles: [] });
    }
});

// POST /api/racer/save
router.post('/save', async (req, res) => {
    try {
        const { score, playerName, userId } = req.body;

        if (score === undefined || score === null) {
            return res.status(400).json({ error: 'Score is required' });
        }

        const result = await prisma.puzzleRaceResult.create({
            data: {
                score: parseInt(score),
                playerName: playerName || 'Anonymous',
                userId: userId ? parseInt(userId) : null,
            },
        });

        res.json(result);
    } catch (error) {
        console.error('Error saving puzzle race result:', error);
        res.status(500).json({ error: 'Failed to save result' });
    }
});

// GET /api/racer/leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const leaderboard = await prisma.puzzleRaceResult.findMany({
            take: 10,
            orderBy: {
                score: 'desc'
            },
            include: {
                user: {
                    select: {
                        username: true
                    }
                }
            }
        });
        res.json(leaderboard);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

export default router;
