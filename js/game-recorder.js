// Game Recorder Logic
let board = null;
let game = new Chess();
let selectedSquare = null;
let pendingPromotion = null; // Stores {source, target} during promotion check

// Playback state
let moveHistory = [];       // Full move history for navigation
let currentMoveIndex = -1;  // -1 = start position, 0 = after first move, etc.
let autoplayInterval = null;

// Track current game ID for updates (null = new game)
let currentGameId = null;

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
        // Check for promotion
        // Check for promotion
        const sourcePiece = game.get(selectedSquare);
        const targetRank = square.charAt(1);
        const isPromotion = sourcePiece.type === 'p' &&
            ((sourcePiece.color === 'w' && targetRank === '8') || (sourcePiece.color === 'b' && targetRank === '1'));

        if (isPromotion) {
            // Validate promotion intent
            const tempMove = game.move({ from: selectedSquare, to: square, promotion: 'q' });
            if (tempMove) {
                game.undo(); // Revert test move
                pendingPromotion = { source: selectedSquare, target: square };
                showPromotionModal(game.turn());
                return;
            }
        }

        const move = game.move({
            from: selectedSquare,
            to: square,
            promotion: 'q' // Fallback
        });

        if (move) {
            // Valid move!
            board.position(game.fen());
            updateStatus();
            updateMoveHistory(); // Update history immediately
            removeHighlights();
            highlightMove(selectedSquare, square);
            selectedSquare = null;
            return;
        }

        // 2. If move invalid...
        // ... (rest is same)

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
    // Check for promotion
    const piece = game.get(source);
    const targetRank = target.charAt(1);
    const isPromotion = piece.type === 'p' &&
        ((piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1'));

    if (isPromotion) {
        pendingPromotion = { source: source, target: target };
        showPromotionModal(game.turn());
        return 'snapback'; // Don't move on board yet
    }

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
    updateMoveHistory(); // Update history
    removeHighlights();
    highlightMove(source, target);
    selectedSquare = null;
}

function onSnapEnd() {
    board.position(game.fen());
}

// Undo last move
function undoMove() {
    const move = game.undo();
    if (move) {
        board.position(game.fen());
        updateStatus();
        updateMoveHistory();
        removeHighlights();
    }
}

// Playback controls - for reviewing recorded games
// (Variables playbackMoves, playbackIndex, autoplayInterval are at top of file)

function goToStart() {
    // Reset to starting position
    game.reset();
    board.position('start');
    playbackIndex = 0;
    updateStatus();
    updateMoveHistory();
    removeHighlights();
}

function goBack() {
    const move = game.undo();
    if (move) {
        board.position(game.fen());
        playbackIndex = Math.max(0, playbackIndex - 1);
        updateStatus();
        updateMoveHistory();
        removeHighlights();
    }
}

function goForward() {
    // This requires knowing the full move list
    // For now, just replay from history if available
    const history = game.history({ verbose: true });
    // Cannot go forward past current position in recording mode
    console.log('goForward not available in recording mode');
}

function goToEnd() {
    // In recording mode, already at end
    console.log('Already at end in recording mode');
}

function toggleAutoplay() {
    if (autoplayInterval) {
        clearInterval(autoplayInterval);
        autoplayInterval = null;
    } else {
        autoplayInterval = setInterval(() => {
            goForward();
        }, 1000);
    }
}

// --- Promotion Logic ---

function showPromotionModal(color) {
    const modal = document.getElementById('promotionModal');
    if (modal) {
        modal.classList.add('active');
        // Update piece images based on color
        const prefix = color === 'w' ? 'w' : 'b';
        document.querySelectorAll('.promotion-piece img').forEach(img => {
            const pieceType = img.getAttribute('data-piece').toUpperCase();
            img.src = `https://chessboardjs.com/img/chesspieces/wikipedia/${prefix}${pieceType}.png`;
        });
        console.log('Promotion modal shown for:', color);
    } else {
        console.error('Promotion modal not found!');
    }
}

function completePromotion(pieceType) {
    console.log('Completing promotion with:', pieceType);
    const modal = document.getElementById('promotionModal');
    if (modal) modal.classList.remove('active');

    if (pendingPromotion) {
        const move = game.move({
            from: pendingPromotion.source,
            to: pendingPromotion.target,
            promotion: pieceType
        });

        if (move) {
            console.log('Promotion successful:', move);
            board.position(game.fen());
            updateStatus();
            updateMoveHistory(); // Sync history
            removeHighlights();
            highlightMove(pendingPromotion.source, pendingPromotion.target);
        } else {
            console.error('Promotion move failed:', pendingPromotion);
            alert('Neplatný tah povýšení.');
            board.position(game.fen()); // Reset board visual
        }
        pendingPromotion = null;
        selectedSquare = null;
    } else {
        console.warn('No pending promotion found.');
    }
}
window.completePromotion = completePromotion; // Export for HTML onclick

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
        // Use PUT for update if we have a game ID, POST for new game
        const isUpdate = currentGameId !== null;
        const url = isUpdate ? `${API_URL}/games/${currentGameId}` : `${API_URL}/games`;
        const method = isUpdate ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: method,
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
            status.innerText = isUpdate ? 'Partie úspěšně aktualizována!' : 'Partie úspěšně uložena!';
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

        // Store game ID for updates
        currentGameId = parseInt(id);

        document.getElementById('whitePlayer').value = gameData.white;
        document.getElementById('blackPlayer').value = gameData.black;
        document.getElementById('result').value = gameData.result;

        if (gameData.pgn) {
            game.load_pgn(gameData.pgn);
            board.position(game.fen());
            updateStatus();

            // Initialize playback history
            moveHistory = game.history({ verbose: true });
            currentMoveIndex = moveHistory.length - 1;
        }

        // Update save button text to indicate update mode
        const saveBtn = document.querySelector('.main-btn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fa-solid fa-save"></i> Aktualizovat Partii';
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
    // Mobile Modal Logic - explicitly attached
    const infoBtn = document.querySelector('.mobile-only-btn');
    if (infoBtn) {
        infoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('gameSidebar').classList.add('active');
            document.body.classList.add('modal-open');
        });
    }

    const closeBtn = document.querySelector('.btn-close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('gameSidebar').classList.remove('active');
            document.body.classList.remove('modal-open');
        });
    }

    // Expose globals for other HTML buttons (legacy)
    window.game = game;
    window.undoMove = undoMove;
    window.saveGame = saveGame;
    window.copyPgn = copyPgn;
    window.downloadPgn = downloadPgn;
    window.openGameInfo = openGameInfo;
    window.closeGameInfo = closeGameInfo;

    // Playback controls
    window.goToStart = goToStart;
    window.goBack = goBack;
    window.goForward = goForward;
    window.goToEnd = goToEnd;
    window.toggleAutoplay = toggleAutoplay;

    // Initialize Chessboard
    var config = {
        draggable: true,
        position: 'start',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        pieceTheme: 'https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/img/chesspieces/wikipedia/{piece}.png'
    };
    board = Chessboard('board', config);
    window.board = board;

    window.addEventListener('resize', board.resize);

    // Load game by ID if present in URL
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
    document.body.addEventListener('touchstart', handleInput, true); // Mobile touch support
});
