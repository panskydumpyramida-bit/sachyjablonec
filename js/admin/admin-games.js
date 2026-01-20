/**
 * Admin Games Module
 * Manages recorded games in admin panel
 * 
 * @requires js/utils.js (escapeHtml)
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

// Export for global access
window.loadRecordedGames = loadRecordedGames;
window.deleteRecordedGame = deleteRecordedGame;
window.previewGamePgn = previewGamePgn;
window.closePgnPreview = closePgnPreview;
window.copyToClipboard = copyToClipboard;

// ================================
// DIAGRAMS CRUD
// ================================

// Load all diagrams
async function loadDiagrams() {
    try {
        const res = await fetch(`${API_URL}/diagrams`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!res.ok) throw new Error('Failed to fetch diagrams');

        const diagrams = await res.json();
        const tbody = document.getElementById('diagramsTableBody');
        const noDiagramsInfo = document.getElementById('noDiagramsInfo');

        if (!diagrams || diagrams.length === 0) {
            tbody.innerHTML = '';
            noDiagramsInfo.style.display = 'block';
            return;
        }

        noDiagramsInfo.style.display = 'none';

        tbody.innerHTML = diagrams.map(d => {
            const displayName = d.name || d.title || `Diagram #${d.id}`;
            const hasSolution = d.solution && Object.keys(d.solution).length > 0;
            const typeBadge = hasSolution
                ? '<span style="background:#22c55e;color:#000;padding:2px 8px;border-radius:4px;font-size:0.75rem;">Hádanka</span>'
                : '<span style="background:#3b82f6;color:#fff;padding:2px 8px;border-radius:4px;font-size:0.75rem;">Diagram</span>';
            const toMove = d.toMove === 'w' ? '⬜ Bílý' : '⬛ Černý';
            const createdDate = d.createdAt ? new Date(d.createdAt).toLocaleDateString('cs-CZ') : '-';

            return `
            <tr>
                <td>${escapeHtml(displayName)}</td>
                <td>${typeBadge}</td>
                <td>${toMove}</td>
                <td>${createdDate}</td>
                <td>
                    <button class="action-btn btn-edit" onclick="previewDiagram(${d.id})" title="Náhled">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <a href="/game-recorder.html?diagramId=${d.id}" target="_blank" class="action-btn btn-edit" title="Upravit">
                        <i class="fa-solid fa-edit"></i>
                    </a>
                    <button class="action-btn btn-delete" onclick="deleteDiagram(${d.id})" title="Smazat">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        }).join('');

    } catch (error) {
        console.error('Error loading diagrams:', error);
        showAlert('Chyba při načítání diagramů', 'error');
    }
}

// Delete a diagram
async function deleteDiagram(id) {
    if (!confirm('Opravdu chcete smazat tento diagram?')) return;

    try {
        const res = await fetch(`${API_URL}/diagrams/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'x-club-password': localStorage.getItem('clubPassword') || ''
            }
        });

        if (!res.ok) throw new Error('Failed to delete diagram');

        showAlert('Diagram smazán', 'success');
        loadDiagrams();

    } catch (error) {
        console.error('Error deleting diagram:', error);
        showAlert('Chyba při mazání diagramu', 'error');
    }
}

// Preview diagram in modal
function previewDiagram(id) {
    fetch(`${API_URL}/diagrams/${id}`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    })
        .then(res => res.json())
        .then(d => {
            const displayName = d.name || d.title || `Diagram #${d.id}`;
            const hasSolution = d.solution && Object.keys(d.solution).length > 0;
            const toMove = d.toMove === 'w' ? 'Bílý na tahu' : 'Černý na tahu';

            // Generate visual board for preview
            const boardHtml = generateMiniBoardAdmin(d.fen, 35);

            const modal = document.createElement('div');
            modal.id = 'diagramPreviewModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; backdrop-filter: blur(5px);';
            modal.innerHTML = `
        <div style="background: var(--surface-color, #1e1e1e); max-width: 400px; width: 90%; max-height: 80vh; overflow-y: auto; padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(212,175,55,0.3); box-shadow: 0 20px 60px rgba(0,0,0,0.6); position: relative;">
            <span onclick="closeDiagramPreview()" style="position: absolute; top: 10px; right: 15px; font-size: 24px; cursor: pointer; color: #aaa; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#aaa'">&times;</span>
            <h3 style="margin-top: 0; color: var(--primary-color, #d4af37); text-align: center;">
                <i class="fa-solid fa-chess"></i> ${escapeHtml(displayName)}
            </h3>
            <p style="color: var(--text-muted, #888); font-size: 0.9rem; text-align: center;">
                ${toMove} • ${hasSolution ? '<span style="color:#22c55e;">✅ Hádanka</span>' : '<span style="color:#3b82f6;">📊 Diagram</span>'}
            </p>
            <div style="margin: 1rem auto; display: flex; justify-content: center;">
                ${boardHtml}
            </div>
            ${hasSolution ? `<p style="color: #22c55e; font-size: 0.85rem; text-align: center;"><i class="fa-solid fa-check-circle"></i> Obsahuje ${Object.keys(d.solution).length} definovaných tahů</p>` : ''}
            ${d.description ? `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center;"><i class="fa-solid fa-align-left"></i> ${escapeHtml(d.description)}</p>` : ''}
            <div style="display: flex; gap: 0.5rem; margin-top: 1rem; justify-content: center;">
                <button class="btn-secondary" onclick="copyToClipboard('${escapeHtml(d.fen || '').replace(/'/g, "\\'")}'); closeDiagramPreview();" style="padding: 0.6rem 1rem; background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; cursor: pointer;">
                    <i class="fa-solid fa-copy"></i> Kopírovat FEN
                </button>
            </div>
        </div>
        `;
            document.body.appendChild(modal);

            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeDiagramPreview();
            });
        })
        .catch(err => {
            console.error('Error fetching diagram:', err);
            showAlert('Chyba při načítání diagramu', 'error');
        });
}

function closeDiagramPreview() {
    const modal = document.getElementById('diagramPreviewModal');
    if (modal) modal.remove();
}

// Export diagram functions
window.loadDiagrams = loadDiagrams;
window.deleteDiagram = deleteDiagram;
window.previewDiagram = previewDiagram;
window.closeDiagramPreview = closeDiagramPreview;

// Chess API Depth Setting - now uses database via API
async function initChessApiDepthSlider() {
    const slider = document.getElementById('chessApiDepthSlider');
    const valueDisplay = document.getElementById('chessApiDepthValue');
    if (!slider || !valueDisplay) return;

    // Load saved value from API
    try {
        const response = await fetch('/api/settings', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
            const settings = await response.json();
            const savedDepth = settings.chessApiDepth || '16';
            slider.value = savedDepth;
            valueDisplay.textContent = savedDepth;
        }
    } catch (e) {
        console.warn('Failed to load chess-api depth from server, using default');
        slider.value = '16';
        valueDisplay.textContent = '16';
    }
}

async function updateChessApiDepth(value) {
    const valueDisplay = document.getElementById('chessApiDepthValue');
    if (valueDisplay) valueDisplay.textContent = value;

    // Save to database via API
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ key: 'chessApiDepth', value: String(value) })
        });
        if (response.ok) {
            console.log('[Admin] Chess-API depth saved to database:', value);
            showAlert(`Hloubka analýzy nastavena na ${value}`, 'success');
        } else {
            throw new Error('Failed to save');
        }
    } catch (e) {
        console.error('[Admin] Failed to save chess-api depth:', e);
        showAlert('Nepodařilo se uložit nastavení', 'error');
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initChessApiDepthSlider();
});

window.updateChessApiDepth = updateChessApiDepth;
window.initChessApiDepthSlider = initChessApiDepthSlider;
