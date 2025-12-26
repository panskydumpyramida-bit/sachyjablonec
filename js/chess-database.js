/**
 * Chess Database Frontend with Game Viewer and Opening Tree
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

    // Opening tree state
    treeData: null,

    getToken() {
        return localStorage.getItem('authToken');
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

        // Tabs
        document.querySelectorAll('.detail-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`tab${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`).classList.add('active');
            });
        });

        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => {
            if (this.currentPage > 0) { this.currentPage--; this.loadGames(); }
        });
        document.getElementById('nextPage').addEventListener('click', () => {
            if ((this.currentPage + 1) * this.pageSize < this.totalGames) { this.currentPage++; this.loadGames(); }
        });

        // Keyboard navigation for board
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
                        <span style="color: var(--text-muted); font-size: 0.85rem;">${p.totalGames} partií</span>
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

            document.getElementById('gamesCount').textContent = `${data.total} partií`;

            if (data.games.length === 0) {
                listDiv.innerHTML = '<div class="empty-state"><p>Žádné partie</p></div>';
                document.getElementById('pagination').classList.add('hidden');
                return;
            }

            listDiv.innerHTML = data.games.map(g => this.renderGameRow(g)).join('');

            // Pagination
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
                    ${g.whiteElo ? `<small style="color:var(--text-muted)">(${g.whiteElo})</small>` : ''}
                </div>
                <div class="game-players-line">
                    <span class="player-color black"></span>
                    <span>${g.blackPlayer}</span>
                    ${g.blackElo ? `<small style="color:var(--text-muted)">(${g.blackElo})</small>` : ''}
                    <span class="game-result-badge ${resultClass}">${g.result}</span>
                </div>
            </div>
        `;
    },

    // ==================== GAME VIEWER ====================
    async openGame(id) {
        // Mark active
        document.querySelectorAll('.game-row').forEach(r => r.classList.remove('active'));
        document.querySelector(`.game-row[data-id="${id}"]`)?.classList.add('active');

        const content = document.getElementById('gameViewerContent');
        content.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner"></i></div>';

        // Switch to game tab
        document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector('.detail-tab[data-tab="game"]').classList.add('active');
        document.getElementById('tabGame').classList.add('active');

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

            this.renderGameViewer(game);
            this.renderPgnTab(game);
        } catch (e) {
            console.error('Open game error:', e);
            content.innerHTML = '<div class="empty-state"><p>Chyba</p></div>';
        }
    },

    renderGameViewer(game) {
        const content = document.getElementById('gameViewerContent');
        const date = game.date ? new Date(game.date).toLocaleDateString('cs-CZ') : '—';

        content.innerHTML = `
            <div style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <h3 style="margin: 0 0 0.5rem;">${game.whitePlayer} vs ${game.blackPlayer}</h3>
                <div style="color: var(--text-muted); font-size: 0.85rem;">
                    ${game.event || ''} • ${date} • ${game.eco || ''} • <strong>${game.result}</strong>
                </div>
            </div>
            <div class="game-viewer-layout">
                <div>
                    <div class="board-container">
                        <div id="chessBoard"></div>
                    </div>
                    <div class="board-controls">
                        <button onclick="ChessDB.goToStart()" title="Na začátek"><i class="fa-solid fa-backward-fast"></i></button>
                        <button onclick="ChessDB.prevMove()" title="Předchozí"><i class="fa-solid fa-chevron-left"></i></button>
                        <button onclick="ChessDB.nextMove()" title="Další"><i class="fa-solid fa-chevron-right"></i></button>
                        <button onclick="ChessDB.goToEnd()" title="Na konec"><i class="fa-solid fa-forward-fast"></i></button>
                    </div>
                </div>
                <div class="moves-panel" id="movesPanel">
                    ${this.renderMovesList()}
                </div>
            </div>
        `;

        // Initialize board
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

        // Start position
        this.currentMoveIndex = 0;
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
        // Simple FEN calculation using chess.js logic (if available) or just show start
        // For now, we'll use a simplified approach
        const position = this.calculatePosition(this.currentMoveIndex);
        if (this.board) {
            this.board.position(position);
        }

        // Update moves highlight
        document.getElementById('movesPanel').innerHTML = this.renderMovesList();
    },

    calculatePosition(moveIndex) {
        // Create a simple chess game simulation
        // In production, use chess.js for proper move validation
        if (moveIndex === 0) return 'start';

        // For demo, we'll use chessboard's position method with FEN
        // This is a simplified version - ideally use chess.js
        try {
            if (typeof Chess !== 'undefined') {
                const game = new Chess();
                for (let i = 0; i < moveIndex && i < this.moves.length; i++) {
                    game.move(this.moves[i]);
                }
                return game.fen();
            }
        } catch (e) {
            console.warn('Chess.js not available, showing start position');
        }

        return 'start';
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

    // ==================== PGN TAB ====================
    renderPgnTab(game) {
        const content = document.getElementById('pgnContent');
        content.innerHTML = `
            <textarea readonly>${game.pgn || 'PGN není k dispozici'}</textarea>
            <button onclick="ChessDB.copyPgn()" style="margin-top: 1rem; padding: 0.6rem 1.2rem; background: var(--primary-color); color: var(--secondary-color); border: none; border-radius: 6px; cursor: pointer;">
                <i class="fa-solid fa-copy"></i> Kopírovat PGN
            </button>
        `;
    },

    copyPgn() {
        const textarea = document.querySelector('#pgnContent textarea');
        navigator.clipboard.writeText(textarea.value);
        const btn = document.querySelector('#pgnContent button');
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Zkopírováno!';
        setTimeout(() => btn.innerHTML = '<i class="fa-solid fa-copy"></i> Kopírovat PGN', 2000);
    },

    // ==================== OPENING TREE ====================
    async loadOpeningTree() {
        const content = document.getElementById('treeContent');
        content.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner"></i></div>';

        const token = this.getToken();
        const color = this.currentColor === 'both' ? 'white' : this.currentColor;

        try {
            const response = await fetch(`${this.API_URL}/tree?player=${encodeURIComponent(this.currentPlayer)}&color=${color}&depth=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed');
            const data = await response.json();

            this.treeData = data;
            this.renderOpeningTree(data.tree, color);
        } catch (e) {
            console.error('Load tree error:', e);
            content.innerHTML = '<div class="empty-state"><p>Chyba</p></div>';
        }
    },

    renderOpeningTree(tree, color) {
        const content = document.getElementById('treeContent');

        if (!tree.children || tree.children.length === 0) {
            content.innerHTML = '<div class="empty-state"><p>Nedostatek dat pro strom</p></div>';
            return;
        }

        const colorLabel = color === 'white' ? 'bílým' : 'černým';

        content.innerHTML = `
            <div class="tree-header">
                <h3 style="margin: 0 0 0.5rem;"><i class="fa-solid fa-sitemap"></i> Strom zahájení</h3>
                <p style="color: var(--text-muted); margin: 0;">Hráč: <strong>${this.currentPlayer}</strong> (${colorLabel}) • ${this.treeData.totalGames} partií</p>
            </div>
            <div class="tree-moves" id="treeMoves">
                ${this.renderTreeLevel(tree.children)}
            </div>
        `;
    },

    renderTreeLevel(nodes, depth = 0) {
        if (!nodes || nodes.length === 0) return '';

        // Sort by games descending
        const sorted = [...nodes].sort((a, b) => b.games - a.games);

        return sorted.slice(0, 8).map(node => {
            const winPct = node.games > 0 ? (node.wins / node.games * 100) : 0;
            const drawPct = node.games > 0 ? (node.draws / node.games * 100) : 0;
            const drawEnd = winPct + drawPct;
            const score = node.games > 0 ? ((node.wins + node.draws * 0.5) / node.games * 100).toFixed(1) : 0;

            return `
                <div class="tree-node" style="margin-left: ${depth * 1.5}rem;" onclick="ChessDB.expandTreeNode(this, '${node.move}')">
                    <span class="tree-move">${node.move}</span>
                    <div class="tree-bar" style="--win-pct: ${winPct}%; --draw-end: ${drawEnd}%;"></div>
                    <span class="tree-games">${node.games}</span>
                    <span class="tree-pct">${score}%</span>
                </div>
            `;
        }).join('');
    },

    expandTreeNode(el, move) {
        // Future: drill down into tree
        console.log('Expand:', move);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => ChessDB.init());
