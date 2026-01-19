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

/**
 * Chess Analyzer - Lichess Cloud Evaluation API
 * Uses cached Stockfish evaluations from Lichess (~7 million positions)
 * Falls back gracefully if position not in database
 */
class ChessAnalyzer {
    constructor(onUpdate) {
        this.onUpdate = onUpdate; // Callback for UI updates
        this.isAnalyzing = false;
        this.currentRequestId = null;
        this.debounceTimer = null;
        this.apiUrl = 'https://lichess.org/api/cloud-eval';
        this.fallbackDepth = 16; // Default, will be loaded from server
        this._loadDepthFromServer();
    }

    // Load depth setting from database (async, non-blocking)
    async _loadDepthFromServer() {
        try {
            const response = await fetch('/api/settings/public/chessApiDepth');
            if (response.ok) {
                const data = await response.json();
                if (data.value) {
                    this.fallbackDepth = parseInt(data.value, 10);
                    console.log('[ChessAnalyzer] Depth loaded from server:', this.fallbackDepth);
                }
            }
        } catch (e) {
            console.warn('[ChessAnalyzer] Failed to load depth from server, using default', e);
        }
    }

    connect() {
        // REST API doesn't need connection
        return Promise.resolve();
    }

    disconnect() {
        this.stopAnalysis();
    }

    analyze(fen) {
        // Debounce rapid requests (e.g., when clicking through moves quickly)
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this._doAnalysis(fen);
        }, 200); // 200ms debounce
    }

    async _doAnalysis(fen) {
        const requestId = Math.random().toString(36).substring(7);
        this.currentRequestId = requestId;
        this.isAnalyzing = true;

        try {
            // Lichess cloud-eval uses GET with FEN as query param
            // multiPv=3 to get up to 3 variations
            const url = `${this.apiUrl}?fen=${encodeURIComponent(fen)}&multiPv=3`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            // Check if this request is still current
            if (this.currentRequestId !== requestId) {
                return;
            }

            if (response.status === 404) {
                // Position not in Lichess cloud database - fallback to chess-api.com
                console.log('[ChessAnalyzer] Position not in Lichess cloud, trying chess-api.com fallback');
                await this._fallbackToChessApi(fen, requestId);
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Lichess response format:
            // { fen, knodes, depth, pvs: [{ moves: "e2e4 e7e5 ...", cp: 35 }, ...] }

            if (this.onUpdate && this.currentRequestId === requestId) {
                const mainPv = data.pvs && data.pvs[0];

                // Extract evaluation (cp = centipawns, mate = mate in N)
                let evalScore = null;
                let mateScore = null;

                if (mainPv) {
                    if (mainPv.mate !== undefined) {
                        mateScore = mainPv.mate;
                    } else if (mainPv.cp !== undefined) {
                        evalScore = mainPv.cp / 100; // Convert centipawns to pawns
                    }
                }

                // Parse continuation moves (UCI format: "e2e4 e7e5 g1f3")
                let continuation = [];
                if (mainPv && mainPv.moves) {
                    continuation = mainPv.moves.split(' ').slice(1); // Skip first move (best move)
                }

                // First move is the best move
                const bestMoveUci = mainPv && mainPv.moves ? mainPv.moves.split(' ')[0] : null;

                this.onUpdate({
                    type: 'bestmove',
                    eval: evalScore,
                    mate: mateScore,
                    depth: data.depth || 0,
                    fen: fen, // Return original FEN for sync check
                    winChance: evalScore !== null ? this._evalToWinChance(evalScore) : 50,
                    continuation: continuation,
                    uciMove: bestMoveUci,
                    text: `Lichess Cloud`
                });
            }

        } catch (error) {
            console.error('[ChessAnalyzer] Lichess API Error:', error);
            // Show error state
            if (this.onUpdate && this.currentRequestId === requestId) {
                this.onUpdate({
                    type: 'error',
                    eval: null,
                    mate: null,
                    depth: 0,
                    fen: fen,
                    text: 'Chyba při načítání'
                });
            }
        } finally {
            this.isAnalyzing = false;
        }
    }

    // Convert evaluation to win chance percentage
    _evalToWinChance(eval_) {
        // Sigmoid function: 50 + 50 * tanh(eval / 4)
        return 50 + 50 * Math.tanh(eval_ / 4);
    }

    // Fallback to chess-api.com for positions not in Lichess cloud
    async _fallbackToChessApi(fen, requestId) {
        try {
            const response = await fetch('https://chess-api.com/v1', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fen: fen,
                    depth: this.fallbackDepth
                })
            });

            if (this.currentRequestId !== requestId) return;

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Check for rate limit error
            if (data.error === 'HIGH_USAGE') {
                if (this.onUpdate) {
                    this.onUpdate({
                        type: 'info',
                        eval: null,
                        mate: null,
                        depth: 0,
                        fen: fen,
                        text: 'API limit (zkuste později)'
                    });
                }
                return;
            }

            if (this.onUpdate && this.currentRequestId === requestId) {
                this.onUpdate({
                    type: 'bestmove',
                    eval: data.eval,
                    mate: data.mate,
                    depth: data.depth,
                    fen: fen,
                    winChance: data.winChance || (data.eval !== null ? this._evalToWinChance(data.eval) : 50),
                    continuation: data.continuationArr || [],
                    uciMove: data.move,
                    text: `Stockfish (hloubka ${data.depth || this.fallbackDepth})`
                });
            }
        } catch (error) {
            console.error('[ChessAnalyzer] chess-api.com fallback error:', error);
            if (this.onUpdate && this.currentRequestId === requestId) {
                this.onUpdate({
                    type: 'info',
                    eval: null,
                    mate: null,
                    depth: 0,
                    fen: fen,
                    text: 'Pozice není k dispozici'
                });
            }
        }
    }

    stopAnalysis() {
        this.currentRequestId = null;
        this.isAnalyzing = false;
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }
}

/**
 * ChessEvalDisplay - Global utility for eval bar rendering
 * Reusable across different pages (partie.html, chess-database.html, etc.)
 */
const ChessEvalDisplay = {
    /**
     * Generate HTML for eval bar container
     * @param {string} prefix - ID prefix for elements (e.g., 'gv2', 'db')
     * @returns {string} HTML string
     */
    createHTML(prefix = 'gv2') {
        return `
            <div id="${prefix}EvalBar" class="gv2-eval-bar">
                <div class="gv2-eval-fill" id="${prefix}EvalFill" style="height: 50%;"></div>
                <span class="gv2-eval-text" id="${prefix}EvalText">0.0</span>
            </div>
        `;
    },

    /**
     * Generate HTML for analysis info (best move + PV line)
     * @param {string} prefix - ID prefix for elements
     * @returns {string} HTML string
     */
    createAnalysisInfoHTML(prefix = 'gv2') {
        return `
            <div id="${prefix}AnalysisInfo" class="gv2-analysis-info">
                <span class="gv2-best-move" id="${prefix}BestMove">—</span>
                <div class="gv2-pv-line" id="${prefix}PvLine"></div>
            </div>
        `;
    },

    /**
     * Update eval bar display based on analysis data
     * @param {string} prefix - ID prefix for elements
     * @param {object} data - Analysis data from ChessAnalyzer
     */
    update(prefix, data) {
        const evalFill = document.getElementById(`${prefix}EvalFill`);
        const evalText = document.getElementById(`${prefix}EvalText`);
        const bestMove = document.getElementById(`${prefix}BestMove`);
        const pvLine = document.getElementById(`${prefix}PvLine`);

        if (!evalFill || !evalText) return;

        // Handle info messages (no eval)
        if (data.type === 'info' || (data.eval === null && data.mate === null && data.mate === undefined)) {
            evalText.textContent = data.text || '—';
            if (bestMove) bestMove.textContent = data.text || '—';
            if (pvLine) pvLine.textContent = '';
            return;
        }

        // Calculate eval bar percentage
        let percentage;
        let displayText;

        if (data.mate !== null && data.mate !== undefined) {
            percentage = data.mate > 0 ? 100 : 0;
            displayText = `M${Math.abs(data.mate)}`;
        } else {
            const eval_ = data.eval || 0;
            percentage = data.winChance || (50 + 50 * Math.tanh(eval_ / 4));
            displayText = (eval_ >= 0 ? '+' : '') + eval_.toFixed(1);
        }

        // White fill grows from bottom - higher percentage = more white (white winning)
        evalFill.style.height = `${percentage}%`;
        evalText.textContent = displayText;

        // First line: evaluation info with depth (like partie.html)
        if (bestMove) {
            const depthText = data.depth ? `Hloubka ${data.depth}` : '';
            const sourceText = data.text || '';
            if (depthText || sourceText) {
                bestMove.innerHTML = `<strong>${displayText}</strong> <span style="color: var(--text-muted); font-size: 0.85em;">${sourceText}</span> <span style="background: rgba(255,255,255,0.1); padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.75em; color: var(--text-muted);">${depthText}</span>`;
            } else {
                bestMove.innerHTML = `<strong>${displayText}</strong>`;
            }
        }

        // Second line: best move + continuation with move numbers
        if (pvLine && data.fen) {
            // Include best move in the PV line
            const allMoves = data.uciMove ? [data.uciMove, ...(data.continuation || []).slice(0, 5)] : (data.continuation || []).slice(0, 6);
            if (allMoves.length > 0) {
                const sanMoves = this.uciLineToPvSanFromStart(allMoves, data.fen);
                pvLine.innerHTML = sanMoves;
            } else {
                pvLine.textContent = '';
            }
        } else if (pvLine && data.continuation && data.continuation.length > 0) {
            pvLine.textContent = data.continuation.slice(0, 6).join(' ');
        } else if (pvLine) {
            pvLine.textContent = '';
        }
    },

    /**
     * Convert UCI move to SAN using chess.js
     * @param {string} uci - UCI move (e.g., "e2e4", "g8f6")
     * @param {string} fen - Current FEN position
     * @returns {string} SAN move (e.g., "e4", "Nf6")
     */
    uciToSan(uci, fen) {
        if (!uci || !fen || typeof Chess === 'undefined') return uci;

        try {
            const chess = new Chess(fen);
            const from = uci.slice(0, 2);
            const to = uci.slice(2, 4);
            const promotion = uci.length > 4 ? uci[4] : undefined;

            const move = chess.move({ from, to, promotion });
            return move ? move.san : uci;
        } catch (e) {
            return uci;
        }
    },

    /**
     * Convert a line of UCI moves to SAN with figurine notation and move numbers
     * Starting from the given FEN (no first move pre-applied)
     * @param {string[]} uciMoves - Array of UCI moves (including best move as first)
     * @param {string} startFen - Starting FEN
     * @returns {string} HTML string with formatted moves
     */
    uciLineToPvSanFromStart(uciMoves, startFen) {
        if (!startFen || typeof Chess === 'undefined' || !uciMoves || uciMoves.length === 0) {
            return uciMoves ? uciMoves.join(' ') : '';
        }

        try {
            const chess = new Chess(startFen);

            // Get starting move number and turn from FEN
            const fenParts = startFen.split(' ');
            let fullmoveNumber = parseInt(fenParts[5]) || 1;
            let isBlackToMove = fenParts[1] === 'b';

            // Convert all moves with move numbers
            const formattedMoves = [];
            let needMoveNumber = true;

            for (const uci of uciMoves) {
                const from = uci.slice(0, 2);
                const to = uci.slice(2, 4);
                const promotion = uci.length > 4 ? uci[4] : undefined;

                const move = chess.move({ from, to, promotion });
                if (move) {
                    let moveStr = '';

                    if (!isBlackToMove) {
                        // White's move: "1. e4"
                        moveStr = `${fullmoveNumber}. ${this.formatSan(move.san)}`;
                        needMoveNumber = false;
                    } else {
                        // Black's move
                        if (needMoveNumber) {
                            // First move in line is black: "1... e5"
                            moveStr = `${fullmoveNumber}... ${this.formatSan(move.san)}`;
                        } else {
                            // Normal black move (after white): just the move
                            moveStr = this.formatSan(move.san);
                        }
                        fullmoveNumber++;
                        needMoveNumber = true;
                    }

                    formattedMoves.push(moveStr);
                    isBlackToMove = !isBlackToMove;
                } else {
                    break;
                }
            }

            return formattedMoves.join(' ');
        } catch (e) {
            return uciMoves.join(' ');
        }
    },

    /**
     * Convert a line of UCI moves to SAN with figurine notation and move numbers
     * @param {string[]} uciMoves - Array of UCI moves
     * @param {string} startFen - Starting FEN
     * @param {string} firstMove - First move (best move) already played
     * @returns {string} HTML string with formatted moves
     */
    uciLineToPvSan(uciMoves, startFen, firstMove) {
        if (!startFen || typeof Chess === 'undefined') {
            return uciMoves.join(' ');
        }

        try {
            const chess = new Chess(startFen);

            // Get starting move number and turn from FEN
            const fenParts = startFen.split(' ');
            let fullmoveNumber = parseInt(fenParts[5]) || 1;
            let isBlackToMove = fenParts[1] === 'b';

            // Apply first move if provided
            if (firstMove) {
                const from = firstMove.slice(0, 2);
                const to = firstMove.slice(2, 4);
                const promotion = firstMove.length > 4 ? firstMove[4] : undefined;
                const move = chess.move({ from, to, promotion });
                if (move) {
                    if (!isBlackToMove) {
                        fullmoveNumber++;
                    }
                    isBlackToMove = !isBlackToMove;
                }
            }

            // Convert continuation moves with move numbers
            const formattedMoves = [];
            let needMoveNumber = true;

            for (const uci of uciMoves) {
                const from = uci.slice(0, 2);
                const to = uci.slice(2, 4);
                const promotion = uci.length > 4 ? uci[4] : undefined;

                const move = chess.move({ from, to, promotion });
                if (move) {
                    let moveStr = '';

                    if (!isBlackToMove) {
                        // White's move: "1. e4"
                        moveStr = `${fullmoveNumber}. ${this.formatSan(move.san)}`;
                        needMoveNumber = false;
                    } else {
                        // Black's move
                        if (needMoveNumber) {
                            // First move in line is black: "1... e5"
                            moveStr = `${fullmoveNumber}... ${this.formatSan(move.san)}`;
                        } else {
                            // Normal black move (after white): just the move
                            moveStr = this.formatSan(move.san);
                        }
                        fullmoveNumber++;
                        needMoveNumber = true;
                    }

                    formattedMoves.push(moveStr);
                    isBlackToMove = !isBlackToMove;
                } else {
                    break;
                }
            }

            return formattedMoves.join(' ');
        } catch (e) {
            return uciMoves.join(' ');
        }
    },

    /**
     * Format SAN move with figurine notation (Font Awesome icons)
     * @param {string} san - SAN move (e.g., "Nf6", "Bxe5")
     * @returns {string} HTML with piece icons
     */
    formatSan(san) {
        if (!san) return san;

        const pieceMap = {
            'K': '<i class="fa-solid fa-chess-king"></i>',
            'Q': '<i class="fa-solid fa-chess-queen"></i>',
            'R': '<i class="fa-solid fa-chess-rook"></i>',
            'B': '<i class="fa-solid fa-chess-bishop"></i>',
            'N': '<i class="fa-solid fa-chess-knight"></i>'
        };

        // Replace piece letter at start of move
        const firstChar = san[0];
        if (pieceMap[firstChar]) {
            return pieceMap[firstChar] + san.slice(1);
        }

        // Handle castling
        if (san === 'O-O' || san === 'O-O-O') {
            return san;
        }

        return san;
    },

    /**
     * Clear/reset the eval display
     * @param {string} prefix - ID prefix for elements
     */
    clear(prefix) {
        const evalFill = document.getElementById(`${prefix}EvalFill`);
        const evalText = document.getElementById(`${prefix}EvalText`);
        const bestMove = document.getElementById(`${prefix}BestMove`);
        const pvLine = document.getElementById(`${prefix}PvLine`);

        if (evalFill) evalFill.style.height = '50%';
        if (evalText) evalText.textContent = '—';
        if (bestMove) bestMove.textContent = '—';
        if (pvLine) pvLine.textContent = '';
    }
};

// Make ChessEvalDisplay globally available
window.ChessEvalDisplay = ChessEvalDisplay;

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

        // Stockfish analysis
        this.analyzer = new ChessAnalyzer((data) => this.handleAnalysisUpdate(data));
        this.analysisEnabled = false;
        this.lastEval = null;

        // Modal cooldown to prevent re-showing after selection
        this.modalCooldown = false;

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

    formatSan(san) {
        if (!san) return '';

        // Use Font Awesome icons instead of Unicode for better visibility
        // Defined inline helper
        const icon = (cls) => `<i class="fa-solid ${cls}"></i>`;

        return san.replace(/^N/, icon('fa-chess-knight'))
            .replace(/^B/, icon('fa-chess-bishop'))
            .replace(/^R/, icon('fa-chess-rook'))
            .replace(/^Q/, icon('fa-chess-queen'))
            .replace(/^K/, icon('fa-chess-king'))
            .replace('=N', '=' + icon('fa-chess-knight'))
            .replace('=B', '=' + icon('fa-chess-bishop'))
            .replace('=R', '=' + icon('fa-chess-rook'))
            .replace('=Q', '=' + icon('fa-chess-queen'));
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
                        <div class="gv2-board-area">
                            <div class="gv2-eval-bar" id="gv2-eval-bar">
                                <div class="gv2-eval-fill" id="gv2-eval-fill"></div>
                                <div class="gv2-eval-text" id="gv2-eval-text">0.0</div>
                            </div>
                            <div class="gv2-board-wrapper">
                                <div id="gv2-board"></div>
                            </div>
                        </div>
                    </div>
                    <div class="gv2-info-panel">
                        <div class="gv2-info-content">
                            <div id="gv2-metadata" class="gv2-metadata"></div>
                            <div id="gv2-moves" class="gv2-moves"></div>
                        </div>
                        <div class="gv2-analysis-info" id="gv2-analysis-info" style="display: none;">
                            <div class="gv2-analysis-row">
                                <span class="gv2-best-move" id="gv2-best-move"></span>
                                <span class="gv2-depth" id="gv2-depth"></span>
                            </div>
                            <div class="gv2-pv-line" id="gv2-pv-line"></div>
                        </div>
                    </div>
                    <div class="gv2-controls">
                        <button class="gv2-btn" onclick="gameViewer2.goToStart()" title="Start"><i class="fa-solid fa-backward-fast"></i></button>
                        <button class="gv2-btn" onclick="gameViewer2.stepBack()" title="Zpět"><i class="fa-solid fa-backward-step"></i></button>
                        <button class="gv2-btn" onclick="gameViewer2.toggleAutoplay()" title="Přehrát"><i class="fa-solid fa-play" id="gv2-play-icon"></i></button>
                        <button class="gv2-btn" onclick="gameViewer2.stepForward()" title="Vpřed"><i class="fa-solid fa-forward-step"></i></button>
                        <button class="gv2-btn" onclick="gameViewer2.goToEnd()" title="Konec"><i class="fa-solid fa-forward-fast"></i></button>
                        <button class="gv2-btn" onclick="gameViewer2.flipBoard()" title="Otočit"><i class="fa-solid fa-retweet"></i></button>
                        <button class="gv2-btn gv2-btn-analysis" id="gv2-analysis-btn" onclick="gameViewer2.toggleAnalysis()" title="Analýza Stockfish">
                            <i class="fa-solid fa-microchip" id="gv2-analysis-icon"></i>
                        </button>
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
            this.boardEl = boardEl; // Store reference for highlights
            console.log('[GV2 Init] Initializing board. Element found:', boardEl);

            if (typeof Chessboard === 'function') {
                try {
                    this.board = Chessboard('gv2-board', {
                        position: 'start',
                        draggable: false,
                        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
                        moveSpeed: 200,
                        appearSpeed: 150,
                        snapSpeed: 50
                    });
                    console.log('[GV2 Init] Chessboard instance created:', this.board);
                } catch (e) {
                    console.error('[GV2 Init] Chessboard constructor threw error:', e);
                }
            } else {
                console.error('[GV2 Init] Chessboard library is not a function:', typeof Chessboard);
            }
        }

        // Initial sync of eval bar height
        this.syncEvalBarHeight();

        // Add resize listener
        window.addEventListener('resize', () => {
            this.board && this.board.resize();
            this.syncEvalBarHeight();
        });
    }

    syncEvalBarHeight() {
        requestAnimationFrame(() => {
            const boardEl = document.getElementById('gv2-board');
            const evalBar = document.getElementById('gv2-eval-bar');
            if (boardEl && evalBar) {
                // FORCE height to match board
                const height = boardEl.offsetHeight;
                if (height > 0) {
                    evalBar.style.height = height + 'px';
                }
            }
        });
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
            const titleEl = document.getElementById('gv2-title');
            if (gameData.white && gameData.black) {
                // Use HTML to allow mobile styling (stacking)
                titleEl.innerHTML = `<span class="gv2-player-white">${gameData.white}</span><span class="gv2-vs-sep"> - </span><span class="gv2-player-black">${gameData.black}</span>`;
            } else {
                titleEl.textContent = gameData.title;
            }

            this.renderMetadata(gameData);

            // Parse PGN
            this.parseAndLoadPGN(gameData.pgn);

            // Resize board (important because container was likely hidden)
            // Use multiple triggers to ensure layout is recalculated
            const triggerResize = () => {
                if (this.board && typeof this.board.resize === 'function') {
                    this.board.resize();
                    this.syncEvalBarHeight();
                }
            };

            // Immediate resize
            triggerResize();

            // Delayed resize helps with some layout trashing or transition situations
            setTimeout(triggerResize, 50);

            // Double check scrolling into view logic - preventing jump on game switch
            requestAnimationFrame(() => {
                setTimeout(() => {
                    // Focus container for immediate keyboard control
                    // Use preventScroll to stop the page from jumping
                    // Skip focus on mobile to prevent virtual keyboard or unexpected scrolls
                    if (gv2Container && window.innerWidth > 768) {
                        gv2Container.focus({ preventScroll: true });
                    }
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
        // First normalize PGN format (ensure blank line between headers and moves)
        let normalizedPgn = this.normalizePgn(pgnText);
        let clean = this.stripVariations(normalizedPgn);

        // Load Clean State to get history
        const loadSuccess = this.game.load_pgn(clean);
        if (!loadSuccess) {
            console.warn('[parseAndLoadPGN] chess.js load_pgn failed! PGN may be malformed.');
            console.log('[parseAndLoadPGN] Clean PGN was:', clean.substring(0, 500));
        }
        const history = this.game.history({ verbose: true });
        console.log('[parseAndLoadPGN] Parsed history length:', history.length);

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

        // Ensure board is ready
        if (!this.board) {
            this.setupCombinedDOM();
        }

        // Reset to start (updates board, internal state, and UI)
        setTimeout(() => this.jumpTo(0), 10);
    }

    /**
     * Normalize PGN format to ensure chess.js compatibility
     * - Ensures blank line between headers and moves (required by chess.js)
     */
    normalizePgn(pgn) {
        if (!pgn) return pgn;

        // Find the last header tag (ends with ])
        // and ensure there's a blank line before moves start
        // Pattern: ]\n followed by digit (move number) without blank line between
        // Replace with ]\n\n (adding blank line)
        return pgn.replace(/(\])\n([0-9])/g, '$1\n\n$2');
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
            // Check for NAG (Numeric Annotation Glyph)
            if (token.match(/^\$[0-9]+$/)) {
                if (moves.length > 0) {
                    moves[moves.length - 1].nag = token;
                }
                continue;
            }

            // Skip move numbers and comments start
            if (token.match(/^[0-9]+\.+$/) || token.startsWith('{')) {
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
                        html += `<span class="gv2-var-move" data-var="${varId}" data-fen="${fen}">${this.formatSan(move.san)}</span>`;
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

        // Sync internal game state. Robust load.
        this.safeLoad(fen);

        // Update UI to show we're in a variation
        this.updateVariationIndicator(varId);
        this.updateActiveVariationMove(varId, fen);
    }

    // Safely load FEN into this.game, creating new instance if needed
    // logic: try load() -> try normalized EP -> new Chess()
    safeLoad(fen) {
        if (this.game.load(fen)) return true;

        console.warn('[safeLoad] Strict load failed for:', fen);

        // Try stripping En Passant target if no capture possibilities?
        // Simple normalization: if part[3] != '-', try '-'
        const parts = fen.split(' ');
        if (parts.length >= 4 && parts[3] !== '-') {
            const safeParts = [...parts];
            safeParts[3] = '-';
            const safeFen = safeParts.join(' ');
            if (this.game.load(safeFen)) {
                console.log('[safeLoad] Loaded with normalized EP:', safeFen);
                return true;
            }
        }

        // Fallback: new instance (resets history, but keeps position)
        try {
            this.game = new Chess(fen);
            console.log('[safeLoad] Forced new Chess instance');
            return true;
        } catch (e) {
            console.error('[safeLoad] Critical failure:', e);
            return false;
        }
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

        // Update comment bubble and NAG marker for this position
        this.updateCommentBubble();
        this.updateNagMarker();
    }

    processBuffer(text, history, parentVarId = null) {
        if (!text.trim()) return text;

        const parts = text.split(/(\s+|\.|[0-9]+\.+)/).filter(x => x);
        let html = '';

        if (typeof this.nextMainLinePlyToMatch === 'undefined') this.nextMainLinePlyToMatch = 0;

        let lastWasMoveNum = false;

        parts.forEach(part => {
            const cleanPart = part.trim();
            const nextMove = history[this.nextMainLinePlyToMatch];

            // If empty/whitespace (separator)
            if (!cleanPart) {
                if (lastWasMoveNum) {
                    html += '&nbsp;';
                    lastWasMoveNum = false;
                } else {
                    html += part;
                }
                return;
            }

            // It's not whitespace, so reset flag unless we set it again
            lastWasMoveNum = false;

            if (nextMove && (cleanPart === nextMove.san || cleanPart === nextMove.lan)) {
                const ply = this.nextMainLinePlyToMatch + 1;
                html += `<span class="gv2-move" data-ply="${ply}" onclick="gameViewer2.jumpTo(${ply})">${this.formatSan(part)}</span>`;

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
                lastWasMoveNum = true;
            } else if (cleanPart.match(/^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[\+#]?$/) ||
                cleanPart.match(/^O-O(-O)?[\+#]?$/)) {
                // Fallback: This looks like a valid chess move but didn't match expected sequence
                console.log('[processBuffer] Fallback match for:', cleanPart, 'from part:', part);
                // Still wrap it with gv2-move class and apply figurine notation
                // Try to find this move in history to get correct ply
                let foundPly = -1;
                for (let i = 0; i < history.length; i++) {
                    if (history[i] && (history[i].san === cleanPart || history[i].lan === cleanPart)) {
                        foundPly = i + 1;
                        break;
                    }
                }

                if (foundPly > 0) {
                    html += `<span class="gv2-move" data-ply="${foundPly}" onclick="gameViewer2.jumpTo(${foundPly})">${this.formatSan(part)}</span>`;
                    this.lastMatchedPly = foundPly;
                } else {
                    // Still apply figurine notation even if we can't link to ply
                    html += `<span class="gv2-move">${this.formatSan(part)}</span>`;
                }
            } else if (cleanPart.match(/^(1-0|0-1|1\/2-1\/2|\*)$/)) {
                // Game result - wrap in special class for styling
                html += `<span class="gv2-result">${cleanPart}</span>`;
            } else {
                // Log unmatched tokens for debugging
                if (cleanPart) {
                    console.log('[processBuffer] Unmatched token:', cleanPart, '| raw:', part);
                }
                html += part;
            }
        });
        return html;
    }

    // --- Controls ---
    jumpTo(ply) {
        console.log('[DEBUG jumpTo] Called with ply:', ply, 'mainLinePlies.length:', this.mainLinePlies.length);
        if (ply < 0 || ply >= this.mainLinePlies.length) {
            console.log('[DEBUG jumpTo] Out of bounds, returning');
            return;
        }

        // Reset manual bubble hide when changing position
        this.bubbleManuallyHidden = false;

        // If we jump to main line, exit variation mode
        if (this.inVariation) {
            this.inVariation = false;
            this.currentVariation = null;
            this.updateVariationIndicator(null);
        }

        this.currentPly = ply;
        const targetFen = this.mainLinePlies[ply].fen;
        console.log('[DEBUG jumpTo] Setting position to FEN:', targetFen);
        console.log('[DEBUG jumpTo] Board object:', this.board);
        console.log('[DEBUG jumpTo] Calling board.position(fen, true)');

        this.board.position(targetFen, true); // true = animate
        console.log('[DEBUG jumpTo] board.position() returned');

        this.safeLoad(targetFen);
        this.updateActiveMove();
        console.log('[DEBUG jumpTo] Complete');
    }

    stepForward() {
        // If variation modal is open, user pressing right means "continue in main line"
        // Set cooldown and hide modal - the cooldown prevents re-showing
        const modalOpen = document.getElementById('gv2-var-modal');
        if (modalOpen) {
            this.modalCooldown = true;
            setTimeout(() => { this.modalCooldown = false; }, 500);
            this.hideVariationChoiceModal();
        }
        console.log('[DEBUG stepForward] Called. inVariation:', this.currentVariation, 'currentPly:', this.currentPly);

        if (this.inVariation && this.currentVariation) {
            console.log('[DEBUG stepForward] In variation mode');
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
                    console.log('[DEBUG stepForward] Variation: calling board.move with:', moveStr);
                    this.board.move(moveStr); // Triggers animation

                    // Wait for animation to complete before updating internal state (200ms moveSpeed + buffer)
                    const varId = this.currentVariation;
                    const targetFen = nextMove.fen;
                    setTimeout(() => {
                        // Update internal state AFTER animation completes
                        this.inVariation = true;
                        this.currentVariation = varId;
                        this.safeLoad(targetFen);
                        this.updateVariationIndicator(varId);
                        this.updateActiveVariationMove(varId, targetFen);
                    }, 250);
                } else {
                    console.log('[DEBUG stepForward] Variation: no from/to, using jumpToVariation');
                    this.jumpToVariation(this.currentVariation, nextMove.fen);
                }
            } else {
                // End of variation
                console.log('[DEBUG stepForward] End of variation reached');
                this.toggleAutoplay(false);
            }
        } else {
            // Main line
            console.log('[DEBUG stepForward] Main line. currentPly:', this.currentPly, 'total:', this.mainLinePlies.length);

            if (this.currentPly < this.mainLinePlies.length - 1) {
                const variations = this.getVariationsAtCurrentPosition();
                console.log('[DEBUG stepForward] Variations at position:', variations.length);

                if (variations.length > 0 && !this.modalCooldown) {
                    const nextMainMove = this.mainLinePlies[this.currentPly + 1]?.move?.san || '?';
                    console.log('[DEBUG stepForward] Variations at position, nextMainMove:', nextMainMove);

                    // If autoplay is running, show modal but with auto-timeout
                    if (this.autoplayInterval) {
                        console.log('[DEBUG stepForward] Autoplay active, showing modal with 2s timeout');
                        // Pause autoplay temporarily
                        clearInterval(this.autoplayInterval);
                        this.autoplayInterval = null;

                        // Show modal with autoplay timeout
                        this.showVariationChoiceModal(nextMainMove, variations, true);
                    } else {
                        // Manual step - show modal without timeout
                        console.log('[DEBUG stepForward] Showing variation modal for:', nextMainMove);
                        this.showVariationChoiceModal(nextMainMove, variations, false);
                    }
                } else {
                    // Use board.move() for single step to guarantee animation
                    const nextData = this.mainLinePlies[this.currentPly + 1];
                    console.log('[DEBUG stepForward] nextData:', nextData);
                    console.log('[DEBUG stepForward] nextData.move:', nextData?.move);
                    console.log('[DEBUG stepForward] nextData.fen:', nextData?.fen);

                    if (nextData && nextData.move && nextData.move.from && nextData.move.to) {
                        const moveStr = nextData.move.from + '-' + nextData.move.to;
                        console.log('[DEBUG stepForward] Main line: calling board.move with:', moveStr);

                        // Use board.move() for single piece animation - this SLIDES the piece
                        // board.position() replaces DOM elements which causes "teleporting"
                        this.board.move(moveStr);
                        console.log('[DEBUG stepForward] board.move() called successfully');

                        // Update internal state AFTER animation completes (200ms moveSpeed + buffer)
                        const nextPly = this.currentPly + 1;
                        const targetFen = nextData.fen;
                        setTimeout(() => {
                            console.log('[DEBUG stepForward] Timeout fired, updating state to ply:', nextPly);
                            this.currentPly = nextPly;
                            this.safeLoad(targetFen);
                            // Sync board position silently (no animation) in case of any drift
                            this.board.position(targetFen, false);
                            this.updateActiveMove();
                        }, 250);
                    } else {
                        console.log('[DEBUG stepForward] No from/to in move data, using jumpTo');
                        this.jumpTo(this.currentPly + 1);
                    }
                }
            } else {
                console.log('[DEBUG stepForward] End of main line reached');
                this.toggleAutoplay(false);
            }
        }
    }

    stepBack() {
        this.hideVariationChoiceModal();
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

    // --- Stockfish Analysis ---
    toggleAnalysis() {
        this.analysisEnabled = !this.analysisEnabled;
        const btn = document.getElementById('gv2-analysis-btn');
        const evalBar = document.getElementById('gv2-eval-bar');
        const analysisInfo = document.getElementById('gv2-analysis-info');

        if (this.analysisEnabled) {
            btn.classList.add('active');
            evalBar.classList.add('active');
            analysisInfo.style.display = 'flex';

            // Connect and start analysis
            this.analyzer.connect().then(() => {
                this.triggerAnalysis();
            }).catch(err => {
                console.error('[Analysis] Failed to connect:', err);
                this.analysisEnabled = false;
                btn.classList.remove('active');
                evalBar.classList.remove('active');
                analysisInfo.style.display = 'none';
            });
        } else {
            btn.classList.remove('active');
            evalBar.classList.remove('active');
            analysisInfo.style.display = 'none';
            this.analyzer.stopAnalysis();
        }
    }

    triggerAnalysis() {
        if (!this.analysisEnabled) return;

        let currentFen = this.game.fen();

        // Fix: API rejects FEN with EP square if no capture is possible (strict validation)
        // We replace specific EP squares with '-' to be safe, as chess.js generates them aggressively
        const parts = currentFen.split(' ');
        if (parts[3] !== '-') {
            // Simply remove EP target to ensure analysis works (eval difference is negligible for viewing)
            parts[3] = '-';
            currentFen = parts.join(' ');
        }

        this.analyzer.analyze(currentFen);
    }

    handleAnalysisUpdate(data) {
        if (!this.analysisEnabled) return;

        // Prevent race condition: ensure analysis belongs to current position
        // Compare Board + Turn + Castling + En Passant (first 4 fields)
        if (data.fen) {
            const normalizeFen = (fen) => {
                const parts = fen.split(' ');
                // Safe check: analysis request strips EP if useless, so we must be lenient
                // If index 3 is not '-', treat it as '-' for comparison purpose
                // ACTUALLY: Just stripping it blindly like triggerAnalysis does is safest
                if (parts[3] !== '-') parts[3] = '-';
                return parts.slice(0, 4).join(' ');
            };

            const currentBase = normalizeFen(this.game.fen());
            const dataBase = normalizeFen(data.fen);

            if (currentBase !== dataBase) {
                // console.log('Discarding analysis for old/diff position');
                return;
            }
        }

        // Update eval bar
        this.updateEvalBar(data.eval, data.mate, data.winChance);

        // Update best move display
        const bestMoveEl = document.getElementById('gv2-best-move');
        const depthEl = document.getElementById('gv2-depth');

        if (bestMoveEl) {
            let evalHtml = '';
            if (data.mate !== null && data.mate !== undefined) {
                const mVal = data.mate > 0 ? `M${data.mate}` : `M${Math.abs(data.mate)}`;
                evalHtml = `<span class="gv2-eval-tag">${mVal}</span>`;
            } else if (data.eval !== null && data.eval !== undefined) {
                const val = data.eval > 0 ? `+${data.eval.toFixed(1)}` : data.eval.toFixed(1);
                evalHtml = `<span class="gv2-eval-tag">${val}</span>`;
            }

            bestMoveEl.innerHTML = `${evalHtml} Stockfish 17`;
        }

        if (depthEl && data.depth) {
            depthEl.textContent = `Hloubka ${data.depth}`;
        }

        // Display principal variation (PV) with Czech notation and move numbers
        const pvLineEl = document.getElementById('gv2-pv-line');
        if (pvLineEl) {
            // Combine best move + continuation for full PV
            let fullPv = [];
            if (data.uciMove) fullPv.push(data.uciMove);
            if (data.continuation && Array.isArray(data.continuation)) {
                fullPv = fullPv.concat(data.continuation);
            }

            if (fullPv.length > 0) {
                try {
                    const tempGame = new Chess(this.game.fen());
                    const pvMovesFormatted = [];
                    let limit = 8; // Show more moves

                    for (const uciMove of fullPv) {
                        if (limit-- <= 0) break;

                        // Fix: Parse UCI move for chess.js (needs object {from, to, promotion})
                        const from = uciMove.substring(0, 2);
                        const to = uciMove.substring(2, 4);
                        const promotion = uciMove.length > 4 ? uciMove.substring(4, 5) : undefined;

                        const move = tempGame.move({ from, to, promotion }, { sloppy: true });
                        if (!move) break;

                        let san = move.san;

                        // Use figurine notation
                        san = this.formatSan(san);


                        // Move Number Logic
                        // Fix: move_number() might not exist in this chess.js version, use FEN parsing
                        const moveNum = parseInt(tempGame.fen().split(' ').pop());
                        let moveStr = '';

                        if (tempGame.turn() === 'b') { // White just moved
                            moveStr = `${moveNum}. ${san}`;
                        } else { // Black just moved
                            // If Black just moved, the move number in FEN has already incremented.
                            // We want the previous number for the notation (e.g. if now 2, Black played 1... e5)
                            moveStr = pvMovesFormatted.length === 0 ? `${moveNum - 1}... ${san}` : san;
                        }

                        pvMovesFormatted.push(`<span class="gv2-pv-move">${moveStr}</span>`);
                    }

                    pvLineEl.innerHTML = pvMovesFormatted.join(' ');

                } catch (e) {
                    console.error('PV Formatting Error:', e);
                    // Fallback
                    pvLineEl.textContent = data.continuation.slice(0, 6).join(' ');
                }
            } else {
                pvLineEl.innerHTML = '';
            }
        }

        // Store for potential use
        this.lastEval = data;
    }

    updateEvalBar(evaluation, mate, winChance) {
        const evalFill = document.getElementById('gv2-eval-fill');
        const evalText = document.getElementById('gv2-eval-text');

        if (!evalFill || !evalText) return;

        let percentage, displayText;

        if (mate !== null && mate !== undefined) {
            // Mate detected
            displayText = mate > 0 ? `M${mate}` : `M${Math.abs(mate)}`;
            percentage = mate > 0 ? 100 : 0;
            evalFill.classList.add('mate');
        } else if (evaluation !== null && evaluation !== undefined) {
            // Normal evaluation
            displayText = evaluation > 0 ? `+${evaluation.toFixed(1)}` : evaluation.toFixed(1);
            // Use winChance if available, otherwise calculate from eval
            if (winChance !== null && winChance !== undefined) {
                percentage = winChance;
            } else {
                // Sigmoid-like mapping: eval to percentage
                percentage = 50 + 50 * (2 / (1 + Math.exp(-0.4 * evaluation)) - 1);
            }
            evalFill.classList.remove('mate');
        } else {
            displayText = '0.0';
            percentage = 50;
        }

        // Clamp percentage
        percentage = Math.max(0, Math.min(100, percentage));

        evalFill.style.height = `${percentage}%`;
        evalText.textContent = displayText; // Update text
        // Used CSS mix-blend-mode: difference for auto-contrast
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

    updateBoardHighlights(move) {
        if (!this.boardEl) return;
        // Use jQuery if available for Chessboard.js compatibility
        const $board = window.$ ? window.$(this.boardEl) : null;
        if (!$board) return;

        $board.find('.gv2-last-move').removeClass('gv2-last-move');

        if (move) {
            // Try data-square attribute (standard in newer chessboard.js)
            let $from = $board.find(`[data-square="${move.from}"]`);
            let $to = $board.find(`[data-square="${move.to}"]`);

            // Fallback for older versions (class based)
            if ($from.length === 0) $from = $board.find(`.square-${move.from}`);
            if ($to.length === 0) $to = $board.find(`.square-${move.to}`);

            $from.addClass('gv2-last-move');
            $to.addClass('gv2-last-move');
        }
    }

    updateActiveMove() {
        // Highlight last move
        const plyData = this.mainLinePlies && this.mainLinePlies[this.currentPly];
        const lastMove = (plyData && this.currentPly > 0) ? plyData.move : null;
        this.updateBoardHighlights(lastMove);

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

        // Trigger analysis if enabled
        this.triggerAnalysis();
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

            // Title and nav controls stay visible to prevent jumping
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

            // Display overlay

        } else {
            overlay.style.display = 'none';

            // Show "show bubble" button only if there's a comment but it's manually hidden
            if (comment && this.bubbleManuallyHidden) {
                if (showBtn) showBtn.classList.add('visible');
            } else {
                if (showBtn) showBtn.classList.remove('visible');
            }
        }
    }

    // Manually hide bubble (called by close button)
    hideBubble() {
        const overlay = document.querySelector('.gv2-board-overlay');
        const titleEl = document.getElementById('gv2-title');
        const navControls = document.querySelector('.gv2-global-controls');

        if (overlay) overlay.style.display = 'none';
        if (overlay) overlay.style.display = 'none';

        // Don't toggle title or nav controls display


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

    // Hide the variation choice modal
    hideVariationChoiceModal() {
        if (this.activeModalCleanup) {
            this.activeModalCleanup();
            return;
        }

        // Fallback manual cleanup
        const existing = document.getElementById('gv2-var-modal');
        if (existing) {
            existing.remove();
        }
        if (this.variationAutoplayTimeout) {
            clearTimeout(this.variationAutoplayTimeout);
            this.variationAutoplayTimeout = null;
        }
    }

    // Show modal to choose between main line and variations
    // withAutoplayTimeout: if true, auto-select main line after 2s and resume autoplay
    showVariationChoiceModal(mainMove, variations, withAutoplayTimeout = false) {
        // remove existing modal/listeners if any
        if (this.activeModalCleanup) {
            this.activeModalCleanup();
        }

        // Remove existing modal DOM if still present (safety)
        const existing = document.getElementById('gv2-var-modal');
        if (existing) existing.remove();

        // Clear any existing autoplay timeout
        if (this.variationAutoplayTimeout) {
            clearTimeout(this.variationAutoplayTimeout);
            this.variationAutoplayTimeout = null;
        }

        const modal = document.createElement('div');
        modal.id = 'gv2-var-modal';
        modal.className = 'gv2-var-modal';

        // Add countdown indicator if autoplay mode
        const countdownHtml = withAutoplayTimeout
            ? `<div class="gv2-var-countdown" id="gv2-var-countdown">3</div>`
            : '';

        // Helper to get NAG HTML
        const getNagHtml = (nag) => {
            if (!nag) return '';
            const map = { '$1': '!', '$2': '?', '$3': '!!', '$4': '??', '$5': '!?', '$6': '?!' };
            const colorMap = {
                '$1': '#4ade80', '$2': '#ef4444', '$3': '#22c55e', '$4': '#dc2626', '$5': '#60a5fa', '$6': '#fbbf24'
            };
            const symbol = map[nag] || '';
            const color = colorMap[nag] || '#aaa';
            return symbol ? `<span style="color: ${color}; margin-left: 2px;">${symbol}</span>` : '';
        };

        const mainNagCode = this.mainLinePlies[this.currentPly + 1]?.nag;
        const mainNagHtml = getNagHtml(mainNagCode);

        modal.innerHTML = `
            <div class="gv2-var-modal-content">
                ${countdownHtml}
                <button class="gv2-var-choice gv2-var-main" data-action="main">
                    ${this.formatSan(mainMove)}${mainNagHtml}
                </button>
                ${variations.map((v, i) => {
            const varNagHtml = getNagHtml(v.firstMove.nag);
            return `
                    <button class="gv2-var-choice" data-action="var" data-var="${v.varId}" data-fen="${v.firstMove.fen}">
                        ${this.formatSan(v.firstMove.san)}${varNagHtml}
                    </button>
                `}).join('')}
            </div>
        `;

        document.body.appendChild(modal);

        // Cleanup function to remove modal and listeners
        const cleanup = () => {
            modal.remove();
            document.removeEventListener('keydown', keyHandler);
            if (this.variationAutoplayTimeout) {
                clearTimeout(this.variationAutoplayTimeout);
                this.variationAutoplayTimeout = null;
            }
            this.activeModalCleanup = null;
        };

        this.activeModalCleanup = cleanup;

        // Handle clicks
        modal.addEventListener('click', (e) => {
            const btn = e.target.closest('.gv2-var-choice');
            if (!btn) return;

            const action = btn.dataset.action;

            // Set cooldown to prevent modal from being re-shown immediately
            this.modalCooldown = true;
            setTimeout(() => { this.modalCooldown = false; }, 500);

            cleanup();

            if (action === 'main') {
                this.jumpTo(this.currentPly + 1);
            } else if (action === 'var') {
                this.jumpToVariation(btn.dataset.var, btn.dataset.fen);
            }

            // If was in autoplay mode, resume autoplay after user selection
            if (withAutoplayTimeout) {
                setTimeout(() => this.toggleAutoplay(true), 300);
            }
        });

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cleanup();
            }
        });

        // Keyboard handler - only right arrow for main line
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                cleanup();
            } else if (e.key === 'ArrowRight') {
                // Right arrow = main move
                e.preventDefault();
                cleanup();
                this.jumpTo(this.currentPly + 1);
                if (withAutoplayTimeout) {
                    setTimeout(() => this.toggleAutoplay(true), 300);
                }
            }
        };
        document.addEventListener('keydown', keyHandler);

        // If autoplay mode, set 2s timeout to auto-select main line
        if (withAutoplayTimeout) {
            let countdown = 3;
            const countdownEl = document.getElementById('gv2-var-countdown');

            // Update countdown every second
            const countdownInterval = setInterval(() => {
                countdown--;
                if (countdownEl) countdownEl.textContent = countdown;
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                }
            }, 1000);

            this.variationAutoplayTimeout = setTimeout(() => {
                clearInterval(countdownInterval);
                cleanup();

                // Auto-select main line with animation
                const nextData = this.mainLinePlies[this.currentPly + 1];
                if (nextData && nextData.move && nextData.move.from && nextData.move.to) {
                    const moveStr = nextData.move.from + '-' + nextData.move.to;
                    this.board.move(moveStr);
                    const nextPly = this.currentPly + 1;
                    const targetFen = nextData.fen;
                    setTimeout(() => {
                        this.currentPly = nextPly;
                        this.safeLoad(targetFen);
                        this.board.position(targetFen, false);
                        this.updateActiveMove();
                        // Resume autoplay
                        this.toggleAutoplay(true);
                    }, 250);
                } else if (nextData) {
                    this.jumpTo(this.currentPly + 1);
                    this.toggleAutoplay(true);
                }
            }, 3000);
        }
    }

    updateNagMarker() {
        const wrapper = document.querySelector('.gv2-board-wrapper');
        if (!wrapper) return;

        const existing = wrapper.querySelectorAll('.board-nag-marker');
        existing.forEach(el => el.remove());

        let currentData = null;

        if (this.inVariation && this.currentVariation && this.allVariations[this.currentVariation]) {
            // Find move in variation
            const currentFen = this.game.fen();
            const varData = this.allVariations[this.currentVariation];
            // Find the move that RESULTED in the current position
            currentData = varData.moves.find(m => m.fen === currentFen);
        } else if (this.mainLinePlies) {
            currentData = this.mainLinePlies[this.currentPly];
        }

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

// Only create the global instance if one doesn't already exist
// This allows partie.html and other pages to create their own instance first
if (!window.gameViewer2) {
    const gameViewer2 = new GameViewer2();
    window.gameViewer2 = gameViewer2;
}

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
                <div class="gv-viewer-content" style="flex: 1;">
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
                // Check if PGN has comments (text in {} brackets)
                const hasComments = game.pgn.includes('{');
                if (hasComments) {
                    titleHtml += '<i class="fa-solid fa-comment" style="color: #60a5fa; font-size:0.8em; margin-left:auto;" title="Komentovaná partie"></i>';
                } else {
                    titleHtml += '<i class="fa-solid fa-chess-board" style="opacity:0.5; font-size:0.8em; margin-left:auto;"></i>';
                }
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

            // Scroll active item into view - ONLY ON DESKTOP
            // On mobile, the list is effectively below the viewer, so scrolling to it
            // causes the page to jump down, hiding the board.
            if (isActive && window.innerWidth > 768) {
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }
};
