/**
 * Hero dlaždice (4 grid) + Hádanka dne modal.
 * Dlaždice se čtou z nastavení `home_hero_tiles` (admin je konfiguruje v 4-gridu).
 * Typ "puzzle" otevře modal s interaktivní šachovnicí (Hádanka dne).
 */
(function () {
    'use strict';

    const API = (typeof window.API_URL !== 'undefined') ? window.API_URL : '/api';
    const PIECE_THEME = 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png';

    // Výchozí rozložení (když admin nic nenastavil): Hádanka dne nahradí featured dlaždici.
    const DEFAULT_TILES = [
        { type: 'link', label: 'Aktuality', icon: 'fa-newspaper', variant: 'light', href: '#news', iconColor: '#5d4037' },
        { type: 'link', label: 'Rozpis zápasů', icon: 'fa-chess-king', variant: 'dark', href: '/calendar.html', iconColor: 'var(--primary-color)' },
        { type: 'puzzle', label: 'Hádanka dne', icon: 'fa-puzzle-piece', variant: 'dark', featured: true, badge: 'Hádej!', iconColor: 'var(--primary-color)' },
        { type: 'link', label: 'Mládež', icon: 'fa-child', variant: 'light', href: '/youth.html', iconColor: '#5d4037' },
    ];

    function tileHtml(t) {
        const variant = t.variant === 'dark' ? 'dark' : 'light';
        const iconColor = t.iconColor || (variant === 'dark' ? 'var(--primary-color)' : '#5d4037');
        const badge = t.featured
            ? `<span class="featured-badge" style="position:absolute; top:6px; right:6px; background:var(--primary-color); color:#0b0e14; font-size:0.55rem; font-weight:800; letter-spacing:0.08em; padding:0.15rem 0.4rem; border-radius:3px; text-transform:uppercase; line-height:1;">${escapeHtml(t.badge || 'Nové')}</span>`
            : '';
        const inner = `${badge}<i class="fa-solid ${escapeHtml(t.icon || 'fa-chess')}" style="color:${iconColor};"></i><span>${escapeHtml(t.label || '')}</span>`;
        const relStyle = t.featured ? ' style="position:relative;"' : '';
        if (t.type === 'puzzle') {
            return `<a href="#" class="hero-grid-item ${variant} ${t.featured ? 'hero-grid-item--featured' : ''}" data-hero-action="puzzle"${relStyle}>${inner}</a>`;
        }
        return `<a href="${escapeHtml(t.href || '#')}" class="hero-grid-item ${variant} ${t.featured ? 'hero-grid-item--featured' : ''}"${relStyle}>${inner}</a>`;
    }

    function renderTiles(tiles) {
        const wrap = document.querySelector('.hero-flip-tiles');
        if (!wrap) return;
        wrap.innerHTML = tiles.slice(0, 4).map(tileHtml).join('');
        wrap.querySelectorAll('[data-hero-action="puzzle"]').forEach(el => {
            el.addEventListener('click', (e) => { e.preventDefault(); openDailyPuzzle(); });
        });
    }

    async function loadTiles() {
        let tiles = DEFAULT_TILES;
        try {
            const res = await fetch(`${API}/settings/public/home_hero_tiles`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.value) {
                    const parsed = JSON.parse(data.value);
                    if (Array.isArray(parsed) && parsed.length) tiles = parsed;
                }
            }
        } catch (e) { /* fallback na default */ }
        renderTiles(tiles);
    }

    // ===== Hádanka dne modal =====
    let modalEl = null;
    let boardObj = null;

    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function ensureModal() {
        if (modalEl) return modalEl;
        modalEl = document.createElement('div');
        modalEl.id = 'dailyPuzzleModal';
        modalEl.style.cssText = 'position:fixed; inset:0; z-index:13000; display:none; align-items:center; justify-content:center; background:rgba(2,6,23,0.82); backdrop-filter:blur(4px); padding:16px;';
        modalEl.innerHTML = `
          <div style="width:min(420px,100%); background:#0f1722; border:1px solid rgba(212,175,55,0.25); border-radius:14px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6);">
            <div style="display:flex; align-items:center; gap:0.5rem; padding:0.85rem 1rem; background:rgba(212,175,55,0.08); border-bottom:1px solid rgba(212,175,55,0.15);">
              <i class="fa-solid fa-puzzle-piece" style="color:var(--primary-color,#d4af37);"></i>
              <strong style="color:#f1f5f9;">Hádanka dne</strong>
              <span style="flex:1; display:inline-flex; align-items:center; justify-content:flex-end; gap:0.25rem;">
                <button id="dpPrev" title="Předchozí den" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; border-radius:6px; min-width:30px; min-height:30px; cursor:pointer; touch-action:manipulation;">&lsaquo;</button>
                <span id="dpDate" style="color:#94a3b8; font-size:0.8rem; min-width:64px; text-align:center;"></span>
                <button id="dpNext" title="Další den" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; border-radius:6px; min-width:30px; min-height:30px; cursor:pointer; touch-action:manipulation;">&rsaquo;</button>
              </span>
              <button id="dpClose" aria-label="Zavřít" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;line-height:1;">&times;</button>
            </div>
            <div style="padding:0.9rem 1rem;">
              <p id="dpPrompt" style="margin:0 0 0.6rem; color:#cbd5e1; font-size:0.9rem; text-align:center;">Načítám…</p>
              <div id="dpBoard" style="width:100%; max-width:340px; margin:0 auto; touch-action:none;"></div>
              <div id="dpStatus" style="min-height:1.5rem; margin:0.6rem 0 0; text-align:center; font-weight:600; font-size:0.95rem;"></div>
              <div id="dpMeta" style="margin:0.3rem 0 0; text-align:center; color:#64748b; font-size:0.75rem;"></div>
              <div style="display:flex; gap:0.5rem; justify-content:center; margin-top:0.8rem;">
                <button id="dpSolution" style="display:none; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; border-radius:8px; padding:0.4rem 0.9rem; cursor:pointer; font-size:0.85rem;">Ukázat řešení</button>
                <button id="dpRetry" style="display:none; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; border-radius:8px; padding:0.4rem 0.9rem; cursor:pointer; font-size:0.85rem;">Zkusit znovu</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(modalEl);
        modalEl.querySelector('#dpClose').addEventListener('click', closeModal);
        modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });
        modalEl.querySelector('#dpPrev').addEventListener('click', () => openDailyPuzzle(currentOffset + 1));
        modalEl.querySelector('#dpNext').addEventListener('click', () => openDailyPuzzle(currentOffset - 1));
        return modalEl;
    }

    let currentOffset = 0; // 0 = dnes, kladné = dny zpět

    function closeModal() {
        if (modalEl) modalEl.style.display = 'none';
        document.body.style.overflow = ''; // odemkni scroll pozadí
        if (boardObj && boardObj.destroy) { try { boardObj.destroy(); } catch (e) {} boardObj = null; }
    }

    async function openDailyPuzzle(offset = 0) {
        ensureModal();
        modalEl.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // mobil: zamkni scroll pozadí, ať tah/tap ovládá figurky
        const promptEl = modalEl.querySelector('#dpPrompt');
        const statusEl = modalEl.querySelector('#dpStatus');
        const metaEl = modalEl.querySelector('#dpMeta');
        const solBtn = modalEl.querySelector('#dpSolution');
        const retryBtn = modalEl.querySelector('#dpRetry');
        statusEl.textContent = ''; solBtn.style.display = 'none'; retryBtn.style.display = 'none';
        promptEl.textContent = 'Načítám…';

        const dpToken = () => localStorage.getItem('auth_token') || localStorage.getItem('authToken') || '';
        const dpAuthHeaders = () => { const t = dpToken(); return t ? { 'Authorization': 'Bearer ' + t } : {}; };

        let puzzle;
        try {
            const res = await fetch(`${API}/weekly-puzzles/daily?offset=${Math.max(0, offset)}`, { headers: dpAuthHeaders() });
            if (!res.ok) throw new Error('no puzzle');
            puzzle = await res.json();
        } catch (e) {
            promptEl.textContent = 'Hádanka dne zatím není k dispozici.';
            return;
        }

        // datum + listování po dnech
        currentOffset = puzzle.offset || 0;
        const dateEl = modalEl.querySelector('#dpDate');
        const prevBtn = modalEl.querySelector('#dpPrev');
        const nextBtn = modalEl.querySelector('#dpNext');
        if (dateEl && puzzle.date) {
            dateEl.textContent = currentOffset === 0
                ? 'Dnes'
                : new Date(puzzle.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
        }
        if (prevBtn) { const can = currentOffset < (puzzle.maxOffset || 0); prevBtn.disabled = !can; prevBtn.style.opacity = can ? '1' : '0.3'; }
        if (nextBtn) { const can = currentOffset > 0; nextBtn.disabled = !can; nextBtn.style.opacity = can ? '1' : '0.3'; }

        // streak 🔥 — přihlášení ze serveru, anonym z localStorage
        const renderStreak = (n) => {
            if (dateEl && n > 0 && currentOffset === 0) dateEl.innerHTML = `Dnes <span title="${n} dní v řadě" style="color:#fb923c;">🔥${n}</span>`;
        };
        const localStreak = () => { try { return JSON.parse(localStorage.getItem('dpStreak') || '{}'); } catch (e) { return {}; } };
        if (typeof puzzle.streak === 'number') renderStreak(puzzle.streak);
        else { const ls = localStreak(); const today = puzzle.date; const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10); if (ls.last === today || ls.last === yest) renderStreak(ls.streak || 0); }

        const turn = puzzle.toMove === 'b' ? 'Černý' : 'Bílý';
        const dpMoveCount = Math.ceil(((Array.isArray(puzzle.lineUci) && puzzle.lineUci.length) || 1) / 2);
        promptEl.innerHTML = `<strong>${turn} na tahu</strong> — ${dpMoveCount > 1 ? `najdi ${dpMoveCount} ${dpMoveCount >= 5 ? 'tahů' : 'tahy'} hlavní varianty` : 'najdi nejlepší tah'}. Táhni nebo klikni figurku.`;
        const players = (puzzle.white && puzzle.black) ? `${escapeHtml(puzzle.white)} – ${escapeHtml(puzzle.black)}` : '';
        const src = puzzle.source
            ? (puzzle.newsId
                ? `<a href="/article.html?id=${encodeURIComponent(puzzle.newsId)}" style="color:#93c5fd; text-decoration:none;"><i class="fa-regular fa-newspaper"></i> ${escapeHtml(puzzle.source)}</a>`
                : escapeHtml(puzzle.source))
            : '';
        const solversInfo = (currentOffset === 0 && puzzle.solveCount)
            ? `<span style="color:#34d399;" title="${(puzzle.solvers || []).join(', ')}">✓ dnes vyřešilo ${puzzle.solveCount}</span>`
            : '';
        metaEl.innerHTML = [players, src, solversInfo].filter(Boolean).join(' · ');

        // VÍCETAHOVÉ řešení jako v Puzzle Raceru: hádáš celou hlavní variantu,
        // soupeř po každém správném tahu sám odpoví.
        let solved = false;
        let animating = false;
        let selectedSq = null;
        const lineUci = (Array.isArray(puzzle.lineUci) && puzzle.lineUci.length
            ? puzzle.lineUci : [puzzle.solutionUci]).filter(Boolean);
        let lineIdx = 0;           // index dalšího očekávaného tahu HRÁČE v linii
        let liveGame = null;       // stav partie přes celou variantu
        const playerColor = puzzle.toMove;
        const playerMovesTotal = Math.ceil(lineUci.length / 2);

        const sqEl = (sq) => document.querySelector(`#dpBoard [data-square="${sq}"]`);
        const clearSel = () => { document.querySelectorAll('#dpBoard [data-square]').forEach(s => { s.style.boxShadow = ''; }); selectedSq = null; };
        const highlight = (sq) => { const el = sqEl(sq); if (el) el.style.boxShadow = 'inset 0 0 0 3px rgba(96,165,250,0.9)'; };

        // chessboard.js připne taženou figurku na <body> bez z-indexu → byla ZA modalem (z-index 13000) = neviditelná
        if (!document.getElementById('dp-drag-zfix')) {
            const zf = document.createElement('style');
            zf.id = 'dp-drag-zfix';
            zf.textContent = 'body > .piece-417db { z-index: 14000 !important; }';
            document.head.appendChild(zf);
        }

        const recordSolve = () => {
            if (currentOffset !== 0) return;
            fetch(`${API}/weekly-puzzles/daily/solve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...dpAuthHeaders() },
                body: JSON.stringify({ offset: 0 }),
            }).then(r => r.ok ? r.json() : null).then(d => {
                if (d && typeof d.streak === 'number' && d.streak > 0) renderStreak(d.streak);
            }).catch(() => {});
            if (!dpToken()) {
                try {
                    const ls = localStreak();
                    const today = puzzle.date;
                    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                    if (ls.last !== today) {
                        const streak = (ls.last === yest ? (ls.streak || 0) : 0) + 1;
                        localStorage.setItem('dpStreak', JSON.stringify({ last: today, streak }));
                        renderStreak(streak);
                    }
                } catch (e) {}
            }
        };

        const finishSolved = () => {
            solved = true;
            statusEl.innerHTML = '<span style="color:#34d399;"><i class="fa-solid fa-circle-check"></i> Vyřešeno! 🎉 ' + escapeHtml(puzzle.solutionLine || puzzle.solutionSan || '') + '</span>';
            if (puzzle.solutionLine) { solBtn.style.display = 'none'; }
            recordSolve();
        };

        // Pokus hráče o tah from→to; vrací true = tah přijat (sedí s linií)
        const attemptMove = (from, to) => {
            if (solved || animating || !liveGame) return false;
            const exp = lineUci[lineIdx] || '';
            if (`${from}${to}` !== exp.slice(0, 4)) {
                // legální, ale mimo linii → chyba
                let legal = null;
                try { const probe = new Chess(liveGame.fen()); legal = probe.move({ from, to, promotion: 'q' }); } catch (e) { legal = null; }
                if (legal) {
                    statusEl.innerHTML = '<span style="color:#f87171;"><i class="fa-solid fa-circle-xmark"></i> Tohle ne. Zkus jiný tah.</span>';
                    retryBtn.style.display = 'inline-block';
                }
                clearSel();
                return false;
            }
            let mv;
            try { mv = liveGame.move({ from, to, promotion: exp.slice(4) || 'q' }); } catch (e) { mv = null; }
            if (!mv) { clearSel(); return false; }
            clearSel();
            lineIdx++;

            if (lineIdx >= lineUci.length) {
                boardObj.position(liveGame.fen());
                finishSolved();
                return true;
            }

            // soupeřova odpověď z linie
            const solvedSoFar = Math.ceil(lineIdx / 2);
            statusEl.innerHTML = `<span style="color:#34d399;"><i class="fa-solid fa-circle-check"></i> Správně! (${solvedSoFar}/${playerMovesTotal}) Pokračuj…</span>`;
            animating = true;
            setTimeout(() => {
                const opp = lineUci[lineIdx];
                try { liveGame.move({ from: opp.slice(0, 2), to: opp.slice(2, 4), promotion: opp.slice(4) || 'q' }); } catch (e) {}
                lineIdx++;
                boardObj.position(liveGame.fen());
                animating = false;
                if (lineIdx >= lineUci.length) finishSolved();
            }, 450);
            return true;
        };

        const renderBoard = () => {
            if (typeof Chessboard === 'undefined' || typeof Chess === 'undefined') {
                promptEl.textContent = 'Šachovnici se nepodařilo načíst.';
                return;
            }
            if (boardObj && boardObj.destroy) { try { boardObj.destroy(); } catch (e) {} }
            selectedSq = null;
            liveGame = new Chess(puzzle.fen);
            lineIdx = 0;
            animating = false;
            // Drag I klikání: táhni figurku, NEBO klikni figurku → cílové pole
            boardObj = Chessboard('dpBoard', {
                position: puzzle.fen.split(' ')[0],
                orientation: playerColor === 'b' ? 'black' : 'white',
                draggable: true,
                pieceTheme: PIECE_THEME,
                onDragStart: (src, piece) => {
                    if (solved || animating) return false;
                    return (piece[0] === 'w') === (playerColor === 'w'); // jen hráčova strana
                },
                onDrop: (src, tgt) => {
                    if (solved || animating || src === tgt) return 'snapback';
                    const ok = attemptMove(src, tgt);
                    if (!ok) return 'snapback';
                    // sync (rošáda/proměna/braní mimochodem)
                    boardObj.position(liveGame.fen(), false);
                    return undefined;
                },
            });
            setTimeout(() => { if (boardObj && boardObj.resize) boardObj.resize(); }, 80);
        };
        renderBoard();

        // Klik handler (jednou na kontejner, starý odeber)
        const boardContainer = document.getElementById('dpBoard');
        if (boardContainer.__dpHandler) boardContainer.removeEventListener('click', boardContainer.__dpHandler);
        const handler = (e) => {
            if (solved || animating || !liveGame) return;
            const cell = e.target.closest('[data-square]');
            if (!cell) return;
            const square = cell.getAttribute('data-square');
            if (!selectedSq) {
                const pc = liveGame.get(square);
                if (pc && pc.color === playerColor) { selectedSq = square; highlight(square); }
                return;
            }
            if (square === selectedSq) { clearSel(); return; }
            const from = selectedSq;
            const accepted = attemptMove(from, square);
            if (accepted) {
                boardObj.position(liveGame.fen(), false);
            } else {
                // klik na vlastní figuru = přepnout výběr
                const pc = liveGame.get(square);
                if (pc && pc.color === playerColor) { selectedSq = square; highlight(square); }
            }
        };
        boardContainer.__dpHandler = handler;
        boardContainer.addEventListener('click', handler);

        solBtn.onclick = () => { statusEl.innerHTML = '<span style="color:#34d399;">' + escapeHtml(puzzle.solutionLine || puzzle.solutionSan || '') + '</span>'; };
        retryBtn.onclick = () => { solved = false; statusEl.textContent = ''; retryBtn.style.display = 'none'; renderBoard(); };
    }

    window.openDailyPuzzle = openDailyPuzzle;

    function initHeroTiles() {
        loadTiles();

        // ?hadanka v URL → otevřít modal hned (ikonka v hlavičce z jiných stránek)
        if (/[?&#]hadanka/.test(window.location.search + window.location.hash)) {
            setTimeout(() => openDailyPuzzle(), 150);
        }

        // ikonka v hlavičce na homepage: otevřít rovnou, bez reloadu
        // (hlavička se injektuje async — naváž po jejím načtení)
        const hookHeaderBtn = () => {
            const btn = document.getElementById('dailyPuzzleHeaderBtn');
            if (!btn) return false;
            btn.addEventListener('click', (e) => { e.preventDefault(); openDailyPuzzle(); });
            return true;
        };
        if (!hookHeaderBtn()) {
            let tries = 0;
            const iv = setInterval(() => { if (hookHeaderBtn() || ++tries > 20) clearInterval(iv); }, 300);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeroTiles);
    } else {
        initHeroTiles();
    }
})();
