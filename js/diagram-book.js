/**
 * Diagram Book Component
 * Renders interactive book-style diagram carousels in articles
 * Reusable across news articles and other pages
 */

(function () {
    'use strict';

    // Helper function to determine who is to move
    function getToMoveText(diagram) {
        let turn = diagram.toMove;
        // If not specified, try to get from FEN
        if (!turn && diagram.fen) {
            const fenParts = diagram.fen.split(' ');
            if (fenParts.length > 1) {
                turn = fenParts[1]; // 'w' or 'b'
            }
        }
        // Default to white if still unknown
        if (!turn) turn = 'w';
        return turn === 'w' ? 'Bílý na tahu' : 'Černý na tahu';
    }

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
        const toMoveStandalone = book.querySelector('.book-to-move-standalone');
        const counterEl = book.querySelector('.book-counter');


        if (toMoveEl) toMoveEl.textContent = getToMoveText(d);
        if (toMoveStandalone) toMoveStandalone.textContent = getToMoveText(d);
        if (counterEl) counterEl.textContent = `${current + 1} / ${diagrams.length}`;

        const descriptionEl = book.querySelector('.book-description');
        if (descriptionEl) descriptionEl.textContent = d.description || d.name || '';



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
                display: flex;
                flex-direction: column;
                align-items: center;
                background: linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98));
                border-radius: 16px;
                padding: 1.25rem;
                box-shadow: 0 10px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.08);
                max-width: 400px;
                margin: 1rem 0 1rem 1.5rem;
                float: right;
                clear: right;
            }
            .book-meta-row {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.75rem;
                width: 100%;
                margin-top: 0.75rem;
                padding: 0.5rem 0;
            }
            .book-to-move {
                font-size: 0.9rem;
                color: rgba(255,255,255,0.7);
                font-weight: 500;
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
            .book-nav-row {
                display: flex;
                justify-content: space-between;
                width: 100%;
                margin-top: 0.35rem;
                padding: 0.4rem 0;
            }
            .book-nav {
                justify-content: space-between !important;
                width: 100% !important;
                margin-top: 0.35rem !important;
                padding: 0.4rem 0 !important;
            }
            .book-prev, .book-next {
                background: rgba(255,255,255,0.08) !important;
                border: 1px solid rgba(255,255,255,0.1) !important;
                border-radius: 8px !important;
                width: 36px !important;
                height: 36px !important;
                padding: 0 !important;
                color: rgba(255,255,255,0.7) !important;
                cursor: pointer;
                transition: all 0.2s ease !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
            }
            .book-prev:hover, .book-next:hover {
                background: rgba(212, 175, 55, 0.2) !important;
                color: #d4af37 !important;
                border-color: rgba(212, 175, 55, 0.3) !important;
            }
            .book-meta-row {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.35rem 0.75rem;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                border: 1px solid rgba(255,255,255,0.08);
            }
            .book-counter {
                font-size: 0.8rem;
                color: rgba(255,255,255,0.5);
            }
            .book-board-container {
                transition: transform 0.15s ease, opacity 0.15s ease;
                flex: none !important;
                flex-shrink: 0 !important;
                flex-grow: 0 !important;
                align-self: center !important;
                height: auto !important;
                transform-origin: center center;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
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
                user-select: none;
                cursor: default;
                font-size: 0.85rem;
                color: rgba(255,255,255,0.6);
                text-align: center;
                margin-top: 0.5rem;
            }
            /* Fix for DiagramViewer inside book */
            .diagram-viewer-container {
                width: 100% !important;
                max-width: none !important;
                margin: 0 auto !important;
                background: transparent !important;
            }
            .diagram-board-wrapper {
                width: 100% !important;
                min-width: 200px !important;
                aspect-ratio: 1 !important;
                border-radius: 8px !important;
                overflow: hidden !important;
            }
            /* Feedback panel styling */
            .diagram-viewer-container .diagram-feedback {
                border-radius: 8px !important;
                margin-top: 0.75rem !important;
                font-size: 0.9rem !important;
            }
            /* Type badge styling - elegant puzzle indicator */
            .diagram-book .diagram-type-badge {
                position: absolute !important;
                top: -12px !important;
                right: -20px !important;
                background: linear-gradient(135deg, rgba(30,30,30,0.95), rgba(50,50,50,0.9)) !important;
                backdrop-filter: blur(12px) !important;
                border: 1px solid rgba(212, 175, 55, 0.4) !important;
                border-radius: 8px !important;
                width: 32px !important;
                height: 32px !important;
                padding: 0 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 0.9rem !important; /* Slightly larger icon */
                color: #d4af37 !important;
                z-index: 100 !important;
                pointer-events: none !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 20px rgba(212, 175, 55, 0.15) !important;
                text-shadow: 0 1px 2px rgba(0,0,0,0.3) !important;
                letter-spacing: normal !important;
            }
            /* Allow badge to overflow - multiple levels needed */
            .diagram-book .diagram-board-wrapper,
            .diagram-book .diagram-viewer-container,
            .diagram-book .book-board-container,
            .diagram-book {
                overflow: visible !important;
            }
            /* Hide internal reset button in book mode - use book-reset-btn instead */
            .diagram-book .diagram-reset-btn {
                display: none !important;
            }
            .book-reset-btn {
                background: rgba(255,255,255,0.1) !important;
                border: 1px solid rgba(255,255,255,0.1) !important;
                border-radius: 50%;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.25s ease;
                color: rgba(255,255,255,0.6);
                cursor: pointer;
                font-size: 0.75rem;
                flex-shrink: 0;
            }
            .book-reset-btn:hover {
                background: rgba(212, 175, 55, 0.2) !important;
                border-color: rgba(212, 175, 55, 0.3) !important;
                transform: rotate(-180deg);
                color: #d4af37 !important;
            }
            /* Diagram inside column blocks - constrain width */
            .content-columns .diagram-book {
                max-width: 100% !important;
                float: none !important;
                margin: 0 auto !important;
                overflow: hidden;
            }
            /* Mobile: full-width diagram but with small margins */
            @media (max-width: 600px) {
                .diagram-book {
                    max-width: none !important;
                    width: calc(100% + 1rem) !important; 
                    margin: 1.5rem -0.5rem !important;
                    border-radius: 8px !important;
                    border-left: 1px solid rgba(255,255,255,0.08) !important;
                    border-right: 1px solid rgba(255,255,255,0.08) !important;
                    padding: 1rem 0.5rem !important;
                    float: none !important;
                    clear: none !important;
                }
                .diagram-viewer-container {
                    max-width: 100% !important;
                    width: 100% !important;
                }
                .diagram-board-wrapper {
                    width: 100% !important;
                    min-width: 0 !important;
                }
                .book-caption {
                    font-size: 0.9rem;
                    padding: 0 0.5rem;
                }
                /* Smaller type badge on mobile */
                .diagram-book .diagram-type-badge {
                    width: 24px !important;
                    height: 24px !important;
                    font-size: 0.7rem !important;
                    top: -8px !important;
                    right: -12px !important;
                }
                /* Compact meta row on mobile */
                .book-meta-row-standalone {
                    padding: 0.25rem 0.5rem !important;
                    gap: 0.35rem !important;
                    margin-top: 0.35rem !important;
                }
                .book-meta-row-standalone .book-to-move-standalone {
                    font-size: 0.7rem !important;
                }
                .book-reset-btn {
                    width: 24px !important;
                    height: 24px !important;
                    font-size: 0.65rem !important;
                }
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
            const counterEl = book.querySelector('.book-counter');

            if (titleEl) titleEl.textContent = d.title || 'Diagram';
            if (counterEl) counterEl.textContent = `${current + 1} / ${diagrams.length}`;

            // Create standalone meta-row with reset button OUTSIDE .book-nav
            // so it's always visible even for single-diagram books
            let metaRow = book.querySelector('.book-meta-row-standalone');
            if (!metaRow) {
                metaRow = document.createElement('div');
                metaRow.className = 'book-meta-row-standalone';
                metaRow.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.35rem 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); margin-top: 0.5rem; width: 100%;';

                // Reset button
                const resetBtn = document.createElement('button');
                resetBtn.className = 'book-reset-btn';
                resetBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
                resetBtn.title = 'Resetovat pozici';
                resetBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (book._viewer && typeof book._viewer.reset === 'function') {
                        book._viewer.reset();
                    }
                };
                metaRow.appendChild(resetBtn);

                // To-move text
                const toMoveSpan = document.createElement('span');
                toMoveSpan.className = 'book-to-move-standalone';
                toMoveSpan.style.cssText = 'font-size: 0.8rem; color: rgba(255,255,255,0.7);';
                toMoveSpan.textContent = getToMoveText(d);
                metaRow.appendChild(toMoveSpan);

                // Insert after board container but before .book-nav
                const navEl = book.querySelector('.book-nav');
                if (navEl) {
                    book.insertBefore(metaRow, navEl);
                } else {
                    // Insert after board container
                    const boardContainer = book.querySelector('.book-board-container');
                    if (boardContainer && boardContainer.nextSibling) {
                        book.insertBefore(metaRow, boardContainer.nextSibling);
                    } else {
                        book.appendChild(metaRow);
                    }
                }
            } else {
                // Update existing to-move text
                const toMoveSpan = metaRow.querySelector('.book-to-move-standalone');
                if (toMoveSpan) toMoveSpan.textContent = getToMoveText(d);
            }


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
