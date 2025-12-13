/**
 * Game Viewer Logic
 * Handles PGN rendering, navigation, swipe gestures, and UI updates.
 */

class GameViewer {
    constructor() {
        this.gamesData = [];
        this.teamsData = null;
        this.currentIndex = -1;
        this.touchStartX = 0;
        this.touchEndX = 0;

        // Bind methods
        this.prevGame = this.prevGame.bind(this);
        this.nextGame = this.nextGame.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
        this.handleSwipe = this.handleSwipe.bind(this);
        this.toggleViewer = this.toggleViewer.bind(this);
    }

    init(games, teams = null) {
        this.gamesData = games;
        this.teamsData = teams;

        const container = document.getElementById('game-viewer-container');
        const list = document.getElementById('game-list-content');
        const title = document.getElementById('gameViewerTitle');
        const subtitle = document.getElementById('gameViewerSubtitle');

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

        // Use category title if only one team provided? Or generic.
        // If coming from Teams section, title might be static.

        list.innerHTML = '';

        games.forEach((game, index) => {
            // Logic to render headers
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

        // Attach global controls
        this.attachEvents();

        // Load first game
        if (games.length > 0) {
            this.loadGame(0);
        }
    }

    loadGame(index) {
        if (index < 0 || index >= this.gamesData.length) return;
        const game = this.gamesData[index];
        if (game.type === 'header' || game.isHeader) return; // Cannot load a header

        this.currentIndex = index;

        const titleEl = document.getElementById('current-game-title');
        if (titleEl) titleEl.textContent = game.title;

        // Count only playable games (not headers)
        const playableGames = this.gamesData.filter(g => g.type !== 'header' && !g.isHeader);
        const currentNum = playableGames.indexOf(game) + 1;

        const counterEl = document.getElementById('game-counter');
        if (counterEl) counterEl.textContent = `${currentNum} / ${playableGames.length}`;

        let src = game.gameId || game.chessComId;
        if (src && !src.startsWith('http')) {
            src = `https://www.chess.com/emboard?id=${src}`;
        }
        // Fallback to game.src if gameId/chessComId missing
        if (!src && game.src) src = game.src;

        const iframe = document.getElementById('chess-frame');
        if (iframe) iframe.src = src || '';

        // Update active state in list
        const gameItems = document.querySelectorAll('.game-item');
        gameItems.forEach((item) => {
            if (parseInt(item.dataset.index) === index) {
                item.classList.add('active');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });

        // Update buttons
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        if (prevBtn) prevBtn.disabled = (index === 0);
        if (nextBtn) nextBtn.disabled = (index === this.gamesData.length - 1);
    }

    prevGame() {
        this.loadGame(this.currentIndex - 1);
    }

    nextGame() {
        this.loadGame(this.currentIndex + 1);
    }

    attachEvents() {
        // Keyboard navigation
        document.removeEventListener('keydown', this.handleKeydown); // Prevent duplicates
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

        // Bind global toggle function if needed, or attach to element
        // In HTML: onlick="toggleViewer()" expects a global function.
        // We will export a global instance or helper.
        window.toggleViewer = this.toggleViewer;
    }

    handleKeydown(e) {
        const viewer = document.getElementById('game-viewer-container');
        if (!viewer || viewer.classList.contains('hidden')) return;

        // Check if viewer is visible on screen
        const rect = viewer.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        if (!isVisible) return;

        // Don't trigger if user is typing in an input
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
            this.nextGame(); // Swipe left
        } else {
            this.prevGame(); // Swipe right
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

// Expose navigation functions globally for HTML event handlers (onclick="prevGame()")
window.prevGame = () => gameViewer.prevGame();
window.nextGame = () => gameViewer.nextGame();
