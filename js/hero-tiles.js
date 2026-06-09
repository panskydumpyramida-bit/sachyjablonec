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
              <strong style="color:#f1f5f9; flex:1;">Hádanka dne</strong>
              <button id="dpClose" aria-label="Zavřít" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;line-height:1;">&times;</button>
            </div>
            <div style="padding:0.9rem 1rem;">
              <p id="dpPrompt" style="margin:0 0 0.6rem; color:#cbd5e1; font-size:0.9rem; text-align:center;">Načítám…</p>
              <div id="dpBoard" style="width:100%; max-width:340px; margin:0 auto;"></div>
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
        return modalEl;
    }

    function closeModal() {
        if (modalEl) modalEl.style.display = 'none';
        if (boardObj && boardObj.destroy) { try { boardObj.destroy(); } catch (e) {} boardObj = null; }
    }

    async function openDailyPuzzle() {
        ensureModal();
        modalEl.style.display = 'flex';
        const promptEl = modalEl.querySelector('#dpPrompt');
        const statusEl = modalEl.querySelector('#dpStatus');
        const metaEl = modalEl.querySelector('#dpMeta');
        const solBtn = modalEl.querySelector('#dpSolution');
        const retryBtn = modalEl.querySelector('#dpRetry');
        statusEl.textContent = ''; solBtn.style.display = 'none'; retryBtn.style.display = 'none';
        promptEl.textContent = 'Načítám…';

        let puzzle;
        try {
            const res = await fetch(`${API}/weekly-puzzles/daily`);
            if (!res.ok) throw new Error('no puzzle');
            puzzle = await res.json();
        } catch (e) {
            promptEl.textContent = 'Hádanka dne zatím není k dispozici.';
            return;
        }

        const turn = puzzle.toMove === 'b' ? 'Černý' : 'Bílý';
        promptEl.innerHTML = `<strong>${turn} na tahu</strong> — táhni nebo klikni figurku na cílové pole.`;
        const players = (puzzle.white && puzzle.black) ? `${escapeHtml(puzzle.white)} – ${escapeHtml(puzzle.black)}` : '';
        const src = puzzle.source
            ? (puzzle.newsId
                ? `<a href="/article.html?id=${encodeURIComponent(puzzle.newsId)}" style="color:#93c5fd; text-decoration:none;"><i class="fa-regular fa-newspaper"></i> ${escapeHtml(puzzle.source)}</a>`
                : escapeHtml(puzzle.source))
            : '';
        metaEl.innerHTML = [players, src].filter(Boolean).join(' · ');

        let solved = false;
        let selectedSq = null;
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

        // Sdílené vyhodnocení tahu (klik i drag)
        const applyVerdict = (userUci, mv, game) => {
            clearSel();
            if (userUci === (puzzle.solutionUci || '').slice(0, 4)) {
                solved = true;
                statusEl.innerHTML = '<span style="color:#34d399;"><i class="fa-solid fa-circle-check"></i> Správně! ' + escapeHtml(puzzle.solutionSan || mv.san) + '</span>';
                if (puzzle.solutionLine) { solBtn.style.display = 'inline-block'; solBtn.textContent = 'Ukázat celou variantu'; }
                boardObj.position(game.fen());
                return true;
            }
            statusEl.innerHTML = '<span style="color:#f87171;"><i class="fa-solid fa-circle-xmark"></i> Tohle ne. Zkus jiný tah.</span>';
            retryBtn.style.display = 'inline-block';
            return false;
        };

        const renderBoard = () => {
            if (typeof Chessboard === 'undefined' || typeof Chess === 'undefined') {
                promptEl.textContent = 'Šachovnici se nepodařilo načíst.';
                return;
            }
            if (boardObj && boardObj.destroy) { try { boardObj.destroy(); } catch (e) {} }
            selectedSq = null;
            // Drag I klikání: táhni figurku, NEBO klikni figurku → cílové pole
            boardObj = Chessboard('dpBoard', {
                position: puzzle.fen.split(' ')[0],
                orientation: puzzle.toMove === 'b' ? 'black' : 'white',
                draggable: true,
                pieceTheme: PIECE_THEME,
                onDragStart: (src, piece) => {
                    if (solved) return false;
                    return (piece[0] === 'w') === (puzzle.toMove === 'w'); // jen strana na tahu
                },
                onDrop: (src, tgt) => {
                    if (solved || src === tgt) return 'snapback'; // klik beze změny pole řeší click handler
                    const game = new Chess(puzzle.fen);
                    let mv;
                    try { mv = game.move({ from: src, to: tgt, promotion: 'q' }); } catch (e) { mv = null; }
                    if (!mv) return 'snapback';
                    return applyVerdict(src + tgt, mv, game) ? undefined : 'snapback';
                },
            });
            setTimeout(() => { if (boardObj && boardObj.resize) boardObj.resize(); }, 80);
        };
        renderBoard();

        // Klik handler (jednou na kontejner, starý odeber)
        const boardContainer = document.getElementById('dpBoard');
        if (boardContainer.__dpHandler) boardContainer.removeEventListener('click', boardContainer.__dpHandler);
        const handler = (e) => {
            if (solved) return;
            const cell = e.target.closest('[data-square]');
            if (!cell) return;
            const square = cell.getAttribute('data-square');
            const game = new Chess(puzzle.fen);
            if (!selectedSq) {
                const pc = game.get(square);
                if (pc && pc.color === puzzle.toMove) { selectedSq = square; highlight(square); }
                return;
            }
            if (square === selectedSq) { clearSel(); return; }
            let mv;
            try { mv = game.move({ from: selectedSq, to: square, promotion: 'q' }); } catch (e2) { mv = null; }
            if (!mv) {
                clearSel();
                const pc = game.get(square);
                if (pc && pc.color === puzzle.toMove) { selectedSq = square; highlight(square); }
                return;
            }
            applyVerdict(selectedSq + square, mv, game);
        };
        boardContainer.__dpHandler = handler;
        boardContainer.addEventListener('click', handler);

        solBtn.onclick = () => { statusEl.innerHTML = '<span style="color:#34d399;">' + escapeHtml(puzzle.solutionLine || puzzle.solutionSan || '') + '</span>'; };
        retryBtn.onclick = () => { solved = false; statusEl.textContent = ''; retryBtn.style.display = 'none'; renderBoard(); };
    }

    window.openDailyPuzzle = openDailyPuzzle;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadTiles);
    } else {
        loadTiles();
    }
})();
