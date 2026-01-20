/**
 * Diagram Book Component
 * Renders interactive book-style diagram carousels in articles
 * Reusable across news articles and other pages
 */

(function () {
    'use strict';

    // Board generation function (same as admin but available globally)
    function generateMiniBoard(fen, squareSize = 25) {
        const boardSize = squareSize * 8;
        if (!fen) return `<div style="width:${boardSize}px;height:${boardSize}px;background:#b58863;margin:0 auto;border-radius:4px;"></div>`;

        const position = fen.split(' ')[0];
        const rows = position.split('/');

        // Build the table rows with very strict inline styles
        let tableHtml = '';
        for (let i = 0; i < 8; i++) {
            tableHtml += `<tr style="height:${squareSize}px !important;max-height:${squareSize}px !important;">`;
            const row = rows[i] || '8';
            let colIdx = 0;

            for (const char of row) {
                if (/\d/.test(char)) {
                    const emptyCount = parseInt(char);
                    for (let k = 0; k < emptyCount; k++) {
                        const isLight = (i + colIdx) % 2 === 0;
                        const bg = isLight ? '#f0d9b5' : '#b58863';
                        tableHtml += `<td style="width:${squareSize}px;height:${squareSize}px;max-width:${squareSize}px;max-height:${squareSize}px;background:${bg};padding:0;margin:0;line-height:0;font-size:0;box-sizing:border-box;"></td>`;
                        colIdx++;
                    }
                } else {
                    const isLight = (i + colIdx) % 2 === 0;
                    const bg = isLight ? '#f0d9b5' : '#b58863';
                    const color = char === char.toLowerCase() ? 'b' : 'w';
                    const piece = char.toUpperCase();
                    const pieceUrl = `https://chessboardjs.com/img/chesspieces/wikipedia/${color}${piece}.png`;

                    tableHtml += `<td style="width:${squareSize}px;height:${squareSize}px;max-width:${squareSize}px;max-height:${squareSize}px;background:${bg};padding:0;margin:0;line-height:0;font-size:0;box-sizing:border-box;"><img src="${pieceUrl}" style="width:${squareSize}px;height:${squareSize}px;max-width:${squareSize}px;max-height:${squareSize}px;display:block;margin:0;padding:0;" alt="${piece}"></td>`;
                    colIdx++;
                }
            }
            tableHtml += '</tr>';
        }

        // Wrap in a fixed-size container with aspect-ratio to prevent external CSS from stretching
        return `<div class="mini-board-wrapper" style="width:${boardSize}px;height:${boardSize}px;max-width:${boardSize}px;max-height:${boardSize}px;margin:0 auto;overflow:hidden;flex:none;aspect-ratio:1/1;">
            <table style="border-collapse:collapse;width:${boardSize}px;height:${boardSize}px;max-width:${boardSize}px;max-height:${boardSize}px;table-layout:fixed;">${tableHtml}</table>
        </div>`;
    }

    // Make globally available
    window.generateMiniBoardGlobal = generateMiniBoard;

    // Book navigation function
    window.bookNav = function (bookId, direction) {
        const book = document.getElementById(bookId);
        if (!book) return;

        let diagrams;
        try {
            diagrams = JSON.parse(book.dataset.diagrams);
        } catch (e) {
            console.error('Failed to parse diagram data', e);
            return;
        }

        let current = parseInt(book.dataset.current) || 0;

        current += direction;
        if (current < 0) current = diagrams.length - 1;
        if (current >= diagrams.length) current = 0;

        book.dataset.current = current;

        const d = diagrams[current];

        // Update Board
        const boardEl = book.querySelector('.book-board-container');
        if (boardEl) {
            if (book._viewer) {
                // Use interactive viewer
                book._viewer.load(d);
            } else if (typeof DiagramViewer !== 'undefined') {
                // Initialize if missed (e.g. dynamic load)
                if (!boardEl.id) boardEl.id = 'board-container-' + bookId;
                const viewer = new DiagramViewer(boardEl.id);
                viewer.load(d);
                book._viewer = viewer;
            } else {
                // Fallback to static
                const boardHtml = generateMiniBoard(d.fen, 30);
                // Animation logic for static board
                const flipClass = direction > 0 ? 'flip-right' : 'flip-left';
                boardEl.classList.add(flipClass);
                setTimeout(() => {
                    boardEl.innerHTML = boardHtml;
                    boardEl.classList.remove(flipClass);
                    boardEl.classList.add('flip-in');
                    setTimeout(() => {
                        boardEl.classList.remove('flip-in');
                    }, 200);
                }, 150);
            }
        }

        // Update UI elements
        const toMoveEl = book.querySelector('.book-to-move');
        const counterEl = book.querySelector('.book-counter');
        const typeBadgeEl = book.querySelector('.book-type-badge');

        if (toMoveEl) toMoveEl.textContent = d.toMove === 'w' ? 'Bílý na tahu' : 'Černý na tahu';
        if (counterEl) counterEl.textContent = `${current + 1} / ${diagrams.length}`;

        // Update type badge (puzzle vs diagram)
        const hasSolution = d.solution && Object.keys(d.solution).length > 0;
        if (typeBadgeEl) {
            typeBadgeEl.textContent = hasSolution ? 'Hádanka 🧩' : 'Diagram';
            typeBadgeEl.style.background = hasSolution ? 'rgba(139, 92, 246, 0.2)' : 'rgba(100, 100, 100, 0.2)';
            typeBadgeEl.style.borderColor = hasSolution ? '#8b5cf6' : '#666';
            typeBadgeEl.style.color = hasSolution ? '#a78bfa' : '#aaa';
        }

        // Update dots
        book.querySelectorAll('.book-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === current);
        });
    };

    // Dot click navigation
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('book-dot')) {
            const dot = e.target;
            const book = dot.closest('.diagram-book');
            if (!book) return;

            const targetIndex = parseInt(dot.dataset.index);
            const current = parseInt(book.dataset.current) || 0;
            const direction = targetIndex - current;

            if (direction !== 0) {
                window.bookNav(book.id, direction);
            }
        }
    });

    // Keyboard navigation when book is focused/hovered
    document.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            // Find any hovered or focused book
            const hoveredBook = document.querySelector('.diagram-book:hover');
            if (hoveredBook) {
                e.preventDefault();
                window.bookNav(hoveredBook.id, e.key === 'ArrowLeft' ? -1 : 1);
            }
        }
    });

    // Inject styles for animation and layout
    if (!document.getElementById('diagram-book-styles')) {
        const style = document.createElement('style');
        style.id = 'diagram-book-styles';
        style.textContent = `
            .diagram-book {
                user-select: none;
            }
            .mini-board-wrapper {
                flex: none !important;
                flex-shrink: 0 !important;
                flex-grow: 0 !important;
            }
            .mini-board-wrapper table {
                table-layout: fixed !important;
                border-collapse: collapse !important;
            }
            .mini-board-wrapper td {
                padding: 0 !important;
                margin: 0 !important;
                line-height: 0 !important;
                font-size: 0 !important;
            }
            .mini-board-wrapper td img {
                display: block !important;
                margin: 0 !important;
            }
            .book-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: rgba(255,255,255,0.2);
                cursor: pointer;
                transition: all 0.2s;
            }
            .book-dot.active {
                background: #d4af37;
                transform: scale(1.2);
            }
            .book-dot:hover {
                background: rgba(212, 175, 55, 0.6);
            }
            .book-prev:hover, .book-next:hover {
                background: rgba(212, 175, 55, 0.3) !important;
                color: #d4af37 !important;
            }
            .book-board-container {
                transition: transform 0.15s ease, opacity 0.15s ease;
                flex: none !important;
                flex-shrink: 0 !important;
                flex-grow: 0 !important;
                align-self: center !important;
                height: auto !important;
                transform-origin: center center;
            }
            .book-board-container.flip-right {
                transform: perspective(400px) rotateY(-15deg);
                opacity: 0.3;
            }
            .book-board-container.flip-left {
                transform: perspective(400px) rotateY(15deg);
                opacity: 0.3;
            }
            .book-board-container.flip-in {
                transform: perspective(400px) rotateY(0);
                opacity: 1;
            }
            .book-caption {
                user-select: text;
                cursor: text;
            }
            /* Fix for DiagramViewer inside book */
            .diagram-viewer-container {
                width: 100% !important;
                max-width: 280px !important;
                margin: 0 auto !important;
            }
            .diagram-board-wrapper {
                width: 100% !important;
                aspect-ratio: 1 !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize all diagram books on page load
    function initDiagramBooks() {
        const books = document.querySelectorAll('.diagram-book');
        books.forEach(book => {
            let diagrams;
            try {
                diagrams = JSON.parse(book.dataset.diagrams);
            } catch (e) {
                console.error('Failed to parse diagram data for book', book.id, e);
                return;
            }

            if (!diagrams || diagrams.length === 0) return;

            const current = parseInt(book.dataset.current) || 0;
            const d = diagrams[current];

            // Render the current board
            const boardEl = book.querySelector('.book-board-container');
            if (boardEl) {
                if (!boardEl.id) boardEl.id = 'board-container-' + book.id;

                if (typeof DiagramViewer !== 'undefined') {
                    // Use reusable DiagramViewer
                    const viewer = new DiagramViewer(boardEl.id);
                    viewer.load(d);
                    book._viewer = viewer;
                } else {
                    // Fallback static
                    const boardHtml = generateMiniBoard(d.fen, 30);
                    boardEl.innerHTML = boardHtml;
                }
            }

            // Update title and meta
            const titleEl = book.querySelector('.book-title');
            const toMoveEl = book.querySelector('.book-to-move');
            const counterEl = book.querySelector('.book-counter');

            if (titleEl) titleEl.textContent = d.title || 'Diagram';
            if (toMoveEl) toMoveEl.textContent = d.toMove === 'w' ? 'Bílý na tahu' : 'Černý na tahu';
            if (counterEl) counterEl.textContent = `${current + 1} / ${diagrams.length}`;

            // Add type badge if missing, then update
            let typeBadgeEl = book.querySelector('.book-type-badge');
            if (!typeBadgeEl) {
                typeBadgeEl = document.createElement('span');
                typeBadgeEl.className = 'book-type-badge';
                typeBadgeEl.style.cssText = 'display:inline-block;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:500;border:1px solid;margin-left:0.5rem;';
                // Insert after toMove badge
                if (toMoveEl && toMoveEl.parentNode) {
                    toMoveEl.parentNode.insertBefore(typeBadgeEl, toMoveEl.nextSibling);
                }
            }

            const hasSolution = d.solution && Object.keys(d.solution).length > 0;
            typeBadgeEl.textContent = hasSolution ? 'Hádanka 🧩' : 'Diagram';
            typeBadgeEl.style.background = hasSolution ? 'rgba(139, 92, 246, 0.2)' : 'rgba(100, 100, 100, 0.2)';
            typeBadgeEl.style.borderColor = hasSolution ? '#8b5cf6' : '#666';
            typeBadgeEl.style.color = hasSolution ? '#a78bfa' : '#aaa';
        });
    }

    // Run init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDiagramBooks);
    } else {
        // DOM is already ready
        initDiagramBooks();
    }

    // Export for dynamic content loading (article pages load content async)
    window.initDiagramBooks = initDiagramBooks;

    console.log('DiagramBook component loaded');
})();
