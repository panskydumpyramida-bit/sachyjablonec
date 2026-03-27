/**
 * Game Fragment Viewer — compact inline widget for articles
 * Renders <div class="game-fragment" data-fragment-id="X"> elements
 * as interactive mini chess boards with move navigation.
 *
 * Dependencies: chess.js, chessboardjs (loaded in article.html)
 */
(function () {
    'use strict';

    // Fix: Use local images, unpkg link was broken or returning 404s
    const PIECE_THEME = '/img/chesspieces/wikipedia/{piece}.png';
    let fragmentCounter = 0;

    /**
     * Initialize all fragment viewers on the page
     */
    window.initGameFragments = function () {
        const placeholders = document.querySelectorAll('.game-fragment[data-fragment-id]');
        if (!placeholders.length) return;

        placeholders.forEach(el => {
            const fid = el.getAttribute('data-fragment-id');
            if (!fid || el.dataset.initialized) return;
            el.dataset.initialized = 'true';
            loadFragment(el, fid);
        });
    };

    async function loadFragment(container, fragmentId) {
        const apiUrl = (typeof window.API_URL !== 'undefined') ? window.API_URL : '/api';

        try {
            const res = await fetch(`${apiUrl}/fragments/${fragmentId}`);
            if (!res.ok) {
                container.innerHTML = `<div style="padding:1rem;color:#f87171;font-size:0.85rem;text-align:center;">
                    <i class="fa-solid fa-triangle-exclamation"></i> Fragment #${fragmentId} nenalezen</div>`;
                return;
            }
            const fragment = await res.json();
            renderFragmentWidget(container, fragment);
        } catch (e) {
            console.error('Fragment load error:', e);
            container.innerHTML = `<div style="padding:1rem;color:#f87171;font-size:0.85rem;text-align:center;">
                <i class="fa-solid fa-triangle-exclamation"></i> Chyba načítání fragmentu</div>`;
        }
    }

    function renderFragmentWidget(container, fragment) {
        fragmentCounter++;
        const uid = `frag-${fragmentCounter}`;

        // Parse PGN moves
        const chess = new Chess(fragment.startFen || undefined);
        const moves = [];
        if (fragment.pgn) {
            // Strip headers and result, get pure moves
            const pgnClean = fragment.pgn
                .replace(/\[.*?\]\s*/g, '')
                .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\s*$/, '')
                .trim();
            const tokens = pgnClean.split(/\s+/).filter(t => t && !t.match(/^\d+\.+$/));
            tokens.forEach(san => {
                const move = chess.move(san);
                if (move) {
                    moves.push({
                        san: move.san,
                        fen: chess.fen()
                    });
                }
            });
        }

        // Build UI
        const startFen = fragment.startFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

        // Move list HTML (compact: "1.e4 e5 2.Nf3 Nc6...")
        let moveListHtml = '';
        for (let i = 0; i < moves.length; i++) {
            const isWhite = i % 2 === 0;
            const moveNum = Math.floor(i / 2) + fragment.fromMove;
            if (isWhite) {
                moveListHtml += `<span style="color:var(--text-muted);font-size:0.75rem;margin-left:0.1rem;">${moveNum}.</span>`;
            }
            moveListHtml += `<span class="frag-move" data-frag-uid="${uid}" data-move-idx="${i}"
                style="cursor:pointer;padding:1px 3px;border-radius:3px;font-size:0.8rem;transition:background 0.15s;display:inline-block;margin:0 1px;">${moves[i].san}</span>`;
        }

        // Title info
        const titleParts = [];
        if (fragment.white) titleParts.push(fragment.white);
        if (fragment.black) titleParts.push(fragment.black);
        const titleStr = fragment.title || (titleParts.length === 2 ? `${titleParts[0]} vs ${titleParts[1]}` : `Fragment #${fragment.id}`);
        const rangeStr = `${fragment.fromMove}–${fragment.toMove}. tah`;

        container.innerHTML = `
            <div style="background:var(--surface-color, #1e1e1e);border:1px solid rgba(96,165,250,0.2);border-radius:10px;overflow:hidden;margin:1rem 0;">
                <!-- Header -->
                <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:rgba(96,165,250,0.06);border-bottom:1px solid rgba(96,165,250,0.1);">
                    <i class="fa-solid fa-chess" style="color:#60a5fa;font-size:0.8rem;"></i>
                    <span style="font-size:0.85rem;font-weight:600;color:#e0e0e0;flex:1;">${escapeHtml(titleStr)}</span>
                    <span style="font-size:0.7rem;color:var(--text-muted,#a0a0a0);">${rangeStr}</span>
                </div>
                <!-- Content: Board + Moves -->
                <div style="display:flex;gap:0;flex-wrap:wrap;">
                    <!-- Mini Board -->
                    <div style="width:220px;min-width:180px;flex-shrink:0;padding:0.75rem;border-right:1px solid rgba(255,255,255,0.05);">
                        <div id="${uid}-board" style="width:100%;box-shadow:0 4px 10px rgba(0,0,0,0.2);border-radius:2px;overflow:hidden;"></div>
                        
                        <!-- Nav Controls Bottom -->
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem;">
                            <div style="display:flex;gap:0.2rem;">
                                <button onclick="fragNav('${uid}','start')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.75rem;" title="Na začátek"><i class="fa-solid fa-backward-fast"></i></button>
                                <button onclick="fragNav('${uid}','prev')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.75rem;" title="Předchozí"><i class="fa-solid fa-backward-step"></i></button>
                                <button onclick="fragNav('${uid}','next')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.75rem;" title="Další"><i class="fa-solid fa-forward-step"></i></button>
                                <button onclick="fragNav('${uid}','end')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.75rem;" title="Na konec"><i class="fa-solid fa-forward-fast"></i></button>
                            </div>
                        </div>
                    </div>
                    <!-- Moves Panel -->
                    <div style="flex:1;min-width:150px;display:flex;flex-direction:column;justify-content:space-between;">
                        <div id="${uid}-moves" style="padding:0.75rem;line-height:1.7;max-height:220px;overflow-y:auto;word-break:break-word;">
                            ${moveListHtml || '<span style="color:var(--text-muted);font-size:0.8rem;">Žádné tahy</span>'}
                        </div>
                        
                        <!-- Extra Controls (Autoplay & Engine) -->
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0.75rem;background:rgba(0,0,0,0.15);border-top:1px solid rgba(255,255,255,0.05);">
                            <div style="display:flex;gap:0.4rem;">
                                <button onclick="toggleFragAutoplay('${uid}')" id="${uid}-autoplay-btn" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:0.7rem;display:flex;align-items:center;gap:0.3rem;" title="Automatické přehrávání">
                                    <i id="${uid}-autoplay-icon" class="fa-solid fa-play"></i> Auto
                                </button>
                                <button onclick="toggleFragEngine('${uid}')" id="${uid}-engine-btn" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:0.7rem;display:flex;align-items:center;gap:0.3rem;" title="Hodnocení motoru (Lichess)">
                                    <i class="fa-solid fa-microchip"></i> Motor
                                </button>
                                <span id="${uid}-eval" style="display:none;background:rgba(0,0,0,0.4);color:#fff;font-family:monospace;font-size:0.7rem;padding:3px 6px;border-radius:4px;min-width:35px;text-align:center;"></span>
                            </div>
                            <span id="${uid}-pos" style="font-size:0.65rem;color:var(--text-muted,#a0a0a0);">0/${moves.length}</span>
                        </div>
                    </div>
                </div>
            </div>`;

        // Initialize chessboard
        requestAnimationFrame(() => {
            const boardEl = document.getElementById(`${uid}-board`);
            if (!boardEl) return;

            const board = Chessboard(`${uid}-board`, {
                position: startFen,
                pieceTheme: PIECE_THEME,
                draggable: false,
                showNotation: false
            });

            // Store state
            const state = {
                board,
                moves,
                startFen,
                currentIdx: -1, // -1 = start position
                autoplayTimer: null,
                engineEnabled: false
            };

            window._fragStates = window._fragStates || {};
            window._fragStates[uid] = state;

            // Attach click handlers to moves
            document.querySelectorAll(`[data-frag-uid="${uid}"]`).forEach(el => {
                el.addEventListener('click', () => {
                    const idx = parseInt(el.getAttribute('data-move-idx'));
                    goToMove(uid, idx);
                });
            });

            updatePositionDisplay(uid);
        });
    }

    function goToMove(uid, idx) {
        const state = window._fragStates?.[uid];
        if (!state) return;

        if (idx < -1) idx = -1;
        if (idx >= state.moves.length) idx = state.moves.length - 1;

        state.currentIdx = idx;
        const fen = idx === -1 ? state.startFen : state.moves[idx].fen;
        state.board.position(fen, true);
        updatePositionDisplay(uid);

        if (state.engineEnabled) {
            runFragEngine(uid);
        }
    }

    function updatePositionDisplay(uid) {
        const state = window._fragStates?.[uid];
        if (!state) return;

        // Update position counter
        const posEl = document.getElementById(`${uid}-pos`);
        if (posEl) posEl.textContent = `${state.currentIdx + 1}/${state.moves.length}`;

        // Highlight active move
        document.querySelectorAll(`[data-frag-uid="${uid}"]`).forEach(el => {
            const idx = parseInt(el.getAttribute('data-move-idx'));
            el.style.background = idx === state.currentIdx ? 'rgba(96,165,250,0.25)' : '';
            el.style.fontWeight = idx === state.currentIdx ? '700' : '';
            el.style.color = idx === state.currentIdx ? '#60a5fa' : '#e0e0e0';
            
            // Auto-scroll active move into view if possible
            if (idx === state.currentIdx) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    // --- Global Controls ---

    window.fragNav = function (uid, action) {
        const state = window._fragStates?.[uid];
        if (!state) return;

        switch (action) {
            case 'start': goToMove(uid, -1); break;
            case 'prev': goToMove(uid, state.currentIdx - 1); break;
            case 'next': goToMove(uid, state.currentIdx + 1); break;
            case 'end': goToMove(uid, state.moves.length - 1); break;
        }
    };

    window.toggleFragAutoplay = function(uid) {
        const state = window._fragStates?.[uid];
        if (!state) return;
        
        const btn = document.getElementById(`${uid}-autoplay-btn`);
        const icon = document.getElementById(`${uid}-autoplay-icon`);
        
        if (state.autoplayTimer) {
            clearInterval(state.autoplayTimer);
            state.autoplayTimer = null;
            icon.className = "fa-solid fa-play";
            btn.style.color = "#ccc";
        } else {
            // If already at end, restart
            if (state.currentIdx >= state.moves.length - 1) {
                goToMove(uid, -1);
            }
            state.autoplayTimer = setInterval(() => {
                if (state.currentIdx >= state.moves.length - 1) {
                    clearInterval(state.autoplayTimer);
                    state.autoplayTimer = null;
                    icon.className = "fa-solid fa-play";
                    btn.style.color = "#ccc";
                } else {
                    fragNav(uid, 'next');
                }
            }, 1500); // 1.5s per move
            icon.className = "fa-solid fa-pause";
            btn.style.color = "#4ade80"; // Active green
        }
    };

    window.toggleFragEngine = function(uid) {
        const state = window._fragStates?.[uid];
        if (!state) return;

        state.engineEnabled = !state.engineEnabled;
        const btn = document.getElementById(`${uid}-engine-btn`);
        const evalEl = document.getElementById(`${uid}-eval`);

        if (state.engineEnabled) {
            btn.style.color = '#4ade80';
            evalEl.style.display = 'inline-block';
            runFragEngine(uid);
        } else {
            btn.style.color = '#ccc';
            evalEl.style.display = 'none';
        }
    };

    // Debouncer for engine requests
    const engineTimers = {};
    
    async function runFragEngine(uid) {
        const state = window._fragStates?.[uid];
        if (!state || !state.engineEnabled) return;
        
        const fen = state.currentIdx === -1 ? state.startFen : state.moves[state.currentIdx].fen;
        const evalEl = document.getElementById(`${uid}-eval`);
        
        // Clear previous debounced call
        if (engineTimers[uid]) clearTimeout(engineTimers[uid]);
        
        evalEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        
        engineTimers[uid] = setTimeout(async () => {
            try {
                // Lichess Cloud Eval API - very fast, no local WASM needed
                const res = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.pvs && data.pvs[0]) {
                        const pv = data.pvs[0];
                        let text = '';
                        // Usually white's perspective, mate is positive if white mates, negative if black
                        if (pv.mate) {
                            text = `M${Math.abs(pv.mate)}`;
                            evalEl.style.color = pv.mate > 0 ? '#4ade80' : '#f87171';
                        } else {
                            const val = pv.cp / 100;
                            text = (val > 0 ? '+' : '') + val.toFixed(1);
                            // Simple color heuristic
                            if (val > 1.0) evalEl.style.color = '#4ade80';
                            else if (val < -1.0) evalEl.style.color = '#f87171';
                            else evalEl.style.color = '#fff';
                        }
                        evalEl.textContent = text;
                        evalEl.title = `Hloubka: ${data.depth}`;
                    } else {
                        evalEl.textContent = '-.-';
                        evalEl.style.color = '#ccc';
                    }
                } else {
                    evalEl.textContent = '-.-';
                    evalEl.style.color = '#ccc';
                }
            } catch(e) {
                evalEl.textContent = 'Err';
                evalEl.style.color = '#f87171';
            }
        }, 300); // 300ms debounce
    }

    function escapeHtml(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
})();
