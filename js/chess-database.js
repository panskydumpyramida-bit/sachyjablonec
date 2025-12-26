/**
 * Chess Database Frontend
 * Provides search, filtering, and game viewing for the chess database
 */

const ChessDB = {
    API_URL: '/api/chess',
    currentPlayer: null,
    currentColor: 'both',
    currentPage: 0,
    pageSize: 25,
    totalGames: 0,
    debounceTimer: null,

    /**
     * Get auth token (OAuth only)
     */
    getToken() {
        return localStorage.getItem('authToken');
    },

    /**
     * Check if user is authenticated with MEMBER+ role
     */
    async checkAccess() {
        const token = this.getToken();

        if (!token) {
            this.showAccessDenied();
            return false;
        }

        try {
            // Try to fetch a simple endpoint to verify access
            const response = await fetch(`${this.API_URL}/games?limit=1`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                this.showAccessDenied();
                return false;
            }

            if (response.ok) {
                const data = await response.json();
                document.getElementById('totalGamesCount').textContent = data.total?.toLocaleString() || '0';
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
    },

    /**
     * Initialize the chess database UI
     */
    async init() {
        const hasAccess = await this.checkAccess();
        if (!hasAccess) return;

        this.bindEvents();
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Search input with debounce
        const searchInput = document.getElementById('playerSearch');
        searchInput.addEventListener('input', () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.handleSearch(searchInput.value);
            }, 300);
        });

        // Hide autocomplete when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-input-wrapper')) {
                document.getElementById('autocompleteResults').style.display = 'none';
            }
        });

        // Color filter buttons
        document.querySelectorAll('.filter-btn[data-color]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn[data-color]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentColor = btn.dataset.color;
                if (this.currentPlayer) {
                    this.currentPage = 0;
                    this.loadGames();
                }
            });
        });

        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => {
            if (this.currentPage > 0) {
                this.currentPage--;
                this.loadGames();
            }
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            if ((this.currentPage + 1) * this.pageSize < this.totalGames) {
                this.currentPage++;
                this.loadGames();
            }
        });

        // Close modal on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeGameModal();
            }
        });
    },

    /**
     * Handle search input - show autocomplete
     */
    async handleSearch(query) {
        const resultsDiv = document.getElementById('autocompleteResults');

        if (query.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }

        const token = this.getToken();
        try {
            const response = await fetch(`${this.API_URL}/players?q=${encodeURIComponent(query)}&limit=10`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Search failed');

            const players = await response.json();

            if (players.length === 0) {
                resultsDiv.innerHTML = '<div class="autocomplete-item"><span style="color: var(--text-muted);">Žádní hráči nenalezeni</span></div>';
            } else {
                resultsDiv.innerHTML = players.map(p => `
                    <div class="autocomplete-item" onclick="ChessDB.selectPlayer('${p.name.replace(/'/g, "\\'")}')">
                        <span class="player-name">${p.name}</span>
                        <span class="game-count">${p.totalGames} partií</span>
                    </div>
                `).join('');
            }

            resultsDiv.style.display = 'block';
        } catch (e) {
            console.error('Search error:', e);
        }
    },

    /**
     * Select a player from autocomplete
     */
    async selectPlayer(name) {
        this.currentPlayer = name;
        this.currentPage = 0;

        document.getElementById('playerSearch').value = name;
        document.getElementById('autocompleteResults').style.display = 'none';

        // Add sidebar for stats
        document.getElementById('resultsSection').classList.add('with-sidebar');
        document.getElementById('playerStats').classList.remove('hidden');

        // Load games and stats in parallel
        await Promise.all([
            this.loadGames(),
            this.loadPlayerStats(name)
        ]);
    },

    /**
     * Load games for current player/filters
     */
    async loadGames() {
        const listDiv = document.getElementById('gamesList');
        listDiv.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner"></i><p>Načítám partie...</p></div>';

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

            if (!response.ok) throw new Error('Failed to load games');

            const data = await response.json();
            this.totalGames = data.total;

            // Update info
            document.getElementById('resultsInfo').textContent = `${data.total.toLocaleString()} partií`;

            if (data.games.length === 0) {
                listDiv.innerHTML = '<div class="empty-state"><i class="fa-solid fa-chess"></i><p>Žádné partie nenalezeny</p></div>';
                document.getElementById('pagination').classList.add('hidden');
                return;
            }

            // Render games
            listDiv.innerHTML = data.games.map(game => this.renderGameRow(game)).join('');

            // Update pagination
            const totalPages = Math.ceil(this.totalGames / this.pageSize);
            document.getElementById('pageInfo').textContent = `Strana ${this.currentPage + 1} z ${totalPages}`;
            document.getElementById('prevPage').disabled = this.currentPage === 0;
            document.getElementById('nextPage').disabled = (this.currentPage + 1) >= totalPages;
            document.getElementById('pagination').classList.remove('hidden');

        } catch (e) {
            console.error('Load games error:', e);
            listDiv.innerHTML = '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Chyba při načítání</p></div>';
        }
    },

    /**
     * Render a single game row
     */
    renderGameRow(game) {
        const date = game.date ? new Date(game.date).toLocaleDateString('cs-CZ') : '—';

        let resultClass = 'draw';
        if (game.result === '1-0') resultClass = 'white-win';
        else if (game.result === '0-1') resultClass = 'black-win';

        return `
            <div class="game-row" onclick="ChessDB.openGame(${game.id})">
                <div class="game-date">${date}</div>
                <div class="game-players">
                    <div class="game-player white">
                        <span>${game.whitePlayer}</span>
                        ${game.whiteElo ? `<span class="elo">(${game.whiteElo})</span>` : ''}
                    </div>
                    <div class="game-player black">
                        <span>${game.blackPlayer}</span>
                        ${game.blackElo ? `<span class="elo">(${game.blackElo})</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    ${game.eco ? `<span class="game-eco">${game.eco}</span>` : ''}
                    <span class="game-result ${resultClass}">${game.result}</span>
                </div>
            </div>
        `;
    },

    /**
     * Load player statistics
     */
    async loadPlayerStats(name) {
        const contentDiv = document.getElementById('playerStatsContent');
        document.getElementById('playerStatsName').textContent = name;
        contentDiv.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner"></i></div>';

        const token = this.getToken();
        try {
            const response = await fetch(`${this.API_URL}/players/${encodeURIComponent(name)}/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to load stats');

            const stats = await response.json();

            const whiteScore = stats.asWhite.games > 0
                ? ((stats.asWhite.wins + stats.asWhite.draws * 0.5) / stats.asWhite.games * 100).toFixed(1)
                : 0;
            const blackScore = stats.asBlack.games > 0
                ? ((stats.asBlack.wins + stats.asBlack.draws * 0.5) / stats.asBlack.games * 100).toFixed(1)
                : 0;

            contentDiv.innerHTML = `
                <div class="stat-grid">
                    <div class="stat-box">
                        <div class="stat-value">${stats.totalGames}</div>
                        <div class="stat-label">Celkem partií</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${stats.peakElo || '—'}</div>
                        <div class="stat-label">Max ELO</div>
                    </div>
                </div>

                <h4 style="margin: 1rem 0 0.5rem; font-size: 0.9rem; color: var(--text-muted);">Jako bílý</h4>
                <div style="display: flex; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 0.5rem;">
                    <span style="color: #4ade80;">+${stats.asWhite.wins}</span>
                    <span style="color: #9ca3af;">=${stats.asWhite.draws}</span>
                    <span style="color: #f87171;">-${stats.asWhite.losses}</span>
                    <span style="margin-left: auto; color: var(--primary-color);">${whiteScore}%</span>
                </div>

                <h4 style="margin: 1rem 0 0.5rem; font-size: 0.9rem; color: var(--text-muted);">Jako černý</h4>
                <div style="display: flex; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 1rem;">
                    <span style="color: #4ade80;">+${stats.asBlack.wins}</span>
                    <span style="color: #9ca3af;">=${stats.asBlack.draws}</span>
                    <span style="color: #f87171;">-${stats.asBlack.losses}</span>
                    <span style="margin-left: auto; color: var(--primary-color);">${blackScore}%</span>
                </div>

                ${stats.topOpenings?.length ? `
                    <h4 style="margin: 1rem 0 0.5rem; font-size: 0.9rem; color: var(--text-muted);">Nejčastější zahájení</h4>
                    <div style="font-size: 0.85rem;">
                        ${stats.topOpenings.slice(0, 5).map(o => `
                            <div style="display: flex; justify-content: space-between; padding: 0.25rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <span class="game-eco">${o.eco}</span>
                                <span style="color: var(--text-muted);">${o.count}×</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            `;

        } catch (e) {
            console.error('Load stats error:', e);
            contentDiv.innerHTML = '<p style="color: var(--text-muted);">Nepodařilo se načíst statistiky</p>';
        }
    },

    /**
     * Open game in modal viewer
     */
    async openGame(id) {
        const modal = document.getElementById('gameModal');
        const modalBody = document.getElementById('modalBody');
        const modalTitle = document.getElementById('modalTitle');

        modal.style.display = 'block';
        modal.classList.remove('hidden');
        modalBody.innerHTML = '<div class="loading"><i class="fa-solid fa-spinner"></i><p>Načítám partii...</p></div>';

        const token = this.getToken();
        try {
            const response = await fetch(`${this.API_URL}/games/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to load game');

            const game = await response.json();

            modalTitle.textContent = `${game.whitePlayer} vs ${game.blackPlayer}`;

            // Display PGN and basic info
            modalBody.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                    <div><strong>Turnaj:</strong> ${game.event || '—'}</div>
                    <div><strong>Datum:</strong> ${game.date ? new Date(game.date).toLocaleDateString('cs-CZ') : '—'}</div>
                    <div><strong>Kolo:</strong> ${game.round || '—'}</div>
                    <div><strong>ECO:</strong> ${game.eco || '—'}</div>
                    <div><strong>Výsledek:</strong> ${game.result}</div>
                </div>
                
                <h4 style="margin-bottom: 0.5rem;">Tahy</h4>
                <div style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 0.9rem; line-height: 1.6; max-height: 300px; overflow-y: auto;">
                    ${this.formatMoves(game.moves)}
                </div>

                <div style="margin-top: 1.5rem;">
                    <h4 style="margin-bottom: 0.5rem;">PGN</h4>
                    <textarea readonly style="width: 100%; height: 150px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1rem; font-family: monospace; font-size: 0.85rem; color: var(--text-color); resize: vertical;">${game.pgn}</textarea>
                    <button onclick="navigator.clipboard.writeText(document.querySelector('#modalBody textarea').value); this.textContent = 'Zkopírováno!'; setTimeout(() => this.textContent = 'Kopírovat PGN', 2000);" style="margin-top: 0.5rem; padding: 0.5rem 1rem; background: var(--primary-color); color: var(--secondary-color); border: none; border-radius: 4px; cursor: pointer;">
                        Kopírovat PGN
                    </button>
                </div>
            `;

        } catch (e) {
            console.error('Open game error:', e);
            modalBody.innerHTML = '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Chyba při načítání partie</p></div>';
        }
    },

    /**
     * Format moves with move numbers
     */
    formatMoves(movesStr) {
        if (!movesStr) return '—';
        const moves = movesStr.split(' ');
        let formatted = '';
        for (let i = 0; i < moves.length; i++) {
            if (i % 2 === 0) {
                formatted += `<strong>${Math.floor(i / 2) + 1}.</strong> `;
            }
            formatted += moves[i] + ' ';
        }
        return formatted;
    }
};

// Global function to close modal
function closeGameModal() {
    const modal = document.getElementById('gameModal');
    modal.style.display = 'none';
    modal.classList.add('hidden');
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    ChessDB.init();
});
