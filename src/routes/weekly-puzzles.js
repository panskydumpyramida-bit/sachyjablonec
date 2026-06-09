/**
 * Weekly Puzzles API — "Úloha týdne"
 * Zdroj = partie z článků. Scan běží na pozadí, kombinace se ukládají do DB;
 * dashboard čte z DB (okamžité). F2 = generátor článku.
 */

import express from 'express';
import { getStoredCandidates, startScan, getScanState, voteCandidate, getRatingInsights, dedupeStoredCandidates, getDailyPuzzle } from '../services/weeklyPuzzlesService.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// VEŘEJNÉ — Hádanka dne pro homepage modal (bez přihlášení)
router.get('/daily', async (req, res) => {
    try {
        const puzzle = await getDailyPuzzle(req.query.offset);
        if (!puzzle) return res.status(404).json({ error: 'Zatím žádná hádanka' });
        res.json(puzzle);
    } catch (error) {
        console.error('[WeeklyPuzzles] Daily error:', error);
        res.status(500).json({ error: 'Failed to fetch daily puzzle' });
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

export default router;
