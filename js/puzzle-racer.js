// Puzzle Racer Logic

let game = null;
let board = null;
let puzzles = [];
let currentPuzzleIndex = 0;
let score = 0;
let timeLeft = 180; // 3 minutes
let timerInterval = null;
let isGameActive = false;

// Progressive difficulty loading
const DIFFICULTIES = ['easiest', 'easier', 'normal', 'harder', 'hardest'];
let currentDifficultyIndex = 0;
let totalPuzzlesSolved = 0;
let puzzlesBeforeNextBatch = 3; // Load more after solving 3
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

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // expose functions to window
    window.startRace = startRace;
    window.saveScore = saveScore;
    window.skipPuzzle = skipPuzzle;

    // Load leaderboard and player name on init
    loadLeaderboard();
    const savedName = localStorage.getItem('puzzle_racer_name');
    if (savedName) {
        const nameInput = document.getElementById('playerName');
        if (nameInput) nameInput.value = savedName;
    }
});

async function loadLeaderboard() {
    try {
        const res = await fetch(`${API_URL}/racer/leaderboard`);
        if (!res.ok) throw new Error('Failed to fetch leaderboard');

        const data = await res.json();
        const tbody = document.getElementById('leaderboardBody');

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">Zatím žádné výsledky. Buďte první!</td></tr>';
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
                    <td style="padding: 1rem; color: var(--text-muted); font-size: 0.85rem;">${new Date(entry.createdAt).toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error(e);
        document.getElementById('leaderboardBody').innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #fca5a5;">Chyba při načítání žebříčku.</td></tr>';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Fetch more puzzles from server at current difficulty
async function fetchMorePuzzles() {
    if (isFetchingPuzzles) return;
    isFetchingPuzzles = true;

    const difficulty = DIFFICULTIES[currentDifficultyIndex] || 'hardest';
    console.log(`Fetching 3 ${difficulty} puzzles...`);

    try {
        const res = await fetch(`${API_URL}/racer/puzzles?difficulty=${difficulty}&count=3`);
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
        // Fetch initial batch of easiest puzzles
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
        // Ran out of puzzles? Win/End?
        // Maybe fetch more in background? For now just end.
        endGame();
        return;
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

    // Initialize/Update Board
    const config = {
        draggable: true,
        position: game.fen(), // Position BEFORE the last move
        orientation: playerColor,
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
        onDragStart: onDragStart,
        onDrop: onDrop,
        onSnapEnd: onSnapEnd,
        moveSpeed: 'slow'
    };

    if (board) {
        board.destroy();
    }
    board = Chessboard('board', config);

    // Animate the last move (Opponent's move) after a short delay
    if (lastMove) {
        setTimeout(() => {
            game.move(lastMove);
            board.position(game.fen(), true); // animate

            // Highlight the last move? (Optional refinement)
        }, 500);
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
}

function onDrop(source, target) {
    if (!isGameActive) return 'snapback';

    // Verify if this move is legal in chess terms first
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // NOTE: always promote to a queen for simplicity
    });

    if (move === null) return 'snapback'; // illegal move

    // Check if it matches the solution
    const uciMove = move.from + move.to + (move.promotion ? move.promotion : '');
    const expectedMove = game.currentSolution[game.solutionIndex];

    // DEBUG: Log what we're comparing
    console.log('DEBUG: Your move UCI:', uciMove);
    console.log('DEBUG: Expected move:', expectedMove);
    console.log('DEBUG: Solution array:', game.currentSolution);
    console.log('DEBUG: Solution index:', game.solutionIndex);

    // Lichess UCI doesn't strictly have promotion unless it's a promotion move.
    // Our 'uciMove' might look like 'a7a8q'. Expected 'a7a8q'.
    // Or 'e2e4'.

    // Comparison needs care strictly for promotion.
    // Simple check:
    if (uciMove !== expectedMove) {
        // Wrong move!
        console.log('DEBUG: WRONG! uciMove=' + uciMove + ' expectedMove=' + expectedMove);
        game.undo(); // undo the move on board logic
        handleWrongMove();
        return 'snapback';
    }

    // Correct move!
    game.solutionIndex++;

    // Check if puzzle is solved
    if (game.solutionIndex >= game.currentSolution.length) {
        // Puzzle Completed!
        handleCorrectPuzzle();
    } else {
        // Opponent's turn (next move in solution)
        setTimeout(() => {
            const opponentMoveUci = game.currentSolution[game.solutionIndex];
            const from = opponentMoveUci.substring(0, 2);
            const to = opponentMoveUci.substring(2, 4);
            const promotion = opponentMoveUci.length > 4 ? opponentMoveUci.substring(4, 5) : undefined;

            game.move({ from, to, promotion });
            board.position(game.fen());

            game.solutionIndex++;

            // Check if THIS was the last move (unlikely in puzzle, usually ends on player move)
            if (game.solutionIndex >= game.currentSolution.length) {
                handleCorrectPuzzle();
            }
        }, 300);
    }
}

function onSnapEnd() {
    // board.position(game.fen()); // Just to sync visuals if any weirdness
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
        }
    }

    // Check if we need to fetch more puzzles (every 3 puzzles)
    const puzzlesRemaining = puzzles.length - currentPuzzleIndex - 1;
    if (puzzlesRemaining <= 2 && !isFetchingPuzzles) {
        fetchMorePuzzles(); // Fetch in background
    }

    // Next puzzle
    currentPuzzleIndex++;
    setTimeout(() => {
        if (currentPuzzleIndex < puzzles.length) {
            loadPuzzle(puzzles[currentPuzzleIndex]);
        } else if (isFetchingPuzzles) {
            // Wait for more puzzles to load
            setTimeout(() => {
                if (currentPuzzleIndex < puzzles.length) {
                    loadPuzzle(puzzles[currentPuzzleIndex]);
                } else {
                    endGame();
                }
            }, 1000);
        } else {
            endGame();
        }
    }, 500);
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
