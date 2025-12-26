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

// Export to window for access from HTML
window.loadChessDBStats = loadChessDBStats;
window.importChessGames = importChessGames;
window.loadPgnFile = loadPgnFile;
