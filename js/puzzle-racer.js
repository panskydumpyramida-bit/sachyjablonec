// Puzzle Racer Logic

let game = null;
let board = null;
let puzzles = [];
let currentPuzzleIndex = 0;
let score = 0;
let timeLeft = 180; // 3 minutes (will be overwritten by settings)
let timerInterval = null;
let isGameActive = false;
let selectedSquare = null; // Click-to-move state

// Progressive difficulty loading
const DIFFICULTIES = ['easiest', 'easier', 'normal', 'harder', 'hardest'];
let currentDifficultyIndex = 0;
let totalPuzzlesSolved = 0;
// Prefetch trigger: fetching when fewer than 5 puzzles remain
let puzzlesBeforeNextBatch = 5;
let puzzlesPerDifficultyLevel = 6; // Will be overwritten by settings

// Lives system - configurable via settings
let mistakeCount = 0;
let MAX_MISTAKES = 3; // Will be overwritten by settings
let livesEnabled = true; // Will be overwritten by settings

// Game settings from API
let gameSettings = {};
let isFetchingPuzzles = false;

// Penalty and skip settings (from API)
let penaltyEnabled = false;
let penaltySeconds = 5;
let skipOnMistake = false;

// Game mode: 'vanilla' uses fixed defaults, 'thematic' uses admin settings
let gameMode = 'vanilla';

// Puzzle history for post-solve review
let puzzleHistory = [];

// Logged-in user info (decoded from JWT)
let loggedInUser = null;

// Personal best for new record detection
let personalBest = 0;

// Per-game stats for dashboard
let gameCorrectCount = 0;
let gameWrongCount = 0;
let currentStreak = 0;
let gameMaxStreak = 0;

// Vanilla defaults (fixed, not affected by admin settings)
const VANILLA_DEFAULTS = {
    puzzleTheme: 'mix',
    timeLimitSeconds: 180,
    livesEnabled: true,
    maxLives: 3,
    puzzlesPerDifficulty: 6,
    penaltyEnabled: false,
    penaltySeconds: 5,
    skipOnMistake: false
};

// Detect mode from URL parameter
function detectGameMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    gameMode = mode === 'thematic' ? 'thematic' : 'vanilla';
    console.log('Game mode:', gameMode);
    return gameMode;
}

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
        const res = await fetch(`${API_URL}/racer/puzzles?difficulty=${difficulty}&count=${batchSize}&mode=${gameMode}`);
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

// Load game settings based on mode
async function loadGameSettings() {
    // Vanilla mode uses fixed defaults (no API call needed)
    if (gameMode === 'vanilla') {
        gameSettings = { ...VANILLA_DEFAULTS };
        console.log('Using vanilla defaults:', gameSettings);
    } else {
        // Thematic mode fetches settings from admin panel
        try {
            const res = await fetch(`${API_URL}/racer/settings`);
            if (res.ok) {
                gameSettings = await res.json();
                console.log('Loaded thematic settings from API:', gameSettings);
            } else {
                throw new Error('API returned non-ok status');
            }
        } catch (e) {
            console.error('Failed to load thematic settings, using vanilla fallback:', e);
            gameSettings = { ...VANILLA_DEFAULTS };
        }
    }

    // Apply settings to game variables
    timeLeft = gameSettings.timeLimitSeconds || 180;
    livesEnabled = gameSettings.livesEnabled !== false;
    MAX_MISTAKES = gameSettings.maxLives || 3;
    puzzlesPerDifficultyLevel = gameSettings.puzzlesPerDifficulty || 6;
    penaltyEnabled = gameSettings.penaltyEnabled === true;
    penaltySeconds = gameSettings.penaltySeconds || 5;
    skipOnMistake = gameSettings.skipOnMistake === true;
}

async function startRace() {
    const startBtn = document.querySelector('#startScreen button');
    const loading = document.getElementById('loadingIndicator');

    startBtn.style.display = 'none';
    loading.classList.remove('hidden');

    // Detect mode from URL parameter
    detectGameMode();

    // Load settings based on mode
    await loadGameSettings();

    // Reset progressive loading state
    puzzles = [];
    currentPuzzleIndex = 0;
    currentDifficultyIndex = 0;
    totalPuzzlesSolved = 0;
    puzzleHistory = []; // Reset puzzle history

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

        // Update lives UI based on settings
        updateLivesUI();

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
    // timeLeft is already set by loadGameSettings()
    currentPuzzleIndex = 0;
    isGameActive = true;

    // Reset per-game stats
    gameCorrectCount = 0;
    gameWrongCount = 0;
    currentStreak = 0;
    gameMaxStreak = 0;
    puzzleHistory = [];

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
            moveSpeed: 300  // 300ms animation
        };
        board = Chessboard('board', config);
    }

    // Animate the last move (Opponent's move) after board is ready
    // 250ms delay before animation starts
    if (lastMove) {
        setTimeout(() => {
            game.move(lastMove);
            board.position(game.fen(), true); // animate

            // Highlight the opponent's move (which is the start of the puzzle)
            highlightMove(lastMove.from, lastMove.to);
        }, 350);
    } else {
        // Should not happen for valid puzzles, but graceful fallback
    }

    // Display current puzzle rating
    const ratingEl = document.getElementById('puzzleRating');
    if (ratingEl && puzzleData.puzzle.rating) {
        const r = puzzleData.puzzle.rating;
        let ratingColor = '#4ade80'; // green (easy)
        if (r >= 2000) ratingColor = '#f87171'; // red (hard)
        else if (r >= 1500) ratingColor = '#fbbf24'; // yellow (medium)
        ratingEl.innerHTML = `<i class="fa-solid fa-signal"></i> ${r}`;
        ratingEl.style.color = ratingColor;
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
    // Get expected move to determine promotion piece (if any)
    const expectedMove = game.currentSolution[game.solutionIndex];

    // Extract promotion piece from solution (e.g. "a7a8n" -> 'n', "e7e8q" -> 'q')
    // Lichess solution format: from(2) + to(2) + promotion(1)? = 4-5 chars
    let promotionPiece = 'q'; // Default to queen
    if (expectedMove && expectedMove.length === 5) {
        promotionPiece = expectedMove.charAt(4); // n, b, r, or q
    }

    // 1. Verify legality in Chess.js with correct promotion piece
    const move = game.move({
        from: source,
        to: target,
        promotion: promotionPiece
    });

    if (move === null) return false; // Illegal move

    // 2. Check against solution
    const uciMove = move.from + move.to + (move.promotion ? move.promotion : '');

    // Check if this is the last move in solution (potential checkmate)
    const isLastSolutionMove = game.solutionIndex === game.currentSolution.length - 1;
    const isCheckmate = game.in_checkmate();

    // Accept move if:
    // 1. It matches the expected solution, OR
    // 2. It's the last move AND it results in checkmate (alternative mate)
    const isCorrect = (uciMove === expectedMove) || (isLastSolutionMove && isCheckmate);

    if (!isCorrect) {
        // Wrong move!
        game.undo(); // undo the move on board logic

        // BUGFIX: Force board to sync with game state (ensures snapback works)
        board.position(game.fen(), false);

        handleWrongMove();
        return false; // BUGFIX: Return false, not 'snapback' - onDrop checks for falsy value
    }

    // 3. Correct move!
    // If click-move, update board visually WITH animation
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
        // Opponent's turn - wait for player's animation to complete (250ms)
        setTimeout(() => {
            makeOpponentMove();
        }, 350);
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
    board.position(game.fen(), true); // true = animate the move

    // Highlight opponent move
    // removeHighlights();
    // highlightSquare(from);
    // highlightSquare(to);

    game.solutionIndex++;

    // Wait for opponent's animation to complete before next action (250ms)
    setTimeout(() => {
        if (game.solutionIndex >= game.currentSolution.length) {
            handleCorrectPuzzle();
        }
        // If more player moves needed, player can now move (no action needed here)
    }, 350);
}

function handleCorrectPuzzle() {
    score++;
    totalPuzzlesSolved++;
    gameCorrectCount++;
    currentStreak++;
    if (currentStreak > gameMaxStreak) gameMaxStreak = currentStreak;
    updateScore();

    // Track puzzle for post-solve review
    const currentPuzzle = puzzles[currentPuzzleIndex];
    if (currentPuzzle) {
        puzzleHistory.push({
            fen: game.fen(),
            initialFen: getInitialFen(currentPuzzle),
            solution: currentPuzzle.puzzle.solution,
            rating: currentPuzzle.puzzle.rating,
            puzzleId: currentPuzzle.puzzle.id,
            correct: true
        });
    }
    showFeedback('correct');

    // Easter egg: Completed all difficulty levels! (5 × 6 = 30 puzzles)
    const totalPuzzlesForAllLevels = DIFFICULTIES.length * puzzlesPerDifficultyLevel;
    if (totalPuzzlesSolved >= totalPuzzlesForAllLevels) {
        showEasterEgg();
        return; // Don't load more puzzles
    }

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

    // Wait for last move animation to complete before loading next puzzle (250ms)
    setTimeout(() => {
        // Load next puzzle or wait for more to load (NEVER end game due to lack of puzzles)
        loadNextPuzzleOrWait();
    }, 350);
}

// Easter egg for completing all puzzles!
function showEasterEgg() {
    isGameActive = false;
    clearInterval(timerInterval);
    document.body.classList.remove('game-active');

    document.getElementById('gameInterface').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.remove('hidden');

    // Special easter egg message
    const finalScoreEl = document.getElementById('finalScore');
    finalScoreEl.innerHTML = `
        <div style="font-size: 3rem;">🏆 ${score} 🏆</div>
        <div style="font-size: 1.2rem; color: var(--primary-color); margin-top: 1rem;">
            <i class="fa-solid fa-star"></i> LEGENDA! <i class="fa-solid fa-star"></i>
        </div>
        <div style="font-size: 0.9rem; color: var(--text-muted); margin-top: 0.5rem; max-width: 300px; margin-left: auto; margin-right: auto;">
            Vyřešil jsi všech ${DIFFICULTIES.length * puzzlesPerDifficultyLevel} puzzlů!<br>
            Řeknu Tondovi ať to udělá těžší... 😄
        </div>
    `;
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
    gameWrongCount++;
    currentStreak = 0;
    updateLivesDisplay();
    showFeedback('wrong');

    // Track failed puzzle for post-solve review
    const currentPuzzle = puzzles[currentPuzzleIndex];
    if (currentPuzzle) {
        // Only add if not already tracked (avoid duplicates on multiple wrong moves)
        const alreadyTracked = puzzleHistory.some(p => p.puzzleId === currentPuzzle.puzzle.id);
        if (!alreadyTracked) {
            puzzleHistory.push({
                fen: game.fen(),
                initialFen: getInitialFen(currentPuzzle),
                solution: currentPuzzle.puzzle.solution,
                rating: currentPuzzle.puzzle.rating,
                puzzleId: currentPuzzle.puzzle.id,
                correct: false
            });
        }
    }

    // Check if lives system is enabled and we're out of lives
    if (livesEnabled && mistakeCount >= MAX_MISTAKES) {
        setTimeout(() => {
            endGame();
        }, 500);
        return;
    }

    // Apply time penalty if enabled
    if (penaltyEnabled) {
        timeLeft = Math.max(0, timeLeft - penaltySeconds);
        updateTimer();

        // Check if penalty caused time to run out
        if (timeLeft <= 0) {
            setTimeout(() => {
                endGame();
            }, 500);
            return;
        }
    }

    // Skip to next puzzle if enabled (without requiring user to solve current one)
    if (skipOnMistake) {
        setTimeout(() => {
            currentPuzzleIndex++;
            loadNextPuzzleOrWait();
        }, 500);
    }
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

// Update lives UI based on settings (show/hide, adjust count)
function updateLivesUI() {
    const livesBox = document.querySelector('.stat-box:has(.lives-display)');
    const livesDisplay = document.querySelector('.lives-display');

    if (!livesEnabled) {
        // Hide lives box if disabled
        if (livesBox) livesBox.style.display = 'none';
        return;
    }

    if (livesBox) livesBox.style.display = '';

    // Dynamically create life icons based on MAX_MISTAKES
    if (livesDisplay) {
        livesDisplay.innerHTML = '';
        for (let i = 1; i <= MAX_MISTAKES; i++) {
            const icon = document.createElement('i');
            icon.className = 'fa-solid fa-xmark life-icon';
            icon.id = `life${i}`;
            livesDisplay.appendChild(icon);
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
    const scoreEl = document.getElementById('score');
    scoreEl.innerText = score;
    // Pop animation
    scoreEl.classList.remove('score-pop');
    void scoreEl.offsetWidth; // trigger reflow
    scoreEl.classList.add('score-pop');
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
    const timerEl = document.getElementById('timer');
    timerEl.innerText = `${min}:${sec < 10 ? '0' + sec : sec}`;

    // Timer urgency classes
    timerEl.classList.remove('timer-warning', 'timer-urgent');
    if (timeLeft <= 10) {
        timerEl.classList.add('timer-urgent');
    } else if (timeLeft <= 30) {
        timerEl.classList.add('timer-warning');
    }
}

function endGame() {
    isGameActive = false;
    clearInterval(timerInterval);

    // Unlock scroll
    document.body.classList.remove('game-active');

    document.getElementById('gameInterface').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.remove('hidden');
    document.getElementById('finalScore').innerText = score;

    // Check for new personal best
    const isNewRecord = score > personalBest && score > 0;
    const recordBanner = document.getElementById('newRecordBanner');
    if (recordBanner) {
        if (isNewRecord) {
            recordBanner.classList.remove('hidden');
            // Store new best locally too
            const mode = gameMode || 'vanilla';
            const localKey = `puzzle_racer_best_${mode}`;
            localStorage.setItem(localKey, score.toString());
        } else {
            recordBanner.classList.add('hidden');
        }
    }

    // Auto-save for logged-in users (only new personal best)
    if (loggedInUser && isNewRecord) {
        autoSaveScore();
    } else if (loggedInUser) {
        // Score is 0, no need to save
        const nameInput = document.getElementById('playerName');
        if (nameInput) {
            nameInput.value = loggedInUser.realName || loggedInUser.username;
            nameInput.readOnly = true;
            nameInput.style.opacity = '0.7';
        }
    }

    // Render post-solve review
    renderPuzzleReview();
}

// Auto-save score for logged-in users
async function autoSaveScore() {
    const playerName = loggedInUser.realName || loggedInUser.username;

    // Hide the manual save UI for logged-in users
    const nameWrapper = document.getElementById('nameInputWrapper');
    if (nameWrapper) {
        nameWrapper.innerHTML = `
            <span style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.85rem;">
                <i class="fa-solid fa-spinner fa-spin"></i> Ukládám výsledek...
            </span>
        `;
    }

    try {
        const res = await fetch(`${API_URL}/racer/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                score,
                playerName,
                userId: loggedInUser.id,
                mode: gameMode,
                correctCount: gameCorrectCount,
                wrongCount: gameWrongCount,
                maxStreak: gameMaxStreak,
                puzzleCount: gameCorrectCount + gameWrongCount
            })
        });

        if (res.ok) {
            if (nameWrapper) {
                nameWrapper.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 0.5rem; color: #4ade80; font-weight: 600;">
                        <i class="fa-solid fa-circle-check"></i> Výsledek uložen!
                    </span>
                `;
            }
            // Reload leaderboard to show updated results
            loadLeaderboard(currentLeaderboardPeriod);
        } else {
            if (nameWrapper) {
                nameWrapper.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 0.5rem; color: #fca5a5;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Chyba při ukládání
                    </span>
                `;
            }
        }
    } catch (e) {
        console.error('Auto-save failed:', e);
        if (nameWrapper) {
            nameWrapper.innerHTML = `
                <span style="display: flex; align-items: center; gap: 0.5rem; color: #fca5a5;">
                    <i class="fa-solid fa-triangle-exclamation"></i> Chyba připojení
                </span>
            `;
        }
    }
}

// Helper: get the initial FEN (position where player needs to move)
function getInitialFen(puzzleData) {
    try {
        const tempGame = new Chess();
        const gamePgn = puzzleData.game.pgn;
        tempGame.load_pgn(gamePgn);
        const history = tempGame.history({ verbose: true });
        tempGame.reset();
        // Replay up to initialPly + 1 (includes opponent's last move)
        const movesToReplay = (puzzleData.puzzle.initialPly || 0) + 1;
        for (let i = 0; i < movesToReplay && i < history.length; i++) {
            tempGame.move(history[i]);
        }
        return tempGame.fen();
    } catch (e) {
        return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
}

// Render post-solve puzzle review grid
function renderPuzzleReview() {
    const container = document.getElementById('puzzleReviewGrid');
    if (!container || puzzleHistory.length === 0) return;

    const correctCount = puzzleHistory.filter(p => p.correct).length;
    const totalCount = puzzleHistory.length;
    const pct = Math.round((correctCount / totalCount) * 100);

    let html = `
        <div class="review-stats">
            <span class="review-stat correct"><i class="fa-solid fa-check"></i> ${correctCount}</span>
            <span class="review-stat wrong"><i class="fa-solid fa-xmark"></i> ${totalCount - correctCount}</span>
            <span class="review-stat pct">${pct}%</span>
        </div>
        <div class="review-grid">
    `;

    puzzleHistory.forEach((puzzle, idx) => {
        const statusClass = puzzle.correct ? 'review-correct' : 'review-wrong';
        const icon = puzzle.correct ? '✅' : '❌';
        const ratingText = puzzle.rating ? `${puzzle.rating}` : '?';
        html += `
            <div class="review-card ${statusClass}" onclick="showPuzzleDetail(${idx})">
                <div class="review-card-icon">${icon}</div>
                <div class="review-card-num">#${idx + 1}</div>
                <div class="review-card-rating"><i class="fa-solid fa-signal"></i> ${ratingText}</div>
            </div>
        `;
    });

    html += '</div>';
    html += '<div id="puzzleDetailView" class="puzzle-detail hidden"></div>';
    container.innerHTML = html;
    container.classList.remove('hidden');
}

// Show individual puzzle detail with mini board
function showPuzzleDetail(idx) {
    const puzzle = puzzleHistory[idx];
    if (!puzzle) return;

    const detailEl = document.getElementById('puzzleDetailView');
    if (!detailEl) return;

    // Determine player color from FEN
    const fenParts = puzzle.initialFen.split(' ');
    const playerColor = fenParts[1] === 'w' ? 'white' : 'black';

    // Format solution moves using chess.js for proper algebraic notation
    const solutionMoves = (() => {
        try {
            const tempGame = new Chess(puzzle.initialFen);
            return puzzle.solution.map((uci) => {
                const from = uci.substring(0, 2);
                const to = uci.substring(2, 4);
                const promotion = uci.length > 4 ? uci.charAt(4) : undefined;
                const moveObj = tempGame.move({ from, to, promotion });
                if (!moveObj) return uci; // fallback to UCI if move fails
                // Convert English piece letters to Czech: N→J, B→S, R→V, Q→D, K→K
                return moveObj.san
                    .replace(/^N/, 'J')
                    .replace(/^B/, 'S')
                    .replace(/^R/, 'V')
                    .replace(/^Q/, 'D');
            }).join(', ');
        } catch (e) {
            // Fallback: plain UCI
            return puzzle.solution.map(uci => {
                const from = uci.substring(0, 2);
                const to = uci.substring(2, 4);
                return `${from}-${to}`;
            }).join(', ');
        }
    })();

    const statusText = puzzle.correct
        ? '<span style="color: #4ade80;"><i class="fa-solid fa-check-circle"></i> Správně</span>'
        : '<span style="color: #f87171;"><i class="fa-solid fa-times-circle"></i> Chybně</span>';

    detailEl.innerHTML = `
        <div class="puzzle-detail-header">
            <span>${statusText}</span>
            <span style="color: var(--text-muted); font-size: 0.85rem;">Rating: ${puzzle.rating || '?'}</span>
            <button onclick="document.getElementById('puzzleDetailView').classList.add('hidden')" 
                    style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem;">
                <i class="fa-solid fa-times"></i>
            </button>
        </div>
        <div id="reviewBoard" style="width: 280px; max-width: 100%; margin: 0.5rem auto;"></div>
        <div style="text-align: center; margin-top: 0.5rem; color: var(--text-muted); font-size: 0.85rem;">
            <strong>Řešení:</strong> ${solutionMoves}
        </div>
    `;
    detailEl.classList.remove('hidden');

    // Render mini board
    setTimeout(() => {
        Chessboard('reviewBoard', {
            position: puzzle.initialFen,
            orientation: playerColor,
            draggable: false,
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
        });
    }, 50);
}

async function saveScore() {
    let playerName;

    if (loggedInUser) {
        // Registered user: use their real name, no input needed
        playerName = loggedInUser.realName || loggedInUser.username;
    } else {
        // Anonymous: require name from input
        playerName = document.getElementById('playerName')?.value;
        if (!playerName) {
            alert('Zadejte prosím své jméno.');
            return;
        }
    }

    try {
        const headers = { 'Content-Type': 'application/json' };

        const res = await fetch(`${API_URL}/racer/save`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                score,
                playerName,
                userId: loggedInUser ? loggedInUser.id : null,
                mode: gameMode,
                correctCount: gameCorrectCount,
                wrongCount: gameWrongCount,
                maxStreak: gameMaxStreak,
                puzzleCount: gameCorrectCount + gameWrongCount
            })
        });

        if (res.ok) {
            if (!loggedInUser) {
                // Save name for next time (anonymous only)
                localStorage.setItem('puzzle_racer_name', playerName);
            }
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
let leaderboardRegisteredOnly = true;

async function loadLeaderboard(period = 'all') {
    // Detect mode again to be sure (since this runs on init)
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') === 'thematic' ? 'thematic' : 'vanilla';

    try {
        const res = await fetch(`${API_URL}/racer/leaderboard?period=${period}&mode=${mode}&registeredOnly=${leaderboardRegisteredOnly}`);
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

            // Distinguish registered vs anonymous
            const userIcon = entry.isRegistered
                ? '<i class="fa-solid fa-circle-check" style="color: #4ade80; margin-right: 0.3rem;" title="Registrovaný hráč"></i>'
                : '<i class="fa-solid fa-user-secret" style="color: var(--text-muted); margin-right: 0.3rem; opacity: 0.5;" title="Anonymní hráč"></i>';

            // Make registered player names clickable
            const nameHtml = entry.isRegistered && entry.userId
                ? `<a href="#" onclick="showPlayerProfile(${entry.userId}, '${escapeHtml(entry.playerName).replace(/'/g, "\\'")}'); return false;" style="color: inherit; text-decoration: none; border-bottom: 1px dashed rgba(255,255,255,0.3); cursor: pointer;" title="Zobrazit profil hráče">${escapeHtml(entry.playerName)}</a>`
                : escapeHtml(entry.playerName);

            return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 1rem; color: var(--text-muted);">#${index + 1}</td>
                    <td style="padding: 1rem; font-weight: 600;">${medal}${userIcon}${nameHtml}</td>
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

function toggleAnonymousLeaderboard() {
    const toggle = document.getElementById('showAnonymousToggle');
    leaderboardRegisteredOnly = !toggle.checked;
    loadLeaderboard(currentLeaderboardPeriod);
}

// Load Hall of Fame — weekly champions
async function loadHallOfFame() {
    const container = document.getElementById('hallOfFameBody');
    if (!container) return;

    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') === 'thematic' ? 'thematic' : 'vanilla';

    try {
        const res = await fetch(`${API_URL}/racer/hall-of-fame?mode=${mode}`);
        if (!res.ok) throw new Error('Failed');

        const data = await res.json();

        if (data.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">Zatím žádní šampioni. Hraj každý týden a staň se prvním!</p>';
            return;
        }

        const formatDate = (d) => new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });

        container.innerHTML = `<div style="display: flex; flex-wrap: wrap; gap: 0.6rem; justify-content: center;">` +
            data.map((w, i) => {
                const medal = i === 0 ? '👑' : '⭐';
                return `<div style="
                    background: ${i === 0 ? 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.04))' : 'rgba(255,255,255,0.03)'};
                    border: 1px solid ${i === 0 ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'};
                    border-radius: 0.6rem;
                    padding: 0.5rem 0.8rem;
                    min-width: 140px;
                    text-align: center;
                ">
                    <div style="font-size: 0.65rem; color: var(--text-muted); margin-bottom: 0.2rem;">
                        ${formatDate(w.weekStart)} – ${formatDate(w.weekEnd)}
                    </div>
                    <div style="font-weight: 700; color: var(--text-main); font-size: 0.85rem;">
                        ${medal} ${escapeHtml(w.playerName)}
                    </div>
                    <div style="color: #4ade80; font-weight: 600; font-size: 0.8rem;">${w.score} bodů</div>
                </div>`;
            }).join('') +
            '</div>';
    } catch (e) {
        console.error('Hall of fame error:', e);
        container.innerHTML = '<p style="color: var(--text-muted);">Nepodařilo se načíst síň slávy.</p>';
    }
}

// Detect logged-in user from JWT in localStorage
function detectLoggedInUser() {
    try {
        // Check all possible token keys used across the app
        const token = localStorage.getItem('auth_token')
            || localStorage.getItem('authToken')
            || localStorage.getItem('token')
            || sessionStorage.getItem('auth_token');
        if (!token) return null;

        // Decode JWT payload (base64)
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1]));

        // Check expiry
        if (payload.exp && payload.exp * 1000 < Date.now()) return null;

        return {
            id: payload.userId || payload.id,
            username: payload.username,
            realName: payload.realName || payload.real_name,
            role: payload.role
        };
    } catch (e) {
        return null;
    }
}
// Show badge detail tip on click
function showBadgeTip(jsonStr) {
    const b = JSON.parse(jsonStr);
    const tierLabels = { 1: 'Bronze', 2: 'Stříbro', 3: 'Zlato', 4: 'Diamant' };
    const tierEmojis = { 1: '🥉', 2: '🥈', 3: '🥇', 4: '💎' };

    // Remove existing tip
    const existing = document.getElementById('badgeTipOverlay');
    if (existing) existing.remove();

    // Build tiers list
    let tiersHtml = b.tiers.map((t, i) => {
        const earned = i < b.tier;
        const isCurrent = i === b.tier - 1;
        return `<div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0;${isCurrent ? 'font-weight:700;' : ''}">
            <span style="width:1.2rem;text-align:center;">${earned ? '✅' : '⬜'}</span>
            <span>${tierEmojis[t.level] || ''} ${tierLabels[t.level] || ''}</span>
            <span style="color:var(--text-muted);font-size:0.8rem;margin-left:auto;">${t.req}</span>
        </div>`;
    }).join('');

    // Status message
    let statusHtml;
    if (b.tier === 0) {
        statusHtml = `<div style="margin-top:0.6rem;padding:0.5rem;background:rgba(251,191,36,0.1);border-radius:0.4rem;text-align:center;font-size:0.85rem;">
            🎯 <strong>Cíl:</strong> ${b.nextReq || 'Splň první úroveň!'}
        </div>`;
    } else if (b.tier >= b.maxTier) {
        statusHtml = `<div style="margin-top:0.6rem;padding:0.5rem;background:rgba(16,185,129,0.15);border-radius:0.4rem;text-align:center;font-size:0.85rem;color:#4ade80;">
            🏆 <strong>MAX úroveň!</strong> Gratulujeme!
        </div>`;
    } else {
        statusHtml = `<div style="margin-top:0.6rem;padding:0.5rem;background:rgba(251,191,36,0.1);border-radius:0.4rem;text-align:center;font-size:0.85rem;">
            ⬆️ <strong>Další úroveň:</strong> ${b.nextReq}
        </div>`;
    }

    const overlay = document.createElement('div');
    overlay.id = 'badgeTipOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:1rem;';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.innerHTML = `<div style="background:var(--card-bg,#1a1a2e);border:1px solid rgba(255,255,255,0.15);border-radius:0.8rem;padding:1.2rem;max-width:320px;width:100%;color:var(--text-main,#fff);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;">
            <div style="font-size:1.3rem;">${b.icon} <strong>${b.name}</strong></div>
            <button onclick="document.getElementById('badgeTipOverlay').remove();" style="background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer;">✕</button>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.5rem;">Úroveň ${b.tier} / ${b.maxTier}</div>
        ${tiersHtml}
        ${statusHtml}
    </div>`;
    document.body.appendChild(overlay);
}

// Show another player's profile in a modal
async function showPlayerProfile(userId, playerName) {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') === 'thematic' ? 'thematic' : 'vanilla';

    // Create overlay
    let overlay = document.getElementById('playerProfileOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'playerProfileOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:1rem;';
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `<div style="background:var(--card-bg,#1a1a2e);border:1px solid rgba(255,255,255,0.1);border-radius:1rem;padding:1.5rem;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;color:var(--text-main,#fff);">
        <div style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Načítám profil...</div>
    </div>`;

    try {
        const res = await fetch(`${API_URL}/racer/my-stats?userId=${userId}&mode=${mode}`);
        if (!res.ok) throw new Error('Failed');
        const stats = await res.json();

        const tierColors = { 0: 'locked', 1: 'bronze', 2: 'silver', 3: 'gold', 4: 'diamond' };

        // Build badges
        let badgesHtml = '';
        if (stats.badges && stats.badges.length > 0) {
            const totalEarned = stats.badges.reduce((sum, b) => sum + b.tier, 0);
            const totalPossible = stats.badges.reduce((sum, b) => sum + b.maxTier, 0);
            badgesHtml = `<div style="margin-top:1rem;"><div style="text-align:center;font-weight:600;margin-bottom:0.5rem;">🏅 Odznaky ${totalEarned}/${totalPossible}</div>
                <div class="ps-badges-grid">`;
            stats.badges.forEach(b => {
                const tierClass = tierColors[b.tier] || 'locked';
                const tierLabelsMap = { 0: '', 1: 'Bronze', 2: 'Stříbro', 3: 'Zlato', 4: 'Diamant' };
                const tierLabel = b.tier > 0 ? tierLabelsMap[b.tier] : '';
                const currentReq = b.tier > 0 && b.tiers[b.tier - 1] ? b.tiers[b.tier - 1].req : '';
                const nextReq = b.nextReq || '';
                const reqText = b.tier > 0 ? currentReq : nextReq;
                let dotsHtml = '';
                for (let i = 1; i <= b.maxTier; i++) {
                    dotsHtml += `<span class="tier-dot ${i <= b.tier ? 'filled tier-' + tierColors[i] : ''}"></span>`;
                }
                const badgeData = encodeURIComponent(JSON.stringify({
                    name: b.name, icon: b.icon, tier: b.tier, maxTier: b.maxTier,
                    tierLabel, nextReq: b.nextReq, tiers: b.tiers
                }));
                badgesHtml += `<div class="ps-badge tier-${tierClass}" onclick="showBadgeTip(decodeURIComponent('${badgeData}'))" style="cursor:pointer;">
                    <span class="ps-badge-icon">${b.icon}</span>
                    <span class="ps-badge-name">${b.name}</span>
                    <span class="ps-badge-req">${reqText}</span>
                    <div class="ps-badge-dots">${dotsHtml}</div>
                </div>`;
            });
            badgesHtml += '</div></div>';
        }

        // Build top3
        let top3Html = '';
        if (stats.top3 && stats.top3.length > 0) {
            const medals = ['🥇', '🥈', '🥉'];
            top3Html = `<div style="margin-top:0.8rem;border-top:1px solid rgba(255,255,255,0.1);padding-top:0.8rem;">
                <div style="text-align:center;font-weight:600;margin-bottom:0.4rem;">🏅 Top 3</div>`;
            stats.top3.forEach((r, i) => {
                top3Html += `<div style="display:flex;align-items:center;gap:0.5rem;justify-content:center;padding:0.2rem 0;">
                    <span>${medals[i]}</span>
                    <span style="color:#4ade80;font-weight:700;">${r.score}</span>
                    <span style="color:var(--text-muted);font-size:0.8rem;">${new Date(r.date).toLocaleDateString('cs-CZ')}</span>
                </div>`;
            });
            top3Html += '</div>';
        }

        const modal = overlay.querySelector('div');
        modal.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h3 style="margin:0;color:#fbbf24;">👤 ${escapeHtml(playerName)}</h3>
                <button onclick="document.getElementById('playerProfileOverlay').remove();" style="background:none;border:none;color:var(--text-muted);font-size:1.3rem;cursor:pointer;">✕</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;text-align:center;">
                <div style="background:rgba(255,255,255,0.05);border-radius:0.5rem;padding:0.5rem;">
                    <div style="font-size:1.2rem;font-weight:700;">${stats.bestScore}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Nejlepší</div>
                </div>
                <div style="background:rgba(255,255,255,0.05);border-radius:0.5rem;padding:0.5rem;">
                    <div style="font-size:1.2rem;font-weight:700;">${stats.avgScore || '–'}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Průměr</div>
                </div>
                <div style="background:rgba(255,255,255,0.05);border-radius:0.5rem;padding:0.5rem;">
                    <div style="font-size:1.2rem;font-weight:700;">${stats.totalGames}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Her</div>
                </div>
                <div style="background:rgba(255,255,255,0.05);border-radius:0.5rem;padding:0.5rem;">
                    <div style="font-size:1.2rem;font-weight:700;">${stats.avgAccuracy != null ? stats.avgAccuracy + '%' : '–'}</div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">Přesnost</div>
                </div>
            </div>
            ${top3Html}
            ${badgesHtml}
        `;
    } catch (e) {
        console.error('Profile error:', e);
        overlay.querySelector('div').innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
                <h3 style="margin:0;">👤 ${escapeHtml(playerName)}</h3>
                <button onclick="document.getElementById('playerProfileOverlay').remove();" style="background:none;border:none;color:var(--text-muted);font-size:1.3rem;cursor:pointer;">✕</button>
            </div>
            <p style="color:#fca5a5;text-align:center;">Nepodařilo se načíst profil hráče.</p>
        `;
    }
}

// Load and display personal stats for logged-in user
async function loadPersonalStats() {
    if (!loggedInUser) return;

    const statsPanel = document.getElementById('personalStatsPanel');
    if (!statsPanel) return;

    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') === 'thematic' ? 'thematic' : 'vanilla';

    try {
        const res = await fetch(`${API_URL}/racer/my-stats?userId=${loggedInUser.id}&mode=${mode}`);
        if (!res.ok) throw new Error('Failed to fetch stats');

        const stats = await res.json();

        // Store personal best for new record detection
        personalBest = stats.bestScore || 0;

        // Build top 3 list
        let top3Html = '';
        if (stats.top3 && stats.top3.length > 0) {
            top3Html = '<div class="ps-top3"><div class="ps-top3-title">🏅 Top 3</div>';
            stats.top3.forEach((r, i) => {
                const medals = ['🥇', '🥈', '🥉'];
                const dateStr = new Date(r.date).toLocaleDateString('cs-CZ');
                top3Html += `<div class="ps-top3-row">
                    <span class="ps-medal">${medals[i]}</span>
                    <span class="ps-top3-score">${r.score}</span>
                    <span class="ps-top3-date">${dateStr}</span>
                </div>`;
            });
            top3Html += '</div>';
        }

        // Build trend sparkline
        let trendHtml = '';
        if (stats.recentScores && stats.recentScores.length > 1) {
            const scores = stats.recentScores.map(s => s.score).reverse();
            const max = Math.max(...scores, 1);
            trendHtml = '<div class="trend-sparkline">' +
                scores.map(s => `<div class="trend-bar" style="height: ${Math.max(10, (s / max) * 100)}%" title="${s}"></div>`).join('') +
                '</div>';
        }

        // Build badges grid (tiered card system)
        let badgesHtml = '';
        if (stats.badges && stats.badges.length > 0) {
            const tierLabels = { 0: '', 1: 'Bronze', 2: 'Stříbro', 3: 'Zlato', 4: 'Diamant' };
            const tierColors = { 0: 'locked', 1: 'bronze', 2: 'silver', 3: 'gold', 4: 'diamond' };
            const totalEarned = stats.badges.reduce((sum, b) => sum + b.tier, 0);
            const totalPossible = stats.badges.reduce((sum, b) => sum + b.maxTier, 0);

            badgesHtml = `<div class="ps-badges-section">
                <div class="ps-badges-title">🏅 Odznaky <span class="ps-badges-count">${totalEarned}/${totalPossible}</span></div>
                <div class="ps-badges-grid">`;
            stats.badges.forEach(b => {
                const tierClass = tierColors[b.tier] || 'locked';
                const tierLabel = b.tier > 0 ? tierLabels[b.tier] : '';
                // Show current tier requirement or next target
                const currentReq = b.tier > 0 && b.tiers[b.tier - 1] ? b.tiers[b.tier - 1].req : '';
                const nextReq = b.nextReq || '';
                const reqText = b.tier > 0 ? currentReq : nextReq;
                // Tier dots (filled up to current tier)
                let dotsHtml = '';
                for (let i = 1; i <= b.maxTier; i++) {
                    dotsHtml += `<span class="tier-dot ${i <= b.tier ? 'filled tier-' + tierColors[i] : ''}"></span>`;
                }
                const badgeData = encodeURIComponent(JSON.stringify({
                    name: b.name, icon: b.icon, tier: b.tier, maxTier: b.maxTier,
                    tierLabel, nextReq: b.nextReq, tiers: b.tiers
                }));
                badgesHtml += `<div class="ps-badge tier-${tierClass}" onclick="showBadgeTip(decodeURIComponent('${badgeData}'))" style="cursor:pointer;">
                    <span class="ps-badge-icon">${b.icon}</span>
                    <span class="ps-badge-name">${b.name}</span>
                    <span class="ps-badge-req">${reqText}</span>
                    <div class="ps-badge-dots">${dotsHtml}</div>
                </div>`;
            });
            badgesHtml += '</div></div>';
        }

        statsPanel.innerHTML = `
            <div class="personal-stats-row">
                <div class="ps-stat">
                    <span class="ps-icon">🏆</span>
                    <span class="ps-value">${stats.bestScore}</span>
                    <span class="ps-label">Nejlepší</span>
                </div>
                <div class="ps-stat">
                    <span class="ps-icon">📊</span>
                    <span class="ps-value">${stats.avgScore || '–'}</span>
                    <span class="ps-label">Průměr</span>
                </div>
                <div class="ps-stat">
                    <span class="ps-icon">🔥</span>
                    <span class="ps-value">${stats.dayStreak || 0}</span>
                    <span class="ps-label">Dnů v řadě</span>
                </div>
                <div class="ps-stat">
                    <span class="ps-icon">🎯</span>
                    <span class="ps-value">${stats.avgAccuracy != null ? stats.avgAccuracy + '%' : '–'}</span>
                    <span class="ps-label">Přesnost</span>
                </div>
                <div class="ps-stat ps-trend">
                    <span class="ps-label" style="margin-bottom: 0.3rem;">Trend</span>
                    ${trendHtml || '<span style="color: var(--text-muted); font-size: 0.8rem;">–</span>'}
                </div>
            </div>
            <div class="ps-secondary-row">
                <div class="ps-stat-mini">
                    <span class="ps-mini-icon">📅</span>
                    <span class="ps-mini-label">Dnes</span>
                    <span class="ps-mini-value">${stats.bestToday != null ? stats.bestToday : '–'}</span>
                </div>
                <div class="ps-stat-mini">
                    <span class="ps-mini-icon">📆</span>
                    <span class="ps-mini-label">Týden</span>
                    <span class="ps-mini-value">${stats.bestThisWeek != null ? stats.bestThisWeek : '–'}</span>
                </div>
                <div class="ps-stat-mini">
                    <span class="ps-mini-icon">🎮</span>
                    <span class="ps-mini-label">Her</span>
                    <span class="ps-mini-value">${stats.totalGames}</span>
                </div>
                <div class="ps-stat-mini">
                    <span class="ps-mini-icon">⚡</span>
                    <span class="ps-mini-label">Best streak</span>
                    <span class="ps-mini-value">${stats.bestStreak || '–'}</span>
                </div>
            </div>
            ${top3Html}
            ${badgesHtml}
        `;
        statsPanel.classList.remove('hidden');
    } catch (e) {
        console.error('Failed to load personal stats:', e);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // expose functions to window
    window.startRace = startRace;
    window.saveScore = saveScore;
    window.skipPuzzle = skipPuzzle;
    window.switchLeaderboard = switchLeaderboard;
    window.showPuzzleDetail = showPuzzleDetail;

    // Detect logged-in user
    loggedInUser = detectLoggedInUser();

    // Load leaderboard, hall of fame, and player name on init
    loadLeaderboard();
    loadHallOfFame();

    // Auto-fill name from user or localStorage
    if (loggedInUser) {
        // Hide name input, show registered label + save button
        const nameWrapper = document.getElementById('nameInputWrapper');
        if (nameWrapper) {
            const displayName = loggedInUser.realName || loggedInUser.username;
            nameWrapper.innerHTML = `
                <span style="display: flex; align-items: center; gap: 0.5rem; color: #4ade80; font-weight: 600;">
                    <i class="fa-solid fa-circle-check"></i> ${displayName}
                </span>
                <button class="btn-primary" onclick="window.saveScore()">
                    <i class="fa-solid fa-save"></i> Uložit
                </button>
            `;
        }
        // Load personal stats (also sets personalBest)
        loadPersonalStats();
        // Hide anonymous CTA
        const anonCta = document.getElementById('anonCta');
        if (anonCta) anonCta.classList.add('hidden');
    } else {
        const savedName = localStorage.getItem('puzzle_racer_name');
        if (savedName) {
            const nameInput = document.getElementById('playerName');
            if (nameInput) nameInput.value = savedName;
        }
        // Load personal best from localStorage for anonymous users
        const mode = new URLSearchParams(window.location.search).get('mode') === 'thematic' ? 'thematic' : 'vanilla';
        personalBest = parseInt(localStorage.getItem(`puzzle_racer_best_${mode}`)) || 0;
        // Show anonymous CTA
        const anonCta = document.getElementById('anonCta');
        if (anonCta) anonCta.classList.remove('hidden');
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

    // Initialize mode UI on page load
    initModeUI();
});

// Initialize mode indicator UI based on URL parameter
async function initModeUI() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const isThematic = mode === 'thematic';

    // Show correct badge
    const vanillaBadge = document.getElementById('vanillaBadge');
    const thematicBadge = document.getElementById('thematicBadge');
    const modeDesc = document.getElementById('modeDescription');

    // Update Tab UI (Visual Selection)
    if (vanillaBadge) {
        vanillaBadge.style.opacity = isThematic ? '0.5' : '1';
        vanillaBadge.style.boxShadow = isThematic ? 'none' : '0 0 15px rgba(59, 130, 246, 0.5)';
        vanillaBadge.style.transform = isThematic ? 'scale(0.95)' : 'scale(1.05)';
        vanillaBadge.style.transition = 'all 0.3s ease';
    }

    if (thematicBadge) {
        thematicBadge.style.opacity = isThematic ? '1' : '0.5';
        thematicBadge.style.boxShadow = isThematic ? '0 0 15px rgba(236, 72, 153, 0.5)' : 'none';
        thematicBadge.style.transform = isThematic ? 'scale(1.05)' : 'scale(0.95)';
        thematicBadge.style.transition = 'all 0.3s ease';
    }

    // Update description - for thematic mode, fetch and show current settings
    if (modeDesc) {
        if (isThematic) {
            try {
                const res = await fetch(`${API_URL}/racer/settings`);
                if (res.ok) {
                    const settings = await res.json();
                    const themeName = getThemeDisplayName(settings.puzzleTheme || 'mix');
                    const timeMin = Math.floor((settings.timeLimitSeconds || 180) / 60);
                    const timeSec = (settings.timeLimitSeconds || 180) % 60;
                    const timeStr = timeSec > 0 ? `${timeMin}:${String(timeSec).padStart(2, '0')}` : `${timeMin} min`;

                    let descParts = [`Téma: <strong>${themeName}</strong>`, `Čas: <strong>${timeStr}</strong>`];
                    if (settings.livesEnabled) {
                        descParts.push(`Životy: <strong>${settings.maxLives || 3}</strong>`);
                    }
                    if (settings.penaltyEnabled) {
                        descParts.push(`Penalizace: <strong>-${settings.penaltySeconds || 5}s</strong>`);
                    }
                    modeDesc.innerHTML = descParts.join(' • ');
                } else {
                    modeDesc.textContent = 'Tématický mód s nastavením z admin panelu.';
                }
            } catch (e) {
                modeDesc.textContent = 'Tématický mód s nastavením z admin panelu.';
            }
        } else {
            modeDesc.textContent = 'Vyřešte co nejvíce taktických úloh během 3 minut! Obtížnost se postupně zvyšuje.';
        }
    }
}

// Map theme codes to Czech display names
function getThemeDisplayName(theme) {
    const themeNames = {
        'mix': 'Smíšené',
        'opening': 'Zahájení',
        'middlegame': 'Střední hra',
        'endgame': 'Koncovka',
        'rookEndgame': 'Věžová koncovka',
        'bishopEndgame': 'Střelcová koncovka',
        'pawnEndgame': 'Pěšcová koncovka',
        'knightEndgame': 'Jezdcová koncovka',
        'queenEndgame': 'Dámová koncovka'
    };
    return themeNames[theme] || theme;
}
