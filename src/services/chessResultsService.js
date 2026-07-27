/**
 * chess-results.com scraper — robustní vrstva pro vyhledávání našich hráčů
 * ve všech typech turnajů (jednotlivci, festivaly, týmové soutěže).
 *
 * chess-results nemá veřejné API, takže vše jede přes HTML scraping.
 * Pohledy (art):
 *   0 = startovní listina, 1 = pořadí, 2 = nasazení/výsledky kola (+rd),
 *   4 = pořadí po kole (+rd), 9 = karta hráče (+snr)
 *
 * Pozor:
 *  - výchozí pohled vrací jen 150 řádků → nutné &zeilen=99999 (zeilen=0 NEFUNGUJE)
 *  - klub v tabulce většinou NENÍ, je až v kartě hráče (art=9)
 *  - jména jsou bez diakritiky → příjmení se musí matchovat jako celý token
 */

import * as cheerio from 'cheerio';
import { isChessResultsUrl, fetchWithHeaders } from '../utils/helpers.js';

const MIRRORS = ['s1', 's2', 's3', 's4', 's5'];
const DEFAULT_MIRROR = 's2';
const DEFAULT_TIMEOUT_MS = 20000;
const CARD_TTL_MS = 10 * 60 * 1000;
const CARD_CACHE_MAX = 3000;

/** Cache karet hráčů: key `${tnr}:${snr}:${lan}` → { at, card } */
const cardCache = new Map();

/* ------------------------------------------------------------------ *
 * Textové helpery
 * ------------------------------------------------------------------ */

/**
 * Odstraní diakritiku, převede na lowercase a sjednotí oddělovače.
 * @param {string} s
 * @returns {string}
 */
export function deacc(s) {
    return String(s ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const norm = (s) => String(s ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

const TITLES = new Set(['GM', 'IM', 'FM', 'CM', 'NM', 'WGM', 'WIM', 'WFM', 'WCM', 'WH', 'AGM', 'AIM', 'AFM', 'ACM']);
const NAME_NOISE = new Set(['dr', 'ing', 'mudr', 'prof', 'mgr', 'bc', 'phd', 'jr', 'sr']);
/** Předložkové části příjmení — bez nich by "ter Stal Sven" dalo příjmení "ter". */
const NAME_PARTICLES = new Set([
    'van', 'von', 'der', 'den', 'de', 'del', 'della', 'di', 'da', 'dos', 'das', 'du',
    'la', 'le', 'ter', 'ten', 'op', 'af', 'al', 'el', 'bin', 'ibn', 'mac', 'mc', 'st'
]);

/**
 * Rozdělí jméno z chess-results na příjmení + křestní.
 * Formáty: "Příjmení, Jméno" (art=1/2/9) i "Příjmení Jméno" (art=4).
 * @param {string} raw
 * @returns {{ lastName: string, firstName: string }}
 */
export function splitName(raw) {
    const value = String(raw ?? '').trim();
    if (!value) return { lastName: '', firstName: '' };

    let lastName, firstName;
    if (value.includes(',')) {
        const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
        lastName = parts[0] || '';
        firstName = parts
            .slice(1)
            .filter((p) => p.length > 1 && !NAME_NOISE.has(deacc(p).replace(/\s+/g, '')))
            .join(' ');
    } else {
        // Formát bez čárky (art=4): příjmení stojí první, ale může začínat
        // předložkovými částmi ("ter Stal Sven", "Van Foreest Jorden").
        const tokens = value.split(/\s+/);
        let take = 1;
        while (take < tokens.length && NAME_PARTICLES.has(deacc(tokens[take - 1]))) take++;
        lastName = tokens.slice(0, take).join(' ');
        firstName = tokens.slice(take).join(' ');
    }
    return { lastName, firstName };
}

/** Klíč příjmení pro porovnání (celý token, bez diakritiky). */
const lastKeyOf = (lastName) => deacc(lastName);
/** První token křestního jména bez diakritiky ("Josef Jan" → "josef"). */
const firstKeyOf = (firstName) => deacc(firstName).split(' ')[0] || '';

/**
 * Jsou dvě křestní jména kompatibilní?
 * Plná jména se musí rovnat ("Jakub" ≠ "Jachym"), zkratka se porovná
 * jen na iniciálu ("J." ~ "Jakub"), prázdné jméno projde vždy.
 */
function firstNameCompatible(a, b) {
    const x = firstKeyOf(a);
    const y = firstKeyOf(b);
    if (!x || !y) return true;
    if (x.length === 1 || y.length === 1) return x[0] === y[0];
    return x === y;
}

/* ------------------------------------------------------------------ *
 * URL vrstva
 * ------------------------------------------------------------------ */

/**
 * Vytáhne číslo turnaje z URL nebo holého čísla.
 * @param {string} input
 * @returns {string|null}
 */
export function extractTnr(input) {
    const value = String(input ?? '').trim();
    if (!value) return null;
    if (/^\d+$/.test(value)) return value;
    const inPath = value.match(/tnr(\d+)\.aspx/i);
    if (inPath) return inPath[1];
    // Fallback pro CalendarLink.aspx?tnr=… — nepoužívat na indexu, ale vstup od uživatele to mít může.
    const inQuery = value.match(/[?&]tnr=(\d+)/i);
    return inQuery ? inQuery[1] : null;
}

/**
 * Postaví kanonickou URL pohledu. Vstupní URL se zahazuje, staví se čistě
 * z tnr + požadovaných parametrů (uživatel může vložit URL s wi=/snr=/prt=).
 *
 * @param {string} urlOrTnr - libovolná chess-results URL nebo holé tnr
 * @param {object} [overrides]
 * @param {string|null} [overrides.mirror] - 's1'..'s5' nebo null (bez subdomény)
 * @param {number|string} [overrides.art=1]
 * @param {number|string|null} [overrides.rd]
 * @param {number|string} [overrides.lan=5] - 5=CZ, 1=EN, 0=DE
 * @param {number|string|null} [overrides.snr]
 * @param {number|null} [overrides.zeilen] - výchozí 99999 u seznamových pohledů
 * @returns {string}
 */
export function normalizeUrl(urlOrTnr, overrides = {}) {
    const tnr = extractTnr(urlOrTnr);
    if (!tnr) throw new Error('URL neobsahuje identifikátor turnaje (tnrXXXXXXX.aspx)');

    const {
        mirror = DEFAULT_MIRROR,
        art = 1,
        rd = null,
        lan = 5,
        snr = null,
        zeilen
    } = overrides;

    const host = mirror ? `${mirror}.chess-results.com` : 'chess-results.com';
    const params = new URLSearchParams();
    params.set('lan', String(lan));
    params.set('art', String(art));
    if (rd !== null && rd !== undefined && rd !== '') params.set('rd', String(rd));
    if (snr !== null && snr !== undefined && snr !== '') params.set('snr', String(snr));
    params.set('turdet', 'YES');
    params.set('flag', '30');

    // Karta hráče (art=9) je jednostránková, stránkování se jí netýká.
    const isListView = Number(art) !== 9;
    const rows = zeilen !== undefined ? zeilen : (isListView ? 99999 : null);
    if (rows !== null && rows !== undefined) params.set('zeilen', String(rows));

    return `https://${host}/tnr${tnr}.aspx?${params.toString()}`;
}

function swapMirror(url, step) {
    try {
        const u = new URL(url);
        const current = u.hostname.split('.')[0];
        const idx = MIRRORS.indexOf(current);
        const next = MIRRORS[((idx < 0 ? 0 : idx) + step) % MIRRORS.length];
        u.hostname = `${next}.chess-results.com`;
        return u.toString();
    } catch {
        return url;
    }
}

/**
 * Stáhne stránku chess-results (prohlížečový UA, timeout, retry přes jiný mirror).
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=20000]
 * @param {number} [opts.retries=1]
 * @returns {Promise<string>} HTML
 */
export async function fetchPage(url, opts = {}) {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 1 } = opts;
    if (!isChessResultsUrl(url)) throw new Error('URL musí být z chess-results.com');

    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const target = attempt === 0 ? url : swapMirror(url, attempt);
        try {
            const response = await fetchWithHeaders(target, timeoutMs);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            if (!html || html.length < 200) throw new Error('prázdná odpověď');
            return html;
        } catch (error) {
            lastError = error;
        }
    }
    const reason = lastError?.name === 'AbortError' ? `timeout ${timeoutMs} ms` : (lastError?.message || 'neznámá chyba');
    throw new Error(`Nepodařilo se načíst ${url} — ${reason}`);
}

/* ------------------------------------------------------------------ *
 * DOM helpery (pozor na vnořené tabulky a míchané th/td)
 * ------------------------------------------------------------------ */

/** Vrátí POUZE přímé <tr> tabulky (vnořené tabulky v buňkách by jinak prosákly). */
function directRows($, table) {
    return $(table).children('tbody').children('tr').add($(table).children('tr')).toArray();
}

/** Buňky řádku — hlavička míchá <th> i <td> (sloupec "K" je <td>). */
function cellsOf($, row) {
    return $(row).children('th,td').toArray();
}

const cellText = ($, cell) => $(cell).text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

const rowTexts = ($, row) => cellsOf($, row).map((c) => cellText($, c));

/** FED z class atributu řádku: <tr class="CRng2 GER"> */
function fedFromClass(className) {
    if (!className) return '';
    for (const token of String(className).split(/\s+/)) {
        if (/^[A-Z]{3}$/.test(token)) return token;
    }
    return '';
}

/** snr z odkazu na kartu hráče. */
function snrFromCell($, cell) {
    const href = $(cell).find('a[href]').attr('href') || '';
    const m = href.match(/[?&]snr=(\d+)/i);
    return m ? Number(m[1]) : null;
}

/* ------------------------------------------------------------------ *
 * Mapování sloupců — jazykově nezávislý slovník CZ/EN/DE
 * ------------------------------------------------------------------ */

const DICT = {
    rank: ['poř.', 'poř', 'pořadí', 'rk.', 'rk', 'rg.', 'rang'],
    board: ['šach.', 'sach.', 'bo.', 'br.'],
    round: ['kolo', 'rd.', 'rd'],
    name: ['jméno', 'jmeno', 'name'],
    fed: ['fed', 'land'],
    rating: ['rtg', 'rtgfide', 'elo'],
    club: ['klub/místo', 'klub/město', 'klub/misto', 'klub/mesto', 'club/city', 'verein/ort', 'klub', 'club'],
    team: ['družstvo', 'druzstvo', 'team', 'mannschaft'],
    points: ['body', 'pts.', 'pts', 'pkt.', 'punkte', 'points'],
    result: ['výsledek', 'vysledek', 'výsl.', 'vysl.', 'result', 'res.', 'ergebnis', 'erg.'],
    fideId: ['fide-id', 'fideid'],
    games: ['partie', 'partien'],
    sex: ['pohlaví', 'pohlavi', 'sex', 'geschl.'],
    group: ['skup.', 'grp'],
    snr: ['st.č.', 'st.c.', 'stč', 'čís.', 'cis.', 'sno', 'no.', 'snr', 'nr.', 'č.', 'c.']
};

/**
 * Namapuje role sloupců podle hlavičky.
 * Pozice sloupců se mezi turnaji liší, proto NIKDY nepoužívat fixní indexy.
 * @param {string[]} headers
 * @returns {object} { rank, snr, name, fed, rating, points, club, team, tb: number[], rounds: number[] }
 */
export function mapColumns(headers) {
    const map = {};
    headers.forEach((header, index) => {
        const n = norm(header);
        if (!n) return;
        for (const [role, variants] of Object.entries(DICT)) {
            if (map[role] === undefined && variants.includes(n)) {
                map[role] = index;
                return;
            }
        }
        if (/^(ph|tb|wtg)\s*\d+$/.test(n)) {
            (map.tb ??= []).push(index);
        } else if (/^\d+\s*\.?\s*(rd|kolo|r)?\.?$/.test(n)) {
            (map.rounds ??= []).push(index);
        }
    });
    return map;
}

/** Doplní chybějící role heuristikou nad daty (pro cizí lokalizace). */
function fillColumnFallbacks($, map, headerCells, dataRows) {
    if (map.name === undefined && dataRows.length) {
        const first = cellsOf($, dataRows[0]);
        let idx = first.findIndex((c) => $(c).find('a[href*="art=9"]').length > 0);
        if (idx < 0) {
            idx = first.findIndex((c) => {
                const t = cellText($, c);
                return t.includes(',') && t.split(/\s+/).length >= 2;
            });
        }
        if (idx >= 0) map.name = idx;
    }

    // Tabulka pořadí DRUŽSTEV nemá sloupec se jménem hráče — použijeme název družstva,
    // jinak by se celá tabulka zahodila (řádky bez "jména" se přeskakují).
    if (map.name === undefined && map.team !== undefined) {
        map.name = map.team;
        map.nameFromTeam = true;
    }

    if (map.fed === undefined && dataRows.length) {
        const width = headerCells.length;
        for (let col = 0; col < width; col++) {
            let hits = 0;
            let total = 0;
            for (const row of dataRows.slice(0, 40)) {
                const cells = cellsOf($, row);
                if (col >= cells.length) continue;
                total++;
                if (/^[A-Z]{3}$/.test(cellText($, cells[col]))) hits++;
            }
            if (total > 0 && hits / total >= 0.8) { map.fed = col; break; }
        }
    }
    return map;
}

/* ------------------------------------------------------------------ *
 * parseTournamentIndex — fáze 1 (seznam dílčích turnajů festivalu)
 * ------------------------------------------------------------------ */

/**
 * @param {string} html
 * @param {string} baseUrl - URL, ze které HTML pochází (kvůli určení aktuálního tnr)
 * @returns {{ isIndex:boolean, tnr:string|null, title:string, tournaments:Array, pairingRounds:number[], rankingRounds:number[] }}
 */
export function parseTournamentIndex(html, baseUrl) {
    const $ = cheerio.load(html);
    const headings = $('h2').map((i, e) => cellText($, e)).get().filter(Boolean);
    const title = headings[0] || cellText($, $('title')).replace(/^Chess-Results Server Chess-results\.com\s*-\s*/i, '');

    // Neexistující turnaj vrátí prázdnou "Turnajovou databázi" — bez jediného <h2>.
    // (Neodehraný turnaj nadpis má, jen nemá tabulku — ten platný je.)
    const found = headings.length > 0;

    const currentTnr = extractTnr(baseUrl || '') || extractTnr($('a[href*=".aspx"]').attr('href') || '');
    const lan = (() => {
        try { return new URL(baseUrl).searchParams.get('lan') || '5'; } catch { return '5'; }
    })();

    // Dostupná kola pro jednotlivé pohledy (odkazy "Nasazení hráčů" / "Ranking list after")
    const pairingRounds = new Set();
    const rankingRounds = new Set();
    $('a[href]').each((i, a) => {
        const href = $(a).attr('href') || '';
        if (!/tnr\d+\.aspx/i.test(href)) return;
        if (currentTnr && extractTnr(href) !== currentTnr) return;
        const art = (href.match(/[?&]art=(\d+)/i) || [])[1];
        const rd = (href.match(/[?&]rd=(\d+)/i) || [])[1];
        if (!rd) return;
        // "Nasazení hráčů" = art=2&rd=N, "Ranking list after" = art=1&rd=N,
        // křížová tabulka po kole = art=4&rd=N
        if (art === '2') pairingRounds.add(Number(rd));
        if (art === '1' || art === '4') rankingRounds.add(Number(rd));
    });

    // Turnaje bez navigačních odkazů (dohrané, tnr1196274) by jinak nenabídly
    // žádné kolo, přestože art=2&rd=N i art=1&rd=N fungují. Počet kol je v nadpisu.
    const playedRounds = headings.map(roundFromTitle).find((r) => r !== null && r > 0) || null;
    if (playedRounds) {
        for (let r = 1; r <= playedRounds; r++) {
            pairingRounds.add(r);
            rankingRounds.add(r);
        }
    }

    // Řádek "Výběr turnaje" — jazykově nezávisle: <td> bez vnořené tabulky,
    // který obsahuje odkazy s tnrNNN.aspx na JINÝ turnaj než aktuální.
    let selectionCell = null;
    let bestCount = 0;
    $('td').each((i, td) => {
        if ($(td).find('table').length) return;
        const links = $(td).find('a[href]').toArray()
            .filter((a) => /tnr\d+\.aspx/i.test($(a).attr('href') || ''));
        if (!links.length) return;
        const tnrs = new Set(links.map((a) => extractTnr($(a).attr('href'))).filter(Boolean));
        if (![...tnrs].some((t) => t !== currentTnr)) return;
        if (tnrs.size > bestCount) { bestCount = tnrs.size; selectionCell = td; }
    });

    const buildUrl = (tnr) => normalizeUrl(tnr, { art: 1, lan });

    if (!selectionCell) {
        return {
            isIndex: false,
            found,
            tnr: currentTnr,
            title,
            tournaments: currentTnr
                ? [{ tnr: currentTnr, label: '', name: title, url: buildUrl(currentTnr), current: true }]
                : [],
            pairingRounds: [...pairingRounds].sort((a, b) => a - b),
            rankingRounds: [...rankingRounds].sort((a, b) => a - b)
        };
    }

    const tournaments = [];
    const seen = new Set();
    $(selectionCell).contents().each((i, node) => {
        if (node.type !== 'tag') return;
        const el = $(node);
        if (node.name === 'a') {
            const tnr = extractTnr(el.attr('href') || '');
            const label = cellText($, node);
            if (!tnr || seen.has(tnr) || !label) return;
            seen.add(tnr);
            tournaments.push({ tnr, label, name: label, url: buildUrl(tnr), current: false });
        } else if (node.name === 'i' || node.name === 'b') {
            // Aktuální turnaj je <i><b>X</b></i> BEZ odkazu.
            const label = cellText($, node);
            if (!label || !currentTnr || seen.has(currentTnr)) return;
            seen.add(currentTnr);
            tournaments.push({ tnr: currentTnr, label, name: title, url: buildUrl(currentTnr), current: true });
        }
    });

    return {
        isIndex: tournaments.length > 1,
        found,
        tnr: currentTnr,
        title,
        tournaments,
        pairingRounds: [...pairingRounds].sort((a, b) => a - b),
        rankingRounds: [...rankingRounds].sort((a, b) => a - b)
    };
}

/* ------------------------------------------------------------------ *
 * parseStandings — pořadí (art=1) i pořadí po kole (art=4)
 * ------------------------------------------------------------------ */

/**
 * @param {string} html
 * @returns {{ ok:boolean, reason?:string, tournamentTitle:string, viewTitle:string,
 *             isTeam:boolean, hasClubColumn:boolean, hasTeamColumn:boolean,
 *             columns:string[], headers:string[],
 *             rawRows:string[][], rows:Array }}
 */
export function parseStandings(html) {
    const $ = cheerio.load(html);
    const headings = $('h2').map((i, e) => cellText($, e)).get().filter(Boolean);
    const tournamentTitle = headings[0] || '';
    const viewTitle = headings[1] || '';

    const table = $('table.CRs1').first();
    const empty = {
        ok: false,
        reason: 'no-data',
        tournamentTitle,
        viewTitle,
        isTeam: false,
        hasClubColumn: false,
        clubFillRatio: 0,
        clubColumnComplete: false,
        hasTeamColumn: false,
        hasFideIdColumn: false,
        isTeamRanking: false,
        snrColumnReliable: false,
        columns: [],
        headers: [],
        rawRows: [],
        rows: []
    };
    if (!table.length) return empty;

    const trs = directRows($, table);
    if (!trs.length) return empty;

    let headerIndex = trs.findIndex((r) => $(r).children('th').length > 0);
    if (headerIndex < 0) headerIndex = 0;
    const headers = rowTexts($, trs[headerIndex]);

    // Skupinové řádky (jediná buňka "1. Název družstva (…)") = týmová soupiska
    const isGroupRow = (row) => {
        const cells = cellsOf($, row);
        return cells.length === 1 && /^\d+\.\s+\S/.test(cellText($, cells[0]));
    };
    const groupRows = trs.filter(isGroupRow);
    const isTeamStandings = headers.some((h) => DICT.team.includes(norm(h)));
    const isTeam = isTeamStandings || groupRows.length > 0;

    // U týmových soupisek stojí první skupinový řádek PŘED hlavičkou a hlavička
    // se pak opakuje před každým družstvem → jedeme přes všechny řádky a hlavičky filtrujeme.
    const bodyRows = trs.filter((r) => $(r).children('th').length === 0);
    const dataRows = bodyRows.filter((r) => cellsOf($, r).length >= 3);

    const map = fillColumnFallbacks($, mapColumns(headers), cellsOf($, trs[headerIndex]), dataRows);

    const at = (cells, idx) => (idx === undefined || idx === null || idx >= cells.length ? '' : cellText($, cells[idx]));
    const clubIdx = map.club !== undefined ? map.club : map.team;

    // "St.č./SNo/Snr" je opravdu startovní číslo; "Čís./Nr./No." bývá pořadí v tabulce,
    // takže z něj NESMÍME stavět odkaz na kartu hráče (art=9&snr=N by ukázal na někoho jiného).
    const STRICT_SNR = ['st.č.', 'st.c.', 'stč', 'sno', 'snr'];
    const snrColumnReliable = map.snr !== undefined && STRICT_SNR.includes(norm(headers[map.snr]));

    const rows = [];
    const rawRows = [];
    let currentGroup = null;

    for (const tr of bodyRows) {
        if (isGroupRow(tr)) {
            const text = cellText($, cellsOf($, tr)[0]);
            const m = text.match(/^\d+\.\s+(.+?)(?:\s*\(.*\))?$/);
            currentGroup = m ? m[1].trim() : text;
            continue;
        }
        const cells = cellsOf($, tr);
        if (cells.length < 3) continue;

        const texts = cells.map((c) => cellText($, c));
        const name = at(cells, map.name);
        if (!name) continue;

        rawRows.push(texts);

        const nameCell = map.name !== undefined ? cells[map.name] : null;
        const hrefSnr = nameCell ? snrFromCell($, nameCell) : null;
        const colSnr = map.snr !== undefined ? Number(at(cells, map.snr).replace(/[^\d-]/g, '')) : NaN;
        const startNo = hrefSnr ?? (Number.isFinite(colSnr) ? colSnr : null);
        const startNoSource = hrefSnr !== null ? 'href' : (startNo !== null ? 'column' : null);

        // Titul bývá v samostatném (jinak neoznačeném) sloupci před jménem.
        let title = '';
        for (let i = 0; i < Math.min(cells.length, map.name ?? cells.length); i++) {
            const t = texts[i];
            if (t && TITLES.has(t.toUpperCase())) { title = t; break; }
        }

        const tiebreaks = (map.tb || []).map((i) => texts[i] ?? '');
        let points = map.points !== undefined ? texts[map.points] : '';
        // Některé turnaje nemají sloupec "Body" — skóre je pak první pomocné hodnocení.
        if (!points && tiebreaks.length) points = tiebreaks[0];

        const { lastName, firstName } = splitName(name);
        const club = clubIdx !== undefined ? (texts[clubIdx] || null) : (currentGroup || null);

        rows.push({
            rowIndex: rawRows.length - 1,
            rank: map.rank !== undefined ? texts[map.rank] : String(rawRows.length),
            startNo,
            startNoSource,
            title,
            name,
            lastName,
            firstName,
            fed: (map.fed !== undefined ? texts[map.fed] : '') || fedFromClass($(tr).attr('class')),
            rating: map.rating !== undefined ? texts[map.rating] : '',
            points,
            club,
            fideId: map.fideId !== undefined ? (texts[map.fideId] || null) : null,
            tiebreaks
        });
    }

    if (!rows.length) return { ...empty, reason: 'no-rows', isTeam, headers, columns: headers };

    // Sloupec klubu bývá vyplněný jen u části hráčů (Brasov: 77 ze 197).
    // Pak se na něj nesmí spoléhat a u prázdných řádků je nutná karta hráče.
    const filledClubs = map.club !== undefined
        ? rows.filter((r) => r.club && String(r.club).trim()).length
        : 0;
    const clubFillRatio = map.club !== undefined && rows.length ? filledClubs / rows.length : 0;

    return {
        ok: true,
        tournamentTitle,
        viewTitle,
        isTeam,
        // Sloupec s registračním klubem. Název DRUŽSTVA se sem záměrně nepočítá —
        // hráč bývá registrovaný jinde, než za koho v soutěži nastupuje,
        // takže u týmovek se karty stahovat musí.
        hasClubColumn: map.club !== undefined,
        clubFillRatio,
        // Spolehlivý sloupec klubu = vyplněný aspoň z 80 % (jinak by hráči
        // s prázdnou buňkou tiše vypadli, protože by se pro ně nestáhla karta).
        clubColumnComplete: map.club !== undefined && clubFillRatio >= 0.8,
        hasTeamColumn: map.team !== undefined || (isTeam && currentGroup !== null),
        hasFideIdColumn: map.fideId !== undefined,
        isTeamRanking: map.nameFromTeam === true,
        snrColumnReliable,
        columns: headers,
        headers,
        rawRows,
        rows
    };
}

/* ------------------------------------------------------------------ *
 * parsePlayerCard — art=9 (jediný spolehlivý zdroj klubu a ident-čísla)
 * ------------------------------------------------------------------ */

/** Text soupeře u nesehrané partie (volno / bye / nenasazen). */
const BYE_RE = /^(spielfrei|bye|volno|nenasazen\w*|not paired|sudcovsk\w*|-+)[,\s]*$/i;

const CARD_KEYS = {
    name: ['jméno', 'name'],
    title: ['titul', 'title', 'titel'],
    startNo: ['startovní číslo', 'starting rank', 'startrang'],
    rating: ['rating', 'elo'],
    ratingNational: ['elo národní', 'rating national', 'elo national'],
    ratingIntl: ['elo mezinárodní', 'rating international', 'elo intnational'],
    performance: ['výkon', 'performance rating', 'eloperformance'],
    points: ['body', 'points', 'punkte'],
    rank: ['pořadí', 'rank', 'rang'],
    fed: ['federace', 'federation', 'föderation'],
    club: ['klub/město', 'klub/místo', 'club/city', 'verein/ort'],
    birthYear: ['rok narození', 'year of birth', 'geburtsjahr']
};

/**
 * @param {string} html
 * @returns {{ ok:boolean, reason?:string, name:string, startNo:number|null, rating:string,
 *             points:string, rank:string, fed:string, club:string|null, sscrId:string|null,
 *             fideId:string|null, birthYear:string, games:Array }}
 */
export function parsePlayerCard(html) {
    const $ = cheerio.load(html);
    const headings = $('h2').map((i, e) => cellText($, e)).get().filter(Boolean);
    const tables = $('table.CRs1').toArray();

    const empty = {
        ok: false,
        reason: 'no-data',
        tournamentTitle: headings[0] || '',
        name: '',
        title: '',
        startNo: null,
        rating: '',
        points: '',
        rank: '',
        fed: '',
        club: null,
        sscrId: null,
        fideId: null,
        birthYear: '',
        games: []
    };
    if (!tables.length) return empty;

    // --- tabulka #0: klíč/hodnota, pořadí ani počet řádků nejsou stabilní
    const info = [];
    for (const tr of directRows($, tables[0])) {
        const cells = cellsOf($, tr);
        if (cells.length < 2) continue;
        info.push([cellText($, cells[0]), cellText($, cells[1])]);
    }
    if (!info.length) return empty;

    const byKeys = (keys) => {
        for (const [k, v] of info) if (keys.includes(norm(k))) return v;
        return '';
    };
    const byRegex = (re) => {
        for (const [k, v] of info) if (re.test(k)) return v;
        return '';
    };

    // Klub bez slovníku: řádek hned ZA federací a před "Ident-*".
    // Federace se hledá podle KLÍČE — hledání podle hodnoty /^[A-Z]{3}$/ trefilo
    // řádek "Titul" u titulů AFM/AIM/WFM… a klubem se pak stalo startovní číslo.
    let club = byKeys(CARD_KEYS.club) || null;
    if (!club) {
        const isKey = (k, keys) => keys.includes(norm(k));
        let fedIdx = info.findIndex(([k]) => isKey(k, CARD_KEYS.fed));
        if (fedIdx < 0) {
            fedIdx = info.findIndex(([k, v]) => /^[A-Z]{3}$/.test(v) && !isKey(k, CARD_KEYS.title) && !isKey(k, CARD_KEYS.startNo));
        }
        const identIdx = info.findIndex(([k]) => /^ident/i.test(k));
        if (fedIdx >= 0 && identIdx > fedIdx + 1) {
            const [candidateKey, candidateValue] = info[fedIdx + 1];
            const looksLikeClub = candidateValue
                && !/^\d+([,.]\d+)?$/.test(candidateValue)
                && !isKey(candidateKey, CARD_KEYS.title)
                && !isKey(candidateKey, CARD_KEYS.startNo)
                && !isKey(candidateKey, CARD_KEYS.rank)
                && !isKey(candidateKey, CARD_KEYS.points);
            club = looksLikeClub ? candidateValue : null;
        }
    }

    const sscrRaw = byRegex(/^ident/i);
    const sscrId = sscrRaw && sscrRaw !== '0' ? sscrRaw : null;
    const fideRaw = byRegex(/^fide-?\s?id$/i);
    const fideId = fideRaw && fideRaw !== '0' ? fideRaw : null;

    const startNoRaw = byKeys(CARD_KEYS.startNo);
    const name = byKeys(CARD_KEYS.name);

    // Pojistka: jiný pohled (tabulka pořadí) ani neexistující snr nesmí projít jako karta.
    const looksLikeCard = (name && !BYE_RE.test(name)) || startNoRaw || byKeys(CARD_KEYS.fed);
    if (!looksLikeCard) return { ...empty, reason: 'not-a-card' };

    // --- tabulka #1: partie po kolech
    const games = [];
    if (tables[1]) {
        const trs = directRows($, tables[1]);
        let headerIndex = trs.findIndex((r) => $(r).children('th').length > 0);
        if (headerIndex < 0) headerIndex = 0;
        const headers = rowTexts($, trs[headerIndex]);
        const map = mapColumns(headers);

        for (const tr of trs.slice(headerIndex + 1)) {
            if ($(tr).children('th').length) continue;
            const cells = cellsOf($, tr);
            if (cells.length < 4) continue;
            const texts = cells.map((c) => cellText($, c));
            const pick = (idx) => (idx === undefined || idx >= texts.length ? '' : texts[idx]);

            const oppSnrRaw = pick(map.snr);
            const oppSnr = /^-?\d+$/.test(oppSnrRaw) ? Number(oppSnrRaw) : null;
            const oppName = pick(map.name);

            let color = '';
            let result = '';
            if (map.result !== undefined && cells[map.result]) {
                const cell = $(cells[map.result]);
                if (cell.find('div.FarbewT').length) color = 'white';
                else if (cell.find('div.FarbesT').length) color = 'black';
                result = cellText($, cells[map.result]);
            }

            // Bye/volno se pozná podle záporného startovního čísla nebo textu soupeře —
            // NE podle chybějícího odkazu: turnaje bez odkazů na karty (tnr1196274)
            // by jinak měly každou partii označenou jako bye.
            const isBye = (oppSnr !== null && oppSnr < 0) || !oppName || BYE_RE.test(oppName);

            games.push({
                round: pick(map.round),
                board: pick(map.board),
                opponentStartNo: isBye ? null : oppSnr,
                opponent: oppName,
                opponentRating: pick(map.rating),
                opponentFed: pick(map.fed) || fedFromClass($(tr).attr('class')),
                opponentPoints: pick(map.points),
                result,
                color,
                bye: isBye
            });
        }
    }

    const { lastName, firstName } = splitName(name);

    return {
        ok: true,
        tournamentTitle: headings[0] || '',
        name,
        lastName,
        firstName,
        title: byKeys(CARD_KEYS.title),
        startNo: /^\d+$/.test(startNoRaw) ? Number(startNoRaw) : null,
        rating: byKeys(CARD_KEYS.rating),
        points: byKeys(CARD_KEYS.points),
        rank: byKeys(CARD_KEYS.rank),
        fed: byKeys(CARD_KEYS.fed),
        club,
        sscrId,
        fideId,
        birthYear: byKeys(CARD_KEYS.birthYear),
        games
    };
}

/* ------------------------------------------------------------------ *
 * parseRoundPairings — art=2&rd=N
 * ------------------------------------------------------------------ */

const RESULT_RE = /^\s*[01½+-]\s*-\s*[01½+-]\s*$/;

/**
 * @param {string} html
 * @returns {{ ok:boolean, reason?:string, tournamentTitle:string, viewTitle:string,
 *             headers:string[], rawRows:string[][], pairings:Array }}
 */
export function parseRoundPairings(html) {
    const $ = cheerio.load(html);
    const headings = $('h2').map((i, e) => cellText($, e)).get().filter(Boolean);
    const table = $('table.CRs1').first();
    const empty = {
        ok: false,
        reason: 'no-data',
        tournamentTitle: headings[0] || '',
        viewTitle: headings[1] || '',
        isTeamPairing: false,
        headers: [],
        rawRows: [],
        pairings: []
    };
    if (!table.length) return empty;

    const trs = directRows($, table);
    let headerIndex = trs.findIndex((r) => $(r).children('th').length > 0);
    if (headerIndex < 0) headerIndex = 0;
    const headers = rowTexts($, trs[headerIndex]);

    const dataRows = trs.slice(headerIndex + 1)
        .filter((r) => $(r).children('th').length === 0 && cellsOf($, r).length >= 4);
    if (!dataRows.length) return { ...empty, reason: 'no-rows', headers };

    // Sloupec s výsledkem: podle hlavičky, jinak podle tvaru hodnot ("1 - 0").
    let resultIdx = headers.findIndex((h) => DICT.result.includes(norm(h)));
    if (resultIdx < 0) {
        const width = Math.max(...dataRows.map((r) => cellsOf($, r).length));
        let bestCol = -1;
        let bestHits = 0;
        for (let col = 0; col < width; col++) {
            let hits = 0;
            for (const row of dataRows) {
                const cells = cellsOf($, row);
                if (col < cells.length && RESULT_RE.test(cellText($, cells[col]))) hits++;
            }
            if (hits > bestHits) { bestHits = hits; bestCol = col; }
        }
        resultIdx = bestCol;
    }
    if (resultIdx < 0) return { ...empty, reason: 'no-result-column', headers };

    // Sloupce se jménem/startovním číslem podle HLAVIČKY — na turnajích bez odkazů
    // na karty (tnr1196274) je to jediný způsob, jak jména vůbec získat.
    const headerIdx = (variants, from, to) => {
        for (let i = from; i < to; i++) if (variants.includes(norm(headers[i]))) return i;
        return -1;
    };
    const headerIdxLast = (variants, from, to) => {
        for (let i = to - 1; i >= from; i--) if (variants.includes(norm(headers[i]))) return i;
        return -1;
    };
    const width = Math.max(headers.length, ...dataRows.map((r) => cellsOf($, r).length));

    // Zápas DRUŽSTEV (hlavička "Družstvo | Družstvo") není párování hráčů —
    // startovní čísla by se jinak vytáhla ze skóre zápasu.
    const teamLeft = headerIdxLast(DICT.team, 0, resultIdx);
    const teamRight = headerIdx(DICT.team, resultIdx + 1, width);
    const isTeamPairing = teamLeft >= 0 && teamRight >= 0;

    const whiteNameIdx = isTeamPairing ? teamLeft : headerIdxLast(DICT.name, 0, resultIdx);
    const blackNameIdx = isTeamPairing ? teamRight : headerIdx(DICT.name, resultIdx + 1, width);
    const whiteSnrIdx = isTeamPairing ? -1 : headerIdxLast(DICT.snr, 0, resultIdx);
    const blackSnrIdx = isTeamPairing ? -1 : headerIdx(DICT.snr, resultIdx + 1, width);

    const rawRows = [];
    const pairings = [];
    for (const tr of dataRows) {
        const cells = cellsOf($, tr);
        const texts = cells.map((c) => cellText($, c));
        rawRows.push(texts);

        const left = cells.slice(0, resultIdx);
        const right = cells.slice(resultIdx + 1);
        const at = (idx) => (idx >= 0 && idx < cells.length ? cells[idx] : null);

        // Jméno: sloupec z hlavičky → buňka s odkazem na kartu → text s čárkou.
        const looksLikeName = (c) => {
            const t = cellText($, c);
            return t.length > 2 && /[a-zA-Zá-žÁ-Ž]/.test(t) && !/^\d+([,.]\d+)?$/.test(t);
        };
        const whiteNameCell = at(whiteNameIdx)
            || [...left].reverse().find((c) => $(c).find('a[href*="snr="]').length)
            || [...left].reverse().find(looksLikeName)
            || null;
        const blackNameCell = at(blackNameIdx)
            || right.find((c) => $(c).find('a[href*="snr="]').length)
            || right.find(looksLikeName)
            || null;

        const numeric = (arr) => arr.map((c) => cellText($, c)).filter((t) => /^\d+$/.test(t));
        const fromCell = (cell) => {
            if (!cell) return null;
            const href = snrFromCell($, cell);
            if (href !== null) return href;
            const t = cellText($, cell);
            return /^\d+$/.test(t) ? Number(t) : null;
        };

        let whiteStartNo = fromCell(whiteNameCell) ?? fromCell(at(whiteSnrIdx));
        let blackStartNo = fromCell(blackNameCell) ?? fromCell(at(blackSnrIdx));
        if (!isTeamPairing) {
            // poslední záchrana: druhé číslo zleva / poslední číslo zprava
            const leftNums = numeric(left);
            const rightNums = numeric(right);
            if (whiteStartNo === null && leftNums[1]) whiteStartNo = Number(leftNums[1]);
            if (blackStartNo === null && rightNums.length) blackStartNo = Number(rightNums[rightNums.length - 1]);
        }

        const whiteName = whiteNameCell ? cellText($, whiteNameCell) : '';
        const blackName = blackNameCell ? cellText($, blackNameCell) : '';
        const blackHasPlayer = !!blackName && !BYE_RE.test(blackName);

        pairings.push({
            rowIndex: rawRows.length - 1,
            board: texts[0] || '',
            whiteStartNo,
            whiteName,
            blackStartNo,
            blackName,
            result: texts[resultIdx] || '',
            bye: !blackHasPlayer
        });
    }

    return {
        ok: true,
        tournamentTitle: headings[0] || '',
        viewTitle: headings[1] || '',
        isTeamPairing,
        headers,
        rawRows,
        pairings
    };
}

/* ------------------------------------------------------------------ *
 * Karty hráčů (paralelně, s cache)
 * ------------------------------------------------------------------ */

const MAX_CONCURRENCY = 12;

async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    if (!items.length) return results;
    // Nesmyslný limit (NaN, 0, 500) nesmí spustit nula workerů ani zahltit server.
    const safeLimit = Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : 1;
    const runnerCount = Math.max(1, Math.min(safeLimit || 1, MAX_CONCURRENCY, items.length));
    let cursor = 0;
    const runners = Array.from({ length: runnerCount }, async () => {
        for (;;) {
            const index = cursor++;
            if (index >= items.length) return;
            results[index] = await worker(items[index], index);
        }
    });
    await Promise.all(runners);
    return results;
}

/**
 * Stáhne a naparsuje kartu hráče. Výsledek se cachuje na 10 minut.
 * @param {string} tnr
 * @param {number} snr
 * @param {object} [opts] - { lan, mirror, timeoutMs }
 * @returns {Promise<{ card: object, cached: boolean }>}
 */
export async function fetchPlayerCard(tnr, snr, opts = {}) {
    const { lan = 5, mirror = DEFAULT_MIRROR, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
    const key = `${tnr}:${snr}:${lan}`;
    const hit = cardCache.get(key);
    if (hit && Date.now() - hit.at < CARD_TTL_MS) return { card: hit.card, cached: true };

    const url = normalizeUrl(tnr, { art: 9, snr, lan, mirror });
    const html = await fetchPage(url, { timeoutMs });
    const card = parsePlayerCard(html);
    // Cache bez evikce by po pár festivalech držela tisíce karet do restartu procesu.
    if (cardCache.size >= CARD_CACHE_MAX) {
        for (const [k, v] of cardCache) {
            if (Date.now() - v.at >= CARD_TTL_MS) cardCache.delete(k);
        }
        while (cardCache.size >= CARD_CACHE_MAX) cardCache.delete(cardCache.keys().next().value);
    }
    cardCache.set(key, { at: Date.now(), card });
    return { card, cached: false };
}

/** Vyprázdní cache karet (testy / ruční refresh). */
export function clearCardCache() {
    cardCache.clear();
}

/* ------------------------------------------------------------------ *
 * Watchlist matching
 * ------------------------------------------------------------------ */

/**
 * Připraví watchlist pro porovnávání.
 * @param {Array<{fullName?:string,lastName?:string,sscrId?:string,fideId?:string,club?:string,active?:boolean}>} list
 */
export function normalizeWatchlist(list) {
    return (Array.isArray(list) ? list : [])
        .filter((entry) => entry && entry.active !== false)
        .map((entry) => {
            const raw = String(entry.fullName || entry.name || '').trim();
            const parts = splitName(raw);
            const explicitLast = entry.lastName || '';
            const explicitFirst = entry.firstName || '';

            // Uživatel v adminu zadá stejně často "Příjmení, Jméno" jako "Jméno Příjmení".
            // Bez čárky proto zkoušíme OBĚ pořadí — příjmení se pořád musí shodovat celé.
            const variants = [];
            const push = (lastName, firstName) => {
                const lastKey = lastKeyOf(lastName);
                if (lastKey && !variants.some((v) => v.lastKey === lastKey)) {
                    variants.push({ lastKey, firstName: String(firstName || '') });
                }
            };
            if (explicitLast) push(explicitLast, explicitFirst);
            push(parts.lastName, explicitFirst || parts.firstName);
            if (raw && !raw.includes(',') && !explicitLast) {
                const tokens = raw.split(/\s+/).filter(Boolean);
                if (tokens.length >= 2) {
                    // opačné pořadí: poslední token = příjmení, zbytek = křestní
                    push(tokens[tokens.length - 1], tokens.slice(0, -1).join(' '));
                }
            }

            const primary = variants[0] || { lastKey: '', firstName: '' };
            return {
                fullName: raw,
                lastName: explicitLast || parts.lastName,
                lastKey: primary.lastKey,
                variants,
                sscrId: entry.sscrId ? String(entry.sscrId).trim() : null,
                fideId: entry.fideId ? String(entry.fideId).trim() : null,
                club: entry.club || null
            };
        })
        .filter((entry) => entry.variants.length || entry.sscrId || entry.fideId);
}

/**
 * Shoda jména: příjmení jako CELÝ token (bez diakritiky) + kompatibilní křestní.
 * Zabraňuje false positives typu "Červeň" → "Cerveny"/"Cervenka"
 * i "Fadrný, Jakub" → "Fadrny, Jachym" (dřív stačila shoda první písmeny).
 */
function watchlistNameHit(watchlist, player) {
    const lastKey = lastKeyOf(player.lastName);
    if (!lastKey) return null;
    return watchlist.find((w) => (w.variants || []).some(
        (v) => v.lastKey === lastKey && firstNameCompatible(v.firstName, player.firstName)
    )) || null;
}

function watchlistIdHit(watchlist, card) {
    if (!card) return null;
    return watchlist.find((w) => {
        if (w.sscrId && card.sscrId && w.sscrId === card.sscrId) return true;
        if (w.fideId && card.fideId && w.fideId === card.fideId) return true;
        return false;
    }) || null;
}

/**
 * Shoda klubu — podřetězec, ale jen od ZAČÁTKU slova.
 * "Bižuterie" chytne "TJ Bizuterie Jablonec", ale "nic" už nechytne "Unichess".
 */
const clubMatches = (club, needle) => {
    if (!club || !needle) return false;
    return ` ${deacc(club)} `.includes(` ${needle}`);
};

/* ------------------------------------------------------------------ *
 * scanTournament — hlavní funkce
 * ------------------------------------------------------------------ */

/**
 * Mapa pohledů na art parametr.
 *  standings      → art=1        konečné / aktuální pořadí
 *  rankAfterRound → art=1&rd=N   pořadí po N. kole (stejné sloupce jako pořadí)
 *  crosstable     → art=4&rd=N   křížová tabulka po kole (sloupce 1.Rd, 2.Rd …)
 *  round          → art=2&rd=N   nasazení / výsledky kola
 */
const VIEW_ART = { standings: 1, rankAfterRound: 1, crosstable: 4, round: 2 };
const ROUND_VIEWS = new Set(['rankAfterRound', 'crosstable', 'round']);

/**
 * Číslo kola z nadpisu pohledu ("Pořadí po 3 kole", "Final Ranking after 9 Rounds",
 * "Nasazení hráčů 5 kolo", "Pairings for round 5").
 * @param {string} title
 * @returns {number|null}
 */
export function roundFromTitle(title) {
    const t = String(title ?? '');
    const before = t.match(/(\d+)\s*\.?\s*(kole|kolech|kola|kolo|rounds?|runden?|rd)\b/i);
    if (before) return Number(before[1]);
    const after = t.match(/\b(kolo|kola|round|runde)\s*\.?\s*(\d+)/i);
    return after ? Number(after[2]) : null;
}

/**
 * Prohledá turnaj a vrátí naše hráče (klub NEBO watchlist) + tabulku pro vložení.
 *
 * @param {string} tnrOrUrl
 * @param {object} [opts]
 * @param {'standings'|'rankAfterRound'|'round'} [opts.view='standings']
 * @param {number|null} [opts.round]
 * @param {number|string} [opts.lan=5]
 * @param {string} [opts.mirror='s2']
 * @param {string} [opts.clubQuery='Bižuterie']
 * @param {string[]} [opts.fedFilter=['CZE']] - prázdné pole = bez předfiltru
 * @param {Array} [opts.watchlist=[]]
 * @param {number} [opts.concurrency=8]
 * @param {boolean} [opts.useCards=true]
 * @param {boolean} [opts.forceCards=false] - stáhnout karty i když tabulka má sloupec klubu
 * @returns {Promise<object>}
 */
export async function scanTournament(tnrOrUrl, opts = {}) {
    const {
        view = 'standings',
        round = null,
        lan = 5,
        mirror = DEFAULT_MIRROR,
        clubQuery = 'Bižuterie',
        fedFilter = ['CZE'],
        watchlist = [],
        concurrency = 8,
        useCards = true,
        forceCards = false,
        timeoutMs = DEFAULT_TIMEOUT_MS
    } = opts;

    const started = Date.now();
    const raw = String(tnrOrUrl ?? '').trim();
    // URL na vstupu musí být z chess-results — jinak by se z cizí adresy vytáhlo
    // číslo a tiše by se naskenoval úplně jiný turnaj.
    if (/^[a-z]+:\/\//i.test(raw) && !isChessResultsUrl(raw)) {
        throw new Error('URL musí být z chess-results.com');
    }
    const tnr = extractTnr(raw);
    if (!tnr) throw new Error('Neplatné číslo turnaje');
    if (!VIEW_ART[view]) throw new Error(`Neznámý pohled: ${view}`);
    if (ROUND_VIEWS.has(view) && !round) {
        throw new Error('Pro pohled po kole je nutné zadat číslo kola');
    }

    const warnings = [];
    const stats = {
        tableRows: 0,
        candidates: 0,
        cardsFetched: 0,
        cardsCached: 0,
        cardsFailed: 0,
        skippedByFed: 0,
        usedCards: false,
        durationMs: 0
    };

    // --- 1) identifikační tabulka: art=1 (má snr, FED a případně klub)
    let standingsArt = 1;
    let standings = parseStandings(await fetchPage(normalizeUrl(tnr, { art: 1, lan, mirror }), { timeoutMs }));

    // Týmová soutěž: art=1 jsou soupisky družstev (bez odkazů na karty).
    // art=4 = pořadí jednotlivců — má jméno, družstvo i odkaz se startovním číslem.
    // Když už art=1 odkazy na karty má, druhý request je zbytečný (ušetří ~300 ms).
    const needsHrefs = useCards && !standings.rows.some((r) => r.startNoSource === 'href');
    if (!standings.ok || (standings.isTeam && needsHrefs)) {
        const alt = parseStandings(await fetchPage(normalizeUrl(tnr, { art: 4, lan, mirror }), { timeoutMs }));
        if (alt.ok && (!standings.ok || alt.rows.some((r) => r.startNoSource === 'href'))) {
            standings = alt;
            standingsArt = 4;
        }
    }
    // Neodehraný turnaj: pořadí je prázdné, ale startovní listina (art=0) existuje
    // a bývá i s klubem — "kdo z nás je přihlášen" je legitimní dotaz.
    if (!standings.ok && view === 'standings') {
        const startlist = parseStandings(await fetchPage(normalizeUrl(tnr, { art: 0, lan, mirror }), { timeoutMs }));
        if (startlist.ok) {
            standings = startlist;
            standingsArt = 0;
            warnings.push('Turnaj zatím nemá výsledky — použita startovní listina.');
        }
    }
    if (!standings.ok) {
        throw new Error('Turnaj nemá dostupnou tabulku výsledků (neodehraný nebo neexistující).');
    }
    stats.tableRows = standings.rows.length;
    stats.isStartlist = standingsArt === 0;

    // --- 2) kandidáti
    const wl = normalizeWatchlist(watchlist);
    const needle = deacc(clubQuery);
    const fedSet = new Set((Array.isArray(fedFilter) ? fedFilter : []).map((f) => String(f).toUpperCase()));

    /** @type {Map<number|string, object>} */
    const matched = new Map();
    // Klíč přes startovní číslo, jinak přes index řádku — jmenovci ve stejné soutěži
    // (dva "Babula, Vlastimil", dva "Svoboda, Petr") se jinak slili do jednoho záznamu.
    const keyOf = (player) => (player.startNo ?? `r:${player.rowIndex}`);

    const addMatch = (player, reason, source, extra = {}) => {
        const key = keyOf(player);
        const existing = matched.get(key);
        if (existing) {
            if (!existing.sources.includes(source)) existing.sources.push(source);
            if (reason === 'klub') existing.reason = 'klub';
            Object.assign(existing, Object.fromEntries(Object.entries(extra).filter(([, v]) => v != null && v !== '')));
            return existing;
        }
        const entry = {
            startNo: player.startNo,
            rank: player.rank,
            name: player.name,
            lastName: player.lastName,
            firstName: player.firstName,
            title: player.title,
            fed: player.fed,
            rating: player.rating,
            points: player.points,
            club: player.club || null,
            sscrId: null,
            fideId: null,
            reason,
            sources: [source],
            rowIndex: player.rowIndex,
            ...extra
        };
        matched.set(key, entry);
        return entry;
    };

    // Záznam ve watchlistu, který má JEN ident-číslo / FIDE-ID (bez jména), nelze
    // rozpoznat z tabulky — jde vidět až v kartě. Takový watchlist proto ruší
    // zkratky "tabulka má klub" i předfiltr federace, jinak by hráč tiše vypadl.
    const idOnlyWatch = wl.some((w) => !w.variants.length && (w.sscrId || w.fideId));

    const cardTargets = [];
    for (const player of standings.rows) {
        const nameHit = wl.length ? watchlistNameHit(wl, player) : null;
        const idHit = wl.length && player.fideId ? wl.find((w) => w.fideId && w.fideId === player.fideId) : null;
        const columnClubHit = clubMatches(player.club, needle);

        if (columnClubHit) addMatch(player, 'klub', 'club-column', { fideId: player.fideId });
        if (nameHit || idHit) {
            addMatch(player, columnClubHit ? 'klub' : 'sledovaný', 'watchlist', {
                fideId: player.fideId, watchlistName: (nameHit || idHit).fullName
            });
        }

        if (!useCards || player.startNo === null || standings.isTeamRanking) continue;
        // Startovní číslo musí být důvěryhodné — jinak by art=9&snr=N ukázal na jiného hráče.
        if (player.startNoSource !== 'href' && !standings.snrColumnReliable) continue;

        // Karty: watchlist zásah vždy (kvůli ověření ident-čísla), jinak jen když
        // klub v tomto ŘÁDKU chybí. Sloupec klubu bývá vyplněný jen z části
        // (Brasov 77/197) a název družstva se za klub nepočítá.
        const rowClub = standings.hasClubColumn ? player.club : null;
        const clubKnown = !!(rowClub && String(rowClub).trim());
        if (clubKnown && !forceCards && !nameHit && !idOnlyWatch) continue;

        // Předfiltr federace ušetří stovky requestů; hráč z watchlistu jím nesmí propadnout.
        const fed = String(player.fed || '').toUpperCase();
        const passesFed = fedSet.size === 0 || !fed || fedSet.has(fed);
        if (!passesFed && !nameHit && !idOnlyWatch) { stats.skippedByFed++; continue; }

        cardTargets.push(player);
    }

    stats.candidates = cardTargets.length;

    // Když se klub nedá zjistit ani ze sloupce, ani z karty (týmové soupisky bez
    // odkazů na karty), musí to UI vědět — prázdný výsledek jinak vypadá jako
    // "nikdo z nás tam nehrál".
    const cardsPossible = !standings.isTeamRanking && standings.rows.some(
        (r) => r.startNo !== null && (r.startNoSource === 'href' || standings.snrColumnReliable)
    );
    if (useCards && !cardsPossible && !standings.clubColumnComplete && standings.rows.length) {
        warnings.push(standings.isTeamRanking
            ? 'Tabulka obsahuje pořadí družstev, ne jednotlivce — hledá se jen podle názvu družstva.'
            : 'U této soutěže nejde zjistit registrační klub hráčů (chybí odkazy na karty) — hledá se jen podle názvu družstva a jmen ze sledovaných hráčů.');
    }

    // --- 3) karty paralelně
    if (cardTargets.length) {
        stats.usedCards = true;
        await mapLimit(cardTargets, concurrency, async (player) => {
            try {
                const { card, cached } = await fetchPlayerCard(tnr, player.startNo, { lan, mirror, timeoutMs });
                if (cached) stats.cardsCached++; else stats.cardsFetched++;
                if (!card.ok) return;
                // Pojistka proti špatně odvozenému startovnímu číslu.
                if (card.name && deacc(card.name) !== deacc(player.name)) {
                    warnings.push(`karta snr=${player.startNo} patří jinému hráči (${card.name} ≠ ${player.name}), ignorováno`);
                    return;
                }

                const cardClubHit = clubMatches(card.club, needle);
                const idHit = wl.length ? watchlistIdHit(wl, card) : null;
                const nameHit = wl.length ? watchlistNameHit(wl, player) : null;

                if (cardClubHit) {
                    addMatch(player, 'klub', 'player-card', { club: card.club, sscrId: card.sscrId, fideId: card.fideId });
                }
                if (idHit) {
                    addMatch(player, cardClubHit ? 'klub' : 'sledovaný', 'watchlist', {
                        club: card.club, sscrId: card.sscrId, fideId: card.fideId, watchlistName: idHit.fullName
                    });
                }
                if (nameHit && matched.has(keyOf(player))) {
                    const entry = matched.get(keyOf(player));
                    entry.club = entry.club || card.club || null;
                    entry.sscrId = entry.sscrId || card.sscrId;
                    entry.fideId = entry.fideId || card.fideId;
                }
            } catch (error) {
                stats.cardsFailed++;
                warnings.push(`karta hráče snr=${player.startNo} nedostupná (${error.message})`);
            }
        });
        // Když se část karet nenačte, výsledek NENÍ kompletní a UI to musí říct —
        // jinak vypadá "0 našich hráčů" jako ověřený fakt.
        if (stats.cardsFailed) {
            stats.incomplete = true;
            warnings.push(`Nepodařilo se načíst ${stats.cardsFailed} z ${cardTargets.length} karet — seznam hráčů nemusí být úplný.`);
        }
    }

    // --- 4) tabulka pro požadovaný pohled
    let table;
    if (view === 'standings') {
        table = {
            view,
            round: null,
            viewTitle: standings.viewTitle,
            headers: standings.headers,
            rows: standings.rawRows
        };
        for (const entry of matched.values()) {
            const source = standings.rows.find((r) => keyOf(r) === keyOf(entry));
            entry.rowIndex = source ? source.rowIndex : null;
        }
    } else if (view === 'rankAfterRound' || view === 'crosstable') {
        const art = VIEW_ART[view];
        let viewData = parseStandings(await fetchPage(normalizeUrl(tnr, { art, rd: round, lan, mirror }), { timeoutMs }));
        if (!viewData.ok && view === 'rankAfterRound') {
            // Některé turnaje nabízejí pořadí po kole jen jako křížovou tabulku.
            viewData = parseStandings(await fetchPage(normalizeUrl(tnr, { art: 4, rd: round, lan, mirror }), { timeoutMs }));
        }
        if (!viewData.ok) throw new Error(`Pořadí po ${round}. kole není k dispozici.`);

        // Server u dohraných turnajů parametr rd často ignoruje a vrátí konečný stav.
        // Skutečné kolo je v nadpisu — nesmí se do článku dostat nadpis "po 4. kole"
        // nad daty po 3. kole.
        const actualRound = roundFromTitle(viewData.viewTitle);
        if (actualRound !== null && actualRound !== round) {
            warnings.push(`Server pro ${round}. kolo vrátil data po ${actualRound}. kole (${viewData.viewTitle}).`);
        }
        table = {
            view,
            round: actualRound ?? round,
            requestedRound: round,
            viewTitle: viewData.viewTitle,
            headers: viewData.headers,
            rows: viewData.rawRows
        };
        for (const entry of matched.values()) {
            const source = viewData.rows.find((r) =>
                (entry.startNo !== null && r.startNo !== null && r.startNo === entry.startNo) ||
                (lastKeyOf(r.lastName) === lastKeyOf(entry.lastName) &&
                    lastKeyOf(r.lastName) !== '' &&
                    firstNameCompatible(r.firstName, entry.firstName))
            );
            entry.rowIndex = source ? source.rowIndex : null;
            // Pořadí i body musí odpovídat ZOBRAZENÉ tabulce, ne konečnému pořadí.
            if (source) {
                entry.rank = source.rank;
                entry.points = source.points;
            }
        }
    } else {
        const viewData = parseRoundPairings(await fetchPage(normalizeUrl(tnr, { art: 2, rd: round, lan, mirror }), { timeoutMs }));
        if (!viewData.ok) throw new Error(`Výsledky ${round}. kola nejsou k dispozici.`);
        const actualRound = roundFromTitle(viewData.viewTitle);
        if (actualRound !== null && actualRound !== round) {
            warnings.push(`Server pro ${round}. kolo vrátil data ${actualRound}. kola (${viewData.viewTitle}).`);
        }
        table = {
            view,
            round: actualRound ?? round,
            requestedRound: round,
            viewTitle: viewData.viewTitle,
            headers: viewData.headers,
            rows: viewData.rawRows
        };
        if (viewData.isTeamPairing) {
            // Zápasy DRUŽSTEV nejsou párování hráčů — dřív se na první řádek
            // (null === null) navěsili úplně všichni nalezení hráči.
            warnings.push('V tomto kole se páruje po družstvech, ne po hráčích — jednotliví hráči se v tabulce nezvýrazní.');
            for (const entry of matched.values()) entry.rowIndex = null;
        } else {
            for (const entry of matched.values()) {
                const byStartNo = entry.startNo === null ? null : viewData.pairings.find(
                    (p) => p.whiteStartNo === entry.startNo || p.blackStartNo === entry.startNo
                );
                const nameMatches = (value) => {
                    const parts = splitName(value);
                    return lastKeyOf(parts.lastName) !== '' &&
                        lastKeyOf(parts.lastName) === lastKeyOf(entry.lastName) &&
                        firstNameCompatible(parts.firstName, entry.firstName);
                };
                const pairing = byStartNo || viewData.pairings.find(
                    (p) => nameMatches(p.whiteName) || nameMatches(p.blackName)
                ) || null;

                entry.rowIndex = pairing ? pairing.rowIndex : null;
                if (pairing) {
                    const isWhite = entry.startNo !== null && pairing.whiteStartNo === entry.startNo
                        ? true
                        : (entry.startNo !== null && pairing.blackStartNo === entry.startNo ? false : nameMatches(pairing.whiteName));
                    entry.color = isWhite ? 'white' : 'black';
                    entry.opponent = isWhite ? pairing.blackName : pairing.whiteName;
                    entry.roundResult = pairing.result;
                }
            }
        }
    }

    stats.durationMs = Date.now() - started;

    const players = [...matched.values()].sort((a, b) => {
        const ra = Number(String(a.rank).replace(/[^\d]/g, '')) || 9999;
        const rb = Number(String(b.rank).replace(/[^\d]/g, '')) || 9999;
        return ra - rb;
    });

    return {
        tnr,
        name: standings.tournamentTitle,
        url: normalizeUrl(tnr, { art: view === 'standings' ? standingsArt : VIEW_ART[view], rd: round, lan, mirror }),
        isTeam: standings.isTeam,
        hasClubColumn: standings.hasClubColumn,
        hasTeamColumn: standings.hasTeamColumn,
        table,
        players,
        stats,
        warnings
    };
}

/**
 * Fáze 1 — načte a rozpozná index festivalu z libovolné URL turnaje.
 * @param {string} urlOrTnr
 * @param {object} [opts] - { lan, mirror, timeoutMs }
 */
export async function getTournamentIndex(urlOrTnr, opts = {}) {
    const { lan = 5, mirror = DEFAULT_MIRROR, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;
    const raw = String(urlOrTnr ?? '').trim();
    if (/^[a-z]+:\/\//i.test(raw) && !isChessResultsUrl(raw)) {
        throw new Error('URL musí být z chess-results.com');
    }
    const url = normalizeUrl(raw, { art: 1, lan, mirror });
    const html = await fetchPage(url, { timeoutMs });
    const index = parseTournamentIndex(html, url);
    if (!index.found) throw new Error('Turnaj s tímto číslem na chess-results.com neexistuje.');
    return index;
}

export default {
    deacc,
    splitName,
    extractTnr,
    normalizeUrl,
    fetchPage,
    mapColumns,
    roundFromTitle,
    parseTournamentIndex,
    parseStandings,
    parsePlayerCard,
    parseRoundPairings,
    fetchPlayerCard,
    clearCardCache,
    normalizeWatchlist,
    scanTournament,
    getTournamentIndex
};
