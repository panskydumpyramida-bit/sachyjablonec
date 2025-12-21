/**
 * Admin Games Module
 * Manages recorded games in admin panel
 */

// Load all recorded games
async function loadRecordedGames() {
    try {
        const res = await fetch(`${API_URL}/games`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!res.ok) throw new Error('Failed to fetch games');

        const games = await res.json();
        const tbody = document.getElementById('gamesTableBody');
        const noGamesInfo = document.getElementById('noGamesInfo');

        if (!games || games.length === 0) {
            tbody.innerHTML = '';
            noGamesInfo.style.display = 'block';
            return;
        }

        noGamesInfo.style.display = 'none';

        tbody.innerHTML = games.map(game => `
            <tr>
                <td>${new Date(game.date || game.createdAt).toLocaleDateString('cs-CZ')}</td>
                <td>${escapeHtml(game.white)}</td>
                <td>${escapeHtml(game.black)}</td>
                <td><strong>${game.result || '*'}</strong></td>
                <td>${escapeHtml(game.event || '')}</td>
                <td>
                    <button class="action-btn btn-edit" onclick="previewGamePgn(${game.id})" title="Náhled">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <a href="/game-recorder?id=${game.id}" target="_blank" class="action-btn btn-edit" title="Upravit">
                        <i class="fa-solid fa-edit"></i>
                    </a>
                    <a href="${API_URL}/games/${game.id}/pgn" download class="action-btn btn-edit" title="Stáhnout PGN">
                        <i class="fa-solid fa-download"></i>
                    </a>
                    <button class="action-btn btn-delete" onclick="deleteRecordedGame(${game.id})" title="Smazat">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading games:', error);
        showAlert('Chyba při načítání partií', 'error');
    }
}

// Delete a recorded game
async function deleteRecordedGame(id) {
    if (!confirm('Opravdu chcete smazat tuto partii?')) return;

    try {
        const res = await fetch(`${API_URL}/games/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'x-club-password': localStorage.getItem('clubPassword') || ''
            }
        });

        if (!res.ok) throw new Error('Failed to delete game');

        showAlert('Partie smazána', 'success');
        loadRecordedGames();

    } catch (error) {
        console.error('Error deleting game:', error);
        showAlert('Chyba při mazání partie', 'error');
    }
}

// Preview game PGN in modal
function previewGamePgn(id) {
    fetch(`${API_URL}/games/${id}`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
        .then(res => res.json())
        .then(game => {
            const modal = document.createElement('div');
            modal.id = 'pgnPreviewModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(5px);';
            modal.innerHTML = `
            <div style="background: var(--surface-color, #1e1e1e); max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(212,175,55,0.3); box-shadow: 0 20px 60px rgba(0,0,0,0.6); position: relative;">
                <span onclick="closePgnPreview()" style="position: absolute; top: 10px; right: 15px; font-size: 24px; cursor: pointer; color: #aaa; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#aaa'">&times;</span>
                <h3 style="margin-top: 0; color: var(--primary-color, #d4af37);">
                    <i class="fa-solid fa-chess-board"></i> ${escapeHtml(game.white)} vs ${escapeHtml(game.black)}
                </h3>
                <p style="color: var(--text-muted, #888); font-size: 0.9rem;">
                    ${game.event || ''} • ${game.result || '*'} • ${new Date(game.date || game.createdAt).toLocaleDateString('cs-CZ')}
                </p>
                <pre style="background: #0a0a0a; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.85rem; white-space: pre-wrap; word-break: break-word; color: #e0e0e0; border: 1px solid rgba(255,255,255,0.1);">${escapeHtml(game.pgn || 'Žádná PGN data')}</pre>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <a href="/game-recorder?id=${game.id}" target="_blank" class="btn-primary" style="text-decoration: none; padding: 0.6rem 1rem; background: var(--primary-color, #d4af37); color: #000; border-radius: 6px; font-weight: 600;">
                        <i class="fa-solid fa-edit"></i> Upravit
                    </a>
                    <button class="btn-secondary" onclick="copyToClipboard(\`${escapeHtml(game.pgn || '').replace(/`/g, '\\`')}\`)" style="padding: 0.6rem 1rem; background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; cursor: pointer;">
                        <i class="fa-solid fa-copy"></i> Kopírovat PGN
                    </button>
                </div>
            </div>
        `;
            document.body.appendChild(modal);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) closePgnPreview();
            });
        })
        .catch(err => {
            console.error('Error fetching game:', err);
            showAlert('Chyba při načítání partie', 'error');
        });
}

function closePgnPreview() {
    const modal = document.getElementById('pgnPreviewModal');
    if (modal) modal.remove();
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showAlert('PGN zkopírováno do schránky', 'success');
    }).catch(() => {
        showAlert('Kopírování selhalo', 'error');
    });
}

// Escape HTML helper
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export for global access
window.loadRecordedGames = loadRecordedGames;
window.deleteRecordedGame = deleteRecordedGame;
window.previewGamePgn = previewGamePgn;
window.closePgnPreview = closePgnPreview;
window.copyToClipboard = copyToClipboard;
