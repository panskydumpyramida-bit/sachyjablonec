let puzzleData = [];
let filteredData = [];
let boards = {};
let games = {};

let currentMode = 'training';
let currentThreshold = 12;

let currentPlayer = null;
let debounceTimer = null;

// Lichess formula to convert CP to Win Probability (0 to 100)
function getWinProbability(evalObj) {
    if (!evalObj) return 50;
    if (evalObj.mate !== undefined && evalObj.mate !== null) {
        return evalObj.mate > 0 ? 100 : 0;
    }
    const cp = evalObj.cp;
    if (cp === undefined || cp === null) return 50;
    const expValue = Math.exp(-0.00368208 * cp);
    return 50 + 50 * (2 / (1 + expValue) - 1);
}

document.addEventListener('DOMContentLoaded', async () => {
    // UI Eventy
    const modeSelect = document.getElementById('mode-select');
    const thresholdInput = document.getElementById('threshold-input');
    const thresholdVal = document.getElementById('threshold-val');
    const filterBtn = document.getElementById('filter-btn');
    const searchInput = document.getElementById('playerSearch');

    let renderTimeouts = [];

    modeSelect.addEventListener('change', (e) => {
        currentMode = e.target.value;
        renderGrid();
    });

    thresholdInput.addEventListener('input', (e) => {
        currentThreshold = parseInt(e.target.value);
        thresholdVal.textContent = currentThreshold;
    });
    
    filterBtn.addEventListener('click', () => {
        renderGrid();
    });

    // -------- Vyhledávání hráčů --------
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => handleSearch(searchInput.value), 300);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            document.getElementById('autocompleteResults').style.display = 'none';
        }
    });
});

function getToken() {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

async function handleSearch(query) {
    const resultsDiv = document.getElementById('autocompleteResults');
    if (query.length < 2) { resultsDiv.style.display = 'none'; return; }

    const token = getToken();
    try {
        const response = await fetch(`/api/chess/players?q=${encodeURIComponent(query)}&limit=8`, {
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        if (!response.ok) throw new Error('Search failed');
        const players = await response.json();

        if (players.length === 0) {
            resultsDiv.innerHTML = '<div class="autocomplete-item"><span style="color: #777;">Žádný hráč</span></div>';
        } else {
            resultsDiv.innerHTML = players.map(p => `
                <div class="autocomplete-item" onclick="selectPlayer('${p.name.replace(/'/g, "\\'")}')">
                    <span>${p.name}</span>
                    <span style="color: #777;">${p.totalGames}</span>
                </div>
            `).join('');
        }
        resultsDiv.style.display = 'block';
    } catch (e) { console.error('Search error:', e); }
}

async function selectPlayer(name) {
    currentPlayer = name;
    document.getElementById('playerSearch').value = name;
    document.getElementById('autocompleteResults').style.display = 'none';
    
    // Spustit skenování chyb
    startBlunderScan(name);
}

// Pomocná API Request funkce pro Eval (Lichess Cloud -> Chess-API)
async function getPositionEval(fen) {
    // Zabalení timeoutů
    const fetchWithTimeout = async (resource, options = {}) => {
        const { timeout = 8000 } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    };

    // 1. Zkusit Lichess Cloud databázi (zdarma a bleskové)
    try {
        const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`;
        const response = await fetchWithTimeout(url, { timeout: 3000 });
        if (response.ok) {
            const data = await response.json();
            if (data && data.pvs && data.pvs[0]) {
                return {
                    cp: data.pvs[0].cp,
                    mate: data.pvs[0].mate,
                    bestMove: data.pvs[0].moves.split(' ')[0],
                    source: 'lichess'
                };
            }
        }
    } catch (e) { /* ignore */ }

    // 2. Fallback Stockfish přes Chess-API.com
    try {
        const chessApiRes = await fetchWithTimeout('https://chess-api.com/v1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fen: fen, depth: 11 }), // Nízká hloubka pro web-client rychlost
            timeout: 5000
        });
        
        if (chessApiRes.ok) {
            const data = await chessApiRes.json();
            if (data && data.eval !== undefined) {
                return {
                    cp: Math.round(data.eval * 100), // chess-api uses floats like 1.5, lichess uses 150
                    mate: data.mate,
                    bestMove: data.move,
                    source: 'chess-api'
                };
            }
        }
    } catch (e) { console.warn("Chess-API error:", e); }
    
    return null;
}

async function startBlunderScan(playerName) {
    const statusMsg = document.getElementById('status-message');
    const statusText = document.getElementById('status-text');
    const progContainer = document.getElementById('progress-container');
    const progBar = document.getElementById('progress-bar');
    const gridEl = document.getElementById('blunder-grid');

    // Reset UI
    gridEl.innerHTML = '';
    puzzleData = [];
    filteredData = [];
    statusMsg.style.display = 'block';
    progContainer.style.display = 'block';
    progBar.style.width = '0%';
    
    statusText.innerHTML = `Stahuji posledních 5 partií hráče <strong style="color:var(--primary-color)">${escapeHtml(playerName)}</strong>...`;

    try {
        const token = getToken();
        // Získáme posledních 5 nejnovějších partií tohoto hráče
        const API_URL = '/api/chess'; 
        const params = new URLSearchParams({
            player: playerName,
            color: 'both',
            sort: 'date_desc',
            limit: 5,
            offset: 0
        });

        const resp = await fetch(`${API_URL}/games?${params}`, {
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        
        if (!resp.ok) throw new Error("Chyba při stahování partií");
        
        const data = await resp.json();
        const gamesList = data.games || [];
        
        if (gamesList.length === 0) {
            statusText.innerHTML = `Nebyly nalezeny žádné partie hráče ${escapeHtml(playerName)}.`;
            progContainer.style.display = 'none';
            return;
        }

        // ====== Hlavní Skenovací Jádro ======
        for (let gIndex = 0; gIndex < gamesList.length; gIndex++) {
            const gameData = gamesList[gIndex];
            
            statusText.innerHTML = `Analyzuji partii <strong>${gIndex + 1}/${gamesList.length}</strong>: ${escapeHtml(gameData.whitePlayer)} - ${escapeHtml(gameData.blackPlayer)}...`;
            progBar.style.width = `${((gIndex) / gamesList.length) * 100}%`;

            const chess = new Chess();
            const movesArr = gameData.moves.split(' ').filter(m => m);
            // Validace přes temporary chess.js
            for (let m of movesArr) {
                try { chess.move(m); } catch (e) { break; }
            }

            const history = chess.history({ verbose: true });
            const tempChess = new Chess();
            
            let evals = [];
            
            // Tah po tahu - Střílíme asynchronní API požadavky
            // Optimalizace: Batche nebo ne? Radši přímo abychom neriskovali RateLimit 429
            for (let i = 0; i <= history.length; i++) {
                
                // UX Progress Update každých 5 tahů
                if (i % 5 === 0) {
                    const partialPct = ((gIndex) / gamesList.length) * 100 + ((i / history.length) * (100 / gamesList.length));
                    progBar.style.width = `${Math.min(partialPct, 99)}%`;
                    statusText.innerHTML = `Analýza tahů (${i}/${history.length}). Partii ${gIndex + 1} z ${gamesList.length}`;
                }

                // Oprava E.P. FENu pro API
                const fenParts = tempChess.fen().split(' ');
                if (fenParts.length >= 4 && fenParts[3] !== '-') fenParts[3] = '-';
                const safeFen = fenParts.join(' ');
                
                let ev = await getPositionEval(safeFen);
                evals.push(ev);
                
                if (i < history.length) {
                    tempChess.move(history[i]);
                }

                // Přidání drobného zpoždění pro rate limit
                if (ev && ev.source === 'chess-api') {
                    await new Promise(r => setTimeout(r, 400));
                } else {
                    await new Promise(r => setTimeout(r, 40)); 
                }
            }

            // Vyhledání propadů v Evaluations (Win Probabilities)
            for (let i = 0; i < history.length; i++) {
                const move = history[i];
                const isWhiteToMove = (i % 2 === 0);
                const activePlayer = isWhiteToMove ? gameData.whitePlayer : gameData.blackPlayer;
                const isTargetPlayerMove = activePlayer.toLowerCase().includes(playerName.toLowerCase());
                
                const currentEval = evals[i];
                const nextEval = evals[i+1];
                
                if (!currentEval || !nextEval) continue;

                const probWBefore = getWinProbability(currentEval);
                const probWAfter = getWinProbability(nextEval);
                
                const probBefore = isWhiteToMove ? probWBefore : (100 - probWBefore);
                const probAfter = isWhiteToMove ? probWAfter : (100 - probWAfter);
                
                const probDrop = probBefore - probAfter;
                const MISS_THRESHOLD = 12; // Z generátoru
                const BLUNDER_THRESHOLD = 12;

                // 1. BLUNDER
                if (isTargetPlayerMove && probDrop >= BLUNDER_THRESHOLD) {
                    // PUSH do hlavního pole!
                    if (currentEval.bestMove && currentEval.bestMove !== move.lan) {
                         puzzleData.push({
                            type: "blunder",
                            gameId: gameData.id,
                            white: gameData.whitePlayer,
                            black: gameData.blackPlayer,
                            result: gameData.result,
                            fenBefore: tempChess.fen(), // We need fen from history
                            blunderMoveSAN: move.san,
                            blunderMoveLAN: move.lan,
                            bestMoveLAN: currentEval.bestMove,
                            evalBefore: currentEval.cp !== undefined ? currentEval.cp / 100.0 : null,
                            evalAfter: nextEval.cp !== undefined ? nextEval.cp / 100.0 : null,
                            winProbDrop: probDrop.toFixed(1),
                            playerColor: isWhiteToMove ? 'white' : 'black',
                            ply: i + 1,
                            hint: "Hrubá chyba! Pokus se najít tah, který zachrání partii."
                        });
                        
                        // Fix history fen, we didn't save history fen!
                        let t = new Chess();
                        for(let h=0; h<i; h++) t.move(history[h]);
                        puzzleData[puzzleData.length-1].fenBefore = t.fen();
                    }
                }
                
                // 2. MISS (Soupeř předtím chyboval, my jsme to nenašli a výhoda spadla dolu)
                if (isTargetPlayerMove && i >= 1) {
                    const prevEval = evals[i-1];
                    if (!prevEval) continue;
                    
                    const probW_Prev = getWinProbability(prevEval);
                    const probTarget_Prev = isWhiteToMove ? probW_Prev : (100 - probW_Prev);
                    
                    if (probBefore - probTarget_Prev >= MISS_THRESHOLD) {
                        if (probBefore - probAfter >= MISS_THRESHOLD) {
                            puzzleData.push({
                                type: "miss",
                                gameId: gameData.id,
                                white: gameData.whitePlayer,
                                black: gameData.blackPlayer,
                                result: gameData.result,
                                fenBefore: "", // Bude fixnuto níže
                                blunderMoveSAN: move.san,
                                blunderMoveLAN: move.lan,
                                bestMoveLAN: currentEval.bestMove,
                                evalBefore: currentEval.cp !== undefined ? currentEval.cp / 100.0 : null,
                                evalAfter: nextEval.cp !== undefined ? nextEval.cp / 100.0 : null,
                                winProbDrop: probDrop.toFixed(1),
                                playerColor: isWhiteToMove ? 'white' : 'black',
                                ply: i + 1,
                                hint: "Promarněná šance! Soupeř udělal hrubku, ale tvůj tah ho nepotrestal."
                            });
                            
                            let t = new Chess();
                            for(let h=0; h<i; h++) t.move(history[h]);
                            puzzleData[puzzleData.length-1].fenBefore = t.fen();
                        }
                    }
                }
            }
        } // Konec loopu partií

        // Vše hotovo
        progBar.style.width = '100%';
        statusMsg.style.display = 'none';
        
        if (puzzleData.length === 0) {
            statusMsg.style.display = 'block';
            statusText.innerHTML = `V posledních 5 partiích (od ${escapeHtml(playerName)}) se nenašly žádné hrubé chyby (>12% evalu). Skvělá práce!`;
            progContainer.style.display = 'none';
            return;
        }

        renderGrid();

    } catch (err) {
        console.error("Critical error in blunder check:", err);
        statusMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Skenování spadlo. Podívej se do konzole.`;
    }
}

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
    
    // Tady jsme dřív vraceli jen text.
    // Přidáme vizuální highlight políčka, odkud se má táhnout:
    const fromSquare = data.bestMoveLAN.substring(0,2);
    
    // Zvýrazníme žlutě přes jQuery (chessboard.js framework to umožňuje takto)
    const boardId = `board-${index}`;
    $(`#${boardId} .square-${fromSquare}`).css('box-shadow', 'inset 0 0 10px 3px rgba(255, 255, 0, 0.7)');
    
    let pieceName = "figurku"; // Lze vylepšit detekcí, např. podle FENu
    
    evalEl.innerHTML = `<strong>Nápověda:</strong> Zkus pohnout figurkou na poli <strong style="color:var(--primary-color)">${fromSquare.toUpperCase()}</strong>.`;
    
    // Malý vizuální efekt na kartu
    const card = document.querySelector(`.blunder-card[data-index="${index}"]`);
    if(card) {
        card.style.borderColor = 'rgba(255, 255, 0, 0.5)';
        setTimeout(() => card.style.borderColor = 'rgba(255, 255, 255, 0.05)', 1500);
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
