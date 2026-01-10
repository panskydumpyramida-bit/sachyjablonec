// Member Games Logic (Editor & Viewer)

let memberGamesData = [];
let memberViewer = null;

async function loadGames() {
    const container = document.getElementById('gamesList');
    container.innerHTML = '<p class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Načítám...</p>';

    try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/games`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const games = await res.json();
        memberGamesData = games;

        if (games.length === 0) {
            container.innerHTML = '<p class="text-muted text-center" style="color: var(--text-muted);">Zatím žádné nahrané partie.</p>';
            return;
        }

        container.innerHTML = games.map((game, index) => `
            <div class="game-card" style="cursor: pointer; padding: 0.8rem 1rem; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;" onclick="playGameInViewer(${index})">
                <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0;">
                    <span style="font-weight: 600; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(game.white)} - ${escapeHtml(game.black)}</span>
                    <span style="color: #4ade80; font-weight: 700; font-size: 0.9rem;">${game.result}</span>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">${new Date(game.date).toLocaleDateString('cs-CZ')}</span>
                </div>
                <div style="display: flex; gap: 0.5rem;" onclick="event.stopPropagation()">
                     <a href="game-recorder.html?id=${game.id}" class="btn-secondary" style="padding: 0.3rem 0.5rem; font-size: 0.7rem;" title="Upravit">
                         <i class="fa-solid fa-edit"></i>
                     </a>
                     <button onclick="downloadGamePgn(${game.id})" class="btn-secondary" style="padding: 0.3rem 0.5rem; font-size: 0.7rem;" title="Stáhnout PGN">
                         <i class="fa-solid fa-download"></i>
                     </button>
                     ${currentUserRole === 'ADMIN' || currentUserRole === 'SUPERADMIN' ? `
                     <button onclick="deleteGame(${game.id})" class="btn-secondary" style="background: rgba(220, 38, 38, 0.2); color: #fca5a5; border-color: rgba(220, 38, 38, 0.4); padding: 0.3rem 0.5rem; font-size: 0.7rem;" title="Smazat">
                         <i class="fa-solid fa-trash"></i>
                     </button>
                     ` : ''}
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color: #ef4444;">Chyba načítání partií.</p>';
    }
}

function playGameInViewer(index) {
    const game = memberGamesData[index];
    if (!game || !game.pgn) {
        alert('Tato partie nemá PGN data.');
        return;
    }

    const viewerContainer = document.getElementById('memberGameViewer');
    viewerContainer.style.display = 'block';
    viewerContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const container = document.getElementById('memberViewerContainer');
    container.innerHTML = '';

    if (typeof GameViewer2 !== 'undefined') {
        memberViewer = new GameViewer2(container, {
            pgn: game.pgn,
            showHeader: true,
            showControls: true,
            showNotation: true
        });
    } else {
        container.innerHTML = '<p style="color: #fca5a5;">GameViewer2 není dostupný.</p>';
    }
}

async function downloadGamePgn(id) {
    try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/games/${id}/pgn`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Download failed');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `game_${id}.pgn`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) { console.error(e); alert('Stahování selhalo.'); }
}

async function deleteGame(id) {
    if (!confirm('Smazat partii?')) return;
    const token = getAuthToken();
    await fetch(`${API_URL}/games/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    loadGames();
}

// --- PGN Import ---
function showPgnImportModal() {
    const modal = document.getElementById('pgnImportModal');
    if (modal) modal.style.display = 'flex';
}
function closePgnImportModal() {
    const modal = document.getElementById('pgnImportModal');
    if (modal) modal.style.display = 'none';
}

function parsePgnIntoGames(pgnText) {
    const games = [];
    const rawGames = pgnText.split(/\n\n(?=\[Event\s)/);

    for (const gamePgn of rawGames) {
        if (!gamePgn.trim()) continue;

        const whiteMatch = gamePgn.match(/\[White\s+"([^"]+)"\]/);
        const blackMatch = gamePgn.match(/\[Black\s+"([^"]+)"\]/);
        const resultMatch = gamePgn.match(/\[Result\s+"([^"]+)"\]/);
        const eventMatch = gamePgn.match(/\[Event\s+"([^"]+)"\]/);
        const dateMatch = gamePgn.match(/\[Date\s+"([^"]+)"\]/);

        games.push({
            white: whiteMatch ? whiteMatch[1] : 'N/A',
            black: blackMatch ? blackMatch[1] : 'N/A',
            result: resultMatch ? resultMatch[1] : '*',
            event: eventMatch ? eventMatch[1] : '',
            date: dateMatch ? dateMatch[1].replace(/\./g, '-') : new Date().toISOString().split('T')[0],
            pgn: gamePgn.trim()
        });
    }

    return games;
}

async function importPgnGames() {
    const pgnText = document.getElementById('pgnImportText').value.trim();
    const statusDiv = document.getElementById('pgnImportStatus');
    const btn = document.getElementById('pgnImportBtn');

    if (!pgnText) return alert('Vložte PGN.');

    const games = parsePgnIntoGames(pgnText);
    if (games.length === 0) return alert('Žádné partie nerozpoznány.');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ukládám...';

    const token = getAuthToken();
    let savedCount = 0;

    for (const game of games) {
        try {
            const res = await fetch(`${API_URL}/games`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(game)
            });
            if (res.ok) savedCount++;
        } catch (e) { console.error(e); }
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-save"></i> Uložit partie';
    alert(`Uloženo ${savedCount} partií.`);
    closePgnImportModal();
    loadGames();
}
