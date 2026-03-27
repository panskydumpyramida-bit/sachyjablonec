/**
 * Game Fragment Viewer — compact inline widget for articles
 * Renders <div class="game-fragment" data-fragment-id="X"> elements
 * as interactive mini chess boards with move navigation.
 *
 * Dependencies: chess.js, chessboardjs (loaded in article.html)
 */
(function () {
    'use strict';

    // Inject minimal CSS for fragment viewer UI
    const style = document.createElement('style');
    style.textContent = `
        .frag-eval-bar {
            width: 14px;
            background: #2a2a2a;
            border-radius: 3px;
            position: relative;
            overflow: hidden;
            display: none;
            margin-right: 8px;
            border: 1px solid rgba(255,255,255,0.1);
            flex-shrink: 0;
        }
        .frag-eval-bar.active { display: block; }
        .frag-eval-fill {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            background: #e0e0e0;
            transition: height 0.3s ease, background 0.3s ease;
        }
        .frag-eval-fill.mate { background: #d4af37; } /* Gold for mate */
        .frag-eval-text {
            position: absolute;
            width: 100%;
            text-align: center;
            font-size: 0.55rem;
            font-weight: 700;
            color: #111;
            z-index: 2;
            pointer-events: none;
        }
        .frag-eval-text.top { top: 2px; color: #fff;}
        .frag-eval-text.bottom { bottom: 2px; color: #000; }
    `;
    document.head.appendChild(style);

    const PIECE_THEME = '/img/chesspieces/wikipedia/{piece}.png';
    let fragmentCounter = 0;

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
                container.innerHTML = `<div style="padding:1rem;color:#f87171;font-size:0.85rem;text-align:center;"><i class="fa-solid fa-triangle-exclamation"></i> Fragment #${fragmentId} nenalezen</div>`;
                return;
            }
            const fragment = await res.json();
            renderFragmentWidget(container, fragment);
        } catch (e) {
            container.innerHTML = `<div style="padding:1rem;color:#f87171;font-size:0.85rem;text-align:center;"><i class="fa-solid fa-triangle-exclamation"></i> Chyba načítání fragmentu</div>`;
        }
    }

    function renderFragmentWidget(container, fragment) {
        fragmentCounter++;
        const uid = `frag-${fragmentCounter}`;

        const chess = new Chess(fragment.startFen || undefined);
        const moves = [];
        if (fragment.pgn) {
            let pgnClean = fragment.pgn.replace(/\[.*?\]\s*/g, '').replace(/\b(1-0|0-1|1\/2-1\/2|\*)\s*$/, '').trim();
            let pgnNoVars = pgnClean;
            let lastLen;
            do {
                lastLen = pgnNoVars.length;
                pgnNoVars = pgnNoVars.replace(/\([^()]*\)/g, '');
            } while (pgnNoVars.length < lastLen);

            const regex = /{[^}]*}|\$\d+|[!?]+|[a-zA-Z0-9\-+=#]+/g;
            const rawTokens = pgnNoVars.match(regex) || [];
            
            let currentMoveObj = null;

            rawTokens.forEach(token => {
                if (token.match(/^\d+\.?+$/) || token.match(/^\d+\.\.\.$/)) return;
                
                if (token.startsWith('{')) {
                    if (currentMoveObj) {
                        currentMoveObj.comment = token.substring(1, token.length - 1).trim();
                    }
                } else if (token.startsWith('$')) {
                    const nagMap = { '$1': '!', '$2': '?', '$3': '!!', '$4': '??', '$5': '!?', '$6': '?!' };
                    if (currentMoveObj && nagMap[token]) currentMoveObj.nag = nagMap[token];
                } else if (token.match(/^[!?]+$/)) {
                    if (currentMoveObj) currentMoveObj.nag = token;
                } else {
                    const move = chess.move(token);
                    if (move) {
                        currentMoveObj = { san: move.san, fen: chess.fen(), comment: '', nag: '' };
                        moves.push(currentMoveObj);
                    }
                }
            });
        }

        const startFen = fragment.startFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const startFenTurn = startFen.split(' ')[1] || 'w';
        
        const renderMoveSpan = (i, moveObj) => {
            const nagHtml = moveObj.nag ? `<span style="color:#60a5fa;font-weight:bold;margin-left:2px;">${moveObj.nag}</span>` : '';
            return `<span class="frag-move" data-frag-uid="${uid}" data-move-idx="${i}" style="cursor:pointer;padding:1px 4px;border-radius:3px;font-size:0.8rem;transition:background 0.15s;display:inline-block;flex:1;text-align:left;">${moveObj.san}${nagHtml}</span>`;
        };
        
        const renderComment = (moveObj) => {
            if (!moveObj || !moveObj.comment) return '';
            return `<div style="font-size:0.75rem; color:#9ca3af; padding-left:28px; padding-bottom:6px; line-height:1.3; font-style:italic;">${escapeHtml(moveObj.comment)}</div>`;
        };
        
        let moveListHtml = '';
        let mIdx = 0;
        let pgnMoveNum = fragment.fromMove;
        
        while (mIdx < moves.length) {
            moveListHtml += `<div style="display:flex; gap:0.3rem; margin-bottom:0.1rem; align-items:center;">`;
            let wIdx = -1, bIdx = -1;
            
            if (mIdx === 0 && startFenTurn === 'b') {
                moveListHtml += `<span style="color:var(--text-muted);font-size:0.75rem;width:24px;text-align:right;">${pgnMoveNum}...</span>`;
                moveListHtml += `<span style="flex:1;"></span>`;
                moveListHtml += renderMoveSpan(mIdx, moves[mIdx]);
                bIdx = mIdx;
                mIdx++;
                pgnMoveNum++;
            } else {
                moveListHtml += `<span style="color:var(--text-muted);font-size:0.75rem;width:24px;text-align:right;">${pgnMoveNum}.</span>`;
                moveListHtml += renderMoveSpan(mIdx, moves[mIdx]);
                wIdx = mIdx;
                mIdx++;
                if (mIdx < moves.length) {
                    moveListHtml += renderMoveSpan(mIdx, moves[mIdx]);
                    bIdx = mIdx;
                    mIdx++;
                }
                pgnMoveNum++;
            }
            moveListHtml += `</div>`;
            
            if (wIdx !== -1 && moves[wIdx].comment) {
                moveListHtml += renderComment(moves[wIdx]);
            }
            if (bIdx !== -1 && moves[bIdx].comment) {
                moveListHtml += renderComment(moves[bIdx]);
            }
        }

        let cleanWhite = fragment.white ? fragment.white.replace(/\s*\(\d+\s*[-–]\s*\d+\)/g, '') : '';
        let cleanBlack = fragment.black ? fragment.black.replace(/\s*\(\d+\s*[-–]\s*\d+\)/g, '') : '';
        const titleParts = [];
        if (cleanWhite) titleParts.push(cleanWhite);
        if (cleanBlack) titleParts.push(cleanBlack);
        let titleStr = fragment.title || (titleParts.length === 2 ? `${titleParts[0]} vs ${titleParts[1]}` : `Fragment #${fragment.id}`);
        titleStr = titleStr.replace(/\s*\(\d+\s*[-–]\s*\d+\)/g, '');
        const rangeStr = `${fragment.fromMove}–${fragment.toMove}. tah`;

        container.innerHTML = `
            <div style="background:var(--surface-color, #1e1e1e);border:1px solid rgba(96,165,250,0.2);border-radius:10px;overflow:hidden;margin:1rem 0;">
                <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:rgba(96,165,250,0.06);border-bottom:1px solid rgba(96,165,250,0.1);">
                    <i class="fa-solid fa-chess" style="color:#60a5fa;font-size:0.8rem;"></i>
                    <span style="font-size:0.85rem;font-weight:600;color:#e0e0e0;flex:1;">${escapeHtml(titleStr)}</span>
                    <span style="font-size:0.7rem;color:var(--text-muted,#a0a0a0);">${rangeStr}</span>
                </div>
                <div style="display:flex;gap:0;flex-wrap:wrap;">
                    <!-- Mini Board Column -->
                    <div style="width:230px;min-width:200px;flex-shrink:0;padding:0.75rem;border-right:1px solid rgba(255,255,255,0.05);">
                        <div style="display:flex; align-items:stretch;">
                            <div id="${uid}-eval-bar" class="frag-eval-bar">
                                <div id="${uid}-eval-fill" class="frag-eval-fill" style="height: 50%;"></div>
                                <span id="${uid}-eval-text-top" class="frag-eval-text top"></span>
                                <span id="${uid}-eval-text-bottom" class="frag-eval-text bottom">0.0</span>
                            </div>
                            <div id="${uid}-board" style="flex:1; box-shadow:0 4px 10px rgba(0,0,0,0.2);border-radius:2px;overflow:hidden;"></div>
                        </div>
                        
                        <!-- Nav Controls Bottom (Icons Only) -->
                        <div style="display:flex;justify-content:center;align-items:center;margin-top:0.6rem;">
                            <div style="display:flex;gap:0.2rem;">
                                <button onclick="toggleFragAutoplay('${uid}')" id="${uid}-autoplay-btn" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.75rem;" title="Autoplay"><i id="${uid}-autoplay-icon" class="fa-solid fa-play"></i></button>
                                <button onclick="fragNav('${uid}','start')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.75rem;" title="Začátek"><i class="fa-solid fa-backward-fast"></i></button>
                                <button onclick="fragNav('${uid}','prev')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.75rem;" title="Předchozí"><i class="fa-solid fa-backward-step"></i></button>
                                <button onclick="fragNav('${uid}','next')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.75rem;" title="Další"><i class="fa-solid fa-forward-step"></i></button>
                                <button onclick="fragNav('${uid}','end')" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.75rem;" title="Konec"><i class="fa-solid fa-forward-fast"></i></button>
                                <button onclick="toggleFragEngine('${uid}')" id="${uid}-engine-btn" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:0.75rem;" title="Motor"><i class="fa-solid fa-microchip"></i></button>
                            </div>
                        </div>
                    </div>
                    <!-- Moves Panel -->
                    <div style="flex:1;min-width:150px;display:flex;flex-direction:column;justify-content:space-between;">
                        <div id="${uid}-moves" style="padding:0.75rem;line-height:1.7;max-height:220px;overflow-y:auto;word-break:break-word;">
                            ${moveListHtml || '<span style="color:var(--text-muted);font-size:0.8rem;">Žádné tahy</span>'}
                        </div>
                        <div id="${uid}-pv" style="display:none; padding: 0.5rem 0.75rem; font-size: 0.70rem; color: #9ca3af; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05); text-align: left; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; height: 32px;" title=""></div>
                        <div style="display:flex;justify-content:flex-end;align-items:center;padding:0.5rem 0.75rem;background:rgba(0,0,0,0.15);border-top:1px solid rgba(255,255,255,0.05);">
                            <span id="${uid}-pos" style="font-size:0.65rem;color:var(--text-muted,#a0a0a0);">0/${moves.length}</span>
                        </div>
                    </div>
                </div>
            </div>`;

        requestAnimationFrame(() => {
            const boardEl = document.getElementById(`${uid}-board`);
            if (!boardEl) return;
            const board = Chessboard(`${uid}-board`, { position: startFen, pieceTheme: PIECE_THEME, draggable: false, showNotation: false });
            const state = { board, moves, startFen, currentIdx: -1, autoplayTimer: null, engineEnabled: false };
            window._fragStates = window._fragStates || {};
            window._fragStates[uid] = state;
            document.querySelectorAll(`[data-frag-uid="${uid}"]`).forEach(el => {
                el.addEventListener('click', () => goToMove(uid, parseInt(el.getAttribute('data-move-idx'))));
            });
            // Ensure board resizes properly
            setTimeout(() => board.resize(), 100);
            updatePositionDisplay(uid);
        });
    }

    function goToMove(uid, idx) {
        const state = window._fragStates?.[uid];
        if (!state) return;
        if (idx < -1) idx = -1;
        if (idx >= state.moves.length) idx = state.moves.length - 1;
        state.currentIdx = idx;
        state.board.position(idx === -1 ? state.startFen : state.moves[idx].fen, true);
        updatePositionDisplay(uid);
        if (state.engineEnabled) runFragEngine(uid);
    }

    function updatePositionDisplay(uid) {
        const state = window._fragStates?.[uid];
        if (!state) return;
        const posEl = document.getElementById(`${uid}-pos`);
        if (posEl) posEl.textContent = `${state.currentIdx + 1}/${state.moves.length}`;
        document.querySelectorAll(`[data-frag-uid="${uid}"]`).forEach(el => {
            const idx = parseInt(el.getAttribute('data-move-idx'));
            el.style.background = idx === state.currentIdx ? 'rgba(96,165,250,0.25)' : '';
            el.style.fontWeight = idx === state.currentIdx ? '700' : '';
            el.style.color = idx === state.currentIdx ? '#60a5fa' : '#e0e0e0';
            if (idx === state.currentIdx) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }

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
        if (state.autoplayTimer) {
            clearInterval(state.autoplayTimer); state.autoplayTimer = null;
            document.getElementById(`${uid}-autoplay-icon`).className = "fa-solid fa-play";
            document.getElementById(`${uid}-autoplay-btn`).style.color = "#ccc";
        } else {
            if (state.currentIdx >= state.moves.length - 1) goToMove(uid, -1);
            state.autoplayTimer = setInterval(() => {
                if (state.currentIdx >= state.moves.length - 1) {
                    clearInterval(state.autoplayTimer); state.autoplayTimer = null;
                    document.getElementById(`${uid}-autoplay-icon`).className = "fa-solid fa-play";
                    document.getElementById(`${uid}-autoplay-btn`).style.color = "#ccc";
                } else fragNav(uid, 'next');
            }, 1500);
            document.getElementById(`${uid}-autoplay-icon`).className = "fa-solid fa-pause";
            document.getElementById(`${uid}-autoplay-btn`).style.color = "#4ade80";
        }
    };

    window.toggleFragEngine = function(uid) {
        const state = window._fragStates?.[uid];
        if (!state) return;
        state.engineEnabled = !state.engineEnabled;
        const btn = document.getElementById(`${uid}-engine-btn`);
        const bar = document.getElementById(`${uid}-eval-bar`);
        const pvBox = document.getElementById(`${uid}-pv`);
        if (state.engineEnabled) {
            btn.style.color = '#4ade80';
            bar.classList.add('active');
            if (pvBox) pvBox.style.display = 'block';
            // Trigger resize to fix board dimensions now that bar showed up
            setTimeout(() => state.board.resize(), 10);
            runFragEngine(uid);
        } else {
            btn.style.color = '#ccc';
            bar.classList.remove('active');
            if (pvBox) {
                pvBox.style.display = 'none';
                pvBox.textContent = '';
            }
            setTimeout(() => state.board.resize(), 10);
        }
    };

    const engineTimers = {};
    async function runFragEngine(uid) {
        const state = window._fragStates?.[uid];
        if (!state || !state.engineEnabled) return;
        const fen = state.currentIdx === -1 ? state.startFen : state.moves[state.currentIdx].fen;
        
        const fillEl = document.getElementById(`${uid}-eval-fill`);
        const textTop = document.getElementById(`${uid}-eval-text-top`);
        const textBot = document.getElementById(`${uid}-eval-text-bottom`);
        const pvBox = document.getElementById(`${uid}-pv`);
        if(!fillEl) return;
        
        textTop.textContent = '';
        textBot.textContent = '...';
        if (pvBox) pvBox.textContent = 'Načítám motor...';
        fillEl.classList.remove('mate');

        if (engineTimers[uid]) clearTimeout(engineTimers[uid]);
        engineTimers[uid] = setTimeout(async () => {
            try {
                // 1. Try Lichess Cloud Eval
                const res = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.pvs && data.pvs[0]) {
                        updateEngineUI(fillEl, textTop, textBot, pvBox, data.pvs[0], 'lichess');
                        return;
                    }
                }
                
                // 2. Fallback to chess-api.com
                if (pvBox) pvBox.textContent = 'Počítám tahy (Stockfish)...';
                const fRes = await fetch('https://chess-api.com/v1', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fen: fen, depth: 12 })
                });
                
                if (fRes.ok) {
                    const fData = await fRes.json();
                    if (!fData.error) {
                         updateEngineUI(fillEl, textTop, textBot, pvBox, fData, 'chess-api');
                         return;
                    }
                }
                
                // fallback if both fail
                textBot.textContent = '0.0';
                fillEl.style.height = '50%';
                if (pvBox) pvBox.textContent = 'Motor nedostupný';
            } catch(e) {
                textBot.textContent = 'Err';
                fillEl.style.height = '50%';
                if (pvBox) pvBox.textContent = 'Chyba spojení';
            }
        }, 400);
    }
    
    function updateEngineUI(fillEl, textTop, textBot, pvBox, data, source) {
        let valStr = '';
        let percentage = 50;
        let pvLine = '';

        if (source === 'lichess') {
            if (data.mate) {
                valStr = `M${Math.abs(data.mate)}`;
                percentage = data.mate > 0 ? 100 : 0;
                fillEl.classList.add('mate');
            } else {
                const val = data.cp / 100;
                valStr = (val > 0 ? '+' : '') + val.toFixed(1);
                percentage = 50 + 50 * Math.tanh(val / 4);
            }
            pvLine = data.moves || '';
        } else if (source === 'chess-api') {
            if (data.mate) {
                valStr = `M${Math.abs(data.mate)}`;
                percentage = data.mate > 0 ? 100 : 0;
                fillEl.classList.add('mate');
            } else {
                const val = data.eval;
                valStr = (val > 0 ? '+' : '') + val.toFixed(1);
                percentage = data.winChance || (50 + 50 * Math.tanh(val / 4));
            }
            pvLine = (data.continuationArr || []).join(' ');
        }
        
        fillEl.style.height = `${percentage}%`;
        
        if (percentage > 50) {
            textTop.textContent = valStr;
            textBot.textContent = '';
        } else {
            textTop.textContent = '';
            textBot.textContent = valStr;
        }
        
        if (pvBox) {
            pvBox.textContent = pvLine;
            pvBox.title = pvLine;
        }
    }

    function escapeHtml(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
})();
