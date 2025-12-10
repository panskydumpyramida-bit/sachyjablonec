import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Fallback puzzles in case API fails
const FALLBACK_PUZZLES = [
    { game: { pgn: "e4 e5 Bc4 Nc6 Qh5 Nf6" }, puzzle: { id: "fb001", rating: 600, solution: ["h5f7"], themes: ["mateIn1"], initialPly: 6 } },
    { game: { pgn: "f3 e5 g4" }, puzzle: { id: "fb002", rating: 600, solution: ["d8h4"], themes: ["mateIn1"], initialPly: 3 } },
];

// Puzzle cache
let puzzleCache = {
    puzzles: [],
    lastFetch: 0,
    ttl: 5 * 60 * 1000 // 5 minutes cache
};

// GET /api/racer/puzzles - Fetch from Lichess API with caching
router.get('/puzzles', async (req, res) => {
    try {
        const now = Date.now();

        // Return cached puzzles if still valid and have enough
        if (puzzleCache.puzzles.length >= 20 && (now - puzzleCache.lastFetch) < puzzleCache.ttl) {
            console.log(`Returning ${puzzleCache.puzzles.length} cached puzzles`);
            return res.json({ puzzles: puzzleCache.puzzles, cached: true, count: puzzleCache.puzzles.length });
        }

        console.log('Fetching fresh puzzles from Lichess API...');

        const LICHESS_TOKEN = process.env.LICHESS_API_TOKEN;
        const headers = LICHESS_TOKEN ? {
            'Authorization': `Bearer ${LICHESS_TOKEN}`,
            'Accept': 'application/json'
        } : { 'Accept': 'application/json' };

        let allPuzzles = [];

        // Fetch easy puzzles
        try {
            const easyRes = await fetch('https://lichess.org/api/puzzle/batch/mix?nb=15&difficulty=easiest', { headers });
            if (easyRes.ok) {
                const data = await easyRes.json();
                allPuzzles = allPuzzles.concat(data.puzzles || []);
                console.log(`Fetched ${data.puzzles?.length || 0} easy puzzles`);
            } else {
                console.warn(`Easy puzzles API returned ${easyRes.status}`);
            }
        } catch (e) {
            console.error('Failed to fetch easy puzzles:', e.message);
        }

        // Small delay to be nice to API
        await new Promise(r => setTimeout(r, 500));

        // Fetch normal puzzles
        try {
            const normalRes = await fetch('https://lichess.org/api/puzzle/batch/mix?nb=15&difficulty=normal', { headers });
            if (normalRes.ok) {
                const data = await normalRes.json();
                allPuzzles = allPuzzles.concat(data.puzzles || []);
                console.log(`Fetched ${data.puzzles?.length || 0} normal puzzles`);
            } else {
                console.warn(`Normal puzzles API returned ${normalRes.status}`);
            }
        } catch (e) {
            console.error('Failed to fetch normal puzzles:', e.message);
        }

        // Sort by rating (easiest first)
        allPuzzles.sort((a, b) => (a.puzzle?.rating || 1000) - (b.puzzle?.rating || 1000));

        if (allPuzzles.length > 0) {
            puzzleCache.puzzles = allPuzzles;
            puzzleCache.lastFetch = now;
            console.log(`Cached ${allPuzzles.length} puzzles (ratings: ${allPuzzles[0]?.puzzle?.rating} to ${allPuzzles[allPuzzles.length - 1]?.puzzle?.rating})`);
        } else {
            console.warn('API failed, using fallback puzzles');
            // Duplicate fallback puzzles if API fails
            for (let i = 0; i < 15; i++) {
                allPuzzles = allPuzzles.concat(FALLBACK_PUZZLES);
            }
        }

        res.json({
            puzzles: allPuzzles.length > 0 ? allPuzzles : puzzleCache.puzzles,
            cached: false,
            count: allPuzzles.length,
            source: allPuzzles.length > 0 ? 'lichess' : 'fallback'
        });

    } catch (error) {
        console.error('Error in puzzle proxy:', error);
        res.status(500).json({ error: 'Failed to fetch puzzles', puzzles: FALLBACK_PUZZLES });
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
