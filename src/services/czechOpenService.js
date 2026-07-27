/**
 * Dashboard soustředění (Czech Open Pardubice 2026).
 *
 * Web NIKDY nesahá na chess-results přímo — server si drží snapshot v DB
 * (CampSnapshot) a obnovuje ho nejvýš jednou za REFRESH_MS. Hráči se hledají
 * podle pevné mapy startovních čísel (CampPlayer), ne drahým skenem karet.
 */

import { PrismaClient } from '@prisma/client';
import {
    normalizeUrl, fetchPage, parseStandings, parsePlayerCard, parseRoundPairings,
} from './chessResultsService.js';
import { notify } from './pushService.js';

const prisma = new PrismaClient();

export const CAMP_CODE = 'pardubice-2026';
// Harmonogram Czech Open: kola od 15:00 (poslední od 13:00), los dalšího kola
// padá po dohrání, odhadem po 21:00. Podle toho ladíme, jak často se ptáme.
function pragueHour() {
    return Number(new Intl.DateTimeFormat('cs-CZ', { hour: 'numeric', hour12: false, timeZone: 'Europe/Prague' }).format(new Date()));
}
function refreshMs() {
    const h = pragueHour();
    // Los může padnout dřív, když se turnaj dohraje rychle (od ~19:00), a každý
    // dílčí turnaj se losuje nezávisle — proto široké husté okno.
    if (h >= 18 && h <= 23) return 3 * 60 * 1000;   // okno losu
    if (h >= 13 && h < 18) return 6 * 60 * 1000;    // hraje se
    if (h >= 8 && h < 13) return 15 * 60 * 1000;    // dopoledne klid
    return 45 * 60 * 1000;                          // noc
}
const STALE_MS = 60 * 60 * 1000;       // po hodině označíme data jako zastaralá
const PAUSE_MS = 1200;                 // pauza mezi turnaji, ať nás server neutne

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
};

/** Kolik kol je odehráno a jestli je venku los dalšího kola. */
function roundState(pairings) {
    const total = pairings.length;
    if (!total) return { pairs: 0, withResult: 0, state: 'none' };
    const withResult = pairings.filter(p => p.result && /[½01]/.test(String(p.result)) && !p.bye).length;
    // los venku = páry existují, ale výsledků je málo (ověřeno: 108 párů / 26 výsledků = hraje se)
    const ratio = withResult / total;
    return { pairs: total, withResult, state: ratio < 0.2 ? 'fresh' : (ratio < 0.9 ? 'playing' : 'finished') };
}

async function loadTournament(tnr, players) {
    const out = { tnr, name: null, rounds: null, currentRound: null, roundState: 'none', players: [], pairings: [] };

    // 1) pořadí — jméno turnaje, velikost pole, rank/body našich
    const standingsHtml = await fetchPage(normalizeUrl(tnr, { art: 1, lan: 5 }));
    const standings = parseStandings(standingsHtml);
    out.name = standings.tournamentTitle || null;
    out.fieldSize = standings.rows?.length || null;

    // 2) karty našich hráčů (pevná startovní čísla → žádný drahý sken)
    for (const p of players) {
        try {
            const cardHtml = await fetchPage(normalizeUrl(tnr, { art: 9, snr: p.startNo, lan: 5 }));
            const card = parsePlayerCard(cardHtml);
            if (!card?.ok) continue;
            const games = (card.games || []).map(g => ({
                round: g.round ?? null,
                board: g.board ?? null,
                opponent: g.opponent || null,
                opponentRating: num(g.opponentRating),
                opponentFed: g.opponentFed || null,
                color: g.color || null,
                result: g.result || null,
                bye: !!g.bye,
            }));
            out.players.push({
                startNo: p.startNo,
                name: p.displayName,
                rawName: card.name || null,
                birthYear: p.birthYear ?? card.birthYear ?? null,
                role: p.role || null,
                rating: num(card.rating),
                points: num(card.points),
                rank: num(card.rank),
                club: card.club || null,
                games,
            });
        } catch (e) {
            out.players.push({ startNo: p.startNo, name: p.displayName, error: 'nepodařilo se načíst' });
        }
    }

    // 3) los / průběh kola. POZOR: nevylosované kolo vrací 1–2 řádky "nenasazen"
    // (ověřeno na kole 5 turnaje C) — to není los, musí mít reálné páry.
    const played = Math.max(0, ...out.players.flatMap(p => (p.games || []).map(g => Number(g.round) || 0)));
    for (const rd of [played + 1, played]) {
        if (rd < 1) continue;
        try {
            const html = await fetchPage(normalizeUrl(tnr, { art: 2, rd, lan: 5 }));
            const parsed = parseRoundPairings(html);
            const pairings = parsed?.pairings || [];
            const realPairs = pairings.filter(p => !p.bye).length;
            if (realPairs < 5) {
                // los dalšího kola ještě není venku
                if (rd === played + 1) out.nextRoundPending = rd;
                continue;
            }
            const st = roundState(pairings);
            const mine = new Set(out.players.map(p => p.startNo));
            out.pairings = pairings
                .filter(p => mine.has(p.whiteStartNo) || mine.has(p.blackStartNo))
                .map(p => {
                    const iAmWhite = mine.has(p.whiteStartNo);
                    const me = iAmWhite ? p.whiteStartNo : p.blackStartNo;
                    const mePlayer = out.players.find(x => x.startNo === me);
                    // rating soupeře párování nenese — dohledáme ho v kartě hráče,
                    // ale ta má partii až po odehrání (u čerstvého losu tedy chybí)
                    const card = (mePlayer?.games || []).find(g => Number(g.round) === rd);
                    return {
                        board: p.board ?? null,
                        startNo: me,
                        name: mePlayer?.name || null,
                        rating: mePlayer?.rating ?? null,
                        color: iAmWhite ? 'white' : 'black',
                        opponent: (iAmWhite ? p.blackName : p.whiteName) || null,
                        opponentStartNo: iAmWhite ? p.blackStartNo : p.whiteStartNo,
                        opponentRating: card?.opponentRating ?? null,
                        // barva SOUPEŘE — pro přípravu v naší databázi partií
                        opponentColor: iAmWhite ? 'black' : 'white',
                        result: p.result || null,
                        bye: !!p.bye,
                    };
                });
            out.currentRound = rd;
            out.roundState = st.state;
            out.roundStats = st;
            break;
        } catch (e) { /* kolo ještě není */ }
    }
    return out;
}

/** Žebříček rozcvičky (Puzzle Racer camp) — jen dokončené pokusy, bez e-mailů. */
async function loadWarmup() {
    try {
        const sessions = await prisma.puzzleCampSession.findMany({
            where: { campCode: CAMP_CODE, status: { not: 'cancelled' } },
            orderBy: { id: 'desc' },
            include: {
                attempts: {
                    where: { status: { in: ['finished', 'playing'] } },
                    orderBy: { score: 'desc' },
                    include: { user: { select: { username: true, realName: true } } },
                },
            },
        });
        const s = sessions.find(x => x.attempts.length) || null;
        if (!s) return null;
        const attempts = s.attempts;
        if (!attempts.length) return null;
        return {
            title: s.title || 'Rozcvička',
            results: attempts.map((a, i) => ({
                order: i + 1,
                name: a.user?.realName || a.user?.username || 'Hráč',
                score: a.score,
                correct: a.correctCount ?? 0,
                wrong: a.wrongCount ?? 0,
                streak: a.maxStreak ?? 0,
                // 'playing' zůstane viset dvěma způsoby: hráč odejde, nebo mu DOJDOU úlohy
                // (vyřeší celou sadu a klient konec neohlásí). Ani jedno není „právě hraje".
                inProgress: a.status === 'playing'
                    && !(a.puzzleCount && (a.correctCount + a.wrongCount) >= a.puzzleCount)
                    && (Date.now() - new Date(a.updatedAt || a.joinedAt).getTime()) < 30 * 60 * 1000,
            })),
        };
    } catch (e) {
        return null;
    }
}

function buildStats(tournaments) {
    const all = tournaments.flatMap(t => t.players).filter(p => !p.error);
    const points = all.reduce((s, p) => s + (p.points || 0), 0);
    const games = all.reduce((s, p) => s + (p.games?.filter(g => !g.bye).length || 0), 0);
    // největší skalp = výhra nad nejvýše ratingovaným soupeřem
    let best = null;
    for (const p of all) {
        for (const g of p.games || []) {
            if (g.bye || !/^(1|\+)$/.test(String(g.result || '').trim())) continue;
            if (!g.opponentRating) continue;
            if (!best || g.opponentRating > best.opponentRating) {
                best = { player: p.name, opponent: g.opponent, opponentRating: g.opponentRating, round: g.round };
            }
        }
    }
    // motivační milníky — každý má co slavit, i kdo je v dolní polovině
    const milestones = [];
    for (const p of all) {
        const gs = (p.games || []).filter(g => !g.bye);
        const wins = gs.filter(g => /^(1|\+)$/.test(String(g.result || '').trim()));
        const draws = gs.filter(g => /½|0[.,]5/.test(String(g.result || '')));
        if (wins.length === 1) {
            const w = wins[0];
            milestones.push({ icon: '🎉', player: p.name, text: `první výhra turnaje${w.opponentRating ? ` (soupeř ${w.opponentRating})` : ''}` });
        } else if (wins.length > 1) {
            milestones.push({ icon: '💪', player: p.name, text: `${wins.length} výhry v turnaji` });
        }
        // remíza se silnějším soupeřem je taky úspěch
        const bigDraw = draws.filter(d => d.opponentRating && p.rating && d.opponentRating - p.rating >= 150)
            .sort((a, b) => b.opponentRating - a.opponentRating)[0];
        if (bigDraw) milestones.push({ icon: '🛡️', player: p.name, text: `remíza s hráčem o ${bigDraw.opponentRating - p.rating} bodů silnějším` });
        // série bez porážky na konci
        let streak = 0;
        for (let i = gs.length - 1; i >= 0; i--) {
            if (/^0$|^-$/.test(String(gs[i].result || '').trim())) break;
            streak++;
        }
        if (streak >= 2) milestones.push({ icon: '🔥', player: p.name, text: `${streak} kola bez porážky` });
    }

    return {
        players: all.length,
        points: Math.round(points * 10) / 10,
        games,
        scorePct: games ? Math.round((points / games) * 100) : null,
        bestScalp: best,
        milestones: milestones.slice(0, 8),
        maxPoints: games,
    };
}

/** Postaví čerstvý snapshot (stahuje z chess-results). */
export async function buildSnapshot() {
    const roster = await prisma.campPlayer.findMany({
        where: { campCode: CAMP_CODE, active: true },
        orderBy: [{ tournamentCode: 'asc' }, { sortOrder: 'asc' }],
    });
    const byTnr = new Map();
    for (const p of roster) {
        if (!byTnr.has(p.tnr)) byTnr.set(p.tnr, { tnr: p.tnr, code: p.tournamentCode, players: [] });
        byTnr.get(p.tnr).players.push(p);
    }

    const tournaments = [];
    for (const [tnr, group] of byTnr) {
        try {
            const t = await loadTournament(tnr, group.players);
            t.code = group.code;
            tournaments.push(t);
        } catch (e) {
            tournaments.push({ tnr, code: group.code, error: e.message, players: [] });
        }
        await sleep(PAUSE_MS);
    }

    return {
        campCode: CAMP_CODE,
        campName: 'Soustředění Pardubice 2026',
        tournaments,
        stats: buildStats(tournaments),
        warmup: await loadWarmup(),
        schedule: { roundStart: '15:00', lastRoundStart: '13:00', pairingsExpectedAfter: '21:00' },
        nextRefreshMs: refreshMs(),
        generatedAt: new Date().toISOString(),
    };
}

/**
 * Pošle upozornění, jakmile je venku los kola, o kterém jsme ještě nedali vědět.
 * Klíčem je (turnaj, kolo) v čerstvém stavu — po restartu kontejneru se stav
 * dopočítá z předchozího snapshotu, takže se neposílá dvakrát.
 */
async function announceNewPairings(previous, current) {
    const freshNow = current.tournaments.filter(t => t.roundState === 'fresh' && (t.pairings || []).length);
    if (!freshNow.length) return;

    const wasFresh = new Set((previous?.tournaments || [])
        .filter(t => t.roundState === 'fresh' && (t.pairings || []).length)
        .map(t => `${t.tnr}:${t.currentRound}`));

    const brandNew = freshNow.filter(t => !wasFresh.has(`${t.tnr}:${t.currentRound}`));
    if (!brandNew.length) return;

    const round = brandNew[0].currentRound;
    const lines = brandNew.flatMap(t => (t.pairings || []).map(p =>
        `${p.name}: deska ${p.board}, ${p.color === 'white' ? 'bílé' : 'černé'}, ${p.opponent || 'volno'}`));
    await notify(CAMP_CODE, {
        title: `Los ${round}. kola je venku`,
        body: lines.slice(0, 6).join('\n') + (lines.length > 6 ? `\n…a další (${lines.length} celkem)` : ''),
        url: '/pardubice',
    });
}

/** Vrátí snapshot z cache; obnoví, jen když je starší než REFRESH_MS. */
export async function getSnapshot({ force = false } = {}) {
    const row = await prisma.campSnapshot.findUnique({ where: { id: CAMP_CODE } }).catch(() => null);
    const age = row ? Date.now() - new Date(row.fetchedAt).getTime() : Infinity;

    if (row && !force && age < refreshMs()) {
        return { ...JSON.parse(row.payloadJson), cached: true, ageMs: age };
    }

    try {
        const payload = await buildSnapshot();
        const previous = row ? JSON.parse(row.payloadJson) : null;
        await prisma.campSnapshot.upsert({
            where: { id: CAMP_CODE },
            update: { payloadJson: JSON.stringify(payload), fetchedAt: new Date() },
            create: { id: CAMP_CODE, payloadJson: JSON.stringify(payload), fetchedAt: new Date() },
        });
        // je venku los, který jsme ještě neoznámili?
        announceNewPairings(previous, payload).catch(e => console.error('[Camp] notify:', e.message));
        return { ...payload, cached: false, ageMs: 0 };
    } catch (e) {
        // chess-results je dole → radši stará data než prázdná stránka
        if (row) return { ...JSON.parse(row.payloadJson), cached: true, stale: age > STALE_MS, ageMs: age, warning: 'Data se nepodařilo obnovit' };
        throw e;
    }
}
