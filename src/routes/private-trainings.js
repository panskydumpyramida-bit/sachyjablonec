import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';

const prisma = new PrismaClient();
const router = express.Router();
const TRAINERS = new Set(['Tsantsala', 'Brehmová']);

router.use(authMiddleware, requireAdmin);

function cleanSession(body) {
    const trainer = String(body?.trainer || '').trim();
    const trainingDate = new Date(body?.trainingDate);
    const hours = Number(body?.hours);
    const hourlyRate = Number(body?.hourlyRate ?? 100);
    if (!TRAINERS.has(trainer) || Number.isNaN(trainingDate.getTime()) || !Number.isFinite(hours) || hours <= 0 || hours > 12 || !Number.isInteger(hourlyRate) || hourlyRate < 0 || hourlyRate > 10000) return null;
    const attendances = Array.isArray(body?.attendances) ? body.attendances.map(item => ({
        playerName: String(item?.playerName || '').trim().slice(0, 120),
        payerName: String(item?.payerName || '').trim().slice(0, 120),
    })).filter(item => item.playerName && item.payerName) : [];
    return { trainer, trainingDate, hours, hourlyRate, note: String(body?.note || '').trim().slice(0, 500) || null, attendances };
}

router.get('/', async (req, res) => {
    try {
        const trainings = await prisma.privateTraining.findMany({ include: { attendances: true }, orderBy: { trainingDate: 'desc' } });
        res.json(trainings);
    } catch (error) {
        console.error('[private-trainings] list:', error);
        res.status(500).json({ error: 'Nepodařilo se načíst soukromé tréninky' });
    }
});

router.post('/', async (req, res) => {
    const data = cleanSession(req.body);
    if (!data) return res.status(400).json({ error: 'Zkontrolujte trenéra, datum, počet hodin a sazbu.' });
    try {
        const training = await prisma.privateTraining.create({ data: { ...data, attendances: { create: data.attendances } }, include: { attendances: true } });
        res.status(201).json(training);
    } catch (error) {
        console.error('[private-trainings] create:', error);
        res.status(500).json({ error: 'Trénink se nepodařilo uložit' });
    }
});

router.put('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const data = cleanSession(req.body);
    if (!Number.isInteger(id) || !data) return res.status(400).json({ error: 'Neplatná data tréninku' });
    try {
        const training = await prisma.privateTraining.update({
            where: { id },
            data: { trainer: data.trainer, trainingDate: data.trainingDate, hours: data.hours, hourlyRate: data.hourlyRate, note: data.note, attendances: { deleteMany: {}, create: data.attendances } },
            include: { attendances: true },
        });
        res.json(training);
    } catch {
        res.status(404).json({ error: 'Trénink nenalezen' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await prisma.privateTraining.delete({ where: { id: Number(req.params.id) } });
        res.json({ ok: true });
    } catch {
        res.status(404).json({ error: 'Trénink nenalezen' });
    }
});

router.post('/import-2025-2026', async (req, res) => {
    const existing = await prisma.privateTraining.count();
    if (existing) return res.status(409).json({ error: 'Import je určen jen pro prázdnou evidenci.' });
    const sessions = [
        ['2025-09-29', 'Tsantsala', 2], ['2025-10-06', 'Tsantsala', 2], ['2025-10-13', 'Tsantsala', 2], ['2025-10-27', 'Tsantsala', 2], ['2025-11-10', 'Tsantsala', 2], ['2025-11-24', 'Tsantsala', 2], ['2025-12-08', 'Tsantsala', 2], ['2025-12-15', 'Tsantsala', 2],
        ['2026-01-19', 'Tsantsala', 2], ['2026-01-26', 'Tsantsala', 2], ['2026-02-02', 'Tsantsala', 2], ['2026-02-09', 'Tsantsala', 2], ['2026-03-02', 'Tsantsala', 2], ['2026-03-09', 'Tsantsala', 2], ['2026-03-16', 'Tsantsala', 2], ['2026-03-23', 'Tsantsala', 2], ['2026-03-30', 'Tsantsala', 2],
        ['2026-04-06', 'Tsantsala', 2], ['2026-04-13', 'Tsantsala', 2], ['2026-04-20', 'Tsantsala', 2], ['2026-04-27', 'Tsantsala', 2], ['2026-05-04', 'Tsantsala', 2], ['2026-05-18', 'Tsantsala', 1], ['2026-05-25', 'Tsantsala', 2], ['2026-06-08', 'Tsantsala', 2], ['2026-06-22', 'Tsantsala', 2],
        ['2026-03-09', 'Brehmová', 1], ['2026-03-30', 'Brehmová', 1], ['2026-04-06', 'Brehmová', 1], ['2026-04-13', 'Brehmová', 1], ['2026-04-20', 'Brehmová', 1], ['2026-05-04', 'Brehmová', 1], ['2026-05-25', 'Brehmová', 1], ['2026-06-08', 'Brehmová', 1],
    ].map(([date, trainer, hours]) => ({ trainingDate: new Date(`${date}T12:00:00`), trainer, hours, hourlyRate: 100, note: 'Import z výkazů 2025/2026' }));
    await prisma.privateTraining.createMany({ data: sessions });
    res.status(201).json({ imported: sessions.length });
});

export default router;
