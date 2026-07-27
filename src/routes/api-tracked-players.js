/**
 * Sledovaní hráči (watchlist) pro scraping chess-results.com.
 *
 * Watchlist doplňuje hledání podle klubu — chceme ve výsledcích i lidi, kteří
 * jsou registrovaní jinde (typicky trenér oddílu hrající za jiný klub).
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireMember } from '../middleware/rbac.js';

const prisma = new PrismaClient();
const router = express.Router();

router.use(authMiddleware, requireMember);

const text = (value, max) => {
    const s = String(value ?? '').trim();
    return s ? s.slice(0, max) : null;
};

/**
 * @returns {{fullName:string, sscrId:string|null, club:string|null, note:string|null, active:boolean}|null}
 */
function cleanPlayer(body) {
    const fullName = text(body?.fullName, 120);
    if (!fullName || fullName.length < 3) return null;

    const sscrRaw = text(body?.sscrId, 12);
    if (sscrRaw && !/^\d{1,12}$/.test(sscrRaw)) return null;

    return {
        fullName,
        sscrId: sscrRaw,
        club: text(body?.club, 160),
        note: text(body?.note, 500),
        active: body?.active === undefined ? true : Boolean(body.active)
    };
}

/** GET /api/tracked-players — vrací aktivní i neaktivní. */
router.get('/', async (req, res) => {
    try {
        const players = await prisma.trackedPlayer.findMany({
            orderBy: [{ active: 'desc' }, { fullName: 'asc' }]
        });
        res.json(players);
    } catch (error) {
        console.error('[tracked-players] list:', error);
        res.status(500).json({ error: 'Nepodařilo se načíst sledované hráče' });
    }
});

/** POST /api/tracked-players */
router.post('/', async (req, res) => {
    const data = cleanPlayer(req.body);
    if (!data) return res.status(400).json({ error: 'Zadejte jméno ve tvaru "Příjmení, Jméno"; ident-číslo smí být jen číslice.' });

    try {
        const player = await prisma.trackedPlayer.create({
            data: { ...data, createdBy: req.user?.id ?? null }
        });
        res.status(201).json(player);
    } catch (error) {
        console.error('[tracked-players] create:', error);
        res.status(500).json({ error: 'Hráče se nepodařilo uložit' });
    }
});

/** PUT /api/tracked-players/:id */
router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const data = cleanPlayer(req.body);
    if (!Number.isInteger(id) || !data) return res.status(400).json({ error: 'Neplatná data hráče' });

    try {
        const player = await prisma.trackedPlayer.update({ where: { id }, data });
        res.json(player);
    } catch {
        res.status(404).json({ error: 'Sledovaný hráč nenalezen' });
    }
});

/** DELETE /api/tracked-players/:id */
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Neplatné ID' });

    try {
        await prisma.trackedPlayer.delete({ where: { id } });
        res.status(204).end();
    } catch {
        res.status(404).json({ error: 'Sledovaný hráč nenalezen' });
    }
});

export default router;
