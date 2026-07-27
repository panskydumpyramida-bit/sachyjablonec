/**
 * Veřejné API dashboardu soustředění (stránka /pardubice).
 * Data se servírují ze snapshotu v DB — chess-results se dotazujeme nejvýš
 * jednou za pár minut, bez ohledu na to, kolik rodičů má stránku otevřenou.
 */

import express from 'express';
import { getSnapshot, CAMP_CODE, buildWaText } from '../services/czechOpenService.js';
import { publicKey, subscribe, unsubscribe, countSubscribers } from '../services/pushService.js';
import { sendWhatsapp, buildWaLink, isConfigured as isWaConfigured } from '../services/whatsappService.js';
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

// Odběr upozornění na nový los — bez e-mailu, jen anonymní klíč prohlížeče
router.get('/push/key', async (req, res) => {
    const key = publicKey();
    if (!key) return res.status(503).json({ error: 'Upozornění zatím nejsou nastavená' });
    res.json({ key, subscribers: await countSubscribers(CAMP_CODE) });
});

router.post('/push/subscribe', async (req, res) => {
    try {
        await subscribe(CAMP_CODE, req.body?.subscription, req.body?.label);
        res.json({ ok: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.post('/push/unsubscribe', async (req, res) => {
    await unsubscribe(req.body?.endpoint || '');
    res.json({ ok: true });
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

// Zkušební zpráva — jediný způsob, jak si ověřit, že brána opravdu doručuje
router.post('/pardubice/test-whatsapp', authMiddleware, requireAdmin, async (req, res) => {
    const r = await sendWhatsapp('Test z webu Bižuterie — když tohle vidíš, upozornění na los fungují.');
    res.json({ ok: !!r.sent, ...r });
});

/**
 * Odkaz pro ruční odeslání losu, když brána nefunguje.
 * Za autorizací, protože obsahuje telefonní číslo — do veřejného frontendu nepatří.
 */
router.get('/pardubice/wa-link', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const data = await getSnapshot();
        const t = data.tournaments.find(x => x.roundState === 'fresh' && (x.pairings || []).length)
            || data.tournaments.find(x => (x.pairings || []).length);
        if (!t) return res.status(404).json({ error: 'Žádný los k odeslání' });
        const url = buildWaLink(buildWaText(t));
        if (!url) return res.status(503).json({ error: 'Chybí CALLMEBOT_PHONE' });
        res.json({ url, tournament: t.code, round: t.currentRound, gateway: isWaConfigured() });
    } catch (e) {
        res.status(503).json({ error: e.message });
    }
});

export default router;
