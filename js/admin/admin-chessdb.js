/**
 * Admin Chess Database Module
 * Handles PGN import and statistics
 */

// Load chess database statistics
async function loadChessDBStats() {
    const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

    try {
        // Get total games count
        const gamesRes = await fetch(`${API_URL}/chess/games?limit=1`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const gamesData = await gamesRes.json();

        document.getElementById('totalGamesCount').textContent =
            gamesData.total?.toLocaleString('cs-CZ') || '-';

        // Get unique players count (approximate from top 1000)
        const playersRes = await fetch(`${API_URL}/chess/players?q=a&limit=1000`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const players = await playersRes.json();
        document.getElementById('totalPlayersCount').textContent =
            players.length > 0 ? `${players.length}+` : '-';

    } catch (error) {
        console.error('Failed to load chess DB stats:', error);
    }
}

// Import PGN games
async function importChessGames() {
    const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const pgnText = document.getElementById('pgnImportText').value.trim();
    const resultDiv = document.getElementById('pgnImportResult');
    const btn = document.getElementById('importPgnBtn');

    if (!pgnText) {
        resultDiv.style.display = 'block';
        resultDiv.style.background = 'rgba(239, 68, 68, 0.2)';
        resultDiv.style.border = '1px solid #ef4444';
        resultDiv.innerHTML = '<i class="fa-solid fa-exclamation-circle"></i> Vložte prosím PGN text.';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importuji...';

    try {
        const res = await fetch(`${API_URL}/chess/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ pgn: pgnText })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            resultDiv.style.display = 'block';
            resultDiv.style.background = 'rgba(74, 222, 128, 0.2)';
            resultDiv.style.border = '1px solid #4ade80';
            resultDiv.innerHTML = `
                <i class="fa-solid fa-check-circle" style="color: #4ade80;"></i> 
                <strong>Import dokončen!</strong><br>
                📊 Celkem: ${data.total} | 
                ✅ Importováno: ${data.imported} | 
                ⏭️ Duplikátů: ${data.duplicates} | 
                ❌ Selhalo: ${data.failed}
            `;

            // Refresh stats
            loadChessDBStats();

            // Clear textarea on success
            if (data.imported > 0) {
                document.getElementById('pgnImportText').value = '';
            }
        } else {
            resultDiv.style.display = 'block';
            resultDiv.style.background = 'rgba(239, 68, 68, 0.2)';
            resultDiv.style.border = '1px solid #ef4444';
            resultDiv.innerHTML = `<i class="fa-solid fa-exclamation-circle"></i> ${data.error || 'Import selhal'}`;
        }
    } catch (error) {
        console.error('Import error:', error);
        resultDiv.style.display = 'block';
        resultDiv.style.background = 'rgba(239, 68, 68, 0.2)';
        resultDiv.style.border = '1px solid #ef4444';
        resultDiv.innerHTML = `<i class="fa-solid fa-exclamation-circle"></i> Chyba spojení: ${error.message}`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-upload"></i> Importovat partie';
    }
}

// Load PGN from file
function loadPgnFile(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('pgnImportText').value = e.target.result;
    };
    reader.onerror = () => {
        alert('Nepodařilo se načíst soubor.');
    };
    reader.readAsText(file);

    // Reset input for same file selection
    input.value = '';
}

// Check duplicates
async function checkDuplicateGames() {
    const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const resultDiv = document.getElementById('duplicateCheckResult');
    const btn = document.querySelector('button[onclick="checkDuplicateGames()"]');

    if (!resultDiv) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kontroluji...';
    resultDiv.style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/chess/duplicates`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();

        resultDiv.style.display = 'block';

        if (data.count === 0) {
            resultDiv.style.border = '1px solid #4ade80';
            resultDiv.style.background = 'rgba(74, 222, 128, 0.1)';
            resultDiv.innerHTML = '<i class="fa-solid fa-check-circle" style="color: #4ade80;"></i> Žádné duplicity nenalezeny.';
        } else {
            resultDiv.style.border = '1px solid #ef4444';
            resultDiv.style.background = 'rgba(239, 68, 68, 0.1)';

            let html = `<div style="color: #ef4444; margin-bottom: 0.5rem;"><i class="fa-solid fa-exclamation-triangle"></i> Nalezeno ${data.count} skupin duplicit:</div>`;
            html += '<ul style="margin: 0; padding-left: 1.5rem; font-size: 0.9rem; color: var(--text-muted);">';

            data.duplicates.forEach(d => {
                html += `<li>
                    <strong>${d.signature.date}</strong>: ${d.signature.white} vs ${d.signature.black} (${d.count}x)
                    <br><span style="font-size: 0.8rem; opacity: 0.7">IDs: ${d.ids.join(', ')}</span>
                </li>`;
            });
            html += '</ul>';

            // Add Clean Button
            html += `<div style="margin-top: 1rem; border-top: 1px solid rgba(239, 68, 68, 0.2); padding-top: 1rem;">
                <button onclick="cleanDuplicateGames()" class="btn-delete" style="width: 100%;">
                    <i class="fa-solid fa-trash"></i> Smazat duplicity (ponechat vždy jednu)
                </button>
            </div>`;

            resultDiv.innerHTML = html;
        }

    } catch (error) {
        console.error('Check failed:', error);
        resultDiv.style.display = 'block';
        resultDiv.style.border = '1px solid #ef4444';
        resultDiv.innerHTML = 'Chyba při kontrole duplicit.';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-search"></i> Zkontrolovat duplicity';
    }
}

// Clean duplicates
async function cleanDuplicateGames() {
    if (!confirm('Opravdu chcete smazat všechny nalezené duplicity? Ze každé skupiny zůstane zachována jen jedna (nejstarší) verze. Tato akce je nevratná.')) {
        return;
    }

    const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const resultDiv = document.getElementById('duplicateCheckResult');

    // Disable clean button inside resultDiv
    const cleanBtn = resultDiv.querySelector('button');
    if (cleanBtn) {
        cleanBtn.disabled = true;
        cleanBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mažu...';
    }

    try {
        const res = await fetch(`${API_URL}/chess/duplicates`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();

        if (data.success) {
            alert(`Hotovo! Smazáno ${data.deleted} duplicitních partií.`);
            // Re-run check to verify
            checkDuplicateGames();
            // Reload stats
            loadChessDBStats();
        } else {
            alert('Chyba při mazání: ' + (data.error || 'Neznámá chyba'));
        }
    } catch (error) {
        console.error('Delete failed:', error);
        alert('Chyba spojení.');
    }
}

// Export to window for access from HTML
window.loadChessDBStats = loadChessDBStats;
window.importChessGames = importChessGames;
window.loadPgnFile = loadPgnFile;
window.checkDuplicateGames = checkDuplicateGames;
window.cleanDuplicateGames = cleanDuplicateGames;
