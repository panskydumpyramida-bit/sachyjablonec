/**
 * Admin Puzzle Racer Module
 * Puzzle Racer settings management
 */

// ================================
// PUZZLE RACER SETTINGS
// ================================

async function loadPuzzleRacerSettings() {
    try {
        const res = await fetch(`${API_URL}/racer/settings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (res.ok) {
            const settings = await res.json();

            // Populate form fields
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) {
                    if (el.type === 'checkbox') el.checked = val;
                    else el.value = val;
                }
            };

            setVal('prTheme', settings.puzzleTheme || 'mixed');
            setVal('prTimeLimit', settings.timeLimitSeconds || 180);
            setVal('prLivesEnabled', settings.livesEnabled ?? true);
            setVal('prMaxLives', settings.maxLives || 3);
            setVal('prPuzzlesPerDifficulty', settings.puzzlesPerDifficulty || 5);
            setVal('prPenaltyEnabled', settings.penaltyEnabled ?? false);
            setVal('prPenaltySeconds', settings.penaltySeconds || 5);
            setVal('prSkipOnMistake', settings.skipOnMistake ?? false);
            setVal('prRandomizePuzzles', settings.randomizePuzzles ?? true);

            // Show/hide dependent fields
            const livesGroup = document.getElementById('prMaxLivesGroup');
            if (livesGroup) livesGroup.style.display = settings.livesEnabled ? 'block' : 'none';

            const penaltyGroup = document.getElementById('prPenaltySecondsGroup');
            if (penaltyGroup) penaltyGroup.style.display = settings.penaltyEnabled ? 'block' : 'none';
        }
    } catch (e) {
        console.error('Load Puzzle Racer settings error:', e);
    }
}

async function savePuzzleRacerSettings() {
    const btn = document.getElementById('savePrSettingsBtn');
    const result = document.getElementById('prSettingsResult');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ukládám...';
    }
    if (result) result.textContent = '';

    try {
        const res = await fetch(`${API_URL}/racer/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                puzzleTheme: document.getElementById('prTheme')?.value,
                timeLimitSeconds: parseInt(document.getElementById('prTimeLimit')?.value) || 180,
                livesEnabled: document.getElementById('prLivesEnabled')?.checked ?? true,
                maxLives: parseInt(document.getElementById('prMaxLives')?.value) || 3,
                puzzlesPerDifficulty: parseInt(document.getElementById('prPuzzlesPerDifficulty')?.value) || 5,
                penaltyEnabled: document.getElementById('prPenaltyEnabled')?.checked ?? false,
                penaltySeconds: parseInt(document.getElementById('prPenaltySeconds')?.value) || 5,
                skipOnMistake: document.getElementById('prSkipOnMistake')?.checked ?? false,
                randomizePuzzles: document.getElementById('prRandomizePuzzles')?.checked ?? true
            })
        });

        if (res.ok) {
            if (result) result.innerHTML = '<span style="color: #4ade80;"><i class="fa-solid fa-check"></i> Uloženo!</span>';
        } else {
            if (result) result.innerHTML = '<span style="color: #fca5a5;">Chyba při ukládání</span>';
        }
    } catch (e) {
        console.error(e);
        if (result) result.innerHTML = '<span style="color: #fca5a5;">Chyba spojení</span>';
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-save"></i> Uložit nastavení';
        }
    }
}

async function regeneratePuzzles() {
    const btn = event?.target;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generuji...';
    }

    try {
        const res = await fetch(`${API_URL}/racer/regenerate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (res.ok) {
            alert('Nová sada byla vygenerována (cache smazána). Při příští hře se načtou nové úlohy.');
        } else {
            alert('Chyba při generování.');
        }
    } catch (e) {
        console.error(e);
        alert('Chyba spojení.');
    } finally {
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-sync"></i> Regenerovat úlohy';
            btn.disabled = false;
        }
    }
}

// Toggle visibility of dependent settings fields
document.addEventListener('DOMContentLoaded', () => {
    const livesCheck = document.getElementById('prLivesEnabled');
    const penaltyCheck = document.getElementById('prPenaltyEnabled');

    if (livesCheck) {
        livesCheck.addEventListener('change', () => {
            const group = document.getElementById('prMaxLivesGroup');
            if (group) group.style.display = livesCheck.checked ? 'block' : 'none';
        });
    }

    if (penaltyCheck) {
        penaltyCheck.addEventListener('change', () => {
            const group = document.getElementById('prPenaltySecondsGroup');
            if (group) group.style.display = penaltyCheck.checked ? 'block' : 'none';
        });
    }
});

// ================================
// UI STATE TOGGLES
// ================================

/**
 * Toggle visibility of the "Generate new set" button
 * based on randomize checkbox state
 */
function togglePrRandomizeUI() {
    const isRandom = document.getElementById('prRandomizePuzzles')?.checked;
    const btn = document.getElementById('prRefreshSetBtn');
    if (btn) btn.style.display = isRandom ? 'none' : 'block';
}

/**
 * Refresh the fixed puzzle set (when randomization is off)
 */
async function refreshPrFixedSet() {
    if (!confirm('Opravdu chcete vygenerovat novou sadu úloh? Stará sada bude zahozena.')) return;

    const btn = document.getElementById('prRefreshSetBtn');
    const originalText = btn?.innerHTML || '';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generuji...';
        btn.disabled = true;
    }

    try {
        const res = await fetch(`${API_URL}/racer/settings/refresh-set`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            alert('Nová sada byla vygenerována (cache smazána). Při příští hře se načtou nové úlohy.');
        } else {
            alert('Chyba při generování.');
        }
    } catch (e) {
        console.error(e);
        alert('Chyba spojení.');
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

// Export for global access
window.loadPuzzleRacerSettings = loadPuzzleRacerSettings;
window.savePuzzleRacerSettings = savePuzzleRacerSettings;
window.regeneratePuzzles = regeneratePuzzles;
window.togglePrRandomizeUI = togglePrRandomizeUI;
window.refreshPrFixedSet = refreshPrFixedSet;

