/**
 * Veřejné API dashboardu soustředění (stránka /pardubice).
 * Data se servírují ze snapshotu v DB — chess-results se dotazujeme nejvýš
 * jednou za pár minut, bez ohledu na to, kolik rodičů má stránku otevřenou.
 */

import express from 'express';
import { getSnapshot, CAMP_CODE } from '../services/czechOpenService.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';

const router = express.Router();

router.get('/pardubice', async (req, res) => {
    try {
        const data = await getSnapshot();
        res.set('Cache-Control', 'public, max-age=60, s-maxage=180');
        res.json(data);
    } catch (e) {
        console.error('[Camp] snapshot error:', e);
        res.status(503).json({ error: 'Data soustředění se nepodařilo načíst' });
    }
});

// Ruční obnovení (admin) — když je potřeba mít los hned
router.post('/pardubice/refresh', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const data = await getSnapshot({ force: true });
        res.json({ ok: true, generatedAt: data.generatedAt, campCode: CAMP_CODE });
    } catch (e) {
        res.status(503).json({ error: e.message });
    }
});

export default router;
