// Dashboard soustředění Pardubice — vykreslí snapshot z /api/camp/pardubice
(() => {
    const API = window.API_URL || '/api';
    const root = document.getElementById('pdRoot');
    const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
    const fmtPts = (n) => (n === null || n === undefined) ? '?' : String(n).replace('.', ',');
    const TOTAL_ROUNDS = 9;
    // české skloňování: 1 bod · 2-4 body · 5+ bodů · desetinné 2,5 bodu
    const bodySlovo = (n) => {
        if (n === null || n === undefined) return 'bodů';
        if (!Number.isInteger(n)) return 'bodu';
        if (n === 1) return 'bod';
        if (n >= 2 && n <= 4) return 'body';
        return 'bodů';
    };
    const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

    // odkaz na kompletní los kola na chess-results (art=2 = párování)
    const crRound = (tnr, rd) => `https://chess-results.com/tnr${tnr}.aspx?lan=5&art=2&rd=${rd}&zeilen=99999`;
    const crStandings = (tnr) => `https://chess-results.com/tnr${tnr}.aspx?lan=5&art=1&zeilen=99999`;

    // výsledek partie z pohledu našeho hráče
    function myResult(g) {
        const r = String(g.result || '').trim();
        if (g.bye) return { cls: 'n', txt: '–', word: 'volno' };
        if (/^(1|\+)$/.test(r)) return { cls: 'w', txt: 'V', word: 'výhra' };
        if (/^(0|-)$/.test(r)) return { cls: 'l', txt: 'P', word: 'prohra' };
        if (/½|0[.,]5/.test(r)) return { cls: 'd', txt: 'R', word: 'remíza' };
        return { cls: 'n', txt: '·', word: '' };
    }

    // výsledek z tabulky párování ("1 - 0" apod.) z pohledu našeho hráče.
    // Bez výsledku záleží na fázi kola: čerstvý los se teprve BUDE hrát (často
    // až druhý den), rozehrané kolo se hraje teď.
    function pairingResult(p, roundState) {
        const r = String(p.result || '').trim();
        if (!r || /^\s*-\s*$/.test(r)) {
            return roundState === 'fresh'
                ? { cls: 'n', txt: startLabel(), pending: true }
                : { cls: 'n', txt: 'hraje se', pending: true };
        }
        const [a, b] = r.split('-').map(x => x.trim());
        const mine = p.color === 'white' ? a : b;
        const theirs = p.color === 'white' ? b : a;
        if (mine === undefined || theirs === undefined) return { cls: 'n', txt: r };
        if (/½/.test(mine)) return { cls: 'd', txt: 'remíza' };
        if (parseFloat(mine) > parseFloat(theirs)) return { cls: 'w', txt: 'výhra' };
        if (parseFloat(mine) < parseFloat(theirs)) return { cls: 'l', txt: 'prohra' };
        return { cls: 'd', txt: 'remíza' };
    }

    // chess-results připisuje ke jménu " *)" (hráč na stálé šachovnici). Server to
    // odstraňuje, tohle je pojistka na dobu, než se přestaví uložený snapshot.
    const cleanName = (s) => String(s || '').replace(/ /g, ' ').replace(/\s*\*\)\s*$/, '').replace(/\s+/g, ' ').trim();

    /**
     * Soupeř. Odkaz do databáze partií vznikne, jen když v ní opravdu nějaké má —
     * jinak by kliknutí skončilo prázdnou stránkou. Jako „příprava" (s lupou) se
     * nabízí u kola, které se teprve bude hrát; u dohrané partie je to už jen
     * prohlédnutí soupeře.
     */
    function oppCell(g, color, played) {
        const name = cleanName(g?.opponent);
        if (!name) return '<span class="pd-opp">volno</span>';
        if (!g.opponentDbGames) return `<span class="pd-opp">${esc(name)}</span>`;

        const url = `/chess-database.html?player=${encodeURIComponent(g.opponentDbName || name)}&color=${color}`;
        const barva = color === 'black' ? 'černé' : 'bílé';
        const kolik = `${g.opponentDbGames} ${g.opponentDbGames === 1 ? 'partie' : (g.opponentDbGames < 5 ? 'partie' : 'partií')} v naší databázi`;
        if (played) return `<a class="pd-oppl" href="${url}" title="${kolik}">${esc(name)}</a>`;
        return `<a class="pd-prep" href="${url}" title="Příprava — jeho partie za ${barva} (${kolik})">${esc(name)}<i class="fa-solid fa-magnifying-glass"></i></a>`;
    }

    // ---------- čas ----------
    function pragueNow() {
        const f = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const [h, m, s] = f.format(new Date()).split(':').map(Number);
        return { h, m, s };
    }
    // Kola začínají v 15:00 (poslední ve 13:00)
    function secsToNextRound() {
        const { h, m, s } = pragueNow();
        let secs = (15 - h) * 3600 - m * 60 - s;
        if (secs <= 0) secs += 24 * 3600;
        return secs;
    }
    const pad2 = (n) => String(n).padStart(2, '0');
    // Los bývá venku po dohrání večerního kola — hraje se pak až nazítří.
    const startLabel = () => (pragueNow().h < 15 ? 'dnes 15:00' : 'zítra 15:00');

    function renderClock(label) {
        const t = secsToNextRound();
        return `<div class="pd-stat" id="pdClock" style="justify-content:flex-start;">
            <div class="pd-label gold">${label}</div>
            <div class="pd-clock">
                <div class="pd-tick"><b data-c="h">${pad2(Math.floor(t / 3600))}</b><span>HOD</span></div>
                <div class="pd-tick"><b data-c="m">${pad2(Math.floor(t / 60) % 60)}</b><span>MIN</span></div>
                <div class="pd-tick gold"><b data-c="s">${pad2(t % 60)}</b><span>SEK</span></div>
            </div>
        </div>`;
    }
    let clockTimer = null;
    function startClock() {
        if (clockTimer) clearInterval(clockTimer);
        clockTimer = setInterval(() => {
            const box = document.getElementById('pdClock');
            if (!box) return clearInterval(clockTimer);
            const t = secsToNextRound();
            box.querySelector('[data-c="h"]').textContent = pad2(Math.floor(t / 3600));
            box.querySelector('[data-c="m"]').textContent = pad2(Math.floor(t / 60) % 60);
            box.querySelector('[data-c="s"]').textContent = pad2(t % 60);
        }, 1000);
    }

    // ---------- HERO ----------
    function renderHero(d) {
        const s = d.stats || {};
        const cur = d.tournaments.find(t => t.roundState === 'playing')
            || d.tournaments.find(t => t.currentRound) || {};
        const rd = cur.currentRound || 0;
        const pending = d.tournaments.find(t => t.nextRoundPending);
        // turnaje se losují nezávisle — čerstvý los hlas s JEHO číslem kola, ne s číslem toho, co se hraje
        const fresh = d.tournaments.find(t => t.roundState === 'fresh' && (t.pairings || []).length);

        const state = fresh
            ? { txt: `Los ${fresh.currentRound}. kola je venku`, live: true }
            : cur.roundState === 'playing'
                ? { txt: `Právě se hraje ${rd}. kolo`, live: true }
                : pending
                    ? { txt: `Čekáme na los ${pending.nextRoundPending}. kola`, live: false }
                    : { txt: rd ? `${rd}. kolo dohráno` : 'Turnaj začíná', live: false };

        const nextRd = pending?.nextRoundPending || (rd ? Math.min(rd + 1, TOTAL_ROUNDS) : 1);
        const avg = s.players ? (s.points / s.players) : 0;
        // pozice se porovnávají napříč různě velkými turnaji — proto k ní patří i turnaj
        const best = d.tournaments
            .flatMap(t => (t.players || []).map(p => ({ ...p, code: t.code, field: t.fieldSize })))
            .filter(p => p.rank).sort((a, b) => a.rank - b.rank)[0];
        // pill ukazuje kolo, o kterém se zrovna mluví
        const pillRd = fresh?.currentRound || rd;

        return `<section class="pd-hero">
            <div class="pd-heroin">
                <div style="display:flex; flex-wrap:wrap; align-items:center; gap:10px;">
                    <div class="pd-eyebrow">TJ Bižuterie Jablonec · mládež</div>
                    <div style="width:22px; height:1px; background:#4a3c19;"></div>
                    <div style="font:500 11px/1 Inter,sans-serif; letter-spacing:.16em; text-transform:uppercase; color:#8d8d95;">vrchol sezóny</div>
                </div>

                <h1 class="pd-title">Soustředění<br><span>Pardubice</span></h1>

                <p class="pd-hsub">Czech Open 2026 · 24.&nbsp;7.&nbsp;–&nbsp;1.&nbsp;8. · Idea&nbsp;Arena Pardubice<br>
                    ${s.players || 0} hráčů z Jablonce, devět kol, jeden týden šachu od rána do večera.</p>

                <div style="display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-top:22px;">
                    <div class="pd-pill gold"><span class="pd-dot${state.live ? ' live' : ''}"></span>${esc(state.txt)}</div>
                    ${pillRd ? `<div class="pd-pill">${pillRd}. kolo z ${TOTAL_ROUNDS} · začátek 15:00</div>` : ''}
                    <a class="pd-cr" href="/puzzle-racer"><i class="fa-solid fa-bolt"></i> Zahrát si rozcvičku</a>
                </div>

                <div class="pd-hstats">
                    ${renderClock(`Do ${nextRd}. kola zbývá`)}
                    <div class="pd-duo">
                        <div class="pd-stat">
                            <div class="pd-label">Bodů celkem</div>
                            <div class="pd-num gold">${fmtPts(s.points)}</div>
                            <div class="pd-note">z ${s.games || 0} odehraných partií</div>
                        </div>
                        <div class="pd-stat">
                            <div class="pd-label">Průměr / hráč</div>
                            <div class="pd-num">${fmtPts(Math.round(avg * 10) / 10)}</div>
                            <div class="pd-note">${s.players ? `napříč ${s.players} hráči` : 'před startem'}</div>
                        </div>
                    </div>
                    <div class="pd-duo">
                        <div class="pd-stat">
                            <div class="pd-label">Nejlepší pozice</div>
                            <div class="pd-num">${best ? best.rank + '.' : '–'}</div>
                            <div class="pd-note">${best ? `${esc(best.name)}${best.field ? ` · z ${best.field}` : ''}` : ''}</div>
                        </div>
                        <div class="pd-stat">
                            <div class="pd-label">Úspěšnost</div>
                            <div class="pd-num">${s.scorePct ?? '–'}&nbsp;%</div>
                            <div class="pd-note">získaných bodů z možných</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
    }

    // ---------- LOS ----------
    function renderPairings(d) {
        const withPairs = d.tournaments.filter(t => (t.pairings || []).length);
        const pending = d.tournaments.filter(t => t.nextRoundPending);
        const rd = withPairs[0]?.currentRound || pending[0]?.nextRoundPending || 0;
        const allFinished = withPairs.length && withPairs.every(t => t.roundState === 'finished');
        // turnaje se losují nezávisle — číslo kola do nadpisu jen když je všude stejné
        const sameRound = withPairs.length && withPairs.every(t => t.currentRound === rd);

        const head = `<div class="pd-eyebrow">${allFinished ? 'Poslední kolo' : 'Los dalšího kola'}</div>
            <h2 class="pd-h2">${allFinished
                ? (sameRound ? `Jak dopadlo ${rd}. kolo` : 'Jak dopadlo poslední kolo')
                : (sameRound ? `Kdo hraje s kým v ${rd}. kole` : 'Kdo hraje s kým')}</h2>`;

        if (!withPairs.length) {
            return `<section class="pd-sec">${head}
                <div class="pd-empty">
                    <h3>Los ${rd ? rd + '. kola ' : ''}ještě není venku</h3>
                    <p>Rozhodčí ho vydává obvykle 30–45 minut před začátkem kola. Jakmile bude na chess-results, objeví se tady i v telefonu — stránka se hlídá sama, nemusíte mačkat F5.</p>
                    <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap; margin-top:16px;">
                        <a class="pd-btn" href="#notifikace">Dej mi vědět, až bude venku</a>
                    </div>
                    <div class="pd-skel"><i></i><i></i><i></i></div>
                </div>
            </section>`;
        }

        // příprava se nabízí jen na kolo, které se teprve bude hrát
        // text o přípravě jen když je opravdu na co kliknout
        const anyPrep = withPairs.some(t => t.roundState === 'fresh' && t.pairings.some(p => p.opponentDbGames));

        const groups = withPairs.map(t => {
            const link = `<a class="pd-cr" href="${crRound(t.tnr, t.currentRound)}" target="_blank" rel="noopener">
                <i class="fa-solid fa-table-list"></i> Celý los ${t.currentRound}. kola</a>`;
            const cards = t.pairings.map(p => {
                const res = pairingResult(p, t.roundState);
                // příprava (lupa) jen na kolo, které se teprve bude hrát — u rozehraného
                // ani dohraného kola už není na co se připravovat
                const played = t.roundState !== 'fresh';
                return `<div class="pd-board">
                    <div class="pd-bhead">
                        <span class="pd-chip">DESKA ${p.board || '?'}</span>
                        <span style="flex:1;"></span>
                        <span class="pd-color"><span class="pd-disc${p.color === 'white' ? '' : ' b'}"></span>${p.color === 'white' ? 'bílé' : 'černé'}</span>
                    </div>
                    <div class="pd-bme">${esc(p.name)}</div>
                    <div class="pd-bvs">
                        <span class="pd-vslab">VS</span>
                        ${oppCell(p, p.opponentColor, played)}
                        ${p.opponentRating ? `<span class="pd-orat">${p.opponentRating}</span>` : ''}
                        <span style="flex:1;"></span>
                        <span class="pd-r ${res.cls}">${res.txt}</span>
                    </div>
                </div>`;
            }).join('');
            // každý turnaj může být v jiné fázi — ať je vidět, na co se zrovna kouká
            const stav = t.roundState === 'fresh'
                ? `<span class="pd-pill gold"><span class="pd-dot"></span>Los ${t.currentRound}. kola · ${startLabel()}</span>`
                : t.roundState === 'playing'
                    ? `<span class="pd-pill"><span class="pd-dot live"></span>${t.currentRound}. kolo se hraje</span>`
                    : `<span class="pd-pill">${t.currentRound}. kolo dohráno${t.nextRoundPending ? ` · čekáme na los ${t.nextRoundPending}.` : ''}</span>`;

            return `<div class="pd-thead">
                    <div class="pd-tname"><b>Turnaj ${esc(t.code)}</b><span>${esc(shortName(t))}</span></div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">${stav}${link}</div>
                </div>
                <div class="pd-grid">${cards}</div>`;
        }).join('');

        const waiting = pending.length
            ? `<p class="pd-note" style="margin-top:16px;"><i class="fa-regular fa-clock"></i> Los ${pending[0].nextRoundPending}. kola
                ${pending.length > 1 ? `(turnaje ${pending.map(t => esc(t.code)).join(', ')})` : `(turnaj ${esc(pending[0].code)})`} zatím není venku —
                <a href="#notifikace" style="color:#e6c565;">dejte si upozornění</a>.</p>`
            : '';

        return `<section class="pd-sec">
            <div style="display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:14px;">
                <div>${head}</div>
                <div class="pd-pill">Zdroj: chess-results.com</div>
            </div>
            ${anyPrep ? '<p class="pd-lead">Na jméno soupeře se dá kliknout — otevře se příprava v naší databázi partií, rovnou v barvě, kterou bude mít.</p>' : ''}
            ${groups}
            ${waiting}
        </section>`;
    }

    const shortName = (t) => (t.name || '').replace(/^CZECH OPEN 2026 ?- ?/i, '').replace(/^[A-Z]\d* ?- ?/, '')
        + (t.fieldSize ? ` · ${t.fieldSize} hráčů` : '');

    // ---------- HRÁČI ----------
    function renderPlayers(d) {
        const body = d.tournaments.map(t => {
            if (!t.players?.length) return '';
            const sorted = [...t.players].sort((a, b) => (b.points || 0) - (a.points || 0));
            const rd = t.currentRound || 0;
            const cards = sorted.map(p => {
                if (p.error) return `<div class="pd-p"><div class="pd-pname">${esc(p.name)}</div><div class="pd-pmeta" style="color:#d69a9a;">data se nepodařilo načíst</div></div>`;
                const byRound = new Map((p.games || []).map(g => [Number(g.round), g]));
                const chips = Array.from({ length: rd || (p.games || []).length }, (_, i) => {
                    const n = i + 1;
                    const g = byRound.get(n);
                    if (!g) return `<span class="pd-r n" title="${n}. kolo — zatím se hraje">${n} · ?</span>`;
                    const r = myResult(g);
                    return `<span class="pd-r ${r.cls}" title="${n}. kolo — ${r.word || 'zatím se hraje'}${g.opponent ? ' s ' + esc(g.opponent) : ''}">${n} · ${r.txt === '·' ? '?' : r.txt}</span>`;
                }).join('');

                const games = (p.games || []).filter(g => !g.bye).map(g => {
                    const r = myResult(g);
                    const white = g.color === 'white' || g.color === 'w';
                    return `<div class="pd-g">
                        <span class="rd">${g.round}. K</span>
                        <span style="flex:0 0 auto; display:inline-flex; align-items:center; gap:4px;">
                            <span class="pd-disc sm${white ? '' : ' b'}"></span>
                            <span style="font:600 10px Inter,sans-serif; color:#8d8d95;">${white ? 'b' : 'č'}</span>
                        </span>
                        <span class="op">${oppCell(g, white ? 'black' : 'white', true)}</span>
                        ${g.opponentRating ? `<span class="rt">${g.opponentRating}</span>` : ''}
                        <span class="pd-r ${r.cls}">${r.txt}</span>
                    </div>`;
                }).join('');

                return `<div class="pd-p">
                    <div class="pd-ptop">
                        <div class="pd-av">${esc(initials(p.name))}</div>
                        <div style="flex:1; min-width:0;">
                            <div class="pd-pname">${esc(p.name)}</div>
                            <div class="pd-pmeta">${p.rating ? `ELO ${p.rating}` : 'bez ELO'}${p.rank ? ` · ${p.rank}. z ${t.fieldSize || '?'}` : ''}${p.role ? ` · ${esc(p.role)}` : ''}</div>
                        </div>
                        <div class="pd-ppts">
                            <b>${fmtPts(p.points)}</b>
                            <div class="pd-micro" style="margin-top:4px;">${bodySlovo(p.points).toUpperCase()}</div>
                        </div>
                    </div>
                    ${chips ? `<div class="pd-rounds">${chips}</div>` : ''}
                    ${games ? `<div class="pd-glist">
                        <div class="pd-ghead"><span>Odehrané partie</span></div>
                        <div style="display:flex; flex-direction:column; gap:2px;">${games}</div>
                    </div>` : ''}
                </div>`;
            }).join('');

            return `<div class="pd-thead">
                    <div class="pd-tname"><b>Turnaj ${esc(t.code)}</b><span>${esc(shortName(t))}</span></div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        ${t.currentRound ? `<a class="pd-cr" href="${crRound(t.tnr, t.currentRound)}" target="_blank" rel="noopener"><i class="fa-solid fa-table-list"></i> Los ${t.currentRound}. kola</a>` : ''}
                        <a class="pd-cr" href="${crStandings(t.tnr)}" target="_blank" rel="noopener"><i class="fa-solid fa-ranking-star"></i> Pořadí</a>
                    </div>
                </div>
                <div class="pd-players">${cards}</div>`;
        }).join('');

        if (!body) return '';
        return `<section class="pd-sec">
            <div class="pd-eyebrow">Výprava</div>
            <h2 class="pd-h2">Každý bod se počítá</h2>
            <p class="pd-lead">Czech Open je jeden z největších turnajů v Evropě — naše děti se v něm potkávají se soupeři z celého světa. Tady je, co se komu zatím povedlo, kolo po kole.</p>
            ${body}
        </section>`;
    }

    // ---------- GRAFIKY ----------
    function renderCharts(d) {
        const all = d.tournaments.flatMap(t => t.players || []).filter(p => !p.error);
        if (!all.length) return '';
        const s = d.stats || {};

        // body výpravy po kolech; kolo, kde ještě nikdo nedohrál, je „probíhá"
        const perRound = new Map();
        for (const p of all) {
            for (const g of p.games || []) {
                if (g.bye) continue;
                const r = myResult(g);
                const rec = perRound.get(g.round) || { pts: 0, done: 0 };
                if (r.cls !== 'n') { rec.pts += r.cls === 'w' ? 1 : (r.cls === 'd' ? 0.5 : 0); rec.done++; }
                perRound.set(g.round, rec);
            }
        }
        const rounds = [...perRound.keys()].sort((a, b) => a - b);
        const done = rounds.filter(r => perRound.get(r).done);
        const maxR = Math.max(1, ...done.map(r => perRound.get(r).pts));
        const running = rounds.find(r => !perRound.get(r).done) || (done.length ? done[done.length - 1] + 1 : 1);
        const bars = done.map(r => {
            const v = Math.round(perRound.get(r).pts * 10) / 10;
            return `<div><b>${fmtPts(v)}</b><i style="height:${Math.max(6, Math.round(v / maxR * 92))}%"></i></div>`;
        }).join('') + (running <= TOTAL_ROUNDS ? `<div class="next"><b>?</b><i style="height:64%"></i></div>` : '');
        const axis = done.map(r => `<span>${r}. K</span>`).join('')
            + (running <= TOTAL_ROUNDS ? `<span class="on">${running}. K</span>` : '');

        // kdo kolik nasbíral
        const maxPts = Math.max(1, ...all.map(p => p.points || 0));
        const rank = [...all].sort((a, b) => (b.points || 0) - (a.points || 0)).map(p => `
            <div>
                <span class="nm">${esc(p.name)}</span>
                <span class="tr"><i style="width:${Math.round((p.points || 0) / maxPts * 100)}%"></i></span>
                <span class="vl">${fmtPts(p.points)}</span>
            </div>`).join('');

        // milníky: ať se vystřídá co nejvíc jmen, ne jeden hráč čtyřikrát
        const scalp = s.bestScalp;
        const seen = new Set(scalp ? [scalp.player] : []);
        const miles = (s.milestones || []).filter(m => {
            if (seen.has(m.player)) return false;
            seen.add(m.player);
            return true;
        }).slice(0, 4);

        return `<section class="pd-sec">
            <div class="pd-eyebrow">Čísla výpravy</div>
            <h2 class="pd-h2">Jak se nám sype forma</h2>
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px; margin-top:20px;">

                <div class="pd-card">
                    <div class="pd-label">Body výpravy po kolech</div>
                    <div class="pd-bars">${bars}</div>
                    <div class="pd-xaxis">${axis}</div>
                    <p class="pd-note" style="line-height:1.5; margin-top:14px;">Celkem ${fmtPts(s.points)} ${bodySlovo(s.points)} z ${s.games || 0} partií — úspěšnost ${s.scorePct ?? '–'} %.</p>
                </div>

                ${scalp ? `<div class="pd-scalp">
                    <div class="pd-label gold">Největší skalp</div>
                    <h4>${esc(scalp.player)}<br>porazil ${scalp.opponentRating}</h4>
                    <div class="pd-tags">
                        <span class="pd-tag gold">${esc(scalp.opponent || 'soupeř')}</span>
                        <span class="pd-tag">${scalp.round}. kolo</span>
                    </div>
                    ${miles.length ? `<div class="pd-hr"></div><div class="pd-miles">
                        ${miles.map(m => `<div><em>${m.icon}</em><span>${esc(m.player)} — ${esc(m.text)}</span></div>`).join('')}
                    </div>` : ''}
                </div>` : (miles.length ? `<div class="pd-scalp">
                    <div class="pd-label gold">Co se povedlo</div>
                    <div class="pd-miles" style="margin-top:14px;">
                        ${miles.map(m => `<div><em>${m.icon}</em><span>${esc(m.player)} — ${esc(m.text)}</span></div>`).join('')}
                    </div>
                </div>` : '')}

                <div class="pd-card">
                    <div class="pd-label">Kdo kolik nasbíral</div>
                    <div class="pd-rank">${rank}</div>
                </div>
            </div>
        </section>`;
    }

    // ---------- ROZCVIČKA ----------
    function renderWarmup(d) {
        if (!d.warmup?.results?.length) return '';
        const r = d.warmup.results;
        const noMiss = r.find(x => x.wrong === 0 && x.correct > 5);
        const bestStreak = [...r].sort((a, b) => b.streak - a.streak)[0];
        const totalPuzzles = r.reduce((s, x) => s + x.correct + x.wrong, 0);
        const totalScore = r.reduce((s, x) => s + (x.score || 0), 0);
        const maxScore = Math.max(1, ...r.map(x => x.score || 0));

        const rows = r.map(x => `<div class="pd-row">
            <div class="pd-rowin">
                <div class="pd-pos">${x.order}</div>
                <div class="pd-av sm">${esc(initials(x.name))}</div>
                <div class="pd-who">${esc(x.name)}${x.inProgress ? '<span class="pd-chip">právě hraje</span>' : ''}</div>
                <div class="pd-score">
                    <b>${(x.score || 0).toLocaleString('cs-CZ')}</b>
                    <div class="pd-micro" style="margin-top:3px; text-align:right;">BODŮ</div>
                </div>
            </div>
            <div class="pd-prog">
                <span class="tr"><i style="width:${Math.round((x.score || 0) / maxScore * 100)}%"></i></span>
                <span>${x.correct} správně · série ${x.streak}</span>
            </div>
        </div>`).join('');

        return `<section class="pd-sec">
            <div class="pd-eyebrow">Rozcvička · Puzzle Racer Pardubice 2026</div>
            <h2 class="pd-h2">Žebříček denní rozcvičky</h2>
            <p class="pd-lead">Pár minut úloh před kolem — a hrát se dá kdykoli znovu. Tady jsou výsledky z rozcvičky „${esc(d.warmup.title)}".</p>

            <div class="pd-hl">
                ${noMiss ? `<div class="gold">
                    <div class="pd-label gold">Bez jediné chyby</div>
                    <h4>${esc(noMiss.name.split(' ')[0])} — ${noMiss.correct} úloh, ani jedna chyba</h4>
                    <p>Prošel rozcvičkou úplně čistě.</p>
                </div>` : ''}
                ${bestStreak?.streak ? `<div>
                    <div class="pd-label" style="color:#7fc9b8;">Nejdelší série</div>
                    <h4>${esc(bestStreak.name.split(' ')[0])} — ${bestStreak.streak} v řadě</h4>
                    <p>Tolik správných úloh za sebou bez zaváhání.</p>
                </div>` : ''}
                <div>
                    <div class="pd-label">Výprava dohromady</div>
                    <h4>${totalPuzzles} úloh · ${totalScore.toLocaleString('cs-CZ')} b.</h4>
                    <p>${r.length} ${r.length === 1 ? 'hráč' : (r.length < 5 ? 'hráči' : 'hráčů')} v téhle rozcvičce.</p>
                </div>
            </div>

            <div class="pd-lb">
                <div class="pd-lbhead">
                    <div class="pd-label">${esc(d.warmup.title)} · ${r.length} ${r.length === 1 ? 'hráč' : (r.length < 5 ? 'hráči' : 'hráčů')}</div>
                    <div style="font:500 12px Inter,sans-serif; color:#75757e;">body · správně · nejdelší série</div>
                </div>
                ${rows}
                <div style="display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin-top:16px; padding-top:14px; border-top:1px solid #26262c;">
                    <a class="pd-btn ghost" href="/puzzle-racer"><i class="fa-solid fa-bolt"></i> Zahrát si rozcvičku</a>
                </div>
            </div>
        </section>`;
    }

    // ---------- NOTIFIKACE ----------
    function renderSubscribe(d) {
        return `<section class="pd-sec" id="notifikace">
            <div class="pd-sub">
                <div>
                    <strong>Upozornění na nový los</strong>
                    <small>Jakmile bude venku los dalšího kola, přijde vám upozornění do telefonu. Bez e-mailu, odhlásit jde jedním klepnutím.</small>
                </div>
                <button class="pd-btn" id="pdSubBtn" style="flex:0 0 auto;">
                    <i class="fa-solid fa-bell"></i> <span id="pdSubLabel">Odebírat upozornění</span>
                </button>
            </div>
            <p class="pd-note" id="pdSubHint" style="margin-top:10px;"></p>
            <div class="pd-foot">
                <span>Výsledky přebíráme z chess-results.com${d.generatedAt ? `, aktualizováno ${new Date(d.generatedAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}` : ''}${d.warning ? ` · ${esc(d.warning)}` : ''}</span>
                <span><a href="/youth" style="color:#75757e;">Mládež TJ Bižuterie Jablonec</a> · Czech Open 2026</span>
            </div>
        </section>`;
    }

    async function initSubscribe() {
        const btn = document.getElementById('pdSubBtn');
        if (!btn) return;
        const label = document.getElementById('pdSubLabel');
        const hint = document.getElementById('pdSubHint');
        const supported = 'serviceWorker' in navigator && 'PushManager' in window;
        if (!supported) {
            btn.style.display = 'none';
            hint.textContent = 'Tenhle prohlížeč upozornění neumí. Na iPhonu je zapnete tak, že si stránku přidáte na plochu a otevřete ji odtud.';
            return;
        }
        let reg, sub;
        try {
            reg = await navigator.serviceWorker.register('/sw-pardubice.js');
            sub = await reg.pushManager.getSubscription();
        } catch (e) { /* registrace selhala */ }
        const setState = (on) => {
            label.textContent = on ? 'Upozornění zapnutá — vypnout' : 'Odebírat upozornění';
            btn.classList.toggle('ghost', on);
        };
        setState(!!sub);

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
                if (sub) {
                    await fetch(`${API}/camp/push/unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
                    await sub.unsubscribe();
                    sub = null;
                    setState(false);
                    hint.textContent = 'Upozornění vypnutá.';
                } else {
                    const perm = await Notification.requestPermission();
                    if (perm !== 'granted') { hint.textContent = 'Upozornění jste zamítli — zapnout je jde v nastavení prohlížeče.'; return; }
                    const { key } = await (await fetch(`${API}/camp/push/key`)).json();
                    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(key) });
                    await fetch(`${API}/camp/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
                    setState(true);
                    hint.textContent = 'Hotovo — dáme vědět, jakmile bude los venku.';
                }
            } catch (e) {
                hint.textContent = 'Nepodařilo se to zapnout: ' + e.message;
            } finally {
                btn.disabled = false;
            }
        });
    }

    function urlB64ToUint8(base64) {
        const pad = '='.repeat((4 - base64.length % 4) % 4);
        const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(b64);
        return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
    }

    async function load() {
        try {
            const res = await fetch(`${API}/camp/pardubice`);
            if (!res.ok) throw new Error('Data se nepodařilo načíst');
            const d = await res.json();
            root.innerHTML = renderHero(d) + renderPairings(d) + renderPlayers(d) + renderCharts(d)
                + renderWarmup(d) + renderSubscribe(d);
            startClock();
            initSubscribe();
        } catch (e) {
            root.innerHTML = `<div class="pd-sec"><div class="pd-card" style="text-align:center; padding:2.5rem 1rem;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size:1.6rem; color:#fbbf24;"></i>
                <p style="margin-top:0.8rem; color:var(--text-muted);">${esc(e.message)}. Zkuste to prosím za chvíli.</p>
            </div></div>`;
        }
    }

    // Kola začínají v 15:00 (poslední ve 13:00), los padá po dohrání (~po 19:00).
    // Ve večerním okně se ptáme častěji, v noci skoro vůbec.
    function clientRefreshMs() {
        const h = pragueNow().h;
        if (h >= 18 && h <= 23) return 2 * 60 * 1000;
        if (h >= 13 && h < 18) return 5 * 60 * 1000;
        if (h >= 8 && h < 13) return 15 * 60 * 1000;
        return 30 * 60 * 1000;
    }
    let timer = null;
    function schedule() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(async () => { await load(); schedule(); }, clientRefreshMs());
    }
    load().then(schedule);
    // po návratu na kartu rovnou aktualizuj
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
})();
