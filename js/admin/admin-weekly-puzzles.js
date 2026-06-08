/**
 * Admin — Úloha týdne (F1: dashboard kandidátů).
 * Načte navržené KOMBINACE z /api/weekly-puzzles/candidates (uniqueness gate),
 * vykreslí mini-diagramy s metrikami a nechá adminy vybrat 3.
 * Generátor článku = F2.
 */
(function () {
    'use strict';

    const selected = new Set();
    let lastCandidates = [];

    const MOTIF_CZ = {
        sacrifice: 'oběť', fork: 'vidlička', mate: 'mat', backRankMate: 'mat na zadní řadě',
        smotheredMate: 'dušený mat', doubleCheck: 'dvojšach', discoveredCheck: 'odkrytý šach',
        discoveredAttack: 'odkrytý útok', pin: 'vazba', skewer: 'nabodnutí', xRay: 'rentgen',
        attraction: 'nalákání', interference: 'překrytí', promotion: 'proměna', advancedPawn: 'pokročilý pěšec', trappedPiece: 'lapená figura',
    };

    function authHeaders() {
        return { 'Authorization': 'Bearer ' + (window.authToken || '') };
    }
    function apiBase() {
        return window.API_URL || '/api';
    }
    const voteBtnStyle = (active) => `background:${active ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.05)'};border:1px solid ${active ? 'rgba(212,175,55,0.6)' : 'rgba(255,255,255,0.12)'};border-radius:6px;padding:2px 9px;cursor:pointer;font-size:0.9rem;line-height:1;`;

    async function vote(id, value) {
        try {
            const res = await fetch(`${apiBase()}/weekly-puzzles/${id}/vote`, {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ value }),
            });
            if (!res.ok) { alert('Hlasování selhalo (' + res.status + ')'); return; }
            const data = await res.json();
            const c = lastCandidates.find((x) => x.id === id);
            if (c) { c.rating = data.rating; c.voteCount = data.voteCount; c.myVote = data.myVote; }
            render();
        } catch (e) { alert('Chyba hlasování: ' + e.message); }
    }

    async function copyFen(fen, btn) {
        try {
            await navigator.clipboard.writeText(fen);
            const o = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> zkopírováno';
            setTimeout(() => { btn.innerHTML = o; }, 1200);
        } catch {
            window.prompt('FEN (Cmd/Ctrl+C, Enter):', fen);
        }
    }

    // FEN → mini šachovnice (unicode), orientace dle strany na tahu, zvýraznění best tahu.
    function miniBoard(fen, toMove, bestUci, size = 176) {
        const board = fen.split(' ')[0];
        const rows = board.split('/');
        const grid = [];
        for (const r of rows) {
            const cells = [];
            for (const ch of r) {
                if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) cells.push('');
                else cells.push(ch);
            }
            grid.push(cells);
        }
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const flip = toMove === 'b';
        const fromSq = bestUci ? bestUci.slice(0, 2) : null;
        const toSq = bestUci ? bestUci.slice(2, 4) : null;

        let html = `<div style="display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);width:${size}px;height:${size}px;border:1px solid #0d1117;border-radius:4px;overflow:hidden;flex-shrink:0;">`;
        for (let rr = 0; rr < 8; rr++) {
            for (let cc = 0; cc < 8; cc++) {
                const rank = flip ? rr : 7 - rr;      // rank 0..7 (0 = řada 1)
                const file = flip ? 7 - cc : cc;
                const piece = grid[7 - rank][file];    // grid[0] = řada 8
                const sq = files[file] + (rank + 1);
                const light = (file + rank) % 2 === 1;
                let bg = light ? '#ebecd0' : '#779556';
                if (sq === fromSq) bg = '#f6c453';
                if (sq === toSq) bg = '#e8a13a';
                let inner = '';
                if (piece) {
                    const pc = (piece === piece.toUpperCase() ? 'w' : 'b') + piece.toUpperCase();
                    inner = `<img src="img/chesspieces/wikipedia/${pc}.png" alt="" style="width:90%;height:90%;display:block;">`;
                }
                html += `<div style="display:flex;align-items:center;justify-content:center;background:${bg};">${inner}</div>`;
            }
        }
        html += '</div>';
        return html;
    }

    function diffBadge(d) {
        const map = { 'lehká': '#22c55e', 'střední': '#eab308', 'těžká': '#ef4444' };
        return `<span style="background:${map[d] || '#64748b'};color:#000;padding:1px 7px;border-radius:10px;font-size:0.7rem;font-weight:600;">${d}</span>`;
    }

    function card(c) {
        const isSel = selected.has(c.id);
        const verified = c.verified
            ? `<span style="color:#22c55e;font-weight:600;"><i class="fa-solid fa-circle-check"></i> jedinečné řešení (Δ${c.uniqMargin})</span>`
            : (c.uniqMargin !== null
                ? `<span style="color:#eab308;">slabší jedinečnost (Δ${c.uniqMargin})</span>`
                : `<span style="color:#94a3b8;"><i class="fa-regular fa-circle-question"></i> jedinečnost nepotvrzena</span>`);
        const motifsHtml = (c.motifs && c.motifs.length)
            ? `<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-top:0.1rem;">` +
              c.motifs.map(mo => `<span style="background:rgba(212,175,55,0.18);color:#eab308;padding:1px 8px;border-radius:10px;font-size:0.68rem;font-weight:600;">${MOTIF_CZ[mo] || mo}</span>`).join('') +
              `</div>`
            : '';
        const mate = c.mateIn ? ` · <span style="color:#f87171;">mat v ${c.mateIn}</span>` : '';
        const evalTxt = c.bestSolverCp !== null && c.mateIn === null
            ? ` · po řešení ${(c.bestSolverCp / 100 >= 0 ? '+' : '')}${(c.bestSolverCp / 100).toFixed(1)}` : '';
        const dateTxt = c.gameDate ? new Date(c.gameDate).toLocaleDateString('cs-CZ') : '';
        const wrap = document.createElement('div');
        wrap.style.cssText = `display:flex;gap:1rem;padding:0.85rem;border-radius:10px;background:${isSel ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.03)'};border:1px solid ${isSel ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.08)'};`;
        wrap.innerHTML = `
            ${miniBoard(c.fenBefore, c.toMove, c.bestMoveLAN)}
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:0.35rem;">
                <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                    <strong style="font-size:0.95rem;">${c.toMove === 'w' ? '⬜ Bílý' : '⬛ Černý'} na tahu</strong>
                    ${diffBadge(c.difficulty)}
                    <span style="background:#1e293b;color:#e2e8f0;padding:1px 7px;border-radius:10px;font-size:0.7rem;">skóre ${c.score}</span>
                </div>
                ${motifsHtml}
                <div style="font-size:0.85rem;">${verified}${mate}${evalTxt}</div>
                <div style="font-size:0.8rem;color:#94a3b8;">
                    Nejlepší tah: <strong style="color:#e2e8f0;">${c.bestSan}</strong> · tah ${c.moveNo}
                    · ${c.playedBest ? '<span style="color:#22c55e;">✓ zahráno v partii</span>' : 'v partii přehlédnuto'}
                </div>
                <div style="font-size:0.78rem;color:#64748b;">
                    Z partie ${c.white} – ${c.black}${c.newsTitle ? ' · článek: ' + c.newsTitle : ''}${dateTxt ? ' · ' + dateTxt : ''}
                </div>
                <div style="display:flex;align-items:center;gap:0.4rem;margin-top:0.2rem;">
                    <code style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.66rem;color:#64748b;background:#0d1117;padding:3px 6px;border-radius:4px;">${c.fenBefore}</code>
                    <button class="wp-copyfen" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.14);border-radius:4px;padding:3px 8px;cursor:pointer;color:#94a3b8;font-size:0.7rem;white-space:nowrap;"><i class="fa-regular fa-copy"></i> kopírovat FEN</button>
                </div>
                <label style="margin-top:auto;display:inline-flex;align-items:center;gap:0.4rem;font-size:0.85rem;cursor:pointer;">
                    <input type="checkbox" ${isSel ? 'checked' : ''} data-id="${c.id}"> Vybrat do úlohy týdne
                </label>
                <div style="display:flex;gap:0.3rem;align-items:center;margin-top:0.35rem;">
                    <button class="wp-vote" data-v="1" style="${voteBtnStyle(c.myVote === 1)}" title="dobrá">👍</button>
                    <button class="wp-vote" data-v="2" style="${voteBtnStyle(c.myVote === 2)}" title="skvělá">⭐</button>
                    <button class="wp-vote" data-v="-1" style="${voteBtnStyle(c.myVote === -1)}" title="špatná">👎</button>
                    <span style="font-size:0.72rem;color:#94a3b8;margin-left:0.3rem;">hodnocení <strong style="color:${c.rating > 0 ? '#22c55e' : c.rating < 0 ? '#f87171' : '#e2e8f0'};">${c.rating > 0 ? '+' : ''}${c.rating || 0}</strong>${c.voteCount ? ' (' + c.voteCount + '×)' : ''}</span>
                </div>
            </div>`;
        wrap.querySelectorAll('.wp-vote').forEach((b) => b.addEventListener('click', () => vote(c.id, parseInt(b.dataset.v))));
        const cf = wrap.querySelector('.wp-copyfen');
        if (cf) cf.addEventListener('click', () => copyFen(c.fenBefore, cf));
        const boardEl = wrap.querySelector('div');
        if (boardEl) {
            boardEl.style.cursor = 'zoom-in';
            boardEl.title = 'Klikni pro zvětšení';
            boardEl.addEventListener('click', () => showZoom(c));
        }
        wrap.querySelector('input').addEventListener('change', (e) => toggleSelect(c.id, e.target.checked));
        return wrap;
    }

    function showZoom(c) {
        const size = Math.min(440, window.innerWidth - 48);
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10050;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem;padding:1rem;cursor:zoom-out;';
        ov.innerHTML = `
            ${miniBoard(c.fenBefore, c.toMove, c.bestMoveLAN, size)}
            <div style="color:#e2e8f0;text-align:center;font-size:0.95rem;">
                ${c.toMove === 'w' ? '⬜ Bílý' : '⬛ Černý'} na tahu · řešení: <strong style="color:#eab308;">${c.bestSan}</strong>
                · Δ${c.uniqMargin}${c.mateIn ? ' · mat v ' + c.mateIn : ''}
            </div>
            <div style="color:#94a3b8;font-size:0.8rem;text-align:center;">Z partie ${c.white} – ${c.black}</div>
            <input readonly value="${c.fenBefore}" onclick="this.select();event.stopPropagation();" style="width:min(90vw,440px);font-size:0.68rem;padding:5px 8px;background:#0d1117;color:#94a3b8;border:1px solid rgba(255,255,255,0.12);border-radius:5px;text-align:center;" title="FEN — klikni a zkopíruj">
            <div style="color:#64748b;font-size:0.72rem;">klikni mimo pro zavření</div>`;
        ov.addEventListener('click', () => ov.remove());
        document.body.appendChild(ov);
    }

    function toggleSelect(id, on) {
        if (on) {
            if (selected.size >= 3) {
                alert('Vyber maximálně 3 úlohy.');
                render();
                return;
            }
            selected.add(id);
        } else {
            selected.delete(id);
        }
        render();
    }

    function render() {
        const grid = document.getElementById('wpGrid');
        if (!grid) return;
        grid.innerHTML = '';
        if (!lastCandidates.length) {
            grid.innerHTML = '<p style="color:#94a3b8;padding:2rem;text-align:center;">V projitých partiích nebyly žádné ostré kombinace. Zkus víc partií, nebo přidej partie s taktikou do článků.</p>';
        } else {
            lastCandidates.forEach(c => grid.appendChild(card(c)));
        }
        const btn = document.getElementById('wpGenerateBtn');
        if (btn) {
            btn.textContent = `Vygenerovat článek (vybráno ${selected.size}/3)`;
            btn.disabled = selected.size === 0;
            btn.style.opacity = selected.size === 0 ? '0.5' : '1';
        }
    }

    function renderMeta(meta) {
        const metaEl = document.getElementById('wpMeta');
        if (!metaEl || !meta) return;
        const sc = meta.scan || {};
        let s = `Uloženo <strong style="color:#22c55e;">${meta.stored}</strong> kombinací`;
        if (meta.unscanned > 0) s += ` · <strong style="color:#eab308;">${meta.unscanned}</strong> partií čeká na sken`;
        if (sc.running) s += ` · <i class="fa-solid fa-spinner fa-spin"></i> skenuji ${sc.done}/${sc.total}…`;
        metaEl.innerHTML = s;
    }

    async function load() {
        const grid = document.getElementById('wpGrid');
        selected.clear();
        if (grid) grid.innerHTML = '<p style="color:#94a3b8;padding:2rem;text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Načítám uložené kombinace…</p>';
        try {
            const res = await fetch(`${apiBase()}/weekly-puzzles/candidates?limit=60`, { headers: authHeaders() });
            if (res.status === 401 || res.status === 403) {
                if (grid) grid.innerHTML = '<p style="color:#f87171;padding:2rem;text-align:center;">Nemáš oprávnění (jen ADMIN). Přihlas se jako administrátor.</p>';
                return;
            }
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            lastCandidates = data.candidates || [];
            renderMeta(data.meta);
            render();
            // pokud zrovna běží scan, navaž polling
            if (data.meta && data.meta.scan && data.meta.scan.running) pollScan();
        } catch (e) {
            console.error('[WeeklyPuzzles] load error:', e);
            if (grid) grid.innerHTML = `<p style="color:#f87171;padding:2rem;text-align:center;">Chyba načítání: ${e.message}</p>`;
        }
    }

    async function scan(rescanAll) {
        const btn = document.getElementById('wpScanBtn');
        try {
            const res = await fetch(`${apiBase()}/weekly-puzzles/scan`, {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ rescanAll: !!rescanAll }),
            });
            if (res.status === 401 || res.status === 403) { alert('Skenovat může jen ADMIN.'); return; }
            const data = await res.json();
            if (data.error) { alert(data.error); return; }
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Skenuji…'; }
            pollScan();
        } catch (e) {
            alert('Chyba spuštění scanu: ' + e.message);
        }
    }

    let polling = false;
    async function pollScan() {
        if (polling) return;
        polling = true;
        const tick = async () => {
            try {
                const res = await fetch(`${apiBase()}/weekly-puzzles/scan-status`, { headers: authHeaders() });
                const st = await res.json();
                const metaEl = document.getElementById('wpMeta');
                if (st.running) {
                    if (metaEl) metaEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Skenuji <strong>${st.done}/${st.total}</strong> partií · nalezeno <strong style="color:#22c55e;">${st.found}</strong> kombinací…`;
                    setTimeout(tick, 2000);
                } else {
                    polling = false;
                    const btn = document.getElementById('wpScanBtn');
                    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> Skenovat partie'; }
                    load();
                }
            } catch (e) { setTimeout(tick, 3000); }
        };
        tick();
    }

    function generate() {
        if (selected.size === 0) return;
        const picks = lastCandidates.filter(c => selected.has(c.id));
        alert('F1 hotovo — vybráno ' + picks.length + ' úloh:\n\n' +
            picks.map((c, i) => `${i + 1}. ${c.toMove === 'w' ? 'Bílý' : 'Černý'} na tahu, ${c.bestSan} (${c.white}–${c.black})`).join('\n') +
            '\n\nGenerátor draft článku přijde ve F2.');
    }

    window.loadWeeklyPuzzles = load;
    window.wpScan = () => scan(false);
    window.wpScanAll = () => { if (confirm('Přeskenovat VŠECHNY partie znovu s aktuálními pravidly? Běží na pozadí, může to pár minut trvat.')) scan(true); };
    window.wpGenerate = generate;
})();
