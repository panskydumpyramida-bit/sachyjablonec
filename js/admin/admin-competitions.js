/**
 * Admin Competitions Module
 * Handles competition sources and standings updates
 */

// Get API_URL and authToken from global scope (defined in admin.html)
const getApiUrl = () => window.API_URL || '';
const getAuthToken = () => window.authToken || localStorage.getItem('authToken') || '';

// Helper for escaping HTML (from parent)
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Update standings from chess.cz
 * Triggers server-side scraping and database update
 */
async function updateStandings() {
    const btn = document.getElementById('updateStandingsBtn');
    const resultDiv = document.getElementById('standingsResult');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Načítám...';
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p style="color: var(--text-muted);">Stahují se data ze soutěží...</p>';

    try {
        const res = await fetch(`${getApiUrl()}/standings/update`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });

        if (res.ok) {
            const data = await res.json();

            let html = '<div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">';
            html += '<h4 style="color: #10b981; margin: 0 0 0.5rem 0;"><i class="fa-solid fa-check-circle"></i> Aktualizace úspěšná</h4>';
            html += '<ul style="margin: 0; padding-left: 1.5rem; color: var(--text-color);">';

            if (data.standings && Array.isArray(data.standings)) {
                data.standings.forEach(comp => {
                    const count = comp.standings ? comp.standings.length : 0;
                    if (comp.error) {
                        html += `<li style="color: #fca5a5;">${escapeHtml(comp.name)}: Chyba - ${escapeHtml(comp.error)}</li>`;
                    } else {
                        html += `<li>${escapeHtml(comp.name)}: načteno ${count} týmů</li>`;
                    }
                });
            }
            html += '</ul></div>';

            resultDiv.innerHTML = html;
            window.showToast?.('Tabulky aktualizovány', 'success');
        } else {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Server error ' + res.status);
        }
    } catch (e) {
        console.error(e);
        resultDiv.innerHTML = `<p style="color: #fca5a5;"><i class="fa-solid fa-exclamation-triangle"></i> Nepodařilo se načíst tabulky: ${e.message}</p>`;
        window.showToast?.('Chyba: ' + e.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-sync"></i> Aktualizovat tabulky';
}

/**
 * Load competition sources into the UI
 */
async function loadCompetitions() {
    try {
        const res = await fetch(`${getApiUrl()}/competitions`);
        let competitions = await res.json();

        // Sort by ID to keep stable order when toggling active status
        competitions.sort((a, b) => a.id.localeCompare(b.id));

        const container = document.getElementById('competitionsList');

        container.innerHTML = competitions.map(c => `
            <div style="background: rgba(255, 255, 255, 0.05); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" id="active_${c.id}" ${c.active !== false ? 'checked' : ''} onchange="toggleCompetitionActive('${c.id}', this.checked)" title="Aktivní/Neaktivní">
                    <div style="overflow: hidden;">
                        <strong style="display: block; font-size: 0.9rem; color: var(--primary-color); ${c.active === false ? 'opacity: 0.5;' : ''}">${c.name}</strong>
                        <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;" title="${c.url || 'Není nastaveno'}">
                            ${c.url || '<span style="color: #fca5a5;">URL nenastaveno (vyžadováno pro aktivaci)</span>'}
                        </div>
                    </div>
                </div>
                <button class="btn-secondary btn-small" onclick="changeSourceUrl('${c.id}', '${escapeHtml(c.url || '')}')" title="Změnit URL">
                    <i class="fa-solid fa-pen"></i> URL
                </button>
            </div>
        `).join('');
    } catch (e) {
        console.error('Error loading competitions:', e);
    }
}

/**
 * Toggle competition active status
 */
async function toggleCompetitionActive(id, active) {
    try {
        const res = await fetch(`${getApiUrl()}/competitions/${id}/url`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
            body: JSON.stringify({ active })
        });
        if (res.ok) {
            loadCompetitions(); // Refresh UI
        } else {
            alert('Chyba při změně stavu.');
            loadCompetitions(); // Revert UI
        }
    } catch (e) { console.error(e); }
}

/**
 * Change competition source URL
 */
async function changeSourceUrl(id, currentUrl) {
    const newUrl = prompt('Zadejte nové URL pro zdroj dat:', currentUrl);
    // Allow empty string to clear it, but checking for null (cancel)
    if (newUrl !== null && newUrl !== currentUrl) {
        try {
            const res = await fetch(`${getApiUrl()}/competitions/${id}/url`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({ url: newUrl })
            });

            if (res.ok) {
                window.showToast?.('URL aktualizováno', 'success');
                loadCompetitions();
            } else {
                window.showToast?.('Chyba aktualizace', 'error');
            }
        } catch (e) {
            console.error(e);
            window.showToast?.('Chyba spojení', 'error');
        }
    }
}

// Export functions to window for use in admin.html
window.updateStandings = updateStandings;
window.loadCompetitions = loadCompetitions;
window.toggleCompetitionActive = toggleCompetitionActive;
window.changeSourceUrl = changeSourceUrl;
