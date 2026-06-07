/**
 * Weekly Puzzles API — "Úloha týdne"
 * Zdroj = partie z článků. Scan běží na pozadí, kombinace se ukládají do DB;
 * dashboard čte z DB (okamžité). F2 = generátor článku.
 */

import express from 'express';
import { getStoredCandidates, startScan, getScanState } from '../services/weeklyPuzzlesService.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Uložené kombinace (rychlé, z DB)
router.get('/candidates', requireRole('ADMIN'), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit);
        const result = await getStoredCandidates({ limit: Number.isFinite(limit) ? limit : 60 });
        res.json(result);
    } catch (error) {
        console.error('[WeeklyPuzzles] Candidates error:', error);
        res.status(500).json({ error: 'Failed to fetch candidates' });
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

export default router;
