// Game Recorder Logic
let board = null;
let game = new Chess();
let selectedSquare = null;

// --- Click-to-Move & Highlight Logic ---

function removeHighlights() {
    $('#board .square-55d63').removeClass('highlight-selected');
    $('#board .square-55d63').removeClass('highlight-move');
    $('#board .square-55d63').find('.hint-dot').remove(); // Remove dots
}

function highlightSquare(square) {
    $('#board .square-' + square).addClass('highlight-selected');
}

function highlightMove(source, target) {
    $('#board .square-' + source).addClass('highlight-move');
    $('#board .square-' + target).addClass('highlight-move');
}

function showLegalMoves(square) {
    const moves = game.moves({ square: square, verbose: true });
    moves.forEach(move => {
        const squareEl = $('#board .square-' + move.to);
        // Avoid adding multiple dots
        if (squareEl.find('.hint-dot').length === 0) {
            squareEl.append('<div class="hint-dot"></div>');
        }
    });
}

function handleSquareClick(square) {
    // If we have a selected square
    if (selectedSquare) {
        // 1. Try to move to the clicked square
        const move = game.move({
            from: selectedSquare,
            to: square,
            promotion: 'q' // Simplification for click-to-move
        });

        if (move) {
            // Valid move!
            board.position(game.fen());
            updateStatus();
            removeHighlights();
            highlightMove(selectedSquare, square);
            selectedSquare = null;
            return;
        }

        // 2. If move invalid, check if we clicked another own piece (switch selection)
        // Check piece on clicked square
        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
            removeHighlights();
            selectedSquare = square;
            highlightSquare(square);
            showLegalMoves(square);
        } else {
            // Clicked empty or opponent piece (invalid move) -> Deselect
            removeHighlights();
            selectedSquare = null;
        }
    } else {
        // No selection. Check if clicked own piece
        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
            selectedSquare = square;
            highlightSquare(square);
            showLegalMoves(square);
        }
    }
}


// --- Chessboard Callbacks ---

function onDragStart(source, piece, position, orientation) {
    if (game.game_over()) return false;
    // only pick up pieces for the side to move
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }

    // Sync selection with drag
    removeHighlights();
    selectedSquare = source;
    highlightSquare(source);
    showLegalMoves(source);
}

function onDrop(source, target) {
    // see if the move is legal
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    // illegal move
    if (move === null) {
        removeHighlights();
        selectedSquare = null;
        return 'snapback';
    }

    updateStatus();
    removeHighlights();
    highlightMove(source, target);
    selectedSquare = null;
}

function onSnapEnd() {
    board.position(game.fen());
}

// --- Game Control Logic ---

function updateStatus() {
    updatePgnDisplay();
}

function updatePgnDisplay() {
    const pgn = game.pgn();
    const pgnEl = document.getElementById('pgnOutput');
    if (pgnEl) pgnEl.value = pgn;

    // Render nice move list
    const history = game.history();
    const listEl = document.getElementById('moveList');
    if (listEl) {
        listEl.innerHTML = '';
        for (let i = 0; i < history.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const whiteMove = history[i];
            const blackMove = history[i + 1] || '';

            const div = document.createElement('div');
            div.className = 'move-pair';
            div.innerHTML = `
                <span class="move-number">${moveNum}.</span>
                <span class="move">${whiteMove}</span>
                ${blackMove ? `<span class="move">${blackMove}</span>` : ''}
            `;
            listEl.appendChild(div);
        }
        listEl.scrollTop = listEl.scrollHeight;
    }
}

function undoMove() {
    game.undo();
    board.position(game.fen());
    updateStatus();
    removeHighlights();
    selectedSquare = null;
}

// --- IO Logic ---

async function saveGame() {
    const white = document.getElementById('whitePlayer').value;
    const black = document.getElementById('blackPlayer').value;
    const result = document.getElementById('result').value;

    const token = localStorage.getItem('club_auth_token');
    if (!token) {
        const status = document.getElementById('saveStatus');
        status.style.color = 'red';
        status.innerText = 'Pro uložení se musíte přihlásit v členské sekci!';
        return;
    }

    if (!white || !black) {
        alert('Vyplňte jména hráčů!');
        return;
    }

    const pgnHeader = `[White "${white}"]\n[Black "${black}"]\n[Result "${result}"]\n[Date "${new Date().toISOString().split('T')[0]}"]\n\n`;
    const fullPgn = pgnHeader + game.pgn();

    const btn = document.querySelector('.main-btn');
    const status = document.getElementById('saveStatus');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ukládám...';
    status.innerText = '';

    try {
        const res = await fetch(`${API_URL}/games`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Club-Password': token
            },
            body: JSON.stringify({
                white,
                black,
                result,
                pgn: fullPgn,
                event: 'Web Editor Game'
            })
        });

        if (res.ok) {
            status.style.color = '#4ade80';
            status.innerText = 'Partie úspěšně uložena!';
            setTimeout(() => {
                window.location.href = 'members.html';
            }, 1500);
        } else {
            throw new Error('Save failed');
        }
    } catch (e) {
        console.error(e);
        status.style.color = 'red';
        status.innerText = 'Chyba při ukládání.';
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-save"></i> Uložit Partii';
    }
}

async function loadGameById(id) {
    try {
        const apiUrl = window.API_URL || '/api';
        let token = localStorage.getItem('club_auth_token');

        let res = await fetch(`${apiUrl}/games/${id}`, {
            headers: { 'X-Club-Password': token || '' }
        });

        if (res.status === 401 || res.status === 403) {
            const password = prompt('Pro zobrazení partie zadejte heslo oddílu:');
            if (password) {
                res = await fetch(`${apiUrl}/games/${id}`, {
                    headers: { 'X-Club-Password': password }
                });
                if (res.ok) localStorage.setItem('club_auth_token', password);
            }
        }

        if (!res.ok) throw new Error('Game not found');

        const gameData = await res.json();
        document.getElementById('whitePlayer').value = gameData.white;
        document.getElementById('blackPlayer').value = gameData.black;
        document.getElementById('result').value = gameData.result;

        if (gameData.pgn) {
            game.load_pgn(gameData.pgn);
            board.position(game.fen());
            updateStatus();
        }
    } catch (e) {
        console.error(e);
        alert(`Nepodařilo se načíst partii: ${e.message}`);
    }
}

function copyPgn() {
    const pgnText = document.getElementById('pgnOutput');
    pgnText.select();
    document.execCommand('copy');
    if (navigator.clipboard) {
        navigator.clipboard.writeText(pgnText.value).then(() => {
            // Find active element or fallback
            const btn = document.querySelector('button[onclick="copyPgn()"]');
            if (btn) {
                const originalhtml = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Zkopírováno';
                setTimeout(() => btn.innerHTML = originalhtml, 2000);
            }
        });
    }
}

function downloadPgn() {
    const pgn = game.pgn();
    const white = document.getElementById('whitePlayer').value || 'White';
    const black = document.getElementById('blackPlayer').value || 'Black';
    const filename = `${white}_vs_${black}.pgn`.replace(/[^a-z0-9]/gi, '_');

    const element = document.createElement('a');
    element.setAttribute('href', 'data:application/x-chess-pgn;charset=utf-8,' + encodeURIComponent(pgn));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

// Mobile Modal Logic
function openGameInfo() {
    document.getElementById('gameSidebar').classList.add('active');
    document.body.classList.add('modal-open');
}

function closeGameInfo() {
    document.getElementById('gameSidebar').classList.remove('active');
    document.body.classList.remove('modal-open');
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // Expose globals for HTML buttons
    window.game = game;
    window.undoMove = undoMove;
    window.saveGame = saveGame;
    window.copyPgn = copyPgn;
    window.downloadPgn = downloadPgn;
    window.openGameInfo = openGameInfo;
    window.closeGameInfo = closeGameInfo;

    var config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };
    board = Chessboard('board', config);
    // Expose board
    window.board = board;

    window.addEventListener('resize', board.resize);

    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('id');
    if (gameId) {
        loadGameById(gameId);
    }

    // ROBUST CLICK HANDLING (Capture Phase)
    const handleInput = (e) => {
        const boardContainer = document.getElementById('board');
        if (!boardContainer || !boardContainer.contains(e.target)) return;

        const squareEl = e.target.closest('.square-55d63');
        if (!squareEl) return;

        const squareId = squareEl.getAttribute('data-square');
        if (squareId) {
            handleSquareClick(squareId);
        }
    };

    document.body.addEventListener('mousedown', handleInput, true);
    // Touch support optional/handled by mouse emulation or add touchstart if needed
});
