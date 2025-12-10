import express from 'express';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = express.Router();
const prisma = new PrismaClient();

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load static puzzles from JSON file (100 puzzles, pre-sorted by rating)
let STATIC_PUZZLES = [];
try {
    const puzzlePath = join(__dirname, '../../data/puzzles.json');
    STATIC_PUZZLES = JSON.parse(readFileSync(puzzlePath, 'utf-8'));
    console.log(`Loaded ${STATIC_PUZZLES.length} puzzles from static database`);
} catch (e) {
    console.error('Failed to load puzzles.json:', e.message);
}

// Fisher-Yates shuffle
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// GET /api/racer/puzzles - Return shuffled puzzles from static database
router.get('/puzzles', async (req, res) => {
    try {
        if (STATIC_PUZZLES.length === 0) {
            return res.status(500).json({ error: 'No puzzles available', puzzles: [] });
        }

        // Shuffle puzzles for variety, but keep roughly sorted by rating
        // Split into difficulty groups and shuffle within each group
        const easy = STATIC_PUZZLES.filter(p => p.puzzle.rating < 1900);
        const medium = STATIC_PUZZLES.filter(p => p.puzzle.rating >= 1900 && p.puzzle.rating < 2100);
        const hard = STATIC_PUZZLES.filter(p => p.puzzle.rating >= 2100);

        // Shuffle within each group and recombine
        const shuffledPuzzles = [
            ...shuffleArray(easy),
            ...shuffleArray(medium),
            ...shuffleArray(hard)
        ];

        console.log(`Returning ${shuffledPuzzles.length} puzzles (shuffled within difficulty groups)`);

        res.json({
            puzzles: shuffledPuzzles,
            cached: false,
            count: shuffledPuzzles.length,
            source: 'static'
        });

    } catch (error) {
        console.error('Error in puzzle endpoint:', error);
        res.status(500).json({ error: 'Failed to get puzzles', puzzles: [] });
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
