/**
 * Diagram Editor Logic
 * Handles the modal, chessboard, and drawing tools (arrows/squares)
 */

let diagramBoard = null;
let currentTool = 'arrow-green'; // Default tool
let isDrawing = false;
let startSquare = null;
let currentAnnotations = {
    arrows: [], // {start: 'e2', end: 'e4', color: 'green'}
    squares: [] // {square: 'e4', color: 'green'}
};

// Solver State
let solverState = {
    isRecording: false,
    recordingType: null, // 'correct', 'alternative', 'mistake'
    recordedMoves: {}, // Key: "e2-e4", Value: { type: 'correct', comment: '...' }
    currentPendingMove: null
};

// Colors mapping
const TOOL_COLORS = {
    'green': '#22c55e',
    'red': '#ef4444',
    'blue': '#3b82f6',
    'yellow': '#eab308'
};

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

    // Initialize board if not already done
    if (!diagramBoard) {
        diagramBoard = Chessboard('diagramBoard', {
            position: game.fen(),
            draggable: false, // Read only
            showNotation: true,
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        });

        // Setup event listeners on overlay
        setupOverlayEvents();
    } else {
        diagramBoard.position(game.fen());
    }

    // Clear previous annotations
    clearDiagram();

    // Resize to be sure
    setTimeout(() => diagramBoard.resize(), 200);
}

/**
 * Close the editor
 */
function closeDiagramEditor() {
    document.getElementById('diagramEditorModal').classList.remove('active');
    document.body.style.overflow = ''; // Unlock scroll
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
    currentAnnotations = { arrows: [], squares: [] };
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

    html2canvas(element, {
        backgroundColor: null,
        scale: 2
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'sachovy-diagram.png';
        link.href = canvas.toDataURL();
        link.click();
    }).catch(err => {
        console.error("Export failed", err);
        alert("Chyba při exportu obrázku.");
    });
}

// --- Solver Admin Functions ---

function enableMoveRecording(type) {
    solverState.isRecording = true;
    solverState.recordingType = type;

    // Disable drawing canvas momentarily to allow board interaction
    document.getElementById('diagramOverlay').style.pointerEvents = 'none';

    document.querySelectorAll('#solverTools button').forEach(b => b.style.opacity = '0.5');
    if (type === 'correct') document.getElementById('recordCorrectBtn').style.opacity = '1';
    if (type === 'alternative') document.getElementById('recordAltBtn').style.opacity = '1';
    if (type === 'mistake') document.getElementById('recordBadBtn').style.opacity = '1';

    // Enable draggable to allow making moves
    diagramBoard = Chessboard('diagramBoard', {
        position: diagramBoard.position(),
        draggable: true,
        onDrop: handleSolverDrop,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });
}

function handleSolverDrop(source, target) {
    if (!solverState.isRecording) return 'snapback';

    // Normalize move string logic
    const moveKey = `${source}-${target}`; // Simple for now. Ideally should be SAN if we had engine, but coordinate move is fine for solver.

    // Show Editor
    document.getElementById('solutionEditor').style.display = 'block';
    document.getElementById('activeMoveLabel').innerText = `${source} -> ${target}`;

    const typeLabel = getLabelForType(solverState.recordingType);
    const typeColor = getColorForType(solverState.recordingType);
    const badge = document.getElementById('activeMoveType');
    badge.innerText = typeLabel;
    badge.style.backgroundColor = typeColor;

    solverState.currentPendingMove = moveKey;

    // Snapback to keep position clean? Or show move?
    // Let's snapback after a short delay so user sees the move they made.
    setTimeout(() => {
        diagramBoard.position(game.fen());
    }, 200);
}

function saveSolverStep() {
    const comment = document.getElementById('solverComment').value;
    const moveKey = solverState.currentPendingMove;

    if (moveKey && solverState.recordingType) {
        solverState.recordedMoves[moveKey] = {
            type: solverState.recordingType,
            comment: comment
        };
        updateSolutionList();

        // Reset UI
        document.getElementById('solutionEditor').style.display = 'none';
        document.getElementById('solverComment').value = '';
        solverState.isRecording = false;

        // Re-enable drawing layer
        document.getElementById('diagramOverlay').style.pointerEvents = 'auto';

        // Reset board state to non-draggable editor mode
        diagramBoard = Chessboard('diagramBoard', {
            position: game.fen(),
            draggable: false,
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        });

        // Reset buttons opacity
        document.querySelectorAll('#solverTools button').forEach(b => b.style.opacity = '1');
    }
}

function updateSolutionList() {
    const container = document.getElementById('solutionList');
    container.innerHTML = '';

    Object.entries(solverState.recordedMoves).forEach(([move, data]) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; padding:4px; border-bottom:1px solid rgba(255,255,255,0.1); align-items:center;';
        div.innerHTML = `
            <span><strong style="color:${getColorForType(data.type)}">${move}</strong>: ${data.comment ? data.comment.substring(0, 30) + '...' : ''}</span>
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

    const name = await modal.prompt("Zadejte název diagramu:", `Diagram ${new Date().toLocaleTimeString()}`, "Uložit diagram");
    if (!name) return;

    const payload = {
        fen: diagramBoard.position('fen'),
        annotations: currentAnnotations,
        solution: solverState.recordedMoves,
        name: name,
        description: ""
    };

    try {
        const response = await fetch('/api/diagrams', {
            method: 'POST',
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
