/**
 * Inline Game Viewer
 * Renders single-game PGN blocks embedded directly inside article content.
 */
(function () {
    'use strict';

    const PIECE_THEME = '/img/chesspieces/wikipedia/{piece}.png';
    const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    let inlineViewerCounter = 0;

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function decodePgn(encoded) {
        if (!encoded) return '';
        try {
            const binary = atob(encoded);
            const escaped = Array.prototype.map.call(binary, char => {
                return '%' + char.charCodeAt(0).toString(16).padStart(2, '0');
            }).join('');
            return decodeURIComponent(escaped);
        } catch (e) {
            try {
                return atob(encoded);
            } catch (e2) {
                return '';
            }
        }
    }

    function parseHeaders(pgn) {
        const headers = {};
        const regex = /\[([A-Za-z0-9_]+)\s+"([^"]*)"\]/g;
        let match;
        while ((match = regex.exec(pgn)) !== null) {
            headers[match[1]] = match[2];
        }
        return headers;
    }

    function stripNestedVariations(text) {
        let result = '';
        let depth = 0;
        let inComment = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (char === '{') {
                if (depth === 0) result += char;
                inComment = true;
                continue;
            }

            if (char === '}') {
                if (depth === 0) result += char;
                inComment = false;
                continue;
            }

            if (!inComment && char === '(') {
                depth++;
                continue;
            }

            if (!inComment && char === ')') {
                depth = Math.max(0, depth - 1);
                continue;
            }

            if (depth === 0) result += char;
        }

        return result;
    }

    function parsePgn(pgn) {
        const headers = parseHeaders(pgn);
        const body = stripNestedVariations(pgn.replace(/\[[^\]]+\]\s*/g, ' '));
        const startFen = headers.SetUp === '1' && headers.FEN ? headers.FEN : START_FEN;
        const game = new Chess(startFen);
        const moves = [];
        const tokenRegex = /\{[^}]*\}|\$\d+|\d+\.(?:\.\.)?|1-0|0-1|1\/2-1\/2|\*|[^\s{}()]+/g;
        const tokens = body.match(tokenRegex) || [];
        const nagMap = { '$1': '!', '$2': '?', '$3': '!!', '$4': '??', '$5': '!?', '$6': '?!' };
        let currentMove = null;

        for (const rawToken of tokens) {
            const token = rawToken.trim();
            if (!token || /^\d+\.(?:\.\.)?$/.test(token) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) continue;

            if (token.startsWith('{')) {
                if (currentMove) currentMove.comment = token.slice(1, -1).trim();
                continue;
            }

            if (token.startsWith('$')) {
                if (currentMove && nagMap[token]) currentMove.nag = nagMap[token];
                continue;
            }

            let sanToken = token;
            let suffixNag = '';
            const nagMatch = sanToken.match(/(!!|\?\?|!\?|\?!|!|\?)$/);
            if (nagMatch) {
                suffixNag = nagMatch[1];
                sanToken = sanToken.slice(0, -suffixNag.length);
            }

            const beforeFen = game.fen();
            const beforeParts = beforeFen.split(' ');
            const color = beforeParts[1] || 'w';
            const moveNumber = parseInt(beforeParts[5], 10) || Math.floor(moves.length / 2) + 1;
            const move = game.move(sanToken, { sloppy: true });
            if (!move) continue;

            currentMove = {
                ply: moves.length,
                moveNumber,
                color,
                san: move.san,
                nag: suffixNag,
                comment: '',
                fen: game.fen()
            };
            moves.push(currentMove);
        }

        return { headers, startFen, moves };
    }

    function formatTitle(container, headers) {
        const explicitTitle = container.dataset.title || '';
        if (explicitTitle.trim()) return explicitTitle.trim();

        const white = headers.White || 'Bílý';
        const black = headers.Black || 'Černý';
        return `${white} - ${black}`;
    }

    function buildMoveRows(moves, uid) {
        const rows = [];

        for (const move of moves) {
            let row = rows[rows.length - 1];
            if (!row || row.moveNumber !== move.moveNumber || (move.color === 'w' && row.white)) {
                row = { moveNumber: move.moveNumber, white: null, black: null };
                rows.push(row);
            }
            if (move.color === 'w') row.white = move;
            else row.black = move;
        }

        return rows.map(row => `
            <div class="igv-row">
                <div class="igv-num">${row.moveNumber}.</div>
                ${renderMoveButton(row.white, uid)}
                ${renderMoveButton(row.black, uid)}
            </div>
        `).join('');
    }

    function renderMoveButton(move, uid) {
        if (!move) return '<span></span>';
        const nag = move.nag ? `<span class="igv-nag">${escapeHtml(move.nag)}</span>` : '';
        return `<button type="button" class="igv-move" data-igv="${uid}" data-ply="${move.ply}">${escapeHtml(move.san)}${nag}</button>`;
    }

    function renderInlineViewer(container) {
        if (container.dataset.inlineInitialized === 'true') return;
        container.dataset.inlineInitialized = 'true';

        const pgn = decodePgn(container.dataset.pgnB64);
        if (!pgn.trim()) {
            container.innerHTML = '<div class="igv-error">Inline partie nemá uložené PGN.</div>';
            return;
        }

        let parsed;
        try {
            parsed = parsePgn(pgn);
        } catch (e) {
            container.innerHTML = '<div class="igv-error">PGN partie se nepodařilo načíst.</div>';
            return;
        }

        const uid = `igv-${++inlineViewerCounter}`;
        const title = formatTitle(container, parsed.headers);
        const result = parsed.headers.Result || '';
        const event = parsed.headers.Event || '';
        const orientation = container.dataset.orientation === 'black' ? 'black' : 'white';
        const hasComments = parsed.moves.some(move => move.comment);

        container.innerHTML = `
            <div class="igv-shell">
                <div class="igv-head">
                    <div class="igv-title">${escapeHtml(title)}</div>
                    <div class="igv-meta">
                        ${event ? `<span>${escapeHtml(event)}</span>` : ''}
                        ${result ? `<strong>${escapeHtml(result)}</strong>` : ''}
                    </div>
                </div>
                <div class="igv-layout">
                    <div class="igv-board-pane">
                        <div class="igv-board-wrap">
                            <div id="${uid}-board" class="igv-board"></div>
                        </div>
                        <div class="igv-controls" aria-label="Ovládání partie">
                            <button type="button" class="igv-btn" data-action="start" title="Na začátek"><i class="fa-solid fa-backward-fast"></i></button>
                            <button type="button" class="igv-btn" data-action="prev" title="Zpět"><i class="fa-solid fa-backward-step"></i></button>
                            <button type="button" class="igv-btn igv-btn-play" data-action="play" title="Přehrát"><i class="fa-solid fa-play"></i></button>
                            <button type="button" class="igv-btn" data-action="next" title="Vpřed"><i class="fa-solid fa-forward-step"></i></button>
                            <button type="button" class="igv-btn" data-action="end" title="Na konec"><i class="fa-solid fa-forward-fast"></i></button>
                            <button type="button" class="igv-btn" data-action="flip" title="Otočit šachovnici"><i class="fa-solid fa-retweet"></i></button>
                        </div>
                    </div>
                    <div class="igv-side">
                        <div class="igv-status">
                            <div class="igv-current" id="${uid}-current">Výchozí pozice</div>
                            <div class="igv-count"><span id="${uid}-count">0</span>/${parsed.moves.length}</div>
                            <input type="range" class="igv-scrub" id="${uid}-scrub" min="0" max="${parsed.moves.length}" value="0" step="1" aria-label="Přejít na tah">
                        </div>
                        <div class="igv-comment" id="${uid}-comment" ${hasComments ? '' : 'hidden'}></div>
                        <button type="button" class="igv-moves-toggle" id="${uid}-moves-toggle" aria-expanded="false" aria-controls="${uid}-moves">
                            <span class="igv-moves-toggle-label"><i class="fa-solid fa-list-ol"></i><span>Zápis partie</span></span>
                            <i class="fa-solid fa-chevron-down igv-moves-toggle-icon"></i>
                        </button>
                        <div class="igv-moves" id="${uid}-moves">${buildMoveRows(parsed.moves, uid)}</div>
                    </div>
                </div>
            </div>
        `;

        requestAnimationFrame(() => {
            const board = Chessboard(`${uid}-board`, {
                position: parsed.startFen,
                orientation,
                draggable: false,
                pieceTheme: PIECE_THEME
            });

            const state = {
                uid,
                board,
                startFen: parsed.startFen,
                moves: parsed.moves,
                currentPly: -1,
                timer: null
            };

            container._inlineGameState = state;
            window.inlineGameViewers = window.inlineGameViewers || {};
            window.inlineGameViewers[uid] = state;

            container.querySelectorAll('.igv-move').forEach(button => {
                button.addEventListener('click', () => goTo(state, parseInt(button.dataset.ply, 10)));
            });

            container.querySelector(`#${uid}-scrub`)?.addEventListener('input', event => {
                goTo(state, parseInt(event.target.value, 10) - 1);
            });

            container.querySelectorAll('.igv-btn').forEach(button => {
                button.addEventListener('click', () => handleAction(state, button.dataset.action, button));
            });

            container.querySelector(`#${uid}-moves-toggle`)?.addEventListener('click', event => {
                toggleNotation(container, event.currentTarget);
            });

            setupSwipeNavigation(container.querySelector('.igv-board-pane'), () => {
                goTo(state, state.currentPly - 1);
            }, () => {
                goTo(state, state.currentPly + 1);
            });

            if ('ResizeObserver' in window) {
                const observer = new ResizeObserver(() => board.resize());
                observer.observe(container.querySelector('.igv-board-wrap'));
            }

            setTimeout(() => board.resize(), 80);
            updateUi(state);
        });
    }

    function handleAction(state, action, button) {
        if (action === 'start') goTo(state, -1);
        if (action === 'prev') goTo(state, state.currentPly - 1);
        if (action === 'next') goTo(state, state.currentPly + 1);
        if (action === 'end') goTo(state, state.moves.length - 1);
        if (action === 'flip') state.board.flip();
        if (action === 'play') togglePlay(state, button);
    }

    function toggleNotation(container, button) {
        const isOpen = container.classList.toggle('igv-notation-open');
        button.setAttribute('aria-expanded', String(isOpen));
        const labelText = button.querySelector('.igv-moves-toggle-label span');
        if (labelText) labelText.textContent = isOpen ? 'Skrýt zápis' : 'Zápis partie';
    }

    function setupSwipeNavigation(target, onPrevious, onNext) {
        if (!target || target.dataset.swipeReady === 'true') return;
        target.dataset.swipeReady = 'true';
        target.classList.add('igv-swipe-zone');

        let startX = 0;
        let startY = 0;
        let activePointerId = null;

        const isInteractive = (el) => el.closest('button, a, input, textarea, select, .igv-scrub, .igv-move');

        target.addEventListener('pointerdown', event => {
            if (event.pointerType === 'mouse' || isInteractive(event.target)) return;
            activePointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
        });

        const finishSwipe = event => {
            if (activePointerId !== event.pointerId) return;
            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            activePointerId = null;

            if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
            if (deltaX < 0) onNext();
            else onPrevious();
        };

        target.addEventListener('pointerup', finishSwipe);
        target.addEventListener('pointercancel', () => { activePointerId = null; });
    }

    function togglePlay(state, button) {
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
            button.querySelector('i')?.classList.replace('fa-pause', 'fa-play');
            return;
        }

        button.querySelector('i')?.classList.replace('fa-play', 'fa-pause');
        state.timer = setInterval(() => {
            if (state.currentPly >= state.moves.length - 1) {
                clearInterval(state.timer);
                state.timer = null;
                button.querySelector('i')?.classList.replace('fa-pause', 'fa-play');
                return;
            }
            goTo(state, state.currentPly + 1);
        }, 900);
    }

    function goTo(state, ply) {
        const maxPly = state.moves.length - 1;
        state.currentPly = Math.max(-1, Math.min(ply, maxPly));
        const fen = state.currentPly === -1 ? state.startFen : state.moves[state.currentPly].fen;
        state.board.position(fen, true);
        updateUi(state);
    }

    function updateUi(state) {
        const container = document.querySelector(`#${state.uid}-board`)?.closest('.inline-game-viewer');
        if (!container) return;

        const currentMove = state.currentPly === -1 ? null : state.moves[state.currentPly];
        const currentEl = container.querySelector(`#${state.uid}-current`);
        const countEl = container.querySelector(`#${state.uid}-count`);
        const scrubEl = container.querySelector(`#${state.uid}-scrub`);
        const commentEl = container.querySelector(`#${state.uid}-comment`);
        const currentIndex = state.currentPly + 1;

        if (currentEl) {
            currentEl.textContent = currentMove
                ? `${currentMove.moveNumber}${currentMove.color === 'b' ? '...' : '.'} ${currentMove.san}`
                : 'Výchozí pozice';
        }
        if (countEl) countEl.textContent = String(currentIndex);
        if (scrubEl) {
            scrubEl.value = String(currentIndex);
            const pct = state.moves.length ? (currentIndex / state.moves.length) * 100 : 0;
            scrubEl.style.setProperty('--igv-scrub-progress', `${Math.max(0, pct)}%`);
        }
        if (commentEl) {
            const comment = currentMove?.comment || '';
            commentEl.hidden = !comment;
            commentEl.innerHTML = comment ? escapeHtml(comment) : '';
        }

        container.querySelectorAll('.igv-move').forEach(button => {
            const isActive = parseInt(button.dataset.ply, 10) === state.currentPly;
            button.classList.toggle('is-active', isActive);
            if (isActive) button.setAttribute('aria-current', 'step');
            else button.removeAttribute('aria-current');
            if (isActive) button.scrollIntoView({ block: 'nearest' });
        });

        container.querySelectorAll('.igv-btn').forEach(button => {
            const action = button.dataset.action;
            button.disabled =
                (action === 'play' && state.moves.length === 0) ||
                (['start', 'prev'].includes(action) && state.currentPly <= -1) ||
                (['next', 'end'].includes(action) && state.currentPly >= state.moves.length - 1);
        });
    }

    window.initInlineGameViewers = function () {
        document.querySelectorAll('.inline-game-viewer[data-pgn-b64]').forEach(renderInlineViewer);
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.initInlineGameViewers();
    });
})();
