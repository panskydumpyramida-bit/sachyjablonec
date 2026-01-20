/**
 * Diagram Viewer & Training Module
 * 
 * Exports:
 * - class DiagramViewer: Reusable component for rendering and solving diagrams.
 * - TrainingModule: Controller for the /training.html page.
 */

const VIEWER_COLORS = {
    'green': '#22c55e',
    'red': '#ef4444',
    'blue': '#3b82f6',
    'yellow': '#eab308'
};

class DiagramViewer {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`DiagramViewer: Container #${containerId} not found.`);
            return;
        }

        this.options = Object.assign({
            onSolve: () => { },
            onMistake: () => { }
        }, options);

        this.board = null;
        this.diagram = null;
        this.isSolved = false;

        // UI Elements references
        this.boardEl = null;
        this.overlayEl = null;
        this.feedbackEl = null;

        this.initUI();
    }

    initUI() {
        this.container.innerHTML = '';
        this.container.classList.add('diagram-viewer-container');

        // Board Wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'diagram-board-wrapper';
        wrapper.style.position = 'relative'; // For overlay

        // Board Element
        this.boardEl = document.createElement('div');
        this.boardEl.id = `board-${Math.random().toString(36).substr(2, 9)}`;
        this.boardEl.style.width = '100%';
        wrapper.appendChild(this.boardEl);

        // SVG Overlay
        this.overlayEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.overlayEl.setAttribute('class', 'diagram-overlay');
        this.overlayEl.style.position = 'absolute';
        this.overlayEl.style.top = '0';
        this.overlayEl.style.left = '0';
        this.overlayEl.style.width = '100%';
        this.overlayEl.style.height = '100%';
        this.overlayEl.style.pointerEvents = 'none'; // Click through to board
        this.overlayEl.style.zIndex = '10';
        wrapper.appendChild(this.overlayEl);

        this.container.appendChild(wrapper);

        // Feedback Panel (Optional: can be external, but here we include it for self-containment if needed)
        this.feedbackEl = document.createElement('div');
        this.feedbackEl.className = 'diagram-feedback hidden';
        this.feedbackEl.style.marginTop = '1rem';
        this.feedbackEl.style.padding = '1rem';
        this.feedbackEl.style.borderRadius = '8px';
        this.feedbackEl.style.textAlign = 'center';

        this.feedbackEl.innerHTML = `
            <h4 class="feedback-title" style="margin:0; font-weight:600;"></h4>
            <p class="feedback-text" style="margin:0.5rem 0 0; color: #555;"></p>
        `;
        this.container.appendChild(this.feedbackEl);
    }

    load(diagram) {
        this.diagram = diagram;
        this.isSolved = false;
        this.hideFeedback();

        // Determine who is to move - prefer diagram.toMove, then parse from FEN
        let toMove = diagram.toMove;
        if (!toMove && diagram.fen) {
            // Parse from FEN: position color castling en-passant halfmove fullmove
            const fenParts = diagram.fen.split(' ');
            toMove = fenParts.length > 1 ? fenParts[1] : 'w';
        }
        if (!toMove) {
            toMove = 'w';
        }
        this.playerColor = toMove; // 'w' or 'b'

        // Prepare full FEN for chess.js (it requires complete FEN)
        let fullFen = diagram.fen;
        if (diagram.fen && diagram.fen.split(' ').length === 1) {
            // FEN only contains position, add turn and default castling/en-passant
            fullFen = `${diagram.fen} ${toMove} KQkq - 0 1`;
        }

        // Initialize chess.js for legal move validation
        this.game = null;
        if (typeof Chess !== 'undefined') {
            try {
                this.game = new Chess(fullFen);
            } catch (e) {
                console.warn('Failed to initialize Chess.js with FEN:', fullFen, e);
                // Try again with just position
                try {
                    this.game = new Chess();
                    this.game.load(fullFen);
                } catch (e2) {
                    console.error('Chess.js load failed:', e2);
                    this.game = null;
                }
            }
        } else {
            console.warn('chess.js not loaded, legal move validation disabled');
        }

        // 1. Init Board
        const config = {
            position: diagram.fen,
            draggable: true,
            orientation: toMove === 'b' ? 'black' : 'white', // Orient board for player to move
            onDragStart: (source, piece) => this.onDragStart(source, piece),
            onDrop: (source, target) => this.onDrop(source, target),
            onSnapEnd: () => this.onSnapEnd(),
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        };

        if (this.board) {
            this.board.destroy();
        }

        // Detect if chessboard.js is loaded
        if (typeof Chessboard === 'undefined') {
            console.error('Chessboard.js is not loaded.');
            this.container.innerHTML = '<p class="error">Chyba: Chessboard.js nenalezen.</p>';
            return;
        }

        // Initialize board
        this.board = Chessboard(this.boardEl.id, config);

        // 2. Render Annotations
        // Timeout to ensure board is rendered and we can get dimensions
        setTimeout(() => {
            this.renderAnnotations(diagram.annotations);
            window.addEventListener('resize', () => this.renderAnnotations(diagram.annotations));
        }, 100);
    }

    onDragStart(source, piece) {
        if (this.isSolved) return false;

        // Check if game ended (checkmate, stalemate)
        if (this.game && (this.game.in_checkmate() || this.game.in_stalemate() || this.game.in_draw())) {
            return false;
        }

        // Check turn - only allow player whose turn it is to move
        const turn = this.game ? this.game.turn() : this.playerColor;
        const pieceColor = piece.charAt(0); // 'w' or 'b'

        if (pieceColor !== turn) {
            // Can't move opponent's pieces
            return false;
        }

        // Hide previous temporary feedback
        this.hideFeedback();
        return true; // Allow drag
    }

    onDrop(source, target) {
        if (source === target) return 'snapback';

        // First, validate legal move with chess.js
        if (this.game) {
            const move = this.game.move({
                from: source,
                to: target,
                promotion: 'q' // Default to queen for promotions
            });

            if (move === null) {
                // Illegal move
                this.showFeedback('error', 'Nelegální tah.');
                return 'snapback';
            }

            // Move was legal - undo it temporarily for solution checking
            // (we'll re-apply if it's correct or analysis mode)
            this.game.undo();
        }

        const moveKey = `${source}-${target}`;
        const solution = this.diagram.solution || {};
        const hasSolution = Object.keys(solution).length > 0;

        // A) Check specific solution moves
        if (solution[moveKey]) {
            const step = solution[moveKey];

            if (step.type === 'correct') {
                this.isSolved = true;
                this.showFeedback('success', step.comment || 'Správně! ✅');
                // Apply the move in game state
                if (this.game) {
                    this.game.move({ from: source, to: target, promotion: 'q' });
                }
                this.options.onSolve(this.diagram);
                // Update board position to show the move
                return; // Allow move to stay
            } else if (step.type === 'alternative') {
                this.showFeedback('info', step.comment || 'Zajímavá alternativa, ale existuje lepší tah.');
                return 'snapback';
            } else {
                // Mistake type
                this.showFeedback('error', step.comment || 'Toto není správné řešení.');
                this.options.onMistake();
                return 'snapback';
            }
        }

        // B) If solution exists but move not found -> Mistake
        if (hasSolution) {
            this.showFeedback('error', 'To není správný tah. Zkuste to znovu.');
            this.options.onMistake();
            return 'snapback';
        }

        // C) Analysis mode (no solution defined) - allow free movement
        // Apply the move in game state
        if (this.game) {
            this.game.move({ from: source, to: target, promotion: 'q' });
        }
        return;
    }

    onSnapEnd() {
        // Sync board position with game state after animation
        if (this.game && this.board) {
            this.board.position(this.game.fen());
        }
    }

    showFeedback(type, message) {
        if (!this.feedbackEl) return;

        this.feedbackEl.classList.remove('hidden', 'success', 'info', 'error');
        this.feedbackEl.style.display = 'block'; // Ensure visible

        // Remove old dynamic styles
        this.feedbackEl.style.background = '';
        this.feedbackEl.style.border = '';
        this.feedbackEl.style.color = '';

        const titleEl = this.feedbackEl.querySelector('.feedback-title');
        const textEl = this.feedbackEl.querySelector('.feedback-text');

        textEl.textContent = message;

        if (type === 'success') {
            this.feedbackEl.classList.add('success');
            this.feedbackEl.style.border = `1px solid ${VIEWER_COLORS.green}`;
            this.feedbackEl.style.color = VIEWER_COLORS.green;
            titleEl.textContent = "Správně! ✅";
        } else if (type === 'info') {
            this.feedbackEl.classList.add('info');
            this.feedbackEl.style.border = `1px solid ${VIEWER_COLORS.blue}`;
            this.feedbackEl.style.color = VIEWER_COLORS.blue;
            titleEl.textContent = "Alternativa 🤔";
        } else {
            this.feedbackEl.classList.add('error');
            this.feedbackEl.style.border = `1px solid ${VIEWER_COLORS.red}`;
            this.feedbackEl.style.color = VIEWER_COLORS.red;
            titleEl.textContent = "Chyba ❌";
        }
        // Force text color for readability if needed, but inherited usually checks out
        textEl.style.color = 'inherit';
    }

    hideFeedback() {
        if (this.feedbackEl) {
            this.feedbackEl.style.display = 'none';
        }
    }

    renderAnnotations(annotations) {
        if (!this.overlayEl || !this.board) return;
        this.overlayEl.innerHTML = ''; // Clear

        if (!annotations) return;

        const getSqCenter = (sq) => {
            // Find the square element in DOM to get exact position
            // Chessboard.js keys squares with data-square="e4"
            const sqEl = this.boardEl.querySelector(`[data-square="${sq}"]`);
            if (!sqEl) return null;

            const boardRect = this.boardEl.getBoundingClientRect();
            const sqRect = sqEl.getBoundingClientRect();

            // Calculate relative to board container
            return {
                x: sqRect.left - boardRect.left + sqRect.width / 2,
                y: sqRect.top - boardRect.top + sqRect.height / 2,
                width: sqRect.width
            };
        };

        // Render Squares
        if (annotations.squares) {
            annotations.squares.forEach(s => {
                const c = getSqCenter(s.square);
                if (c) {
                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('x', c.x - c.width / 2);
                    rect.setAttribute('y', c.y - c.width / 2);
                    rect.setAttribute('width', c.width);
                    rect.setAttribute('height', c.width);
                    rect.setAttribute('fill', VIEWER_COLORS[s.color]);
                    rect.setAttribute('fill-opacity', '0.5');
                    this.overlayEl.appendChild(rect);
                }
            });
        }

        // Render Arrows
        if (annotations.arrows) {
            // Define markers if not exists
            this.ensureMarkers();

            annotations.arrows.forEach(a => {
                const s = getSqCenter(a.start);
                const e = getSqCenter(a.end);
                if (s && e) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', s.x);
                    line.setAttribute('y1', s.y);
                    line.setAttribute('x2', e.x);
                    line.setAttribute('y2', e.y);
                    line.setAttribute('stroke', VIEWER_COLORS[a.color]);
                    line.setAttribute('stroke-width', (s.width * 0.15) || 6); // Responsive width
                    line.setAttribute('stroke-opacity', '0.8');
                    line.setAttribute('marker-end', `url(#arrowhead-${a.color})`);
                    this.overlayEl.appendChild(line);
                }
            });
        }
    }

    ensureMarkers() {
        if (this.overlayEl.querySelector('defs')) return;

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

        Object.keys(VIEWER_COLORS).forEach(colorKey => {
            const color = VIEWER_COLORS[colorKey];
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', `arrowhead-${colorKey}`);
            marker.setAttribute('markerWidth', '6'); // smaller marker
            marker.setAttribute('markerHeight', '6');
            marker.setAttribute('refX', '5'); // Adjust to tip of arrow
            marker.setAttribute('refY', '3');
            marker.setAttribute('orient', 'auto');

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M0,0 L6,3 L0,6 L0,0'); // Simple triangle
            path.setAttribute('fill', color);

            marker.appendChild(path);
            defs.appendChild(marker);
        });

        this.overlayEl.appendChild(defs);
    }
}


/**
 * Training Module Controller
 */
const TrainingModule = {
    diagrams: [],
    currentIndex: 0,
    viewer: null,

    init: async function () {
        if (!document.getElementById('training-page')) return;

        try {
            await this.loadDiagrams();

            // Init Viewer
            // Ensure target div exists
            if (document.getElementById('boardArea')) {
                document.getElementById('boardArea').innerHTML = '';
                // Do NOT rename ID, keep it stable
            }

            this.viewer = new DiagramViewer('boardArea', {
                onSolve: (d) => this.handleSuccess(d)
            });

            if (this.diagrams.length > 0) {
                this.renderSidebar();
                this.loadDiagram(0);
            }
        } catch (e) {
            console.error('Training Module Init Failed:', e);
        }
    },

    loadDiagrams: async function () {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'flex';

        // Wait for auth to be fully initialized (token loaded from localstorage)
        // Race condition protection against auth.js init
        let retries = 0;
        while ((!window.auth || !auth.token) && retries < 20) {
            await new Promise(r => setTimeout(r, 100)); // Wait up to 2s
            retries++;
        }

        try {
            const headers = window.auth ? auth.getHeaders() : {};
            const response = await fetch('/api/diagrams', { headers });

            if (response.status === 401) {
                // Handle unauthorized specifically
                document.getElementById('boardArea').innerHTML = `
                    <div style="text-align:center; padding:2rem;">
                        <h3>Pro zobrazení diagramů se musíte přihlásit</h3>
                        <div class="auth-buttons" style="margin-top:1rem;">
                            <button class="btn-primary" onclick="auth.showLoginModal()">Přihlásit se</button>
                        </div>
                    </div>
                `;
                throw new Error('Unauthorized');
            }

            if (!response.ok) throw new Error('API Error');
            this.diagrams = await response.json();
        } catch (e) {
            console.error(e);
            if (e.message !== 'Unauthorized') {
                const boardArea = document.getElementById('boardArea');
                if (boardArea && boardArea.innerHTML === '') {
                    boardArea.innerHTML = '<p class="error" style="text-align:center; padding:1rem;">Nepodařilo se načíst diagramy.</p>';
                }
            }
        } finally {
            if (loadingEl) loadingEl.style.display = 'none';
        }
    },

    renderSidebar: function () {
        const list = document.getElementById('diagramList');
        if (!list) return;

        list.innerHTML = '';
        this.diagrams.forEach((d, i) => {
            const el = document.createElement('div');
            el.className = 'diagram-item';
            el.id = `diagram-item-${i}`;
            el.innerHTML = `
                <h4>${d.name || `Diagram ${i + 1}`}</h4>
                <p>${d.description ? d.description.substring(0, 40) + '...' : ''}</p>
            `;
            el.onclick = () => this.loadDiagram(i);
            list.appendChild(el);
        });
    },

    loadDiagram: function (index) {
        this.currentIndex = index;
        const diagram = this.diagrams[index];

        // Highlight Sidebar
        document.querySelectorAll('.diagram-item').forEach(e => e.classList.remove('active'));
        document.getElementById(`diagram-item-${index}`)?.classList.add('active');

        // Load into viewer
        this.viewer.load(diagram);
    },

    handleSuccess: function (diagram) {
        // Integrate Next Button into the Viewer's Feedback Panel
        if (this.viewer && this.viewer.feedbackEl) {
            const existingBtn = this.viewer.feedbackEl.querySelector('.next-btn');
            if (existingBtn) existingBtn.remove(); // Prevent duplicates

            const btn = document.createElement('button');
            btn.className = 'btn-primary next-btn';
            btn.innerHTML = 'Další diagram <i class="fas fa-arrow-right"></i>';
            btn.style.marginTop = '10px';
            btn.style.display = 'inline-block';
            btn.style.padding = '0.5rem 1rem';
            btn.style.border = 'none';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            btn.style.background = '#d4a373';
            btn.style.color = '#000';
            btn.style.fontWeight = 'bold';

            btn.onclick = () => this.loadNext();

            this.viewer.feedbackEl.appendChild(btn);
        }
    },

    loadNext: function () {
        if (this.currentIndex < this.diagrams.length - 1) {
            this.loadDiagram(this.currentIndex + 1);
        } else {
            alert('Všechny diagramy dokončeny!');
        }
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.training-container')) {
        document.body.id = 'training-page';
        TrainingModule.init();
    }
});
