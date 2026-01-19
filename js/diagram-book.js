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

        // Build the table rows
        let tableHtml = '';
        for (let i = 0; i < 8; i++) {
            tableHtml += '<tr>';
            const row = rows[i] || '8';
            let colIdx = 0;

            for (const char of row) {
                if (/\d/.test(char)) {
                    const emptyCount = parseInt(char);
                    for (let k = 0; k < emptyCount; k++) {
                        const isLight = (i + colIdx) % 2 === 0;
                        const bg = isLight ? '#f0d9b5' : '#b58863';
                        tableHtml += `<td style="width:${squareSize}px;height:${squareSize}px;background:${bg};padding:0;"></td>`;
                        colIdx++;
                    }
                } else {
                    const isLight = (i + colIdx) % 2 === 0;
                    const bg = isLight ? '#f0d9b5' : '#b58863';
                    const color = char === char.toLowerCase() ? 'b' : 'w';
                    const piece = char.toUpperCase();
                    const pieceUrl = `https://chessboardjs.com/img/chesspieces/wikipedia/${color}${piece}.png`;

                    tableHtml += `<td style="width:${squareSize}px;height:${squareSize}px;background:${bg};padding:0;">
                        <img src="${pieceUrl}" style="width:${squareSize}px;height:${squareSize}px;display:block;" alt="${piece}">
                    </td>`;
                    colIdx++;
                }
            }
            tableHtml += '</tr>';
        }

        // Wrap in a fixed-size container to prevent external CSS from stretching
        return `<div class="mini-board-wrapper" style="width:${boardSize}px;height:${boardSize}px;margin:0 auto;overflow:hidden;flex:none;">
            <table style="border-collapse:collapse;width:${boardSize}px;height:${boardSize}px;table-layout:fixed;">${tableHtml}</table>
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

        if (toMoveEl) toMoveEl.textContent = d.toMove === 'w' ? 'Bílý na tahu' : 'Černý na tahu';
        if (counterEl) counterEl.textContent = `${current + 1} / ${diagrams.length}`;

        // Update dots
        book.querySelectorAll('.book-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === current);
        });
    };

    // ... (Dot click and Keyboard listeners remain same) ...

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
        });
    }

    // Run init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDiagramBooks);
    } else {
        // DOM is already ready
        initDiagramBooks();
    }

    console.log('DiagramBook component loaded');
})();
