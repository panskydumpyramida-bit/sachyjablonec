import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Puzzle cache - refresh every 10 minutes
let puzzleCache = {
    puzzles: [],
    lastFetch: 0,
    ttl: 10 * 60 * 1000 // 10 minutes
};

// Fisher-Yates shuffle
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Fetch puzzles from Lichess API (NO AUTH TOKEN = correct difficulties!)
async function fetchLichessPuzzles() {
    const allPuzzles = [];

    // Fetch different difficulty levels - NO AUTH TOKEN!
    // 5 categories × 15 puzzles = 75 puzzles total
    const difficulties = ['easiest', 'easier', 'normal', 'harder', 'hardest'];

    for (const diff of difficulties) {
        try {
            const res = await fetch(`https://lichess.org/api/puzzle/batch/mix?nb=15&difficulty=${diff}`, {
                headers: { 'Accept': 'application/json' }
                // NO Authorization header! This gives us correct difficulty ranges
            });

            if (res.ok) {
                const data = await res.json();
                const puzzles = data.puzzles || [];
                console.log(`Fetched ${puzzles.length} ${diff} puzzles (rating ${puzzles[0]?.puzzle?.rating}-${puzzles[puzzles.length - 1]?.puzzle?.rating})`);
                allPuzzles.push(...puzzles);
            } else {
                console.warn(`Lichess ${diff} returned ${res.status}`);
            }

            // Small delay between requests
            await new Promise(r => setTimeout(r, 500));
        } catch (e) {
            console.error(`Failed to fetch ${diff}:`, e.message);
        }
    }

    // Remove duplicates by puzzle ID
    const seen = new Set();
    const unique = allPuzzles.filter(p => {
        if (seen.has(p.puzzle.id)) return false;
        seen.add(p.puzzle.id);
        return true;
    });

    // Sort by rating
    unique.sort((a, b) => a.puzzle.rating - b.puzzle.rating);

    return unique;
}

// GET /api/racer/puzzles - Fetch from Lichess with caching
router.get('/puzzles', async (req, res) => {
    try {
        const now = Date.now();

        // Return cached puzzles if still valid
        if (puzzleCache.puzzles.length >= 30 && (now - puzzleCache.lastFetch) < puzzleCache.ttl) {
            // Shuffle for variety but keep sorted by rating groups (5 groups)
            const easiest = puzzleCache.puzzles.filter(p => p.puzzle.rating < 1000);
            const easier = puzzleCache.puzzles.filter(p => p.puzzle.rating >= 1000 && p.puzzle.rating < 1300);
            const normal = puzzleCache.puzzles.filter(p => p.puzzle.rating >= 1300 && p.puzzle.rating < 1600);
            const harder = puzzleCache.puzzles.filter(p => p.puzzle.rating >= 1600 && p.puzzle.rating < 1900);
            const hardest = puzzleCache.puzzles.filter(p => p.puzzle.rating >= 1900);

            const shuffled = [
                ...shuffleArray(easiest),
                ...shuffleArray(easier),
                ...shuffleArray(normal),
                ...shuffleArray(harder),
                ...shuffleArray(hardest)
            ];

            console.log(`Returning ${shuffled.length} cached puzzles (shuffled)`);
            return res.json({ puzzles: shuffled, cached: true, count: shuffled.length });
        }

        // Fetch fresh puzzles
        console.log('Fetching fresh puzzles from Lichess...');
        const puzzles = await fetchLichessPuzzles();

        if (puzzles.length > 0) {
            puzzleCache.puzzles = puzzles;
            puzzleCache.lastFetch = now;
            console.log(`Cached ${puzzles.length} puzzles`);
        }

        res.json({
            puzzles: puzzles.length > 0 ? puzzles : puzzleCache.puzzles,
            cached: false,
            count: puzzles.length
        });

    } catch (error) {
        console.error('Error fetching puzzles:', error);
        res.status(500).json({ error: 'Failed to fetch puzzles', puzzles: puzzleCache.puzzles || [] });
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
