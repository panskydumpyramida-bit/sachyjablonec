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
import { sendWhatsapp, claimNotify, markNotified, isConfigured as isWaConfigured } from './whatsappService.js';
import { cleanOpponentName, normalizePlayerName, samePerson } from '../utils/playerName.js';

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

/**
 * Rejstřík jmen z naší databáze partií.
 *
 * Odkaz „příprava na soupeře" má vzniknout jen tam, kde za ním opravdu partie
 * jsou — jinak dítě klikne a uvidí prázdno. Zjišťovat to dotazem na každého
 * soupeře při každém načtení stránky by bylo drahé, tak si jména jednou za čas
 * načteme do paměti a párujeme proti nim.
 */
let nameIndex = null;
let nameIndexAt = 0;
const NAME_INDEX_TTL = 6 * 60 * 60 * 1000;

async function getNameIndex() {
    if (nameIndex && Date.now() - nameIndexAt < NAME_INDEX_TTL) return nameIndex;
    const [white, black] = await Promise.all([
        prisma.chessGame.groupBy({ by: ['whitePlayer'], _count: { _all: true } }),
        prisma.chessGame.groupBy({ by: ['blackPlayer'], _count: { _all: true } }),
    ]);
    // klíč bez diakritiky → { celkem partií, počty jednotlivých zápisů }
    const map = new Map();
    const add = (name, count) => {
        if (!name || name === '?') return;
        const key = normalizePlayerName(name);
        if (!key) return;
        const rec = map.get(key) || { games: 0, variants: new Map() };
        rec.games += count;
        rec.variants.set(name, (rec.variants.get(name) || 0) + count);
        map.set(key, rec);
    };
    for (const r of white) add(r.whitePlayer, r._count._all);
    for (const r of black) add(r.blackPlayer, r._count._all);
    // z variant téhož jména vybereme tu s nejvíc partiemi — na tu odkazujeme,
    // protože /tree hledá přesnou shodu
    for (const rec of map.values()) {
        rec.name = [...rec.variants.entries()].sort((a, b) => b[1] - a[1])[0][0];
        delete rec.variants;
    }
    nameIndex = map;
    nameIndexAt = Date.now();
    return map;
}

/** Jméno ze chess-results → přesný zápis v naší databázi, nebo null. */
async function resolveDbPlayer(name) {
    if (!name) return { dbName: null, dbGames: 0 };
    let idx;
    try {
        idx = await getNameIndex();
    } catch (e) {
        console.error('[Camp] rejstřík jmen:', e.message);
        return { dbName: null, dbGames: 0 };
    }
    const key = normalizePlayerName(name);
    const hit = idx.get(key);
    if (hit) return { dbName: hit.name, dbGames: hit.games };
    // v databázi bývá ročník navíc: „Klimes, Martin" → „Klimes, Martin 2008"
    let best = null;
    for (const [k, v] of idx) {
        if (k.startsWith(key + ' ') && (!best || v.games > best.games)) best = v;
    }
    return best ? { dbName: best.name, dbGames: best.games } : { dbName: null, dbGames: 0 };
}

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
                opponent: cleanOpponentName(g.opponent),
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
                        opponent: cleanOpponentName(iAmWhite ? p.blackName : p.whiteName),
                        opponentStartNo: iAmWhite ? p.blackStartNo : p.whiteStartNo,
                        opponentRating: card?.opponentRating ?? null,
                        // barva SOUPEŘE — pro přípravu v naší databázi partií
                        opponentColor: iAmWhite ? 'black' : 'white',
                        result: p.result || null,
                        bye: !!p.bye,
                    };
                });
            // Karta hráče (art=9) dostane výsledek až po dohrání CELÉHO kola, kdežto
            // párovací tabulka ho ukáže hned po partii. Tak si ho z ní přebereme,
            // ať průběh kola není hodiny prázdný. Kartu nikdy nepřepisujeme — ta je
            // zdroj pravdy, kdyby rozhodčí výsledek opravil.
            for (const pr of out.pairings) {
                if (pr.bye || !pr.result) continue;
                const [a, b] = String(pr.result).split('-').map(s => s.trim());
                const mine = pr.color === 'white' ? a : b;
                if (!/^(1|0|½)$/.test(mine || '')) continue;
                const player = out.players.find(x => x.startNo === pr.startNo);
                if (!player) continue;
                const g = (player.games || []).find(x => Number(x.round) === rd);
                if (g?.result) continue;
                if (g) g.result = mine;
                else (player.games ||= []).push({
                    round: rd, board: pr.board, opponent: pr.opponent, opponentRating: null,
                    opponentFed: null, color: pr.color, result: mine, bye: false,
                });
                // body z karty tenhle výsledek ještě nezahrnují
                player.points = (player.points || 0) + (mine === '1' ? 1 : mine === '½' ? 0.5 : 0);
                player.pointsLive = true;
            }

            // Máme soupeře v naší databázi partií? Podle toho se rozhodne, jestli
            // se na něj vůbec nabídne odkaz na přípravu.
            const seen = new Map();
            for (const list of [out.pairings, ...out.players.map(p => p.games || [])]) {
                for (const g of list) {
                    if (!g.opponent) continue;
                    if (!seen.has(g.opponent)) seen.set(g.opponent, await resolveDbPlayer(g.opponent));
                    const r = seen.get(g.opponent);
                    g.opponentDbName = r.dbName;
                    g.opponentDbGames = r.dbGames;
                }
            }

            out.currentRound = rd;
            out.roundState = st.state;
            out.roundStats = st;
            // Karta hráče nese i nedohranou partii, takže `played` může ukazovat na kolo,
            // které se teprve bude hrát — pak se marně ptáme na los toho následujícího.
            // Na los dalšího kola se čeká, jen když je tohle dohrané.
            if (st.state !== 'finished') delete out.nextRoundPending;
            break;
        } catch (e) { /* kolo ještě není */ }
    }
    return out;
}

/** Krátký popisek dne pro přepínač: „Po 27. 7." */
function dayLabel(date) {
    const f = new Intl.DateTimeFormat('cs-CZ', {
        timeZone: 'Europe/Prague', weekday: 'short', day: 'numeric', month: 'numeric',
    });
    return f.format(new Date(date)).replace(/\s+/g, ' ').trim();
}

/**
 * Žebříčky rozcvičky (Puzzle Racer camp) — jeden za každý den plus celkový součet.
 * Bez e-mailů, jen jméno a čísla.
 */
async function loadWarmup() {
    try {
        const sessions = await prisma.puzzleCampSession.findMany({
            where: { campCode: CAMP_CODE, status: { not: 'cancelled' } },
            orderBy: { startsAt: 'asc' },
            include: {
                attempts: {
                    where: { status: { in: ['finished', 'playing'] } },
                    orderBy: { score: 'desc' },
                    include: { user: { select: { username: true, realName: true } } },
                },
            },
        });

        const withResults = sessions.filter(s => s.attempts.length);
        if (!withResults.length) return null;

        const jmeno = (a) => a.user?.realName || a.user?.username || 'Hráč';

        // Kdo z hráčů rozcvičky je dítě z výpravy. Ukazatele „bez chyby" a „nejdelší
        // série" mají patřit jim — ne trenérovi a ne tomu, kdo si rozcvičku jen zkouší.
        // Přihlašovací jména se s tou soupiskou rozcházejí („Ema_Brehmová", „MarekSýkora",
        // „Hádek Vojtěch"), přezdívku jako „Řízeček" ale nepoznáme a poznat nemáme.
        const roster = await prisma.campPlayer.findMany({
            where: { campCode: CAMP_CODE, active: true },
            select: { displayName: true, role: true },
        }).catch(() => []);
        const deti = roster.filter(r => !r.role);   // trenér má roli vyplněnou
        const zVypravy = (jm) => {
            if (deti.some(r => samePerson(jm, r.displayName))) return true;
            // samotné křestní jméno bereme, jen když je na soupisce jediné takové
            const slovo = normalizePlayerName(jm);
            if (slovo.includes(' ')) return false;
            const shody = deti.filter(r => normalizePlayerName(r.displayName).split(' ').includes(slovo));
            return shody.length === 1;
        };
        // 'playing' zůstane viset dvěma způsoby: hráč odejde, nebo mu DOJDOU úlohy
        // (vyřeší celou sadu a klient konec neohlásí). Ani jedno není „právě hraje".
        const bezi = (a) => a.status === 'playing'
            && !(a.puzzleCount && (a.correctCount + a.wrongCount) >= a.puzzleCount)
            && (Date.now() - new Date(a.updatedAt || a.joinedAt).getTime()) < 30 * 60 * 1000;

        const days = withResults.map(s => ({
            id: s.id,
            title: s.title || 'Rozcvička',
            label: dayLabel(s.startsAt),
            startsAt: s.startsAt,
            results: s.attempts.map((a, i) => ({
                order: i + 1,
                name: jmeno(a),
                score: a.score,
                correct: a.correctCount ?? 0,
                wrong: a.wrongCount ?? 0,
                streak: a.maxStreak ?? 0,
                inProgress: bezi(a),
                zVypravy: zVypravy(jmeno(a)),
            })),
        }));

        // celkové pořadí = součet přes všechny dny; kdo chyběl, o body nepřijde,
        // jen jich má míň — proto je vidět i počet účastí
        const soucty = new Map();
        for (const s of withResults) {
            for (const a of s.attempts) {
                const key = jmeno(a);
                const r = soucty.get(key) || { name: key, score: 0, correct: 0, wrong: 0, streak: 0, days: 0, wins: 0 };
                r.score += a.score || 0;
                r.correct += a.correctCount ?? 0;
                r.wrong += a.wrongCount ?? 0;
                r.streak = Math.max(r.streak, a.maxStreak ?? 0);
                r.days++;
                if (s.attempts[0] === a && (a.score || 0) > 0) r.wins++;
                soucty.set(key, r);
            }
        }
        const total = [...soucty.values()]
            .sort((a, b) => b.score - a.score || b.correct - a.correct)
            .map((r, i) => ({ ...r, order: i + 1 }));

        return {
            days,
            total,
            // starší podoba dat — ať stránka funguje i než se přestaví snapshot
            title: days[days.length - 1].title,
            results: days[days.length - 1].results,
        };
    } catch (e) {
        console.error('[Camp] rozcvička:', e.message);
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

/** Řádek losu pro jednoho hráče — stejný zdroj pro push i WhatsApp. */
const pairingLine = (p) =>
    `${p.name}: deska ${p.board}, ${p.color === 'white' ? 'bílé' : 'černé'}, ${p.opponent || 'volno'}`;

/** Zpráva do WhatsAppu — celý los turnaje, ne useknutých šest řádků jako u push. */
export function buildWaText(t) {
    return [
        `*Bižuterie — los ${t.currentRound}. kola*`,
        t.name ? `_${t.name}_` : null,
        '',
        ...(t.pairings || []).map(pairingLine),
        '',
        'https://www.sachyjablonec.cz/pardubice',
    ].filter(x => x !== null).join('\n');
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

    // Studený start (prázdná cache po deployi nebo resetu DB): všechno je „nové",
    // ale rozesílat starý los nedává smysl. Klíče jen zapíšeme jako vyřízené.
    if (!previous) {
        for (const t of brandNew) await markNotified(CAMP_CODE, 'whatsapp', `${t.tnr}:${t.currentRound}`);
        return;
    }

    // web-push: jeden souhrn přes všechny turnaje, krátký (vejde se do notifikace)
    const round = brandNew[0].currentRound;
    const lines = brandNew.flatMap(t => (t.pairings || []).map(pairingLine));
    await notify(CAMP_CODE, {
        title: `Los ${round}. kola je venku`,
        body: lines.slice(0, 6).join('\n') + (lines.length > 6 ? `\n…a další (${lines.length} celkem)` : ''),
        url: '/pardubice',
    });

    // WhatsApp: zvlášť za každý turnaj — losují se nezávisle a zpráva má být
    // rovnou přeposlatelná do skupiny, tedy celá.
    if (!isWaConfigured()) return;
    for (const t of brandNew) {
        const key = `${t.tnr}:${t.currentRound}`;
        if (!await claimNotify(CAMP_CODE, 'whatsapp', key)) continue;
        await sendWhatsapp(buildWaText(t));
    }
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
