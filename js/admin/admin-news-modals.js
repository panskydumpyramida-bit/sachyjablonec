/**
 * Admin News Modals Module
 * 
 * Extracted from admin-news.js to reduce file size.
 * Contains: Recorded Games Modal, PGN Paste Modal, Header/Separator Modal
 * 
 * Dependencies: games (array), renderGames(), escapeHtml(), API_URL, authToken
 */

// ================================
// RECORDED GAMES MODAL
// ================================

async function showRecordedGamesModal() {
    console.log('[admin-news-modals] showRecordedGamesModal()');
    const modal = document.getElementById('recordedGamesModal');
    const list = document.getElementById('recordedGamesList');

    modal.style.display = 'flex';
    list.innerHTML = '<p style="color: var(--text-muted); text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Načítám...</p>';

    try {
        const res = await fetch(`${API_URL}/games`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const gamesData = await res.json();

        if (!gamesData.length) {
            list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Žádné nahrané partie</p>';
            return;
        }

        list.innerHTML = gamesData.map(g => `
            <div class="db-game-item" data-game-id="${g.id}" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; margin-bottom: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 8px; cursor: pointer; border-left: 3px solid #3b82f6; transition: all 0.2s;"
                 onmouseover="this.style.background='rgba(59,130,246,0.15)'"
                 onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                <span style="font-size: 0.65rem; padding: 0.15rem 0.35rem; border-radius: 3px; font-weight: 700; background: #3b82f6; color: white;">PGN</span>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">${escapeHtml(g.white)} - ${escapeHtml(g.black)}</div>
                    <div style="display: flex; gap: 0.75rem; font-size: 0.75rem; color: var(--text-muted);">
                        <span style="color: #4ade80; font-weight: 700;">${g.result || '*'}</span>
                        <span>${g.date ? new Date(g.date).toLocaleDateString('cs-CZ') : ''}</span>
                        ${g.event ? `<span>${escapeHtml(g.event)}</span>` : ''}
                    </div>
                </div>
                <i class="fa-solid fa-plus" style="color: #60a5fa;"></i>
            </div>
        `).join('');

        list.querySelectorAll('.db-game-item').forEach(item => {
            item.addEventListener('click', () => {
                const gameId = parseInt(item.dataset.gameId);
                addGameFromDB(gameId);
            });
        });
    } catch (e) {
        console.error('Error loading recorded games:', e);
        list.innerHTML = '<p style="color: #fca5a5; text-align: center;">Chyba načítání</p>';
    }
}

function closeRecordedGamesModal() {
    document.getElementById('recordedGamesModal').style.display = 'none';
}

async function addGameFromDB(gameId) {
    console.log('[admin-news-modals] addGameFromDB()', gameId);
    try {
        const res = await fetch(`${API_URL}/games/${gameId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const gameData = await res.json();

        const title = `${gameData.white || '?'} - ${gameData.black || '?'}`;

        games.push({
            title: title,
            gameId: null,
            pgn: gameData.pgn,
            dbGameId: gameId,
            team: 'A tým',
            isCommented: false,
            commented: false
        });

        renderGames();
        closeRecordedGamesModal();
    } catch (e) {
        console.error('Error fetching game:', e);
        alert('Nepodařilo se načíst partii');
    }
}

// Close modal on outside click
document.getElementById('recordedGamesModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'recordedGamesModal') closeRecordedGamesModal();
});

// ================================
// PGN PASTE MODAL FOR NEWS
// ================================

function showNewsGamePgnModal() {
    const modal = document.getElementById('newsGamePgnModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('newsGamePgnTitle').value = '';
        document.getElementById('newsGamePgnText').value = '';
        setTimeout(setupPgnDropZone, 100);
    }
}

function closeNewsGamePgnModal() {
    const modal = document.getElementById('newsGamePgnModal');
    if (modal) modal.style.display = 'none';
}

function addGameFromPgn() {
    const pgnInput = document.getElementById('newsGamePgnText');
    const pgnText = pgnInput.value.trim();

    if (!pgnText) {
        alert('Vložte PGN notaci');
        return;
    }

    // Split multiple games - each game starts with [Event
    const gameChunks = pgnText.split(/(?=\[Event\s)/);
    const validGames = gameChunks.filter(chunk => chunk.trim().length > 0);

    if (validGames.length === 0) {
        validGames.push(pgnText);
    }

    let addedCount = 0;
    for (const pgn of validGames) {
        const trimmedPgn = pgn.trim();
        if (!trimmedPgn) continue;

        const whiteMatch = trimmedPgn.match(/\[White\s+"([^"]+)"\]/);
        const blackMatch = trimmedPgn.match(/\[Black\s+"([^"]+)"\]/);
        const title = (whiteMatch && blackMatch)
            ? `${whiteMatch[1]} - ${blackMatch[1]}`
            : 'Partie';

        games.push({
            title: title,
            gameId: null,
            pgn: trimmedPgn,
            dbGameId: null,
            team: 'A tým',
            isCommented: false,
            commented: false
        });
        addedCount++;
    }

    renderGames();
    closeNewsGamePgnModal();

    if (addedCount > 1) {
        alert(`Přidáno ${addedCount} partií`);
    }
}

function handlePgnFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('newsGamePgnText').value = e.target.result;
    };
    reader.readAsText(file);
    event.target.value = '';
}

function setupPgnDropZone() {
    const dropZone = document.getElementById('pgnDropZone');
    const overlay = document.getElementById('pgnDropOverlay');
    const textarea = document.getElementById('newsGamePgnText');

    if (!dropZone || !overlay) return;

    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        overlay.style.display = 'flex';
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        overlay.style.display = 'flex';
    });

    dropZone.addEventListener('dragleave', (e) => {
        if (!dropZone.contains(e.relatedTarget)) {
            overlay.style.display = 'none';
        }
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        overlay.style.display = 'none';

        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.pgn') || file.name.endsWith('.txt') || file.type === 'text/plain')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                textarea.value = ev.target.result;
            };
            reader.readAsText(file);
        }
    });
}

// Close PGN modal on outside click
document.getElementById('newsGamePgnModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'newsGamePgnModal') closeNewsGamePgnModal();
});

// ================================
// HEADER/SEPARATOR MODAL
// ================================

function showHeaderModal() {
    const modal = document.getElementById('headerModal');
    if (modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('headerTitleModal');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

function closeHeaderModal() {
    const modal = document.getElementById('headerModal');
    if (modal) modal.style.display = 'none';
}

function addHeaderFromModal() {
    const input = document.getElementById('headerTitleModal');
    const title = input?.value.trim();

    if (!title) {
        alert('Zadejte název oddělovače');
        return;
    }

    games.push({
        type: 'header',
        title: title
    });

    renderGames();
    closeHeaderModal();
}

// Close header modal on outside click
document.getElementById('headerModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'headerModal') closeHeaderModal();
});

// ================================
// EXPORTS
// ================================

// Recorded Games Modal
window.showRecordedGamesModal = showRecordedGamesModal;
window.closeRecordedGamesModal = closeRecordedGamesModal;
window.addGameFromDB = addGameFromDB;

// PGN Modal
window.showNewsGamePgnModal = showNewsGamePgnModal;
window.closeNewsGamePgnModal = closeNewsGamePgnModal;
window.addGameFromPgn = addGameFromPgn;
window.handlePgnFileUpload = handlePgnFileUpload;

// Header Modal
window.showHeaderModal = showHeaderModal;
window.closeHeaderModal = closeHeaderModal;
window.addHeaderFromModal = addHeaderFromModal;

console.log('[admin-news-modals] Module loaded successfully');
