// Puzzle Racer Logic

let game = null;
let board = null;
let puzzles = [];
let currentPuzzleIndex = 0;
let score = 0;
let timeLeft = 180; // 3 minutes
let timerInterval = null;
let isGameActive = false;
let selectedSquare = null; // Click-to-move state

// Progressive difficulty loading
const DIFFICULTIES = ['easiest', 'easier', 'normal', 'harder', 'hardest'];
let currentDifficultyIndex = 0;
let totalPuzzlesSolved = 0;
// Prefetch trigger: fetching when fewer than 5 puzzles remain
let puzzlesBeforeNextBatch = 5;
let puzzlesPerDifficultyLevel = 6; // Increase difficulty after 6 solved
let isFetchingPuzzles = false;

// Lives system - 3 mistakes = game over
let mistakeCount = 0;
const MAX_MISTAKES = 3;

// Actually, let's just use ONE solid simple puzzle for fallback to minimize error risk
// Mat v 1. tahu.
const FALLBACK_PUZZLES = [
    {
        // Scholar's Mate (White to move)
        "game": { "pgn": "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6" },
        "puzzle": {
            "id": "scholars_mate",
            "rating": 800,
            "plays": 1000,
            "initialPly": 6, // 6 half-moves played: e4, e5, Bc4, Nc6, Qh5, Nf6
            "solution": ["h5f7"], // Qxf7#
            "themes": ["mateIn1"]
        }
    },
    {
        // Fool's Mate (Black to move)
        "game": { "pgn": "1. f3 e5 2. g4" },
        "puzzle": {
            "id": "fools_mate",
            "rating": 700,
            "plays": 50000,
            "initialPly": 3, // 3 half-moves played: f3, e5, g4
            "solution": ["d8h4"], // Qh4#
            "themes": ["mateIn1"]
        }
    },
    {
        // Philidor Smothered Mate (classic)
        "game": { "pgn": "1. e4 e5 2. Nf3 Nc6 3. Bc4 d6 4. Nc3 Bg4 5. h3 Bh5 6. Nxe5 Bxd1 7. Bxf7+ Ke7 8. Nd5#" }, // Full game
        "puzzle": {
            "id": "legals_mate", // actually Legal's mate pattern
            "rating": 1200,
            "plays": 2000,
            "initialPly": 10, // after ...Bg4? no, let's setup the tactic.
            //  1. e4 e5 2. Nf3 d6 3. Nc3 Bg4 4. h3 Bh5? 5. Nxe5!
            // PGN for that: 
            // 1. e4 e5 2. Nf3 d6 3. Nc3 Bg4 4. h3 Bh5
            // Puzzle starts here. White to move.
            // Ply count: 8.
            // Move 9: Nxe5.
            "solution": ["f3e5", "g4d1", "c4f7", "e8e7", "c3d5"],
            "themes": ["mate"]
        }
    },
    // Adding a simpler one to replace the complex one above for safety
    {
        "game": { "pgn": "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Na5 10. Bc2 c5 11. d4 Qc7 12. Nbd2 cxd4 13. cxd4 Bb7 14. d5 Rac8 15. Bd3 Nd7 16. Nf1 f5 17. exf5 Bxd5" },
        "puzzle": {
            "id": "simple_tactic",
            "rating": 1500,
            "plays": 100,
            "initialPly": 34,
            "solution": ["d3b5"], // Bxb5 winning piece? No wait, let's stick to mates for fallback.
            "themes": ["advantage"]
        }
    }
];

// Using only verified simple mate-in-1 puzzles for fallback
const FALLBACK_PUZZLES_FINAL = [
    {
        // Scholar's Mate: White plays Qxf7#
        "game": { "pgn": "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6" },
        "puzzle": { "id": "scholars_mate", "rating": 600, "initialPly": 6, "solution": ["h5f7"], "themes": ["mateIn1"] }
    },
    {
        // Fool's Mate: Black plays Qh4#
        "game": { "pgn": "1. f3 e5 2. g4" },
        "puzzle": { "id": "fools_mate", "rating": 600, "initialPly": 3, "solution": ["d8h4"], "themes": ["mateIn1"] }
    }
];

// Fetch more puzzles from server
async function fetchMorePuzzles() {
    if (isFetchingPuzzles) return;
    isFetchingPuzzles = true;

    // Predictive difficulty: matching what WILL be needed
    // If we have 6 puzzles, the next batch (index 6-11) should be level 1 (easier).
    // If we have 0 puzzles, the next batch (index 0-5) should be level 0 (easiest).
    const predictedTotal = puzzles.length;
    const predictedLevelIndex = Math.min(
        Math.floor(predictedTotal / puzzlesPerDifficultyLevel),
        DIFFICULTIES.length - 1
    );

    const difficulty = DIFFICULTIES[predictedLevelIndex] || 'hardest';
    const batchSize = 6; // Load exactly one difficulty level worth

    console.log(`Fetching ${batchSize} ${difficulty} puzzles (Current total: ${puzzles.length})...`);

    // Show mini-loading indicator if game is active
    if (isGameActive) {
        const toMove = document.getElementById('toMove');
        if (toMove) toMove.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Načítám další úlohy...';
    }

    try {
        const res = await fetch(`${API_URL}/racer/puzzles?difficulty=${difficulty}&count=${batchSize}`);
        if (res.ok) {
            const data = await res.json();
            const newPuzzles = data.puzzles || [];
            puzzles = puzzles.concat(newPuzzles);
            console.log(`Added ${newPuzzles.length} ${difficulty} puzzles. Total: ${puzzles.length}`);
        }
    } catch (e) {
        console.error('Failed to fetch puzzles:', e);
    }

    isFetchingPuzzles = false;
}

async function startRace() {
    const startBtn = document.querySelector('#startScreen button');
    const loading = document.getElementById('loadingIndicator');

    startBtn.style.display = 'none';
    loading.classList.remove('hidden');

    // Reset progressive loading state
    puzzles = [];
    currentPuzzleIndex = 0;
    currentDifficultyIndex = 0;
    totalPuzzlesSolved = 0;

    try {
        // Initial load: Fetch 2 batches (12 puzzles) to build buffer
        // Easiest
        await fetchMorePuzzles();
        // Easier (prediction will handle logic)
        await fetchMorePuzzles();

        if (puzzles.length === 0) {
            console.warn('No puzzles from server, using fallback.');
            for (let i = 0; i < 10; i++) {
                puzzles = puzzles.concat(FALLBACK_PUZZLES_FINAL);
            }
        }

        // Setup UI
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameInterface').classList.remove('hidden');

        // Lock scroll on mobile
        document.body.classList.add('game-active');

        updateDifficultyDisplay(); // Init difficulty text
        startGameLoop();

    } catch (e) {
        console.error('Failed to load puzzles', e);
        alert('Nepodařilo se načíst úlohy. Zkuste to prosím znovu.');
        startBtn.style.display = 'inline-block';
        loading.classList.add('hidden');
    }
}

function startGameLoop() {
    score = 0;
    timeLeft = 180;
    currentPuzzleIndex = 0;
    isGameActive = true;

    updateScore();
    updateTimer();
    resetLives(); // Reset lives display

    // Initialize first puzzle
    loadPuzzle(puzzles[currentPuzzleIndex]);

    // Start timer
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimer();

        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

function loadPuzzle(puzzleData) {
    if (!puzzleData) {
        // No puzzle data - wait for fetch (don't end game!)
        console.log('No puzzle data, waiting...');
        setTimeout(loadNextPuzzleOrWait, 300);
        return;
    }

    // Prefetch more puzzles when we're getting low (when loading puzzle and only 5 left)
    const puzzlesRemaining = puzzles.length - currentPuzzleIndex;
    if (puzzlesRemaining <= 5 && !isFetchingPuzzles) {
        console.log(`Only ${puzzlesRemaining} puzzles remaining, prefetching more...`);
        fetchMorePuzzles();
    }

    const gamePgn = puzzleData.game.pgn;
    game = new Chess();

    // Load PGN to get initial state, but we need to reach the state BEFORE the solution starts
    // Lichess gives 'initialPly' which is the move number where puzzle starts.
    // However, loading PGN into chess.js loads result game.
    // We can load PGN then traverse to ply?
    // Actually, Lichess PGN often contains the game up to that point?
    // Let's check Lichess API response format again.
    // Lichess returns full game PGN. 'initialPly' is the number of half-moves made before puzzle starts.

    // Load the full game
    if (!game.load_pgn(gamePgn)) {
        console.error('Failed to parse PGN:', gamePgn);
        // Try fallback parsing if headers are missing by just taking moves? 
        // Chess.js usually handles it.
        // Let's force reset and try to load moves manually if needed?
        // But for now just log it.
    }

    // Now we need to navigate to 'initialPly'. 
    // Chess.js doesn't support "goto ply" easily from a loaded PGN directly without replaying.
    // Better strategy:
    // 1. Get history.
    // 2. Reset board.
    // 3. Replay 'initialPly' moves.

    const history = game.history({ verbose: true });
    game.reset();

    // Replay moves up to initialPly to set up the position where the puzzle starts
    // initialPly = number of half-moves already played
    // The NEXT move (history[initialPly]) is the "opponent's last move" to animate
    // After that animation, the player solves the puzzle
    const movesToReplay = puzzleData.puzzle.initialPly;

    for (let i = 0; i < movesToReplay; i++) {
        const move = history[i];
        if (move) game.move(move);
    }

    // Determine orientation based on who will be to move AFTER the last move
    // If initialPly is even (0, 2...), it's White's turn?
    // Let's rely on game.turn() after we play the last move.

    // Logic: 
    // We are at state N-1.
    // We play move N (the opponent's move).
    // Then it is player's turn.
    // So we check turn AFTER the opponent move.

    // To decide orientation, we need to know player's color.
    // Player's color is the side to move at `initialPly`.
    // Let's peek ahead.
    const tempGame = new Chess(game.fen());
    const lastMove = history[movesToReplay]; // The move at index [movesToReplay] is the Nth move (0-indexed)
    if (lastMove) {
        tempGame.move(lastMove);
    }
    const playerColor = tempGame.turn() === 'w' ? 'white' : 'black';

    // Update UI text immediately
    document.getElementById('toMove').innerText = playerColor === 'white' ? 'Bílý na tahu' : 'Černý na tahu';

    // Initialize/Update Board - OPTIMIZED: Reuse board instance when possible
    // Explicitly remove all move highlights from the DOM to prevent persistence
    removeMoveHighlights();

    if (board) {
        // Reuse existing board - just update position and orientation (faster!)
        board.orientation(playerColor);
        board.position(game.fen(), false); // false = no animation for initial position
    } else {
        // First time - create board
        const config = {
            draggable: true,
            position: game.fen(),
            orientation: playerColor,
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
            onDragStart: onDragStart,
            onDrop: onDrop,
            onSnapEnd: onSnapEnd,
            moveSpeed: 'slow'
        };
        board = Chessboard('board', config);
    }

    // Animate the last move (Opponent's move) after a short delay
    // OPTIMIZED: Reduced from 500ms to 250ms for snappier feel
    if (lastMove) {
        setTimeout(() => {
            game.move(lastMove);
            board.position(game.fen(), true); // animate

            // Highlight the opponent's move (which is the start of the puzzle)
            highlightMove(lastMove.from, lastMove.to);
        }, 250);
    } else {
        // Should not happen for valid puzzles, but graceful fallback
        // If initialPly is 0? Puzzle starts from start position? Unlikely.
    }

    // Store current puzzle solution for validation
    // Lichess solution is array of UCI moves: ["e2e4", "c7c5"]
    // We only need to validate the PLAYER's move.
    // The solution steps: 
    // 1. Player moves (must match solution[0])
    // 2. Opponent responses (solution[1]) - auto played
    // 3. Player moves (must match solution[2])
    // ...

    // Verify solution structure
    if (!puzzleData.puzzle || !puzzleData.puzzle.solution) {
        console.error('Invalid puzzle data', puzzleData);
        // Skip correct handling to force next
        currentPuzzleIndex++;
        loadPuzzle(puzzles[currentPuzzleIndex]);
        return;
    }

    game.currentSolution = puzzleData.puzzle.solution;
    game.solutionIndex = 0; // Index in the solution array we are waiting for
}

function onDragStart(source, piece, position, orientation) {
    if (!isGameActive) return false;

    // Only allow moving pieces for the side to move
    if ((game.turn() === 'w' && piece.search(/^b/) !== -1) ||
        (game.turn() === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }

    // Highlight source on drag
    removeHighlights();
    highlightSquare(source);
    selectedSquare = source; // consistent state
}

function onDrop(source, target) {
    if (!isGameActive) return 'snapback';
    if (source === target) return;

    // Handle move (passed isDrop=true)
    const success = handleMove(source, target, true);

    // Keep move highlights if success? 
    // handleMove already calls highlightMove if success.

    // Always clear SELECTION highlights after drop attempt
    removeHighlights();
    selectedSquare = null;

    return success ? undefined : 'snapback';
}

function onSnapEnd() {
    // board.position(game.fen()); // Just to sync visuals if any weirdness
}

// --- CLICK TO MOVE LOGIC ---

function handleSquareClick(square) {
    if (!isGameActive) return;

    // Cases:
    // 1. No selection -> select if own piece
    // 2. Selection active:
    //    a. Clicked same square -> deselect
    //    b. Clicked other own piece -> change selection
    //    c. Clicked target -> attempt move

    const pieceOnSquare = game.get(square);
    const isOwnPiece = pieceOnSquare && pieceOnSquare.color === game.turn();

    if (!selectedSquare) {
        if (isOwnPiece) {
            selectSquare(square);
        }
        return;
    }

    // We have a selection
    if (square === selectedSquare) {
        deselectSquare();
        return;
    }

    if (isOwnPiece) {
        // Change selection
        selectSquare(square);
        return;
    }

    // Attempt move selectedSquare -> square
    const success = handleMove(selectedSquare, square, false);
    if (success) {
        deselectSquare();
    } else {
        // Invalid move or wrong solution
        // Optional: flash red or just deselect? 
        // Lichess keeps selection if invalid move (e.g. impossible move), 
        // but if it's a "wrong solution" move (legal but bad), we penalized.
        // If it was just an illegal move (knight jump weirdly), handleMove returns false early.
        // We should probably just deselect to be clean.
        deselectSquare();
    }
}

function selectSquare(square) {
    selectedSquare = square;
    removeHighlights();
    highlightSquare(square);
}

function deselectSquare() {
    selectedSquare = null;
    removeHighlights();
}

function highlightSquare(square) {
    const $square = $('#board .square-' + square);
    $square.addClass('highlight-selected');
}

function removeHighlights() {
    $('#board .square-55d63').removeClass('highlight-selected');
}

function highlightMove(source, target) {
    // Remove old move highlights
    $('#board .square-55d63').removeClass('highlight-move');
    // Add new
    $('#board .square-' + source).addClass('highlight-move');
    $('#board .square-' + target).addClass('highlight-move');
}

function removeMoveHighlights() {
    $('#board .square-55d63').removeClass('highlight-move');
}

// Core move logic shared by Drag and Click
function handleMove(source, target, isDrop) {
    // 1. Verify legality in Chess.js
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });

    if (move === null) return false; // Illegal move

    // 2. Check against solution
    const uciMove = move.from + move.to + (move.promotion ? move.promotion : '');
    const expectedMove = game.currentSolution[game.solutionIndex];

    // Debug logs removed for production
    // console.log(`Move attempt: ${uciMove} vs expected ${expectedMove}`);

    if (uciMove !== expectedMove) {
        // Wrong move!
        game.undo(); // undo the move on board logic

        // (For click, we haven't moved piece on board yet so we good)
        // (For drag, we return false so snapback happens)

        handleWrongMove();
        return 'snapback';
    }

    // 3. Correct move!
    // If click-move, we must update board visually
    if (!isDrop) {
        board.move(`${source}-${target}`);
    }

    // Highlight the move (persistent until next move/puzzle)
    highlightMove(source, target);

    game.solutionIndex++;

    // Check if puzzle solved by this move
    if (game.solutionIndex >= game.currentSolution.length) {
        handleCorrectPuzzle();
    } else {
        // Opponent's turn - OPTIMIZED: Reduced from 300ms to 150ms
        setTimeout(() => {
            makeOpponentMove();
        }, 150);
    }

    return true;
}

function makeOpponentMove() {
    // Safety check
    if (game.solutionIndex >= game.currentSolution.length) return;

    const opponentMoveUci = game.currentSolution[game.solutionIndex];
    const from = opponentMoveUci.substring(0, 2);
    const to = opponentMoveUci.substring(2, 4);
    const promotion = opponentMoveUci.length > 4 ? opponentMoveUci.substring(4, 5) : undefined;

    game.move({ from, to, promotion });
    board.position(game.fen());

    // Highlight opponent move
    // removeHighlights();
    // highlightSquare(from);
    // highlightSquare(to);

    game.solutionIndex++;

    if (game.solutionIndex >= game.currentSolution.length) {
        handleCorrectPuzzle();
    }
}

function handleCorrectPuzzle() {
    score++;
    totalPuzzlesSolved++;
    updateScore();
    showFeedback('correct');

    // Check if we need to increase difficulty (every 6 puzzles)
    if (totalPuzzlesSolved > 0 && totalPuzzlesSolved % puzzlesPerDifficultyLevel === 0) {
        if (currentDifficultyIndex < DIFFICULTIES.length - 1) {
            currentDifficultyIndex++;
            console.log(`Difficulty increased to: ${DIFFICULTIES[currentDifficultyIndex]}`);
            updateDifficultyDisplay();
        }
    }

    // Check if we need to fetch more puzzles (fetch early when only 1-2 remaining)
    const puzzlesRemaining = puzzles.length - currentPuzzleIndex - 1;
    if (puzzlesRemaining <= 2 && !isFetchingPuzzles) {
        fetchMorePuzzles(); // Fetch in background
    }

    // Next puzzle
    currentPuzzleIndex++;

    // Load next puzzle or wait for more to load (NEVER end game due to lack of puzzles)
    loadNextPuzzleOrWait();
}

// Helper to load next puzzle or wait for fetch to complete
function loadNextPuzzleOrWait() {
    if (currentPuzzleIndex < puzzles.length) {
        // Have more puzzles ready
        loadPuzzle(puzzles[currentPuzzleIndex]);
    } else {
        // No puzzles - show feedback
        console.log('Waiting for more puzzles...');
        const toMove = document.getElementById('toMove');
        if (toMove) toMove.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Čekám na server...';

        // Ensure we are fetching
        if (!isFetchingPuzzles) {
            fetchMorePuzzles();
        }

        // Check again in 500ms
        setTimeout(loadNextPuzzleOrWait, 500);
    }
}

function handleWrongMove() {
    mistakeCount++;
    updateLivesDisplay();
    showFeedback('wrong');

    // 3 mistakes = game over
    if (mistakeCount >= MAX_MISTAKES) {
        setTimeout(() => {
            endGame();
        }, 500);
        return;
    }

    // Time penalty disabled in this mode (kept for future modes)
    // timeLeft = Math.max(0, timeLeft - 5);
    // updateTimer();
}

// Update lives display (X marks)
function updateLivesDisplay() {
    for (let i = 1; i <= MAX_MISTAKES; i++) {
        const lifeIcon = document.getElementById(`life${i}`);
        if (lifeIcon) {
            if (i <= mistakeCount) {
                lifeIcon.classList.add('lost');
            } else {
                lifeIcon.classList.remove('lost');
            }
        }
    }
}

// Reset lives at game start
function resetLives() {
    mistakeCount = 0;
    updateLivesDisplay();
}

function showFeedback(type) {
    const overlay = document.getElementById('feedbackOverlay');
    overlay.className = ''; // reset
    void overlay.offsetWidth; // trigger reflow
    overlay.className = type === 'correct' ? 'correct-feedback' : 'wrong-feedback';
}

function skipPuzzle() {
    if (!isGameActive) return;
    timeLeft = Math.max(0, timeLeft - 5);
    updateTimer();
    currentPuzzleIndex++;
    loadPuzzle(puzzles[currentPuzzleIndex]);
}

function updateScore() {
    document.getElementById('score').innerText = score;
}



function updateDifficultyDisplay() {
    const diffEl = document.getElementById('difficultyDisplay');
    if (diffEl) {
        // Translate difficulty to Czech or just show meaningful text
        const map = {
            'easiest': { text: 'Začátečník', icon: 'fa-chess-pawn' },
            'easier': { text: 'Lehká', icon: 'fa-chess-knight' },
            'normal': { text: 'Střední', icon: 'fa-chess-bishop' },
            'harder': { text: 'Těžká', icon: 'fa-chess-rook' },
            'hardest': { text: 'Expert', icon: 'fa-chess-queen' }
        };
        const currentDiff = DIFFICULTIES[currentDifficultyIndex] || 'easiest';
        const info = map[currentDiff] || map['easiest'];

        // USER REQUEST: Icon only (removed info.text)
        diffEl.innerHTML = `<i class="fa-solid ${info.icon}" title="${info.text}"></i>`;

        // Add visual flair based on level
        diffEl.className = 'stat-value difficulty-badge level-' + currentDiff;
    }
}

function updateTimer() {
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;
    document.getElementById('timer').innerText = `${min}:${sec < 10 ? '0' + sec : sec}`;
}

function endGame() {
    isGameActive = false;
    clearInterval(timerInterval);

    // Unlock scroll
    document.body.classList.remove('game-active');

    document.getElementById('gameInterface').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.remove('hidden');
    document.getElementById('finalScore').innerText = score;

    // Pre-fill name if user is logged in (optional later)
}

async function saveScore() {
    const playerName = document.getElementById('playerName').value;
    if (!playerName) {
        alert('Zadejte prosím své jméno.');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/racer/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                score,
                playerName
            })
        });

        if (res.ok) {
            // Save name for next time
            localStorage.setItem('puzzle_racer_name', playerName);

            alert('Výsledek uložen!');
            location.reload();
        } else {
            alert('Chyba při ukládání.');
        }
    } catch (e) {
        console.error(e);
        alert('Chyba připojení.');
    }
}

// --- RESTORED LEADERBOARD LOGIC ---

// Current leaderboard period
let currentLeaderboardPeriod = 'all';

async function loadLeaderboard(period = 'all') {
    try {
        const res = await fetch(`${API_URL}/racer/leaderboard?period=${period}`);
        if (!res.ok) throw new Error('Failed to fetch leaderboard');

        const data = await res.json();
        const tbody = document.getElementById('leaderboardBody');

        if (data.length === 0) {
            const emptyMsg = period === 'week'
                ? 'Tento týden zatím žádné výsledky. Buďte první!'
                : 'Zatím žádné výsledky. Buďte první!';
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem;">${emptyMsg}</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map((entry, index) => {
            let medal = '';
            if (index === 0) medal = '🥇 ';
            if (index === 1) medal = '🥈 ';
            if (index === 2) medal = '🥉 ';

            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 1rem; color: var(--text-muted);">#${index + 1}</td>
                    <td style="padding: 1rem; font-weight: 600;">${medal}${escapeHtml(entry.playerName)}</td>
                    <td style="padding: 1rem; color: #4ade80; font-weight: 700; font-size: 1.1rem;">${entry.score}</td>
                    <td style="padding: 1rem; color: var(--text-muted); font-size: 0.85rem;">${new Date(entry.createdAt).toLocaleString('cs-CZ')}</td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        const errMsg = e.message || 'Chyba serveru';
        const tbody = document.getElementById('leaderboardBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #fca5a5;">Chyba při načítání: ${errMsg}</td></tr>`;
    }
}

function switchLeaderboard(period) {
    currentLeaderboardPeriod = period;

    // Update tab styles
    document.getElementById('tabAllTime').classList.toggle('active', period === 'all');
    document.getElementById('tabWeekly').classList.toggle('active', period === 'week');

    // Show loading
    document.getElementById('leaderboardBody').innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Načítám...</td></tr>';

    // Load leaderboard with new period
    loadLeaderboard(period);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // expose functions to window
    window.startRace = startRace;
    window.saveScore = saveScore;
    window.skipPuzzle = skipPuzzle;
    window.switchLeaderboard = switchLeaderboard;

    // Load leaderboard and player name on init
    loadLeaderboard();
    const savedName = localStorage.getItem('puzzle_racer_name');
    if (savedName) {
        const nameInput = document.getElementById('playerName');
        if (nameInput) nameInput.value = savedName;
    }

    // ROBUST CLICK HANDLING (Capture Phase)
    // We bind to the DOCUMENT to ensure it survives board re-creation.
    const handleInput = (e) => {
        // Ensure we are clicking inside the board
        const boardContainer = document.getElementById('board');
        if (!boardContainer || !boardContainer.contains(e.target)) return;

        // Find closest square element
        const squareEl = e.target.closest('.square-55d63');
        if (!squareEl) return;

        // Get square ID
        const squareId = squareEl.getAttribute('data-square');
        if (squareId) {
            if (e.type === 'touchstart') {
                // optional preventDefault if needed
            }

            handleSquareClick(squareId);
        }
    };

    // Use capture to see events before chessboard.js
    // Using body is enough and safer than specific element if element is replaced
    document.body.addEventListener('mousedown', handleInput, true);
    document.body.addEventListener('click', handleInput, true);
});
