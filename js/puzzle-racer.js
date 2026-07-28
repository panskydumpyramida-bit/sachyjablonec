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

// Pardubice 2026 - synchronizovaný táborový režim
let campSession = null;
let campAttempt = null;
let campServerOffset = 0;
let campStatePollTimer = null;
let campCountdownTimer = null;
let campLiveStatePollTimer = null;
let campRaceStarting = false;
let campRaceFinished = false;
let campProgressQueue = Promise.resolve();
let currentPuzzleStartedAt = 0;
let currentCampWrongAttempts = 0;
let currentPuzzleWrongMove = null;
let campTimePenaltySeconds = 0;
let puzzlePreviewBoard = null;
let activePuzzlePreview = null;
let puzzlePreviewTimers = [];
let puzzlePreviewRun = 0;

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

function setGameViewportLocked(locked) {
    document.body.classList.toggle('game-active', locked);
    document.documentElement.classList.toggle('game-active', locked);
}

document.addEventListener('touchmove', event => {
    if (document.body.classList.contains('game-active')) event.preventDefault();
}, { passive: false });

// Detect mode from URL parameter
function detectGameMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    gameMode = mode === 'pardubice2026' ? 'pardubice2026' : mode === 'thematic' ? 'thematic' : 'vanilla';
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
    if (gameMode === 'pardubice2026') return;
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
    if (gameMode === 'pardubice2026' && campSession) {
        gameSettings = {
            puzzleTheme: campSession.puzzleTheme,
            timeLimitSeconds: campSession.durationSeconds,
            livesEnabled: campSession.livesEnabled,
            maxLives: campSession.maxLives,
            puzzlesPerDifficulty: Math.max(1, Math.ceil(campSession.puzzleCount / DIFFICULTIES.length)),
            penaltyEnabled: campSession.penaltyEnabled,
            penaltySeconds: campSession.penaltySeconds,
            skipOnMistake: campSession.skipOnMistake
        };
    }
    // Vanilla mode uses fixed defaults (no API call needed)
    else if (gameMode === 'vanilla') {
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
    detectGameMode();
    if (gameMode === 'pardubice2026') {
        return startPuzzleCampRace();
    }

    const startBtn = document.querySelector('#startScreen button');
    const loading = document.getElementById('loadingIndicator');

    startBtn.style.display = 'none';
    loading.classList.remove('hidden');

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
        setGameViewportLocked(true);

        // Otočení/resize během hry: board drží fixní px → bez resize přeteče nebo zmenší mimo layout
        if (!window.__racerResizeHooked) {
            window.__racerResizeHooked = true;
            let rt = null;
            const onRs = () => {
                if (!document.body.classList.contains('game-active')) return;
                clearTimeout(rt);
                rt = setTimeout(() => { if (board && board.resize) board.resize(); }, 120);
            };
            window.addEventListener('resize', onRs);
            window.addEventListener('orientationchange', onRs);
        }

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
    const savedCampResults = gameMode === 'pardubice2026' && Array.isArray(campAttempt?.puzzleResults)
        ? campAttempt.puzzleResults
        : [];
    const answeredCampIndexes = new Set(savedCampResults.map(result => result.puzzleIndex));
    let resumedCampStreak = 0;
    for (const result of [...savedCampResults].sort((a, b) => b.puzzleIndex - a.puzzleIndex)) {
        if (result.correct !== true || result.skipped === true) break;
        resumedCampStreak++;
    }
    const firstUnansweredCampIndex = gameMode === 'pardubice2026'
        ? puzzles.findIndex((puzzle, index) => !answeredCampIndexes.has(index))
        : 0;

    score = gameMode === 'pardubice2026' ? (campAttempt?.correctCount || 0) : 0;
    // timeLeft is already set by loadGameSettings()
    currentPuzzleIndex = gameMode === 'pardubice2026'
        ? (firstUnansweredCampIndex === -1 ? puzzles.length : firstUnansweredCampIndex)
        : 0;
    isGameActive = true;

    // Reset per-game stats
    gameCorrectCount = gameMode === 'pardubice2026' ? (campAttempt?.correctCount || 0) : 0;
    gameWrongCount = gameMode === 'pardubice2026' ? (campAttempt?.wrongCount || 0) : 0;
    currentStreak = gameMode === 'pardubice2026' ? resumedCampStreak : 0;
    gameMaxStreak = gameMode === 'pardubice2026' ? (campAttempt?.maxStreak || 0) : 0;
    puzzleHistory = [];
    campRaceFinished = false;
    campTimePenaltySeconds = gameMode === 'pardubice2026' && campSession?.penaltyEnabled
        ? (campAttempt?.wrongCount || 0) * campSession.penaltySeconds
        : 0;
    clearInterval(campLiveStatePollTimer);

    updateScore();
    updateTimer();
    resetLives(); // Reset lives display

    if (currentPuzzleIndex >= puzzles.length) {
        endGame();
        return;
    }

    // Initialize first puzzle
    loadPuzzle(puzzles[currentPuzzleIndex]);

    // Start timer
    timerInterval = setInterval(() => {
        if (gameMode === 'pardubice2026' && campSession) {
            timeLeft = Math.max(0, Math.ceil((new Date(campSession.endsAt).getTime() - (Date.now() + campServerOffset)) / 1000) - campTimePenaltySeconds);
        } else {
            timeLeft--;
        }
        updateTimer();

        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);

    if (gameMode === 'pardubice2026') {
        campLiveStatePollTimer = setInterval(pollLivePuzzleCampState, 3000);
    }
}

function loadPuzzle(puzzleData) {
    if (!puzzleData) {
        // No puzzle data - wait for fetch (don't end game!)
        console.log('No puzzle data, waiting...');
        setTimeout(loadNextPuzzleOrWait, 300);
        return;
    }

    currentPuzzleStartedAt = performance.now();
    currentCampWrongAttempts = 0;
    currentPuzzleWrongMove = null;
    if (gameMode === 'pardubice2026' && puzzleData.campDifficulty) {
        const campDifficultyIndex = DIFFICULTIES.indexOf(puzzleData.campDifficulty);
        if (campDifficultyIndex >= 0) currentDifficultyIndex = campDifficultyIndex;
        updateDifficultyDisplay();
    }

    // Prefetch more puzzles when we're getting low (when loading puzzle and only 5 left)
    const puzzlesRemaining = puzzles.length - currentPuzzleIndex;
    if (gameMode !== 'pardubice2026' && puzzlesRemaining <= 5 && !isFetchingPuzzles) {
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
        // board se kreslí dřív, než sedne fullscreen layout (game-active) → bez resize přetejkal viewport
        requestAnimationFrame(() => { if (board && board.resize) board.resize(); });
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

        handleWrongMove(uciMove);
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
        const historyEntry = {
            fen: game.fen(),
            initialFen: getInitialFen(currentPuzzle),
            solution: currentPuzzle.puzzle.solution,
            rating: currentPuzzle.puzzle.rating,
            puzzleId: currentPuzzle.puzzle.id,
            correct: true,
            skipped: false,
            responseMs: Math.max(0, Math.round(performance.now() - currentPuzzleStartedAt)),
            wrongAttempts: currentCampWrongAttempts,
            wrongMove: currentPuzzleWrongMove
        };
        const previousEntry = gameMode === 'pardubice2026'
            ? puzzleHistory.find(entry => entry.puzzleId === currentPuzzle.puzzle.id)
            : null;
        if (previousEntry) Object.assign(previousEntry, historyEntry);
        else puzzleHistory.push(historyEntry);

        if (gameMode === 'pardubice2026') {
            reportCampPuzzleOutcome(currentPuzzleIndex, historyEntry);
        }
    }
    showFeedback('correct');

    if (gameMode === 'pardubice2026' && currentPuzzleIndex >= puzzles.length - 1) {
        setTimeout(endGame, 350);
        return;
    }

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
    if (gameMode !== 'pardubice2026' && puzzlesRemaining <= 2 && !isFetchingPuzzles) {
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
    if (gameMode === 'pardubice2026') {
        endGame();
        return;
    }
    isGameActive = false;
    clearInterval(timerInterval);
    setGameViewportLocked(false);

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
        if (gameMode === 'pardubice2026') {
            endGame();
            return;
        }
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

function handleWrongMove(wrongMove = null) {
    mistakeCount++;
    gameWrongCount++;
    if (gameMode === 'pardubice2026') currentCampWrongAttempts++;
    if (!currentPuzzleWrongMove && wrongMove) currentPuzzleWrongMove = wrongMove;
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
                correct: false,
                skipped: false,
                responseMs: Math.max(0, Math.round(performance.now() - currentPuzzleStartedAt)),
                wrongAttempts: currentCampWrongAttempts,
                wrongMove: currentPuzzleWrongMove
            });
        }
    }

    // Check if lives system is enabled and we're out of lives
    if (livesEnabled && mistakeCount >= MAX_MISTAKES) {
        if (gameMode === 'pardubice2026' && currentPuzzle) {
            reportCampPuzzleOutcome(currentPuzzleIndex, {
                puzzleId: currentPuzzle.puzzle.id,
                correct: false,
                skipped: false,
                responseMs: Math.max(0, Math.round(performance.now() - currentPuzzleStartedAt)),
                wrongAttempts: currentCampWrongAttempts,
                wrongMove: currentPuzzleWrongMove
            });
        }
        setTimeout(() => {
            endGame();
        }, 500);
        return;
    }

    // Apply time penalty if enabled
    if (penaltyEnabled) {
        if (gameMode === 'pardubice2026') campTimePenaltySeconds += penaltySeconds;
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
        if (gameMode === 'pardubice2026' && currentPuzzle) {
            reportCampPuzzleOutcome(currentPuzzleIndex, {
                puzzleId: currentPuzzle.puzzle.id,
                correct: false,
                skipped: false,
                responseMs: Math.max(0, Math.round(performance.now() - currentPuzzleStartedAt)),
                wrongAttempts: currentCampWrongAttempts,
                wrongMove: currentPuzzleWrongMove
            });
        }
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
    mistakeCount = gameMode === 'pardubice2026' ? (campAttempt?.wrongCount || 0) : 0;
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
    const currentPuzzle = puzzles[currentPuzzleIndex];
    if (gameMode === 'pardubice2026' && currentPuzzle) {
        const entry = {
            fen: game?.fen(),
            initialFen: getInitialFen(currentPuzzle),
            solution: currentPuzzle.puzzle.solution,
            rating: currentPuzzle.puzzle.rating,
            puzzleId: currentPuzzle.puzzle.id,
            correct: false,
            skipped: true,
            responseMs: Math.max(0, Math.round(performance.now() - currentPuzzleStartedAt)),
            wrongAttempts: currentCampWrongAttempts,
            wrongMove: currentPuzzleWrongMove
        };
        const previousEntry = puzzleHistory.find(item => item.puzzleId === entry.puzzleId);
        if (previousEntry) Object.assign(previousEntry, entry);
        else puzzleHistory.push(entry);
        reportCampPuzzleOutcome(currentPuzzleIndex, entry);
    } else {
        timeLeft = Math.max(0, timeLeft - 5);
    }
    updateTimer();
    currentPuzzleIndex++;
    loadNextPuzzleOrWait();
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
    if (gameMode === 'pardubice2026' && campRaceFinished) return;
    if (gameMode === 'pardubice2026') campRaceFinished = true;
    isGameActive = false;
    clearInterval(timerInterval);
    clearInterval(campLiveStatePollTimer);

    if (gameMode === 'pardubice2026') {
        const currentPuzzle = puzzles[currentPuzzleIndex];
        const alreadyReported = currentPuzzle && puzzleHistory.some(entry => entry.puzzleId === currentPuzzle.puzzle.id && (entry.correct || entry.skipped));
        if (currentPuzzle && !alreadyReported) {
            const entry = {
                fen: game?.fen(),
                initialFen: getInitialFen(currentPuzzle),
                solution: currentPuzzle.puzzle.solution,
                rating: currentPuzzle.puzzle.rating,
                puzzleId: currentPuzzle.puzzle.id,
                correct: false,
                skipped: false,
                responseMs: Math.max(0, Math.round(performance.now() - currentPuzzleStartedAt)),
                wrongAttempts: currentCampWrongAttempts,
                wrongMove: currentPuzzleWrongMove
            };
            const existingEntry = puzzleHistory.find(item => item.puzzleId === entry.puzzleId);
            if (existingEntry) Object.assign(existingEntry, entry);
            else puzzleHistory.push(entry);
            reportCampPuzzleOutcome(currentPuzzleIndex, entry);
        }
    }

    // Unlock scroll
    setGameViewportLocked(false);

    document.getElementById('gameInterface').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.remove('hidden');
    document.getElementById('finalScore').innerText = score;

    const gameOverTitle = document.getElementById('gameOverTitle');
    const gameOverActionButton = document.getElementById('gameOverActionButton');
    if (gameOverTitle) gameOverTitle.textContent = gameMode === 'pardubice2026' ? 'Rozcvička dokončena' : 'Konec hry!';
    if (gameOverActionButton) {
        gameOverActionButton.classList.toggle('camp-return-button', gameMode === 'pardubice2026');
        gameOverActionButton.innerHTML = gameMode === 'pardubice2026'
            ? '<i class="fa-solid fa-arrow-left"></i> Zpět na přehled soustředění'
            : '<i class="fa-solid fa-rotate-right"></i> Hrát znovu';
    }

    if (gameMode === 'pardubice2026') {
        const recordBanner = document.getElementById('newRecordBanner');
        const nameWrapper = document.getElementById('nameInputWrapper');
        if (recordBanner) recordBanner.classList.add('hidden');
        if (nameWrapper) nameWrapper.classList.add('hidden');
        renderPuzzleReview();
        finishCampAttempt();
        return;
    }

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

    // Auto-save for logged-in users (every game with score > 0)
    if (loggedInUser && score > 0) {
        autoSaveScore(isNewRecord);
    } else if (loggedInUser) {
        // Score is 0, hide save UI completely
        const nameWrapper = document.getElementById('nameInputWrapper');
        if (nameWrapper) nameWrapper.classList.add('hidden');
    }

    // Render post-solve review
    renderPuzzleReview();
}

function handleGameOverAction() {
    if (gameMode !== 'pardubice2026') {
        location.reload();
        return;
    }

    document.getElementById('gameOverScreen')?.classList.add('hidden');
    document.getElementById('startScreen')?.classList.remove('hidden');
    renderCampLobby();
    loadPuzzleCampState();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Auto-save score for logged-in users (every game, not just records)
async function autoSaveScore(isNewRecord = false) {
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
            const savedMsg = isNewRecord
                ? '<i class="fa-solid fa-trophy" style="color: #fbbf24;"></i> Nový rekord uložen!'
                : '<i class="fa-solid fa-circle-check"></i> Výsledek uložen';
            if (nameWrapper) {
                nameWrapper.innerHTML = `
                    <span style="display: flex; align-items: center; gap: 0.5rem; color: #4ade80; font-weight: 600;">
                        ${savedMsg}
                    </span>
                `;
            }
            // Reload leaderboard and personal stats to show updated results
            loadLeaderboard(currentLeaderboardPeriod);
            loadPersonalStats();
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
    container.innerHTML = html;
    container.classList.remove('hidden');
}

function showPuzzleDetail(idx) {
    const puzzle = puzzleHistory[idx];
    if (!puzzle) return;
    openPuzzlePreview({ ...puzzle, number: idx + 1 });
}

function translateSan(san) {
    return String(san || '')
        .replace(/^N/, 'J')
        .replace(/^B/, 'S')
        .replace(/^R/, 'V')
        .replace(/^Q/, 'D');
}

function describeUciMove(initialFen, uci) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci || '')) return String(uci || '—');
    try {
        const previewGame = new Chess(initialFen);
        const move = previewGame.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.slice(4) || undefined
        });
        if (move) return `${translateSan(move.san)} (${uci.slice(0, 2)}–${uci.slice(2, 4)})`;
    } catch (error) {
        // UCI souřadnice níže zůstanou čitelné i u neúplné pozice.
    }
    return `${uci.slice(0, 2)}–${uci.slice(2, 4)}`;
}

function describeSolution(initialFen, solution) {
    try {
        const previewGame = new Chess(initialFen);
        return solution.map((uci, index) => {
            const move = previewGame.move({
                from: uci.slice(0, 2),
                to: uci.slice(2, 4),
                promotion: uci.slice(4) || undefined
            });
            return { index, uci, label: move ? translateSan(move.san) : `${uci.slice(0, 2)}–${uci.slice(2, 4)}` };
        });
    } catch (error) {
        return solution.map((uci, index) => ({ index, uci, label: `${uci.slice(0, 2)}–${uci.slice(2, 4)}` }));
    }
}

function clearPuzzlePreviewAnimation() {
    puzzlePreviewRun++;
    puzzlePreviewTimers.forEach(clearTimeout);
    puzzlePreviewTimers = [];
}

function markPuzzlePreviewMove(uci, type) {
    const boardEl = document.getElementById('puzzlePreviewBoard');
    if (!boardEl) return;
    boardEl.querySelectorAll('.square-55d63').forEach(square => {
        square.classList.remove('preview-square--wrong', 'preview-square--solution');
    });
    [uci?.slice(0, 2), uci?.slice(2, 4)].forEach(square => {
        if (square) boardEl.querySelector(`.square-${square}`)?.classList.add(`preview-square--${type}`);
    });
}

function setPuzzlePreviewPhase(html, type = '') {
    const phase = document.getElementById('puzzlePreviewPhase');
    if (!phase) return;
    phase.className = `puzzle-preview-phase ${type ? `puzzle-preview-phase--${type}` : ''}`;
    phase.innerHTML = html;
}

function playPuzzlePreview() {
    if (!activePuzzlePreview || !puzzlePreviewBoard) return;
    clearPuzzlePreviewAnimation();
    const run = puzzlePreviewRun;
    const preview = activePuzzlePreview;
    puzzlePreviewBoard.position(preview.initialFen, false);
    markPuzzlePreviewMove(null, 'solution');
    document.getElementById('puzzlePreviewFinish')?.classList.remove('is-visible', 'is-success');
    document.querySelectorAll('.puzzle-preview-move').forEach(chip => chip.classList.remove('is-active'));
    setPuzzlePreviewPhase('<i class="fa-solid fa-eye"></i> Prohlédněte si výchozí pozici', 'neutral');

    const later = (delay, callback) => {
        puzzlePreviewTimers.push(setTimeout(() => {
            if (run === puzzlePreviewRun) callback();
        }, delay));
    };

    let delay = 1400;
    if (preview.wrongMove) {
        later(delay, () => {
            puzzlePreviewBoard.move(`${preview.wrongMove.slice(0, 2)}-${preview.wrongMove.slice(2, 4)}`);
            markPuzzlePreviewMove(preview.wrongMove, 'wrong');
            setPuzzlePreviewPhase(`<i class="fa-solid fa-xmark"></i> Chybný tah: <strong>${escapeHtml(describeUciMove(preview.initialFen, preview.wrongMove))}</strong>`, 'wrong');
        });
        delay += 1400;
        later(delay, () => {
            puzzlePreviewBoard.position(preview.initialFen, false);
            markPuzzlePreviewMove(null, 'solution');
            setPuzzlePreviewPhase('<i class="fa-solid fa-lightbulb"></i> Správné řešení', 'solution');
        });
        delay += 700;
    } else {
        later(delay, () => setPuzzlePreviewPhase('<i class="fa-solid fa-lightbulb"></i> Správné řešení', 'solution'));
        delay += 450;
    }

    preview.solution.forEach((uci, index) => {
        later(delay, () => {
            puzzlePreviewBoard.move(`${uci.slice(0, 2)}-${uci.slice(2, 4)}`);
            markPuzzlePreviewMove(uci, 'solution');
            document.querySelectorAll('.puzzle-preview-move').forEach(chip => chip.classList.toggle('is-active', Number(chip.dataset.index) === index));
        });
        delay += 850;
    });

    later(delay, () => {
        document.querySelectorAll('.puzzle-preview-move').forEach(chip => chip.classList.remove('is-active'));
        const finish = document.getElementById('puzzlePreviewFinish');
        if (!finish) return;
        finish.classList.add('is-visible');
        if (preview.correct === true) {
            finish.classList.add('is-success');
            finish.innerHTML = '<i class="fa-solid fa-check"></i>';
            setPuzzlePreviewPhase('<i class="fa-solid fa-circle-check"></i> Úloha vyřešena', 'correct');
        } else {
            finish.innerHTML = '<i class="fa-solid fa-lightbulb"></i>';
            setPuzzlePreviewPhase('<i class="fa-solid fa-lightbulb"></i> Takto vypadá správné řešení', 'solution');
        }
    });
}

function openPuzzlePreview(preview) {
    const modal = document.getElementById('puzzlePreviewModal');
    const content = document.getElementById('puzzlePreviewContent');
    if (!modal || !content || !preview?.initialFen || !Array.isArray(preview.solution)) return;
    clearPuzzlePreviewAnimation();
    activePuzzlePreview = preview;
    if (puzzlePreviewBoard?.destroy) puzzlePreviewBoard.destroy();

    const moves = describeSolution(preview.initialFen, preview.solution);
    const statusClass = preview.correct === true ? 'correct' : preview.skipped ? 'skipped' : preview.correct === false ? 'wrong' : 'solution';
    const statusLabel = preview.correct === true
        ? (preview.wrongMove ? 'Vyřešeno po opravě' : 'Správně')
        : preview.skipped ? 'Přeskočeno' : preview.correct === false ? 'Nevyřešeno' : 'Náhled úlohy';
    const player = preview.playerName ? `<span><i class="fa-solid fa-user"></i> ${escapeHtml(preview.playerName)}</span>` : '';
    const response = preview.responseMs ? `<span><i class="fa-solid fa-stopwatch"></i> ${campFormatSeconds(preview.responseMs)}</span>` : '';
    const wrong = preview.wrongMove ? `
        <div class="puzzle-preview-wrong">
            <span>Váš chybný tah</span>
            <strong>${escapeHtml(describeUciMove(preview.initialFen, preview.wrongMove))}</strong>
        </div>` : '';

    content.innerHTML = `
        <div class="puzzle-preview-heading">
            <div>
                <span class="puzzle-preview-kicker">Úloha ${preview.number ? `#${preview.number}` : ''}</span>
                <h2 id="puzzlePreviewTitle">Rozbor pozice</h2>
            </div>
            <span class="puzzle-preview-status puzzle-preview-status--${statusClass}">${statusLabel}</span>
        </div>
        <div class="puzzle-preview-meta">${player}${response}<span><i class="fa-solid fa-signal"></i> ${preview.rating || '–'}</span></div>
        <div class="puzzle-preview-layout">
            <div class="puzzle-preview-board-wrap">
                <div id="puzzlePreviewBoard"></div>
                <div id="puzzlePreviewFinish" class="puzzle-preview-finish"></div>
            </div>
            <div class="puzzle-preview-analysis">
                <div id="puzzlePreviewPhase" class="puzzle-preview-phase"></div>
                ${wrong}
                <div class="puzzle-preview-line">
                    <span>Správná varianta</span>
                    <div>${moves.map(move => `<b class="puzzle-preview-move" data-index="${move.index}">${move.index + 1}. ${escapeHtml(move.label)}</b>`).join('')}</div>
                </div>
                <button type="button" class="puzzle-preview-replay" onclick="window.playPuzzlePreview()"><i class="fa-solid fa-rotate-right"></i> Přehrát rozbor</button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    document.body.classList.add('puzzle-preview-open');
    puzzlePreviewBoard = Chessboard('puzzlePreviewBoard', {
        position: preview.initialFen,
        orientation: preview.initialFen.split(' ')[1] === 'w' ? 'white' : 'black',
        draggable: false,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    });
    requestAnimationFrame(() => puzzlePreviewBoard?.resize());
    playPuzzlePreview();
}

function closePuzzlePreview(event) {
    if (event && event.target !== event.currentTarget) return;
    clearPuzzlePreviewAnimation();
    document.getElementById('puzzlePreviewModal')?.classList.add('hidden');
    document.body.classList.remove('puzzle-preview-open');
    activePuzzlePreview = null;
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
                const weekLabel = w.weekNum
                    ? `Týden ${w.weekNum} · Po–Ne`
                    : 'Po–Ne';
                return `<div style="
                    background: ${i === 0 ? 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.04))' : 'rgba(255,255,255,0.03)'};
                    border: 1px solid ${i === 0 ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'};
                    border-radius: 0.6rem;
                    padding: 0.5rem 0.8rem;
                    min-width: 140px;
                    text-align: center;
                ">
                    <div style="font-size: 0.58rem; color: var(--text-muted); opacity: 0.75; letter-spacing: 0.04em; text-transform: uppercase;">
                        ${weekLabel}
                    </div>
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

// --- PARDUBICE 2026 · SYNCHRONIZOVANÁ ROZCVIČKA ---

function getRacerAuthToken() {
    return localStorage.getItem('auth_token')
        || localStorage.getItem('authToken')
        || localStorage.getItem('token')
        || sessionStorage.getItem('auth_token');
}

function campAuthHeaders(json = false) {
    const headers = { 'Authorization': `Bearer ${getRacerAuthToken() || ''}` };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
}

function formatCampClock(milliseconds) {
    const secondsTotal = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(secondsTotal / 60);
    const seconds = secondsTotal % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function setCampLobbyElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function renderCampLobby() {
    const lobby = document.getElementById('campLobby');
    const countdown = document.getElementById('campCountdown');
    const joinButton = document.getElementById('campJoinButton');
    const joinedBadge = document.getElementById('campJoinedBadge');
    const loginLink = document.getElementById('campLoginLink');
    if (!lobby || !countdown || !joinButton || !joinedBadge || !loginLink) return;

    lobby.classList.remove('hidden');
    joinButton.classList.add('hidden');
    joinedBadge.classList.add('hidden');
    loginLink.classList.add('hidden');
    countdown.classList.add('hidden');
    joinButton.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Připojit se k rozcvičce';
    joinedBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Jste na startovní listině';

    if (!loggedInUser) {
        setCampLobbyElement('campLobbyStatus', 'Pouze pro přihlášené');
        setCampLobbyElement('campLobbyTitle', 'Pardubice 2026');
        setCampLobbyElement('campLobbyMessage', 'Přihlaste se klubovým účtem. Pak uvidíte společný odpočet, denní výsledky i celotýdenní pořadí.');
        loginLink.classList.remove('hidden');
        return;
    }

    if (!campSession) {
        setCampLobbyElement('campLobbyStatus', 'Čekáme na trenéra');
        setCampLobbyElement('campLobbyTitle', 'Další rozcvička zatím není připravená');
        setCampLobbyElement('campLobbyMessage', 'Až trenér v administraci spustí denní rozcvičku, objeví se zde společný odpočet.');
        return;
    }

    setCampLobbyElement('campLobbyTitle', campSession.title);
    setCampLobbyElement('campLobbyPlayers', campSession.participantCount || 0);
    setCampLobbyElement('campLobbyPuzzles', campSession.puzzleCount);
    setCampLobbyElement('campLobbyDuration', formatCampClock(campSession.durationSeconds * 1000));

    if (campSession.status === 'makeup_ready') {
        setCampLobbyElement('campLobbyStatus', 'Náhradní termín povolen');
        setCampLobbyElement('campLobbyMessage', `Trenér vám zpřístupnil původní sadu. Čas ${formatCampClock(campSession.durationSeconds * 1000)} se spustí až po stisknutí tlačítka.`);
        joinButton.innerHTML = '<i class="fa-solid fa-play"></i> Spustit náhradní rozcvičku';
        joinButton.classList.remove('hidden');
    } else if (campSession.status === 'makeup_live') {
        setCampLobbyElement('campLobbyStatus', 'Náhradní rozcvička běží');
        setCampLobbyElement('campLobbyMessage', 'Hrajete stejnou sadu jako ostatní. Váš osobní čas už běží.');
        joinedBadge.innerHTML = '<i class="fa-solid fa-user-clock"></i> Individuální dohrání';
        joinedBadge.classList.remove('hidden');
        countdown.classList.remove('hidden');
    } else if (campSession.status === 'scheduled') {
        setCampLobbyElement('campLobbyStatus', 'Čekárna otevřena');
        setCampLobbyElement('campLobbyMessage', campAttempt
            ? 'Jste připojeni. Nechte stránku otevřenou — šachovnice se všem spustí automaticky.'
            : `Připojte se na startovní listinu. Všichni dostanou stejných ${campSession.puzzleCount} úloh a stejný čas.`);
        countdown.classList.remove('hidden');
        if (campAttempt) joinedBadge.classList.remove('hidden');
        else joinButton.classList.remove('hidden');
    } else if (campSession.status === 'live') {
        setCampLobbyElement('campLobbyStatus', 'Rozcvička právě běží');
        setCampLobbyElement('campLobbyMessage', campAttempt?.status === 'finished'
            ? 'Dnešní jízdu už máte za sebou. Podívejte se na průběžné pořadí.'
            : 'Start už proběhl. Můžete se ještě přidat, ale poběží vám jen společný zbývající čas.');
        countdown.classList.remove('hidden');
        if (campAttempt?.status === 'finished') joinedBadge.classList.remove('hidden');
        else if (campAttempt) joinedBadge.classList.remove('hidden');
        else joinButton.classList.remove('hidden');
    } else {
        setCampLobbyElement('campLobbyStatus', 'Dnešní rozcvička skončila');
        setCampLobbyElement('campLobbyMessage', campAttempt
            ? 'Výsledek je uložený. Níže vidíte celotýdenní pořadí i časy u každé úlohy.'
            : 'Dnešní start už je uzavřený. Další šance bude při příští rozcvičce.');
        if (campAttempt) joinedBadge.classList.remove('hidden');
    }

    tickCampCountdown();
}

function tickCampCountdown() {
    if (!campSession) return;
    const now = Date.now() + campServerOffset;
    const value = document.getElementById('campCountdownValue');
    const label = document.querySelector('#campCountdown .camp-countdown__label');
    const pulse = document.getElementById('campCountdownPulse');
    if (!value || !label || !pulse) return;

    if (campSession.status === 'scheduled') {
        const remaining = new Date(campSession.startsAt).getTime() - now;
        label.textContent = 'Hromadný start za';
        value.textContent = formatCampClock(remaining);
        pulse.innerHTML = '<i class="fa-solid fa-circle"></i> čekárna otevřena';
        if (remaining <= 0 && campAttempt && !campRaceStarting && !isGameActive) loadPuzzleCampState();
    } else if (campSession.status === 'live' || campSession.status === 'makeup_live') {
        const remaining = new Date(campSession.endsAt).getTime() - now;
        label.textContent = campSession.status === 'makeup_live' ? 'Váš čas do konce' : 'Do konce zbývá';
        value.textContent = formatCampClock(remaining);
        pulse.innerHTML = `<i class="fa-solid fa-circle"></i> ${campSession.status === 'makeup_live' ? 'náhradní termín běží' : 'závod běží'}`;
        if (remaining <= 0 && isGameActive) endGame();
    }
}

function scheduleCampStatePoll() {
    clearTimeout(campStatePollTimer);
    if (gameMode !== 'pardubice2026' || isGameActive) return;
    campStatePollTimer = setTimeout(loadPuzzleCampState, 3000);
}

async function pollLivePuzzleCampState() {
    if (!isGameActive || gameMode !== 'pardubice2026' || !campSession) return;
    const playingSessionId = campSession.id;

    try {
        const res = await fetch(`${API_URL}/racer/camp/active`, { headers: campAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        campServerOffset = new Date(data.serverTime).getTime() - Date.now();
        if (!data.session || data.session.id !== playingSessionId || !['live', 'makeup_live'].includes(data.session.status)) {
            endGame();
        }
    } catch (error) {
        console.warn('Camp live state check failed:', error);
    }
}

async function loadPuzzleCampState() {
    if (gameMode !== 'pardubice2026') return;
    if (!loggedInUser) {
        renderCampLobby();
        return;
    }

    try {
        const res = await fetch(`${API_URL}/racer/camp/active`, { headers: campAuthHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        campServerOffset = new Date(data.serverTime).getTime() - Date.now();
        campSession = data.session ? { ...data.session, participantCount: data.participantCount } : null;
        campAttempt = data.attempt;
        renderCampLobby();

        clearInterval(campCountdownTimer);
        campCountdownTimer = setInterval(tickCampCountdown, 250);

        if (['live', 'makeup_live'].includes(campSession?.status) && campAttempt && campAttempt.status !== 'finished' && !isGameActive) {
            await startPuzzleCampRace();
        }
        if (!puzzleCampLeaderboardData || campSession?.status === 'finished') {
            loadPuzzleCampLeaderboard(selectedPuzzleCampSessionId || campSession?.id);
        }
    } catch (error) {
        console.error('Camp state error:', error);
        setCampLobbyElement('campLobbyStatus', 'Spojení přerušeno');
        setCampLobbyElement('campLobbyMessage', 'Zkouším znovu načíst společný čas ze serveru…');
    } finally {
        scheduleCampStatePoll();
    }
}

async function joinPuzzleCamp() {
    const button = document.getElementById('campJoinButton');
    if (!campSession || !loggedInUser || !button) return;
    const original = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${campSession.status === 'makeup_ready' ? 'Spouštím…' : 'Připojuji…'}`;

    try {
        if (campSession.status === 'makeup_ready') {
            await startPuzzleCampRace();
            return;
        }
        const res = await fetch(`${API_URL}/racer/camp/sessions/${campSession.id}/join`, {
            method: 'POST',
            headers: campAuthHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Připojení se nezdařilo');
        campServerOffset = new Date(data.serverTime).getTime() - Date.now();
        campSession = { ...data.session, participantCount: data.participantCount };
        campAttempt = data.attempt;
        renderCampLobby();
        if (['live', 'makeup_live'].includes(campSession.status)) await startPuzzleCampRace();
    } catch (error) {
        alert(error.message);
    } finally {
        button.disabled = false;
        button.innerHTML = original;
    }
}

async function startPuzzleCampRace() {
    if (campRaceStarting || isGameActive || !campSession || !loggedInUser || campAttempt?.status === 'finished') return;
    campRaceStarting = true;
    clearTimeout(campStatePollTimer);

    const joinButton = document.getElementById('campJoinButton');
    const loading = document.getElementById('loadingIndicator');
    if (joinButton) joinButton.classList.add('hidden');
    if (loading) {
        loading.classList.remove('hidden');
        loading.querySelector('p').textContent = 'Načítám společnou pardubickou sadu…';
    }

    try {
        const res = await fetch(`${API_URL}/racer/camp/sessions/${campSession.id}/play`, {
            headers: campAuthHeaders()
        });
        const data = await res.json();
        if (!res.ok) {
            if (res.status === 425) {
                campRaceStarting = false;
                return loadPuzzleCampState();
            }
            throw new Error(data.error || 'Společnou sadu se nepodařilo načíst');
        }

        campServerOffset = new Date(data.serverTime).getTime() - Date.now();
        campSession = { ...data.session, participantCount: campSession.participantCount };
        campAttempt = data.attempt;
        puzzles = data.puzzles || [];
        if (!puzzles.length) throw new Error('Společná sada je prázdná');

        await loadGameSettings();
        timeLeft = Math.max(0, Math.ceil((new Date(campSession.endsAt).getTime() - (Date.now() + campServerOffset)) / 1000));
        currentPuzzleIndex = 0;
        currentDifficultyIndex = 0;
        totalPuzzlesSolved = 0;
        puzzleHistory = [];

        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameInterface').classList.remove('hidden');
        setGameViewportLocked(true);
        document.getElementById('campLiveRankBox')?.classList.remove('hidden');
        renderCampLivePulse();
        const scoreLabel = document.querySelector('#score')?.previousElementSibling;
        if (scoreLabel) scoreLabel.textContent = 'Vyřešeno';
        setCampLobbyElement('skipButtonLabel', 'Přeskočit úlohu');

        if (!window.__racerResizeHooked) {
            window.__racerResizeHooked = true;
            let resizeTimer = null;
            const resizeBoard = () => {
                if (!document.body.classList.contains('game-active')) return;
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => { if (board?.resize) board.resize(); }, 120);
            };
            window.addEventListener('resize', resizeBoard);
            window.addEventListener('orientationchange', resizeBoard);
        }

        updateLivesUI();
        updateDifficultyDisplay();
        clearInterval(campCountdownTimer);
        startGameLoop();
    } catch (error) {
        console.error('Camp start error:', error);
        alert(error.message);
        if (loading) loading.classList.add('hidden');
        scheduleCampStatePoll();
    } finally {
        campRaceStarting = false;
    }
}

async function saveCampPuzzleOutcome(puzzleIndex, result) {
    let lastError = null;
    for (let retry = 0; retry < 3; retry++) {
        try {
            const res = await fetch(`${API_URL}/racer/camp/sessions/${campSession.id}/progress`, {
                method: 'PUT',
                headers: campAuthHeaders(true),
                body: JSON.stringify({
                    puzzleIndex,
                    puzzleId: result.puzzleId,
                    correct: result.correct === true,
                    skipped: result.skipped === true,
                    wrongAttempts: result.wrongAttempts || 0,
                    wrongMove: result.wrongMove || null,
                    responseMs: result.responseMs || 0
                })
            });
            if (res.ok) return res.json();
            const data = await res.json().catch(() => ({}));
            lastError = new Error(data.error || 'Průběžný výsledek se nepodařilo uložit');
            if (res.status < 500 && res.status !== 429) throw lastError;
        } catch (error) {
            lastError = error;
        }
        if (retry < 2) await new Promise(resolve => setTimeout(resolve, 400 * (retry + 1)));
    }
    throw lastError || new Error('Průběžný výsledek se nepodařilo uložit');
}

function reportCampPuzzleOutcome(puzzleIndex, result) {
    if (!campSession || !loggedInUser) return campProgressQueue;
    campProgressQueue = campProgressQueue.catch(() => null).then(async () => {
        const data = await saveCampPuzzleOutcome(puzzleIndex, result);
        campAttempt = data.attempt;
        setCampLobbyElement('campLiveRank', `#${data.rank}`);
        renderCampLivePulse(data.leader);
        return data;
    }).catch(error => {
        console.error('Camp progress save error:', error);
        return null;
    });
    return campProgressQueue;
}

async function finishCampAttempt() {
    const summary = document.getElementById('campFinishSummary');
    if (summary) {
        summary.classList.remove('hidden');
        summary.innerHTML = '<div style="grid-column:1/-1"><strong><i class="fa-solid fa-spinner fa-spin"></i></strong><span>Ukládám výsledky</span></div>';
    }

    try {
        await campProgressQueue;
        const res = await fetch(`${API_URL}/racer/camp/sessions/${campSession.id}/finish`, {
            method: 'POST',
            headers: campAuthHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Výsledek se nepodařilo uložit');
        campAttempt = data.attempt;
        document.getElementById('finalScore').textContent = `${campAttempt.score} bodů`;
        if (summary) {
            const achievements = (data.achievements || []).map(item => `
                <span class="camp-achievement" title="${escapeHtml(item.description)}"><b>${item.icon}</b>${escapeHtml(item.name)}</span>
            `).join('');
            summary.innerHTML = `
                <div><strong>${campAttempt.correctCount}</strong><span>vyřešeno</span></div>
                <div><strong>${campAttempt.maxStreak}</strong><span>nejdelší série</span></div>
                <div><strong>${campAttempt.wrongCount}</strong><span>chybné tahy</span></div>
                ${achievements ? `<div class="camp-achievements"><strong>Odemčeno</strong><div>${achievements}</div></div>` : ''}
            `;
        }
        await loadPuzzleCampLeaderboard(campSession.id);
    } catch (error) {
        console.error('Camp finish save error:', error);
        if (summary) summary.innerHTML = '<div style="grid-column:1/-1"><strong>!</strong><span>Výsledek čeká na opětovné spojení</span></div>';
    }
}

let puzzleCampLeaderboardData = null;
let selectedPuzzleCampSessionId = null;
// která záložka žebříčku je vybraná: 'total' nebo id dne
let campLeaderTab = 'total';
let puzzleCampLeaderboardRequestId = 0;

function renderCampLivePulse(liveLeader = null) {
    const pulse = document.getElementById('campLivePulse');
    const text = document.getElementById('campLivePulseText');
    if (!pulse || !text || gameMode !== 'pardubice2026') return;

    const detail = puzzleCampLeaderboardData?.sessionDetail;
    const fallbackLeader = detail?.participants?.[0];
    const leader = liveLeader || (fallbackLeader ? {
        playerName: fallbackLeader.playerName,
        puzzleCount: fallbackLeader.cells?.length || fallbackLeader.correctCount || 0
    } : null);
    const total = Math.max(1, campSession?.puzzleCount || detail?.session?.puzzleCount || puzzles.length || 1);
    const leaderPuzzle = leader
        ? Math.min(total, Math.max(1, Number(leader.puzzleCount || 0) + 1))
        : Math.min(total, Math.max(1, currentPuzzleIndex + 1));

    text.textContent = leader
        ? `Lídr ${leader.playerName} · úloha ${leaderPuzzle}/${total}`
        : `Společná sada · úloha ${leaderPuzzle}/${total}`;
    pulse.classList.remove('hidden');
}

function campFormatSeconds(milliseconds) {
    if (!milliseconds) return '—';
    return `${(milliseconds / 1000).toFixed(milliseconds < 10000 ? 1 : 0)} s`;
}

function renderCampMotivationalBadges(badges = [], limit = 3) {
    if (!badges.length) return '';
    return `<span class="camp-motivation-badges">${badges.slice(0, limit).map(badge => `
        <span class="camp-motivation-badge" title="${escapeHtml(badge.description)}"><b>${escapeHtml(badge.icon)}</b>${escapeHtml(badge.name)}</span>
    `).join('')}</span>`;
}

function renderPuzzleCampLeaderboard(data) {
    puzzleCampLeaderboardData = data;
    const section = document.getElementById('campLeaderboardSection');
    const standingsBody = document.getElementById('campStandingsBody');
    const podium = document.getElementById('campWeekPodium');
    const tabs = document.getElementById('campSessionTabs');
    if (!section || !standingsBody || !podium || !tabs) return;
    section.classList.remove('hidden');
    document.getElementById('leaderboardSection')?.classList.add('hidden');
    document.getElementById('hallOfFameSection')?.classList.add('hidden');
    setCampLobbyElement('campCurrentPlayer', loggedInUser?.realName || loggedInUser?.username || 'Hráč');

    const medals = ['🥇', '🥈', '🥉'];
    podium.innerHTML = data.standings.slice(0, 3).map((player, index) => `
        <div class="camp-podium-card">
            <span class="camp-podium-card__rank">${medals[index]}</span>
            <strong>${escapeHtml(player.playerName)}</strong>
            <span class="camp-podium-card__meta">${player.level.icon} ${escapeHtml(player.level.name)} · ${player.score} bodů · ${player.correctCount} úloh</span>
            ${renderCampMotivationalBadges(player.badges, 2)}
        </div>
    `).join('') || '<div class="camp-matrix-empty" style="grid-column:1/-1">První body teprve čekají na svého majitele.</div>';

    const selectedId = data.sessionDetail?.session?.id;
    if (selectedId) selectedPuzzleCampSessionId = selectedId;

    // Den, který se nerozeběhl (nikdo ho nehrál), do přepínače nepatří — jen mate.
    const played = data.sessions.filter(session => session.participantCount > 0);
    if (campLeaderTab !== 'total' && !played.some(session => session.id === campLeaderTab)) {
        campLeaderTab = selectedId && played.some(s => s.id === selectedId) ? selectedId : 'total';
    }

    tabs.innerHTML = played.length ? `
        <div class="camp-tabs" role="tablist">
            <button type="button" class="camp-tab${campLeaderTab === 'total' ? ' is-on' : ''}"
                onclick="window.switchCampLeaderTab('total')" role="tab">Celkem</button>
            ${played.map(session => `<button type="button" class="camp-tab${campLeaderTab === session.id ? ' is-on' : ''}"
                onclick="window.switchCampLeaderTab(${session.id})" role="tab"
                title="${escapeHtml(session.title)}">${escapeHtml(campDayLabel(session.startsAt))}</button>`).join('')}
        </div>
    ` : '<div class="camp-matrix-empty">Zatím není uložený žádný den testu.</div>';

    renderCampStandings(data);
    renderPuzzleCampMatrix(data.sessionDetail);
    renderCampLivePulse();
}

/** Krátký popisek dne pro záložku: „út 28. 7." */
function campDayLabel(startsAt) {
    return new Date(startsAt).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

/**
 * Žebříček — buď celkový součet za celý pobyt, nebo pořadí jednoho dne.
 * Sloupce se mění spolu s tím: účast a výhry dávají smysl jen u součtu.
 */
function renderCampStandings(data) {
    const head = document.getElementById('campStandingsHead');
    const body = document.getElementById('campStandingsBody');
    if (!body) return;

    const denni = campLeaderTab !== 'total';
    const detail = data.sessionDetail;

    if (denni && detail?.session?.id !== campLeaderTab) {
        body.innerHTML = '<tr><td colspan="7"><i class="fa-solid fa-spinner fa-spin"></i> Načítám den…</td></tr>';
        return;
    }

    if (head) {
        head.innerHTML = denni
            ? '<tr><th>#</th><th>Hráč</th><th>Body</th><th>Vyřešeno</th><th>Chyby</th><th>Čas</th><th>Nej série</th></tr>'
            : '<tr><th>#</th><th>Hráč</th><th>Body</th><th>Vyřešeno</th><th>Účast</th><th>Výhry</th><th>Nej série</th></tr>';
    }

    const jaSam = (id) => id === loggedInUser?.id ? ' · vy' : '';
    const rows = denni
        ? (detail?.participants || []).map(p => `
            <tr class="${p.userId === loggedInUser?.id ? 'is-current-player' : ''}">
                <td>${p.rank}</td>
                <td>${escapeHtml(p.playerName)}${jaSam(p.userId)}${renderCampMotivationalBadges(p.badges)}<span class="camp-mobile-stats"><span>${p.correctCount} úloh</span><span>${p.wrongCount} chyb</span><span>${campFormatSeconds(p.durationMs)}</span><span>série ${p.maxStreak}</span></span></td>
                <td class="camp-score-cell"><strong>${p.score}</strong><small>bodů</small></td>
                <td>${p.correctCount}</td>
                <td>${p.wrongCount}</td>
                <td>${campFormatSeconds(p.durationMs)}</td>
                <td>${p.maxStreak}</td>
            </tr>`).join('')
        : data.standings.map(player => `
            <tr class="${player.userId === loggedInUser?.id ? 'is-current-player' : ''}">
                <td>${player.rank}</td>
                <td>${escapeHtml(player.playerName)}${jaSam(player.userId)}<small class="camp-level-tag">${player.level.icon} ${escapeHtml(player.level.name)}</small>${renderCampMotivationalBadges(player.badges)}<span class="camp-mobile-stats"><span>${player.correctCount} úloh</span><span>${player.attendance}× účast</span><span>${player.wins}× výhra</span><span>série ${player.maxStreak}</span></span></td>
                <td class="camp-score-cell"><strong>${player.score}</strong><small>bodů</small></td>
                <td>${player.correctCount}</td>
                <td>${player.attendance}×</td>
                <td>${player.wins}</td>
                <td>${player.maxStreak}</td>
            </tr>`).join('');

    body.innerHTML = rows || `<tr><td colspan="7">${denni ? 'Z tohohle dne zatím výsledky nemáme.' : 'Zatím nejsou zapsané žádné výsledky.'}</td></tr>`;

    const kicker = document.querySelector('.camp-leaderboard__toolbar .camp-section-kicker');
    if (kicker) kicker.textContent = denni ? `Pořadí dne · ${escapeHtml(detail?.session?.title || '')}` : 'Celkové pořadí';
}

/** Přepnutí záložky. Den se musí dotáhnout ze serveru, celkové pořadí už máme. */
function switchCampLeaderTab(tab) {
    campLeaderTab = tab;
    if (tab === 'total') {
        if (puzzleCampLeaderboardData) renderPuzzleCampLeaderboard(puzzleCampLeaderboardData);
        return;
    }
    if (puzzleCampLeaderboardData?.sessionDetail?.session?.id === tab) {
        renderPuzzleCampLeaderboard(puzzleCampLeaderboardData);
        return;
    }
    return switchPuzzleCampSession(tab);
}

function renderPuzzleCampMatrix(detail) {
    const matrix = document.getElementById('campPuzzleMatrix');
    const title = document.getElementById('campMatrixTitle');
    if (!matrix || !title) return;
    if (!detail) {
        title.textContent = 'Úloha po úloze';
        matrix.innerHTML = '<div class="camp-matrix-empty">Zatím není připravená žádná rozcvička.</div>';
        return;
    }

    title.textContent = detail.session.title;
    if (!detail.participants.length) {
        matrix.innerHTML = '<div class="camp-matrix-empty">Na výsledky této rozcvičky zatím čekáme.</div>';
        return;
    }

    const head = detail.puzzles.map(puzzle => {
        if (!puzzle.preview) return `<th title="Náhled bude dostupný po skončení rozcvičky">${puzzle.index + 1}</th>`;
        return `<th><button type="button" class="camp-matrix-puzzle-button" onclick="window.showCampPuzzlePreview(null, ${puzzle.index})" title="Zobrazit úlohu ${puzzle.index + 1}">${puzzle.index + 1}</button></th>`;
    }).join('');
    const rows = detail.participants.map(player => {
        const cellsByIndex = new Map(player.cells.map(cell => [cell.puzzleIndex, cell]));
        const cells = detail.puzzles.map(puzzle => {
            const cell = cellsByIndex.get(puzzle.index);
            if (!cell) return '<td><span class="camp-matrix-cell camp-matrix-cell--empty">—</span></td>';
            const canPreview = Boolean(puzzle.preview);
            const open = canPreview ? ` onclick="window.showCampPuzzlePreview(${player.userId}, ${puzzle.index})"` : '';
            const disabled = canPreview ? '' : ' disabled';
            const buttonClass = canPreview ? ' camp-matrix-cell--clickable' : '';
            if (cell.correct) {
                return `<td><button type="button" class="camp-matrix-cell camp-matrix-cell--correct${buttonClass}"${open}${disabled} title="Správně · ${cell.wrongAttempts} chyb · ${cell.points} bodů">${campFormatSeconds(cell.responseMs)}</button></td>`;
            }
            const label = cell.skipped ? '↷' : '×';
            return `<td><button type="button" class="camp-matrix-cell camp-matrix-cell--wrong${buttonClass}"${open}${disabled} title="${cell.skipped ? 'Přeskočeno' : 'Nevyřešeno'} · ${cell.wrongAttempts} chyb">${label}</button></td>`;
        }).join('');
        return `<tr><td>${player.rank}. ${escapeHtml(player.playerName)}</td>${cells}</tr>`;
    }).join('');

    matrix.innerHTML = `<table class="camp-matrix-table"><thead><tr><th>Hráč / úloha</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function showCampPuzzlePreview(userId, puzzleIndex) {
    const detail = puzzleCampLeaderboardData?.sessionDetail;
    const puzzle = detail?.puzzles?.find(item => item.index === Number(puzzleIndex));
    if (!puzzle?.preview) return;
    const player = userId == null ? null : detail.participants.find(item => item.userId === Number(userId));
    const cell = player?.cells?.find(item => item.puzzleIndex === Number(puzzleIndex));
    openPuzzlePreview({
        number: puzzle.index + 1,
        puzzleId: puzzle.puzzleId,
        rating: puzzle.rating,
        initialFen: getInitialFen({
            game: { pgn: puzzle.preview.pgn },
            puzzle: { initialPly: puzzle.preview.initialPly }
        }),
        solution: puzzle.preview.solution,
        playerName: player?.playerName || null,
        correct: cell ? cell.correct === true : null,
        skipped: cell?.skipped === true,
        responseMs: cell?.responseMs || 0,
        wrongAttempts: cell?.wrongAttempts || 0,
        wrongMove: cell?.wrongMove || null
    });
}

async function loadPuzzleCampLeaderboard(sessionId) {
    if (!loggedInUser) return;
    const requestId = ++puzzleCampLeaderboardRequestId;
    const selectedSessionId = sessionId || selectedPuzzleCampSessionId;
    try {
        const query = selectedSessionId ? `?sessionId=${selectedSessionId}` : '';
        const res = await fetch(`${API_URL}/racer/camp/leaderboard${query}`, { headers: campAuthHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (requestId === puzzleCampLeaderboardRequestId) renderPuzzleCampLeaderboard(data);
    } catch (error) {
        console.error('Camp leaderboard error:', error);
    }
}

function switchPuzzleCampSession(sessionId) {
    selectedPuzzleCampSessionId = sessionId;
    return loadPuzzleCampLeaderboard(sessionId);
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
    window.showCampPuzzlePreview = showCampPuzzlePreview;
    window.closePuzzlePreview = closePuzzlePreview;
    window.playPuzzlePreview = playPuzzlePreview;
    window.handleGameOverAction = handleGameOverAction;
    window.joinPuzzleCamp = joinPuzzleCamp;
    window.switchPuzzleCampSession = switchPuzzleCampSession;
    window.switchCampLeaderTab = switchCampLeaderTab;

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !document.getElementById('puzzlePreviewModal')?.classList.contains('hidden')) {
            closePuzzlePreview();
        }
    });

    // Detect logged-in user
    loggedInUser = detectLoggedInUser();
    detectGameMode();

    // Load leaderboard, hall of fame, and player name on init
    if (gameMode !== 'pardubice2026') {
        loadLeaderboard();
        loadHallOfFame();
    }

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
        if (gameMode !== 'pardubice2026') loadPersonalStats();
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
        if (gameMode !== 'pardubice2026') {
            const mode = new URLSearchParams(window.location.search).get('mode') === 'thematic' ? 'thematic' : 'vanilla';
            personalBest = parseInt(localStorage.getItem(`puzzle_racer_best_${mode}`)) || 0;
        }
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
    const isCamp = mode === 'pardubice2026';

    // Show correct badge
    const vanillaBadge = document.getElementById('vanillaBadge');
    const thematicBadge = document.getElementById('thematicBadge');
    const campBadge = document.getElementById('campBadge');
    const modeDesc = document.getElementById('modeDescription');
    const normalStartButton = document.querySelector('#startScreen > button.btn-primary');

    document.body.classList.toggle('camp-mode-active', isCamp);
    document.getElementById('campLobby')?.classList.toggle('hidden', !isCamp);
    document.getElementById('campLeaderboardSection')?.classList.toggle('hidden', !isCamp || !loggedInUser);
    document.getElementById('leaderboardSection')?.classList.toggle('hidden', isCamp);
    document.getElementById('hallOfFameSection')?.classList.toggle('hidden', isCamp);
    if (normalStartButton) normalStartButton.classList.toggle('hidden', isCamp);

    // Update Tab UI (Visual Selection)
    if (vanillaBadge) {
        vanillaBadge.style.opacity = (isThematic || isCamp) ? '0.5' : '1';
        vanillaBadge.style.boxShadow = (isThematic || isCamp) ? 'none' : '0 0 15px rgba(59, 130, 246, 0.5)';
        vanillaBadge.style.transform = (isThematic || isCamp) ? 'scale(0.95)' : 'scale(1.05)';
        vanillaBadge.style.transition = 'all 0.3s ease';
    }

    if (thematicBadge) {
        thematicBadge.style.opacity = isThematic ? '1' : '0.5';
        thematicBadge.style.boxShadow = isThematic ? '0 0 15px rgba(236, 72, 153, 0.5)' : 'none';
        thematicBadge.style.transform = isThematic ? 'scale(1.05)' : 'scale(0.95)';
        thematicBadge.style.transition = 'all 0.3s ease';
    }

    if (campBadge) {
        campBadge.style.opacity = isCamp ? '1' : '0.5';
        campBadge.style.boxShadow = isCamp ? '0 0 18px rgba(242, 197, 82, 0.45)' : 'none';
        campBadge.style.transform = isCamp ? 'scale(1.05)' : 'scale(0.95)';
        campBadge.style.transition = 'all 0.3s ease';
    }

    // Update description - for thematic mode, fetch and show current settings
    if (modeDesc) {
        if (isCamp) {
            modeDesc.innerHTML = '<strong>Pardubice 2026:</strong> jedna sada, jeden start, celý týden jeden společný žebříček.';
        } else if (isThematic) {
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


    if (isCamp) {
        document.getElementById('personalStatsPanel')?.classList.add('hidden');
        document.getElementById('anonCta')?.classList.add('hidden');
        renderCampLobby();
        loadPuzzleCampState();
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
