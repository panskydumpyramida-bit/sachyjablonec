/**
 * Upozornění na nový los (Web Push).
 * Rodič se přihlásí jedním klepnutím — neukládáme e-mail ani telefon,
 * jen anonymní klíč prohlížeče, který jde kdykoliv odhlásit.
 */

import webpush from 'web-push';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let configured = false;

function ensureConfigured() {
    if (configured) return true;
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) return false;
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:info@sachyjablonec.cz', pub, priv);
    configured = true;
    return true;
}

export function publicKey() {
    return process.env.VAPID_PUBLIC_KEY || null;
}

export async function subscribe(campCode, sub, label) {
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new Error('Neplatné přihlášení k odběru');
    return prisma.pushSubscriber.upsert({
        where: { endpoint: sub.endpoint },
        update: { campCode, p256dh: sub.keys.p256dh, auth: sub.keys.auth, label: label || null, failCount: 0 },
        create: { campCode, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, label: label || null },
    });
}

export async function unsubscribe(endpoint) {
    await prisma.pushSubscriber.deleteMany({ where: { endpoint } });
}

export async function countSubscribers(campCode) {
    return prisma.pushSubscriber.count({ where: { campCode } });
}

/** Rozešle upozornění; mrtvá přihlášení (410/404) rovnou uklidí. */
export async function notify(campCode, { title, body, url }) {
    if (!ensureConfigured()) return { sent: 0, skipped: 'VAPID není nastaveno' };
    const subs = await prisma.pushSubscriber.findMany({ where: { campCode } });
    const payload = JSON.stringify({ title, body, url: url || '/pardubice' });
    let sent = 0, removed = 0;

    await Promise.all(subs.map(async (s) => {
        try {
            await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload
            );
            sent++;
        } catch (e) {
            if (e.statusCode === 410 || e.statusCode === 404) {
                await prisma.pushSubscriber.delete({ where: { id: s.id } }).catch(() => {});
                removed++;
            } else {
                await prisma.pushSubscriber.update({ where: { id: s.id }, data: { failCount: { increment: 1 } } }).catch(() => {});
            }
        }
    }));
    return { sent, removed, total: subs.length };
}
