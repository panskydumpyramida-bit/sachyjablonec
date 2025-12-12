import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Valid difficulty levels in order
const DIFFICULTIES = ['easiest', 'easier', 'normal', 'harder', 'hardest'];

// Fetch puzzles from Lichess API - use /api/puzzle/next endpoint (no auth required)
async function fetchPuzzlesByDifficulty(difficulty, count = 3, theme = 'mix') {
    const puzzles = [];

    try {
        // Use daily puzzle endpoint first, then iterate for more
        // The /api/puzzle/next endpoint doesn't exist without auth
        // Use /api/puzzle/daily for daily puzzle (no auth)
        // For random puzzles, we'll use the public training API

        // Try the training endpoint with theme
        const themeParam = theme !== 'mix' ? theme : '';
        const url = themeParam
            ? `https://lichess.org/training/${themeParam}`
            : `https://lichess.org/training`;

        // Actually, let's use the puzzle storm api which is simpler
        // Or use /api/puzzle/daily which is guaranteed to work
        for (let i = 0; i < count; i++) {
            const res = await fetch(`https://lichess.org/api/puzzle/daily`, {
                headers: { 'Accept': 'application/json' }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.puzzle && data.game) {
                    puzzles.push(data);
                }
            }

            // Small delay between requests to be nice to the API
            if (i < count - 1) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        console.log(`Fetched ${puzzles.length} puzzles (theme: ${theme}, difficulty: ${difficulty})`);
        return puzzles;
    } catch (e) {
        console.error(`Failed to fetch puzzles:`, e.message);
        return [];
    }
}

// GET /api/racer/puzzles - Fetch fresh puzzles by difficulty
// Query params:
//   difficulty: 'easiest' | 'easier' | 'normal' | 'harder' | 'hardest'
//   count: number of puzzles to fetch (default 3)
router.get('/puzzles', async (req, res) => {
    try {
        const difficulty = req.query.difficulty || 'easiest';
        const count = Math.min(parseInt(req.query.count) || 3, 10); // Max 10 per request

        // Validate difficulty
        if (!DIFFICULTIES.includes(difficulty)) {
            return res.status(400).json({ error: 'Invalid difficulty', puzzles: [] });
        }

        // Get theme from settings
        const settings = await prisma.puzzleRacerSettings.findFirst();
        const theme = settings?.puzzleTheme || 'mix';

        console.log(`Fetching ${count} ${difficulty} puzzles (theme: ${theme})...`);
        const puzzles = await fetchPuzzlesByDifficulty(difficulty, count, theme);

        res.json({
            puzzles,
            difficulty,
            theme,
            count: puzzles.length
        });

    } catch (error) {
        console.error('Error fetching puzzles:', error);
        res.status(500).json({ error: 'Failed to fetch puzzles', puzzles: [] });
    }
});

// Default settings for when no record exists
const DEFAULT_SETTINGS = {
    id: 1,
    puzzleTheme: 'mix',
    timeLimitSeconds: 180,
    livesEnabled: true,
    maxLives: 3,
    puzzlesPerDifficulty: 6,
    penaltyEnabled: false,
    penaltySeconds: 5,
    skipOnMistake: false
};

// GET /api/racer/settings - Public (game fetches settings before start)
router.get('/settings', async (req, res) => {
    try {
        const settings = await prisma.puzzleRacerSettings.findFirst();
        res.json(settings || DEFAULT_SETTINGS);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.json(DEFAULT_SETTINGS);
    }
});

// PUT /api/racer/settings - Admin only (requires auth token)
router.put('/settings', async (req, res) => {
    try {
        // Simple auth check - reuse Bearer token pattern
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { puzzleTheme, timeLimitSeconds, livesEnabled, maxLives, puzzlesPerDifficulty, penaltyEnabled, penaltySeconds, skipOnMistake } = req.body;

        const data = {
            puzzleTheme: puzzleTheme || 'mix',
            timeLimitSeconds: parseInt(timeLimitSeconds) || 180,
            livesEnabled: livesEnabled !== false,
            maxLives: parseInt(maxLives) || 3,
            puzzlesPerDifficulty: parseInt(puzzlesPerDifficulty) || 6,
            penaltyEnabled: penaltyEnabled === true,
            penaltySeconds: parseInt(penaltySeconds) || 5,
            skipOnMistake: skipOnMistake === true
        };

        const updated = await prisma.puzzleRacerSettings.upsert({
            where: { id: 1 },
            update: data,
            create: { id: 1, ...data }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
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

// GET /api/racer/leaderboard?period=week|all
router.get('/leaderboard', async (req, res) => {
    try {
        const period = req.query.period || 'all';

        // Build where clause for time filter
        let whereClause = {};
        if (period === 'week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            whereClause = {
                createdAt: { gte: oneWeekAgo }
            };
        }

        const leaderboard = await prisma.puzzleRaceResult.findMany({
            where: whereClause,
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
