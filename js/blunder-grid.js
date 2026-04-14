let puzzleData = [];
let filteredData = [];
let boards = {};
let games = {};

let currentMode = 'training';
let currentThreshold = 12;

let currentPlayer = null;
let debounceTimer = null;
let scanAbortController = null;
let selectedGameIds = new Set();
let playerGames = [];
let currentTab = 'grid';
window.filterGameId = null;

// === CACHE ===
const CACHE_KEY_PREFIX = 'blundergrid_';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 dní

function getCachedResults(playerName) {
    try {
        const key = CACHE_KEY_PREFIX + playerName.toLowerCase().replace(/\s/g, '_');
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (Date.now() - cached.timestamp > CACHE_EXPIRY_MS) {
            localStorage.removeItem(key);
            return null;
        }
        return cached.data;
    } catch (e) { return null; }
}

function saveCachedResults(playerName, data) {
    try {
        const key = CACHE_KEY_PREFIX + playerName.toLowerCase().replace(/\s/g, '_');
        localStorage.setItem(key, JSON.stringify({
            timestamp: Date.now(),
            data: data
        }));
    } catch (e) { console.warn('Cache save failed:', e); }
}

// === HELPER: Konstruuj LAN z chess.js move objektu (kompatibilita 0.10.3) ===
function getMoveLAN(moveObj) {
    if (moveObj.lan) return moveObj.lan; // chess.js 1.x
    return moveObj.from + moveObj.to + (moveObj.promotion || '');
}

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

window.setMode = function(mode) {
    if (currentMode === mode) return;
    currentMode = mode;
    
    document.getElementById('mode-btn-training').style.background = mode === 'training' ? 'rgba(212,175,55,0.2)' : 'transparent';
    document.getElementById('mode-btn-training').style.color = mode === 'training' ? '#d4af37' : '#94a3b8';
    
    document.getElementById('mode-btn-gallery').style.background = mode === 'gallery' ? 'rgba(212,175,55,0.2)' : 'transparent';
    document.getElementById('mode-btn-gallery').style.color = mode === 'gallery' ? '#d4af37' : '#94a3b8';
    
    renderGrid();
};

document.addEventListener('DOMContentLoaded', async () => {
    const thresholdInput = document.getElementById('threshold-input');
    const thresholdVal = document.getElementById('threshold-val');
    const filterBtn = document.getElementById('filter-btn');
    const searchInput = document.getElementById('playerSearch');

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

    // Klik na lupu spustí vyhledávání
    const searchIcon = document.querySelector('.search-icon');
    if (searchIcon) {
        searchIcon.style.cursor = 'pointer';
        searchIcon.addEventListener('click', () => {
            const val = searchInput.value.trim();
            if (val.length >= 2) {
                selectPlayer(val);
            } else {
                handleSearch(val);
            }
        });
    }

    // Enter spustí vyhledávání
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const val = searchInput.value.trim();
            if (val.length >= 2) {
                selectPlayer(val);
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            document.getElementById('autocompleteResults').style.display = 'none';
        }
    });

    // -------- Načtení hráče z URL na startu --------
    const urlParams = new URLSearchParams(window.location.search);
    const urlPlayer = urlParams.get('player');
    if (urlPlayer) {
        searchInput.value = urlPlayer;
        selectPlayer(urlPlayer);
    }
});

function getToken() {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

async function handleSearch(query) {
    const resultsDiv = document.getElementById('autocompleteResults');
    if (query.length < 2) { resultsDiv.style.display = 'none'; return; }

    try {
        const response = await fetch(`/api/chess/players?q=${encodeURIComponent(query)}&limit=8`);
        if (!response.ok) throw new Error('Search failed');
        const players = await response.json();

        if (players.length === 0) {
            resultsDiv.innerHTML = '<div class="autocomplete-item"><span style="color: #777;">Žádný hráč</span></div>';
        } else {
            resultsDiv.innerHTML = players.map(p => `
                <div class="autocomplete-item" onclick="selectPlayer('${escapeHtml(p.name).replace(/'/g, "&#39;")}')">
                    <span>${escapeHtml(p.name)}</span>
                    <span style="color: #777;">${p.totalGames}</span>
                </div>
            `).join('');
        }
        resultsDiv.style.display = 'block';
    } catch (e) { console.error('Search error:', e); }
}

async function selectPlayer(name) {
    currentPlayer = name;
    window.filterGameId = null;
    document.getElementById('playerSearch').value = name;
    document.getElementById('autocompleteResults').style.display = 'none';

    // Propsání do URL bez refreshe
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('player', name);
    window.history.pushState({ path: newUrl.href }, '', newUrl.href);


    const statusMsg = document.getElementById('status-message');
    const statusText = document.getElementById('status-text');
    const progContainer = document.getElementById('progress-container');
    const gridEl = document.getElementById('blunder-grid');

    statusMsg.style.display = 'block';
    progContainer.style.display = 'none';
    statusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Načítám data pro <strong>${escapeHtml(name)}</strong>...`;

    // Show tabs
    document.getElementById('blunder-tabs').style.display = '';

    try {
        // 1. Load cached results from DB
        const [blundersRes, statusRes] = await Promise.all([
            fetch(`/api/blunder/${encodeURIComponent(name)}?threshold=${currentThreshold}`),
            fetch(`/api/blunder/${encodeURIComponent(name)}/status`)
        ]);

        const blunders = blundersRes.ok ? await blundersRes.json() : [];
        const status = statusRes.ok ? await statusRes.json() : { totalGames: 0, gamesScanned: 0, canScanMore: true };

        // Update tab badges
        document.getElementById('games-count-badge').textContent = `${status.gamesScanned}/${status.totalGames}`;

        // 2. Normalize DB field names to frontend names
        blunders.forEach(p => {
            if (p.movePlayed) p.blunderMoveSAN = p.movePlayed;
            if (p.movePlayedLAN) p.blunderMoveLAN = p.movePlayedLAN;
            if (p.probDrop) p.winProbDrop = String(p.probDrop);
            
            p.playerColor = (p.white && p.white.toLowerCase().includes(name.toLowerCase())) ? 'white' : 'black';
        });
        puzzleData = blunders;
        filteredData = [];

        // 3. Status bar with scan info
        const pct = status.totalGames > 0 ? Math.round(status.gamesScanned / status.totalGames * 100) : 0;
        
        let limitMsg = '';
        if (window.godMode && !status.canScanMore && status.gamesScanned < status.totalGames) {
            status.canScanMore = true;
            limitMsg = `<span style="margin-left:0.75rem; font-size:0.8rem; color: #d4af37; text-wrap: nowrap;"><i class="fa-solid fa-fire"></i> Limit prolomen</span>`;
        }

        const scanBtn = status.canScanMore
            ? `${limitMsg}<button onclick="triggerBackendScan('${escapeHtml(name).replace(/'/g, "&#39;")}')" class="card-btn" style="display:inline-block; padding: 0.3rem 0.8rem; margin-left:0.75rem; font-size:0.8rem; background: var(--primary-color); color: #000; font-weight: 600;"><i class="fa-solid fa-magnifying-glass-plus"></i> Analyzovat další</button>`
            : `<span style="margin-left:0.75rem; font-size:0.8rem; color: #f59e0b;"><i class="fa-solid fa-clock"></i> Denní limit vyčerpán</span>`;

        if (blunders.length > 0) {
            statusText.innerHTML = `<i class="fa-solid fa-database" style="color: #60a5fa;"></i> <strong>${blunders.length}</strong> situací z DB (${status.gamesScanned}/${status.totalGames} partií, ${pct}%) ${scanBtn}`;
        } else if (status.gamesScanned > 0) {
            statusText.innerHTML = `<i class="fa-solid fa-check" style="color: #4ade80;"></i> Žádné chyby nad ${currentThreshold}% v ${status.gamesScanned} partiích. ${scanBtn}`;
        } else {
            statusText.innerHTML = `<i class="fa-solid fa-info-circle" style="color: #60a5fa;"></i> Zatím neanalyzováno. ${status.totalGames} partií k dispozici. ${scanBtn}`;
        }
        
        const loadMoreEl = document.getElementById('load-more-container');
        if (loadMoreEl) {
            loadMoreEl.style.display = status.canScanMore ? 'block' : 'none';
        }

        renderGrid();

    } catch (e) {
        console.error('selectPlayer error:', e);
        // Fallback: use old localStorage cache
        const cached = getCachedResults(name);
        if (cached && cached.length > 0) {
            puzzleData = cached;
            filteredData = [];
            statusText.innerHTML = `<i class="fa-solid fa-bolt" style="color: gold;"></i> Načteno z lokální cache (${cached.length} situací). <button onclick="triggerBackendScan('${escapeHtml(name).replace(/'/g, "&#39;")}')" class="card-btn" style="display:inline-block; padding: 0.2rem 0.6rem; margin-left:0.5rem; font-size:0.8rem;"><i class="fa-solid fa-rotate"></i> Skenovat</button>`;
            renderGrid();
        } else {
            statusText.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #f87171;"></i> Skenování zhavarovalo.`;
        }
    }
}
window.triggerBackendScan = triggerBackendScan;

window.scanAllGodMode = async function() {
    if (!currentPlayer) return alert('Nejdřív vyhledej hráče, jehož partie chceš komplet přegenerovat!');
    const rescanAll = document.getElementById('godmode-rescan-all').checked;
    
    document.getElementById('godmode-modal').style.display = 'none';
    
    if (rescanAll) {
        const statusText = document.getElementById('status-text');
        statusText.innerHTML = `<i class="fa-solid fa-trash-can" style="color: #f87171;"></i> Mažu staré analytické záznamy pro hráče ${escapeHtml(currentPlayer)}...`;
        await fetch(`/api/blunder/${encodeURIComponent(currentPlayer)}/analysis`, { method: 'DELETE' });
    }
    
    triggerBackendScan(currentPlayer, null, true);
};

// Trigger backend scan (max 10 games/day or infinite if in godmode 'scan all')
async function triggerBackendScan(name, gameIds = null, infiniteLoop = false) {
    const statusText = document.getElementById('status-text');
    const progContainer = document.getElementById('progress-container');
    const progBar = document.getElementById('progress-bar');

    progContainer.style.display = 'block';
    progBar.style.width = '0%';
    
    const loadMoreEl = document.getElementById('load-more-container');
    if (loadMoreEl) loadMoreEl.style.display = 'none';

    let totalScanned = 0;
    let totalBlunders = 0;
    let done = false;
    let batchNum = 0;

    // Loop: server scans 2 games at a time, we call repeatedly until done or limit
    while (!done && (infiniteLoop || batchNum < 5)) {
        batchNum++;
        statusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzuji partii ${batchNum}... (${totalScanned} hotovo, ${totalBlunders} situací)`;
        if (!infiniteLoop) {
            progBar.style.width = `${Math.min(batchNum * 10, 90)}%`;
        }

        try {
            const bodyObj = gameIds ? { gameIds } : {};
            if (window.godMode) bodyObj.override = true;
            const body = JSON.stringify(bodyObj);

            const res = await fetch(`/api/blunder/${encodeURIComponent(name)}/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });

            if (!res.ok) {
                if (res.status === 429) {
                    const err = await res.json();
                    statusText.innerHTML = `<i class="fa-solid fa-clock" style="color: #f59e0b;"></i> ${err.message} (analyzováno ${totalScanned} partií, ${totalBlunders} situací)`;
                    break;
                }
                throw new Error(`HTTP ${res.status}`);
            }

            const result = await res.json();
            totalScanned += result.scanned || 0;
            totalBlunders += result.newBlunders || 0;
            done = result.done || result.scanned === 0;

            if (result.error === 'daily_limit') {
                statusText.innerHTML = `<i class="fa-solid fa-clock" style="color: #f59e0b;"></i> ${result.message} (analyzováno ${totalScanned} partií)`;
                break;
            }
        } catch (e) {
            console.error('Backend scan error:', e);
            if (infiniteLoop) {
                // God mode: wait and retry (server may have completed but Cloudflare timed out)
                statusText.innerHTML = `<i class="fa-solid fa-rotate" style="color: #f59e0b;"></i> Timeout — čekám 3s a pokračuji...`;
                await new Promise(r => setTimeout(r, 3000));
                continue; // retry
            }
            statusText.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #f87171;"></i> Timeout/chyba serveru. Analyzováno ${totalScanned} partií, ${totalBlunders} situací. Zkuste znovu.`;
            break;
        }
    }

    progBar.style.width = '100%';

    if (done || totalScanned > 0) {
        if (done) {
            statusText.innerHTML = `<i class="fa-solid fa-check" style="color: #4ade80;"></i> Hotovo! Analyzováno ${totalScanned} partií, nalezeno ${totalBlunders} situací.`;
        }
        
        // Reload player to fetch new puzzles and refresh limits
        setTimeout(() => {
            selectPlayer(name);
        }, 800);
        
    }

    setTimeout(() => { progContainer.style.display = 'none'; }, 3000);
}
window.triggerBackendScan = triggerBackendScan;

window.forceRescan = function(name) {
    triggerBackendScan(name);
}

// Quick eval (depth 8) for suspicious positions, deep eval (depth 14) for confirmed drops
async function getPositionEvalQuick(fen) {
    return getPositionEval(fen, 8);
}

async function getPositionEvalDeep(fen) {
    return getPositionEval(fen, 14);
}

// Pomocná API Request funkce pro Eval (Lichess Cloud -> Chess-API)
async function getPositionEval(fen, depth = 14) {
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
            body: JSON.stringify({ fen: fen, depth: depth }),
            timeout: 8000
        });
        
        if (chessApiRes.ok) {
            const data = await chessApiRes.json();
            
            // chess-api.com vrací: eval v pěšcích (float), centipawns jako string, move jako UCI
            if (data && !data.error) {
                let cpVal;
                if (data.centipawns !== undefined) {
                    cpVal = parseInt(data.centipawns); // Přímo centipawny
                } else if (data.eval !== undefined) {
                    cpVal = Math.round(data.eval * 100); // Převod z pěšců
                } else {
                    return null;
                }
                
                return {
                    cp: cpVal,
                    mate: data.mate || null,
                    bestMove: data.move, // UCI formát
                    source: 'chess-api'
                };
            }
        }
    } catch (e) { console.warn("Chess-API error:", e); }
    
    return null;
}

async function startBlunderScan(playerName) {
    // Cancel any ongoing scan
    if (scanAbortController) {
        scanAbortController.abort();
    }
    scanAbortController = new AbortController();
    const abortSignal = scanAbortController.signal;

    const statusMsg = document.getElementById('status-message');
    const statusText = document.getElementById('status-text');
    const progContainer = document.getElementById('progress-container');
    const progBar = document.getElementById('progress-bar');
    const gridEl = document.getElementById('blunder-grid');

    // Cleanup old boards/games
    Object.values(boards).forEach(b => { try { b.destroy(); } catch(e) {} });
    boards = {};
    games = {};

    // Reset UI
    gridEl.innerHTML = '';
    puzzleData = [];
    filteredData = [];
    statusMsg.style.display = 'block';
    progContainer.style.display = 'block';
    progBar.style.width = '0%';
    
    statusText.innerHTML = `Stahuji posledních 5 partií hráče <strong style="color:var(--primary-color)">${escapeHtml(playerName)}</strong>...`;

    try {
        const API_URL = '/api/chess'; 
        const params = new URLSearchParams({
            player: playerName,
            color: 'both',
            sort: 'date_desc',
            limit: 5,
            offset: 0
        });

        const resp = await fetch(`${API_URL}/games?${params}`);
        
        if (!resp.ok) throw new Error("Chyba při stahování partií");
        
        const data = await resp.json();
        const gamesListRaw = data.games || [];
        
        if (gamesListRaw.length === 0) {
            statusText.innerHTML = `Nebyly nalezeny žádné partie hráče ${escapeHtml(playerName)}.`;
            progContainer.style.display = 'none';
            return;
        }

        // Stáhnout detaily partií (s tahy) pro každou hru
        statusText.innerHTML = `Načítám tahy pro ${gamesListRaw.length} partií...`;
        const gamesList = [];
        for (const g of gamesListRaw) {
            try {
                const detailResp = await fetch(`${API_URL}/games/${g.id}`);
                if (detailResp.ok) {
                    gamesList.push(await detailResp.json());
                }
            } catch (e) { console.warn('Failed to load game', g.id, e); }
        }

        if (gamesList.length === 0) {
            statusText.innerHTML = `Nepodařilo se načíst tahy partií.`;
            progContainer.style.display = 'none';
            return;
        }

        // ====== Dvoustupňové Skenovací Jádro ======
        // Fáze 1: Heuristický filtr → quick eval (depth 8)
        // Fáze 2: CP skok > 30cp → deep eval (depth 14)
        let totalEvalsFetched = 0;
        let totalEvalsNull = 0;
        let totalSkipped = 0;

        for (let gIndex = 0; gIndex < gamesList.length; gIndex++) {
            if (abortSignal.aborted) return;

            const gameData = gamesList[gIndex];

            statusText.innerHTML = `Analyzuji partii <strong>${gIndex + 1}/${gamesList.length}</strong>: ${escapeHtml(gameData.whitePlayer)} - ${escapeHtml(gameData.blackPlayer)}...`;
            progBar.style.width = `${((gIndex) / gamesList.length) * 100}%`;

            if (!gameData.moves) { console.warn('No moves for game', gameData.id); continue; }

            const chess = new Chess();
            const movesArr = gameData.moves.split(' ').filter(m => m);
            for (let m of movesArr) {
                try { chess.move(m); } catch (e) { break; }
            }

            const history = chess.history({ verbose: true });
            const tempChess = new Chess();

            // Fáze 1 a 2: Quick eval (depth 8) pro VŠECHNY pozice
            let evals = new Array(history.length + 1).fill(null);
            let quickEvalCount = 0;

            for (let i = 0; i <= history.length; i++) {
                if (abortSignal.aborted) return;

                // Progress
                if (quickEvalCount % 3 === 0) {
                    const partialPct = ((gIndex) / gamesList.length) * 100 + ((i / history.length) * (100 / gamesList.length));
                    progBar.style.width = `${Math.min(partialPct, 99)}%`;
                    await new Promise(r => setTimeout(r, 0));
                }

                const fen = tempChess.fen();
                const fenParts = fen.split(' ');
                if (fenParts.length >= 4 && fenParts[3] !== '-') fenParts[3] = '-';
                const safeFen = fenParts.join(' ');

                let ev = await getPositionEvalQuick(safeFen);
                evals[i] = ev;
                totalEvalsFetched++;
                quickEvalCount++;
                if (!ev) totalEvalsNull++;

                if (i < history.length) tempChess.move(history[i]);

                // Rate limit
                if (ev?.source === 'chess-api') await new Promise(r => setTimeout(r, 350));
                else if (ev?.source === 'lichess') await new Promise(r => setTimeout(r, 30));
                else await new Promise(r => setTimeout(r, 100));
            }

            // Fáze 3: Deep eval na pozice s CP skokem > 30cp
            const deepIndices = new Set();
            for (let i = 0; i < history.length; i++) {
                const curr = evals[i];
                const next = evals[i + 1];
                if (curr && next) {
                    const cpDiff = Math.abs((next.cp || 0) - (curr.cp || 0));
                    if (cpDiff > 30) { // 0.3 pěšce skok → deep eval
                        deepIndices.add(i);
                        deepIndices.add(i + 1);
                    }
                }
            }

            if (deepIndices.size > 0) {
                statusText.innerHTML = `Partie ${gIndex + 1}: Hloubková analýza ${deepIndices.size} kritických pozic...`;
                await new Promise(r => setTimeout(r, 0));

                const tempChess2 = new Chess();
                for (let i = 0; i <= history.length; i++) {
                    if (abortSignal.aborted) return;
                    if (deepIndices.has(i)) {
                        const fen = tempChess2.fen();
                        const fenParts = fen.split(' ');
                        if (fenParts.length >= 4 && fenParts[3] !== '-') fenParts[3] = '-';
                        const ev = await getPositionEvalDeep(fenParts.join(' '));
                        if (ev) { evals[i] = ev; totalEvalsFetched++; }
                        if (ev?.source === 'chess-api') await new Promise(r => setTimeout(r, 350));
                        else await new Promise(r => setTimeout(r, 50));
                    }
                    if (i < history.length) tempChess2.move(history[i]);
                }
            }

            console.log(`Game ${gIndex+1}: ${history.length} moves, ${quickEvalCount} quick evals, ${deepIndices.size} deep evals, ${totalSkipped} skipped`);

            // Vyhledání propadů v Evaluations (Win Probabilities)
            const BLUNDER_THRESHOLD = 12;
            const MISS_THRESHOLD = 12;

            for (let i = 0; i < history.length; i++) {
                const move = history[i];
                const moveLAN = getMoveLAN(move); // OPRAVENO: kompatibilita chess.js 0.10.3
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

                // Fen PŘED tahem
                let fenBefore;
                {
                    let t = new Chess();
                    for(let h=0; h<i; h++) t.move(history[h]);
                    fenBefore = t.fen();
                }

                // 1. BLUNDER — hráč zahrál tah, který mu zhoršil pozici
                if (isTargetPlayerMove && probDrop >= BLUNDER_THRESHOLD) {
                    // Zkontroluj, že bestMove existuje a je JINÝ než hraný tah
                    if (currentEval.bestMove && currentEval.bestMove !== moveLAN) {
                         puzzleData.push({
                            type: "blunder",
                            gameId: gameData.id,
                            white: gameData.whitePlayer,
                            black: gameData.blackPlayer,
                            result: gameData.result,
                            fenBefore: fenBefore,
                            blunderMoveSAN: move.san,
                            blunderMoveLAN: moveLAN,
                            bestMoveLAN: currentEval.bestMove,
                            evalBefore: currentEval.cp !== undefined ? currentEval.cp / 100.0 : null,
                            evalAfter: nextEval.cp !== undefined ? nextEval.cp / 100.0 : null,
                            winProbDrop: probDrop.toFixed(1),
                            playerColor: isWhiteToMove ? 'white' : 'black',
                            ply: i + 1,
                            moveNumber: Math.ceil((i+1)/2),
                            hint: "Hrubá chyba! Pokus se najít tah, který zachrání partii."
                        });
                        console.log(`🚨 Blunder: ${move.san} (tah ${Math.ceil((i+1)/2)}), propad ${probDrop.toFixed(1)}%, best: ${currentEval.bestMove}, played: ${moveLAN}`);
                    }
                    continue; // Nezkoumej miss pro stejný tah
                }
                
                // 2. MISS (Soupeř předtím chyboval, my jsme to nenašli)
                if (isTargetPlayerMove && i >= 1) {
                    const prevEval = evals[i-1];
                    if (!prevEval) continue;
                    
                    const probW_Prev = getWinProbability(prevEval);
                    const probTarget_Prev = isWhiteToMove ? probW_Prev : (100 - probW_Prev);
                    
                    // Soupeř chyboval? (naše šance vyrostla o >= threshold)
                    if (probBefore - probTarget_Prev >= MISS_THRESHOLD) {
                        // My jsme to nevyužili? (naše šance zase spadla)
                        if (probDrop >= MISS_THRESHOLD) {
                            if (currentEval.bestMove && currentEval.bestMove !== moveLAN) {
                                puzzleData.push({
                                    type: "miss",
                                    gameId: gameData.id,
                                    white: gameData.whitePlayer,
                                    black: gameData.blackPlayer,
                                    result: gameData.result,
                                    fenBefore: fenBefore,
                                    blunderMoveSAN: move.san,
                                    blunderMoveLAN: moveLAN,
                                    bestMoveLAN: currentEval.bestMove,
                                    evalBefore: currentEval.cp !== undefined ? currentEval.cp / 100.0 : null,
                                    evalAfter: nextEval.cp !== undefined ? nextEval.cp / 100.0 : null,
                                    winProbDrop: probDrop.toFixed(1),
                                    playerColor: isWhiteToMove ? 'white' : 'black',
                                    ply: i + 1,
                                    moveNumber: Math.ceil((i+1)/2),
                                    hint: "Promarněná šance! Soupeř udělal hrubku, ale tvůj tah ho nepotrestal."
                                });
                                console.log(`❌ Miss: ${move.san} (tah ${Math.ceil((i+1)/2)}), propad ${probDrop.toFixed(1)}%`);
                            }
                        }
                    }
                }
            }
        } // Konec loopu partií

        console.log(`Scan complete: ${totalEvalsFetched} evals fetched, ${totalEvalsNull} null, ${puzzleData.length} puzzles found`);

        // Uložit do cache
        if (puzzleData.length > 0) {
            saveCachedResults(playerName, puzzleData);
        }

        // Vše hotovo
        progBar.style.width = '100%';
        
        if (puzzleData.length === 0) {
            statusMsg.style.display = 'block';
            statusText.innerHTML = `V posledních 5 partiích (od ${escapeHtml(playerName)}) se nenašly žádné hrubé chyby (>12% evalu). Skvělá práce! <br><small style="color:#777;">(${totalEvalsFetched} pozic analyzováno, ${totalEvalsNull} bez evaluace)</small>`;
            progContainer.style.display = 'none';
            return;
        }

        statusMsg.style.display = 'block';
        statusText.innerHTML = `<i class="fa-solid fa-check-circle" style="color: #81c784;"></i> Nalezeno <strong>${puzzleData.length}</strong> situací. Výsledky uloženy do cache.`;
        progContainer.style.display = 'none';

        renderGrid();

    } catch (err) {
        console.error("Critical error in blunder check:", err);
        statusText.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color:#e57373;"></i> Skenování spadlo: ${err.message}. Podívej se do konzole.`;
    }
}

function renderGrid() {
    const gridEl = document.getElementById('blunder-grid');
    gridEl.innerHTML = '';
    
    // Normalize field names (DB uses movePlayed/probDrop, legacy uses blunderMoveSAN/winProbDrop)
    puzzleData.forEach(p => {
        if (!p.blunderMoveSAN && p.movePlayed) p.blunderMoveSAN = p.movePlayed;
        if (!p.blunderMoveLAN && p.movePlayedLAN) p.blunderMoveLAN = p.movePlayedLAN;
        if (!p.winProbDrop && p.probDrop) p.winProbDrop = String(p.probDrop);
        if (!p.bestMoveLAN && p.bestMoveLAN === undefined && p.bestMoveLAN !== null) p.bestMoveLAN = p.best_move_lan;
    });

    // Filtrace
    filteredData = puzzleData.filter(p => {
        if (window.filterGameId && p.gameId !== window.filterGameId) return false;
        const drop = parseFloat(p.winProbDrop || p.probDrop || 0);
        return drop >= currentThreshold;
    });

    if (window.filterGameId) {
        gridEl.innerHTML += `<div style="grid-column: 1/-1; text-align: center; margin-bottom: 1rem;">
            <div style="background: rgba(212,175,55,0.15); border: 1px solid rgba(212,175,55,0.3); border-radius: 6px; padding: 0.8rem; color: #d4af37; font-weight: 600; display: inline-flex; align-items: center; gap: 1rem;">
                <i class="fa-solid fa-filter"></i> Zobrazeny pouze chyby z jedné vybrané partie 
                <button onclick="clearGameFilter()" style="background: rgba(212,175,55,0.2); border: none; padding: 0.3rem 0.8rem; border-radius: 4px; color: #fff; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(212,175,55,0.4)'" onmouseout="this.style.background='rgba(212,175,55,0.2)'">Zrušit filtr (<i class="fa-solid fa-xmark"></i>)</button>
            </div>
        </div>`;
    }

    if (filteredData.length === 0) {
        gridEl.innerHTML += '<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color: #888;">Žádné chyby pro tento filtr. Zkus jej snížit nebo zmáčkni tlačítko Zrušit filtr (pokud si ho zapnul).</div>';
        return;
    }
    
    filteredData.forEach((puzzle, filtIndex) => {
        const id = `board-${filtIndex}`;
        const realIndex = puzzleData.indexOf(puzzle);
        
        const isMiss = puzzle.type === 'miss';
        const tagClass = isMiss ? 'blunder-tag miss' : 'blunder-tag';
        const tagText = isMiss ? `Promarněná šance` : `Blunder`;
        const probDropVal = puzzle.winProbDrop || puzzle.probDrop || '';
        const dropText = probDropVal ? `(-${probDropVal}%)` : (puzzle.evalAfter ? `(${puzzle.evalAfter})` : '');
        const moveInfo = puzzle.moveNumber ? `tah ${puzzle.moveNumber}` : '';

        let cardHtml = '';

        const starIcon = puzzle.isFeatured
            ? `<i class="fa-solid fa-star" style="color:#fbbf24;"></i>`
            : `<i class="fa-regular fa-star" style="color:#555;"></i>`;
        const starBtn = puzzle.id
            ? `<button data-featured-id="${puzzle.id}" onclick="event.stopPropagation();toggleFeatured(${puzzle.id})" style="background:none;border:none;cursor:pointer;font-size:1rem;padding:0.2rem;transition:transform 0.15s;" onmouseenter="this.style.transform='scale(1.2)'" onmouseleave="this.style.transform='scale(1)'" title="Oblíbené">${starIcon}</button>`
            : '';

        const wName = formatShortName(puzzle.white);
        const bName = formatShortName(puzzle.black);

        const opponentName = puzzle.playerColor === 'white' ? bName : wName;
        const matchResult = puzzle.result && puzzle.result !== '*' ? `<span title="Výsledek partie" style="margin-left: 0.4rem; font-size: 0.7rem; color: #94a3b8; font-weight: 600;">${puzzle.result}</span>` : '';
        let playerLabel = '';
        if (puzzle.playerColor === 'white') {
            playerLabel = `<span title="Hraješ bílými (${escapeHtml(puzzle.white)})"><i class="fa-solid fa-chess-knight" style="font-size:0.9rem; vertical-align:-0.1rem; margin-right:0.3rem; color:#f8fafc;"></i></span><span style="opacity:0.5;font-size:0.65rem;margin-right:0.2rem;font-weight:400;">vs</span> ${escapeHtml(opponentName)}${matchResult}`;
        } else {
            playerLabel = `${escapeHtml(opponentName)} <span style="opacity:0.5;font-size:0.65rem;margin-left:0.2rem;margin-right:0.3rem;font-weight:400;">vs</span><span title="Hraješ černými (${escapeHtml(puzzle.black)})"><i class="fa-solid fa-chess-knight" style="font-size:0.9rem; vertical-align:-0.1rem; color:#0f172a; -webkit-text-stroke: 1px rgba(255,255,255,0.6);"></i></span>${matchResult}`;
        }

        if (currentMode === 'training') {
            cardHtml = `
                <div class="blunder-card" data-index="${realIndex}">
                    <div class="blunder-card-header">
                        <div class="${tagClass}">${isMiss ? 'Miss' : 'Blunder'}</div>
                        <div class="blunder-players">${playerLabel}</div>
                        ${starBtn}
                    </div>
                    <div class="board-container" id="${id}"></div>
                    <div class="card-controls">
                        <div class="eval-btn-wrapper">
                            <button class="card-btn eval-btn" onclick="showHint(${realIndex})">
                                <i class="fa-solid fa-lightbulb"></i> Nápověda
                            </button>
                        </div>
                        <button class="card-btn show-game" onclick="showGameMove(${realIndex})">
                            <i class="fa-solid fa-xmark"></i> Hráno
                        </button>
                        <button class="card-btn show-best" onclick="showBestMove(${realIndex})">
                            <i class="fa-solid fa-check"></i> Řešení
                        </button>
                    </div>
                    <div class="card-footer" title="Ztráta pravděpodobnosti výhry">
                        <span class="card-footer-eval" id="eval-${realIndex}">${puzzle.evalBefore > 0 ? '+' : ''}${puzzle.evalBefore} ${dropText}</span>
                        <span>${moveInfo}</span>
                    </div>
                </div>
            `;
        } else {
            // Galerie — zobrazí chybný tah + ?? badge
            cardHtml = `
                <div class="blunder-card" data-index="${realIndex}">
                    <div class="blunder-card-header">
                        <div class="${tagClass}">${isMiss ? 'Miss' : 'Blunder'}</div>
                        <div class="blunder-players">${playerLabel}</div>
                        ${starBtn}
                    </div>
                    <div class="board-container" id="${id}"></div>
                    <div class="card-controls">
                        <div class="eval-btn-wrapper" style="text-align: center; font-size: 0.75rem; color: #cbd5e1; padding: 0.2rem 0;">
                            Tah: <strong style="color: #e57373;">${puzzle.blunderMoveSAN} ${isMiss ? '?!' : '??'}</strong>
                        </div>
                        <button class="card-btn show-best eval-btn-wrapper" onclick="toggleComparison(${realIndex}, this)">
                            <i class="fa-solid fa-exchange"></i> Ukázat, jak to mělo být
                        </button>
                    </div>
                    <div class="card-footer" title="Ztráta pravděpodobnosti výhry">
                        <span class="card-footer-eval" id="eval-${realIndex}" style="color: #e57373;">${dropText}</span>
                        <span>${moveInfo}</span>
                    </div>
                </div>
            `;
        }
        
        gridEl.insertAdjacentHTML('beforeend', cardHtml);
        
        const tId = setTimeout(() => {
            initBoard(realIndex, id, puzzle);
        }, 50 * filtIndex);
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
        // Galerie — aplikuj chybný tah a ukaž badge
        game.move(data.blunderMoveSAN);
        const config = {
            draggable: false,
            position: game.fen(),
            orientation: data.playerColor,
            pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
        };
        boards[realIndex] = Chessboard(elementId, config);

        // Arrow + badge on target square
        setTimeout(() => {
            if (!data.blunderMoveLAN || data.blunderMoveLAN.length < 4) return;
            const fromSq = data.blunderMoveLAN.substring(0, 2);
            const toSq = data.blunderMoveLAN.substring(2, 4);

            drawMoveArrow(elementId, fromSq, toSq, data.type === 'miss' ? '#f59e0b' : '#ef4444');

            // ?? badge on target
            const targetEl = document.querySelector(`#${elementId} .square-${toSq}`);
            if (targetEl) {
                targetEl.style.boxShadow = "inset 0 0 0 4px rgba(244, 67, 54, 0.8)";
                targetEl.style.position = "relative";
                if (!targetEl.querySelector('.badge-overlay')) {
                    const badge = document.createElement('div');
                    badge.className = 'badge-overlay';
                    badge.innerText = data.type === 'miss' ? '?!' : '??';
                    targetEl.appendChild(badge);
                }
            }

            // Highlight source square
            const fromEl = document.querySelector(`#${elementId} .square-${fromSq}`);
            if (fromEl) {
                fromEl.style.boxShadow = "inset 0 0 0 3px rgba(244, 67, 54, 0.4)";
            }
        }, 300);
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
    
    const bestFrom = data.bestMoveLAN.substring(0,2);
    const bestTo = data.bestMoveLAN.substring(2,4);
    const isCorrect = (move.from === bestFrom && move.to === bestTo);
    
    if (isCorrect) {
        showStatusEffect(index, 'success');
        document.getElementById(`eval-${index}`).textContent = `Správně! ✓`;
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
    
    const fromSquare = data.bestMoveLAN.substring(0,2);
    
    // Zvýrazníme žlutě přes jQuery
    const boardEl = document.querySelector(`.blunder-card[data-index="${index}"] .board-container`);
    if (boardEl) {
        const sq = boardEl.querySelector(`.square-${fromSquare}`);
        if (sq) sq.style.boxShadow = 'inset 0 0 10px 3px rgba(255, 255, 0, 0.7)';
    }
    
    evalEl.innerHTML = `<strong>Nápověda:</strong> Zkus pohnout figurkou na poli <strong style="color:var(--primary-color)">${fromSquare.toUpperCase()}</strong>.`;
    
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
    
    document.getElementById(`eval-${index}`).textContent = `Chyba v partii: ${data.blunderMoveSAN} (${data.evalAfter})`;
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

    // Green borders for best move
    const elementId = `board-${filteredData.indexOf(data) !== -1 ? filteredData.indexOf(data) : index}`;
    setTimeout(() => {
        if (data.bestMoveLAN && data.bestMoveLAN.length >= 4) {
            const boardEl = document.getElementById(elementId);
            if (boardEl) {
                const fromEl = boardEl.querySelector('.square-' + data.bestMoveLAN.substring(0, 2));
                const toEl = boardEl.querySelector('.square-' + data.bestMoveLAN.substring(2, 4));
                if (fromEl) {
                    fromEl.style.boxShadow = "inset 0 0 0 4px rgba(76, 175, 80, 0.8)";
                    fromEl.style.background = "rgba(76, 175, 80, 0.25)";
                }
                if (toEl) {
                    toEl.style.boxShadow = "inset 0 0 0 4px rgba(76, 175, 80, 0.8)";
                    toEl.style.background = "rgba(76, 175, 80, 0.25)";
                }
            }
        }
    }, 100);

    showStatusEffect(index, 'success');
    document.getElementById(`eval-${index}`).textContent = `Motor doporučuje`;
    document.getElementById(`eval-${index}`).style.color = '#81c784';
}

// Přepínání galerie
window.toggleComparison = function(index, btnEl) {
    const data = puzzleData[index];
    const game = games[index];
    const showsBest = btnEl.getAttribute('data-shown-best') === 'true';

    // Výmaz odznaků a šipek
    const boardEl = document.querySelector(`.blunder-card[data-index="${index}"] .board-container`);
    boardEl.querySelectorAll('.badge-overlay').forEach(b => b.remove());
    boardEl.querySelectorAll('.blunder-arrow-svg').forEach(s => s.remove());
    boardEl.querySelectorAll('[class*="square-"]').forEach(s => s.style.boxShadow = 'none');

    game.load(data.fenBefore);

    if (showsBest) {
        // Zpět na blunder
        game.move(data.blunderMoveSAN);
        btnEl.setAttribute('data-shown-best', 'false');
        btnEl.innerHTML = `<i class="fa-solid fa-exchange"></i> Ukázat, jak to mělo být`;
        btnEl.style.color = '';
        btnEl.style.borderColor = '';
        
        // Obnov rámeček + badge
        if (data.blunderMoveLAN && data.blunderMoveLAN.length >= 4) {
            const fromSq = data.blunderMoveLAN.substring(0, 2);
            const targetSquare = data.blunderMoveLAN.substring(2, 4);
            setTimeout(() => {
                const fromEl = boardEl.querySelector('.square-' + fromSq);
                if (fromEl) {
                    fromEl.style.boxShadow = data.type === 'miss' ? "inset 0 0 0 4px rgba(245, 158, 11, 0.4)" : "inset 0 0 0 4px rgba(244, 67, 54, 0.4)";
                }

                const squareEl = boardEl.querySelector('.square-' + targetSquare);
                if (squareEl) {
                    squareEl.style.boxShadow = data.type === 'miss' ? "inset 0 0 0 4px rgba(245, 158, 11, 0.8)" : "inset 0 0 0 4px rgba(244, 67, 54, 0.8)";
                    squareEl.style.background = data.type === 'miss' ? "rgba(245, 158, 11, 0.25)" : "rgba(244, 67, 54, 0.25)";
                    squareEl.style.position = "relative";
                    const badge = document.createElement('div');
                    badge.className = 'badge-overlay';
                    badge.innerText = data.type === 'miss' ? '?!' : '??';
                    if (data.type === 'miss') badge.style.background = '#f59e0b';
                    squareEl.appendChild(badge);
                }
            }, 150);
        }
        
    } else {
        // Ukázat správný tah
        game.move({
            from: data.bestMoveLAN.substring(0,2), 
            to: data.bestMoveLAN.substring(2,4), 
            promotion: data.bestMoveLAN.substring(4,5) || 'q'
        });
        btnEl.setAttribute('data-shown-best', 'true');
        btnEl.innerHTML = `<i class="fa-solid fa-undo"></i> Zpět na původní chybu`;
        btnEl.style.color = '#81c784';
        btnEl.style.borderColor = 'rgba(76, 175, 80, 0.3)';
        
        // Zelené rámečky na správný tah
        if (data.bestMoveLAN && data.bestMoveLAN.length >= 4) {
            const fromSq = data.bestMoveLAN.substring(0, 2);
            const targetSquare = data.bestMoveLAN.substring(2, 4);
            setTimeout(() => {
                const fromEl = boardEl.querySelector('.square-' + fromSq);
                if (fromEl) {
                    fromEl.style.boxShadow = "inset 0 0 0 4px rgba(76, 175, 80, 0.4)";
                }

                const squareEl = boardEl.querySelector('.square-' + targetSquare);
                if (squareEl) {
                    squareEl.style.boxShadow = "inset 0 0 0 4px rgba(76, 175, 80, 0.8)";
                    squareEl.style.background = "rgba(76, 175, 80, 0.25)";
                }
            }, 150);
        }
    }
    
    boards[index].position(game.fen());
}

// drawMoveArrow abandoned in favor of CSS box-shadows

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function formatShortName(fullName) {
    if (!fullName) return '?';
    if (fullName.includes(',')) {
        const parts = fullName.split(',');
        const surname = parts[0].trim();
        const firstname = parts[1].trim();
        return firstname ? firstname.charAt(0).toUpperCase() + '. ' + surname : surname;
    }
    const parts = fullName.split(' ');
    if (parts.length >= 2) {
        const firstname = parts[0];
        const surname = parts.slice(1).join(' ');
        return firstname.charAt(0).toUpperCase() + '. ' + surname;
    }
    return fullName;
}

// === TAB SWITCHING ===
function switchBlunderTab(tab) {
    currentTab = tab;
    document.getElementById('blunder-grid').style.display = tab === 'grid' ? '' : 'none';
    document.getElementById('games-panel').style.display = tab === 'games' ? '' : 'none';
    document.getElementById('featured-panel').style.display = tab === 'featured' ? '' : 'none';

    // Controls bar only visible in grid tab
    const modeToggle = document.querySelector('.dash-controls .mode-toggle');
    const threshSlider = document.querySelector('.dash-controls .threshold-slider');
    if (modeToggle) modeToggle.style.display = tab === 'grid' ? 'flex' : 'none';
    if (threshSlider) threshSlider.style.display = tab === 'grid' ? 'flex' : 'none';

    document.querySelectorAll('.blunder-tab').forEach(b => {
        b.style.background = 'rgba(255,255,255,0.03)';
        b.style.borderColor = 'rgba(255,255,255,0.1)';
        b.style.color = 'rgba(255,255,255,0.6)';
    });
    const active = document.getElementById(`tab-${tab}`);
    if (active) {
        active.style.background = 'rgba(212,175,55,0.2)';
        active.style.borderColor = 'var(--primary-color)';
        active.style.color = 'var(--primary-color)';
    }

    if (tab === 'games') {
        if (currentPlayer) loadGamesList(currentPlayer);
        else document.getElementById('games-list').innerHTML = '<div style="text-align:center;padding:3rem;color:#888;">Začni vyhledáním hráče (v liště nahoře), abychom mohli načíst seznam jeho divokých i klidných partií.</div>';
    }
    if (tab === 'featured' && currentPlayer) loadFeatured(currentPlayer);
}
window.switchBlunderTab = switchBlunderTab;

// === GAMES LIST ===
async function loadGamesList(playerName) {
    const container = document.getElementById('games-list');
    const statusText = document.getElementById('games-status-text');
    container.innerHTML = '<div style="text-align:center;padding:1rem;color:#888;"><i class="fa-solid fa-spinner fa-spin"></i> Načítám partie...</div>';

    try {
        const res = await fetch(`/api/blunder/${encodeURIComponent(playerName)}/games`);
        playerGames = res.ok ? await res.json() : [];

        const scanned = playerGames.filter(g => g.scanned).length;
        statusText.textContent = `${scanned}/${playerGames.length} partií analyzováno`;

        selectedGameIds.clear();
        updateScanSelectedBtn();

        container.innerHTML = playerGames.map(g => {
            const date = g.date ? new Date(g.date).toLocaleDateString('cs-CZ') : '?';
            const statusIcon = g.scanned
                ? (g.blunderCount > 0 ? `<span style="color:#f87171;" title="${g.blunderCount} chyb">🔴 ${g.blunderCount}</span>` : `<span style="color:#4ade80;" title="Čistá">✅</span>`)
                : `<span style="color:#64748b;">⬜</span>`;
            const checkbox = g.scanned ? '' : `<input type="checkbox" class="game-checkbox" data-game-id="${g.id}" style="width:16px;height:16px;accent-color:var(--primary-color);cursor:pointer;" onchange="toggleGameSelect(${g.id}, this.checked)">`;
            
            const viewBtn = g.scanned && g.blunderCount > 0
                ? `<button onclick="viewGameBlunders(${g.id})" style="background:rgba(212,175,55,0.15); border:1px solid rgba(212,175,55,0.4); color:#d4af37; padding:0.35rem 0.6rem; border-radius:4px; font-size:0.75rem; font-weight:600; cursor:pointer;" onmouseenter="this.style.background='rgba(212,175,55,0.3)'" onmouseleave="this.style.background='rgba(212,175,55,0.15)'">Blundery 👉</button>`
                : (g.scanned ? `<span style="font-size:0.75rem; color:#4ade80; padding:0.25rem 0.6rem;">Čistá hra bez blundru</span>` : '');

            return `<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.75rem;background:rgba(255,255,255,0.02);border-radius:6px;border-left:3px solid ${g.scanned ? (g.blunderCount > 0 ? '#f87171' : '#4ade80') : 'transparent'};transition:background 0.15s;" onmouseenter="this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background='rgba(255,255,255,0.02)'">
                ${checkbox}
                <span style="width:28px;text-align:center;">${statusIcon}</span>
                <span style="flex:1;font-size:0.85rem;color:#e2e8f0;">${escapeHtml(g.white)} - ${escapeHtml(g.black)}</span>
                <span style="font-size:0.8rem;color:#888;font-weight:600;">${g.result || '*'}</span>
                <span style="font-size:0.75rem;color:#64748b;min-width:70px;text-align:right;margin-right:1rem;">${date}</span>
                ${viewBtn}
            </div>`;
        }).join('');
    } catch (e) {
        console.error('loadGamesList error:', e);
        container.innerHTML = '<div style="text-align:center;padding:1rem;color:#f87171;">Chyba při načítání partií.</div>';
    }
}

function toggleGameSelect(gameId, checked) {
    if (checked) selectedGameIds.add(gameId);
    else selectedGameIds.delete(gameId);
    updateScanSelectedBtn();
}
window.toggleGameSelect = toggleGameSelect;

function updateScanSelectedBtn() {
    const btn = document.getElementById('scan-selected-btn');
    const countEl = document.getElementById('selected-count');
    if (selectedGameIds.size > 0) {
        btn.style.display = '';
        countEl.textContent = selectedGameIds.size;
    } else {
        btn.style.display = 'none';
    }
}

async function scanSelectedGames() {
    if (!currentPlayer || selectedGameIds.size === 0) return;
    document.getElementById('status-message').style.display = 'block';
    await triggerBackendScan(currentPlayer, Array.from(selectedGameIds));
    selectedGameIds.clear();
    updateScanSelectedBtn();
    loadGamesList(currentPlayer);
}
window.scanSelectedGames = scanSelectedGames;

window.viewGameBlunders = function(gameId) {
    window.filterGameId = gameId;
    switchBlunderTab('grid');
    // Tab switch automatically triggers loadFeatured but doesn't strictly re-render grid
    // So we manually force it
    renderGrid();
};

window.clearGameFilter = function() {
    window.filterGameId = null;
    renderGrid();
};

// === FEATURED ===
async function loadFeatured(playerName) {
    const container = document.getElementById('featured-grid');
    const emptyEl = document.getElementById('featured-empty');

    try {
        const res = await fetch(`/api/blunder/${encodeURIComponent(playerName)}/featured`);
        const featured = res.ok ? await res.json() : [];

        document.getElementById('featured-count-badge').textContent = featured.length || '';

        if (featured.length === 0) {
            emptyEl.style.display = '';
            container.innerHTML = '';
            return;
        }

        emptyEl.style.display = 'none';
        // Render featured using same puzzleData flow
        container.innerHTML = '';
        // Simple render: reuse card HTML
        featured.forEach((data, index) => {
            const card = document.createElement('div');
            card.className = 'grid-card';
            card.innerHTML = `
                <div style="text-align:center;padding:0.5rem;font-size:0.8rem;color:#fbbf24;">
                    <i class="fa-solid fa-star"></i> ${escapeHtml(formatShortName(data.white))} - ${escapeHtml(formatShortName(data.black))}
                </div>
                <div id="featured-board-${index}" style="width:100%;"></div>
                <div style="text-align:center;padding:0.4rem;font-size:0.75rem;color:#f87171;">
                    ${data.type === 'blunder' ? '??' : '!'} ${escapeHtml(data.movePlayed)} (${data.probDrop}%)
                </div>
            `;
            container.appendChild(card);
            requestAnimationFrame(() => {
                try {
                    Chessboard(`featured-board-${index}`, {
                        position: data.fenBefore,
                        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
                        draggable: false,
                        showNotation: false,
                        orientation: (data.white && data.white.toLowerCase().includes(playerName.toLowerCase())) ? 'white' : 'black'
                    });
                } catch(e) {}
            });
        });

    } catch (e) {
        console.error('loadFeatured error:', e);
    }
}

async function toggleFeatured(blunderId) {
    try {
        const res = await fetch(`/api/blunder/${blunderId}/featured`, { method: 'PUT' });
        if (res.ok) {
            const { isFeatured } = await res.json();
            const btn = document.querySelector(`[data-featured-id="${blunderId}"]`);
            if (btn) {
                btn.innerHTML = isFeatured ? '<i class="fa-solid fa-star" style="color:#fbbf24;"></i>' : '<i class="fa-regular fa-star" style="color:#666;"></i>';
            }
            // Update badge count
            if (currentPlayer) {
                const featRes = await fetch(`/api/blunder/${encodeURIComponent(currentPlayer)}/featured`);
                if (featRes.ok) {
                    const featured = await featRes.json();
                    document.getElementById('featured-count-badge').textContent = featured.length || '';
                }
            }
        }
    } catch (e) { console.error('toggleFeatured error:', e); }
}
window.toggleFeatured = toggleFeatured;
