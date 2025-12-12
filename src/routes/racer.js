import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Valid difficulty levels in order
const DIFFICULTIES = ['easiest', 'easier', 'normal', 'harder', 'hardest'];

// Fetch puzzles from Lichess API by difficulty and theme
// NO Authorization header required - this gives us correct difficulty ranges
async function fetchPuzzlesByDifficulty(difficulty, count = 3, theme = 'mix') {
    try {
        // Lichess API: /api/puzzle/batch/{theme}?nb={count}&difficulty={difficulty}
        const res = await fetch(`https://lichess.org/api/puzzle/batch/${theme}?nb=${count}&difficulty=${difficulty}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (res.ok) {
            const data = await res.json();
            const puzzles = data.puzzles || [];
            console.log(`Fetched ${puzzles.length} ${difficulty} puzzles (theme: ${theme})`);
            return puzzles;
        } else {
            console.warn(`Lichess ${difficulty}/${theme} returned ${res.status}`);
            return [];
        }
    } catch (e) {
        console.error(`Failed to fetch ${difficulty}/${theme}:`, e.message);
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
        const count = Math.min(parseInt(req.query.count) || 3, 20); // increased max count for caching
        const mode = req.query.mode || 'vanilla'; // Default to vanilla (safer fallback)

        // Validate difficulty
        if (!DIFFICULTIES.includes(difficulty)) {
            return res.status(400).json({ error: 'Invalid difficulty', puzzles: [] });
        }

        // Get theme from settings
        const settings = await prisma.puzzleRacerSettings.findFirst();

        let theme = settings?.puzzleTheme || 'mix';
        let randomize = settings?.randomizePuzzles !== false; // Default true

        // FORCE overrides for Vanilla mode
        if (mode === 'vanilla') {
            theme = 'mix';
            randomize = true;
        }

        // If randomization is OFF (and not vanilla), try to serve from cache
        if (!randomize) {
            let fixedSet = settings?.fixedPuzzleSet || {};

            // Check if we have puzzles for this difficulty in cache
            if (fixedSet[difficulty] && Array.isArray(fixedSet[difficulty]) && fixedSet[difficulty].length > 0) {
                // Return the cached puzzles (limited by count)
                // If the game needs more, it might be an issue, but we cache e.g. 50
                const cached = fixedSet[difficulty].slice(0, count);
                console.log(`Serving ${cached.length} fixed puzzles for ${difficulty}`);
                return res.json({
                    puzzles: cached,
                    difficulty,
                    theme,
                    count: cached.length,
                    fromCache: true
                });
            }

            // Cache MISS: Fetch fresh, save to DB, then serve
            console.log(`Cache miss for fixed set ${difficulty}. Fetching and caching...`);
            // Fetch A LOT to be safe for future requests (e.g. 50)
            const countToCache = 50;
            const newPuzzles = await fetchPuzzlesByDifficulty(difficulty, countToCache, theme);

            if (newPuzzles.length > 0) {
                // Update DB with new cache
                fixedSet[difficulty] = newPuzzles;
                await prisma.puzzleRacerSettings.update({
                    where: { id: settings.id },
                    data: { fixedPuzzleSet: fixedSet }
                });

                const cached = newPuzzles.slice(0, count);
                return res.json({
                    puzzles: cached,
                    difficulty,
                    theme,
                    count: cached.length,
                    fromCache: true
                });
            }
        }

        // Standard Random Mode (or failover)
        console.log(`Fetching ${count} ${difficulty} puzzles (theme: ${theme})...`);
        const puzzles = await fetchPuzzlesByDifficulty(difficulty, count, theme);

        res.json({
            puzzles,
            difficulty,
            theme,
            count: puzzles.length,
            fromCache: false
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
    skipOnMistake: false,
    randomizePuzzles: true
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

        const { puzzleTheme, timeLimitSeconds, livesEnabled, maxLives, puzzlesPerDifficulty, penaltyEnabled, penaltySeconds, skipOnMistake, randomizePuzzles } = req.body;

        const data = {
            puzzleTheme: puzzleTheme || 'mix',
            timeLimitSeconds: parseInt(timeLimitSeconds) || 180,
            livesEnabled: livesEnabled !== false,
            maxLives: parseInt(maxLives) || 3,
            puzzlesPerDifficulty: parseInt(puzzlesPerDifficulty) || 6,
            penaltyEnabled: penaltyEnabled === true,
            penaltySeconds: parseInt(penaltySeconds) || 5,
            skipOnMistake: skipOnMistake === true,
            randomizePuzzles: randomizePuzzles !== false
        };

        // If theme changes or switching TO fixed mode, we might want to clear cache?
        // Actually, let's keep it simple: Cache is only cleared manually via refresh button or if theme changes significantly?
        // Let's decide: if theme changes, we SHOULD clear cache to avoid mixing themes.
        const current = await prisma.puzzleRacerSettings.findFirst();
        if (current && current.puzzleTheme !== data.puzzleTheme) {
            data.fixedPuzzleSet = {}; // Clear cache on theme change
        }

        const updated = await prisma.puzzleRacerSettings.upsert({
            where: { id: 1 },
            update: data,
            create: { id: 1, ...data }
        });

        res.json(updated);

    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// POST /api/racer/settings/refresh-set - Admin only
// Force clear the fixed cache so new puzzles are fetched next time
router.post('/settings/refresh-set', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        await prisma.puzzleRacerSettings.update({
            where: { id: 1 },
            data: { fixedPuzzleSet: {} } // Clear cache
        });

        res.json({ success: true, message: 'Cached set cleared' });
    } catch (error) {
        console.error('Error refreshing set:', error);
        res.status(500).json({ error: 'Failed to refresh set' });
    }
});

// POST /api/racer/save
router.post('/save', async (req, res) => {
    try {
        const { score, playerName, userId, mode } = req.body;

        if (score === undefined || score === null) {
            return res.status(400).json({ error: 'Score is required' });
        }

        const result = await prisma.puzzleRaceResult.create({
            data: {
                score: parseInt(score),
                playerName: playerName || 'Anonymous',
                userId: userId ? parseInt(userId) : null,
                mode: mode || 'vanilla'
            },
        });

        res.json(result);
    } catch (error) {
        console.error('Error saving puzzle race result:', error);
        res.status(500).json({ error: 'Failed to save result' });
    }
});

// GET /api/racer/leaderboard?period=week|all&mode=vanilla|thematic
router.get('/leaderboard', async (req, res) => {
    try {
        const period = req.query.period || 'all';
        const mode = req.query.mode || 'vanilla';

        // Build where clause for time filter and mode
        let whereClause = {
            mode: mode
        };

        if (period === 'week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            whereClause.createdAt = { gte: oneWeekAgo };
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
