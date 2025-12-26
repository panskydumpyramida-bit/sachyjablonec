/**
 * Chess Database - 3 Column Layout with Synchronized Tree
 */

const ChessDB = {
    API_URL: '/api/chess',
    currentPlayer: null,
    currentColor: 'both',
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
    async openGame(id) {
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
            this.currentMoveIndex = 0;

            // Initialize chess.js
            this.chessGame = new Chess();

            this.renderGameViewer(game);
            document.getElementById('gameTitle').textContent = `${game.whitePlayer} - ${game.blackPlayer}`;

            // Update tree to starting position
            this.updateTreeForPosition();
        } catch (e) {
            console.error('Open game error:', e);
            content.innerHTML = '<div class="empty-state"><p>Chyba</p></div>';
        }
    },

    renderGameViewer(game) {
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
                <div class="board-wrapper">
                    <div id="chessBoard"></div>
                    <div class="board-controls">
                        <button onclick="ChessDB.goToStart()" title="Na začátek"><i class="fa-solid fa-backward-fast"></i></button>
                        <button onclick="ChessDB.prevMove()" title="Předchozí"><i class="fa-solid fa-chevron-left"></i></button>
                        <button onclick="ChessDB.nextMove()" title="Další"><i class="fa-solid fa-chevron-right"></i></button>
                        <button onclick="ChessDB.goToEnd()" title="Na konec"><i class="fa-solid fa-forward-fast"></i></button>
                    </div>
                </div>
                <div class="moves-wrapper" id="movesPanel">
                    ${this.renderMovesList()}
                </div>
            </div>
        `;

        this.initBoard();
    },

    initBoard() {
        if (this.board) {
            this.board.destroy();
        }

        this.board = Chessboard('chessBoard', {
            position: 'start',
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        });

        this.currentMoveIndex = 0;
        this.chessGame = new Chess();
        this.updateBoardPosition();
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
        // Reset chess.js and replay moves up to currentMoveIndex
        this.chessGame = new Chess();
        for (let i = 0; i < this.currentMoveIndex && i < this.moves.length; i++) {
            try {
                this.chessGame.move(this.moves[i]);
            } catch (e) {
                console.warn('Invalid move:', this.moves[i]);
            }
        }

        if (this.board) {
            this.board.position(this.chessGame.fen());
        }

        // Update moves highlight
        const movesPanel = document.getElementById('movesPanel');
        if (movesPanel) {
            movesPanel.innerHTML = this.renderMovesList();
        }

        // Sync tree to current position
        this.updateTreeForPosition();
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
        // If we have a game ID, open that game
        if (gameId) {
            this.openGame(gameId);
        } else {
            // Fallback: if current game's next move matches, just advance
            if (this.currentGame && this.moves[this.currentMoveIndex] === move) {
                this.nextMove();
            }
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => ChessDB.init());
