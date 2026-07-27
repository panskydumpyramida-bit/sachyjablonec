/**
 * Odeslání upozornění na WhatsApp jednomu člověku, který ho přepošle do skupiny.
 *
 * WhatsApp API neumí psát do skupin, proto tahle oklika. Kanál je čistě PŘIDANÝ —
 * web-push (pushService.js) běží dál nezávisle, takže výpadek téhle brány nikoho
 * o upozornění nepřipraví.
 *
 * Brána je CallMeBot — neoficiální služba třetí strany. Zvolená proto, že oficiální
 * Meta Cloud API vyžaduje ověření firmy a schválenou šablonu (týdny) a na klubová
 * oznámení uvaluje limit ~2 zprávy za 24 h. Až to přestane stačit, vymění se
 * provider — proto to volání sedí za `sendWhatsapp()`, ne rozsypané po kódu.
 *
 * Nic z toho nikdy nevyhazuje výjimku: když chybí konfigurace nebo brána spadne,
 * vrátí se { sent: false } a jede se dál.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TIMEOUT_MS = 10_000;
const CHUNK_CHARS = 700;     // text jde v query stringu, dlouhé URL brána utne
const CHUNK_PAUSE_MS = 3000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Číslo do logu, ať v Railway logu nesvítí celé. */
function maskPhone(p) {
    const s = String(p || '').replace(/\s/g, '');
    return s.length < 6 ? '***' : `${s.slice(0, 7)}***${s.slice(-3)}`;
}

export function isConfigured() {
    return process.env.WHATSAPP_ENABLED === 'true'
        && !!process.env.CALLMEBOT_PHONE
        && !!process.env.CALLMEBOT_APIKEY;
}

/** Odkaz, kterým jde zprávu poslat ručně z prohlížeče — záloha, když brána nefunguje. */
export function buildWaLink(text) {
    const phone = String(process.env.CALLMEBOT_PHONE || '').replace(/[^\d]/g, '');
    if (!phone) return null;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

/** Rozdělí text po řádcích na kusy, které se vejdou do URL. */
function chunk(text) {
    const out = [];
    let buf = '';
    for (const line of String(text).split('\n')) {
        if (buf && (buf.length + line.length + 1) > CHUNK_CHARS) { out.push(buf); buf = ''; }
        buf = buf ? `${buf}\n${line}` : line;
    }
    if (buf) out.push(buf);
    return out;
}

async function callGateway(text) {
    const url = 'https://api.callmebot.com/whatsapp.php'
        + `?phone=${encodeURIComponent(process.env.CALLMEBOT_PHONE)}`
        + `&text=${encodeURIComponent(text)}`
        + `&apikey=${encodeURIComponent(process.env.CALLMEBOT_APIKEY)}`;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        // tělo čteme jen kvůli hlášce, do logu jde zkrácené (URL s klíčem se nikam nepíše)
        const body = (await res.text().catch(() => '')).slice(0, 200);
        return { ok: res.ok, status: res.status, body };
    } finally {
        clearTimeout(t);
    }
}

/**
 * Pošle zprávu. Vrací { sent, skipped?, error? } — nikdy nevyhodí výjimku.
 */
export async function sendWhatsapp(text) {
    if (!isConfigured()) {
        console.warn('[WA] není nastavené (WHATSAPP_ENABLED / CALLMEBOT_PHONE / CALLMEBOT_APIKEY), přeskakuji');
        return { sent: false, skipped: 'nenastaveno' };
    }
    const parts = chunk(text);
    for (let i = 0; i < parts.length; i++) {
        if (i) await sleep(CHUNK_PAUSE_MS);
        let attempt = 0;
        for (;;) {
            try {
                const r = await callGateway(parts[i]);
                if (r.ok) break;
                // 4xx = špatný klíč nebo číslo, opakování nepomůže
                if (r.status < 500 && r.status !== 429) {
                    console.error(`[WA] odmítnuto (${r.status}) pro ${maskPhone(process.env.CALLMEBOT_PHONE)}: ${r.body}`);
                    return { sent: false, error: `brána odmítla (${r.status})` };
                }
                throw new Error(`HTTP ${r.status}`);
            } catch (e) {
                if (attempt++ >= 1) {
                    console.error(`[WA] odeslání selhalo pro ${maskPhone(process.env.CALLMEBOT_PHONE)}:`, e.message);
                    return { sent: false, error: e.message };
                }
                await sleep(5000);
            }
        }
    }
    console.log(`[WA] odesláno na ${maskPhone(process.env.CALLMEBOT_PHONE)} (${parts.length} část${parts.length === 1 ? '' : 'i'})`);
    return { sent: true, parts: parts.length };
}

/**
 * Zamluví si odeslání pro daný klíč. Vrátí false, když už jednou proběhlo.
 *
 * Unikátní index v DB je jediná spolehlivá pojistka — snapshot se přestavuje
 * jako vedlejší efekt HTTP požadavku a dva souběžné požadavky by jinak poslaly
 * tutéž zprávu dvakrát.
 */
export async function claimNotify(campCode, channel, key) {
    try {
        const maxPerDay = Number(process.env.WHATSAPP_MAX_PER_DAY || 12);
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const sentToday = await prisma.campNotifyLog.count({ where: { campCode, channel, sentAt: { gt: since } } });
        if (sentToday >= maxPerDay) {
            console.warn(`[WA] denní strop ${maxPerDay} vyčerpán, ${key} neodesílám`);
            return false;
        }
        await prisma.campNotifyLog.create({ data: { campCode, channel, key } });
        return true;
    } catch (e) {
        if (e?.code !== 'P2002') console.error('[WA] claim selhal:', e.message);
        return false;   // P2002 = už odesláno
    }
}

/** Zapíše klíč jako odeslaný, aniž by se cokoliv posílalo (studený start). */
export async function markNotified(campCode, channel, key) {
    await prisma.campNotifyLog.create({ data: { campCode, channel, key } }).catch(() => { });
}
