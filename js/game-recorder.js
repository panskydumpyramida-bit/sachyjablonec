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

// Comments storage: FEN -> Comment String
let moveComments = {};
// NAG storage: FEN -> NAG String (e.g. "$1")
let moveNags = {};

// Helper: Normalize FEN (remove move counters for more stable keying if needed, but standard FEN is fine for specific positions)
// We will use full FEN to ensure unique positions (including castling rights/en passant) have their own comments.
const getFenKey = () => game.fen();

// --- Status and History Updates ---

function updateStatus() {
    // Update PGN output textarea
    const pgnOutput = document.getElementById('pgnOutput');
    if (pgnOutput) {
        pgnOutput.value = generateAnnotatedPgn();
    }

    const key = getFenKey();

    // Sync Comment Textarea
    const commentBox = document.getElementById('moveComment');
    if (commentBox) {
        commentBox.value = moveComments[key] || '';
    }

    // Sync Bubble Overlay
    const bubble = document.getElementById('recorder-board-overlay');
    if (bubble) {
        const comment = moveComments[key];
        const nag = moveNags[key];
        const nagSymbols = { '$1': '!', '$2': '?', '$3': '!!', '$4': '??', '$5': '!?', '$6': '?!' };

        let text = '';
        if (nag && nagSymbols[nag]) text += `<strong>${nagSymbols[nag]}</strong> `;
        if (comment) text += comment;

        if (text) {
            bubble.innerHTML = text;
            bubble.style.display = 'block';
        } else {
            bubble.style.display = 'none';
        }
    }

    // Highlight Active NAG Button
    const buttons = document.querySelectorAll('button[onclick^="toggleNag"]');
    buttons.forEach(btn => {
        const nagCode = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
        if (moveNags[key] === nagCode) {
            btn.style.border = '2px solid #fff';
            btn.style.transform = 'scale(1.1)';
            btn.style.boxShadow = '0 0 10px rgba(255,255,255,0.5)';
        } else {
            btn.style.border = 'none';
            btn.style.transform = 'none';
            btn.style.boxShadow = 'none';
        }
    });

    updateNagMarkerOnBoard(key);
}

function updateNagMarkerOnBoard(fenKey) {
    // Remove existing
    const existing = document.querySelectorAll('.board-nag-marker');
    existing.forEach(e => e.remove());

    const nag = moveNags[fenKey];
    if (!nag) return;

    // We need the move that CAUSED this position to know the target square.
    // FEN doesn't tell us the last move target square directly.
    // But we have `game.history({verbose:true})`. The last move in history corresponds to current position IF we are at end.
    // But if we are navigating history? 
    // `game-recorder.js` uses `game` object that represents CURRENT board state.
    // So `game.history().pop()` is the move that led to current state.

    const history = game.history({ verbose: true });
    const lastMove = history[history.length - 1];

    if (!lastMove) return; // Start position

    const target = lastMove.to;
    const nagSymbols = { '$1': '!', '$2': '?', '$3': '!!', '$4': '??', '$5': '!?', '$6': '?!' };
    const symbol = nagSymbols[nag];
    const colorMap = { '$1': '#4ade80', '$2': '#f87171', '$3': '#22c55e', '$4': '#ef4444', '$5': '#60a5fa', '$6': '#fbbf24' };
    const color = colorMap[nag] || '#fff';

    if (!symbol) return;

    // Position calc
    const files = 'abcdefgh';
    const fileIdx = files.indexOf(target[0]);
    const rankIdx = parseInt(target[1]) - 1;

    const orientation = board.orientation();

    let topP, leftP;
    const squareSize = 12.5;

    // Position at Top-Right quadrant of the square (approx 85% x 10%)
    if (orientation === 'white') {
        leftP = (fileIdx * squareSize) + (squareSize * 0.85);
        topP = ((7 - rankIdx) * squareSize) + (squareSize * 0.1);
    } else {
        leftP = ((7 - fileIdx) * squareSize) + (squareSize * 0.85);
        topP = (rankIdx * squareSize) + (squareSize * 0.1);
    }

    const marker = document.createElement('div');
    marker.className = 'board-nag-marker';
    marker.innerText = symbol;

    // Inline styles for recorder
    marker.style.position = 'absolute';
    marker.style.left = leftP + '%';
    marker.style.top = topP + '%';
    marker.style.width = '2rem';
    marker.style.height = '2rem';
    marker.style.display = 'flex';
    marker.style.alignItems = 'center';
    marker.style.justifyContent = 'center';
    marker.style.fontWeight = '800';
    marker.style.fontSize = '1.2rem';
    marker.style.color = '#fff';
    marker.style.backgroundColor = color;
    marker.style.borderRadius = '50%';
    marker.style.boxShadow = '0 2px 5px rgba(0,0,0,0.5)';
    marker.style.border = '2px solid white';
    marker.style.zIndex = '100';
    marker.style.pointerEvents = 'none';
    marker.style.transform = 'translate(-50%, -50%)';

    // Append to board container
    const boardEl = document.getElementById('board');
    if (!boardEl) return;

    // We attach to the parent of the board to overlay the marker
    // Ensure parent is positioned relatively so absolute marker coordinates work
    const boardContainer = boardEl.parentNode;
    if (boardContainer) {
        if (getComputedStyle(boardContainer).position === 'static') {
            boardContainer.style.position = 'relative';
        }
        boardContainer.appendChild(marker);
    }
}

function updateMoveHistory() {
    const moveListEl = document.getElementById('moveList');
    if (!moveListEl) return;

    // Use savedMoves if we're in navigation mode, otherwise current game history
    const history = savedMoves.length > 0 ? savedMoves : game.history({ verbose: true });
    const currentPosition = savedMoves.length > 0 ? currentMoveIdx : history.length;

    if (history.length === 0) {
        moveListEl.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">Partie začíná...</span>';
        return;
    }

    // Build move list HTML
    let html = '';
    for (let i = 0; i < history.length; i += 2) {
        const moveNumber = Math.floor(i / 2) + 1;
        const whiteMove = history[i]?.san || '';
        const blackMove = history[i + 1]?.san || '';

        // Highlight current position
        const whiteActive = (i + 1) === currentPosition ? 'active' : '';
        const blackActive = (i + 2) === currentPosition ? 'active' : '';
        const whiteFuture = (i + 1) > currentPosition ? 'future' : '';
        const blackFuture = (i + 2) > currentPosition ? 'future' : '';

        html += `<div class="move-pair">
            <span class="move-number">${moveNumber}.</span>
            <span class="move ${whiteActive} ${whiteFuture}" data-ply="${i}">${whiteMove}</span>
            ${blackMove ? `<span class="move ${blackActive} ${blackFuture}" data-ply="${i + 1}">${blackMove}</span>` : ''}
        </div>`;
    }

    moveListEl.innerHTML = html;

    // Add click handlers for move navigation
    moveListEl.querySelectorAll('.move').forEach(moveEl => {
        moveEl.addEventListener('click', () => {
            const ply = parseInt(moveEl.getAttribute('data-ply'));
            jumpToMove(ply + 1); // ply is 0-indexed, jumpToMove expects 1-indexed
        });
    });

    // Scroll to current move
    const activeMove = moveListEl.querySelector('.move.active');
    if (activeMove) {
        activeMove.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

// Jump to specific move by ply number (1-indexed)
function jumpToMove(targetPly) {
    // Ensure we have saved history
    if (savedMoves.length === 0 && game.history().length > 0) {
        saveCurrentHistory();
    }

    if (savedMoves.length === 0) return;

    // Clamp target to valid range
    targetPly = Math.max(0, Math.min(targetPly, savedMoves.length));

    // Reset and replay to target position
    game.reset();
    for (let i = 0; i < targetPly; i++) {
        game.move(savedMoves[i]);
    }

    currentMoveIdx = targetPly;
    board.position(game.fen());
    updateStatus();
    updateMoveHistory();

    // Highlight last move
    if (targetPly > 0) {
        const lastMove = savedMoves[targetPly - 1];
        highlightMove(lastMove.from, lastMove.to);
    } else {
        removeHighlights();
    }
}

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
    if (!piece) return 'snapback'; // No piece at source

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
// savedMoves stores the complete move history for navigation
let savedMoves = [];
let currentMoveIdx = 0;

function saveCurrentHistory() {
    // Save current game history for navigation
    savedMoves = game.history({ verbose: true });
    currentMoveIdx = savedMoves.length;
}

function goToStart() {
    // Save history before navigation if not already saved
    if (savedMoves.length === 0 && game.history().length > 0) {
        saveCurrentHistory();
    }

    // Reset to starting position
    game.reset();
    board.position('start');
    currentMoveIdx = 0;
    updateStatus();
    updateMoveHistory();
    removeHighlights();
}

function goBack() {
    // Save history before first navigation
    if (savedMoves.length === 0 && game.history().length > 0) {
        saveCurrentHistory();
    }

    const move = game.undo();
    if (move) {
        currentMoveIdx = Math.max(0, currentMoveIdx - 1);
        board.position(game.fen());
        updateStatus();
        updateMoveHistory();
        removeHighlights();
    }
}

function goForward() {
    // Can only go forward if we have saved moves and aren't at the end
    if (savedMoves.length === 0 || currentMoveIdx >= savedMoves.length) {
        return;
    }

    const moveToPlay = savedMoves[currentMoveIdx];
    if (moveToPlay) {
        game.move(moveToPlay);
        currentMoveIdx++;
        board.position(game.fen());
        updateStatus();
        updateMoveHistory();
        highlightMove(moveToPlay.from, moveToPlay.to);
    }
}

function goToEnd() {
    // Replay all remaining moves
    while (currentMoveIdx < savedMoves.length) {
        const moveToPlay = savedMoves[currentMoveIdx];
        if (moveToPlay) {
            game.move(moveToPlay);
            currentMoveIdx++;
        } else {
            break;
        }
    }

    board.position(game.fen());
    updateStatus();
    updateMoveHistory();

    // Highlight last move
    if (savedMoves.length > 0) {
        const lastMove = savedMoves[savedMoves.length - 1];
        highlightMove(lastMove.from, lastMove.to);
    }
}

function toggleAutoplay() {
    if (autoplayInterval) {
        clearInterval(autoplayInterval);
        autoplayInterval = null;
        document.getElementById('autoplayBtn').innerHTML = '<i class="fa-solid fa-play"></i>';
    } else {
        // Save history if needed
        if (savedMoves.length === 0 && game.history().length > 0) {
            saveCurrentHistory();
        }

        document.getElementById('autoplayBtn').innerHTML = '<i class="fa-solid fa-pause"></i>';
        autoplayInterval = setInterval(() => {
            if (currentMoveIdx >= savedMoves.length) {
                clearInterval(autoplayInterval);
                autoplayInterval = null;
                document.getElementById('autoplayBtn').innerHTML = '<i class="fa-solid fa-play"></i>';
                return;
            }
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
    const fullPgn = pgnHeader + generateAnnotatedPgn();

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

function extractAnnotationsFromPgn(pgnText) {
    if (!pgnText) return;

    // Clean headers
    const body = pgnText.replace(/\[.*?\]/g, '');

    // Simple tokenizer: match comments {...}, NAGs $n, moves/numbers
    // Note: We strip variations (...) for simplicity in Recorder for now as we don't fully support editing trees yet
    const cleanBody = body.replace(/\([^\)]*\)/g, '');

    const tokens = cleanBody.match(/(\{[^}]+\})|(\$[0-9]+)|([a-zA-Z0-9_+#=:-]+)/g);
    if (!tokens) return;

    const tempGame = new Chess();
    // Reset global stores
    moveComments = {};
    moveNags = {};

    tokens.forEach(token => {
        if (token.startsWith('{')) {
            const comment = token.replace(/^\{|\}$/g, '').trim();
            if (comment) moveComments[tempGame.fen()] = comment;
        } else if (token.startsWith('$')) {
            moveNags[tempGame.fen()] = token;
        } else {
            // Skip move numbers
            if (token.match(/^[0-9]+\.$/)) return;

            // Attempt move
            tempGame.move(token);
        }
    });

    // Update UI
    updateStatus();
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
            extractAnnotationsFromPgn(gameData.pgn);
            board.position(game.fen());

            // Initialize playback history
            moveHistory = game.history({ verbose: true });
            currentMoveIndex = moveHistory.length - 1;

            saveCurrentHistory(); // Initialize navigation history
            updateStatus();       // Update markers and textareas
            updateMoveHistory();  // RENDER THE MOVE LIST
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
    const pgnText = generateAnnotatedPgn();
    if (navigator.clipboard) {
        navigator.clipboard.writeText(pgnText).then(() => {
            const btn = document.querySelector('button[onclick="copyPgn()"]');
            if (btn) {
                const originalhtml = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Zkopírováno';
                setTimeout(() => btn.innerHTML = originalhtml, 2000);
            }
        });
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = pgnText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

function downloadPgn() {
    const pgn = generateAnnotatedPgn();
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

// --- Import PGN Modal ---

function showImportPgnModal() {
    // Prevent accidental overwrite
    if (game.history().length > 0) {
        if (!confirm('Vložení PGN přepíše aktuální partii. Chcete pokračovat?')) {
            return;
        }
    }

    const modal = document.getElementById('importPgnModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('importPgnInput').value = '';
        document.getElementById('fileUploadLabel').textContent = 'Vybrat soubor .pgn';
        document.getElementById('pgnFileInput').value = '';
        document.getElementById('importPgnInput').focus();
    }
}
window.showImportPgnModal = showImportPgnModal;

function closeImportPgnModal() {
    const modal = document.getElementById('importPgnModal');
    if (modal) {
        modal.style.display = 'none';
    }
}
window.closeImportPgnModal = closeImportPgnModal;

// Handle PGN file selection
function handlePgnFileSelect(input) {
    const file = input.files[0];
    if (!file) return;

    const label = document.getElementById('fileUploadLabel');
    label.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function (e) {
        document.getElementById('importPgnInput').value = e.target.result;
    };
    reader.onerror = function () {
        alert('Nepodařilo se načíst soubor.');
        label.textContent = 'Vybrat soubor .pgn';
    };
    reader.readAsText(file);
}
window.handlePgnFileSelect = handlePgnFileSelect;

function resetEditor() {
    if (confirm('Opravdu chcete resetovat celou partii? Přijdete o neuložená data.')) {
        game.reset();
        board.position('start');
        moveComments = {};
        moveNags = {};
        updateStatus();
        updateMoveHistory();
        removeHighlights();

        // Clear inputs
        document.getElementById('whitePlayer').value = '';
        document.getElementById('blackPlayer').value = '';
        document.getElementById('result').value = '*';
    }
}
window.resetEditor = resetEditor;

function importPgn() {
    const pgnText = document.getElementById('importPgnInput').value.trim();

    if (!pgnText) {
        alert('Vložte prosím PGN zápis.');
        return;
    }

    // Reset game and try to load
    game.reset();
    moveComments = {}; // Clear previous comments

    // Try to load PGN (chess.js loads the FIRST game if multiple)
    const success = game.load_pgn(pgnText);

    if (!success) {
        alert('Nepodařilo se načíst PGN. Zkontrolujte formát zápisu.');
        return;
    }

    extractAnnotationsFromPgn(pgnText);

    // Extract header info if present
    const whiteMatch = pgnText.match(/\[White\s+"([^"]+)"\]/i);
    const blackMatch = pgnText.match(/\[Black\s+"([^"]+)"\]/i);
    const resultMatch = pgnText.match(/\[Result\s+"([^"]+)"\]/i);

    if (whiteMatch) document.getElementById('whitePlayer').value = whiteMatch[1];
    if (blackMatch) document.getElementById('blackPlayer').value = blackMatch[1];
    if (resultMatch) {
        const resultSelect = document.getElementById('result');
        const resultValue = resultMatch[1];
        // Find matching option
        for (let opt of resultSelect.options) {
            if (opt.value === resultValue || opt.text === resultValue) {
                resultSelect.value = opt.value;
                break;
            }
        }
    }

    // Update board and UI
    board.position(game.fen());

    // Save history for navigation
    saveCurrentHistory();

    updateStatus();
    updateMoveHistory();

    closeImportPgnModal();

    // Show success message
    const status = document.getElementById('saveStatus');
    if (status) {
        status.style.color = '#4ade80';
        status.innerText = 'PGN úspěšně načteno!';
        setTimeout(() => status.innerText = '', 3000);
    }
}
window.importPgn = importPgn;

function toggleNag(nagCode) {
    const key = getFenKey();
    if (moveNags[key] === nagCode) {
        delete moveNags[key]; // Toggle off
    } else {
        moveNags[key] = nagCode;
    }
    updateStatus();
}
window.toggleNag = toggleNag;

// --- Comment Logic ---

document.addEventListener('DOMContentLoaded', () => {
    const commentBox = document.getElementById('moveComment');
    if (commentBox) {
        commentBox.addEventListener('input', (e) => {
            const key = getFenKey();
            // Don't use .trim() - it removes trailing spaces while typing!
            const val = e.target.value;
            if (val.trim()) {
                moveComments[key] = val;
            } else {
                delete moveComments[key];
            }
            // Don't call updateStatus() here - it overwrites the textarea and kills spaces
            // Just update the bubble overlay directly
            const bubble = document.getElementById('recorder-board-overlay');
            if (bubble) {
                const nag = moveNags[key];
                const nagSymbols = { '$1': '!', '$2': '?', '$3': '!!', '$4': '??', '$5': '!?', '$6': '?!' };
                let text = '';
                if (nag && nagSymbols[nag]) text += `<strong>${nagSymbols[nag]}</strong> `;
                if (val.trim()) text += val;
                if (text) {
                    bubble.innerHTML = text;
                    bubble.style.display = 'block';
                } else {
                    bubble.style.display = 'none';
                }
            }
        });
    }
});


// Custom PGN Generator to include comments
function generateAnnotatedPgn() {
    const header = game.header();
    let headerStr = '';
    // Reconstruct header (chess.js .pgn() does this, but we are building manually)
    // Actually, let's use game.pgn() output as base IS NOT ENOUGH because it lacks custom comments.
    // We must iterate history.

    // Header
    /* 
       We only have access to raw header via game.header() object.
       We should reconstruct standard headers.
    */
    // Default Header keys
    const tags = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];
    // Merge with UI inputs just in case? 
    // Actually `saveGame` constructs header manually.
    // For specific PGN export, let's just minimal header or use what's in game object

    // Let's iterate history and build the movetext.

    const history = game.history({ verbose: true });
    if (history.length === 0) return ''; // Or just headers?

    let pgn = '';

    // We need to replay to get FENs to match comments
    let tempGame = new Chess();
    // Copy headers?
    // tempGame.header(game.header()); 
    // Just build string.

    let moveText = '';
    let row = '';

    // Check for initial comment (start pos)
    if (moveComments[tempGame.fen()]) {
        moveText += `{ ${moveComments[tempGame.fen()]} } `;
    }

    history.forEach((move, i) => {
        const moveNum = Math.floor(i / 2) + 1;

        if (i % 2 === 0) {
            moveText += `${moveNum}. ${move.san} `;
        } else {
            moveText += `${move.san} `;
        }

        // Apply move to temp to get new FEN
        tempGame.move(move);
        const fen = tempGame.fen();

        // Append NAG if any
        if (moveNags[fen]) {
            moveText += `${moveNags[fen]} `;
        }

        if (moveComments[fen]) {
            moveText += `{ ${moveComments[fen]} } `;
        }
    });

    return moveText.trim();
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
    // Simple keyboard event isolation for inputs
    // Prevents keyboard shortcuts from triggering while typing
    document.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('keydown', (e) => e.stopPropagation());
    });

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
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
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

    // CLICK-TO-MOVE HANDLING
    // Use mouseup instead of mousedown to avoid conflicting with drag-drop
    let isDragging = false;
    let dragStartPos = null;

    document.body.addEventListener('mousedown', (e) => {
        dragStartPos = { x: e.clientX, y: e.clientY };
        isDragging = false;
    }, true);

    document.body.addEventListener('mousemove', (e) => {
        if (dragStartPos) {
            const dx = Math.abs(e.clientX - dragStartPos.x);
            const dy = Math.abs(e.clientY - dragStartPos.y);
            if (dx > 5 || dy > 5) {
                isDragging = true;
            }
        }
    }, true);

    document.body.addEventListener('mouseup', (e) => {
        const boardContainer = document.getElementById('board');

        // Only handle click if not dragging
        if (!isDragging && boardContainer && boardContainer.contains(e.target)) {
            const squareEl = e.target.closest('.square-55d63');
            if (squareEl) {
                const squareId = squareEl.getAttribute('data-square');
                if (squareId) {
                    handleSquareClick(squareId);
                }
            }
        }

        dragStartPos = null;
        isDragging = false;
    }, true);

    // Mobile touch - touchend for click-to-move
    document.body.addEventListener('touchend', (e) => {
        const boardContainer = document.getElementById('board');
        if (!boardContainer) return;

        const touch = e.changedTouches[0];
        const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);

        if (boardContainer.contains(elementAtPoint)) {
            const squareEl = elementAtPoint.closest('.square-55d63');
            if (squareEl) {
                const squareId = squareEl.getAttribute('data-square');
                if (squareId) {
                    // Small delay to let drag-drop resolve first
                    setTimeout(() => handleSquareClick(squareId), 50);
                }
            }
        }
    }, true);

    // FIX: Persistence for comments while typing
    const commentBox = document.getElementById('moveComment');
    if (commentBox) {
        commentBox.addEventListener('input', () => {
            const key = game.fen();
            moveComments[key] = commentBox.value;
        });
    }


});
