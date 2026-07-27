// Dashboard soustředění Pardubice — vykreslí snapshot z /api/camp/pardubice
(() => {
    const API = window.API_URL || '/api';
    const root = document.getElementById('pdRoot');
    const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
    const fmtPts = (n) => (n === null || n === undefined) ? '?' : String(n).replace('.', ',');
    // české skloňování: 1 bod · 2-4 body · 5+ bodů · desetinné 2,5 bodu
    const bodySlovo = (n) => {
        if (n === null || n === undefined) return 'bodů';
        if (!Number.isInteger(n)) return 'bodu';
        if (n === 1) return 'bod';
        if (n >= 2 && n <= 4) return 'body';
        return 'bodů';
    };

    // výsledek partie z pohledu našeho hráče
    function myResult(g) {
        const r = String(g.result || '').trim();
        if (g.bye) return { cls: 'n', txt: '–', word: 'volno' };
        if (/^(1|\+)$/.test(r)) return { cls: 'w', txt: 'V', word: 'výhra' };
        if (/^(0|-)$/.test(r)) return { cls: 'l', txt: 'P', word: 'prohra' };
        if (/½|0[.,]5/.test(r)) return { cls: 'd', txt: 'R', word: 'remíza' };
        return { cls: 'n', txt: '·', word: '' };
    }

    // výsledek z tabulky párování ("1 - 0" apod.) z pohledu našeho hráče
    function pairingResult(p) {
        const r = String(p.result || '').trim();
        if (!r || /^\s*-\s*$/.test(r)) return { cls: 'pending', txt: 'hraje se' };
        const [a, b] = r.split('-').map(x => x.trim());
        const mine = p.color === 'white' ? a : b;
        const theirs = p.color === 'white' ? b : a;
        if (mine === undefined || theirs === undefined) return { cls: 'pending', txt: r };
        if (/½/.test(mine)) return { cls: 'draw', txt: 'remíza' };
        if (parseFloat(mine) > parseFloat(theirs)) return { cls: 'win', txt: 'výhra' };
        if (parseFloat(mine) < parseFloat(theirs)) return { cls: 'loss', txt: 'prohra' };
        return { cls: 'draw', txt: 'remíza' };
    }

    // příprava na soupeře: jeho partie v barvě, kterou má proti nám
    function prepLink(p) {
        if (!p.opponent) return '';
        const url = `/chess-database.html?player=${encodeURIComponent(p.opponent)}&color=${p.opponentColor}`;
        return `<a class="pd-prep" href="${url}" title="Soupeřovy partie za ${p.opponentColor === 'black' ? 'černé' : 'bílé'} v naší databázi"><i class="fa-solid fa-magnifying-glass"></i> Příprava</a>`;
    }

    // Kola od 15:00; los dalšího kola padá po dohrání (odhadem po 21:00).
    function nextRoundInfo() {
        const now = new Date();
        const h = Number(new Intl.DateTimeFormat('cs-CZ', { hour: 'numeric', hour12: false, timeZone: 'Europe/Prague' }).format(now));
        const m = Number(new Intl.DateTimeFormat('cs-CZ', { minute: 'numeric', timeZone: 'Europe/Prague' }).format(now));
        if (h >= 15 && h < 21) return 'Hraje se od 15:00';
        if (h >= 21 || h < 8) return 'Los dalšího kola bývá po 21:00';
        const mins = (15 - h) * 60 - m;
        const hh = Math.floor(mins / 60);
        return `Další kolo za ${hh ? hh + ' h ' : ''}${mins % 60} min (15:00)`;
    }

    function renderHero(d) {
        const t = d.tournaments.find(x => x.currentRound) || d.tournaments[0] || {};
        const rd = t.currentRound || 0;
        const total = 9;
        const pending = d.tournaments.some(x => x.nextRoundPending);
        const segs = Array.from({ length: total }, (_, i) => {
            const n = i + 1;
            const cls = n < rd ? 'done' : (n === rd ? (t.roundState === 'finished' ? 'done' : 'now') : '');
            return `<span class="pd-seg ${cls}"></span>`;
        }).join('');

        const badge = t.roundState === 'fresh'
            ? '<span class="pd-badge live"><i class="fa-solid fa-circle" style="font-size:0.5rem;"></i> LOS JE VENKU</span>'
            : t.roundState === 'playing'
                ? '<span class="pd-badge live"><i class="fa-solid fa-circle" style="font-size:0.5rem;"></i> PRÁVĚ SE HRAJE</span>'
                : pending
                    ? '<span class="pd-badge wait"><i class="fa-regular fa-clock"></i> ČEKÁME NA LOS</span>'
                    : '<span class="pd-badge wait"><i class="fa-regular fa-clock"></i> MEZI KOLY</span>';

        const s = d.stats || {};
        return `
        <div class="pd-hero">
            <div class="pd-kicker">Czech Open 2026 · Pardubice</div>
            <h1 class="pd-title">Soustředění Pardubice</h1>
            <p class="pd-sub">Naše výprava na největším šachovém festivalu v Česku — ${s.players || 0} hráčů ve třech turnajích.</p>
            <div class="pd-roundline">
                <div class="pd-roundnum">${rd || '–'}<span style="font-size:0.42em; color:var(--text-muted);"> / ${total} kol</span></div>
                <div style="display:flex; flex-direction:column; gap:0.45rem;">
                    <div class="pd-segs">${segs}</div>
                    ${badge}
                    <div style="font-size:0.75rem; color:var(--text-muted);">${nextRoundInfo()}</div>
                </div>
            </div>
            <div class="pd-kpis">
                <div class="pd-kpi"><b>${fmtPts(s.points)}</b><span>${bodySlovo(s.points)} celkem</span></div>
                <div class="pd-kpi"><b>${s.games || 0}</b><span>${s.games === 1 ? 'odehraná partie' : (s.games >= 2 && s.games <= 4 ? 'odehrané partie' : 'odehraných partií')}</span></div>
                <div class="pd-kpi"><b>${s.scorePct ?? '–'} %</b><span>úspěšnost výpravy</span></div>
                ${s.bestScalp ? `<div class="pd-kpi"><b style="font-size:1rem; line-height:1.3;">${esc(s.bestScalp.player.split(' ')[0])}</b><span>skalp ${s.bestScalp.opponentRating}</span></div>` : ''}
            </div>
        </div>`;
    }

    function renderPairings(d) {
        const rows = d.tournaments.flatMap(t => (t.pairings || []).map(p => ({ ...p, code: t.code, state: t.roundState, round: t.currentRound })));
        const pending = d.tournaments.filter(t => t.nextRoundPending);

        if (!rows.length) {
            return `<div class="pd-section"><h2 class="pd-h2"><i class="fa-solid fa-dice"></i> Los dalšího kola</h2>
                <div class="pd-card" style="text-align:center; padding:2rem 1rem; border-style:dashed;">
                    <i class="fa-regular fa-clock" style="font-size:1.6rem; color:var(--text-muted);"></i>
                    <p style="margin-top:0.7rem; color:var(--text-muted);">Los ještě není venku. Stránka si ho hlídá sama — nemusíte mačkat F5.</p>
                </div></div>`;
        }

        const anyPending = pending.length
            ? `<p style="color:var(--text-muted); font-size:0.82rem; margin-top:0.6rem;"><i class="fa-regular fa-clock"></i> Los ${pending[0].nextRoundPending}. kola zatím není venku — jakmile bude, objeví se tady.</p>`
            : '';

        return `<div class="pd-section">
            <h2 class="pd-h2"><i class="fa-solid fa-dice"></i> ${rows[0].state === 'finished' ? `Výsledky ${rows[0].round}. kola` : `Los ${rows[0].round}. kola`}</h2>
            ${rows.map(p => {
            const res = pairingResult(p);
            return `<div class="pd-board">
                    <div class="pd-boardno">${p.board || '?'}<small>deska</small></div>
                    <div class="pd-vs">
                        <div class="pd-me">${esc(p.name)} <span class="pd-chip ${p.color === 'white' ? 'w' : 'b'}">${p.color === 'white' ? 'bílé' : 'černé'}</span> <span style="font-size:0.7rem; color:var(--text-muted);">${p.code}</span></div>
                        <div class="pd-opp">vs ${esc(p.opponent || 'volno')} ${prepLink(p)}</div>
                    </div>
                    <div class="pd-res ${res.cls}">${res.txt}</div>
                </div>`;
        }).join('')}
            ${anyPending}
            ${renderShare(rows)}
        </div>`;
    }

    function renderShare(rows) {
        const lines = rows.map(p => `${p.name} — deska ${p.board}, ${p.color === 'white' ? 'bílé' : 'černé'}, soupeř ${p.opponent || 'volno'}`);
        const msg = `Soustředění Pardubice — ${rows[0].state === 'finished' ? 'výsledky' : 'los'} ${rows[0].round}. kola:\n\n${lines.join('\n')}\n\nhttps://www.sachyjablonec.cz/pardubice`;
        return `<div class="pd-share">
            <a class="pd-wa" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" style="font-size:1.2rem;"></i> Poslat do WhatsApp</a>
            <span style="color:var(--text-muted); font-size:0.82rem;">Otevře WhatsApp s hotovou zprávou — vyberete skupinu a odešlete.</span>
        </div>`;
    }

    function renderPlayers(d) {
        return d.tournaments.map(t => {
            if (!t.players?.length) return '';
            const sorted = [...t.players].sort((a, b) => (b.points || 0) - (a.points || 0));
            return `<div class="pd-section">
                <h2 class="pd-h2"><i class="fa-solid fa-chess-board"></i> Turnaj ${t.code}
                    <span style="font-size:0.75rem; font-weight:400; color:var(--text-muted); font-family:Inter,sans-serif;">${esc((t.name || '').replace(/^CZECH OPEN 2026 - [^-]+- /, ''))}${t.fieldSize ? ` · ${t.fieldSize} hráčů` : ''}</span>
                </h2>
                <div class="pd-players">
                ${sorted.map(p => {
                if (p.error) return `<div class="pd-player"><div class="pd-pname">${esc(p.name)}</div><div class="pd-pmeta" style="color:#f87171;">data se nepodařilo načíst</div></div>`;
                const games = (p.games || []).map(g => { const r = myResult(g); return `<span class="pd-g ${r.cls}" title="${g.round}. kolo — ${r.word}${g.opponent ? ' s ' + esc(g.opponent) : ''}">${r.txt}</span>`; }).join('');
                const wins = (p.games || []).filter(g => myResult(g).cls === 'w').length;
                const draws = (p.games || []).filter(g => myResult(g).cls === 'd').length;
                const tag = wins ? `${wins}× výhra${draws ? `, ${draws}× remíza` : ''}` : (draws ? `${draws}× remíza` : 'zatím bez bodu — drží se');
                return `<div class="pd-player">
                        <div class="pd-pname">${esc(p.name)} ${p.role ? `<span style="font-size:0.68rem; color:var(--primary-color); font-weight:400;">${esc(p.role)}</span>` : ''}</div>
                        <div class="pd-pmeta">${p.birthYear ? `roč. ${p.birthYear}` : ''}${p.rating ? ` · ELO ${p.rating}` : ''}</div>
                        <div class="pd-prow"><span class="pd-pts">${fmtPts(p.points)}</span><span class="pd-rank">${bodySlovo(p.points)} · ${p.rank}. místo</span></div>
                        <div class="pd-games">${games}</div>
                        <div class="pd-tag">${tag}</div>
                    </div>`;
            }).join('')}
                </div>
            </div>`;
        }).join('');
    }

    function renderWarmup(d) {
        if (!d.warmup?.results?.length) return '';
        const r = d.warmup.results;
        const noMiss = r.find(x => x.wrong === 0 && x.correct > 5);
        const bestStreak = [...r].sort((a, b) => b.streak - a.streak)[0];
        return `<div class="pd-section">
            <h2 class="pd-h2"><i class="fa-solid fa-bolt"></i> Rozcvička <span style="font-size:0.75rem; font-weight:400; color:var(--text-muted); font-family:Inter,sans-serif;">${esc(d.warmup.title)}</span></h2>
            <div class="pd-card">
                ${r.map(x => `<div class="pd-warm">
                    <span class="pd-wpos">${x.order}.</span>
                    <span class="pd-wname">${esc(x.name)}${x.inProgress ? ' <span style="font-size:0.68rem; color:#34d399;">hraje</span>' : ''}</span>
                    <span class="pd-wmeta">${x.correct}✓ ${x.wrong}✗ · série ${x.streak}</span>
                    <span class="pd-wscore">${x.score}</span>
                </div>`).join('')}
                <div style="display:flex; gap:1rem; flex-wrap:wrap; margin-top:0.8rem; font-size:0.78rem; color:var(--text-muted);">
                    ${noMiss ? `<span>🎯 ${esc(noMiss.name)} bez jediné chyby</span>` : ''}
                    ${bestStreak?.streak ? `<span>🔥 nejdelší série ${bestStreak.streak} (${esc(bestStreak.name)})</span>` : ''}
                    <a href="/puzzle-racer" style="color:#93c5fd; text-decoration:none;">Zahrát si rozcvičku →</a>
                </div>
            </div>
        </div>`;
    }

    async function load() {
        try {
            const res = await fetch(`${API}/camp/pardubice`);
            if (!res.ok) throw new Error('Data se nepodařilo načíst');
            const d = await res.json();
            root.innerHTML = renderHero(d) + renderPairings(d) + renderPlayers(d) + renderWarmup(d)
                + `<p style="text-align:center; color:var(--text-muted); font-size:0.75rem; margin-top:2rem;">
                     Data z chess-results.com${d.generatedAt ? `, aktualizováno ${new Date(d.generatedAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}` : ''}${d.warning ? ` · ${esc(d.warning)}` : ''}
                   </p>`;
        } catch (e) {
            root.innerHTML = `<div class="pd-card" style="text-align:center; padding:2.5rem 1rem;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size:1.6rem; color:#fbbf24;"></i>
                <p style="margin-top:0.8rem; color:var(--text-muted);">${esc(e.message)}. Zkuste to prosím za chvíli.</p>
            </div>`;
        }
    }

    // Kola začínají v 15:00 (poslední ve 13:00), los padá po dohrání (~po 21:00).
    // Ve večerním okně se ptáme častěji, v noci skoro vůbec.
    function clientRefreshMs() {
        const h = Number(new Intl.DateTimeFormat('cs-CZ', { hour: 'numeric', hour12: false, timeZone: 'Europe/Prague' }).format(new Date()));
        if (h >= 20 && h <= 23) return 2 * 60 * 1000;
        if (h >= 13 && h < 20) return 5 * 60 * 1000;
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
