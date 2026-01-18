/**
 * Chess Database - 3 Column Layout with Synchronized Tree
 */

const ChessDB = {
    API_URL: '/api/chess',
    currentPlayer: null,
    currentColor: 'both',
    currentSort: 'date_desc', // date_desc, date_asc, eco_asc
    currentPage: 0,
    pageSize: 30,
    totalGames: 0,
    debounceTimer: null,

    // Game viewer state
    currentGame: null,
    currentMoveIndex: 0,
    moves: [],
    board: null,
    chessGame: null, // chess.js instance

    // Opening tree state
    treeData: null,

    // Autoplay state
    autoplayInterval: null,

    // Engine analysis
    analyzer: null,
    analysisEnabled: true,
    lastAnalysis: null,

    getToken() {
        return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    },

    async checkAccess() {
        const token = this.getToken();
        if (!token) {
            this.showAccessDenied();
            return false;
        }

        try {
            const response = await fetch(`${this.API_URL}/games?limit=1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                this.showAccessDenied();
                return false;
            }

            if (response.ok) {
                const data = await response.json();
                document.getElementById('dbStats').textContent = `${data.total?.toLocaleString() || 0} partií`;
                this.showMainContent();
                return true;
            }
        } catch (e) {
            console.error('Access check failed:', e);
        }

        this.showAccessDenied();
        return false;
    },

    showAccessDenied() {
        document.getElementById('accessDenied').classList.remove('hidden');
        document.getElementById('mainContent').classList.add('hidden');
    },

    showMainContent() {
        document.getElementById('accessDenied').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        document.getElementById('mainContent').style.display = 'flex';
    },

    async init() {
        const hasAccess = await this.checkAccess();
        if (!hasAccess) return;
        this.bindEvents();

        // Restore player from URL if present
        const urlParams = new URLSearchParams(window.location.search);
        const playerFromUrl = urlParams.get('player');
        if (playerFromUrl) {
            this.selectPlayer(playerFromUrl);
        }
    },

    bindEvents() {
        // Search
        const searchInput = document.getElementById('playerSearch');
        searchInput.addEventListener('input', () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.handleSearch(searchInput.value), 300);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-input-wrapper')) {
                document.getElementById('autocompleteResults').style.display = 'none';
            }
        });

        // Resize board on window resize
        window.addEventListener('resize', () => {
            this.fixMobileBoardHeight();
        });

        // Color filters
        document.querySelectorAll('.filter-btn[data-color]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn[data-color]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentColor = btn.dataset.color;
                if (this.currentPlayer) {
                    this.currentPage = 0;
                    this.loadGames();
                    this.loadOpeningTree();
                }
            });
        });

        // Sort
        document.getElementById('gameSort').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            if (this.currentPlayer) {
                this.currentPage = 0;
                this.loadGames();
            }
        });

        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => {
            if (this.currentPage > 0) { this.currentPage--; this.loadGames(); }
        });
        document.getElementById('nextPage').addEventListener('click', () => {
            if ((this.currentPage + 1) * this.pageSize < this.totalGames) { this.currentPage++; this.loadGames(); }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!this.currentGame) return;
            if (e.key === 'ArrowLeft') this.prevMove();
            if (e.key === 'ArrowRight') this.nextMove();
        });
    },

    // ==================== SEARCH ====================
    async handleSearch(query) {
        const resultsDiv = document.getElementById('autocompleteResults');
        if (query.length < 2) { resultsDiv.style.display = 'none'; return; }

        const token = this.getToken();
        try {
            const response = await fetch(`${this.API_URL}/players?q=${encodeURIComponent(query)}&limit=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Search failed');
            const players = await response.json();

            if (players.length === 0) {
                resultsDiv.innerHTML = '<div class="autocomplete-item"><span style="color: var(--text-muted);">Žádný hráč</span></div>';
            } else {
                resultsDiv.innerHTML = players.map(p => `
                    <div class="autocomplete-item" onclick="ChessDB.selectPlayer('${p.name.replace(/'/g, "\\'")}')">
                        <span>${p.name}</span>
                        <span style="color: var(--text-muted);">${p.totalGames}</span>
                    </div>
                `).join('');
            }
            resultsDiv.style.display = 'block';
        } catch (e) { console.error('Search error:', e); }
    },

    async selectPlayer(name) {
        this.currentPlayer = name;
        this.currentPage = 0;
        document.getElementById('playerSearch').value = name;
        document.getElementById('autocompleteResults').style.display = 'none';

        // Update URL with player name for persistence
        const url = new URL(window.location);
        url.searchParams.set('player', name);
        window.history.replaceState({}, '', url);

        await Promise.all([this.loadGames(), this.loadOpeningTree()]);
    },

    // ==================== GAMES LIST ====================
    async loadGames() {
        const listDiv = document.getElementById('gamesList');
        listDiv.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner"></i></div>';

        const token = this.getToken();
        const params = new URLSearchParams({
            player: this.currentPlayer,
            color: this.currentColor,
            sort: this.currentSort,
            limit: this.pageSize,
            offset: this.currentPage * this.pageSize
        });

        try {
            const response = await fetch(`${this.API_URL}/games?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed');
            const data = await response.json();
            this.totalGames = data.total;

            document.getElementById('gamesCount').textContent = data.total;

            if (data.games.length === 0) {
                listDiv.innerHTML = '<div class="empty-state"><p>Žádné partie</p></div>';
                document.getElementById('pagination').classList.add('hidden');
                return;
            }

            listDiv.innerHTML = data.games.map(g => this.renderGameRow(g)).join('');

            const totalPages = Math.ceil(this.totalGames / this.pageSize);
            document.getElementById('pageInfo').textContent = `${this.currentPage + 1}/${totalPages}`;
            document.getElementById('prevPage').disabled = this.currentPage === 0;
            document.getElementById('nextPage').disabled = (this.currentPage + 1) >= totalPages;
            document.getElementById('pagination').classList.remove('hidden');
        } catch (e) {
            console.error('Load games error:', e);
            listDiv.innerHTML = '<div class="empty-state"><p>Chyba</p></div>';
        }
    },

    renderGameRow(g) {
        const date = g.date ? new Date(g.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: '2-digit' }) : '';
        let resultClass = 'draw';
        if (g.result === '1-0') resultClass = 'white-win';
        else if (g.result === '0-1') resultClass = 'black-win';

        return `
            <div class="game-row" data-id="${g.id}" onclick="ChessDB.openGame(${g.id})">
                <div class="game-meta">${date} ${g.eco || ''}</div>
                <div class="game-players-line">
                    <span class="player-color white"></span>
                    <span>${g.whitePlayer}</span>
                    <span class="game-result-badge ${resultClass}">${g.result}</span>
                </div>
                <div class="game-players-line">
                    <span class="player-color black"></span>
                    <span>${g.blackPlayer}</span>
                </div>
            </div>
        `;
    },

    // ==================== GAME VIEWER ====================
    async openGame(id, targetMoveIndex = 0) {
        // Mark active
        document.querySelectorAll('.game-row').forEach(r => r.classList.remove('active'));
        document.querySelector(`.game-row[data-id="${id}"]`)?.classList.add('active');

        const content = document.getElementById('gameContent');
        content.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner"></i></div>';

        const token = this.getToken();
        try {
            const response = await fetch(`${this.API_URL}/games/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed');
            const game = await response.json();

            this.currentGame = game;
            this.moves = game.moves ? game.moves.split(' ').filter(m => m) : [];
            this.currentMoveIndex = targetMoveIndex;

            // Auto-switch tree color to match the game perspective
            if (this.currentPlayer) {
                const searchName = this.currentPlayer.toLowerCase();
                const whiteName = (game.whitePlayer || '').toLowerCase();
                const blackName = (game.blackPlayer || '').toLowerCase();

                let detectedColor = null;
                // Check exact matches or inclusion
                if (whiteName.includes(searchName)) detectedColor = 'white';
                else if (blackName.includes(searchName)) detectedColor = 'black';

                // If we found a color and it differs from current (except if current is 'both' maybe? No, be specific)
                if (detectedColor && detectedColor !== this.currentColor) {
                    this.currentColor = detectedColor;

                    // Update UI buttons
                    document.querySelectorAll('.filter-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.color === detectedColor);
                    });

                    // Reload tree
                    await this.loadOpeningTree();
                }
            }

            // Initialize chess.js
            this.chessGame = new Chess();

            this.renderGameViewer(game, targetMoveIndex);
            document.getElementById('gameTitle').textContent = `${game.whitePlayer} - ${game.blackPlayer}`;

            // Update tree to starting position
            this.updateTreeForPosition();
        } catch (e) {
            console.error('Open game error:', e);
            content.innerHTML = '<div class="empty-state"><p>Chyba</p></div>';
        }
    },

    renderGameViewer(game, targetMoveIndex = 0) {
        const content = document.getElementById('gameContent');
        const date = game.date ? new Date(game.date).toLocaleDateString('cs-CZ') : '—';

        content.innerHTML = `
            <div class="game-info">
                <h3>${game.whitePlayer} vs ${game.blackPlayer}</h3>
                <div class="game-info-meta">
                    ${game.event || ''} • ${date} • ${game.eco || ''} • <strong>${game.result}</strong>
                </div>
            </div>
            <div class="board-area">
                <div class="board-wrapper" style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <!-- Board + Eval Bar Row -->
                        <div style="display: flex; gap: 0; align-items: stretch;" class="gv2-board-area-inner">
                            <!-- Eval Bar (vertical thermometer) - Initially hidden -->
                            <div id="dbEvalBar" class="gv2-eval-bar" style="display: none;">
                                <div class="gv2-eval-fill" id="dbEvalFill" style="height: 50%;"></div>
                                <span class="gv2-eval-text" id="dbEvalText">0.0</span>
                            </div>
                            <div id="chessBoard" style="flex: 1; width: 100%; aspect-ratio: 1/1;"></div>
                        </div>
                    <!-- Analysis Info - Initially hidden -->
                    <div id="dbAnalysisInfo" class="gv2-analysis-info" style="display: none;">
                        <span class="gv2-best-move" id="dbBestMove">—</span>
                        <div class="gv2-pv-line" id="dbPvLine"></div>
                    </div>
                    <div class="board-controls">
                        <button onclick="ChessDB.goToStart()" title="Na začátek"><i class="fa-solid fa-backward-fast"></i></button>
                        <button onclick="ChessDB.prevMove()" title="Předchozí"><i class="fa-solid fa-chevron-left"></i></button>
                        <button id="autoplayBtn" onclick="ChessDB.toggleAutoplay()" title="Autoplay"><i class="fa-solid fa-play"></i></button>
                        <button onclick="ChessDB.nextMove()" title="Další"><i class="fa-solid fa-chevron-right"></i></button>
                        <button onclick="ChessDB.goToEnd()" title="Na konec"><i class="fa-solid fa-forward-fast"></i></button>
                        <button id="engineBtnBottom" onclick="ChessDB.toggleEngine()" title="Engine" style="color: var(--text-muted);"><i class="fa-solid fa-microchip"></i></button>
                    </div>
                </div>
                <div class="moves-wrapper" id="movesPanel" style="max-height: 250px; overflow-y: auto;">
                    ${this.renderMovesList()}
                </div>
            </div>
        `;

        this.initBoard(targetMoveIndex);
        this.initAnalyzer();
    },

    initBoard(targetMoveIndex = 0) {
        if (this.board) {
            this.board.destroy();
        }

        this.board = Chessboard('chessBoard', {
            position: 'start',
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        });

        this.currentMoveIndex = targetMoveIndex;
        this.chessGame = new Chess();
        this.updateBoardPosition();

        // Force resize after short delay to ensure correct rendering on mobile
        // Fix for "small initial container" issue
        setTimeout(() => this.fixMobileBoardHeight(), 50);
        setTimeout(() => this.fixMobileBoardHeight(), 300);
    },

    fixMobileBoardHeight() {
        const boardEl = document.getElementById('chessBoard');
        if (!boardEl) return;

        // Simply trigger resize, trust CSS for dimensions
        if (this.board) this.board.resize();
    },

    renderMovesList() {
        if (this.moves.length === 0) return '<p style="color: var(--text-muted);">Žádné tahy</p>';

        let html = '';
        for (let i = 0; i < this.moves.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const whiteMove = this.moves[i] || '';
            const blackMove = this.moves[i + 1] || '';

            html += `<div class="move-pair">
                <span class="move-number">${moveNum}.</span>
                <span class="move ${this.currentMoveIndex === i + 1 ? 'active' : ''}" onclick="ChessDB.goToMove(${i + 1})">${whiteMove}</span>
                <span class="move ${this.currentMoveIndex === i + 2 ? 'active' : ''}" onclick="ChessDB.goToMove(${i + 2})">${blackMove}</span>
            </div>`;
        }
        return html;
    },

    updateBoardPosition() {
        const targetIdx = this.currentMoveIndex;

        // Ensure chessGame exists
        if (!this.chessGame) this.chessGame = new Chess();

        const currentIdx = this.chessGame.history().length;

        // Optimization: Use incremental updates instead of full replay
        try {
            if (currentIdx < targetIdx) {
                // Forward: Apply missing moves
                for (let i = currentIdx; i < targetIdx; i++) {
                    this.chessGame.move(this.moves[i]);
                }
            } else if (currentIdx > targetIdx) {
                // Backward: Undo moves or reset if too far
                if (currentIdx - targetIdx > 20) {
                    // If backtracking a lot, faster to reset
                    this.chessGame = new Chess();
                    for (let i = 0; i < targetIdx; i++) this.chessGame.move(this.moves[i]);
                } else {
                    while (this.chessGame.history().length > targetIdx) {
                        this.chessGame.undo();
                    }
                }
            }
        } catch (e) {
            console.warn('Move error, resetting board:', e);
            // Fallback to full reset on error
            this.chessGame = new Chess();
            for (let i = 0; i < targetIdx && i < this.moves.length; i++) {
                try { this.chessGame.move(this.moves[i]); } catch (_) { }
            }
        }

        if (this.board) {
            this.board.position(this.chessGame.fen());
        }

        // Update moves highlight
        const movesPanel = document.getElementById('movesPanel');
        if (movesPanel) {
            movesPanel.innerHTML = this.renderMovesList();
            // Scroll to active move - only within the container, not the page
            const activeMove = movesPanel.querySelector('.move.active');
            if (activeMove) {
                const containerRect = movesPanel.getBoundingClientRect();
                const moveRect = activeMove.getBoundingClientRect();
                const scrollOffset = moveRect.top - containerRect.top - (containerRect.height / 2);
                movesPanel.scrollTop += scrollOffset;
            }
        }

        // Sync tree to current position
        this.updateTreeForPosition();

        // Trigger engine analysis for new position
        this.triggerAnalysis();
    },

    goToMove(idx) {
        this.currentMoveIndex = Math.max(0, Math.min(idx, this.moves.length));
        this.updateBoardPosition();
    },

    prevMove() {
        if (this.currentMoveIndex > 0) {
            this.currentMoveIndex--;
            this.updateBoardPosition();
        }
    },

    nextMove() {
        if (this.currentMoveIndex < this.moves.length) {
            this.currentMoveIndex++;
            this.updateBoardPosition();
        }
    },

    goToStart() {
        this.currentMoveIndex = 0;
        this.updateBoardPosition();
    },

    goToEnd() {
        this.currentMoveIndex = this.moves.length;
        this.updateBoardPosition();
        this.stopAutoplay();
    },

    toggleAutoplay() {
        if (this.autoplayInterval) {
            this.stopAutoplay();
        } else {
            this.startAutoplay();
        }
    },

    startAutoplay() {
        if (this.currentMoveIndex >= this.moves.length) {
            this.goToStart();
        }

        const btn = document.getElementById('autoplayBtn');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i>';

        this.autoplayInterval = setInterval(() => {
            if (this.currentMoveIndex < this.moves.length) {
                this.currentMoveIndex++;
                this.updateBoardPosition();
            } else {
                this.stopAutoplay();
            }
        }, 1000);
    },

    stopAutoplay() {
        if (this.autoplayInterval) {
            clearInterval(this.autoplayInterval);
            this.autoplayInterval = null;
        }
        const btn = document.getElementById('autoplayBtn');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i>';
    },

    // ==================== OPENING TREE ====================
    async loadOpeningTree() {
        const content = document.getElementById('treeContent');
        content.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner"></i></div>';

        const token = this.getToken();
        const color = this.currentColor === 'both' ? 'white' : this.currentColor;

        try {
            const response = await fetch(`${this.API_URL}/tree?player=${encodeURIComponent(this.currentPlayer)}&color=${color}&depth=15`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed');
            const data = await response.json();

            this.treeData = data;
            this.updateTreeForPosition();
        } catch (e) {
            console.error('Load tree error:', e);
            content.innerHTML = '<div class="empty-state"><p>Chyba</p></div>';
        }
    },

    updateTreeForPosition() {
        if (!this.treeData || !this.treeData.tree) {
            return;
        }

        const content = document.getElementById('treeContent');
        const color = this.currentColor === 'both' ? 'white' : this.currentColor;
        const colorLabel = color === 'white' ? 'bílým' : 'černým';

        // Navigate tree to current position
        let currentNode = this.treeData.tree;
        const movesPlayed = this.moves.slice(0, this.currentMoveIndex);

        for (const move of movesPlayed) {
            if (currentNode.children) {
                const child = currentNode.children.find(c => c.move === move);
                if (child) {
                    currentNode = child;
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        // Get next moves from this position
        const nextMoves = currentNode.children || [];

        if (nextMoves.length === 0) {
            content.innerHTML = `
                <div class="tree-position">
                    <strong>${this.currentPlayer}</strong> (${colorLabel})<br>
                    Pozice: ${movesPlayed.length > 0 ? movesPlayed.join(' ') : 'Startovní'}
                </div>
                <div class="empty-state" style="padding: 1rem;">
                    <p>Žádná data pro tuto pozici</p>
                </div>
            `;
            return;
        }

        // Sort by games
        const sorted = [...nextMoves].sort((a, b) => b.games - a.games);

        // Get recent games from current position node
        const recentGames = currentNode.recentGames || [];

        // Find next move in current game (for highlighting)
        const nextMoveInGame = this.currentGame ? this.moves[this.currentMoveIndex] : null;

        content.innerHTML = `
            <div class="tree-position">
                <strong>${this.currentPlayer}</strong> (${colorLabel})<br>
                Pozice: ${movesPlayed.length > 0 ? movesPlayed.join(' ') : 'Startovní'}
            </div>
            <div class="tree-moves">
                ${sorted.slice(0, 10).map(node => {
            const winPct = node.games > 0 ? (node.wins / node.games * 100) : 0;
            const drawPct = node.games > 0 ? (node.draws / node.games * 100) : 0;
            const drawEnd = winPct + drawPct;
            const score = node.games > 0 ? ((node.wins + node.draws * 0.5) / node.games * 100).toFixed(0) : 0;
            const isActive = node.move === nextMoveInGame;
            const recentGameId = node.recentGames && node.recentGames.length > 0 ? node.recentGames[0].id : null;

            return `
                        <div class="tree-node ${isActive ? 'active' : ''}" onclick="ChessDB.playTreeMove('${node.move}', ${recentGameId})">
                            <span class="tree-move">${node.move}</span>
                            <div class="tree-bar" style="--win-pct: ${winPct}%; --draw-end: ${drawEnd}%;"></div>
                            <span class="tree-games">${node.games}</span>
                            <span class="tree-pct">${score}%</span>
                        </div>
                    `;
        }).join('')}
            </div>
            ${recentGames.length > 0 ? `
                <div class="tree-recent" style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-clock"></i> Nedávné partie v této pozici
                    </div>
                    ${recentGames.map(g => {
            const date = g.date ? new Date(g.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: '2-digit' }) : '';
            return `
                            <div class="recent-game" onclick="ChessDB.openGame(${g.id})" style="padding: 0.4rem 0.5rem; background: rgba(0,0,0,0.2); border-radius: 4px; margin-bottom: 0.3rem; cursor: pointer; font-size: 0.75rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span>${g.white} - ${g.black}</span>
                                    <span style="color: var(--primary-color);">${g.result}</span>
                                </div>
                                <div style="color: var(--text-muted); font-size: 0.65rem;">${date}</div>
                            </div>
                        `;
        }).join('')}
                </div>
            ` : ''}
        `;
    },

    playTreeMove(move, gameId) {
        // If this move matches the next move in current game, just advance
        if (this.currentGame && this.moves[this.currentMoveIndex] === move) {
            this.nextMove();
            return;
        }

        // Otherwise, open the game with this move (target index = current + 1)
        if (gameId) {
            this.openGame(gameId, this.currentMoveIndex + 1);
        }
    },

    // ==================== ENGINE ANALYSIS ====================
    initAnalyzer() {
        if (this.analyzer) return; // Already initialized

        if (typeof ChessAnalyzer !== 'undefined') {
            this.analyzer = new ChessAnalyzer((data) => this.handleAnalysisUpdate(data));
            console.log('[ChessDB] Engine analyzer initialized');

            // Trigger initial analysis
            if (this.analysisEnabled && this.chessGame) {
                this.triggerAnalysis();
            }
        } else {
            console.warn('[ChessDB] ChessAnalyzer not available');
        }
    },

    handleAnalysisUpdate(data) {
        if (!data || !this.chessGame) return;

        // Verify FEN matches current position
        const currentFen = this.chessGame.fen().split(' ').slice(0, 4).join(' ');
        const dataFen = (data.fen || '').split(' ').slice(0, 4).join(' ');

        if (currentFen !== dataFen) return;

        this.lastAnalysis = data;

        // Use global utility
        if (typeof ChessEvalDisplay !== 'undefined') {
            ChessEvalDisplay.update('db', data);
        }
    },

    toggleEngine() {
        this.analysisEnabled = !this.analysisEnabled;

        const btn = document.getElementById('engineToggle');
        const evalBar = document.getElementById('dbEvalBar');
        const analysisInfo = document.getElementById('dbAnalysisInfo');

        if (btn) {
            btn.style.background = this.analysisEnabled ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255,255,255,0.05)';
            btn.style.borderColor = this.analysisEnabled ? '#4ade80' : 'rgba(255,255,255,0.1)';
            btn.style.color = this.analysisEnabled ? '#4ade80' : 'var(--text-muted)';
        }

        const btnBottom = document.getElementById('engineBtnBottom');
        if (btnBottom) {
            btnBottom.style.color = this.analysisEnabled ? '#4ade80' : 'var(--text-muted)';
            // Optional: add background/border if supported by board-controls styles
        }

        // Show/hide eval bar and analysis info
        if (evalBar) evalBar.style.display = this.analysisEnabled ? '' : 'none';
        if (analysisInfo) analysisInfo.style.display = this.analysisEnabled ? '' : 'none';

        if (this.analysisEnabled) {
            this.triggerAnalysis();
        } else {
            // Use global utility to clear
            if (typeof ChessEvalDisplay !== 'undefined') {
                ChessEvalDisplay.clear('db');
            }
        }
    },

    triggerAnalysis() {
        if (!this.analysisEnabled || !this.chessGame || !this.analyzer) return;

        const fen = this.chessGame.fen();
        this.analyzer.analyze(fen);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => ChessDB.init());

