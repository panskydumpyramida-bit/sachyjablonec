/**
 * Univerzální ohlášení přestupu v šachu.
 * Flow: člen vygeneruje odkaz → hráč vyplní + podepíše → PDF s razítkem Bižuterie
 * (mail předsedovi) → mateřský oddíl vytiskne/orazítkuje → hráč (nebo oddíl) nahraje
 * sken zpět stejným odkazem → mail s finálním skenem → předseda přepošle na chess.cz.
 */

import express from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireMember } from '../middleware/rbac.js';
import { generateTransferPdf } from '../services/transferPdf.js';
import { sendEmail } from '../utils/mailer.js';

const prisma = new PrismaClient();
const router = express.Router();

const CHAIRMAN_EMAIL = process.env.REGISTRATION_EMAIL || 'info@sachyjablonec.cz';
const FRONTEND = (process.env.FRONTEND_URL || 'https://www.sachyjablonec.cz').replace(/\/$/, '');
const MAX_SCAN_B64 = 16 * 1024 * 1024; // ~12 MB souboru

// ---- ČLENSKÁ ČÁST ----

router.post('/', authMiddleware, requireMember, async (req, res) => {
    try {
        const token = crypto.randomBytes(16).toString('hex');
        const t = await prisma.memberTransfer.create({
            data: { token, note: (req.body?.note || '').slice(0, 200) || null, createdBy: req.user.id },
        });
        res.json({ id: t.id, token, url: `${FRONTEND}/prestup.html?t=${token}` });
    } catch (e) {
        console.error('[Transfers] create error:', e);
        res.status(500).json({ error: 'Nepodařilo se vytvořit přestup' });
    }
});

router.get('/', authMiddleware, requireMember, async (req, res) => {
    try {
        const list = await prisma.memberTransfer.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: { id: true, token: true, status: true, note: true, data: true, createdAt: true, filledAt: true, completedAt: true },
        });
        res.json(list.map(t => ({
            ...t,
            url: `${FRONTEND}/prestup.html?t=${t.token}`,
            applicant: t.data ? `${t.data.lastName || ''} ${t.data.firstName || ''}`.trim() : null,
            fromClub: t.data?.fromClub || null,
            data: undefined,
        })));
    } catch (e) {
        console.error('[Transfers] list error:', e);
        res.status(500).json({ error: 'Nepodařilo se načíst přestupy' });
    }
});

router.get('/:id(\\d+)/pdf', authMiddleware, requireMember, async (req, res) => {
    const t = await prisma.memberTransfer.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!t || !t.pdf) return res.status(404).json({ error: 'PDF nenalezeno' });
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="prestup-${t.id}.pdf"`);
    res.send(Buffer.from(t.pdf));
});

router.get('/:id(\\d+)/scan', authMiddleware, requireMember, async (req, res) => {
    const t = await prisma.memberTransfer.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!t || !t.scan) return res.status(404).json({ error: 'Sken nenalezen' });
    const ext = (t.scanMime || '').includes('pdf') ? 'pdf' : 'jpg';
    res.set('Content-Type', t.scanMime || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="prestup-${t.id}-potvrzeny.${ext}"`);
    res.send(Buffer.from(t.scan));
});

router.delete('/:id(\\d+)', authMiddleware, requireMember, async (req, res) => {
    try {
        await prisma.memberTransfer.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Nepodařilo se smazat' });
    }
});

// Poslat odkaz hráči e-mailem
router.post('/:id(\\d+)/send', authMiddleware, requireMember, async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Neplatný e-mail' });
        const t = await prisma.memberTransfer.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!t) return res.status(404).json({ error: 'Přestup nenalezen' });
        const url = `${FRONTEND}/prestup.html?t=${t.token}`;
        const sent = await sendEmail(
            email,
            'Přestup do šachového oddílu TJ Bižuterie Jablonec',
            `<p>Dobrý den,</p>
             <p>posíláme odkaz na online ohlášení přestupu do oddílu
             <strong>TJ Bižuterie Jablonec nad Nisou</strong>. Vyplníte ho za pár minut,
             podepíšete přímo na obrazovce a dál vás povede krok za krokem:</p>
             <p style="margin:1.5em 0;"><a href="${url}" style="background:#d4af37;color:#1a1a1a;font-weight:bold;padding:12px 24px;border-radius:8px;text-decoration:none;">Vyplnit ohlášení přestupu</a></p>
             <p>Nebo použijte odkaz: <a href="${url}">${url}</a></p>
             <p>Na viděnou u šachovnice!<br>Šachový oddíl TJ Bižuterie Jablonec</p>`
        );
        if (!sent) return res.status(502).json({ error: 'E-mail se nepodařilo odeslat (mailer není nakonfigurován)' });
        res.json({ ok: true });
    } catch (e) {
        console.error('[Transfers] send error:', e);
        res.status(500).json({ error: 'Odeslání se nepodařilo' });
    }
});

// ---- VEŘEJNÁ ČÁST (token) ----

// Stav odkazu → frontend zvolí fázi
router.get('/form/:token', async (req, res) => {
    const t = await prisma.memberTransfer.findUnique({ where: { token: req.params.token } });
    if (!t) return res.status(404).json({ error: 'Neplatný odkaz' });
    res.json({
        status: t.status,
        applicant: t.data ? `${t.data.firstName || ''} ${t.data.lastName || ''}`.trim() : null,
    });
});

// Fáze 1: hráč vyplní a podepíše → PDF + mail
router.post('/form/:token', async (req, res) => {
    try {
        const t = await prisma.memberTransfer.findUnique({ where: { token: req.params.token } });
        if (!t) return res.status(404).json({ error: 'Neplatný odkaz' });
        if (t.status !== 'pending') return res.status(410).json({ error: 'Formulář už byl vyplněn' });

        const b = req.body || {};
        for (const f of ['lastName', 'firstName', 'fromClub']) {
            if (!b[f] || !String(b[f]).trim()) return res.status(400).json({ error: 'Chybí povinná pole' });
        }
        if (!b.birthNumber && !b.birthDate) return res.status(400).json({ error: 'Vyplňte rodné číslo (u cizinců datum narození)' });

        const clean = (v, max = 120) => String(v ?? '').trim().slice(0, max);
        const data = {
            lastName: clean(b.lastName), firstName: clean(b.firstName), title: clean(b.title, 30),
            birthNumber: clean(b.birthNumber, 20), birthDate: clean(b.birthDate, 20),
            lokId: clean(b.lokId, 20), elo: clean(b.elo, 10),
            fromClub: clean(b.fromClub), fromClubCode: clean(b.fromClubCode, 20),
            email: clean(b.email, 100), phone: clean(b.phone, 30),
            date: new Date().toLocaleDateString('cs-CZ'),
        };
        let signaturePng = null;
        if (typeof b.signaturePng === 'string' && b.signaturePng.startsWith('data:image/png;base64,') && b.signaturePng.length < 300000) {
            signaturePng = b.signaturePng;
        }

        const pdf = await generateTransferPdf({ ...data, signaturePng });
        await prisma.memberTransfer.update({
            where: { id: t.id },
            data: { status: 'filled', data, pdf, filledAt: new Date() },
        });

        const fullName = `${data.firstName} ${data.lastName}`.trim();
        await sendEmail(
            CHAIRMAN_EMAIL,
            `Přestup — ${fullName} vyplnil ohlášení (čeká na razítko ${data.fromClub})`,
            `<p>Dobrý den,</p>
             <p><strong>${fullName}</strong> (z oddílu ${data.fromClub}) vyplnil online ohlášení přestupu do Bižuterie.</p>
             <p>PDF s naším razítkem a podpisem hráče je v příloze. Teď je na řadě mateřský oddíl —
             hráč má v odkazu instrukce: vytisknout, nechat orazítkovat a nahrát sken zpět.
             Jakmile sken dorazí, přijde vám další mail.</p>`,
            [{ filename: `prestup-${data.lastName}.pdf`, content: pdf }]
        );

        res.json({ ok: true });
    } catch (e) {
        console.error('[Transfers] fill error:', e);
        res.status(500).json({ error: 'Odeslání se nepodařilo, zkuste to prosím znovu' });
    }
});

// Fáze 2: stáhnout PDF k tisku (token = tajemství, veřejné s tokenem)
router.get('/form/:token/pdf', async (req, res) => {
    const t = await prisma.memberTransfer.findUnique({ where: { token: req.params.token } });
    if (!t || !t.pdf) return res.status(404).json({ error: 'PDF nenalezeno' });
    const name = t.data?.lastName ? t.data.lastName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]/g, '') : t.id;
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="prestup-${name}.pdf"`);
    res.send(Buffer.from(t.pdf));
});

// Fáze 2: nahrání skenu potvrzeného mateřským oddílem
router.post('/form/:token/scan', async (req, res) => {
    try {
        const t = await prisma.memberTransfer.findUnique({ where: { token: req.params.token } });
        if (!t) return res.status(404).json({ error: 'Neplatný odkaz' });
        if (t.status === 'pending') return res.status(400).json({ error: 'Nejdřív vyplňte formulář' });
        if (t.status === 'completed') return res.status(410).json({ error: 'Sken už byl nahrán' });

        const b = req.body || {};
        const m = /^data:(application\/pdf|image\/(jpeg|png|webp|heic));base64,(.+)$/.exec(b.file || '');
        if (!m) return res.status(400).json({ error: 'Nepodporovaný soubor — nahrajte PDF nebo fotku (JPG/PNG)' });
        if (b.file.length > MAX_SCAN_B64) return res.status(413).json({ error: 'Soubor je moc velký (max ~12 MB)' });

        const scan = Buffer.from(m[3], 'base64');
        const scanMime = m[1];

        await prisma.memberTransfer.update({
            where: { id: t.id },
            data: { status: 'completed', scan, scanMime, completedAt: new Date() },
        });

        const fullName = t.data ? `${t.data.firstName} ${t.data.lastName}`.trim() : `#${t.id}`;
        const ext = scanMime.includes('pdf') ? 'pdf' : 'jpg';
        await sendEmail(
            CHAIRMAN_EMAIL,
            `Přestup — ${fullName}: potvrzené ohlášení od mateřského oddílu ✅`,
            `<p>Dobrý den,</p>
             <p>k přestupu <strong>${fullName}</strong> dorazil sken ohlášení potvrzený mateřským oddílem
             (${t.data?.fromClub || '—'}) — je v příloze.</p>
             <p>Po kontrole ho přepošlete na <a href="mailto:registrace@chess.cz">registrace@chess.cz</a>.
             Dokumenty jsou i v členské sekci → Registrace a přestupy.</p>`,
            [{ filename: `prestup-${(t.data?.lastName || t.id)}-potvrzeny.${ext}`, content: scan }]
        );

        res.json({ ok: true });
    } catch (e) {
        console.error('[Transfers] scan error:', e);
        res.status(500).json({ error: 'Nahrání se nepodařilo, zkuste to prosím znovu' });
    }
});

export default router;
