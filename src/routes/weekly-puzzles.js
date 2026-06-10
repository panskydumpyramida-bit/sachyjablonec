/**
 * Weekly Puzzles API — "Úloha týdne"
 * Zdroj = partie z článků. Scan běží na pozadí, kombinace se ukládají do DB;
 * dashboard čte z DB (okamžité). F2 = generátor článku.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { getStoredCandidates, startScan, getScanState, voteCandidate, getRatingInsights, dedupeStoredCandidates, getDailyPuzzle, generateWeeklyArticle, recordDailySolve, getDailyStreak, getDailySolvers, dailyDateKey } from '../services/weeklyPuzzlesService.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Volitelná auth: Bearer pokud je, jinak anonym (veřejný endpoint se streakem pro přihlášené)
function optionalUser(req) {
    try {
        const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
        if (!token) return null;
        const d = jwt.verify(token, process.env.JWT_SECRET);
        return d && d.id ? { id: d.id, username: d.username || null } : null;
    } catch { return null; }
}

// VEŘEJNÉ — Hádanka dne pro homepage modal (bez přihlášení)
router.get('/daily', async (req, res) => {
    try {
        const puzzle = await getDailyPuzzle(req.query.offset);
        if (!puzzle) return res.status(404).json({ error: 'Zatím žádná hádanka' });

        // streak + "dnes vyřešili" (jen pro dnešek; u historie není relevantní)
        const user = optionalUser(req);
        if (puzzle.offset === 0) {
            const extras = await getDailySolvers(puzzle.date);
            puzzle.solveCount = extras.solveCount;
            puzzle.solvers = extras.solvers;
        }
        if (user) {
            puzzle.streak = await getDailyStreak(user.id);
        }
        res.json(puzzle);
    } catch (error) {
        console.error('[WeeklyPuzzles] Daily error:', error);
        res.status(500).json({ error: 'Failed to fetch daily puzzle' });
    }
});

// VEŘEJNÉ — zaznamenat vyřešení (přihlášení → DB/streak; anonym → jen statistika dne nechodí)
router.post('/daily/solve', async (req, res) => {
    try {
        const user = optionalUser(req);
        const result = await recordDailySolve({
            userId: user?.id || null,
            username: user?.username || null,
            offset: req.body?.offset || 0,
        });
        res.json(result);
    } catch (error) {
        console.error('[WeeklyPuzzles] Solve error:', error);
        res.status(500).json({ error: 'Failed to record solve' });
    }
});

// Uložené kombinace (rychlé, z DB)
router.get('/candidates', requireRole('ADMIN'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit);
        const result = await getStoredCandidates({ limit: Number.isFinite(limit) ? limit : 60, userId: req.user?.id || null });
        res.json(result);
    } catch (error) {
        console.error('[WeeklyPuzzles] Candidates error:', error);
        res.status(500).json({ error: 'Failed to fetch candidates' });
    }
});

// Hlasování o kvalitě kandidáta (členové i admin)
router.post('/:id/vote', requireRole('MEMBER'), async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const value = parseInt(req.body?.value);
        if (!Number.isFinite(id) || !Number.isFinite(value)) return res.status(400).json({ error: 'Bad request' });
        const source = req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN' ? 'admin' : 'member';
        const result = await voteCandidate(id, req.user.id, value, source);
        res.json(result);
    } catch (error) {
        console.error('[WeeklyPuzzles] Vote error:', error);
        res.status(500).json({ error: 'Failed to vote' });
    }
});

// Rysy ohodnocených kandidátů — podklad pro učení (analýza dobré vs špatné)
router.get('/insights', requireRole('ADMIN'), async (req, res) => {
    try {
        res.json(await getRatingInsights());
    } catch (error) {
        console.error('[WeeklyPuzzles] Insights error:', error);
        res.status(500).json({ error: 'Failed to fetch insights' });
    }
});

// Spustí scan článkových partií na pozadí (inkrementálně jen nové, nebo rescanAll)
router.post('/scan', requireRole('ADMIN'), async (req, res) => {
    try {
        const rescanAll = req.body?.rescanAll === true;
        const result = await startScan({ rescanAll });
        res.json(result);
    } catch (error) {
        console.error('[WeeklyPuzzles] Scan error:', error);
        res.status(500).json({ error: 'Failed to start scan' });
    }
});

// Stav běžícího scanu (pro polling z dashboardu)
router.get('/scan-status', requireRole('ADMIN'), (req, res) => {
    res.json(getScanState());
});

// Sloučí rozkouskované kombinace / duplicity v uložených datech (hlasy zachová).
router.post('/dedupe', requireRole('ADMIN'), async (req, res) => {
    try {
        res.json(await dedupeStoredCandidates());
    } catch (error) {
        console.error('[WeeklyPuzzles] Dedupe error:', error);
        res.status(500).json({ error: 'Failed to dedupe' });
    }
});

// F2: z vybraných kandidátů (max 3) vytvoří Diagram záznamy + draft článku s diagram-book blokem.
router.post('/generate', requireRole('ADMIN'), async (req, res) => {
    try {
        const result = await generateWeeklyArticle(req.body.candidateIds, req.user?.id);
        res.json(result);
    } catch (error) {
        console.error('[WeeklyPuzzles] Generate error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate article' });
    }
});

export default router;
