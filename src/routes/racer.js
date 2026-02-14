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
        const { score, playerName, userId, mode, correctCount, wrongCount, maxStreak, puzzleCount } = req.body;

        if (score === undefined || score === null) {
            return res.status(400).json({ error: 'Score is required' });
        }

        // For registered users, resolve name from DB (ignore client-sent playerName)
        let resolvedName = playerName || 'Anonym';
        const parsedUserId = userId ? parseInt(userId) : null;

        if (parsedUserId) {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: parsedUserId },
                    select: { realName: true, username: true }
                });
                if (user) {
                    resolvedName = user.realName || user.username;
                }
            } catch (e) {
                console.warn('Could not resolve user name for userId', parsedUserId, e);
            }
        }

        const result = await prisma.puzzleRaceResult.create({
            data: {
                score: parseInt(score),
                playerName: resolvedName,
                userId: parsedUserId,
                mode: mode || 'vanilla',
                correctCount: correctCount != null ? parseInt(correctCount) : null,
                wrongCount: wrongCount != null ? parseInt(wrongCount) : null,
                maxStreak: maxStreak != null ? parseInt(maxStreak) : null,
                puzzleCount: puzzleCount != null ? parseInt(puzzleCount) : null
            },
        });

        res.json(result);
    } catch (error) {
        console.error('Error saving puzzle race result:', error);
        res.status(500).json({ error: 'Failed to save result' });
    }
});

// GET /api/racer/my-stats?userId=X&mode=vanilla|thematic
// Returns enriched personal dashboard data
router.get('/my-stats', async (req, res) => {
    try {
        const userId = parseInt(req.query.userId);
        const mode = req.query.mode || 'vanilla';

        if (!userId || isNaN(userId)) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Get top 3 scores with timestamps
        const top3 = await prisma.puzzleRaceResult.findMany({
            where: { userId, mode },
            orderBy: { score: 'desc' },
            take: 3,
            select: { score: true, createdAt: true, correctCount: true, wrongCount: true, maxStreak: true }
        });

        // Get total games count
        const totalGames = await prisma.puzzleRaceResult.count({
            where: { userId, mode }
        });

        // Get average score
        const avgResult = await prisma.puzzleRaceResult.aggregate({
            where: { userId, mode },
            _avg: { score: true },
            _max: { maxStreak: true }
        });

        // Get average accuracy (correctCount / puzzleCount)
        const accuracyResult = await prisma.puzzleRaceResult.aggregate({
            where: { userId, mode, puzzleCount: { gt: 0 } },
            _sum: { correctCount: true, puzzleCount: true }
        });

        const totalCorrect = accuracyResult._sum.correctCount || 0;
        const totalPuzzles = accuracyResult._sum.puzzleCount || 0;
        const avgAccuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : null;

        // Get last 5 scores (for trend sparkline)
        const recentResults = await prisma.puzzleRaceResult.findMany({
            where: { userId, mode },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { score: true, createdAt: true }
        });

        res.json({
            bestScore: top3[0]?.score || 0,
            top3: top3.map(r => ({
                score: r.score,
                date: r.createdAt,
                correctCount: r.correctCount,
                wrongCount: r.wrongCount,
                maxStreak: r.maxStreak
            })),
            totalGames,
            avgScore: Math.round(avgResult._avg.score || 0),
            bestStreak: avgResult._max.maxStreak || 0,
            avgAccuracy,
            recentScores: recentResults.map(r => ({ score: r.score, date: r.createdAt }))
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
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
                        username: true,
                        realName: true
                    }
                }
            }
        });

        // Enrich with display info
        const enriched = leaderboard.map(entry => ({
            id: entry.id,
            score: entry.score,
            playerName: entry.userId && entry.user
                ? (entry.user.realName || entry.user.username)
                : entry.playerName,
            isRegistered: !!entry.userId,
            createdAt: entry.createdAt,
            correctCount: entry.correctCount,
            wrongCount: entry.wrongCount,
            maxStreak: entry.maxStreak
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

export default router;
