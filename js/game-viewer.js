/**
 * Game Viewer Logic
 * Handles PGN rendering, navigation, swipe gestures, and UI updates.
 */

class GameViewer {
    constructor() {
        this.allGamesData = []; // Store full dataset
        this.gamesData = []; // Store filtered dataset
        this.teamsData = null;
        this.currentIndex = -1;
        this.touchStartX = 0;
        this.touchEndX = 0;
        this.filterCommentedOnly = false;

        // Bind methods
        this.prevGame = this.prevGame.bind(this);
        this.nextGame = this.nextGame.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleSwipe = this.handleSwipe.bind(this);
        this.toggleViewer = this.toggleViewer.bind(this);
        this.toggleFilter = this.toggleFilter.bind(this);
    }

    init(games, teams = null) {
        this.allGamesData = games || [];
        this.teamsData = teams;

        const container = document.getElementById('game-viewer-container');
        const list = document.getElementById('game-list-content');
        const title = document.getElementById('gameViewerTitle');
        const subtitle = document.getElementById('gameViewerSubtitle');
        const listHeader = document.querySelector('.sidebar-header h2');

        if (!container || !list) return;

        if (!games || games.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');

        // Set Title based on teams if provided
        if (teams && teams.length >= 2 && title && subtitle) {
            title.textContent = `${teams[0].name} vs ${teams[1].name}`;
            subtitle.textContent = "Rozbor partií";
        }

        // Add filter toggle if not present
        if (listHeader && !document.getElementById('filterCommentedToggle')) {
            // Ensure header is flex container
            listHeader.style.display = 'flex';
            listHeader.style.justifyContent = 'space-between';
            listHeader.style.alignItems = 'center';

            const label = document.createElement('label');
            label.id = 'filterCommentedToggle';
            label.style.cursor = 'pointer';
            label.style.fontSize = '0.75rem';
            label.style.textTransform = 'none';
            label.style.color = 'var(--viewer-accent)';
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.gap = '4px';
            label.innerHTML = `
                <input type="checkbox" onchange="gameViewer.toggleFilter(this.checked)" style="margin: 0;">
                Pouze komentované
            `;
            listHeader.appendChild(label);
        }

        this.applyFilter();
        this.attachEvents();
    }

    toggleFilter(checked) {
        this.filterCommentedOnly = checked;
        this.applyFilter();
    }

    applyFilter() {
        if (this.filterCommentedOnly) {
            this.gamesData = this.allGamesData.filter(g => (g.type === 'header' || g.isHeader) || g.commented);
            // Remove headers if they have no children (optional optimization, skip for simplicity)
        } else {
            this.gamesData = [...this.allGamesData];
        }

        this.renderList();

        // Load first playable game
        const firstPlayable = this.gamesData.findIndex(g => g.type !== 'header' && !g.isHeader);
        if (firstPlayable !== -1) {
            this.loadGame(firstPlayable);
        } else {
            // Clear viewer if no games match
            this.currentIndex = -1;
            const iframe = document.getElementById('chess-frame');
            if (iframe) iframe.src = 'about:blank';
            const titleEl = document.getElementById('current-game-title');
            if (titleEl) titleEl.textContent = 'Žádné partie k zobrazení';
        }
    }

    renderList() {
        const list = document.getElementById('game-list-content');
        if (!list) return;

        list.innerHTML = '';

        this.gamesData.forEach((game, index) => {
            if (game.type === 'header' || game.isHeader) {
                const header = document.createElement('div');
                header.className = 'team-header';
                header.textContent = game.title;
                list.appendChild(header);
                return;
            }

            const item = document.createElement('div');
            item.className = 'game-item';
            item.textContent = game.title;
            item.dataset.index = index;

            if (game.commented) {
                item.innerHTML += '&nbsp;💬';
                item.title = 'Okomentováno';
            }

            item.onclick = () => this.loadGame(index);
            list.appendChild(item);
        });
    }

    loadGame(index) {
        if (index < 0 || index >= this.gamesData.length) return;
        const game = this.gamesData[index];
        if (game.type === 'header' || game.isHeader) return;

        this.currentIndex = index;

        const titleEl = document.getElementById('current-game-title');
        if (titleEl) titleEl.textContent = game.title;

        const playableGames = this.gamesData.filter(g => g.type !== 'header' && !g.isHeader);
        const currentNum = playableGames.indexOf(game) + 1;

        const counterEl = document.getElementById('game-counter');
        if (counterEl) counterEl.textContent = `${currentNum} / ${playableGames.length}`;

        let src = game.gameId || game.chessComId;
        if (src && !src.startsWith('http')) {
            src = `https://www.chess.com/emboard?id=${src}`;
        }
        if (!src && game.src) src = game.src;

        const iframe = document.getElementById('chess-frame');
        if (iframe) iframe.src = src || '';

        const gameItems = document.querySelectorAll('.game-item');
        gameItems.forEach((item) => {
            if (parseInt(item.dataset.index) === index) {
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });

        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        if (prevBtn) prevBtn.disabled = (index === 0); // Logic might need adjustment for headers skipping
        if (nextBtn) nextBtn.disabled = (index === this.gamesData.length - 1);

        // Smarter button disabling (skip headers)
        // Check if previous playable exists
        // simplified index check is okay for now as loadGame handles out of bounds
    }

    prevGame() {
        // Skip headers backwards
        let newIndex = this.currentIndex - 1;
        while (newIndex >= 0 && (this.gamesData[newIndex].type === 'header' || this.gamesData[newIndex].isHeader)) {
            newIndex--;
        }
        if (newIndex >= 0) this.loadGame(newIndex);
    }

    nextGame() {
        // Skip headers forwards
        let newIndex = this.currentIndex + 1;
        while (newIndex < this.gamesData.length && (this.gamesData[newIndex].type === 'header' || this.gamesData[newIndex].isHeader)) {
            newIndex++;
        }
        if (newIndex < this.gamesData.length) this.loadGame(newIndex);
    }

    attachEvents() {
        // Keyboard navigation
        document.removeEventListener('keydown', this.handleKeydown);
        document.addEventListener('keydown', this.handleKeydown);

        // Swipe gestures
        const gameViewer = document.querySelector('.game-viewer');
        if (gameViewer) {
            gameViewer.addEventListener('touchstart', (e) => {
                this.touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });

            gameViewer.addEventListener('touchend', (e) => {
                this.touchEndX = e.changedTouches[0].screenX;
                this.handleSwipe();
            }, { passive: true });
        }

        window.toggleViewer = this.toggleViewer;
    }

    handleKeydown(e) {
        const viewer = document.getElementById('game-viewer-container');
        if (!viewer || viewer.classList.contains('hidden')) return;

        const rect = viewer.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        if (!isVisible) return;

        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.prevGame();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.nextGame();
        }
    }

    handleSwipe() {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;

        if (Math.abs(diff) < swipeThreshold) return;

        if (diff > 0) {
            this.nextGame();
        } else {
            this.prevGame();
        }
    }

    toggleViewer() {
        const container = document.getElementById('appContainer');
        const icon = document.getElementById('viewerToggleIcon');

        if (!container || !icon) return;

        if (container.classList.contains('collapsed')) {
            container.classList.remove('collapsed');
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        } else {
            container.classList.add('collapsed');
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    }
}

// Export singleton instance for easy usage
const gameViewer = new GameViewer();

// Global export for legacy/inline compatibility
window.gameViewer = gameViewer;

// Expose navigation functions globally for HTML event handlers
window.prevGame = () => gameViewer.prevGame();
window.nextGame = () => gameViewer.nextGame();
