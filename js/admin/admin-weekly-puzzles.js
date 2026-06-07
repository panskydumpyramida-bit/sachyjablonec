/**
 * Admin — Úloha týdne (F1: dashboard kandidátů).
 * Načte navržené KOMBINACE z /api/weekly-puzzles/candidates (uniqueness gate),
 * vykreslí mini-diagramy s metrikami a nechá adminy vybrat 3.
 * Generátor článku = F2.
 */
(function () {
    'use strict';

    // jednotná sada PLNÝCH glyphů pro obě barvy (outline bílé splývají se světlými poli)
    const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
    const selected = new Set();
    let lastCandidates = [];

    function authHeaders() {
        return { 'Authorization': 'Bearer ' + (window.authToken || '') };
    }
    function apiBase() {
        return window.API_URL || '/api';
    }

    // FEN → mini šachovnice (unicode), orientace dle strany na tahu, zvýraznění best tahu.
    function miniBoard(fen, toMove, bestUci) {
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

        let html = '<div style="display:grid;grid-template-columns:repeat(8,1fr);width:168px;height:168px;border:1px solid #0d1117;border-radius:4px;overflow:hidden;flex-shrink:0;">';
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
                const glyph = piece ? GLYPH[piece.toLowerCase()] : '';
                const isWhitePiece = piece && piece === piece.toUpperCase();
                const color = isWhitePiece ? '#f8f8f8' : '#1a1a1a';
                const shadow = isWhitePiece
                    ? 'text-shadow:0 0 1px #000,0 0 2px #000,0 1px 1px #000;'
                    : 'text-shadow:0 0 1px rgba(255,255,255,0.5);';
                html += `<div style="display:flex;align-items:center;justify-content:center;background:${bg};font-size:20px;line-height:1;color:${color};${shadow}">${glyph}</div>`;
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
                <div style="font-size:0.85rem;">${verified}${mate}${evalTxt}</div>
                <div style="font-size:0.8rem;color:#94a3b8;">
                    Nejlepší tah: <strong style="color:#e2e8f0;">${c.bestSan}</strong>
                    ${c.isCapture ? ' · braní' : ''}${c.isCheck ? ' · šach' : ''}
                    · typ: ${c.type === 'miss' ? 'přehlédnutá šance' : 'přehlédnutá taktika'}
                </div>
                <div style="font-size:0.78rem;color:#64748b;">
                    Z partie ${c.white} – ${c.black}${dateTxt ? ' · ' + dateTxt : ''}${c.event ? ' · ' + c.event : ''}
                </div>
                <label style="margin-top:auto;display:inline-flex;align-items:center;gap:0.4rem;font-size:0.85rem;cursor:pointer;">
                    <input type="checkbox" ${isSel ? 'checked' : ''} data-id="${c.id}"> Vybrat do úlohy týdne
                </label>
            </div>`;
        wrap.querySelector('input').addEventListener('change', (e) => toggleSelect(c.id, e.target.checked));
        return wrap;
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
            grid.innerHTML = '<p style="color:#94a3b8;padding:2rem;text-align:center;">Žádní kandidáti. Nejdřív naskenuj partie v Blunder Gridu — z nich se kombinace vybírají.</p>';
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

    async function load() {
        const grid = document.getElementById('wpGrid');
        const metaEl = document.getElementById('wpMeta');
        if (grid) grid.innerHTML = '<p style="color:#94a3b8;padding:2rem;text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Hledám kombinace… (ověřuji jedinečnost přes engine, chvíli to trvá)</p>';
        selected.clear();
        try {
            const res = await fetch(`${apiBase()}/weekly-puzzles/candidates?threshold=10&limit=30`, { headers: authHeaders() });
            if (res.status === 401 || res.status === 403) {
                if (grid) grid.innerHTML = '<p style="color:#f87171;padding:2rem;text-align:center;">Nemáš oprávnění (jen ADMIN). Přihlas se jako administrátor.</p>';
                return;
            }
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            lastCandidates = data.candidates || [];
            if (metaEl && data.meta) {
                metaEl.innerHTML = `Pool: ${data.meta.poolTotal} pozic · ověřeno top ${data.meta.verified} · engine: <strong>${data.meta.engine || '?'}</strong> · potvrzená jedinečnost: <strong style="color:#22c55e;">${data.meta.confirmedUnique}</strong>`;
            }
            render();
        } catch (e) {
            console.error('[WeeklyPuzzles] load error:', e);
            if (grid) grid.innerHTML = `<p style="color:#f87171;padding:2rem;text-align:center;">Chyba načítání: ${e.message}</p>`;
        }
    }

    function generate() {
        if (selected.size === 0) return;
        const picks = lastCandidates.filter(c => selected.has(c.id));
        alert('F1 hotovo — vybráno ' + picks.length + ' úloh:\n\n' +
            picks.map((c, i) => `${i + 1}. ${c.toMove === 'w' ? 'Bílý' : 'Černý'} na tahu, ${c.bestSan} (${c.white}–${c.black})`).join('\n') +
            '\n\nGenerátor draft článku přijde ve F2.');
    }

    window.loadWeeklyPuzzles = load;
    window.wpGenerate = generate;
})();
