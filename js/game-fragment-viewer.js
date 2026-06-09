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
        /* Mobil: pořádné tap targety + žádný iOS double-tap zoom při krokování tahů */
        .game-fragment button { min-width: 40px; min-height: 40px; touch-action: manipulation; }
        /* Telefon: board nad zápisem (vedle sebe se zápis vešel do ~80px a ořezával tahy) */
        @media (max-width: 480px) {
            .game-fragment .frag-cols { flex-direction: column !important; }
            .game-fragment .frag-cols > div:first-child {
                border-right: none !important;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            .game-fragment [id$="-moves"] { max-height: 220px !important; }
        }
    `;
    document.head.appendChild(style);

    const PIECE_THEME = 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png';
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

        const moves = []; // hlavní linie (ploché uzly) — pro šipky a eval
        const nagMap = { '$1': '!', '$2': '?', '$3': '!!', '$4': '??', '$5': '!?', '$6': '?!' };
        if (fragment.pgn) {
            const pgnClean = fragment.pgn.replace(/\[.*?\]\s*/g, '').replace(/\b(1-0|0-1|1\/2-1\/2|\*)\s*$/, '').trim();
            // tokeny VČETNĚ závorek variant
            const tokens = pgnClean.match(/\(|\)|{[^}]*}|\$\d+|[!?]+|[a-zA-Z0-9\-+=#]+/g) || [];
            let ti = 0;
            // rekurzivní parser — varianta je alternativa k POSLEDNÍMU tahu (větví z pozice před ním)
            const parseLine = (pos) => {
                const line = [];
                let last = null;
                while (ti < tokens.length) {
                    const tok = tokens[ti];
                    if (tok === ')') return line;
                    if (tok === '(') {
                        ti++;
                        if (last) {
                            const vline = parseLine(new Chess(last.preMoveFen));
                            (last.variations = last.variations || []).push(vline);
                        } else {
                            parseLine(new Chess(pos.fen())); // varianta bez předchozího tahu — projeď a zahoď
                        }
                        if (tokens[ti] === ')') ti++;
                        continue;
                    }
                    if (/^\d+\.+$/.test(tok)) { ti++; continue; }       // číslo tahu
                    if (tok[0] === '{') { if (last) last.comment = tok.slice(1, -1).trim(); ti++; continue; }
                    if (tok[0] === '$') { if (last && nagMap[tok]) last.nag = nagMap[tok]; ti++; continue; }
                    if (/^[!?]+$/.test(tok)) { if (last) last.nag = tok; ti++; continue; }
                    const fenBefore = pos.fen();
                    let mv = null;
                    try { mv = pos.move(tok); } catch (e) { mv = null; }
                    if (mv) {
                        last = { san: mv.san, color: mv.color, fen: pos.fen(), preMoveFen: fenBefore, comment: '', nag: '', variations: [] };
                        line.push(last);
                    }
                    ti++;
                }
                return line;
            };
            moves.push(...parseLine(new Chess(fragment.startFen || undefined)));
        }

        const startFen = fragment.startFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const startFenTurn = startFen.split(' ')[1] || 'w';
        
        const renderMoveSpan = (i, moveObj) => {
            const nagHtml = moveObj.nag ? `<span style="color:#60a5fa;font-weight:bold;margin-left:2px;">${moveObj.nag}</span>` : '';
            return `<span class="frag-move" data-frag-uid="${uid}" data-move-idx="${i}" style="cursor:pointer;padding:1px 3px;border-radius:3px;font-size:0.75rem;transition:background 0.15s;display:inline-block;white-space:nowrap;">${moveObj.san}${nagHtml}</span>`;
        };
        
        const renderComment = (moveObj) => {
            if (!moveObj || !moveObj.comment) return '';
            return `<div style="font-size:0.75rem; color:#9ca3af; padding-left:12px; padding-bottom:6px; line-height:1.3; font-style:italic; word-break:break-word;">${escapeHtml(moveObj.comment)}</div>`;
        };
        
        // Kompaktní vykreslení podvariant (ztlumené, malé, v závorkách, klikací)
        const varMoveSpan = (n) => `<span class="frag-var-move" data-frag-uid="${uid}" data-frag-fen="${n.fen}" style="cursor:pointer;padding:0 1px;border-radius:2px;color:#94a3b8;">${n.san}${n.nag ? `<span style="color:#7dd3fc;">${n.nag}</span>` : ''}</span>`;
        const renderVarLine = (line, mnStart, whiteStart) => {
            let html = '', mn = mnStart, white = whiteStart, first = true;
            for (const n of line) {
                if (white) html += `${first ? '' : ' '}<span style="color:#64748b;">${mn}.</span> `;
                else html += first ? `<span style="color:#64748b;">${mn}…</span> ` : ' ';
                html += varMoveSpan(n);
                if (n.comment) html += ` <span style="font-style:italic;color:#6b7280;">${escapeHtml(n.comment)}</span>`;
                if (n.variations && n.variations.length) {
                    for (const sub of n.variations) html += ` (${renderVarLine(sub, mn, white)})`;
                }
                if (!white) mn++;
                white = !white;
                first = false;
            }
            return html;
        };
        const renderVars = (node, moveNum, isWhite) => {
            if (!node || !node.variations || !node.variations.length) return '';
            return node.variations.map(v =>
                `<div style="font-size:0.68rem;color:#94a3b8;padding-left:12px;padding-bottom:3px;line-height:1.35;word-break:break-word;">( ${renderVarLine(v, moveNum, isWhite)} )</div>`
            ).join('');
        };

        let moveListHtml = '';
        let mIdx = 0;
        let pgnMoveNum = fragment.fromMove;

        const rowOpen = `<div style="display:flex; gap:0.3rem; margin-bottom:0.1rem; align-items:center;">`;
        const numSpan = (txt) => `<span style="color:var(--text-muted);font-size:0.75rem;width:24px;text-align:right;">${txt}</span>`;
        // Černý půltah na vlastním řádku, zarovnaný vpravo (po komentáři/variantě bílého nebo jako první půltah)
        const blackOnlyRow = (idx) => rowOpen + numSpan(`${pgnMoveNum}...`) + renderMoveSpan(idx, moves[idx]) + `</div>`;

        while (mIdx < moves.length) {
            const moveNum = pgnMoveNum;
            // Fragment začíná černým na tahu
            if (mIdx === 0 && startFenTurn === 'b') {
                moveListHtml += blackOnlyRow(mIdx);
                if (moves[mIdx].comment) moveListHtml += renderComment(moves[mIdx]);
                moveListHtml += renderVars(moves[mIdx], moveNum, false);
                pgnMoveNum++; mIdx++;
                continue;
            }

            const wIdx = mIdx;
            const wHasComment = !!moves[wIdx].comment;
            const wHasVars = !!(moves[wIdx].variations && moves[wIdx].variations.length);
            mIdx++;

            // Černý do stejného řádku jen když bílý nemá komentář ANI varianty
            let bIdx = -1;
            if (!wHasComment && !wHasVars && mIdx < moves.length) { bIdx = mIdx; mIdx++; }

            moveListHtml += rowOpen + numSpan(`${moveNum}.`) + renderMoveSpan(wIdx, moves[wIdx]);
            if (bIdx !== -1) moveListHtml += renderMoveSpan(bIdx, moves[bIdx]);
            moveListHtml += `</div>`;

            if (wHasComment) moveListHtml += renderComment(moves[wIdx]);
            moveListHtml += renderVars(moves[wIdx], moveNum, true);

            // Černý na vlastní řádek, pokud bílý měl komentář nebo varianty
            if ((wHasComment || wHasVars) && mIdx < moves.length) {
                bIdx = mIdx; mIdx++;
                moveListHtml += blackOnlyRow(bIdx);
            }
            if (bIdx !== -1) {
                if (moves[bIdx].comment) moveListHtml += renderComment(moves[bIdx]);
                moveListHtml += renderVars(moves[bIdx], moveNum, false);
            }
            pgnMoveNum++;
        }

        let cleanWhite = fragment.white ? fragment.white.replace(/\s*\(\d+\s*[-–]\s*\d+\)/g, '') : '';
        let cleanBlack = fragment.black ? fragment.black.replace(/\s*\(\d+\s*[-–]\s*\d+\)/g, '') : '';
        const titleParts = [];
        if (cleanWhite) titleParts.push(cleanWhite);
        if (cleanBlack) titleParts.push(cleanBlack);
        let titleStr = fragment.title || (titleParts.length === 2 ? `${titleParts[0]} vs ${titleParts[1]}` : `Fragment #${fragment.id}`);
        titleStr = titleStr.replace(/\s*\(\d+\s*[-–]\s*\d+\)/g, '');
        const rangeStr = `${fragment.fromMove}–${fragment.toMove}. tah`;

        container.removeAttribute('style');
        container.innerHTML = `
            <div style="background:var(--surface-color, #1e1e1e);border:1px solid rgba(96,165,250,0.2);border-radius:10px;overflow:hidden;margin:0.5rem 0;width:100%;max-width:450px;">
                <div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:rgba(96,165,250,0.06);border-bottom:1px solid rgba(96,165,250,0.1);">
                    <i class="fa-solid fa-chess" style="color:#60a5fa;font-size:0.8rem;"></i>
                    <span style="font-size:0.85rem;font-weight:600;color:#e0e0e0;flex:1;">${escapeHtml(titleStr)}</span>
                    <span style="font-size:0.7rem;color:var(--text-muted,#a0a0a0);">${rangeStr}</span>
                </div>
                <div class="frag-cols" style="display:flex;gap:0;">
                    <!-- Mini Board Column -->
                    <div id="${uid}-left-panel" style="flex:0 0 auto; transition:flex 0.2s; padding:0.4rem; border-right:1px solid rgba(255,255,255,0.05); display:flex; flex-direction:column;">
                        <div style="display:flex; align-items:stretch;">
                            <div id="${uid}-eval-bar" class="frag-eval-bar">
                                <div id="${uid}-eval-fill" class="frag-eval-fill" style="height: 50%;"></div>
                                <span id="${uid}-eval-text-top" class="frag-eval-text top"></span>
                                <span id="${uid}-eval-text-bottom" class="frag-eval-text bottom">—</span>
                            </div>
                            <div id="${uid}-board" style="width:min(248px,60vw);height:min(248px,60vw);flex:0 0 auto; box-shadow:0 4px 10px rgba(0,0,0,0.2);border-radius:2px;overflow:hidden;"></div>
                        </div>
                        
                        <!-- Nav Controls Bottom (Icons Only) -->
                        <div style="display:flex;justify-content:center;align-items:center;margin-top:0.5rem;">
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
                    <div id="${uid}-right-panel" style="flex:1 1 35%; transition:flex 0.2s; display:flex;flex-direction:column;justify-content:space-between; overflow:hidden;">
                        <div id="${uid}-moves" style="padding:0.2rem;line-height:1.7;flex:1;min-height:0;max-height:340px;overflow-y:auto;overflow-x:hidden;">
                            ${moveListHtml || '<span style="color:var(--text-muted);font-size:0.8rem;">Žádné tahy</span>'}
                        </div>
                    </div>
                </div>
            </div>`;

        requestAnimationFrame(() => {
            const boardEl = document.getElementById(`${uid}-board`);
            if (!boardEl) return;
            const board = Chessboard(`${uid}-board`, { position: startFen, pieceTheme: PIECE_THEME, draggable: false, showNotation: false });
            const state = { board, moves, startFen, currentIdx: -1, autoplayTimer: null, engineEnabled: false, analyzer: null, lastEngineFen: null };
            window._fragStates = window._fragStates || {};
            window._fragStates[uid] = state;
            document.querySelectorAll(`.frag-move[data-frag-uid="${uid}"]`).forEach(el => {
                el.addEventListener('click', () => goToMove(uid, parseInt(el.getAttribute('data-move-idx'))));
            });
            document.querySelectorAll(`.frag-var-move[data-frag-uid="${uid}"]`).forEach(el => {
                el.addEventListener('click', () => goToFen(uid, el.getAttribute('data-frag-fen'), el));
            });
            // Ensure board resizes properly + sjednoť výšku zápisu s výškou sloupce se šachovnicí
            // (widget pak končí hned pod ovládáním, žádné volné místo dole)
            setTimeout(() => {
                board.resize();
                const lp = document.getElementById(`${uid}-left-panel`);
                const mv = document.getElementById(`${uid}-moves`);
                if (lp && mv) {
                    mv.style.maxHeight = '0px';           // sbal zápis → změř přirozenou výšku sloupce se šachovnicí
                    const colH = lp.offsetHeight;
                    mv.style.maxHeight = colH + 'px';     // zápis = výška šachovnice+ovládání; delší partie scroll (žádné volno)
                }
            }, 120);
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

    // Skok šachovnice na pozici z podvarianty (mimo hlavní linii) — jen zobrazí, nemění currentIdx
    function goToFen(uid, fen, el) {
        const state = window._fragStates?.[uid];
        if (!state || !fen) return;
        state.board.position(fen, true);
        document.querySelectorAll(`.frag-move[data-frag-uid="${uid}"], .frag-var-move[data-frag-uid="${uid}"]`).forEach(e => {
            e.style.background = '';
            e.style.fontWeight = '';
            e.style.color = e.classList.contains('frag-var-move') ? '#94a3b8' : '#e0e0e0';
        });
        if (el) { el.style.background = 'rgba(125,211,252,0.25)'; el.style.fontWeight = '700'; el.style.color = '#7dd3fc'; }
    }

    function updatePositionDisplay(uid) {
        const state = window._fragStates?.[uid];
        if (!state) return;
        const posEl = document.getElementById(`${uid}-pos`);
        if (posEl) posEl.textContent = `${state.currentIdx + 1}/${state.moves.length}`;
        document.querySelectorAll(`.frag-move[data-frag-uid="${uid}"]`).forEach(el => {
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
        const leftPanel = document.getElementById(`${uid}-left-panel`);
        const rightPanel = document.getElementById(`${uid}-right-panel`);
        
        if (state.engineEnabled) {
            btn.style.color = '#4ade80';
            bar.classList.add('active');
            if (leftPanel) leftPanel.style.flex = '0 0 72%';
            if (rightPanel) rightPanel.style.flex = '1 1 28%';
            // Trigger resize to fix board dimensions now that bar showed up
            setTimeout(() => state.board.resize(), 50);
            runFragEngine(uid);
        } else {
            btn.style.color = '#ccc';
            bar.classList.remove('active');
            if (state.analyzer) state.analyzer.stopAnalysis();
            if (leftPanel) leftPanel.style.flex = '0 0 65%';
            if (rightPanel) rightPanel.style.flex = '1 1 35%';
            setTimeout(() => state.board.resize(), 50);
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
        if(!fillEl) return;
        
        textTop.textContent = '';
        textBot.textContent = '...';
        fillEl.classList.remove('mate');

        if (engineTimers[uid]) clearTimeout(engineTimers[uid]);
        engineTimers[uid] = setTimeout(async () => {
            try {
                if (typeof ChessAnalyzer !== 'undefined') {
                    if (!state.analyzer) {
                        state.analyzer = new ChessAnalyzer((data) => {
                            const currentState = window._fragStates?.[uid];
                            if (!currentState || !currentState.engineEnabled) return;
                            if (data.fen && normalizeFen(data.fen) !== normalizeFen(currentState.lastEngineFen)) return;

                            const currentFill = document.getElementById(`${uid}-eval-fill`);
                            const currentTop = document.getElementById(`${uid}-eval-text-top`);
                            const currentBot = document.getElementById(`${uid}-eval-text-bottom`);
                            if (!currentFill || !currentTop || !currentBot) return;

                            updateEngineUI(currentFill, currentTop, currentBot, data, 'analyzer');
                        });
                    }

                    state.lastEngineFen = normalizeFen(fen);
                    state.analyzer.analyze(fen);
                    return;
                }

                // 1. Try Lichess Cloud Eval
                const res = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.pvs && data.pvs[0]) {
                        updateEngineUI(fillEl, textTop, textBot, data.pvs[0], 'lichess');
                        return;
                    }
                }
                
                // 2. Fallback to chess-api.com
                const fRes = await fetch('https://chess-api.com/v1', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fen: fen, depth: 12 })
                });
                
                if (fRes.ok) {
                    const fData = await fRes.json();
                    if (!fData.error) {
                         updateEngineUI(fillEl, textTop, textBot, fData, 'chess-api');
                         return;
                    }
                }
                
                // fallback if both fail
                textBot.textContent = '—';
                fillEl.style.height = '50%';
            } catch(e) {
                textBot.textContent = 'Err';
                fillEl.style.height = '50%';
            }
        }, 400);
    }
    
    function updateEngineUI(fillEl, textTop, textBot, data, source) {
        let valStr = '';
        let percentage = 50;

        if (source === 'analyzer') {
            const val = parseNumber(data.eval);
            const mate = parseNumber(data.mate);
            if (data.type === 'info' || data.type === 'error' || (val === null && mate === null)) {
                textTop.textContent = '';
                textBot.textContent = data.text || '—';
                fillEl.style.height = '50%';
                fillEl.classList.remove('mate');
                return;
            }

            if (mate !== null) {
                valStr = `M${Math.abs(mate)}`;
                percentage = mate > 0 ? 100 : 0;
                fillEl.classList.add('mate');
            } else {
                valStr = (val > 0 ? '+' : '') + val.toFixed(1);
                percentage = parsePercent(data.winChance) ?? (50 + 50 * Math.tanh(val / 4));
                fillEl.classList.remove('mate');
            }
        } else if (source === 'lichess') {
            const cp = parseNumber(data.cp);
            const mate = parseNumber(data.mate);
            if (mate !== null) {
                valStr = `M${Math.abs(mate)}`;
                percentage = mate > 0 ? 100 : 0;
                fillEl.classList.add('mate');
            } else if (cp !== null) {
                const val = cp / 100;
                valStr = (val > 0 ? '+' : '') + val.toFixed(1);
                percentage = 50 + 50 * Math.tanh(val / 4);
                fillEl.classList.remove('mate');
            } else {
                valStr = '—';
            }
        } else if (source === 'chess-api') {
            const centipawns = parseNumber(data.centipawns);
            const val = centipawns !== null ? centipawns / 100 : parseNumber(data.eval);
            const mate = parseNumber(data.mate);
            if (mate !== null) {
                valStr = `M${Math.abs(mate)}`;
                percentage = mate > 0 ? 100 : 0;
                fillEl.classList.add('mate');
            } else if (val !== null) {
                valStr = (val > 0 ? '+' : '') + val.toFixed(1);
                percentage = parsePercent(data.winChance) ?? (50 + 50 * Math.tanh(val / 4));
                fillEl.classList.remove('mate');
            } else {
                valStr = '—';
            }
        }
        
        percentage = Math.max(0, Math.min(100, percentage));
        fillEl.style.height = `${percentage}%`;
        
        if (percentage > 50) {
            textTop.textContent = valStr;
            textBot.textContent = '';
        } else {
            textTop.textContent = '';
            textBot.textContent = valStr;
        }
    }

    function normalizeFen(fen) {
        if (!fen || typeof fen !== 'string') return '';
        const parts = fen.split(' ');
        if (parts.length >= 4 && parts[3] !== '-') parts[3] = '-';
        return parts.slice(0, 4).join(' ');
    }

    function parseNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    }

    function parsePercent(value) {
        const n = parseNumber(value);
        if (n === null) return null;
        return Math.max(0, Math.min(100, n));
    }

    function escapeHtml(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
})();
