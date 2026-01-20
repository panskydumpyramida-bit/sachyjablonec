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

        // Click-to-move state
        this.selectedSquare = null;

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

        // Type Badge (corner indicator for puzzle vs diagram)
        this.typeBadge = document.createElement('div');
        this.typeBadge.className = 'diagram-type-badge';
        this.typeBadge.style.cssText = `
            position: absolute;
            top: -28px;
            right: 0;
            padding: 2px 8px;
            background: rgba(30, 30, 30, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            font-size: 0.75rem;
            color: #eee;
            z-index: 15;
            pointer-events: auto;
            cursor: help;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
        // Tooltip is set via title attribute dynamically
        wrapper.appendChild(this.typeBadge);

        this.container.appendChild(wrapper);

        // Feedback Panel
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

        // Reset Button
        this.resetBtn = document.createElement('button');
        this.resetBtn.className = 'diagram-reset-btn';
        this.resetBtn.style.cssText = `
            display: block;
            margin: 0.75rem auto 0;
            padding: 0.4rem 1rem;
            background: rgba(100, 100, 100, 0.2);
            border: 1px solid rgba(150, 150, 150, 0.3);
            border-radius: 6px;
            color: #aaa;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.2s;
        `;
        this.resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
        this.resetBtn.onclick = () => this.reset();
        this.resetBtn.onmouseover = () => {
            this.resetBtn.style.background = 'rgba(100, 100, 100, 0.3)';
            this.resetBtn.style.color = '#fff';
        };
        this.resetBtn.onmouseout = () => {
            this.resetBtn.style.background = 'rgba(100, 100, 100, 0.2)';
            this.resetBtn.style.color = '#aaa';
        };
        this.container.appendChild(this.resetBtn);

        // Add CLICK listener (delegation) for Click-to-Move - ONCE in initUI
        this.boardEl.addEventListener('click', (e) => {
            const squareEl = e.target.closest('[data-square]');
            if (squareEl) {
                const square = squareEl.getAttribute('data-square');
                this.handleSquareClick(square);
            }
        });
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

        // Update type badge
        const hasSolution = diagram.solution && Object.keys(diagram.solution).length > 0;
        if (this.typeBadge) {
            this.typeBadge.innerHTML = hasSolution
                ? '<i class="fa-solid fa-puzzle-piece"></i>'
                : '<i class="fa-solid fa-chess-board"></i>';
            this.typeBadge.title = hasSolution ? 'Hádanka' : 'Diagram';
        }

        // State for multi-move lines
        this.activeLine = null; // Array of moves ["e2-e4", "e7-e5"]
        this.activeLineIndex = 0; // Current index in the line

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

        // Select the square for consistency with click-move
        this.selectSquare(source);

        // Hide previous temporary feedback
        this.hideFeedback();
        return true; // Allow drag
    }

    onDrop(source, target) {
        if (source === target) {
            this.deselectSquare();
            return 'snapback';
        }

        // Attempt move using shared logic (isDrop = true to prevent double UI update)
        const success = this.attemptMove(source, target, true);

        // Cleanup selection always
        this.deselectSquare();

        if (success) {
            // For drag-and-drop: piece is already in place visually.
            // No sync needed - chess.js state is updated in executeMove.
            return undefined;
        } else {
            return 'snapback';
        }
    }

    // --- CLICK TO MOVE LOGIC ---

    reset() {
        if (!this.diagram) return;

        // Reset state
        this.activeLine = null;
        this.activeLineIndex = 0;
        this.isSolved = false;

        // Reload
        this.load(this.diagram);

        // Hide feedback
        this.hideFeedback();
    }

    handleSquareClick(square) {
        try {
            if (this.isSolved) return;

            // Check game state
            if (this.game && (this.game.in_checkmate() || this.game.in_stalemate())) {
                return;
            }

            // Logic:
            // 1. If currently selected square == square -> Deselect
            // 2. If nothing selected -> Select if own piece
            // 3. If something selected:
            //    a. If clicked own piece -> Change selection
            //    b. If clicked valid target -> Move

            const turn = this.game ? this.game.turn() : this.playerColor;
            // Check if clicked square has own piece
            let pieceOnSquare = null;
            if (this.game) {
                pieceOnSquare = this.game.get(square);
            }

            const isOwnPiece = pieceOnSquare && pieceOnSquare.color === turn;

            if (this.selectedSquare === square) {
                this.deselectSquare();
                return;
            }

            if (!this.selectedSquare) {
                if (isOwnPiece) {
                    this.selectSquare(square);
                }
                return;
            }

            // We have a selection
            if (isOwnPiece) {
                this.selectSquare(square);
                return;
            }

            // Attempt move
            // Pass isDrop = false because this IS a click-move, so we WANT executeMove to update the board if needed.
            const success = this.attemptMove(this.selectedSquare, square, false);

            if (success) {
                // Move handled by attemptMove -> executeMove
                this.deselectSquare();
            } else {
                // Invalid move or mistake
                // If illegal move, just deselect
                this.deselectSquare();
            }
        } catch (e) {
            console.error('Error in handleSquareClick:', e);
            this.deselectSquare();
        }
    }

    selectSquare(square) {
        this.selectedSquare = square;
        // Visual highlight
        this.removeHighlights();
        const sqEl = this.boardEl.querySelector(`[data-square="${square}"]`);
        if (sqEl) sqEl.classList.add('highlight-source');
    }

    deselectSquare() {
        this.selectedSquare = null;
        this.removeHighlights();
    }

    removeHighlights() {
        const highlighted = this.boardEl.querySelectorAll('.highlight-source, .highlight-dest');
        highlighted.forEach(el => el.classList.remove('highlight-source', 'highlight-dest'));
    }

    // Shared move logic
    attemptMove(source, target, isDrop = false) {
        // First, validate legal move with chess.js
        if (this.game) {
            const move = this.game.move({
                from: source,
                to: target,
                promotion: 'q' // Default to queen for promotions
            });

            if (move === null) {
                // Illegal move
                return false;
            }

            // Move was legal - undo it temporarily for solution checking
            this.game.undo();
        }

        const moveKey = `${source}-${target}`;

        // LOGIC FOR MULTI-MOVE SEQUENCES

        // Case 1: Already following a line
        if (this.activeLine) {
            // Check if this move matches the next expected move in the line
            const expectedMove = this.activeLine[this.activeLineIndex + 1];

            if (moveKey === expectedMove) {
                // Correct continuation as part of the line
                this.executeMove(source, target, isDrop);
                this.activeLineIndex++;

                // Check if line finished
                if (this.activeLineIndex >= this.activeLine.length - 1) {
                    this.handleLineSuccess();
                } else {
                    // Continue with opponent move
                    this.makeOpponentMove();
                }
                return true;
            } else {
                // Warning/Error: Departed from the active line
                this.showFeedback('error', 'To není správné pokračování varianty.');
                return false;
            }
        }

        const solution = this.diagram.solution || {};
        const hasSolution = Object.keys(solution).length > 0;

        // A) Check specific solution moves
        // Case 2: New move (start of line)
        if (solution[moveKey]) {
            const step = solution[moveKey];

            if (step.type === 'correct') {
                this.executeMove(source, target, isDrop);

                // Check for multi-move line
                if (step.line && step.line.length > 1) {
                    this.activeLine = step.line;
                    this.activeLineIndex = 0; // We just played index 0

                    // Trigger opponent move
                    this.makeOpponentMove();
                    this.showFeedback('success', 'Správně! Pokračujte...');
                } else {
                    // Single move solution
                    this.isSolved = true;
                    this.showFeedback('success', step.comment || 'Správně! ✅');
                    if (this.options.onSolve) this.options.onSolve(this.diagram);
                }
                return true; // Allow move to stay
            } else if (step.type === 'alternative') {
                if (step.line && step.line.length > 1) {
                    this.executeMove(source, target, isDrop);
                    this.activeLine = step.line;
                    this.activeLineIndex = 0;
                    this.makeOpponentMove();
                    this.showFeedback('info', step.comment || 'Alternativní varianta.');
                    return true;
                }

                this.showFeedback('info', step.comment || 'Zajímavá alternativa, ale existuje lepší tah.');
                this.executeMove(source, target, isDrop);
                return true;
            } else {
                // Mistake type
                this.showFeedback('error', step.comment || 'Toto není správné řešení.');
                this.options.onMistake();
                this.executeMove(source, target, isDrop);
                return true;
            }
        }

        // B) If solution exists but move not found -> Mistake
        if (hasSolution) {
            this.showFeedback('error', 'To není správný tah. Zkuste to znovu.');
            this.options.onMistake();
            this.executeMove(source, target, isDrop);
            return true;
        }

        // C) Analysis mode (no solution defined) - allow free movement
        // Execute move manually
        this.executeMove(source, target, isDrop);
        return true;
    }

    executeMove(source, target, isDrop = false) {
        if (this.game) {
            // Execute move in chess.js for state tracking
            this.game.move({ from: source, to: target, promotion: 'q' });
        }

        // Only update board UI if NOT a drop (drops already updated UI by user action)
        if (!isDrop && this.board) {
            // Use board.move() for click-moves - this animates the piece from source to target
            // Note: board.move() handles the visual update while game.move() handles the logic
            this.board.move(`${source}-${target}`);
        }
    }

    makeOpponentMove() {
        if (!this.activeLine || this.activeLineIndex >= this.activeLine.length - 1) return;

        // Next move is opponent
        const opponentMoveKey = this.activeLine[this.activeLineIndex + 1];
        const [source, target] = opponentMoveKey.split('-');

        setTimeout(() => {
            if (!this.game) return; // safety
            this.executeMove(source, target);
            this.activeLineIndex++;

            // Check if line finished (after opponent move? Unlikely for "mate" puzzles, but possible for "draw" puzzles)
            if (this.activeLineIndex >= this.activeLine.length - 1) {
                this.handleLineSuccess();
            }
        }, 500);
    }

    handleLineSuccess() {
        this.isSolved = true;

        // Find the comment for the whole line (from the start index). 
        // We need the original step object.
        // It's keyed by the first move.
        // Safety check if activeLine is still valid
        if (!this.activeLine || this.activeLine.length === 0) return;

        const firstMove = this.activeLine[0];
        const step = this.diagram.solution[firstMove];

        const msg = step.comment || (step.type === 'correct' ? 'Vyřešeno! ✅' : 'Konec varianty.');
        const type = step.type === 'correct' ? 'success' : 'info';

        this.showFeedback(type, msg);
        if (step.type === 'correct' && this.options.onSolve) {
            this.options.onSolve(this.diagram);
        }
    }

    onSnapEnd() {
        // Do not force position update here as it causes visual glitches (doubling) with chessboard.js
        // during drag-and-drop. The board state is managed by onDrop and executeMove.
        // We only need to sync if we suspect drift, but for now, disable it to fix the bug.
    }

    showFeedback(type, message) {
        if (!this.feedbackEl) return;

        this.feedbackEl.classList.remove('hidden', 'success', 'info', 'error');
        this.feedbackEl.style.display = 'block'; // Ensure visible

        // Reset styles
        this.feedbackEl.style.background = '';
        this.feedbackEl.style.border = '';
        this.feedbackEl.style.color = '';

        const titleEl = this.feedbackEl.querySelector('.feedback-title');
        const textEl = this.feedbackEl.querySelector('.feedback-text');

        textEl.textContent = message;

        if (type === 'success') {
            this.feedbackEl.classList.add('success');
            this.feedbackEl.style.background = 'rgba(34, 197, 94, 0.15)';
            this.feedbackEl.style.border = `2px solid ${VIEWER_COLORS.green}`;
            this.feedbackEl.style.color = VIEWER_COLORS.green;
            titleEl.textContent = "Správně! ✅";
        } else if (type === 'info') {
            this.feedbackEl.classList.add('info');
            this.feedbackEl.style.background = 'rgba(59, 130, 246, 0.15)';
            this.feedbackEl.style.border = `2px solid ${VIEWER_COLORS.blue}`;
            this.feedbackEl.style.color = VIEWER_COLORS.blue;
            titleEl.textContent = "Alternativa 🤔";
        } else {
            this.feedbackEl.classList.add('error');
            this.feedbackEl.style.background = 'rgba(239, 68, 68, 0.15)';
            this.feedbackEl.style.border = `2px solid ${VIEWER_COLORS.red}`;
            this.feedbackEl.style.color = VIEWER_COLORS.red;
            titleEl.textContent = "Chyba ❌";
        }
        textEl.style.color = 'inherit';
    }

    hideFeedback() {
        if (this.feedbackEl) {
            this.feedbackEl.style.display = 'none';
        }
    }

    reset() {
        if (this.diagram) {
            this.load(this.diagram);
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
