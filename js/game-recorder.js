// Game Recorder Logic
let board = null;
let game = new Chess();
let selectedSquare = null;
let pendingPromotion = null;
let lastMove = null;
var autoplayInterval = null;
let currentGameId = null;
let moveComments = {};
let moveNags = {};
let startingFen = null;

// ========================================
// Move Tree Data Structure
// ========================================
// Each node: { move (verbose obj or null for root), san, fen, children: [node...], parent, comment, nag }
// children[0] = main line, children[1+] = variations

function createNode(move, fen, parent) {
    return { move: move, san: move ? move.san : null, fen: fen, children: [], parent: parent || null, comment: '', nag: '' };
}

let moveTreeRoot = createNode(null, new Chess().fen(), null);
let currentNode = moveTreeRoot;

// Pending variation state
let pendingVariationMove = null; // { from, to, promotion } waiting for modal choice

function initTreeFromStartingPos() {
    const fen = startingFen || new Chess().fen();
    moveTreeRoot = createNode(null, fen, null);
    currentNode = moveTreeRoot;
}

// Find child of currentNode matching a SAN
function findChildBySan(node, san) {
    return node.children.find(c => c.san === san);
}

// Get the ply number (half-moves from root) for a node
function getNodePly(node) {
    let ply = 0;
    let n = node;
    while (n.parent) { ply++; n = n.parent; }
    return ply;
}

// Get main line from root as array of nodes
function getMainLine(node) {
    const line = [];
    let n = node || moveTreeRoot;
    while (n.children.length > 0) {
        n = n.children[0];
        line.push(n);
    }
    return line;
}

// Navigate game state to a specific node
function navigateToNode(node) {
    // Build path from root to node
    const path = [];
    let n = node;
    while (n.parent) { path.unshift(n); n = n.parent; }
    // Replay from start
    if (startingFen) game.load(startingFen);
    else game.reset();
    for (const step of path) {
        game.move(step.move);
    }
    currentNode = node;
    board.position(game.fen());
    updateStatus();
    updateMoveHistory();
    if (node.move) {
        removeHighlights();
        highlightMove(node.move.from, node.move.to);
        lastMove = { source: node.move.from, target: node.move.to };
    } else {
        removeHighlights();
        lastMove = null;
    }
}

// Central move handler — called by onDrop, handleSquareClick, completePromotion
function makeTreeMove(moveObj) {
    // moveObj = { from, to, promotion }
    // First validate the move
    const testGame = new Chess(game.fen());
    const result = testGame.move(moveObj);
    if (!result) return null;

    const san = result.san;

    // Check if this move already exists as a child
    const existing = findChildBySan(currentNode, san);
    if (existing) {
        // Same move exists — just navigate into it
        game.move(moveObj);
        currentNode = existing;
        board.position(game.fen());
        updateStatus();
        updateMoveHistory();
        removeHighlights();
        highlightMove(result.from, result.to);
        lastMove = { source: result.from, target: result.to };
        return result;
    }

    // If there are existing children and new move differs — show variation modal
    if (currentNode.children.length > 0) {
        pendingVariationMove = moveObj;
        pendingVariationMove._result = result;
        showVariationModal(currentNode.children[0].san, san);
        return 'pending'; // Signal that move is pending modal
    }

    // No children — just append
    return appendMoveToTree(moveObj, result);
}

function appendMoveToTree(moveObj, result) {
    if (!result) {
        result = game.move(moveObj);
        if (!result) return null;
    } else {
        game.move(moveObj);
    }
    const newNode = createNode(result, game.fen(), currentNode);
    currentNode.children.push(newNode);
    currentNode = newNode;
    board.position(game.fen());
    updateStatus();
    updateMoveHistory();
    removeHighlights();
    highlightMove(result.from, result.to);
    lastMove = { source: result.from, target: result.to };
    return result;
}

// --- Variation Modal ---
function showVariationModal(existingSan, newSan) {
    const modal = document.getElementById('variationModal');
    if (!modal) { resolveVariation('variation'); return; }
    const info = document.getElementById('variationInfo');
    if (info) info.textContent = `Hlavní tah: ${existingSan}  →  Váš tah: ${newSan}`;
    modal.classList.add('active');
}

function resolveVariation(choice) {
    const modal = document.getElementById('variationModal');
    if (modal) modal.classList.remove('active');
    if (!pendingVariationMove) return;

    const moveObj = { from: pendingVariationMove.from, to: pendingVariationMove.to, promotion: pendingVariationMove.promotion };
    const result = pendingVariationMove._result;
    pendingVariationMove = null;

    if (choice === 'variation') {
        // Add as sub-variation (append to children)
        game.move(moveObj);
        const newNode = createNode(result, game.fen(), currentNode);
        currentNode.children.push(newNode);
        currentNode = newNode;
    } else if (choice === 'overwrite') {
        // Replace main line child
        game.move(moveObj);
        const newNode = createNode(result, game.fen(), currentNode);
        currentNode.children[0] = newNode;
        currentNode = newNode;
    } else if (choice === 'mainline') {
        // Insert as new main line, demote old main
        game.move(moveObj);
        const newNode = createNode(result, game.fen(), currentNode);
        currentNode.children.unshift(newNode); // Insert at front
        currentNode = newNode;
    }

    board.position(game.fen());
    updateStatus();
    updateMoveHistory();
    removeHighlights();
    highlightMove(result.from, result.to);
    lastMove = { source: result.from, target: result.to };
}
window.resolveVariation = resolveVariation;

// --- Promote / Demote / Delete Variation ---
function promoteVariation(node) {
    if (!node.parent) return;
    const siblings = node.parent.children;
    const idx = siblings.indexOf(node);
    if (idx <= 0) return; // Already main or not found
    [siblings[idx - 1], siblings[idx]] = [siblings[idx], siblings[idx - 1]];
    updateMoveHistory();
}
window.promoteVariation = promoteVariation;

function demoteVariation(node) {
    if (!node.parent) return;
    const siblings = node.parent.children;
    const idx = siblings.indexOf(node);
    if (idx < 0 || idx >= siblings.length - 1) return;
    [siblings[idx], siblings[idx + 1]] = [siblings[idx + 1], siblings[idx]];
    updateMoveHistory();
}
window.demoteVariation = demoteVariation;

function deleteVariation(node) {
    if (!node.parent) return;
    const siblings = node.parent.children;
    const idx = siblings.indexOf(node);
    if (idx < 0) return;
    // Don't allow deleting main line if it's the only child — or do allow it
    siblings.splice(idx, 1);
    // If currentNode is inside deleted subtree, navigate to parent
    let n = currentNode;
    while (n) {
        if (n === node) { navigateToNode(node.parent); return; }
        n = n.parent;
    }
    updateMoveHistory();
}
window.deleteVariation = deleteVariation;

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

// Node registry for click handlers (avoids inline closures in HTML)
let _nodeRegistry = [];

function updateMoveHistory() {
    const moveListEl = document.getElementById('moveList');
    if (!moveListEl) return;

    _nodeRegistry = [];

    if (moveTreeRoot.children.length === 0) {
        moveListEl.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">Partie začíná...</span>';
        return;
    }

    // Render the tree starting from root
    const html = renderMoveLine(moveTreeRoot, 0, false);
    moveListEl.innerHTML = html;

    // Attach click handlers via node registry
    moveListEl.querySelectorAll('[data-node-idx]').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-node-idx'));
            const node = _nodeRegistry[idx];
            if (node) navigateToNode(node);
        });
    });

    // Attach variation action handlers
    moveListEl.querySelectorAll('[data-action]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = el.getAttribute('data-action');
            const idx = parseInt(el.getAttribute('data-target-idx'));
            const node = _nodeRegistry[idx];
            if (!node) return;
            if (action === 'promote') promoteVariation(node);
            else if (action === 'demote') demoteVariation(node);
            else if (action === 'delete') deleteVariation(node);
        });
    });

    // Scroll to current move
    const activeMove = moveListEl.querySelector('.move.active');
    if (activeMove) {
        activeMove.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function renderMoveLine(startNode, startPly, isVariation) {
    let html = '';
    let node = startNode;
    let ply = startPly;

    while (node.children.length > 0) {
        const mainChild = node.children[0];
        ply++;
        const moveNum = Math.ceil(ply / 2);
        const isWhite = (ply % 2 === 1);
        const isActive = (mainChild === currentNode) ? 'active' : '';
        const regIdx = _nodeRegistry.length;
        _nodeRegistry.push(mainChild);

        if (isWhite) {
            html += `<div class="move-pair">`;
            html += `<span class="move-number">${moveNum}.</span>`;
            html += `<span class="move ${isActive}" data-node-idx="${regIdx}">${mainChild.san}</span>`;
        } else {
            // If starting a variation on black's move, show move number with "..."
            if (node === startNode && isVariation) {
                html += `<div class="move-pair">`;
                html += `<span class="move-number">${moveNum}...</span>`;
                html += `<span class="move"></span>`; // empty white
                html += `<span class="move ${isActive}" data-node-idx="${regIdx}">${mainChild.san}</span>`;
                html += `</div>`;
            } else {
                html += `<span class="move ${isActive}" data-node-idx="${regIdx}">${mainChild.san}</span>`;
                html += `</div>`;
            }
        }

        // Close the pair if white move and no black sibling coming
        if (isWhite && mainChild.children.length === 0) {
            html += `</div>`;
        }

        // Render sub-variations (children[1+] of the current node)
        for (let v = 1; v < node.children.length; v++) {
            const varNode = node.children[v];
            const varIdx = _nodeRegistry.length;
            _nodeRegistry.push(varNode);
            const varPly = ply;
            const varMoveNum = Math.ceil(varPly / 2);
            const varIsWhite = (varPly % 2 === 1);
            const varActive = (varNode === currentNode) ? 'active' : '';

            html += `<div class="variation-line">`;
            html += `<div class="variation-header">`;
            html += `<div class="variation-actions">`;
            if (v > 0) html += `<span class="var-btn" data-action="promote" data-target-idx="${varIdx}" title="Povýšit">↑</span>`;
            if (v < node.children.length - 1) html += `<span class="var-btn" data-action="demote" data-target-idx="${varIdx}" title="Ponížit">↓</span>`;
            html += `<span class="var-btn var-btn-delete" data-action="delete" data-target-idx="${varIdx}" title="Smazat">×</span>`;
            html += `</div></div>`;

            // Render first move of variation
            html += `<div class="move-pair">`;
            html += `<span class="move-number">${varMoveNum}.${varIsWhite ? '' : '..'}</span>`;
            html += `<span class="move ${varActive}" data-node-idx="${varIdx}">${varNode.san}</span>`;
            html += `</div>`;

            // Continue rendering the rest of this variation line
            if (varNode.children.length > 0) {
                html += renderMoveLine(varNode, varPly, true);
            }
            html += `</div>`;
        }

        node = mainChild;
    }

    return html;
}

// jumpToMove is now handled by navigateToNode — kept for legacy compatibility
function jumpToMove(targetPly) {
    // Navigate main line to the given ply
    let node = moveTreeRoot;
    for (let i = 0; i < targetPly; i++) {
        if (node.children.length === 0) break;
        node = node.children[0];
    }
    navigateToNode(node);
}

// --- Click-to-Move & Highlight Logic ---

function removeHighlights() {
    $('#board .square-55d63').removeClass('highlight-selected');
    $('#board .square-55d63').removeClass('highlight-move');
    $('#board .square-55d63').find('.hint-dot').remove();
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
        if (squareEl.find('.hint-dot').length === 0) {
            squareEl.append('<div class="hint-dot"></div>');
        }
    });
}

function handleSquareClick(square) {
    if (selectedSquare) {
        const sourcePiece = game.get(selectedSquare);
        if (!sourcePiece) { selectedSquare = null; removeHighlights(); return; }
        const targetRank = square.charAt(1);
        const isPromotion = sourcePiece.type === 'p' &&
            ((sourcePiece.color === 'w' && targetRank === '8') || (sourcePiece.color === 'b' && targetRank === '1'));

        if (isPromotion) {
            const tempMove = game.move({ from: selectedSquare, to: square, promotion: 'q' });
            if (tempMove) {
                game.undo();
                pendingPromotion = { source: selectedSquare, target: square };
                showPromotionModal(game.turn());
                return;
            }
        }

        // Use makeTreeMove instead of game.move directly
        const result = makeTreeMove({ from: selectedSquare, to: square, promotion: 'q' });

        if (result && result !== 'pending') {
            selectedSquare = null;
            return;
        } else if (result === 'pending') {
            // Variation modal shown — board stays put until resolved
            selectedSquare = null;
            return;
        }

        // Invalid move — check if clicking own piece to reselect
        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
            removeHighlights();
            selectedSquare = square;
            highlightSquare(square);
            showLegalMoves(square);
        } else {
            removeHighlights();
            selectedSquare = null;
        }
    } else {
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
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
    removeHighlights();
    selectedSquare = source;
    highlightSquare(source);
    showLegalMoves(source);
}

function onDrop(source, target) {
    const piece = game.get(source);
    if (!piece) return 'snapback';

    const targetRank = target.charAt(1);
    const isPromotion = piece.type === 'p' &&
        ((piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1'));

    if (isPromotion) {
        pendingPromotion = { source: source, target: target };
        showPromotionModal(game.turn());
        return 'snapback';
    }

    // Use makeTreeMove
    const result = makeTreeMove({ from: source, to: target, promotion: 'q' });

    if (result === null) {
        removeHighlights();
        selectedSquare = null;
        return 'snapback';
    }

    if (result === 'pending') {
        // Variation modal shown — snapback for now, resolve will update board
        return 'snapback';
    }

    selectedSquare = null;
}

function onSnapEnd() {
    board.position(game.fen());
    if (lastMove) {
        highlightMove(lastMove.source, lastMove.target);
    }
}

// Undo / Go Back — navigate to parent node
function undoMove() {
    if (currentNode.parent) {
        navigateToNode(currentNode.parent);
    }
}

// Build tree from current Chess.js game history (for loadGameById, importPgn)
function buildTreeFromGame() {
    const history = game.history({ verbose: true });
    initTreeFromStartingPos();
    let node = moveTreeRoot;
    const tempGame = new Chess(startingFen || undefined);
    for (const move of history) {
        tempGame.move(move);
        const newNode = createNode(move, tempGame.fen(), node);
        node.children.push(newNode);
        node = newNode;
    }
    currentNode = node; // end of main line
}

function goToStart() {
    navigateToNode(moveTreeRoot);
}

function goBack() {
    if (currentNode.parent) {
        navigateToNode(currentNode.parent);
    }
}

function goForward() {
    if (currentNode.children.length > 0) {
        navigateToNode(currentNode.children[0]); // Follow main line
    }
}

function goToEnd() {
    // Follow main line to the end
    let node = currentNode;
    while (node.children.length > 0) {
        node = node.children[0];
    }
    navigateToNode(node);
}

function toggleAutoplay() {
    if (autoplayInterval) {
        clearInterval(autoplayInterval);
        autoplayInterval = null;
        document.getElementById('autoplayBtn').innerHTML = '<i class="fa-solid fa-play"></i>';
    } else {
        document.getElementById('autoplayBtn').innerHTML = '<i class="fa-solid fa-pause"></i>';
        autoplayInterval = setInterval(() => {
            if (currentNode.children.length === 0) {
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
            img.src = `/img/chesspieces/wikipedia/${prefix}${pieceType}.png`;
        });
        console.log('Promotion modal shown for:', color);
    } else {
        console.error('Promotion modal not found!');
    }
}

function completePromotion(pieceType) {
    const modal = document.getElementById('promotionModal');
    if (modal) modal.classList.remove('active');

    if (pendingPromotion) {
        const result = makeTreeMove({
            from: pendingPromotion.source,
            to: pendingPromotion.target,
            promotion: pieceType
        });

        if (!result && result !== 'pending') {
            alert('Neplatný tah povýšení.');
            board.position(game.fen());
        }
        pendingPromotion = null;
        selectedSquare = null;
    }
}
window.completePromotion = completePromotion; // Export for HTML onclick

// --- IO Logic ---

async function saveGame() {
    const white = document.getElementById('whitePlayer').value;
    const black = document.getElementById('blackPlayer').value;
    const result = document.getElementById('result').value;

    const clubToken = localStorage.getItem('club_auth_token');
    const userToken = localStorage.getItem('token');

    if (!clubToken && !userToken) {
        const status = document.getElementById('saveStatus');
        status.style.color = 'red';
        status.innerText = 'Pro uložení se musíte přihlásit!';
        return;
    }

    if (!white || !black) {
        if (window.modal) await modal.alert('Vyplňte jména hráčů!', 'Chybějící údaje');
        else alert('Vyplňte jména hráčů!');
        return;
    }

    // Include FEN header if game doesn't start from standard position
    let fenHeader = '';
    if (startingFen) {
        fenHeader = `[SetUp "1"]\n[FEN "${startingFen}"]\n`;
    }
    const pgnHeader = `[White "${white}"]\n[Black "${black}"]\n[Result "${result}"]\n[Date "${new Date().toISOString().split('T')[0]}"]\n${fenHeader}\n`;
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

        const headers = {
            'Content-Type': 'application/json'
        };

        if (clubToken) headers['X-Club-Password'] = clubToken;
        if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

        const res = await fetch(url, {
            method: method,
            headers: headers,
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
            board.position(game.fen());
            buildTreeFromGame();
            extractAnnotationsFromPgn(gameData.pgn);
            updateStatus();
            updateMoveHistory();
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

async function loadDiagramById(id) {
    try {
        const apiUrl = window.API_URL || '/api';
        let token = localStorage.getItem('club_auth_token');
        let userToken = localStorage.getItem('auth_token');

        // Diagrams might need auth
        const headers = {};
        if (token) headers['X-Club-Password'] = token;
        if (userToken) headers['Authorization'] = `Bearer ${userToken}`;

        let res = await fetch(`${apiUrl}/diagrams/${id}`, { headers });

        if (!res.ok) throw new Error('Diagram not found');

        const d = await res.json();

        // Load into Game Recorder Board (Visual)
        game.load(d.fen); // Use FEN
        board.position(d.fen);

        // Open Diagram Editor Modal automatically
        // We need to verify diagram-editor is loaded
        if (typeof openDiagramEditor === 'function') {
            openDiagramEditor();

            // Populate Editor State
            // We need to inject data into diagram-editor.js variables
            // Check if we can access them. They are global 'let'.

            if (typeof currentAnnotations !== 'undefined') {
                if (typeof currentDiagramId !== 'undefined') currentDiagramId = d.id; if (typeof currentDiagramName !== 'undefined') currentDiagramName = d.name;
                // Determine turn from FEN or data
                const fenParts = d.fen.split(' ');
                const turn = d.toMove || (fenParts.length > 1 ? fenParts[1] : 'w');

                setDiagramTurn(turn);

                // Clear and Set
                clearDiagram();

                // Annotations
                if (d.annotations) {
                    // Update global variable directly if exposed
                    // We can't easily replace the object reference if it's 'let' in another module without standard exports
                    // But we can mutate contents
                    if (d.annotations.arrows) d.annotations.arrows.forEach(a => currentAnnotations.arrows.push(a));
                    if (d.annotations.squares) d.annotations.squares.forEach(s => currentAnnotations.squares.push(s));
                    if (d.annotations.badges) d.annotations.badges.forEach(b => currentAnnotations.badges.push(b));
                    renderAnnotations();
                }

                // Solution
                if (d.solution) {
                    solverState.recordedMoves = d.solution;
                    updateSolutionList();
                }

                // Store diagram ID for UPDATE instead of create?
                // diagram-editor.js uses saveDiagramToCloud which does POST.
                // We might need to override it or set a "currentDiagramId" variable if supported.
                // Currently diagram-editor.js doesn't seem to support updating existing diagrams easily (it uses POST).
                // But for now, pre-filling is better than empty.
            }
        }

        updateStatus();

    } catch (e) {
        console.error(e);
        alert(`Nepodařilo se načíst diagram: ${e.message}`);
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
        startingFen = null;
        game.reset();
        board.position('start');
        moveComments = {};
        moveNags = {};
        initTreeFromStartingPos();
        updateStatus();
        updateMoveHistory();
        removeHighlights();

        const overlay = document.getElementById('recorder-board-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.style.borderLeftColor = '#4ade80';
        }

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

    // Reset
    game.reset();
    moveComments = {};
    moveNags = {};
    startingFen = null;

    // Extract FEN if present
    const fenMatch = pgnText.match(/\[FEN\s+"([^"]+)"\]/i);
    if (fenMatch) {
        startingFen = fenMatch[1];
        game.load(startingFen);
    }

    // Extract header info
    const whiteMatch = pgnText.match(/\[White\s+"([^"]+)"\]/i);
    const blackMatch = pgnText.match(/\[Black\s+"([^"]+)"\]/i);
    const resultMatch = pgnText.match(/\[Result\s+"([^"]+)"\]/i);

    if (whiteMatch) document.getElementById('whitePlayer').value = whiteMatch[1];
    if (blackMatch) document.getElementById('blackPlayer').value = blackMatch[1];
    if (resultMatch) {
        const resultSelect = document.getElementById('result');
        for (let opt of resultSelect.options) {
            if (opt.value === resultMatch[1] || opt.text === resultMatch[1]) {
                resultSelect.value = opt.value;
                break;
            }
        }
    }

    // Parse movetext with variations
    const body = pgnText.replace(/\[[^\]]*\]\s*/g, '').trim();
    // Tokenize: move numbers, moves, comments, NAGs, parens
    const tokenRegex = /(\{[^}]*\})|(\$[0-9]+)|(\()|(\))|([a-zA-Z][a-zA-Z0-9+#=!?-]*)|([0-9]+\.+)/g;
    const tokens = [];
    let m;
    while ((m = tokenRegex.exec(body)) !== null) {
        tokens.push(m[0]);
    }

    // Build tree
    initTreeFromStartingPos();
    let treeNode = moveTreeRoot;
    let gameStack = []; // Stack for variations { node, fen }
    let tempGame = new Chess(startingFen || undefined);

    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];

        if (tok === '(') {
            // Save current position and go back to parent
            gameStack.push({ node: treeNode, fen: tempGame.fen() });
            // Go back to parent to branch
            if (treeNode.parent) {
                treeNode = treeNode.parent;
                tempGame.load(treeNode.fen);
            }
        } else if (tok === ')') {
            // Restore position
            if (gameStack.length > 0) {
                const saved = gameStack.pop();
                treeNode = saved.node;
                tempGame.load(saved.fen);
            }
        } else if (tok.startsWith('{')) {
            // Comment — attach to current node
            const comment = tok.replace(/^\{|\}$/g, '').trim();
            if (comment && treeNode) {
                treeNode.comment = comment;
                moveComments[treeNode.fen] = comment;
            }
        } else if (tok.startsWith('$')) {
            // NAG
            if (treeNode) {
                treeNode.nag = tok;
                moveNags[treeNode.fen] = tok;
            }
        } else if (tok.match(/^[0-9]+\.+$/)) {
            // Move number — skip
        } else if (tok === '1-0' || tok === '0-1' || tok === '1/2-1/2' || tok === '*') {
            // Result — skip
        } else {
            // Attempt move
            const result = tempGame.move(tok);
            if (result) {
                const newNode = createNode(result, tempGame.fen(), treeNode);
                treeNode.children.push(newNode);
                treeNode = newNode;
            }
        }
    }

    // Navigate to end of main line
    currentNode = moveTreeRoot;
    while (currentNode.children.length > 0) {
        currentNode = currentNode.children[0];
    }
    // Sync chess.js game state to current position
    navigateToNode(currentNode);

    board.position(game.fen());
    updateStatus();
    updateMoveHistory();

    closeImportPgnModal();

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
    if (moveTreeRoot.children.length === 0) return '';
    return generateTreePgn(moveTreeRoot, 0).trim();
}

function generateTreePgn(node, ply) {
    let text = '';
    let currentNode = node;
    let currentPly = ply;

    while (currentNode.children.length > 0) {
        const mainChild = currentNode.children[0];
        currentPly++;
        const moveNum = Math.ceil(currentPly / 2);
        const isWhite = (currentPly % 2 === 1);

        if (isWhite) {
            text += `${moveNum}. ${mainChild.san} `;
        } else {
            // Show move number with dots if first move in a variation
            if (currentNode === node && ply > 0) {
                text += `${moveNum}... ${mainChild.san} `;
            } else {
                text += `${mainChild.san} `;
            }
        }

        // NAG
        if (mainChild.nag) text += `${mainChild.nag} `;
        // Also check legacy moveNags by FEN
        if (moveNags[mainChild.fen]) text += `${moveNags[mainChild.fen]} `;

        // Comment
        if (mainChild.comment) text += `{${mainChild.comment}} `;
        if (moveComments[mainChild.fen]) text += `{${moveComments[mainChild.fen]}} `;

        // Render sub-variations
        for (let v = 1; v < currentNode.children.length; v++) {
            const varNode = currentNode.children[v];
            const varPly = currentPly;
            const varMoveNum = Math.ceil(varPly / 2);
            const varIsWhite = (varPly % 2 === 1);

            text += `(`;
            if (varIsWhite) {
                text += `${varMoveNum}. ${varNode.san} `;
            } else {
                text += `${varMoveNum}... ${varNode.san} `;
            }

            if (varNode.nag) text += `${varNode.nag} `;
            if (moveNags[varNode.fen]) text += `${moveNags[varNode.fen]} `;
            if (varNode.comment) text += `{${varNode.comment}} `;
            if (moveComments[varNode.fen]) text += `{${moveComments[varNode.fen]}} `;

            // Continue variation
            if (varNode.children.length > 0) {
                text += generateTreePgn(varNode, varPly);
            }
            text += `) `;
        }

        currentNode = mainChild;
    }

    return text;
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
        pieceTheme: '/img/chesspieces/wikipedia/{piece}.png'
    };
    board = Chessboard('board', config);
    window.board = board;

    window.addEventListener('resize', board.resize);

    // Load game by ID if present in URL
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('id');
    const diagramId = urlParams.get('diagramId');

    if (gameId) {
        loadGameById(gameId);
    } else if (diagramId) {
        // We need to wait for diagram-editor.js to be ready if we use it
        // But game-recorder.js is defer, diagram-editor.js should be defer too
        loadDiagramById(diagramId);
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

    // --- Engine Analysis Integration ---
    initRecorderEngine();

});

// ========================================
// Engine Analysis for Game Recorder
// ========================================
let recAnalyzer = null;
let recEngineActive = false;

function initRecorderEngine() {
    // ChessAnalyzer is loaded from game-viewer2.js
    if (typeof ChessAnalyzer !== 'undefined') {
        recAnalyzer = new ChessAnalyzer((data) => handleRecAnalysisUpdate(data));
    } else {
        console.warn('[GameRecorder] ChessAnalyzer not available, engine feature disabled');
    }
}

function toggleRecorderEngine() {
    recEngineActive = !recEngineActive;

    const btn = document.getElementById('recEngineBtn');
    const evalBar = document.getElementById('recEvalBar');
    const analysisPanel = document.getElementById('recAnalysisInfo');

    if (recEngineActive) {
        btn.style.background = 'rgba(74, 222, 128, 0.2)';
        btn.style.borderColor = 'rgba(74, 222, 128, 0.5)';
        btn.style.color = '#4ade80';
        if (evalBar) evalBar.classList.add('active');
        if (analysisPanel) analysisPanel.style.display = 'flex';
        // Analyze current position
        analyzeCurrentPosition();
    } else {
        btn.style.background = '';
        btn.style.borderColor = 'rgba(74, 222, 128, 0.3)';
        btn.style.color = 'rgba(74, 222, 128, 0.7)';
        if (evalBar) evalBar.classList.remove('active');
        if (analysisPanel) analysisPanel.style.display = 'none';
        if (recAnalyzer) recAnalyzer.stopAnalysis();
    }
}
window.toggleRecorderEngine = toggleRecorderEngine;

function analyzeCurrentPosition() {
    if (!recEngineActive || !recAnalyzer) return;
    const fen = game.fen();
    recAnalyzer.analyze(fen);
}

function handleRecAnalysisUpdate(data) {
    if (!recEngineActive) return;

    // Update eval bar using ChessEvalDisplay if available
    if (typeof ChessEvalDisplay !== 'undefined') {
        ChessEvalDisplay.update('rec', data);
    } else {
        // Fallback: direct DOM update
        const evalFill = document.getElementById('recEvalFill');
        const evalText = document.getElementById('recEvalText');
        const bestMove = document.getElementById('recBestMove');

        if (!evalFill || !evalText) return;

        let percentage = 50;
        let displayText = '—';

        if (data.mate !== null && data.mate !== undefined) {
            percentage = data.mate > 0 ? 100 : 0;
            displayText = `M${Math.abs(data.mate)}`;
        } else if (data.eval !== null && data.eval !== undefined) {
            percentage = data.winChance || 50;
            displayText = (data.eval >= 0 ? '+' : '') + data.eval.toFixed(1);
        }

        evalFill.style.height = `${percentage}%`;
        evalText.textContent = displayText;
        if (bestMove) bestMove.textContent = data.text || displayText;
    }

    // Sync eval bar height with board
    syncRecEvalBarHeight();
}

function syncRecEvalBarHeight() {
    requestAnimationFrame(() => {
        const boardEl = document.getElementById('board');
        const evalBar = document.getElementById('recEvalBar');
        if (boardEl && evalBar) {
            const height = boardEl.offsetHeight;
            if (height > 0) {
                evalBar.style.height = height + 'px';
            }
        }
    });
}

// Hook into existing updateStatus to trigger analysis on position change
const _origUpdateStatus = updateStatus;
updateStatus = function () {
    _origUpdateStatus();
    analyzeCurrentPosition();
    syncRecEvalBarHeight();
};

// Sync eval bar height on resize
window.addEventListener('resize', syncRecEvalBarHeight);
