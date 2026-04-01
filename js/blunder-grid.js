let puzzleData = [];
let filteredData = [];
let boards = {};
let games = {};

let currentMode = 'training';
let currentThreshold = 12;

document.addEventListener('DOMContentLoaded', async () => {
    const statusMsg = document.getElementById('status-message');
    
    // UI Eventy
    const modeSelect = document.getElementById('mode-select');
    const thresholdInput = document.getElementById('threshold-input');
    const thresholdVal = document.getElementById('threshold-val');
    const filterBtn = document.getElementById('filter-btn');

    let renderTimeouts = [];

    modeSelect.addEventListener('change', (e) => {
        currentMode = e.target.value;
        renderGrid();
    });

    // Změna procenta už jen updatuje číslo vizuálně, nepřekresluje grid!
    thresholdInput.addEventListener('input', (e) => {
        currentThreshold = parseInt(e.target.value);
        thresholdVal.textContent = currentThreshold;
    });
    
    // Teprve tlačítko aktivuje tvrdý přepočet 
    filterBtn.addEventListener('click', () => {
        renderGrid();
    });
    
    try {
        statusMsg.style.display = 'block';
        
        const response = await fetch('/data/duda-blunders.json');
        if (!response.ok) throw new Error('Failed to load JSON');
        
        puzzleData = await response.json();
        
        if (puzzleData.length === 0) {
            statusMsg.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Nebyly nalezeny žádné blundery.';
            return;
        }
        
        statusMsg.style.display = 'none';
        renderGrid();
        
    } catch (err) {
        console.error(err);
        statusMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Nelze načíst data chyb (<a href="/scripts/generate-blunders.js" target="_blank">Vygenerovali jste json?</a>)`;
    }
});

function renderGrid() {
    // Zrušíme staré plánované rendery při rychlém scrollování
    if (typeof renderTimeouts !== 'undefined') {
        renderTimeouts.forEach(t => clearTimeout(t));
        renderTimeouts = [];
    }

    const gridEl = document.getElementById('blunder-grid');
    gridEl.innerHTML = '';
    
    // Filtrace
    filteredData = puzzleData.filter(p => !p.winProbDrop || parseFloat(p.winProbDrop) >= currentThreshold);

    if (filteredData.length === 0) {
        gridEl.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: #888;">Žádné chyby pro tento filtr. Zkus jej snížit.</div>';
        return;
    }
    
    filteredData.forEach((puzzle, filtIndex) => {
        const id = `board-${filtIndex}`;
        const realIndex = puzzleData.indexOf(puzzle); // Původní index pro navázání logiky
        
        const isMiss = puzzle.type === 'miss';
        const tagClass = isMiss ? 'blunder-tag miss' : 'blunder-tag';
        const tagText = isMiss ? `Promarněná šance` : `Blunder`;
        const dropText = puzzle.winProbDrop ? `(-${puzzle.winProbDrop} % Výhra)` : `(${puzzle.evalAfter})`;

        let cardHtml = '';

        if (currentMode === 'training') {
            cardHtml = `
                <div class="blunder-card" data-index="${realIndex}">
                    <div class="blunder-card-header">
                        <div class="${tagClass}">${tagText}</div>
                        <div class="blunder-players">${escapeHtml(puzzle.white)} vs ${escapeHtml(puzzle.black)} ${puzzle.result}</div>
                    </div>
                    <div class="board-container" id="${id}"></div>
                    <div class="card-controls">
                        <button class="card-btn eval-btn" onclick="showHint(${realIndex})">
                            <i class="fa-solid fa-lightbulb"></i> Ukaž nápovědu
                        </button>
                        <button class="card-btn show-game" onclick="showGameMove(${realIndex})">
                            <i class="fa-solid fa-xmark"></i> ${isMiss ? 'Promarněný tah' : 'Původní chyba'}
                        </button>
                        <button class="card-btn show-best" onclick="showBestMove(${realIndex})">
                            <i class="fa-solid fa-check"></i> Správný tah
                        </button>
                    </div>
                    <div class="card-footer" title="Ztráta pravděpodobnosti výhry">
                        Eval: <span id="eval-${realIndex}">${puzzle.evalBefore > 0 ? '+' : ''}${puzzle.evalBefore} ${dropText}</span>
                    </div>
                </div>
            `;
        } else {
            // Galerie
            cardHtml = `
                <div class="blunder-card" data-index="${realIndex}">
                    <div class="blunder-card-header">
                        <div class="${tagClass}">${tagText}</div>
                        <div class="blunder-players">${escapeHtml(puzzle.white)} vs ${escapeHtml(puzzle.black)} ${puzzle.result}</div>
                    </div>
                    <div class="board-container" id="${id}"></div>
                    <div class="card-controls">
                        <div style="color: #bbb; font-size: 0.9rem; margin-bottom: 0.5rem; text-align: center;">V partii se stalo: <strong>${puzzle.blunderMoveSAN}</strong></div>
                        <button class="card-btn show-best" onclick="toggleComparison(${realIndex}, this)">
                            <i class="fa-solid fa-exchange"></i> Ukázat, jak to mělo být
                        </button>
                    </div>
                    <div class="card-footer" title="Ztráta pravděpodobnosti výhry">
                        Ztráta šance: <span id="eval-${realIndex}" style="color: #e57373; font-weight: bold;">${dropText}</span>
                    </div>
                </div>
            `;
        }
        
        gridEl.insertAdjacentHTML('beforeend', cardHtml);
        
        const tId = setTimeout(() => {
            initBoard(realIndex, id, puzzle);
        }, 50 * filtIndex);
        
        if (typeof renderTimeouts !== 'undefined') {
            renderTimeouts.push(tId);
        }
    });
}

function initBoard(realIndex, elementId, data) {
    const game = new Chess(data.fenBefore);
    games[realIndex] = game;
    
    if (currentMode === 'training') {
        const config = {
            draggable: true,
            position: data.fenBefore,
            orientation: data.playerColor,
            pieceTheme: 'img/chesspieces/wikipedia/{piece}.png',
            onDragStart: (source, piece) => onDragStart(realIndex, source, piece),
            onDrop: (source, target) => onDrop(realIndex, source, target),
            onSnapEnd: () => onSnapEnd(realIndex)
        };
        boards[realIndex] = Chessboard(elementId, config);
    } else {
        // Galerie
        game.move(data.blunderMoveSAN); // aplikuj ihned osudný tah
        const config = {
            draggable: false,
            position: game.fen(),
            orientation: data.playerColor,
            pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
        };
        boards[realIndex] = Chessboard(elementId, config);

        // Znázornění "??" odznaku v cílovém políčku osudného tahu
        setTimeout(() => {
            const targetSquare = data.blunderMoveLAN.substring(2,4); 
            const squareEl = document.querySelector(`#${elementId} .square-${targetSquare}`);
            if (squareEl) {
                squareEl.style.boxShadow = "inset 0 0 0 4px rgba(244, 67, 54, 0.8)";
                squareEl.style.position = "relative";
                // Kontrola jestli badge už není
                if(!squareEl.querySelector('.badge-overlay')) {
                    const badge = document.createElement('div');
                    badge.className = 'badge-overlay';
                    badge.innerText = data.type === 'miss' ? '?!' : '??';
                    squareEl.appendChild(badge);
                }
            }
        }, 300); // 300ms prodleva pro jistotu že DOM šachovnice existuje
    }
}

function onDragStart(index, source, piece) {
    const game = games[index];
    if (game.game_over()) return false;
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

function onDrop(index, source, target) {
    const game = games[index];
    const data = puzzleData[index];
    
    const moveInfo = { from: source, to: target, promotion: 'q' };
    const move = game.move(moveInfo);
    
    if (move === null) return 'snapback';
    
    const isCorrect = (move.to === data.bestMoveLAN.substring(2,4) && move.from === data.bestMoveLAN.substring(0,2));
    
    if (isCorrect) {
        showStatusEffect(index, 'success');
        document.getElementById(`eval-${index}`).textContent = `Správně!`;
        document.getElementById(`eval-${index}`).style.color = '#81c784';
    } else {
        showStatusEffect(index, 'error');
        game.undo();
        return 'snapback';
    }
}

function onSnapEnd(index) {
    boards[index].position(games[index].fen());
}

function showStatusEffect(index, type) {
    const card = document.querySelector(`.blunder-card[data-index="${index}"]`);
    if(type === 'success') {
        card.style.boxShadow = '0 0 20px rgba(76, 175, 80, 0.6)';
        card.style.borderColor = 'rgba(76, 175, 80, 0.8)';
    } else {
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 400);
        card.style.borderColor = 'rgba(244, 67, 54, 0.8)';
        setTimeout(() => card.style.borderColor = 'rgba(255, 255, 255, 0.05)', 600);
    }
}

window.showHint = function(index) {
    const data = puzzleData[index];
    const evalEl = document.getElementById(`eval-${index}`);
    if (data.hint) {
        evalEl.innerHTML = `<strong>Hint:</strong> ${data.hint}`;
    } else {
        evalEl.innerHTML = `<strong>Nápověda:</strong> Jde o figurku na poli ${data.bestMoveLAN.substring(0,2)}`;
    }
}

window.showGameMove = function(index) {
    const data = puzzleData[index];
    const game = games[index];
    game.load(data.fenBefore);
    boards[index].position(data.fenBefore);
    game.move(data.blunderMoveSAN);
    boards[index].position(game.fen());
    
    document.getElementById(`eval-${index}`).textContent = `Chyba v partii (${data.evalAfter})`;
    document.getElementById(`eval-${index}`).style.color = '#e57373';
}

window.showBestMove = function(index) {
    const data = puzzleData[index];
    const game = games[index];
    game.load(data.fenBefore);
    boards[index].position(data.fenBefore);
    game.move({
        from: data.bestMoveLAN.substring(0,2), 
        to: data.bestMoveLAN.substring(2,4), 
        promotion: data.bestMoveLAN.substring(4,5) || 'q'
    });
    boards[index].position(game.fen());
    
    showStatusEffect(index, 'success');
    document.getElementById(`eval-${index}`).textContent = `Motor doporučuje`;
    document.getElementById(`eval-${index}`).style.color = '#81c784';
}

// Přepínání galerie
window.toggleComparison = function(index, btnEl) {
    const data = puzzleData[index];
    const game = games[index];
    const showsBest = btnEl.getAttribute('data-shown-best') === 'true';

    // Výmaz odznaků
    const boardEl = document.querySelector(`.blunder-card[data-index="${index}"] .board-container`);
    const squares = boardEl.querySelectorAll('[class^="square-"]');
    squares.forEach(s => s.style.boxShadow = 'none');
    boardEl.querySelectorAll('.badge-overlay').forEach(b => b.remove());

    game.load(data.fenBefore);

    if (showsBest) {
        // Switch back to blunder
        game.move(data.blunderMoveSAN);
        btnEl.setAttribute('data-shown-best', 'false');
        btnEl.innerHTML = `<i class="fa-solid fa-exchange"></i> Ukázat, jak to mělo být`;
        btnEl.style.color = '';
        btnEl.style.borderColor = '';
        
        // Obnov badge blunderu
        const targetSquare = data.blunderMoveLAN.substring(2,4); 
        setTimeout(() => {
            const squareEl = boardEl.querySelector('.square-' + targetSquare);
            if (squareEl) {
                squareEl.style.boxShadow = "inset 0 0 0 4px rgba(244, 67, 54, 0.8)";
                squareEl.style.position = "relative";
                const badge = document.createElement('div');
                badge.className = 'badge-overlay';
                badge.innerText = data.type === 'miss' ? '?!' : '??';
                squareEl.appendChild(badge);
            }
        }, 150);
        
    } else {
        // Show correct move
        game.move({
            from: data.bestMoveLAN.substring(0,2), 
            to: data.bestMoveLAN.substring(2,4), 
            promotion: data.bestMoveLAN.substring(4,5) || 'q'
        });
        btnEl.setAttribute('data-shown-best', 'true');
        btnEl.innerHTML = `<i class="fa-solid fa-undo"></i> Zpět na původní chybu`;
        btnEl.style.color = '#81c784';
        btnEl.style.borderColor = 'rgba(76, 175, 80, 0.3)';
        
        // Zelený rámeček na správný tah
        const targetSquare = data.bestMoveLAN.substring(2,4); 
        setTimeout(() => {
            const squareEl = boardEl.querySelector('.square-' + targetSquare);
            if (squareEl) {
                squareEl.style.boxShadow = "inset 0 0 0 4px rgba(76, 175, 80, 0.8)";
            }
        }, 150);
    }
    
    boards[index].position(game.fen());
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
