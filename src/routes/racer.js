import express from 'express';
import { PrismaClient } from '@prisma/client';
import { getPragueWeekRange } from '../utils/weekRange.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
    CAMP_CODE,
    buildDifficultyPlan,
    calculateAttemptSummary,
    calculatePuzzlePoints,
    getCampAchievements,
    getCampLevel,
    getCampSessionStatus,
    normalizeCampConfig,
    normalizeCampMove
} from '../services/puzzleCampService.js';

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

// PUT /api/racer/settings - Admin only (JWT is actually verified by requireRole)
router.put('/settings', requireRole('ADMIN'), async (req, res) => {
    try {
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
// Returns enriched personal dashboard data with badges
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

        // Get average score + best streak
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

        // --- Best Today ---
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const bestTodayResult = await prisma.puzzleRaceResult.aggregate({
            where: { userId, mode, createdAt: { gte: todayStart } },
            _max: { score: true }
        });
        const bestToday = bestTodayResult._max.score || null;

        // --- Best This Week (Po–Ne ISO week, Europe/Prague TZ) ---
        const { start: weekStart, end: weekEnd } = getPragueWeekRange();
        const bestWeekResult = await prisma.puzzleRaceResult.aggregate({
            where: { userId, mode, createdAt: { gte: weekStart, lte: weekEnd } },
            _max: { score: true }
        });
        const bestThisWeek = bestWeekResult._max.score || null;

        // --- Day Streak (consecutive days with at least 1 game, counting back from today) ---
        let dayStreak = 0;
        let uniqueDates = [];
        if (totalGames > 0) {
            // Get distinct dates (as date strings) with games, ordered desc
            const allGames = await prisma.puzzleRaceResult.findMany({
                where: { userId, mode },
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true }
            });

            // Extract unique dates (YYYY-MM-DD in local time)
            uniqueDates = [...new Set(allGames.map(g => {
                const d = new Date(g.createdAt);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }))].sort().reverse(); // most recent first

            if (uniqueDates.length > 0) {
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                // Start from today or yesterday
                let checkDate = new Date(todayStr);
                if (uniqueDates[0] !== todayStr) {
                    // If no game today, check if yesterday was the last day
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
                    if (uniqueDates[0] !== yesterdayStr) {
                        dayStreak = 0; // Gap - streak broken
                    } else {
                        checkDate = yesterday;
                    }
                }

                if (dayStreak === 0 && uniqueDates[0] === todayStr || dayStreak === 0 && uniqueDates.includes(`${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`)) {
                    // Count consecutive days backward
                    const dateSet = new Set(uniqueDates);
                    let d = new Date(checkDate);
                    while (true) {
                        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        if (dateSet.has(dStr)) {
                            dayStreak++;
                            d.setDate(d.getDate() - 1);
                        } else {
                            break;
                        }
                    }
                }
            }
        }

        // --- Perfect Game (30/30 — all puzzles correct, 0 wrong) ---
        const perfectGame = await prisma.puzzleRaceResult.findFirst({
            where: {
                userId,
                mode,
                wrongCount: 0,
                correctCount: { gte: 30 }
            }
        });
        const hasPerfectGame = !!perfectGame;

        // --- Unique days played (for Veterán badge) ---
        const uniqueDaysCount = uniqueDates ? uniqueDates.length : 0;

        // --- Leaderboard rank (for Šampion badge) ---
        let leaderboardRank = 999;
        try {
            const rankResult = await prisma.$queryRaw`
                SELECT COUNT(DISTINCT user_id) + 1 AS rank
                FROM puzzle_race_results
                WHERE mode = ${mode}
                  AND user_id IS NOT NULL
                  AND score > COALESCE((SELECT MAX(score) FROM puzzle_race_results WHERE user_id = ${userId} AND mode = ${mode}), 0)
            `;
            leaderboardRank = Number(rankResult[0]?.rank || 999);
        } catch (e) { /* ignore */ }

        // --- Compute Tiered Badges ---
        const bestScore = top3[0]?.score || 0;
        const bestStreak = avgResult._max.maxStreak || 0;

        // Each category has tiers: bronze → silver → gold (→ diamond for 4-tier categories)
        // `tier` = highest earned level (0=none, 1=bronze, 2=silver, 3=gold, 4=diamond)
        const allBadges = [
            {
                id: 'games', name: 'Hráč', icon: '🎮',
                tiers: [
                    { level: 1, label: 'Bronze', req: 'Odehraj 1 hru', earned: totalGames >= 1 },
                    { level: 2, label: 'Stříbro', req: 'Odehraj 10 her', earned: totalGames >= 10 },
                    { level: 3, label: 'Zlato', req: 'Odehraj 50 her', earned: totalGames >= 50 },
                    { level: 4, label: 'Diamant', req: 'Odehraj 100 her', earned: totalGames >= 100 },
                ],
            },
            {
                id: 'score', name: 'Skóre', icon: '⚡',
                tiers: [
                    { level: 1, label: 'Bronze', req: 'Skóre 10+', earned: bestScore >= 10 },
                    { level: 2, label: 'Stříbro', req: 'Skóre 20+', earned: bestScore >= 20 },
                    { level: 3, label: 'Zlato', req: 'Skóre 30+', earned: bestScore >= 30 },
                    { level: 4, label: 'Diamant', req: 'Skóre 40+', earned: bestScore >= 40 },
                ],
            },
            {
                id: 'combo', name: 'Combo', icon: '💥',
                tiers: [
                    { level: 1, label: 'Bronze', req: '5 v řadě', earned: bestStreak >= 5 },
                    { level: 2, label: 'Stříbro', req: '10 v řadě', earned: bestStreak >= 10 },
                    { level: 3, label: 'Zlato', req: '15 v řadě', earned: bestStreak >= 15 },
                    { level: 4, label: 'Diamant', req: '20 v řadě', earned: bestStreak >= 20 },
                ],
            },
            {
                id: 'streak', name: 'Série', icon: '🔥',
                tiers: [
                    { level: 1, label: 'Bronze', req: '3 dny v řadě', earned: dayStreak >= 3 },
                    { level: 2, label: 'Stříbro', req: '7 dní v řadě', earned: dayStreak >= 7 },
                    { level: 3, label: 'Zlato', req: '30 dní v řadě', earned: dayStreak >= 30 },
                ],
            },
            {
                id: 'accuracy', name: 'Přesnost', icon: '🎯',
                tiers: [
                    { level: 1, label: 'Bronze', req: 'Přesnost 80%+', earned: avgAccuracy !== null && avgAccuracy >= 80 },
                    { level: 2, label: 'Stříbro', req: 'Přesnost 90%+', earned: avgAccuracy !== null && avgAccuracy >= 90 },
                    { level: 3, label: 'Zlato', req: 'Přesnost 95%+', earned: avgAccuracy !== null && avgAccuracy >= 95 },
                ],
            },
            {
                id: 'veteran', name: 'Veterán', icon: '📅',
                tiers: [
                    { level: 1, label: 'Bronze', req: 'Hraj 5 dnů', earned: uniqueDaysCount >= 5 },
                    { level: 2, label: 'Stříbro', req: 'Hraj 15 dnů', earned: uniqueDaysCount >= 15 },
                    { level: 3, label: 'Zlato', req: 'Hraj 30 dnů', earned: uniqueDaysCount >= 30 },
                ],
            },
            {
                id: 'champion', name: 'Šampion', icon: '🏆',
                tiers: [
                    { level: 1, label: 'Bronze', req: 'Top 10', earned: leaderboardRank <= 10 },
                    { level: 2, label: 'Stříbro', req: 'Top 3', earned: leaderboardRank <= 3 },
                    { level: 3, label: 'Zlato', req: '#1 v žebříčku', earned: leaderboardRank === 1 },
                ],
            },
            {
                id: 'perfect', name: 'Bezchybná hra', icon: '✨',
                tiers: [
                    { level: 1, label: 'Diamant', req: '30/30 — perfektní!', earned: hasPerfectGame },
                ],
            },
        ];

        // Compute tier for each badge category
        allBadges.forEach(badge => {
            badge.tier = 0;
            for (const t of badge.tiers) {
                if (t.earned) badge.tier = t.level;
            }
            // Next tier info for progress display
            const nextTier = badge.tiers.find(t => !t.earned);
            badge.nextReq = nextTier ? nextTier.req : null;
            badge.nextLevel = nextTier ? nextTier.level : null;
            badge.maxTier = badge.tiers.length;
        });

        res.json({
            bestScore,
            top3: top3.map(r => ({
                score: r.score,
                date: r.createdAt,
                correctCount: r.correctCount,
                wrongCount: r.wrongCount,
                maxStreak: r.maxStreak
            })),
            totalGames,
            avgScore: Math.round(avgResult._avg.score || 0),
            bestStreak,
            avgAccuracy,
            recentScores: recentResults.map(r => ({ score: r.score, date: r.createdAt })),
            bestToday,
            bestThisWeek,
            dayStreak,
            badges: allBadges
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// GET /api/racer/hall-of-fame?mode=vanilla|thematic
// Returns the best player for each completed week
router.get('/hall-of-fame', async (req, res) => {
    try {
        const mode = req.query.mode || 'vanilla';

        // Raw SQL: group by ISO week (Po–Ne) v Europe/Prague TZ.
        // DATE_TRUNC s AT TIME ZONE posune timestamp do Praha local time před truncem,
        // takže hráč v Po 00:30 Praha landuje v novém týdnu (ne v předchozí neděli UTC).
        const weeklyChampions = await prisma.$queryRaw`
            SELECT
                DATE_TRUNC('week', (created_at AT TIME ZONE 'Europe/Prague'))::date AS week_start,
                DATE_TRUNC('week', (created_at AT TIME ZONE 'Europe/Prague'))::date + 6 AS week_end,
                EXTRACT(ISOYEAR FROM (created_at AT TIME ZONE 'Europe/Prague'))::int AS year,
                EXTRACT(WEEK FROM (created_at AT TIME ZONE 'Europe/Prague'))::int AS week_num,
                MAX(score) AS best_score
            FROM puzzle_race_results
            WHERE mode = ${mode}
              AND user_id IS NOT NULL
            GROUP BY
                DATE_TRUNC('week', (created_at AT TIME ZONE 'Europe/Prague')),
                EXTRACT(ISOYEAR FROM (created_at AT TIME ZONE 'Europe/Prague')),
                EXTRACT(WEEK FROM (created_at AT TIME ZONE 'Europe/Prague'))
            HAVING DATE_TRUNC('week', (created_at AT TIME ZONE 'Europe/Prague'))
                 < DATE_TRUNC('week', (NOW() AT TIME ZONE 'Europe/Prague'))
            ORDER BY week_start DESC
            LIMIT 20
        `;

        // Pro každý týden najít konkrétního hráče s best_score.
        // Použije getPragueWeekRange k získání přesných hranic týdne (Po 00:00 – Ne 23:59:59.999 Prague).
        const enriched = await Promise.all(weeklyChampions.map(async (w) => {
            // week_start je PG date (UTC midnight reprezentující pondělí v Praze)
            const anchor = new Date(w.week_start);
            // Posun o 12h dopředu aby se getPragueWeekRange definitivně trefil do správného týdne
            // (chrání proti edge case kdy week_start je půlnoc UTC která v Praze padne na 01:00 dne pondělí)
            anchor.setUTCHours(anchor.getUTCHours() + 12);
            const { start, end } = getPragueWeekRange(anchor);

            const champion = await prisma.puzzleRaceResult.findFirst({
                where: {
                    mode,
                    score: Number(w.best_score),
                    userId: { not: null },
                    createdAt: { gte: start, lte: end }
                },
                include: {
                    user: { select: { username: true, realName: true } }
                },
                orderBy: { createdAt: 'asc' }
            });

            return {
                weekStart: w.week_start,
                weekEnd: w.week_end,
                year: Number(w.year),
                weekNum: Number(w.week_num),
                score: Number(w.best_score),
                playerName: champion?.user
                    ? (champion.user.realName || champion.user.username)
                    : (champion?.playerName || 'Neznámý'),
                userId: champion?.userId
            };
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Error fetching hall of fame:', error);
        res.status(500).json({ error: 'Failed to fetch hall of fame' });
    }
});

// GET /api/racer/leaderboard?period=week|all&mode=vanilla|thematic
router.get('/leaderboard', async (req, res) => {
    try {
        const period = req.query.period || 'all';
        const mode = req.query.mode || 'vanilla';
        const registeredOnly = req.query.registeredOnly === 'true';

        let whereClause = { mode };

        if (registeredOnly) {
            whereClause.userId = { not: null };
        }

        if (period === 'week') {
            // Aktuální ISO týden Po–Ne v Europe/Prague TZ
            const { start, end } = getPragueWeekRange();
            whereClause.createdAt = { gte: start, lte: end };
        }

        // Fetch more results to ensure we get enough unique players
        const results = await prisma.puzzleRaceResult.findMany({
            where: whereClause,
            take: 50,
            orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
            include: {
                user: { select: { username: true, realName: true } }
            }
        });

        // Deduplicate: keep only the best score per player
        const seen = new Set();
        const unique = [];
        for (const entry of results) {
            const key = entry.userId ? `u:${entry.userId}` : `n:${entry.playerName}`;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push({
                id: entry.id,
                score: entry.score,
                playerName: entry.userId && entry.user
                    ? (entry.user.realName || entry.user.username)
                    : entry.playerName,
                userId: entry.userId || null,
                isRegistered: !!entry.userId,
                createdAt: entry.createdAt,
                correctCount: entry.correctCount,
                wrongCount: entry.wrongCount,
                maxStreak: entry.maxStreak
            });
            if (unique.length >= 10) break;
        }

        res.json(unique);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

const campUserSelect = { id: true, username: true, realName: true };

function campDisplayName(user) {
    return user?.realName || user?.username || 'Hráč';
}

function campSessionPayload(session, now = new Date()) {
    if (!session) return null;
    const status = getCampSessionStatus(session, now);
    const startsAt = new Date(session.startsAt);
    return {
        id: session.id,
        campCode: session.campCode,
        campName: session.campName,
        title: session.title,
        status,
        startsAt,
        endsAt: new Date(startsAt.getTime() + session.durationSeconds * 1000),
        durationSeconds: session.durationSeconds,
        puzzleCount: session.puzzleCount,
        puzzleTheme: session.puzzleTheme,
        livesEnabled: session.livesEnabled,
        maxLives: session.maxLives,
        penaltyEnabled: session.penaltyEnabled,
        penaltySeconds: session.penaltySeconds,
        skipOnMistake: session.skipOnMistake,
        createdAt: session.createdAt
    };
}

async function findRelevantCampSession(now = new Date()) {
    const sessions = await prisma.puzzleCampSession.findMany({
        where: { campCode: CAMP_CODE, status: { not: 'cancelled' } },
        orderBy: { startsAt: 'desc' },
        take: 20
    });

    const live = sessions.find(session => getCampSessionStatus(session, now) === 'live');
    const scheduled = sessions
        .filter(session => getCampSessionStatus(session, now) === 'scheduled')
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
    return live || scheduled || sessions.find(session => getCampSessionStatus(session, now) === 'finished') || null;
}

async function fetchCampPuzzleSet(config) {
    const unique = [];
    const seen = new Set();

    for (let round = 0; round < 3 && unique.length < config.puzzleCount; round++) {
        const missing = config.puzzleCount - unique.length;
        const batches = await Promise.all(buildDifficultyPlan(missing).map(async item => {
            const batch = await fetchPuzzlesByDifficulty(item.difficulty, item.count, config.puzzleTheme);
            return batch.map(puzzle => ({ ...puzzle, campDifficulty: item.difficulty }));
        }));

        for (const puzzle of batches.flat()) {
            const puzzleId = puzzle?.puzzle?.id;
            if (!puzzleId || seen.has(puzzleId)) continue;
            seen.add(puzzleId);
            unique.push(puzzle);
        }
    }

    if (unique.length < config.puzzleCount) {
        throw new Error(`Lichess vrátil pouze ${unique.length} z ${config.puzzleCount} úloh`);
    }
    return unique.slice(0, config.puzzleCount);
}

async function refreshCampAttempt(attemptId, status) {
    const results = await prisma.puzzleCampPuzzleResult.findMany({
        where: { attemptId },
        orderBy: { puzzleIndex: 'asc' }
    });
    const summary = calculateAttemptSummary(results);

    await Promise.all(summary.scoredResults.map(result => {
        const stored = results.find(item => item.id === result.id);
        if (!stored || stored.points === result.points) return Promise.resolve();
        return prisma.puzzleCampPuzzleResult.update({ where: { id: result.id }, data: { points: result.points } });
    }));

    return prisma.puzzleCampAttempt.update({
        where: { id: attemptId },
        data: {
            status,
            finishedAt: status === 'finished' ? new Date() : undefined,
            score: summary.score,
            correctCount: summary.correctCount,
            wrongCount: summary.wrongCount,
            skippedCount: summary.skippedCount,
            maxStreak: summary.maxStreak,
            puzzleCount: summary.puzzleCount,
            durationMs: summary.durationMs
        }
    });
}

// GET /api/racer/camp/active - Přihlášený hráč dostane společný serverový odpočet.
router.get('/camp/active', authMiddleware, async (req, res) => {
    try {
        const now = new Date();
        const session = await findRelevantCampSession(now);
        let attempt = null;
        let participantCount = 0;

        if (session) {
            [attempt, participantCount] = await Promise.all([
                prisma.puzzleCampAttempt.findUnique({
                    where: { sessionId_userId: { sessionId: session.id, userId: req.user.id } }
                }),
                prisma.puzzleCampAttempt.count({ where: { sessionId: session.id } })
            ]);
        }

        res.json({
            serverTime: now,
            session: campSessionPayload(session, now),
            attempt,
            participantCount
        });
    } catch (error) {
        console.error('Camp active state error:', error);
        res.status(500).json({ error: 'Nepodařilo se načíst rozcvičku' });
    }
});

// POST /api/racer/camp/sessions - Trenér vytvoří pevnou sadu a naplánuje hromadný start.
router.post('/camp/sessions', requireRole('ADMIN'), async (req, res) => {
    try {
        const now = new Date();
        const existing = await findRelevantCampSession(now);
        if (existing && ['scheduled', 'live'].includes(getCampSessionStatus(existing, now))) {
            return res.status(409).json({
                error: 'Jiná rozcvička už čeká na start nebo právě probíhá',
                session: campSessionPayload(existing, now)
            });
        }

        const config = normalizeCampConfig(req.body);
        const puzzles = await fetchCampPuzzleSet(config);
        const startsAt = new Date(now.getTime() + config.startDelaySeconds * 1000);
        const session = await prisma.puzzleCampSession.create({
            data: {
                campCode: config.campCode,
                campName: config.campName,
                title: config.title,
                startsAt,
                durationSeconds: config.durationSeconds,
                puzzleCount: config.puzzleCount,
                puzzleTheme: config.puzzleTheme,
                livesEnabled: config.livesEnabled,
                maxLives: config.maxLives,
                penaltyEnabled: config.penaltyEnabled,
                penaltySeconds: config.penaltySeconds,
                skipOnMistake: config.skipOnMistake,
                puzzles,
                createdById: req.user.id
            }
        });

        res.status(201).json({
            serverTime: now,
            session: campSessionPayload(session, now),
            generatedPuzzles: puzzles.length
        });
    } catch (error) {
        console.error('Camp session create error:', error);
        res.status(500).json({ error: error.message || 'Rozcvičku se nepodařilo vytvořit' });
    }
});

router.get('/camp/admin', requireRole('ADMIN'), async (req, res) => {
    try {
        const now = new Date();
        const sessions = await prisma.puzzleCampSession.findMany({
            where: { campCode: CAMP_CODE },
            orderBy: { startsAt: 'desc' },
            take: 12,
            include: { _count: { select: { attempts: true } } }
        });
        res.json({
            serverTime: now,
            sessions: sessions.map(session => ({
                ...campSessionPayload(session, now),
                participantCount: session._count.attempts
            }))
        });
    } catch (error) {
        console.error('Camp admin state error:', error);
        res.status(500).json({ error: 'Nepodařilo se načíst stav rozcviček' });
    }
});

router.post('/camp/sessions/:id/cancel', requireRole('ADMIN'), async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        const session = await prisma.puzzleCampSession.update({
            where: { id },
            data: { status: 'cancelled' }
        });
        res.json({ session: campSessionPayload(session) });
    } catch (error) {
        console.error('Camp session cancel error:', error);
        res.status(404).json({ error: 'Rozcvička nebyla nalezena' });
    }
});

router.post('/camp/sessions/:id/start-now', requireRole('ADMIN'), async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        const session = await prisma.puzzleCampSession.update({
            where: { id },
            data: { startsAt: new Date(), status: 'live' }
        });
        res.json({ serverTime: new Date(), session: campSessionPayload(session) });
    } catch (error) {
        console.error('Camp session start error:', error);
        res.status(404).json({ error: 'Rozcvička nebyla nalezena' });
    }
});

router.post('/camp/sessions/:id/finish-now', requireRole('ADMIN'), async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        const session = await prisma.puzzleCampSession.update({
            where: { id },
            data: { status: 'finished' }
        });
        await prisma.puzzleCampAttempt.updateMany({
            where: { sessionId: id, status: { not: 'finished' } },
            data: { status: 'finished', finishedAt: new Date() }
        });
        res.json({ session: campSessionPayload(session) });
    } catch (error) {
        console.error('Camp session finish error:', error);
        res.status(404).json({ error: 'Rozcvička nebyla nalezena' });
    }
});

router.post('/camp/sessions/:id/join', authMiddleware, async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        const session = await prisma.puzzleCampSession.findUnique({ where: { id } });
        if (!session) return res.status(404).json({ error: 'Rozcvička nebyla nalezena' });

        const status = getCampSessionStatus(session);
        if (!['scheduled', 'live'].includes(status)) {
            return res.status(409).json({ error: 'Do této rozcvičky už se nelze připojit' });
        }

        const attempt = await prisma.puzzleCampAttempt.upsert({
            where: { sessionId_userId: { sessionId: id, userId: req.user.id } },
            create: {
                sessionId: id,
                userId: req.user.id,
                status: status === 'live' ? 'playing' : 'waiting',
                startedAt: status === 'live' ? session.startsAt : null
            },
            update: status === 'live' ? { status: 'playing', startedAt: session.startsAt } : {},
            include: { puzzleResults: { orderBy: { puzzleIndex: 'asc' } } }
        });

        const participantCount = await prisma.puzzleCampAttempt.count({ where: { sessionId: id } });
        res.json({ serverTime: new Date(), session: campSessionPayload(session), attempt, participantCount });
    } catch (error) {
        console.error('Camp join error:', error);
        res.status(500).json({ error: 'Připojení k rozcvičce se nezdařilo' });
    }
});

router.get('/camp/sessions/:id/play', authMiddleware, async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        const session = await prisma.puzzleCampSession.findUnique({ where: { id } });
        if (!session) return res.status(404).json({ error: 'Rozcvička nebyla nalezena' });

        const status = getCampSessionStatus(session);
        if (status === 'scheduled') {
            return res.status(425).json({ error: 'Rozcvička ještě nezačala', session: campSessionPayload(session) });
        }
        if (status !== 'live') {
            return res.status(410).json({ error: 'Rozcvička už skončila', session: campSessionPayload(session) });
        }

        const attempt = await prisma.puzzleCampAttempt.upsert({
            where: { sessionId_userId: { sessionId: id, userId: req.user.id } },
            create: { sessionId: id, userId: req.user.id, status: 'playing', startedAt: session.startsAt },
            update: { status: 'playing', startedAt: session.startsAt },
            include: { puzzleResults: { orderBy: { puzzleIndex: 'asc' } } }
        });

        res.json({
            serverTime: new Date(),
            session: campSessionPayload(session),
            attempt,
            puzzles: session.puzzles
        });
    } catch (error) {
        console.error('Camp play data error:', error);
        res.status(500).json({ error: 'Nepodařilo se načíst společnou sadu úloh' });
    }
});

router.put('/camp/sessions/:id/progress', authMiddleware, async (req, res) => {
    try {
        const sessionId = Number.parseInt(req.params.id, 10);
        const session = await prisma.puzzleCampSession.findUnique({ where: { id: sessionId } });
        if (!session) return res.status(404).json({ error: 'Rozcvička nebyla nalezena' });

        const status = getCampSessionStatus(session);
        const endsAt = new Date(session.startsAt).getTime() + session.durationSeconds * 1000;
        if (status === 'scheduled' || session.status === 'cancelled' || Date.now() > endsAt + 30000) {
            return res.status(409).json({ error: 'Výsledek už nelze zapsat' });
        }

        const attempt = await prisma.puzzleCampAttempt.findUnique({
            where: { sessionId_userId: { sessionId, userId: req.user.id } }
        });
        if (!attempt) return res.status(409).json({ error: 'Nejprve se připojte k rozcvičce' });

        const puzzleIndex = Number.parseInt(req.body.puzzleIndex, 10);
        const puzzles = Array.isArray(session.puzzles) ? session.puzzles : [];
        const expectedPuzzle = puzzles[puzzleIndex];
        if (!expectedPuzzle || expectedPuzzle.puzzle?.id !== req.body.puzzleId) {
            return res.status(400).json({ error: 'Úloha nepatří do této rozcvičky' });
        }

        const existing = await prisma.puzzleCampPuzzleResult.findUnique({
            where: { attemptId_puzzleIndex: { attemptId: attempt.id, puzzleIndex } }
        });
        if (!existing?.correct) {
            const correct = req.body.correct === true;
            const skipped = req.body.skipped === true;
            const wrongAttempts = Math.max(0, Math.min(50, Number.parseInt(req.body.wrongAttempts, 10) || 0));
            const wrongMove = normalizeCampMove(req.body.wrongMove);
            const responseMs = Math.max(0, Math.min(session.durationSeconds * 1000, Number.parseInt(req.body.responseMs, 10) || 0));
            const points = calculatePuzzlePoints({ correct, skipped, wrongAttempts, responseMs });

            await prisma.puzzleCampPuzzleResult.upsert({
                where: { attemptId_puzzleIndex: { attemptId: attempt.id, puzzleIndex } },
                create: {
                    attemptId: attempt.id,
                    puzzleIndex,
                    puzzleId: expectedPuzzle.puzzle.id,
                    rating: expectedPuzzle.puzzle.rating || null,
                    correct,
                    skipped,
                    wrongAttempts,
                    wrongMove,
                    responseMs,
                    points
                },
                update: { correct, skipped, wrongAttempts, wrongMove, responseMs, points, answeredAt: new Date() }
            });
        }

        const updatedAttempt = await refreshCampAttempt(attempt.id, 'playing');
        const betterScores = await prisma.puzzleCampAttempt.count({
            where: { sessionId, score: { gt: updatedAttempt.score } }
        });
        res.json({ attempt: updatedAttempt, rank: betterScores + 1 });
    } catch (error) {
        console.error('Camp progress error:', error);
        res.status(500).json({ error: 'Průběžný výsledek se nepodařilo uložit' });
    }
});

router.post('/camp/sessions/:id/finish', authMiddleware, async (req, res) => {
    try {
        const sessionId = Number.parseInt(req.params.id, 10);
        const attempt = await prisma.puzzleCampAttempt.findUnique({
            where: { sessionId_userId: { sessionId, userId: req.user.id } }
        });
        if (!attempt) return res.status(404).json({ error: 'Pokus nebyl nalezen' });

        const updatedAttempt = await refreshCampAttempt(attempt.id, 'finished');
        res.json({ attempt: updatedAttempt, achievements: getCampAchievements(updatedAttempt) });
    } catch (error) {
        console.error('Camp finish error:', error);
        res.status(500).json({ error: 'Výsledek se nepodařilo uzavřít' });
    }
});

router.get('/camp/leaderboard', authMiddleware, async (req, res) => {
    try {
        const now = new Date();
        const sessions = await prisma.puzzleCampSession.findMany({
            where: { campCode: CAMP_CODE, status: { not: 'cancelled' } },
            orderBy: { startsAt: 'asc' },
            include: {
                attempts: {
                    include: {
                        user: { select: campUserSelect },
                        puzzleResults: { orderBy: { puzzleIndex: 'asc' } }
                    }
                }
            }
        });

        const relevant = await findRelevantCampSession(now);
        const requestedId = Number.parseInt(req.query.sessionId, 10);
        const selected = sessions.find(session => session.id === requestedId)
            || sessions.find(session => session.id === relevant?.id)
            || sessions.at(-1)
            || null;

        const standingsByUser = new Map();
        for (const session of sessions) {
            const ranked = [...session.attempts].sort((a, b) => b.score - a.score || b.correctCount - a.correctCount || a.durationMs - b.durationMs);
            ranked.forEach((attempt, index) => {
                if (attempt.puzzleResults.length === 0) return;
                const row = standingsByUser.get(attempt.userId) || {
                    userId: attempt.userId,
                    playerName: campDisplayName(attempt.user),
                    score: 0,
                    correctCount: 0,
                    wrongCount: 0,
                    skippedCount: 0,
                    maxStreak: 0,
                    durationMs: 0,
                    attendance: 0,
                    wins: 0
                };
                row.score += attempt.score;
                row.correctCount += attempt.correctCount;
                row.wrongCount += attempt.wrongCount;
                row.skippedCount += attempt.skippedCount;
                row.maxStreak = Math.max(row.maxStreak, attempt.maxStreak);
                row.durationMs += attempt.durationMs;
                row.attendance++;
                if (index === 0 && attempt.score > 0) row.wins++;
                standingsByUser.set(attempt.userId, row);
            });
        }

        const standings = [...standingsByUser.values()]
            .sort((a, b) => b.score - a.score || b.correctCount - a.correctCount || a.durationMs - b.durationMs)
            .map((row, index) => ({ ...row, rank: index + 1, level: getCampLevel(row.score) }));

        let sessionDetail = null;
        if (selected) {
            const puzzles = Array.isArray(selected.puzzles) ? selected.puzzles : [];
            const canPreviewPuzzles = getCampSessionStatus(selected, now) === 'finished';
            const participants = [...selected.attempts]
                .sort((a, b) => b.score - a.score || b.correctCount - a.correctCount || a.durationMs - b.durationMs)
                .map((attempt, index) => ({
                    rank: index + 1,
                    userId: attempt.userId,
                    playerName: campDisplayName(attempt.user),
                    status: attempt.status,
                    score: attempt.score,
                    correctCount: attempt.correctCount,
                    wrongCount: attempt.wrongCount,
                    skippedCount: attempt.skippedCount,
                    maxStreak: attempt.maxStreak,
                    cells: attempt.puzzleResults.map(result => ({
                        puzzleIndex: result.puzzleIndex,
                        correct: result.correct,
                        skipped: result.skipped,
                        wrongAttempts: result.wrongAttempts,
                        wrongMove: result.wrongMove,
                        responseMs: result.responseMs,
                        points: result.points
                    }))
                }));

            sessionDetail = {
                session: campSessionPayload(selected, now),
                puzzles: puzzles.map((puzzle, index) => ({
                    index,
                    puzzleId: puzzle.puzzle?.id,
                    rating: puzzle.puzzle?.rating || null,
                    difficulty: puzzle.campDifficulty || null,
                    preview: canPreviewPuzzles ? {
                        pgn: puzzle.game?.pgn || '',
                        initialPly: puzzle.puzzle?.initialPly || 0,
                        solution: Array.isArray(puzzle.puzzle?.solution) ? puzzle.puzzle.solution : []
                    } : null
                })),
                participants
            };
        }

        res.json({
            serverTime: now,
            campCode: CAMP_CODE,
            campName: 'Pardubice 2026',
            sessions: sessions.map(session => ({
                ...campSessionPayload(session, now),
                participantCount: session.attempts.length
            })),
            standings,
            sessionDetail
        });
    } catch (error) {
        console.error('Camp leaderboard error:', error);
        res.status(500).json({ error: 'Táborový žebříček se nepodařilo načíst' });
    }
});

export default router;
