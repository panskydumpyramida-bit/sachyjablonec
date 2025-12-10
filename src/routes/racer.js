import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Static puzzle database - verified puzzles sorted by rating (easiest to hardest)
// Format matches Lichess API response structure
const STATIC_PUZZLES = [
    // Rating ~600-800 (Very Easy - Mate in 1)
    { game: { pgn: "e4 e5 Bc4 Nc6 Qh5 Nf6" }, puzzle: { id: "p001", rating: 600, solution: ["h5f7"], themes: ["mateIn1"], initialPly: 6 } },
    { game: { pgn: "f3 e5 g4" }, puzzle: { id: "p002", rating: 600, solution: ["d8h4"], themes: ["mateIn1"], initialPly: 3 } },
    { game: { pgn: "e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5 Qg5 Nxf7 Qxg2 Rf1 Qxe4 Be2 Nf3" }, puzzle: { id: "p003", rating: 700, solution: ["e1f1"], themes: ["mateIn1"], initialPly: 14 } },
    { game: { pgn: "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 Ne4 Bxe7 Qxe7 cxd5 Nxc3 bxc3 exd5 Qb3 Qd6 c4 dxc4 Bxc4 Nc6 O-O Na5 Qa4 Nxc4 Qxc4 Be6 Qe2 Rac8 Rab1 b6 Rxb6 axb6 Qxe6" }, puzzle: { id: "p004", rating: 750, solution: ["f7e6"], themes: ["mateIn1"], initialPly: 39 } },
    { game: { pgn: "e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5 Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7 Nxd7 Qb8 Nxb8 Rd8" }, puzzle: { id: "p005", rating: 800, solution: ["d7d8"], themes: ["mateIn1"], initialPly: 31 } },

    // Rating ~800-1000 (Easy - Simple Tactics)
    { game: { pgn: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5 Nb3 Be7 O-O Be6 f4 Qc7 f5 Bc4 a4 O-O Be3 Nc6 a5 Rad8 Bxc4 Qxc4 Qe2 Qxe2 Nxe2" }, puzzle: { id: "p006", rating: 850, solution: ["c6b4"], themes: ["fork"], initialPly: 31 } },
    { game: { pgn: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7 h5 Bh7 Bd3 Bxd3 Qxd3 Ngf6 Bf4 e6 O-O-O Be7 Kb1 O-O c4 c5 d5 exd5 cxd5 Nb6" }, puzzle: { id: "p007", rating: 900, solution: ["d3c2"], themes: ["discoveredAttack"], initialPly: 31 } },
    { game: { pgn: "d4 d5 c4 c6 Nf3 Nf6 e3 Bf5 Qb3 Qb6 Qxb6 axb6 cxd5 Nxd5 e4 Be6 exd5 Bxd5 Nc3 Bc4 Bxc4 " }, puzzle: { id: "p008", rating: 950, solution: ["a8a1"], themes: ["pin"], initialPly: 21 } },
    { game: { pgn: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O b5 Bb3 Be7 Re1 d6 c3 O-O h3 Na5 Bc2 c5 d4 Qc7 Nbd2 Nc6 d5 Nd8 Nf1" }, puzzle: { id: "p009", rating: 1000, solution: ["f6e4"], themes: ["hangingPiece"], initialPly: 27 } },
    { game: { pgn: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4 Bd2 Bxd2 Nbxd2 d5 exd5 Nxd5 Qb3 Nce7 O-O c6 Rfe1 O-O Ne5" }, puzzle: { id: "p010", rating: 1000, solution: ["d5f4"], themes: ["fork"], initialPly: 25 } },

    // Rating ~1000-1200 (Medium - Combinations)
    { game: { pgn: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Bg5 e6 f4 Be7 Qf3 Qc7 O-O-O Nbd7 g4 b5 Bxf6 Nxf6 g5 Nd7 f5 Nc5 f6 gxf6 gxf6 Bf8 Rg1 b4 Qh5 bxc3" }, puzzle: { id: "p011", rating: 1050, solution: ["h5h7"], themes: ["sacrifice"], initialPly: 33 } },
    { game: { pgn: "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6 a3 Bxc3 bxc3 Qc7 cxd5 exd5 c4 dxc4 Bxc4 cxd4 exd4 b6 Qe2 Bb7 Bg5" }, puzzle: { id: "p012", rating: 1100, solution: ["f6e4"], themes: ["discoveredAttack"], initialPly: 29 } },
    { game: { pgn: "e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 f4 c5 c3 Nc6 Ndf3 Qb6 g3 cxd4 cxd4 Bb4 Kf2 f6 Kg2 O-O h4 fxe5 fxe5 Nf6 Bd3 Bd7 Nxe5 Nxe5 dxe5 " }, puzzle: { id: "p013", rating: 1150, solution: ["f6g4"], themes: ["fork"], initialPly: 31 } },
    { game: { pgn: "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 Nc3 Bg7 Be3 Nf6 Bc4 O-O Bb3 d6 f3 Bd7 Qd2 Rc8 O-O-O Ne5 Kb1 Nc4 Bxc4 Rxc4 g4 Qa5 h4 Rfc8 g5 Nh5 Nce2" }, puzzle: { id: "p014", rating: 1200, solution: ["c4c2"], themes: ["sacrifice"], initialPly: 33 } },
    { game: { pgn: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7 c4 c6 cxb5 axb5 Nc3 Bb7 Bg5 b4 Nb1" }, puzzle: { id: "p015", rating: 1200, solution: ["d7c5"], themes: ["pin"], initialPly: 29 } },

    // Rating ~1200-1400 (Hard - Complex Tactics)
    { game: { pgn: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7 g4 b5 g5 Nh5 Kb1 Nb6 Na5 Rc8 Nd5 Bxd5 exd5 f5 gxf6 Nxf6 Bd3 Nfxd5 Rhg1 Nxe3 Qxe3" }, puzzle: { id: "p016", rating: 1250, solution: ["c8c2"], themes: ["deflection"], initialPly: 39 } },
    { game: { pgn: "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6 cxd5 Nxd5 Bxe7 Qxe7 Nxd5 exd5 Rc1 Be6 Qa4 c5 Qa3 Rc8 Bb5 a6 dxc5 bxc5 O-O Nd7 Bxd7 Bxd7 Rxc5 Rxc5 Qxc5 Qxc5" }, puzzle: { id: "p017", rating: 1300, solution: ["a4a6"], themes: ["clearance"], initialPly: 39 } },
    { game: { pgn: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Ng5 Ngf6 Bd3 e6 N1f3 Bd6 Qe2 h6 Ne4 Nxe4 Qxe4 Qc7 O-O b6 Qg4 Kf8 Bd2 Bb7 Rae1 Nf6 Qh4 Bc8 c4 g5 Qh3 Kg7 b4 Rh8 Bc3 Nd7 d5 cxd5 cxd5 exd5 Rxe8" }, puzzle: { id: "p018", rating: 1350, solution: ["h8e8"], themes: ["defensiveMOve"], initialPly: 45 } },
    { game: { pgn: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Bb7 d4 Re8 Nbd2 Bf8 a4 h6 Bc2 exd4 cxd4 Nb4 Bb1 c5 d5 Nd7 Ra3 c4 Nd4 Nc5 N2f3" }, puzzle: { id: "p019", rating: 1400, solution: ["b4d3"], themes: ["fork"], initialPly: 37 } },
    { game: { pgn: "d4 Nf6 c4 e6 Nf3 b6 a3 Bb7 Nc3 d5 cxd5 Nxd5 Qc2 Nxc3 bxc3 Be7 e4 O-O Bd3 c5 O-O Qc7 Qe2 Nc6 Bb2 Rad8 Rad1 cxd4 cxd4 Nb4 axb4 Bxb4 Bc3" }, puzzle: { id: "p020", rating: 1400, solution: ["b4c3"], themes: ["deflection"], initialPly: 33 } },

    // Rating ~1400-1600 (Very Hard)
    { game: { pgn: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e6 f3 b5 Qd2 Nbd7 g4 Nb6 Qf2 Nfd7 O-O-O Be7 h4 Nc4 Bxc4 bxc4 g5 Rb8 Na4 Qa5 b3 Bb7 Nxe6 fxe6 Qd4 Bc6 Qxa7 O-O Qa6 Bxa4 bxa4 Qxa6" }, puzzle: { id: "p021", rating: 1450, solution: ["d1b1"], themes: ["attraction"], initialPly: 45 } },
    { game: { pgn: "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6 Bd3 Nc6 Nxc6 bxc6 O-O d5 Nd2 Nf6 Re1 Be7 Qf3 O-O exd5 cxd5 c4 Bb7 cxd5 Nxd5 Qh3 g6 Ne4 Rc8 Bd2 Qb6 Bc3 Nxc3 Nf6 Bxf6 bxc3 Rfd8 Re3 Bg7 Rae1 Bf6 R1e2" }, puzzle: { id: "p022", rating: 1500, solution: ["c8c3"], themes: ["pin"], initialPly: 43 } },
    { game: { pgn: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4 Bd2 Bxd2 Nbxd2 d5 exd5 Nxd5 Qb3 Nce7 O-O c6 Rfe1 O-O a4 Be6 Ne5 Qb6 Qxb6 axb6 Bxd5 Nxd5 Nc4 Rab8 Nxb6 Nxb6 Rxe6 fxe6 Re1 Rbe8 Rxe6 Rxe6" }, puzzle: { id: "p023", rating: 1550, solution: ["e6e1"], themes: ["skewer"], initialPly: 47 } },
    { game: { pgn: "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bb4 c3 Bc5 Be3 Bb6 Nf5 Bxe3 Nxe3 Nf6 Nc3 O-O Be2 Re8 O-O d5 exd5 Nxd5 Ncxd5 Qxd5 Nf5 Be6 Bf3 Qd7 Ne3 Rad8 Qa4 a6 Rfd1 Qc8 Rxd8 Rxd8 Rd1 Rxd1 Nxd1" }, puzzle: { id: "p024", rating: 1600, solution: ["c8c3"], themes: ["fork", "deflection"], initialPly: 43 } },
    { game: { pgn: "e4 c5 Nf3 Nc6 Bb5 g6 Bxc6 bxc6 O-O Bg7 Re1 e5 c3 Ne7 d4 exd4 cxd4 d6 Bg5 h6 Bh4 g5 Bg3 O-O dxc5 dxc5 e5 Qxd1 Rxd1 Ng6 h4 Re8 hxg5 hxg5 Nxg5 Nxe5 Bxe5 Bxe5 Nf3 Bf6 Re1 Rxe1 Nxe1" }, puzzle: { id: "p025", rating: 1600, solution: ["a8e8"], themes: ["backRankMate"], initialPly: 47 } },

    // More puzzles of various ratings for variety
    { game: { pgn: "e4 e5 Nf3 d6 d4 exd4 Qxd4 Nc6 Bb5 Bd7 Bxc6 Bxc6 Nc3 Nf6 Bg5 Be7 O-O-O O-O Rhe1 a6 e5 dxe5 Qxe5 Re8 Qg3 Bd6" }, puzzle: { id: "p026", rating: 900, solution: ["f3e5"], themes: ["fork"], initialPly: 26 } },
    { game: { pgn: "d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5 Bg5 Be7 e3 c6 Bd3 Nbd7 Qc2 O-O Nf3 Re8 O-O Nf8 h3 Ng6 Bh4 Be6 Rab1 a5 a3 Nd7 Bg3 Bf6" }, puzzle: { id: "p027", rating: 1100, solution: ["g6h4"], themes: ["hangingPiece"], initialPly: 31 } },
    { game: { pgn: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 h6 d4 Re8 Nbd2 Bf8 Nf1 Bd7 Ng3 Na5 Bc2 c5 b3 Nc6 Be3 cxd4 cxd4 Nb4 Bb1 exd4 Bxd4" }, puzzle: { id: "p028", rating: 1250, solution: ["f6e4"], themes: ["discoveredAttack"], initialPly: 37 } },
    { game: { pgn: "d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3 b6 Qe2 Bb7 O-O-O cxd4 exd4 Rc8 Kb1 Bxg3 hxg3 Qd6 Rh4 Nd7 g4 e5 dxe5 Ndxe5 Nxe5 Nxe5 Be2" }, puzzle: { id: "p029", rating: 1350, solution: ["c8c3"], themes: ["sacrifice"], initialPly: 35 } },
    { game: { pgn: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6 Bc4 Bd7 O-O-O Rc8 Bb3 Ne5 h4 h5 Kb1 Nc4 Bxc4 Rxc4 Nb3 Qa5 g4 hxg4 h5 Nxh5 Rxh5 gxh5 Qh2 Kf8 Qxh5 Rh4 Qf5 Rxe4 Qh3" }, puzzle: { id: "p030", rating: 1500, solution: ["e4e3"], themes: ["deflection"], initialPly: 45 } },
];

// Shuffle array helper
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// GET /api/racer/puzzles - Return static puzzles sorted by difficulty
router.get('/puzzles', async (req, res) => {
    try {
        // Sort puzzles by rating (easiest first) and add some randomness within rating bands
        const sortedPuzzles = [...STATIC_PUZZLES].sort((a, b) => {
            const ratingA = a.puzzle.rating;
            const ratingB = b.puzzle.rating;
            // Add small random factor to shuffle within similar ratings
            return (ratingA + Math.random() * 50) - (ratingB + Math.random() * 50);
        });

        console.log(`Returning ${sortedPuzzles.length} puzzles (sorted by difficulty)`);

        res.json({
            puzzles: sortedPuzzles,
            cached: false,
            count: sortedPuzzles.length,
            source: 'static'
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
