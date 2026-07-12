/**
 * Online registrace členů ŠSČR.
 * Flow: člen vygeneruje odkaz (token) → žadatel vyplní veřejný formulář →
 * server vygeneruje PDF žádosti (razítko + podpis oddílu, podpis hráče) →
 * pošle na info@sachyjablonec.cz → předseda zkontroluje a přepošle na registrace@chess.cz.
 */

import express from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireMember } from '../middleware/rbac.js';
import { generateRegistrationPdf } from '../services/registrationPdf.js';
import { sendEmail } from '../utils/mailer.js';

const prisma = new PrismaClient();
const router = express.Router();

const CHAIRMAN_EMAIL = process.env.REGISTRATION_EMAIL || 'info@sachyjablonec.cz';
const FRONTEND = (process.env.FRONTEND_URL || 'https://www.sachyjablonec.cz').replace(/\/$/, '');

// ---- ČLENSKÁ ČÁST ----

// Vytvořit novou žádost → vrátí odkaz pro žadatele
router.post('/', authMiddleware, requireMember, async (req, res) => {
    try {
        const token = crypto.randomBytes(16).toString('hex');
        const firstName = (req.body?.firstName || '').trim().slice(0, 60);
        const lastName = (req.body?.lastName || '').trim().slice(0, 60);
        const note = (req.body?.note || '').trim().slice(0, 200) || [lastName, firstName].filter(Boolean).join(' ') || null;
        const reg = await prisma.memberRegistration.create({
            data: {
                token, note, createdBy: req.user.id,
                data: (firstName || lastName) ? { prefill: { firstName, lastName } } : undefined,
            },
        });
        res.json({ id: reg.id, token, url: `${FRONTEND}/registrace.html?t=${token}` });
    } catch (e) {
        console.error('[Registrations] create error:', e);
        res.status(500).json({ error: 'Nepodařilo se vytvořit žádost' });
    }
});

// Seznam žádostí
router.get('/', authMiddleware, requireMember, async (req, res) => {
    try {
        const regs = await prisma.memberRegistration.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: { id: true, token: true, status: true, note: true, data: true, createdAt: true, submittedAt: true },
        });
        res.json(regs.map(r => ({
            ...r,
            url: `${FRONTEND}/registrace.html?t=${r.token}`,
            applicant: r.data ? `${(r.data.lastName || r.data.prefill?.lastName || '')} ${(r.data.firstName || r.data.prefill?.firstName || '')}`.trim() || null : null,
            data: undefined,
        })));
    } catch (e) {
        console.error('[Registrations] list error:', e);
        res.status(500).json({ error: 'Nepodařilo se načíst žádosti' });
    }
});

// Stáhnout PDF vyplněné žádosti
router.get('/:id/pdf', authMiddleware, requireMember, async (req, res) => {
    try {
        const reg = await prisma.memberRegistration.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!reg || !reg.pdf) return res.status(404).json({ error: 'PDF nenalezeno' });
        const name = reg.data ? `zadost-sscr-${(reg.data.lastName || 'clen').toLowerCase()}` : `zadost-sscr-${reg.id}`;
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `attachment; filename="${name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]/g, '')}.pdf"`);
        res.send(Buffer.from(reg.pdf));
    } catch (e) {
        console.error('[Registrations] pdf error:', e);
        res.status(500).json({ error: 'Chyba při načítání PDF' });
    }
});

// Smazat žádost (nevyužitý odkaz / úklid)
router.delete('/:id', authMiddleware, requireMember, async (req, res) => {
    try {
        await prisma.memberRegistration.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Nepodařilo se smazat' });
    }
});

// Poslat registrační odkaz žadateli e-mailem
router.post('/:id(\\d+)/send', authMiddleware, requireMember, async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Neplatný e-mail' });
        const reg = await prisma.memberRegistration.findUnique({ where: { id: parseInt(req.params.id) } });
        if (!reg) return res.status(404).json({ error: 'Žádost nenalezena' });
        if (reg.status === 'submitted') return res.status(410).json({ error: 'Žádost už byla vyplněna' });
        const url = `${FRONTEND}/registrace.html?t=${reg.token}`;
        const who = reg.data?.prefill ? `${reg.data.prefill.firstName} ${reg.data.prefill.lastName}`.trim() : '';
        const sent = await sendEmail(
            email,
            'Registrace do šachového oddílu TJ Bižuterie Jablonec',
            `<p>Dobrý den${who ? ' ' + who.split(' ')[0] : ''},</p>
             <p>zveme vás k registraci do Šachového svazu ČR pod oddílem
             <strong>TJ Bižuterie Jablonec nad Nisou</strong>. Žádost vyplníte online — zabere to pár minut
             a podepíšete se přímo na obrazovce:</p>
             <p style="margin:1.5em 0;"><a href="${url}" style="background:#d4af37;color:#1a1a1a;font-weight:bold;padding:12px 24px;border-radius:8px;text-decoration:none;">Vyplnit žádost o členství</a></p>
             <p>Nebo použijte odkaz: <a href="${url}">${url}</a></p>
             <p>Na viděnou u šachovnice!<br>Šachový oddíl TJ Bižuterie Jablonec</p>`
        );
        if (!sent) return res.status(502).json({ error: 'E-mail se nepodařilo odeslat (mailer není nakonfigurován)' });
        res.json({ ok: true });
    } catch (e) {
        console.error('[Registrations] send error:', e);
        res.status(500).json({ error: 'Odeslání se nepodařilo' });
    }
});

// ---- VEŘEJNÁ ČÁST (žadatel s tokenem) ----

// Ověření platnosti odkazu
router.get('/form/:token', async (req, res) => {
    try {
        const reg = await prisma.memberRegistration.findUnique({ where: { token: req.params.token } });
        if (!reg) return res.status(404).json({ error: 'Neplatný odkaz' });
        if (reg.status === 'submitted') return res.status(410).json({ error: 'Tato žádost už byla odeslána' });
        res.json({ ok: true, prefill: reg.data?.prefill || null });
    } catch (e) {
        res.status(500).json({ error: 'Chyba serveru' });
    }
});

// Odeslání vyplněného formuláře
router.post('/form/:token', async (req, res) => {
    try {
        const reg = await prisma.memberRegistration.findUnique({ where: { token: req.params.token } });
        if (!reg) return res.status(404).json({ error: 'Neplatný odkaz' });
        if (reg.status === 'submitted') return res.status(410).json({ error: 'Tato žádost už byla odeslána' });

        const b = req.body || {};
        const required = ['lastName', 'firstName', 'street', 'houseNumber', 'city', 'zip'];
        for (const f of required) {
            if (!b[f] || !String(b[f]).trim()) return res.status(400).json({ error: 'Chybí povinná pole' });
        }
        if (!b.birthNumber && !b.birthDate) {
            return res.status(400).json({ error: 'Vyplňte rodné číslo (nebo datum narození u cizinců)' });
        }
        if (!b.agreeStatutes) return res.status(400).json({ error: 'Je nutný souhlas se stanovami ŠSČR' });

        const clean = (v, max = 120) => String(v ?? '').trim().slice(0, max);
        const data = {
            lastName: clean(b.lastName), firstName: clean(b.firstName), middleName: clean(b.middleName),
            birthNumber: clean(b.birthNumber, 20), birthDate: clean(b.birthDate, 20), title: clean(b.title, 30),
            street: clean(b.street), houseNumber: clean(b.houseNumber, 20), city: clean(b.city),
            cityPart: clean(b.cityPart), zip: clean(b.zip, 10),
            birthCountry: clean(b.birthCountry, 60), citizenship: clean(b.citizenship, 60),
            phone: clean(b.phone, 30), email: clean(b.email, 100),
            registerThisYear: !!b.registerThisYear,
            date: new Date().toLocaleDateString('cs-CZ'),
        };

        // podpis: PNG data URL z canvasu (max ~200 kB)
        let signaturePng = null;
        if (typeof b.signaturePng === 'string' && b.signaturePng.startsWith('data:image/png;base64,') && b.signaturePng.length < 300000) {
            signaturePng = b.signaturePng;
        }

        const pdf = await generateRegistrationPdf({ ...data, signaturePng });

        await prisma.memberRegistration.update({
            where: { id: reg.id },
            data: { status: 'submitted', data, pdf, submittedAt: new Date() },
        });

        // mail předsedovi s PDF přílohou
        const fullName = `${data.firstName} ${data.lastName}`.trim();
        await sendEmail(
            CHAIRMAN_EMAIL,
            `Nová žádost o registraci ŠSČR — ${fullName}`,
            `<p>Dobrý den,</p>
             <p>přes web přišla nová vyplněná žádost o členství v ŠSČR:</p>
             <ul>
               <li><strong>${fullName}</strong>${data.birthNumber ? ` · RČ ${data.birthNumber}` : ''}${data.birthDate ? ` · nar. ${data.birthDate}` : ''}</li>
               <li>${data.street} ${data.houseNumber}, ${data.city} ${data.zip}</li>
               <li>${data.email || 'bez e-mailu'} · ${data.phone || 'bez telefonu'}</li>
               <li>Registrovat pro aktuální rok: <strong>${data.registerThisYear ? 'ANO' : 'ne'}</strong></li>
             </ul>
             <p>PDF žádosti s razítkem je v příloze — po kontrole ji přepošlete na
             <a href="mailto:registrace@chess.cz">registrace@chess.cz</a>.</p>
             <p>Žádost je i v členské sekci → Registrace členů.</p>`,
            [{ filename: `zadost-sscr-${data.lastName}.pdf`, content: pdf }]
        );

        res.json({ ok: true });
    } catch (e) {
        console.error('[Registrations] submit error:', e);
        res.status(500).json({ error: 'Odeslání se nepodařilo, zkuste to prosím znovu' });
    }
});

export default router;
