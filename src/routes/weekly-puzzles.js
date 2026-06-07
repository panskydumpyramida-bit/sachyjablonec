/**
 * Weekly Puzzles API — "Úloha týdne"
 * F1: dashboard kandidátů (read-only). Generátor článku = F2.
 */

import express from 'express';
import { getPuzzleCandidates } from '../services/weeklyPuzzlesService.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Navržené pozice (kombinace) na úlohu — skórované, s uniqueness gate
router.get('/candidates', requireRole('ADMIN'), async (req, res) => {
    try {
        const threshold = parseFloat(req.query.threshold);
        const limit = parseInt(req.query.limit);
        const result = await getPuzzleCandidates({
            threshold: Number.isFinite(threshold) ? threshold : 10,
            limit: Number.isFinite(limit) ? limit : 30,
        });
        res.json(result);
    } catch (error) {
        console.error('[WeeklyPuzzles] Candidates error:', error);
        res.status(500).json({ error: 'Failed to fetch puzzle candidates' });
    }
});

export default router;
