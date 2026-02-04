/**
 * Diagram Editor Logic
 * Handles the modal, chessboard, and drawing tools (arrows/squares)
 */

let diagramBoard = null;
let currentTool = 'arrow-green'; // Default tool
let isDrawing = false;
let startSquare = null;
let currentDiagramId = null;
let currentDiagramName = "";
let currentAnnotations = {
    arrows: [], // {start: 'e2', end: 'e4', color: 'green'}
    squares: [], // {square: 'e4', color: 'green'}
    badges: [] // {square: 'e4', type: '!'}
};

// Solver State
let solverState = {
    isRecording: false,
    recordingType: null, // 'correct', 'alternative', 'mistake'
    recordedMoves: {}, // Key: "e2-e4", Value: { type: 'correct', comment: '...', line: [] }
    currentPendingMove: null, // First move of the sequence (key)
    currentLine: [] // Array of moves in syntax "e2-e4"
};

// Colors mapping
const TOOL_COLORS = {
    'green': '#22c55e',
    'red': '#ef4444',
    'blue': '#3b82f6',
    'yellow': '#eab308'
};

// Track who is on turn for the diagram
let diagramTurn = 'w'; // 'w' or 'b', default white

/**
 * Set who is on turn and update UI
 */
function setDiagramTurn(turn) {
    diagramTurn = turn;

    // Update button styles
    const whiteBtn = document.getElementById('turnWhiteBtn');
    const blackBtn = document.getElementById('turnBlackBtn');

    if (whiteBtn && blackBtn) {
        if (turn === 'w') {
            whiteBtn.style.background = 'rgba(255,255,255,0.15)';
            whiteBtn.style.borderColor = 'rgba(255,255,255,0.4)';
            blackBtn.style.background = '';
            blackBtn.style.borderColor = '';
        } else {
            blackBtn.style.background = 'rgba(0,0,0,0.4)';
            blackBtn.style.borderColor = 'rgba(100,100,100,0.6)';
            whiteBtn.style.background = '';
            whiteBtn.style.borderColor = '';
        }
    }
}

/**
 * Open the diagram editor with the current game position
 */
/**
 * Open the diagram editor with the current game position
 */
function openDiagramEditor() {
    const modal = document.getElementById('diagramEditorModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock scroll

    // Prevent touchmove scroll on mobile
    const preventScroll = (e) => {
        // Allow scrolling inside specific containers if needed, but block body scroll
        e.preventDefault();
    };
    modal.addEventListener('touchmove', preventScroll, { passive: false });
    modal._preventScroll = preventScroll; // Store reference for cleanup

    // Initialize board if not already done
    if (!diagramBoard) {
        diagramBoard = Chessboard('diagramBoard', {
            position: game.fen(),
            draggable: false, // Read only
            showNotation: true,
            pieceTheme: '/img/chesspieces/wikipedia/{piece}.png'
        });

        // Setup event listeners on overlay
        setupOverlayEvents();
    } else {
        diagramBoard.position(game.fen());
    }


    // Clear previous annotations
    clearDiagram(); currentDiagramId = null; currentDiagramName = "";

    // Update turn indicator
    const turn = game.turn();
    const turnText = document.getElementById('turnIndicatorText');
    if (turnText) {
        turnText.innerText = turn === 'w' ? 'Bílý na tahu' : 'Černý na tahu';
    }

    // Resize to be sure
    setTimeout(() => diagramBoard.resize(), 200);
}

/**
 * Close the editor
 */
function closeDiagramEditor() {
    const modal = document.getElementById('diagramEditorModal');
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Unlock scroll

    // Remove touchmove scroll prevention
    if (modal._preventScroll) {
        modal.removeEventListener('touchmove', modal._preventScroll);
        modal._preventScroll = null;
    }

    // Disable solver recording if active
    if (solverState.isRecording) {
        saveSolverStep(); // or cancel
    }
}

/**
 * Set the current drawing tool
 */
function setDiagramTool(tool) {
    currentTool = tool;

    // Disable solver recording if switching tools
    if (solverState.isRecording) {
        // Maybe alert or just auto-cancel?
    }

    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));

    // Find button with matching onclick
    const buttons = document.querySelectorAll('.tool-btn');
    for (let btn of buttons) {
        if (btn.getAttribute('onclick')?.includes(`'${tool}'`)) {
            btn.classList.add('active');
        }
    }
}

/**
 * Clear all annotations
 */
function clearDiagram() {
    currentAnnotations = { arrows: [], squares: [], badges: [] };
    solverState.recordedMoves = {};
    updateSolutionList();
    renderAnnotations();
}

/**
 * Setup mouse/touch events on the SVG overlay
 */
function setupOverlayEvents() {
    const overlay = document.getElementById('diagramOverlay');

    overlay.addEventListener('mousedown', handleInputStart);
    overlay.addEventListener('touchstart', handleInputStart, { passive: false });

    overlay.addEventListener('mousemove', handleInputMove);
    overlay.addEventListener('touchmove', handleInputMove, { passive: false });

    overlay.addEventListener('mouseup', handleInputEnd);
    overlay.addEventListener('touchend', handleInputEnd);
}

// Convert screen coordinates to square (e.g., 'e4')
function getSquareFromCoords(x, y) {
    const wrapper = document.getElementById('diagramBoardWrapper');
    const rect = wrapper.getBoundingClientRect();

    const relX = x - rect.left;
    const relY = y - rect.top;

    const squareSize = rect.width / 8;

    const fileIdx = Math.floor(relX / squareSize);
    const rankIdx = 7 - Math.floor(relY / squareSize);

    if (fileIdx < 0 || fileIdx > 7 || rankIdx < 0 || rankIdx > 7) return null;

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];

    // Handle board flip if needed
    const orientation = diagramBoard.orientation();

    if (orientation === 'white') {
        return files[fileIdx] + ranks[rankIdx];
    } else {
        return files[7 - fileIdx] + ranks[7 - rankIdx];
    }
}

function handleInputStart(e) {
    if (solverState.isRecording) return; // Don't draw while recording moves

    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    startSquare = getSquareFromCoords(clientX, clientY);
    if (startSquare) {
        isDrawing = true;
    }
}

function handleInputMove(e) {
    if (!isDrawing) return;

    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Optional: Render preview line here
    const endSquare = getSquareFromCoords(clientX, clientY);
    if (endSquare) {
        renderPreview(startSquare, endSquare);
    }
}

function handleInputEnd(e) {
    if (!isDrawing) return;
    isDrawing = false;

    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

    const endSquare = getSquareFromCoords(clientX, clientY);

    if (startSquare && endSquare) {
        if (currentTool === 'eraser') {
            // Eraser logic logic for squares
            if (startSquare === endSquare) {
                const sqIndex = currentAnnotations.squares.findIndex(s => s.square === startSquare);
                if (sqIndex >= 0) {
                    currentAnnotations.squares.splice(sqIndex, 1);
                }
            }
        } else {
            const type = currentTool.split('-')[0];
            const color = currentTool.split('-')[1];

            if (type === 'square') {
                if (startSquare === endSquare) {
                    toggleSquare(startSquare, color);
                }
            } else if (type === 'arrow') {
                if (startSquare !== endSquare) {
                    addArrow(startSquare, endSquare, color);
                }
            } else if (type === 'badge') {
                if (startSquare === endSquare) {
                    toggleBadge(startSquare, currentTool.substring(6)); // remove 'badge-' prefix
                }
            }
        }
    }

    renderAnnotations();
}

function toggleSquare(square, color) {
    // Check if exists
    const index = currentAnnotations.squares.findIndex(s => s.square === square);

    if (index >= 0) {
        // If same color, remove. If diff, change.
        if (currentAnnotations.squares[index].color === color) {
            currentAnnotations.squares.splice(index, 1);
        } else {
            currentAnnotations.squares[index].color = color;
        }
    } else {
        currentAnnotations.squares.push({ square, color });
    }
}

function addArrow(start, end, color) {
    const exists = currentAnnotations.arrows.findIndex(a => a.start === start && a.end === end);
    if (exists >= 0) {
        currentAnnotations.arrows.splice(exists, 1);
    }
    currentAnnotations.arrows.push({ start, end, color });
}

function renderAnnotations() {
    const overlay = document.getElementById('diagramOverlay');
    overlay.innerHTML = ''; // Clear SVG

    // 1. Render Squares
    currentAnnotations.squares.forEach(sq => {
        const coords = getSquareCenter(sq.square);
        if (!coords) return;

        const squareSize = document.getElementById('diagramBoardWrapper').clientWidth / 8;

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', coords.x - squareSize / 2);
        rect.setAttribute('y', coords.y - squareSize / 2);
        rect.setAttribute('width', squareSize);
        rect.setAttribute('height', squareSize);
        rect.setAttribute('fill', TOOL_COLORS[sq.color]);
        rect.setAttribute('fill-opacity', '0.5');
        rect.style.cursor = currentTool === 'eraser' ? 'pointer' : 'default';
        overlay.appendChild(rect);
    });

    // 2. Render Arrows
    currentAnnotations.arrows.forEach((arr, index) => {
        const group = drawSvgArrow(overlay, arr.start, arr.end, TOOL_COLORS[arr.color]);

        if (group) {
            group.addEventListener('click', (e) => {
                if (currentTool === 'eraser') {
                    e.preventDefault();
                    e.stopPropagation();
                    currentAnnotations.arrows.splice(index, 1);
                    renderAnnotations();
                }
            });
            group.style.pointerEvents = 'all';
            group.style.cursor = currentTool === 'eraser' ? 'pointer' : 'default';
        }
    });

    // 3. Render Badges
    if (currentAnnotations.badges) {
        currentAnnotations.badges.forEach(bg => {
            const coords = getSquareCenter(bg.square);
            if (!coords) return;

            const squareSize = document.getElementById('diagramBoardWrapper').clientWidth / 8;

            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            // Position: Top Right corner
            const cx = coords.x + (squareSize / 2) - (squareSize * 0.2);
            const cy = coords.y - (squareSize / 2) + (squareSize * 0.2);
            const r = squareSize * 0.25;

            // Circle background
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', cx);
            circle.setAttribute('cy', cy);
            circle.setAttribute('r', r);
            circle.setAttribute('fill', BADGE_COLORS[bg.type] || '#888');
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '2');

            // Text
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', cx);
            text.setAttribute('y', cy);
            text.setAttribute('dy', '.35em');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-family', 'Arial, sans-serif');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('font-size', r * 1.6); // Scale with radius
            text.setAttribute('fill', '#fff');
            text.textContent = bg.type;

            group.appendChild(circle);
            group.appendChild(text);

            // Interaction
            group.style.cursor = currentTool === 'eraser' ? 'pointer' : 'default';
            group.style.pointerEvents = 'all'; // Allow clicking
            group.addEventListener('click', (e) => {
                if (currentTool === 'eraser') {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleBadge(bg.square, bg.type); // Toggle removes if exists
                }
            });

            overlay.appendChild(group);
        });
    }
}

// Badge Colors
const BADGE_COLORS = {
    '!': '#22c55e',   // Good
    '!!': '#15803d',  // Brilliant
    '?': '#eab308',   // Mistake
    '??': '#ef4444',  // Blunder
    '!?': '#3b82f6',  // Interesting
    '?!': '#a855f7'   // Dubious
};

function toggleBadge(square, type) {
    if (!currentAnnotations.badges) currentAnnotations.badges = [];

    const index = currentAnnotations.badges.findIndex(b => b.square === square);

    if (index >= 0) {
        // If same type, remove. If diff type, replace.
        if (currentAnnotations.badges[index].type === type) {
            currentAnnotations.badges.splice(index, 1);
        } else {
            currentAnnotations.badges[index].type = type;
        }
    } else {
        currentAnnotations.badges.push({ square, type });
    }
    renderAnnotations();
}

function renderPreview(start, end) {
    renderAnnotations();

    const overlay = document.getElementById('diagramOverlay');
    const type = currentTool.split('-')[0];
    const color = TOOL_COLORS[currentTool.split('-')[1]];

    if (type === 'arrow' && start !== end) {
        drawSvgArrow(overlay, start, end, color, true);
    }
}

function drawSvgArrow(svg, startSq, endSq, color, isPreview = false) {
    const start = getSquareCenter(startSq);
    const end = getSquareCenter(endSq);

    if (!start || !end) return null;

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    if (isPreview) {
        group.setAttribute('opacity', '0.6');
    } else {
        group.setAttribute('opacity', '0.8');
    }

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLen = 20; // Size of head
    const lineEndX = end.x - (headLen - 5) * Math.cos(angle);
    const lineEndY = end.y - (headLen - 5) * Math.sin(angle);

    // Thick Line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', start.x);
    line.setAttribute('y1', start.y);
    line.setAttribute('x2', lineEndX);
    line.setAttribute('y2', lineEndY);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '10');
    line.setAttribute('stroke-linecap', 'round');
    group.appendChild(line);

    // Hit Area (invisible)
    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hitArea.setAttribute('x1', start.x);
    hitArea.setAttribute('y1', start.y);
    hitArea.setAttribute('x2', end.x);
    hitArea.setAttribute('y2', end.y);
    hitArea.setAttribute('stroke', 'transparent');
    hitArea.setAttribute('stroke-width', '20');
    group.appendChild(hitArea);

    // Arrowhead
    const p1x = end.x;
    const p1y = end.y;
    const p2x = end.x - headLen * Math.cos(angle - Math.PI / 6);
    const p2y = end.y - headLen * Math.sin(angle - Math.PI / 6);
    const p3x = end.x - headLen * Math.cos(angle + Math.PI / 6);
    const p3y = end.y - headLen * Math.sin(angle + Math.PI / 6);

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`);
    polygon.setAttribute('fill', color);
    group.appendChild(polygon);

    svg.appendChild(group);
    return group;
}

function getSquareCenter(square) {
    if (!square) return null;

    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1]) - 1;

    if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;

    const wrapper = document.getElementById('diagramBoardWrapper');
    const size = wrapper.clientWidth;
    const sqSize = size / 8;

    const orientation = diagramBoard.orientation();
    let x, y;

    if (orientation === 'white') {
        x = (file * sqSize) + (sqSize / 2);
        y = ((7 - rank) * sqSize) + (sqSize / 2);
    } else {
        x = ((7 - file) * sqSize) + (sqSize / 2);
        y = (rank * sqSize) + (sqSize / 2);
    }

    return { x, y };
}

function exportDiagram() {
    const element = document.getElementById('diagramBoardWrapper');
    const originalStyle = element.style.cssText; // Save original styles

    // Get who is on turn
    const turn = game.turn(); // 'w' or 'b'
    const turnText = turn === 'w' ? 'Bílý na tahu' : 'Černý na tahu';
    const turnBg = turn === 'w' ? '#fff' : '#000';

    // Create footer bar element (NOT absolute - appended to end of wrapper)
    const footer = document.createElement('div');
    footer.id = 'export-footer';
    footer.style.cssText = `
        width: 100%;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #262421;
        color: #fff;
        font-family: 'Open Sans', sans-serif;
        font-size: 14px;
        font-weight: 600;
        padding: 0 12px;
        box-sizing: border-box;
        border-top: 1px solid rgba(255,255,255,0.15);
    `;

    // Left side: Logo
    const logoImg = document.createElement('img');
    logoImg.src = '/images/jablonec_logo.png';
    logoImg.style.cssText = 'height: 32px; width: auto;';

    // Right side: Turn indicator
    const turnDiv = document.createElement('div');
    turnDiv.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    turnDiv.innerHTML = `
        <span style="display:inline-block; width:14px; height:14px; background:${turnBg}; border-radius:50%; border:1px solid #777;"></span>
        <span>${turnText}</span>
    `;

    footer.appendChild(logoImg);
    footer.appendChild(turnDiv);

    // Append footer AFTER the board (at the end of wrapper)
    element.appendChild(footer);

    // Set wrapper background to match footer
    element.style.backgroundColor = "#262421";

    // Wait for logo to load before capturing
    logoImg.onload = () => captureBoard();
    logoImg.onerror = () => captureBoard(); // Capture even if logo fails

    // Fallback timeout if onload doesn't fire (cached image)
    setTimeout(() => {
        if (footer.parentNode) captureBoard();
    }, 300);

    let captured = false;
    function captureBoard() {
        if (captured) return;
        captured = true;

        html2canvas(element, {
            backgroundColor: null,
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false
        }).then(canvas => {
            // Cleanup
            if (footer.parentNode) footer.parentNode.removeChild(footer);
            element.style.cssText = originalStyle;

            const link = document.createElement('a');
            link.download = `sachovy-diagram-${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            // Cleanup in case of error
            if (footer.parentNode) footer.parentNode.removeChild(footer);
            element.style.cssText = originalStyle;

            console.error("Export failed", err);
            alert("Chyba při exportu diagramu.");
        });
    }
}

// --- Solver Admin Functions ---

function enableMoveRecording(type) {
    solverState.isRecording = true;
    solverState.recordingType = type;
    solverState.currentLine = []; // Reset line
    solverState.currentPendingMove = null;

    // Show controls
    document.getElementById('recordingControls').style.display = 'flex';
    document.getElementById('recordingStatusLabel').innerText = `Nahrávám: ${getLabelForType(type)}`;
    document.getElementById('recordingMovesPreview').innerText = '-';

    // Hide type buttons to prevent confusion
    document.querySelectorAll('#solverTools > div:first-child').forEach(div => div.style.display = 'none');

    // Disable drawing canvas momentarily to allow board interaction
    document.getElementById('diagramOverlay').style.pointerEvents = 'none';

    // Determine who is on turn based on GAME state + moves already made?
    // Actually, for the start of recording, it is based on game.turn()
    // But subsequent moves must flip turn.
    // We need a local Chess instance to track legality during recording!
    solverState.recordingGame = new Chess(game.fen());

    // Enable draggable to allow making moves
    initDraggableBoardForRecording();
}

function initDraggableBoardForRecording() {
    diagramBoard = Chessboard('diagramBoard', {
        position: solverState.recordingGame.fen(),
        draggable: true,
        onDragStart: function (source, piece) {
            // Only allow moving pieces of the side to move
            const turn = solverState.recordingGame.turn();
            const pieceColor = piece.charAt(0); // 'w' or 'b'

            if (pieceColor !== turn) {
                return false;
            }
            return true;
        },
        onDrop: handleSolverDrop,
        pieceTheme: '/img/chesspieces/wikipedia/{piece}.png'
    });
}

function handleSolverDrop(source, target) {
    if (!solverState.isRecording) return 'snapback';

    // Validate with local game instance
    const move = solverState.recordingGame.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return 'snapback';

    // Valid move
    const moveKey = `${source}-${target}`;
    solverState.currentLine.push(moveKey);

    // Set pending move to the FIRST move of the sequence (the key for storage)
    if (!solverState.currentPendingMove) {
        solverState.currentPendingMove = moveKey;
    }

    // Update UI
    const movesText = solverState.currentLine.join(', ');
    document.getElementById('recordingMovesPreview').innerText = movesText;

    // Do NOT show editor yet. Wait for "Finish".
    // Board updates automatically by drop, but let's confirm position
    // diagramBoard.position(solverState.recordingGame.fen()); // optional, drop does it nicely mostly
}

function finishRecording() {
    if (solverState.currentLine.length === 0) {
        alert("Nebyly nahrány žádné tahy.");
        return;
    }

    // Show Editor
    document.getElementById('solutionEditor').style.display = 'block';

    // Hide controls
    document.getElementById('recordingControls').style.display = 'none';

    document.getElementById('activeMoveLabel').innerText = solverState.currentLine.join(', ');

    const typeLabel = getLabelForType(solverState.recordingType);
    const typeColor = getColorForType(solverState.recordingType);
    const badge = document.getElementById('activeMoveType');
    badge.innerText = typeLabel;
    badge.style.backgroundColor = typeColor;
}

function cancelRecording() {
    // Reset state
    solverState.isRecording = false;
    solverState.currentLine = [];
    solverState.recordingGame = null;

    // Reset UI
    document.getElementById('recordingControls').style.display = 'none';
    document.getElementById('solutionEditor').style.display = 'none';

    // Restore buttons
    document.querySelectorAll('#solverTools > div:first-child').forEach(div => div.style.display = 'flex');

    // Reset board to initial Position
    resetBoardToReadOnly();
    document.getElementById('diagramOverlay').style.pointerEvents = 'auto'; // Enable drawing
}

function resetBoardToReadOnly() {
    diagramBoard = Chessboard('diagramBoard', {
        position: game.fen(),
        draggable: false,
        pieceTheme: '/img/chesspieces/wikipedia/{piece}.png'
    });
}

function saveSolverStep() {
    const comment = document.getElementById('solverComment').value;
    const firstMoveKey = solverState.currentPendingMove; // Key is the first move

    if (firstMoveKey && solverState.recordingType && solverState.currentLine.length > 0) {
        solverState.recordedMoves[firstMoveKey] = {
            type: solverState.recordingType,
            comment: comment,
            line: [...solverState.currentLine] // Save full sequence
        };
        updateSolutionList();

        // Reset UI
        document.getElementById('solutionEditor').style.display = 'none';
        document.getElementById('solverComment').value = '';

        cancelRecording(); // Cleans up UI and state
    }
}

function updateSolutionList() {
    const container = document.getElementById('solutionList');
    container.innerHTML = '';

    Object.entries(solverState.recordedMoves).forEach(([move, data]) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; padding:4px; border-bottom:1px solid rgba(255,255,255,0.1); align-items:center;';

        // Display line if available
        const lineText = data.line ? data.line.join(' -> ') : move;

        div.innerHTML = `
            <div style="flex:1; margin-right:5px; overflow:hidden;">
                <div style="font-size:0.9rem;"><strong style="color:${getColorForType(data.type)}">${getLabelForType(data.type)}</strong></div>
                <div style="font-size:0.8rem; opacity:0.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${lineText}">${lineText}</div>
                ${data.comment ? `<div style="font-size:0.75rem; color:#aaa; font-style:italic;">${data.comment}</div>` : ''}
            </div>
            <button onclick="deleteSolution('${move}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.1rem;">&times;</button>
        `;
        container.appendChild(div);
    });
}

function deleteSolution(move) {
    delete solverState.recordedMoves[move];
    updateSolutionList();
}

function getLabelForType(type) {
    if (type === 'correct') return 'Správný';
    if (type === 'alternative') return 'Alternativa';
    if (type === 'mistake') return 'Chyba';
    return type;
}

function getColorForType(type) {
    if (type === 'correct') return '#22c55e';
    if (type === 'alternative') return '#3b82f6';
    if (type === 'mistake') return '#ef4444';
    return '#ccc';
}

async function saveDiagramToCloud() {
    // Wait for auth to be fully initialized (token loaded from localstorage)
    let retries = 0;
    while ((!window.auth || !auth.token) && retries < 20) {
        await new Promise(r => setTimeout(r, 100)); // Wait up to 2s
        retries++;
    }

    if (!window.auth || !auth.token) {
        await modal.alert("Nejste přihlášeni. Pro uložení diagramu se prosím přihlašte.", "Přihlášení vyžadováno");
        return;
    }

    const defaultName = currentDiagramId ? currentDiagramName : `Diagram ${new Date().toLocaleTimeString()}`;
    const title = currentDiagramId ? "Aktualizovat diagram" : "Uložit diagram";
    const name = await modal.prompt("Zadejte název diagramu:", defaultName, title);
    if (!name) return;

    // Use game.fen() for complete FEN (includes turn, castling, etc.)
    // game is the global Chess.js instance from game-recorder.js
    const fullFen = game.fen();

    // Use game.turn() - turn is determined by position in the game
    const selectedTurn = game.turn();

    const payload = {
        fen: fullFen,
        toMove: selectedTurn,
        annotations: currentAnnotations,
        solution: solverState.recordedMoves,
        name: name,
        description: ""
    };

    try {
        const isUpdate = !!currentDiagramId;
        const url = isUpdate ? `/api/diagrams/${currentDiagramId}` : "/api/diagrams";
        const method = isUpdate ? "PUT" : "POST";

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...auth.getHeaders()
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            await modal.alert(`Diagram "${data.name}" byl úspěšně uložen!`, "Úspěch");
            closeDiagramEditor();
        } else {
            const err = await response.json();
            await modal.alert(`Chyba při ukládání: ${err.error || 'Neznámá chyba'}`, "Chyba");
        }
    } catch (error) {
        console.error("Save error:", error);
        await modal.alert("Chyba při komunikaci se serverem.", "Chyba sítě");
    }
}
