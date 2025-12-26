/**
 * Game Viewer 2.0 - Refactored
 * Features: Native PGN, Variations (Text), Comments, Grid Layout
 */

/* Club Members for Avatar Matching */
const CLUB_MEMBERS = [
    { id: 'antonit', keywords: ['antonin', 'duda'], img: 'images/management_antonin.png' },
    { id: 'filip', keywords: ['filip', 'zadrazil'], img: 'images/management_filip.jpg' },
    { id: 'lukas', keywords: ['lukas', 'sivak'], img: 'images/management_lukas.png' },
    { id: 'radim', keywords: ['radim', 'podrazky'], img: 'images/management_radim.png' }
];

class GameViewer2 {
    constructor() {
        this.gamesData = [];
        this.currentIndex = -1;
        this.game = new Chess();
        this.board = null;
        this.currentPly = 0; // 0 = start
        this.mainLinePlies = []; // Array of FENs or Move Objects for main line
        this.parsedMoves = []; // Structure for rendering
        this.autoplayInterval = null;

        // Variation support
        this.allVariations = {}; // Map of varId -> { parentPly, moves: [{fen, move, comment, nag, variations}] }
        this.variationPath = []; // Current path: [{type: 'main'|'var', varId?, ply}]
        this.inVariation = false;
        this.currentVariation = null;
        this.variationPly = 0;

        this.bindEvents();
    }

    bindEvents() {
        this.handleKeydown = this.handleKeydown.bind(this);
        window.addEventListener('resize', () => {
            if (this.board) this.board.resize();
        });
        document.addEventListener('keydown', this.handleKeydown);

        // Event delegation for move clicks (Safari fix)
        document.addEventListener('click', (e) => {
            // Main line move click
            const moveEl = e.target.closest('.gv2-move');
            if (moveEl && moveEl.dataset.ply) {
                e.preventDefault();
                this.jumpTo(parseInt(moveEl.dataset.ply, 10));
                return;
            }

            // Variation move click
            const varMoveEl = e.target.closest('.gv2-var-move');
            if (varMoveEl && varMoveEl.dataset.var && varMoveEl.dataset.fen) {
                e.preventDefault();
                this.jumpToVariation(varMoveEl.dataset.var, varMoveEl.dataset.fen);
                return;
            }
        });
    }

    getMemberAvatar(name) {
        if (!name) return null;
        const normalize = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const nName = normalize(name);

        for (const m of CLUB_MEMBERS) {
            const lastName = m.keywords[1];
            if (nName.includes(lastName)) return m.img;
        }
        return null;
    }

    // ... (rest of methods)

    handleKeydown(e) {
        // Prevent default scrolling for game controls
        if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
            // Check if focus is NOT in an input (though likely none here)
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
            }
        }

        if (e.key === 'ArrowRight') this.stepForward();
        if (e.key === 'ArrowLeft') this.stepBack();
        if (e.key === 'ArrowUp') this.prevGame();
        if (e.key === 'ArrowDown') this.nextGame();
        if (e.key === ' ') this.toggleAutoplay();
    }

    init(games) {
        this.gamesData = games || [];
        this.setupCombinedDOM();
        this.renderList();

        // Auto-load first PGN game or first game
        const firstPlayable = this.gamesData.findIndex(g => g.type !== 'header');
        if (firstPlayable !== -1) {
            this.loadGame(firstPlayable);
        }
    }

    // --- DOM Setup ---
    setupCombinedDOM() {
        // Look for the new wrapper ID or legacy class
        const viewerSection = document.getElementById('game-viewer-wrapper') || document.querySelector('.game-viewer');
        if (!viewerSection) {
            console.warn('[GV2] No viewer wrapper found, aborting DOM setup.');
            return;
        }

        // Container that holds both IFRAME (legacy) and NATIVE (new)
        // We replace existing structure or append to it.
        // Let's look for .iframe-container and inject our new container next to it
        // Or wrap everything.

        let container = document.getElementById('gv2-main-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'gv2-main-container';
            container.className = 'game-viewer-2-container hidden';
            container.tabIndex = -1; // Make focusable for keyboard events

            // New Layout Structure
            container.innerHTML = `
                <!-- Comment Bubble - Overlays entire container (header + board) -->
                <div class="gv2-board-overlay" id="gv2-board-overlay">
                    <div class="gv2-avatar"><i class="fa-solid fa-user-tie"></i></div>
                    <div class="gv2-bubble-content" id="gv2-bubble-content"></div>
                    <button class="gv2-bubble-close" onclick="gameViewer2.hideBubble()" title="Schovat komentář"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="gv2-header">
                    <button class="gv2-bubble-show" id="gv2-bubble-show" onclick="gameViewer2.showBubble()" title="Zobrazit komentář">
                        <i class="fa-solid fa-comment"></i> Komentář
                    </button>
                    <div id="gv2-title" class="gv2-title">Game Title</div>
                    <div class="gv2-global-controls">
                        <button class="gv2-nav-btn" onclick="gameViewer2.prevGame()" title="Předchozí partie"><i class="fa-solid fa-chevron-left"></i></button>
                        <button class="gv2-nav-btn" onclick="gameViewer2.nextGame()" title="Další partie"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                </div>
                <div class="gv2-content">
                    <div class="gv2-board-section">
                        <div class="gv2-board-wrapper">
                            <div id="gv2-board"></div>
                        </div>
                        <div class="gv2-controls">
                            <button class="gv2-btn" onclick="gameViewer2.goToStart()" title="Start"><i class="fa-solid fa-backward-fast"></i></button>
                            <button class="gv2-btn" onclick="gameViewer2.stepBack()" title="Zpět"><i class="fa-solid fa-backward-step"></i></button>
                            <button class="gv2-btn" onclick="gameViewer2.toggleAutoplay()" title="Přehrát"><i class="fa-solid fa-play" id="gv2-play-icon"></i></button>
                            <button class="gv2-btn" onclick="gameViewer2.stepForward()" title="Vpřed"><i class="fa-solid fa-forward-step"></i></button>
                            <button class="gv2-btn" onclick="gameViewer2.goToEnd()" title="Konec"><i class="fa-solid fa-forward-fast"></i></button>
                            <button class="gv2-btn" onclick="gameViewer2.flipBoard()" title="Otočit"><i class="fa-solid fa-retweet"></i></button>
                        </div>
                    </div>
                    <div class="gv2-info-panel">
                        <div id="gv2-metadata" class="gv2-metadata"></div>
                        <div id="gv2-moves" class="gv2-moves"></div>
                    </div>
                </div>
            `;

            // Insert into DOM - prefer .iframe-container (legacy), fallback to viewerSection
            const iframeContainer = document.querySelector('.iframe-container');
            if (iframeContainer) {
                iframeContainer.parentNode.insertBefore(container, iframeContainer.nextSibling);
            } else {
                // No iframe-container - append directly to the viewer section
                viewerSection.appendChild(container);
            }
        }

        // Initialize Chessboard
        if (!this.board) {
            const boardEl = document.getElementById('gv2-board');
            console.log('[GV2 Init] Initializing board. Element found:', boardEl);

            if (typeof Chessboard === 'function') {
                try {
                    this.board = Chessboard('gv2-board', {
                        position: 'start',
                        draggable: false,
                        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
                        moveSpeed: 500,
                        appearSpeed: 300,
                        snapSpeed: 100
                    });
                    console.log('[GV2 Init] Chessboard instance created:', this.board);
                } catch (e) {
                    console.error('[GV2 Init] Chessboard constructor threw error:', e);
                }
            } else {
                console.error('[GV2 Init] Chessboard library is not a function:', typeof Chessboard);
            }
        }
    }

    // --- Loading Games ---
    loadGame(index) {
        if (index < 0 || index >= this.gamesData.length) return;
        this.currentIndex = index;
        const gameData = this.gamesData[index];

        // Avatar Logic
        let whiteMember = null;
        let blackMember = null;
        let randomCoach = null;

        const manualAvatar = gameData.commentAvatar; // 'antonin', 'filip', 'random', or '' (auto)

        if (manualAvatar && manualAvatar !== 'random' && manualAvatar !== 'auto') {
            // Specific member forced
            const member = CLUB_MEMBERS.find(m => m.id === manualAvatar);
            if (member) randomCoach = member.img; // Use as "randomCoach" (which is the fallback/main avatar)
        } else if (manualAvatar === 'random') {
            // Force random
            const randIndex = Math.floor(Math.random() * CLUB_MEMBERS.length);
            randomCoach = CLUB_MEMBERS[randIndex].img;
        } else {
            // Auto detection (default)
            whiteMember = this.getMemberAvatar(gameData.white);
            blackMember = this.getMemberAvatar(gameData.black);

            if (!whiteMember && !blackMember) {
                // If no detection, fallback to random
                const randIndex = Math.floor(Math.random() * CLUB_MEMBERS.length);
                randomCoach = CLUB_MEMBERS[randIndex].img;
            }
        }

        this.whiteAvatar = whiteMember;
        this.blackAvatar = blackMember;
        this.randomCoach = randomCoach;

        // Highlight active sidebar item
        document.querySelectorAll('.game-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.index) === index);
        });

        const iframeContainer = document.querySelector('.iframe-container');
        const legacyControls = document.querySelector('.game-viewer .controls');
        const gv2Container = document.getElementById('gv2-main-container');

        if (gameData.pgn) {
            // SHOW NATIVE VIEWER
            if (iframeContainer) iframeContainer.style.display = 'none';
            // if (legacyControls) legacyControls.style.display = 'none'; // Keep controls visible for navigation between games
            if (legacyControls) legacyControls.style.display = 'flex';
            if (gv2Container) {
                gv2Container.classList.remove('hidden');
                gv2Container.style.display = 'flex'; // Force flex
            }

            // Set Title & Metadata
            document.getElementById('gv2-title').textContent = gameData.title;
            this.renderMetadata(gameData);

            // Parse PGN
            this.parseAndLoadPGN(gameData.pgn);

            // Resize board (important because container was likely hidden)
            // Use multiple triggers to ensure layout is recalculated
            const triggerResize = () => {
                if (this.board && typeof this.board.resize === 'function') {
                    this.board.resize();
                }
            };

            requestAnimationFrame(() => {
                triggerResize();
                // Double check after a small delay for DOM reflows
                setTimeout(triggerResize, 50);
                setTimeout(() => {
                    triggerResize();
                    // Focus container for immediate keyboard control
                    if (gv2Container) gv2Container.focus();
                }, 200);
            });

        } else {
            // FALLBACK TO IFRAME
            if (gv2Container) gv2Container.style.display = 'none';
            if (iframeContainer) iframeContainer.style.display = 'block';
            if (legacyControls) legacyControls.style.display = 'flex'; // Restore flex for controls

            let src = gameData.gameId || gameData.chessComId;
            if (src && !src.startsWith('http')) {
                src = `https://www.chess.com/emboard?id=${src}`;
            }
            const iframe = document.getElementById('chess-frame');
            if (iframe) iframe.src = src || '';
        }
    }

    renderMetadata(gameData) {
        const metaEl = document.getElementById('gv2-metadata');
        if (!metaEl) return;

        // Format date to simple Czech format
        let dateStr = '';
        if (gameData.date) {
            try {
                const d = new Date(gameData.date);
                if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
                } else {
                    dateStr = gameData.date;
                }
            } catch (e) {
                dateStr = gameData.date;
            }
        }

        metaEl.innerHTML = `
            <div class="gv2-metadata-row">
                <span><strong>White:</strong> ${gameData.white || '?'}</span>
                <span>${dateStr}</span>
            </div>
            <div class="gv2-metadata-row">
                <span><strong>Black:</strong> ${gameData.black || '?'}</span>
                <span>${gameData.result || ''}</span>
            </div>
        `;
    }

    // --- PGN Parsing & Logic ---

    parseAndLoadPGN(pgnText) {
        this.game.reset();
        this.currentPly = 0;
        this.mainLinePlies = [];
        this.lastMatchedPly = 0; // Track for annotations

        // 1. Parse tokens for Rendering
        // We use a regex to identify tokens: Moves, Comments {}, Variations (), NAGs $
        // Warning: This is a simple tokenizer, might fail on complex nested var/comments

        // Prepare chess.js for State validation (strip non-mainline to be safe?)
        // Actually, let's process token by token.

        // Clean PGN for chess.js to get the Main Line valid moves
        // We remove {} comments, () variations, $ NAGs
        const cleanPgn = pgnText
            .replace(/\{[^}]*\}/g, '') // remove comments
            .replace(/\([^)]*\)/g, '') // remove variations (Note: non-recursive)
            // Recursive removal of parens needed if nested. 
            // Simple loop to remove all (...) 
            .replace(/\$[0-9]+/g, '');

        // Better cleaner:
        let clean = this.stripVariations(pgnText);

        // Load Clean State to get history
        this.game.load_pgn(clean);
        const history = this.game.history({ verbose: true });

        // Store FENs for main line
        let tempGame = new Chess();
        this.mainLinePlies.push({ fen: tempGame.fen() }); // Start pos
        history.forEach(move => {
            tempGame.move(move);
            this.mainLinePlies.push({ fen: tempGame.fen(), move: move });
        });

        // 2. Render Full Text (with comments)
        // We need to parse valid PGN tokens and try to match them to our main line history
        this.renderMoveText(pgnText, history);

        // Update Board to Start
        if (this.board) {
            this.board.position('start');
        } else {
            console.error('[GV2 Runtime] Board not initialized in parseAndLoadPGN! Attempting to recover...');
            this.setupCombinedDOM(); // Try to init again?
            if (this.board) {
                this.board.position('start');
            }
        }

        // Trigger generic update to ensure UI is in sync
        this.updateActiveMove();
    }

    stripVariations(pgn) {
        let res = "";
        let depth = 0;
        let inComment = false;

        for (let i = 0; i < pgn.length; i++) {
            const char = pgn[i];

            if (inComment) {
                if (char === '}') {
                    inComment = false;
                }
                continue; // Skip all chars in comment including closing brace
            }

            if (char === '{') {
                inComment = true;
                continue; // Skip opening brace
            }

            // Not in comment
            if (char === '(') {
                depth++;
                continue; // Skip opening paren
            }

            if (char === ')') {
                depth--;
                continue; // Skip closing paren
            }

            if (depth === 0) {
                res += char;
            }
        }
        return res;
    }

    renderMoveText(pgn, mainLineHistory) {
        const movesEl = document.getElementById('gv2-moves');
        movesEl.innerHTML = '';

        let pgnBody = pgn.replace(/\[.*?\]/g, '').trim();

        // Reset variation tracking
        this.allVariations = {};
        this.variationCounter = 0;
        this.inVariation = false;
        this.currentVariation = null;
        this.variationPly = 0;

        // Reset matchers
        this.nextMainLinePlyToMatch = 0;
        this.lastMatchedPly = 0;

        // Parse and render with variation support
        const html = this.parseAndRenderPgn(pgnBody, mainLineHistory, null, 0);

        movesEl.innerHTML = html;
        this.nextMainLinePlyToMatch = 0;
    }

    // Recursive parser that handles variations
    parseAndRenderPgn(pgnBody, history, parentVarId, startPly) {
        let buffer = '';
        let commentBuffer = '';
        let state = 'text'; // text, comment, variation
        let varDepth = 0;
        let varContent = '';
        let html = '';
        let i = 0;

        while (i < pgnBody.length) {
            const char = pgnBody[i];

            if (state === 'text') {
                if (char === '{') {
                    html += this.processBuffer(buffer, history, parentVarId);
                    buffer = '';
                    state = 'comment';
                    commentBuffer = '';
                    html += '<span class="gv2-comment">';
                } else if (char === '(') {
                    html += this.processBuffer(buffer, history, parentVarId);
                    buffer = '';
                    state = 'variation';
                    varDepth = 1;
                    varContent = '';
                } else {
                    buffer += char;
                }
            } else if (state === 'comment') {
                if (char === '}') {
                    html += this.escapeHtml(commentBuffer) + '</span>';

                    // Store comment in data model
                    if (this.lastMatchedPly >= 0 && this.mainLinePlies[this.lastMatchedPly]) {
                        const existing = this.mainLinePlies[this.lastMatchedPly].comment || '';
                        this.mainLinePlies[this.lastMatchedPly].comment = existing ? existing + ' ' + commentBuffer.trim() : commentBuffer.trim();
                    }

                    state = 'text';
                } else {
                    commentBuffer += char;
                }
            } else if (state === 'variation') {
                if (char === '(') {
                    varDepth++;
                    varContent += char;
                } else if (char === ')') {
                    varDepth--;
                    if (varDepth === 0) {
                        // Process complete variation
                        html += this.renderVariation(varContent, history);
                        state = 'text';
                    } else {
                        varContent += char;
                    }
                } else {
                    varContent += char;
                }
            }
            i++;
        }
        html += this.processBuffer(buffer, history, parentVarId);
        return html;
    }

    // Render a variation block
    renderVariation(varContent, mainHistory) {
        const varId = 'var_' + (this.variationCounter++);
        const parentPly = this.lastMatchedPly;

        // Get the FEN from the position BEFORE the last main line move (where variation starts)
        const startFen = parentPly > 0 ? this.mainLinePlies[parentPly - 1].fen : 'start';

        // Parse variation moves using a temp chess instance
        const varMoves = this.parseVariationMoves(varContent, startFen);

        // Store variation data
        this.allVariations[varId] = {
            parentPly: parentPly,
            startFen: startFen,
            moves: varMoves,
            content: varContent
        };

        // Render variation HTML with clickable moves
        let html = '<span class="gv2-variation">(';

        // Process variation content to make moves clickable
        html += this.renderVariationMoves(varContent, varId, startFen);

        html += ')</span>';
        return html;
    }

    // Parse variation moves to extract FENs
    parseVariationMoves(varContent, startFen) {
        const moves = [];
        const tempGame = new Chess(startFen === 'start' ? undefined : startFen);

        // Simple tokenizer to extract moves from variation
        const tokens = varContent.split(/\s+/).filter(t => t.trim());

        for (const token of tokens) {
            // Skip move numbers, NAGs, and comments
            if (token.match(/^[0-9]+\.+$/) || token.match(/^\$[0-9]+$/) || token.startsWith('{')) {
                continue;
            }
            // Skip nested variations (handled recursively)
            if (token.includes('(') || token.includes(')')) {
                continue;
            }

            // Try to make the move
            try {
                const move = tempGame.move(token, { sloppy: true });
                if (move) {
                    moves.push({
                        san: move.san,
                        fen: tempGame.fen(),
                        move: move
                    });
                }
            } catch (e) {
                // Invalid move, skip
            }
        }

        return moves;
    }

    // Render variation content with clickable moves
    renderVariationMoves(varContent, varId, startFen) {
        let html = '';
        let buffer = '';
        let inComment = false;
        let inNestedVar = 0;
        let varMoveIdx = 0;

        const tempGame = new Chess(startFen === 'start' ? undefined : startFen);

        for (let i = 0; i < varContent.length; i++) {
            const char = varContent[i];

            if (inComment) {
                if (char === '}') {
                    html += buffer + '</span>';
                    buffer = '';
                    inComment = false;
                } else {
                    buffer += char;
                }
                continue;
            }

            if (char === '{') {
                html += this.flushVariationBuffer(buffer, varId, tempGame);
                buffer = '';
                html += '<span class="gv2-comment">';
                inComment = true;
                continue;
            }

            if (char === '(') {
                html += this.flushVariationBuffer(buffer, varId, tempGame);
                buffer = '';
                // Collect nested variation
                inNestedVar = 1;
                let nestedContent = '';
                i++;
                while (i < varContent.length) {
                    const nc = varContent[i];
                    if (nc === '(') inNestedVar++;
                    if (nc === ')') {
                        inNestedVar--;
                        if (inNestedVar === 0) break;
                    }
                    nestedContent += nc;
                    i++;
                }
                // Render nested variation recursively
                html += this.renderVariation(nestedContent, []);
                continue;
            }

            buffer += char;
        }

        html += this.flushVariationBuffer(buffer, varId, tempGame);
        return html;
    }

    // Process buffer for variation moves
    flushVariationBuffer(buffer, varId, tempGame) {
        if (!buffer.trim()) return buffer;

        const parts = buffer.split(/(\s+|[0-9]+\.+)/).filter(x => x);
        let html = '';

        for (const part of parts) {
            const clean = part.trim();

            // Move number
            if (clean.match(/^[0-9]+\.+$/)) {
                html += `<span class="gv2-move-num">${part}</span>`;
                continue;
            }

            // NAG
            if (clean.match(/^\$[0-9]+$/)) {
                const map = { '$1': '!', '$2': '?', '$3': '!!', '$4': '??', '$5': '!?', '$6': '?!' };
                const colorMap = { '$1': '#4ade80', '$2': '#ef4444', '$3': '#22c55e', '$4': '#dc2626', '$5': '#60a5fa', '$6': '#fbbf24' };
                const symbol = map[part] || part;
                const color = colorMap[part] || '#17a2b8';
                html += `<span class="gv2-nag" style="color: ${color}">${symbol}</span>`;
                continue;
            }

            // Try as move
            if (clean && !clean.match(/^\s+$/) && clean.length > 1) {
                try {
                    const move = tempGame.move(clean, { sloppy: true });
                    if (move) {
                        const fen = tempGame.fen();
                        const moveIdx = this.allVariations[varId]?.moves?.findIndex(m => m.san === move.san && m.fen === fen) ?? -1;
                        html += `<span class="gv2-var-move" data-var="${varId}" data-fen="${fen}">${move.san}</span>`;
                        continue;
                    }
                } catch (e) {
                    // Not a valid move
                }
            }

            html += part;
        }

        return html;
    }

    // Jump to a position in a variation
    jumpToVariation(varId, fen) {
        if (!this.allVariations[varId]) return;

        this.inVariation = true;
        this.currentVariation = varId;
        this.board.position(fen, true); // true = animate
        this.game.load(fen); // Sync internal game state for stepForward/stepBack

        // Update UI to show we're in a variation
        this.updateVariationIndicator(varId);
        this.updateActiveVariationMove(varId, fen);
    }

    // Exit variation and return to main line
    exitVariation() {
        if (!this.inVariation) return;

        const varData = this.allVariations[this.currentVariation];
        if (varData) {
            // Return to the parent ply
            this.jumpTo(varData.parentPly);
        }

        this.inVariation = false;
        this.currentVariation = null;
        this.updateVariationIndicator(null);
    }

    // Update UI indicator for current variation
    updateVariationIndicator(varId) {
        // Add/remove class from moves container
        const movesEl = document.getElementById('gv2-moves');
        if (varId) {
            movesEl.classList.add('in-variation');
            // Highlight variation spans
            document.querySelectorAll('.gv2-variation').forEach(el => el.classList.remove('active'));
            // Find and highlight the active variation
            const activeVarMoves = document.querySelectorAll(`[data-var="${varId}"]`);
            if (activeVarMoves.length > 0) {
                activeVarMoves[0].closest('.gv2-variation')?.classList.add('active');
            }
        } else {
            movesEl.classList.remove('in-variation');
            document.querySelectorAll('.gv2-variation').forEach(el => el.classList.remove('active'));
        }
    }

    // Update active move highlighting in variation
    updateActiveVariationMove(varId, fen) {
        // Remove all active states
        document.querySelectorAll('.gv2-var-move.active').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.gv2-move.active').forEach(el => el.classList.remove('active'));

        // Find and highlight the current move using data-fen attribute
        const varMoves = document.querySelectorAll(`[data-var="${varId}"]`);
        varMoves.forEach(el => {
            if (el.dataset.fen === fen) {
                el.classList.add('active');
            }
        });

        // Update comment bubble for this position
        this.updateCommentBubble();
    }

    processBuffer(text, history, parentVarId = null) {
        if (!text.trim()) return text;

        const parts = text.split(/(\s+|\.|[0-9]+\.+)/).filter(x => x);
        let html = '';

        if (typeof this.nextMainLinePlyToMatch === 'undefined') this.nextMainLinePlyToMatch = 0;

        parts.forEach(part => {
            const cleanPart = part.trim();
            const nextMove = history[this.nextMainLinePlyToMatch];

            if (nextMove && (cleanPart === nextMove.san || cleanPart === nextMove.lan)) {
                const ply = this.nextMainLinePlyToMatch + 1;
                html += `<span class="gv2-move" data-ply="${ply}" onclick="gameViewer2.jumpTo(${ply})">${part}</span>`;

                this.lastMatchedPly = ply; // Track this ply for subsequent annotations
                this.nextMainLinePlyToMatch++;
            } else if (part.match(/^\$[0-9]+$/)) {
                // NAG (Numeric Annotation Glyph)
                const map = { '$1': '!', '$2': '?', '$3': '!!', '$4': '??', '$5': '!?', '$6': '?!' };
                // High contrast colors for text
                const colorMap = {
                    '$1': '#4ade80', // ! (Good)
                    '$2': '#ef4444', // ? (Bad/Mistake - Red)
                    '$3': '#22c55e', // !! (Brilliant - Green)
                    '$4': '#dc2626', // ?? (Blunder - Dark Red)
                    '$5': '#60a5fa', // !? (Interesting)
                    '$6': '#fbbf24'  // ?! (Dubious)
                };

                const symbol = map[part] || part;
                const color = colorMap[part] || '#17a2b8';
                html += `<span class="gv2-nag" style="color: ${color}">${symbol}</span>`;

                // Store NAG in data model logic
                if (this.lastMatchedPly > 0 && this.mainLinePlies[this.lastMatchedPly]) {
                    this.mainLinePlies[this.lastMatchedPly].nag = part;
                }
            } else if (part.match(/^[0-9]+\.+$/)) {
                html += `<span class="gv2-move-num">${part}</span>`;
            } else {
                html += part;
            }
        });
        return html;
    }

    // --- Controls ---
    jumpTo(ply) {
        if (ply < 0 || ply >= this.mainLinePlies.length) return;

        // Reset manual bubble hide when changing position
        this.bubbleManuallyHidden = false;

        // If we jump to main line, exit variation mode
        if (this.inVariation) {
            this.inVariation = false;
            this.currentVariation = null;
            this.updateVariationIndicator(null);
        }

        this.currentPly = ply;
        this.board.position(this.mainLinePlies[ply].fen, true); // true = animate
        this.game.load(this.mainLinePlies[ply].fen); // Sync internal game state
        this.updateActiveMove();
    }

    stepForward() {
        if (this.inVariation && this.currentVariation) {
            const varData = this.allVariations[this.currentVariation];
            const currentFen = this.game.fen();

            // Use variation index logic if possible, or fallback toFEN match
            // Since we don't track variation ply index globally perfectly, finding by FEN is robust enough for small variations
            const idx = varData.moves.findIndex(m => m.fen === currentFen);

            if (idx < varData.moves.length - 1) {
                // Next move exists
                const nextMove = varData.moves[idx + 1];
                // Try to use board.move if possible for smoother animation
                // We need the SAN or from-to. nextMove has .move object
                if (nextMove.move && nextMove.move.from && nextMove.move.to) {
                    const moveStr = nextMove.move.from + '-' + nextMove.move.to;
                    this.board.move(moveStr);
                    // Manually sync internal state after animation trigger
                    // But we need to ensure jumpToVariation sets the state correctly
                    // jumpToVariation does board.position.
                    // Let's rely on jumpToVariation for state consistency, but maybe optimization is needed?
                    // board.move() updates the board.
                    this.jumpToVariation(this.currentVariation, nextMove.fen);
                } else {
                    this.jumpToVariation(this.currentVariation, nextMove.fen);
                }
            } else {
                // End of variation
                this.toggleAutoplay(false);
            }
        } else {
            // Main line
            if (this.currentPly < this.mainLinePlies.length - 1) {
                const variations = this.getVariationsAtCurrentPosition();

                if (variations.length > 0) {
                    const nextMainMove = this.mainLinePlies[this.currentPly + 1]?.move?.san || '?';
                    this.showVariationChoiceModal(nextMainMove, variations);
                } else {
                    // Use board.move() for single step to guarantee animation
                    const nextData = this.mainLinePlies[this.currentPly + 1];

                    if (nextData && nextData.move && nextData.move.from && nextData.move.to) {
                        const moveStr = nextData.move.from + '-' + nextData.move.to;

                        // Check if board supports move
                        if (this.board && typeof this.board.move === 'function') {
                            this.board.move(moveStr); // Triggers animation

                            // Update internal state AFTER animation completes (500ms moveSpeed + buffer)
                            const nextPly = this.currentPly + 1;
                            setTimeout(() => {
                                this.currentPly = nextPly;
                                this.game.load(this.mainLinePlies[nextPly].fen);
                                this.updateActiveMove();
                            }, 550);
                        } else {
                            this.jumpTo(this.currentPly + 1);
                        }
                    } else {
                        this.jumpTo(this.currentPly + 1);
                    }
                }
            } else {
                this.toggleAutoplay(false);
            }
        }
    }

    stepBack() {
        if (this.inVariation && this.currentVariation) {
            const varData = this.allVariations[this.currentVariation];
            const currentFen = this.game.fen();
            const idx = varData.moves.findIndex(m => m.fen === currentFen);

            if (idx > 0) {
                // Go to previous move in variation
                const prevMove = varData.moves[idx - 1];
                this.jumpToVariation(this.currentVariation, prevMove.fen);
            } else if (idx === 0) {
                // We are at first move of variation. Back goes to position BEFORE variation started.
                this.jumpToVariation(this.currentVariation, varData.startFen);
                // Wait, if we are at startFen, we are still technically in "variation context" but showing root position.
                // If we hit back AGAIN from startFen, we should exit.
            } else {
                // We might be at startFen (idx -1). Exit variation.
                this.exitVariation();
            }
        } else {
            this.jumpTo(this.currentPly - 1);
        }
    }

    goToStart() {
        this.jumpTo(0);
    }

    goToEnd() {
        this.jumpTo(this.mainLinePlies.length - 1);
    }

    flipBoard() {
        this.board.flip();
    }

    toggleAutoplay(forceState) {
        if (forceState === false || (this.autoplayInterval && forceState !== true)) {
            clearInterval(this.autoplayInterval);
            this.autoplayInterval = null;
            document.getElementById('gv2-play-icon').className = 'fa-solid fa-play';
        } else {
            document.getElementById('gv2-play-icon').className = 'fa-solid fa-pause';
            this.autoplayInterval = setInterval(() => this.stepForward(), 1000);
        }
    }

    updateActiveMove() {
        const movesContainer = document.getElementById('gv2-moves');
        document.querySelectorAll('.gv2-move').forEach(el => {
            el.classList.remove('active');
            if (parseInt(el.dataset.ply) === this.currentPly) {
                el.classList.add('active');

                // Manual scroll to prevent whole page jumping
                if (movesContainer) {
                    // Calculate position relative to container
                    // Note: offsetTop is relative to offsetParent. 
                    // We need to ensure calculation is correct.
                    // simpler is: el.offsetTop - (container height / 2) + (el height / 2)

                    const targetScroll = el.offsetTop - (movesContainer.offsetHeight / 2) + (el.offsetHeight / 2);

                    movesContainer.scrollTo({
                        top: targetScroll,
                        behavior: 'smooth'
                    });
                }
            }
        });

        this.updateCommentBubble();
        this.updateNagMarker();
    }

    // List rendering (sidebar)
    renderList() {
        const list = document.getElementById('game-list-content');
        if (!list) return;
        list.innerHTML = '';
        this.gamesData.forEach((game, index) => {
            if (game.type === 'header') {
                const header = document.createElement('div');
                header.className = 'team-header';
                header.textContent = game.title;
                list.appendChild(header);
            } else {
                const item = document.createElement('div');
                item.className = 'game-item';
                if (index === this.currentIndex) item.classList.add('active');

                // Build title with result (hide * and ?)
                let titleHtml = `<span>${this.escapeHtml(game.title || 'Partie')}</span>`;
                const result = game.result || '';
                if (result && result !== '*' && result !== '?' && result.trim()) {
                    titleHtml += `<span class="game-result">${result}</span>`;
                }
                if (game.pgn) {
                    titleHtml += '<i class="fa-solid fa-chess-board" style="opacity:0.5; font-size:0.8em; margin-left:auto;"></i>';
                }

                item.innerHTML = titleHtml;
                item.dataset.index = index;
                item.onclick = () => this.loadGame(index);
                list.appendChild(item);
            }
        });
    }

    // Scroll active game item into view
    scrollToActiveGame() {
        const list = document.getElementById('game-list-content');
        if (!list) return;
        const activeItem = list.querySelector('.game-item.active');
        if (activeItem) {
            setTimeout(() => {
                activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 50);
        }
    }

    handleKeydown(e) {
        // Allow typing in inputs/textareas
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Keys we care about for game control
        const keys = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar'];

        if (keys.includes(e.key)) {
            e.preventDefault(); // Absolutely prevent default scrolling behavior

            if (e.key === 'ArrowRight') this.stepForward();
            if (e.key === 'ArrowLeft') this.stepBack();
            if (e.key === 'ArrowUp') this.prevGame();
            if (e.key === 'ArrowDown') this.nextGame();
            if (e.key === ' ' || e.key === 'Spacebar') this.toggleAutoplay();
        }
    }

    prevGame() {
        let newIndex = this.currentIndex - 1;
        while (newIndex >= 0 && (this.gamesData[newIndex].type === 'header' || this.gamesData[newIndex].isHeader)) {
            newIndex--;
        }
        if (newIndex >= 0) {
            this.loadGame(newIndex);
            this.renderList();
            this.scrollToActiveGame();
        }
    }

    nextGame() {
        let newIndex = this.currentIndex + 1;
        while (newIndex < this.gamesData.length && (this.gamesData[newIndex].type === 'header' || this.gamesData[newIndex].isHeader)) {
            newIndex++;
        }
        if (newIndex < this.gamesData.length) {
            this.loadGame(newIndex);
            this.renderList();
            this.scrollToActiveGame();
        }
    }
    updateCommentBubble() {
        const overlay = document.querySelector('.gv2-board-overlay');
        const content = document.getElementById('gv2-bubble-content');
        const titleEl = document.getElementById('gv2-title'); // Title to hide when bubble shows
        if (!overlay || !content) return;

        let comment = '';
        const currentData = this.mainLinePlies[this.currentPly];
        if (currentData && currentData.comment) comment = currentData.comment;

        const showBtn = document.getElementById('gv2-bubble-show');

        if (comment && !this.bubbleManuallyHidden) {
            content.innerHTML = this.escapeHtml(comment);

            // Hide title when bubble is shown (bubble takes its place in header)
            if (titleEl) titleEl.style.display = 'none';
            if (showBtn) showBtn.classList.remove('visible');

            // Avatar Selection - Manager comments both players
            let avatarUrl = null;

            // If any manager (club member) is playing, use their avatar for all comments
            if (this.whiteAvatar) {
                avatarUrl = this.whiteAvatar;
            } else if (this.blackAvatar) {
                avatarUrl = this.blackAvatar;
            }

            // Fallback to random coach if no manager is playing
            if (!avatarUrl) {
                avatarUrl = this.randomCoach;
            }

            const avatarEl = overlay.querySelector('.gv2-avatar');
            if (avatarEl) {
                if (avatarUrl) {
                    avatarEl.innerHTML = `<img src="${avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                    avatarEl.style.background = 'none';
                } else {
                    avatarEl.innerHTML = '<i class="fa-solid fa-user-tie"></i>';
                    avatarEl.style.background = '#8B4513';
                }
            }

            overlay.style.display = 'flex';
            overlay.classList.remove('pop-in');
            void overlay.offsetWidth;
            overlay.classList.add('pop-in');

            // Hide nav controls when bubble is shown
            const navControls = document.querySelector('.gv2-global-controls');
            if (navControls) navControls.style.display = 'none';
        } else {
            overlay.style.display = 'none';

            // Show nav controls when bubble is hidden
            const navControls = document.querySelector('.gv2-global-controls');
            if (navControls) navControls.style.display = '';

            // Show "show bubble" button only if there's a comment but it's manually hidden
            if (comment && this.bubbleManuallyHidden) {
                if (showBtn) showBtn.classList.add('visible');
                // Keep title hidden when there's a comment but it's collapsed
                if (titleEl) titleEl.style.display = 'none';
            } else {
                if (showBtn) showBtn.classList.remove('visible');
                // Show title only when there's no comment at all
                if (titleEl) titleEl.style.display = '';
            }
        }
    }

    // Manually hide bubble (called by close button)
    hideBubble() {
        const overlay = document.querySelector('.gv2-board-overlay');
        const titleEl = document.getElementById('gv2-title');
        const navControls = document.querySelector('.gv2-global-controls');

        if (overlay) overlay.style.display = 'none';
        // Keep title hidden - only show nav controls
        if (titleEl) titleEl.style.display = 'none';
        if (navControls) navControls.style.display = '';

        // Mark as manually hidden so it doesn't reappear until ply changes
        this.bubbleManuallyHidden = true;

        // Show the "show bubble" button
        const showBtn = document.getElementById('gv2-bubble-show');
        if (showBtn) showBtn.classList.add('visible');
    }

    // Show bubble again after manual hide
    showBubble() {
        this.bubbleManuallyHidden = false;

        // Hide the show button
        const showBtn = document.getElementById('gv2-bubble-show');
        if (showBtn) showBtn.classList.remove('visible');

        // Re-run updateCommentBubble to show it
        this.updateCommentBubble();
    }

    // Get variations that start at current position
    getVariationsAtCurrentPosition() {
        const currentFen = this.game.fen();
        const variations = [];

        for (const [varId, varData] of Object.entries(this.allVariations)) {
            if (varData.startFen === currentFen && varData.moves && varData.moves.length > 0) {
                variations.push({
                    varId,
                    firstMove: varData.moves[0],
                    varData
                });
            }
        }
        return variations;
    }

    // Show modal to choose between main line and variations
    showVariationChoiceModal(mainMove, variations) {
        // Remove existing modal if any
        const existing = document.getElementById('gv2-var-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'gv2-var-modal';
        modal.className = 'gv2-var-modal';
        modal.innerHTML = `
            <div class="gv2-var-modal-content">
                <button class="gv2-var-choice gv2-var-main" data-action="main">
                    ${mainMove}
                </button>
                ${variations.map((v, i) => `
                    <button class="gv2-var-choice" data-action="var" data-var="${v.varId}" data-fen="${v.firstMove.fen}">
                        ${v.firstMove.san}
                    </button>
                `).join('')}
            </div>
        `;

        document.body.appendChild(modal);

        // Handle clicks
        modal.addEventListener('click', (e) => {
            const btn = e.target.closest('.gv2-var-choice');
            if (!btn) return;

            const action = btn.dataset.action;
            if (action === 'main') {
                this.jumpTo(this.currentPly + 1);
            } else if (action === 'var') {
                this.jumpToVariation(btn.dataset.var, btn.dataset.fen);
            }
            modal.remove();
            document.removeEventListener('keydown', keyHandler);
        });

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                document.removeEventListener('keydown', keyHandler);
            }
        });

        // Keyboard handler - only right arrow for main line
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', keyHandler);
            } else if (e.key === 'ArrowRight') {
                // Right arrow = main move
                e.preventDefault();
                this.jumpTo(this.currentPly + 1);
                modal.remove();
                document.removeEventListener('keydown', keyHandler);
            }
        };
        document.addEventListener('keydown', keyHandler);
    }

    updateNagMarker() {
        const wrapper = document.querySelector('.gv2-board-wrapper');
        if (!wrapper) return;

        const existing = wrapper.querySelectorAll('.board-nag-marker');
        existing.forEach(el => el.remove());

        if (!this.mainLinePlies) return;
        const currentData = this.mainLinePlies[this.currentPly];

        if (currentData && currentData.nag && currentData.move) {
            const nag = currentData.nag;
            const nagSymbols = { '$1': '!', '$2': '?', '$3': '!!', '$4': '??', '$5': '!?', '$6': '?!' };
            const symbol = nagSymbols[nag];
            const colorMap = { '$1': '#4ade80', '$2': '#f87171', '$3': '#22c55e', '$4': '#ef4444', '$5': '#60a5fa', '$6': '#fbbf24' };
            const color = colorMap[nag] || '#fff';

            if (!symbol) return;

            const target = currentData.move.to;
            const files = 'abcdefgh';
            const fileIdx = files.indexOf(target[0]);
            const rankIdx = parseInt(target[1]) - 1;

            const orientation = this.board.orientation();

            let topP, leftP;
            const squareSize = 12.5;

            // Approx 85% and 10% inside square
            if (orientation === 'white') {
                leftP = (fileIdx * squareSize) + (squareSize * 0.85);
                topP = ((7 - rankIdx) * squareSize) + (squareSize * 0.1);
            } else {
                leftP = ((7 - fileIdx) * squareSize) + (squareSize * 0.85);
                topP = (rankIdx * squareSize) + (squareSize * 0.1);
            }

            const marker = document.createElement('div');
            marker.className = 'board-nag-marker';
            marker.innerText = symbol;

            // Inline styles to force appearance
            marker.style.position = 'absolute';
            marker.style.width = '2rem';
            marker.style.height = '2rem';
            marker.style.borderRadius = '50%';
            marker.style.display = 'flex';
            marker.style.alignItems = 'center';
            marker.style.justifyContent = 'center';

            marker.style.backgroundColor = color;
            marker.style.color = '#fff';
            marker.style.fontWeight = 'bold';
            marker.style.fontSize = '1.2rem';
            marker.style.boxShadow = '0 2px 4px rgba(0,0,0,0.5)';
            marker.style.border = '2px solid white';

            marker.style.left = leftP + '%';
            marker.style.top = topP + '%';
            marker.style.transform = 'translate(-50%, -50%)';
            marker.style.zIndex = '100';
            marker.style.pointerEvents = 'none';

            wrapper.appendChild(marker);
        }
    }

    escapeHtml(text) {
        if (!text) return text;
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    toggleViewer() {
        // Try legacy appContainer first (for teams.html compat)
        const appContainer = document.getElementById('appContainer');
        const icon = document.getElementById('viewerToggleIcon');

        if (appContainer) {
            // Legacy/Teams behavior
            if (appContainer.classList.contains('collapsed')) {
                appContainer.classList.remove('collapsed');
                if (icon) {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                }
            } else {
                appContainer.classList.add('collapsed');
                if (icon) {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                }
            }
            return;
        }

        // New Article Behavior (gv2-main-container + iframe-container)
        const gv2Container = document.getElementById('gv2-main-container');
        const iframeContainer = document.querySelector('.iframe-container');

        // Determine visibility
        const isVisible = (gv2Container && !gv2Container.classList.contains('hidden') && gv2Container.style.display !== 'none') ||
            (iframeContainer && iframeContainer.style.display !== 'none');

        if (isVisible) {
            // Hide all
            if (gv2Container) gv2Container.classList.add('hidden');
            if (iframeContainer) iframeContainer.style.display = 'none';
            if (icon) {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        } else {
            // Show based on current game type
            const currentGame = this.gamesData[this.currentIndex];
            if (currentGame && currentGame.type === 'chesscom') {
                if (iframeContainer) iframeContainer.style.display = 'block';
            } else {
                if (gv2Container) gv2Container.classList.remove('hidden');
            }
            if (icon) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            }
        }
    }
}

const gameViewer2 = new GameViewer2();
window.gameViewer2 = gameViewer2;

// GLobal exports for legacy buttons support
window.prevGame = () => window.gameViewer2.prevGame();
window.nextGame = () => window.gameViewer2.nextGame();
window.toggleViewer = () => window.gameViewer2.toggleViewer();

// Debug helper for positioning bubble - call debugBubble() in console
window.debugBubble = function () {
    const overlay = document.querySelector('.gv2-board-overlay');
    if (!overlay) { console.log('Overlay not found'); return; }

    // Force show and make draggable
    overlay.style.display = 'flex';
    overlay.style.cursor = 'move';
    overlay.style.border = '3px dashed red';
    document.getElementById('gv2-bubble-content').innerHTML = 'DRAG ME - pozice se ukáže v konzoli';

    let isDragging = false;
    let startX, startY, startTop, startLeft;

    overlay.onmousedown = (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = overlay.getBoundingClientRect();
        startTop = rect.top;
        startLeft = rect.left;
        e.preventDefault();
    };

    document.onmousemove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        overlay.style.position = 'fixed';
        overlay.style.top = (startTop + dy) + 'px';
        overlay.style.left = (startLeft + dx) + 'px';
    };

    document.onmouseup = () => {
        if (isDragging) {
            isDragging = false;
            const rect = overlay.getBoundingClientRect();
            console.log('Bubble position:', { top: rect.top, left: rect.left, width: rect.width, height: rect.height });
            console.log('CSS navrhované:', `top: ${rect.top}px; left: ${rect.left}px;`);
        }
    };

    console.log('Bubble debug mode AKTIVNÍ - taháním myší umísti bublinu, pozice bude v konzoli');
};

/**
 * Self-Contained Game Viewer Factory
 * Creates the entire split-view structure with games list and viewer panel
 * 
 * Usage:
 *   GameViewer2.create('#container', gamesArray, { title: 'Partie', maxHeight: 600 });
 */
GameViewer2.create = function (containerSelector, games, options = {}) {
    const targetContainer = document.querySelector(containerSelector);
    if (!targetContainer) {
        console.error('[GameViewer2.create] Container not found:', containerSelector);
        return null;
    }

    const title = options.title || 'Partie';
    const maxHeight = options.maxHeight || 600;
    const listId = options.listId || 'gv2-games-list';

    // Create the complete split-view structure
    targetContainer.innerHTML = `
        <div class="gv-split-view" style="--gv-max-height: ${maxHeight}px;">
            <!-- Games List Panel (Left) -->
            <div class="gv-games-panel">
                <div style="padding: 1rem 1.25rem; background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <h3 style="margin: 0; color: var(--primary-color); font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fa-solid fa-chess-board"></i> ${title}
                    </h3>
                </div>
                <div id="${listId}" style="flex: 1; overflow-y: auto; padding: 0.5rem;"></div>
            </div>

            <!-- Viewer Panel (Right) -->
            <div class="gv-viewer-panel">
                <div style="flex: 1; padding: 1rem;">
                    <!-- GameViewer2 Wrapper - the class will inject here -->
                    <div id="game-viewer-wrapper" class="game-viewer">
                        <!-- Iframe for Chess.com fallback -->
                        <div class="iframe-container" style="display:none;">
                            <iframe id="chess-frame" src="" frameborder="0" allowtransparency="true"
                                style="width:100%;height:480px;border:none;border-radius:8px;"></iframe>
                        </div>
                        <!-- GameViewer2 main container will be injected here -->
                    </div>
                </div>
            </div>
        </div>
    `;

    // Show the container
    targetContainer.classList.remove('hidden');
    targetContainer.style.display = 'block';

    // Initialize the viewer with games
    if (games && games.length > 0) {
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
            gameViewer2.init(games);

            // Override the list container to use our custom ID
            const listContainer = document.getElementById(listId);
            if (listContainer) {
                gameViewer2.renderListToElement(listContainer);
            }
        }, 50);
    }

    return gameViewer2;
};

/**
 * Render games list to a specific element (for split-view layout)
 */
GameViewer2.prototype.renderListToElement = function (listElement) {
    if (!listElement) return;
    listElement.innerHTML = '';

    this.gamesData.forEach((game, index) => {
        if (game.type === 'header' || game.isHeader) {
            const header = document.createElement('div');
            header.className = 'team-header';
            header.textContent = game.title || game.name || 'Skupina';
            listElement.appendChild(header);
        } else {
            const item = document.createElement('div');
            item.className = 'game-item';
            if (index === this.currentIndex) item.classList.add('active');

            // Build clean title (player names without asterisks)
            let displayTitle = game.title || 'Partie';
            // Remove any asterisks from title
            displayTitle = displayTitle.replace(/\*/g, '').trim();

            let titleHtml = `<span>${this.escapeHtml(displayTitle)}</span>`;
            const result = game.result || '';
            if (result && result !== '*' && result !== '?' && result.trim()) {
                titleHtml += `<span class="game-result">${result}</span>`;
            }
            if (game.pgn) {
                titleHtml += '<i class="fa-solid fa-chess-board" style="opacity:0.5; font-size:0.8em; margin-left:auto;"></i>';
            }

            item.innerHTML = titleHtml;
            item.dataset.index = index;
            item.onclick = () => this.loadGame(index);
            listElement.appendChild(item);
        }
    });

    // Store reference for updating active state
    this.externalListElement = listElement;
};

/**
 * Update active state in external list (for split-view)
 */
const originalLoadGame = GameViewer2.prototype.loadGame;
GameViewer2.prototype.loadGame = function (index) {
    // Call original
    originalLoadGame.call(this, index);

    // Update external list if present and scroll into view
    if (this.externalListElement) {
        this.externalListElement.querySelectorAll('.game-item').forEach((item) => {
            const isActive = parseInt(item.dataset.index) === index;
            item.classList.toggle('active', isActive);

            // Scroll active item into view
            if (isActive) {
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }
};
