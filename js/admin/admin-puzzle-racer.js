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
    } finally {
        loadPuzzleCampAdmin();
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

// ================================
// PARDUBICE 2026 · DENNÍ ROZCVIČKA
// ================================

let activePuzzleCampSession = null;
let puzzleCampServerOffset = 0;
let puzzleCampClockTimer = null;
let puzzleCampPollTimer = null;

function campAdminEscape(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function campAdminTokenHeaders(json = false) {
    const headers = { 'Authorization': `Bearer ${authToken}` };
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
}

function formatCampCountdown(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function renderPuzzleCampClock() {
    if (!activePuzzleCampSession) return;
    const statusEl = document.getElementById('prCampStatus');
    if (!statusEl) return;

    const now = Date.now() + puzzleCampServerOffset;
    const startsAt = new Date(activePuzzleCampSession.startsAt).getTime();
    const endsAt = new Date(activePuzzleCampSession.endsAt).getTime();
    const countdown = statusEl.querySelector('[data-camp-countdown]');
    if (!countdown) return;

    if (activePuzzleCampSession.status === 'scheduled') {
        countdown.textContent = formatCampCountdown(startsAt - now);
    } else if (activePuzzleCampSession.status === 'live') {
        countdown.textContent = formatCampCountdown(endsAt - now);
    }
}

function renderPuzzleCampStatus(session, participantCount = 0) {
    const statusEl = document.getElementById('prCampStatus');
    const titleEl = document.getElementById('prCampLiveTitle');
    const countEl = document.getElementById('prCampParticipantCount');
    const actionsEl = document.getElementById('prCampActions');
    if (!statusEl || !titleEl || !countEl || !actionsEl) return;

    activePuzzleCampSession = session;
    countEl.textContent = `${participantCount} ${participantCount === 1 ? 'hráč' : participantCount < 5 ? 'hráči' : 'hráčů'}`;

    if (!session) {
        statusEl.className = 'camp-racer-status camp-racer-status--idle';
        statusEl.innerHTML = '<div class="camp-racer-status__icon"><i class="fa-solid fa-mug-hot"></i></div><div><strong>Zatím není naplánovaná rozcvička</strong><span>Vyplňte parametry a připravte dnešní společný start.</span></div>';
        titleEl.textContent = 'Čekáme na další den';
        actionsEl.classList.add('hidden');
        return;
    }

    titleEl.textContent = session.title;
    actionsEl.classList.toggle('hidden', !['scheduled', 'live'].includes(session.status));
    const startButton = actionsEl.querySelector('button:nth-child(1)');
    const finishButton = actionsEl.querySelector('button:nth-child(2)');
    if (startButton) startButton.classList.toggle('hidden', session.status !== 'scheduled');
    if (finishButton) finishButton.classList.toggle('hidden', session.status !== 'live');

    const statusMap = {
        scheduled: {
            icon: 'fa-hourglass-start',
            title: `${campAdminEscape(session.title)} čeká na start`,
            detail: `Společný start za <strong data-camp-countdown>${formatCampCountdown(new Date(session.startsAt).getTime() - (Date.now() + puzzleCampServerOffset))}</strong> · ${session.puzzleCount} úloh · ${Math.round(session.durationSeconds / 6) / 10} min`
        },
        live: {
            icon: 'fa-bolt',
            title: `${campAdminEscape(session.title)} právě běží`,
            detail: `Do konce <strong data-camp-countdown>${formatCampCountdown(new Date(session.endsAt).getTime() - (Date.now() + puzzleCampServerOffset))}</strong> · průběžné výsledky se aktualizují živě`
        },
        finished: {
            icon: 'fa-flag-checkered',
            title: `${campAdminEscape(session.title)} je dokončena`,
            detail: `${participantCount} účastníků · výsledky zůstávají v celosoustřeďkovém žebříčku`
        }
    };
    const content = statusMap[session.status] || statusMap.finished;
    statusEl.className = `camp-racer-status camp-racer-status--${session.status}`;
    statusEl.innerHTML = `<div class="camp-racer-status__icon"><i class="fa-solid ${content.icon}"></i></div><div><strong>${content.title}</strong><span>${content.detail}</span></div>`;
    renderPuzzleCampClock();
}

function renderPuzzleCampLiveBoard(detail) {
    const boardEl = document.getElementById('prCampLiveBoard');
    if (!boardEl) return;
    const participants = detail?.participants || [];

    if (!participants.length) {
        boardEl.innerHTML = '<div class="camp-racer-empty"><i class="fa-solid fa-satellite-dish"></i><span>Zatím se nikdo nepřipojil. Hráči uvidí odpočet v režimu Pardubice 2026.</span></div>';
        return;
    }

    boardEl.innerHTML = participants.slice(0, 10).map(player => `
        <div class="camp-racer-player-row">
            <span class="camp-racer-player-row__rank">${player.rank}</span>
            <div>
                <div class="camp-racer-player-row__name">${campAdminEscape(player.playerName)}</div>
                <div class="camp-racer-player-row__meta">${player.correctCount}/${detail.puzzles.length} správně · série ${player.maxStreak}</div>
            </div>
            <span class="camp-racer-player-row__score">${player.score} b</span>
        </div>
    `).join('');
}

async function loadPuzzleCampLeaderboard(sessionId) {
    if (!sessionId) {
        renderPuzzleCampLiveBoard(null);
        return;
    }
    try {
        const res = await fetch(`${API_URL}/racer/camp/leaderboard?sessionId=${sessionId}`, {
            headers: campAdminTokenHeaders()
        });
        if (!res.ok) return;
        const data = await res.json();
        renderPuzzleCampLiveBoard(data.sessionDetail);
    } catch (error) {
        console.error('Camp leaderboard admin error:', error);
    }
}

async function loadPuzzleCampAdmin(scheduleNext = true) {
    try {
        const res = await fetch(`${API_URL}/racer/camp/admin`, { headers: campAdminTokenHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        puzzleCampServerOffset = new Date(data.serverTime).getTime() - Date.now();
        const session = data.sessions.find(item => ['scheduled', 'live'].includes(item.status)) || data.sessions[0] || null;
        renderPuzzleCampStatus(session, session?.participantCount || 0);
        await loadPuzzleCampLeaderboard(session?.id);

        clearInterval(puzzleCampClockTimer);
        puzzleCampClockTimer = setInterval(renderPuzzleCampClock, 250);
    } catch (error) {
        console.error('Camp admin load error:', error);
        const result = document.getElementById('prCampCreateResult');
        if (result) result.innerHTML = '<span style="color:#fca5a5">Nepodařilo se načíst táborový režim.</span>';
    } finally {
        clearTimeout(puzzleCampPollTimer);
        if (scheduleNext) {
            puzzleCampPollTimer = setTimeout(() => {
                const view = document.getElementById('puzzleRacerView');
                if (view && !view.classList.contains('hidden')) loadPuzzleCampAdmin(true);
            }, 5000);
        }
    }
}

async function createPuzzleCampSession() {
    const button = document.getElementById('prCampCreateBtn');
    const result = document.getElementById('prCampCreateResult');
    const puzzleCount = Number.parseInt(document.getElementById('prCampPuzzleCount')?.value, 10) || 40;
    const delayMinutes = Number.parseFloat(document.getElementById('prCampStartDelay')?.value) || 3;
    if (!confirm(`Vygenerovat ${puzzleCount} společných úloh a naplánovat start za ${delayMinutes} min?`)) return;

    const original = button?.innerHTML || '';
    if (button) {
        button.disabled = true;
        button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generuji ${puzzleCount} úloh…`;
    }
    if (result) result.innerHTML = '<span style="color:#f8cc6a">Sestavuji jednu férovou sadu pro všechny hráče.</span>';

    try {
        const body = {
            title: document.getElementById('prCampTitle')?.value,
            startDelaySeconds: Math.round(delayMinutes * 60),
            durationSeconds: Math.round((Number.parseFloat(document.getElementById('prCampDuration')?.value) || 4) * 60),
            puzzleCount,
            puzzleTheme: document.getElementById('prCampTheme')?.value || 'mix',
            penaltyEnabled: document.getElementById('prCampPenalty')?.checked === true,
            penaltySeconds: Number.parseInt(document.getElementById('prCampPenaltySeconds')?.value, 10) || 3,
            skipOnMistake: document.getElementById('prCampSkip')?.checked !== false,
            livesEnabled: document.getElementById('prCampLives')?.checked === true,
            maxLives: Number.parseInt(document.getElementById('prCampMaxLives')?.value, 10) || 5
        };
        const res = await fetch(`${API_URL}/racer/camp/sessions`, {
            method: 'POST',
            headers: campAdminTokenHeaders(true),
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Rozcvičku se nepodařilo vytvořit');

        if (result) result.innerHTML = `<span style="color:#4ade80"><i class="fa-solid fa-circle-check"></i> Připraveno ${data.generatedPuzzles} úloh. Odpočet běží.</span>`;
        await loadPuzzleCampAdmin(false);
    } catch (error) {
        if (result) result.innerHTML = `<span style="color:#fca5a5"><i class="fa-solid fa-triangle-exclamation"></i> ${campAdminEscape(error.message)}</span>`;
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = original;
        }
    }
}

async function runPuzzleCampAction(action, confirmation) {
    if (!activePuzzleCampSession || !confirm(confirmation)) return;
    try {
        const res = await fetch(`${API_URL}/racer/camp/sessions/${activePuzzleCampSession.id}/${action}`, {
            method: 'POST',
            headers: campAdminTokenHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Akce se nezdařila');
        await loadPuzzleCampAdmin(false);
    } catch (error) {
        alert(error.message);
    }
}

function startPuzzleCampNow() {
    return runPuzzleCampAction('start-now', 'Odstartovat rozcvičku všem připojeným hráčům právě teď?');
}

function finishPuzzleCampNow() {
    return runPuzzleCampAction('finish-now', 'Opravdu ukončit právě probíhající rozcvičku?');
}

function cancelPuzzleCampSession() {
    return runPuzzleCampAction('cancel', 'Zrušit tuto rozcvičku? Připojeným hráčům se odpočet zastaví.');
}

window.loadPuzzleCampAdmin = loadPuzzleCampAdmin;
window.createPuzzleCampSession = createPuzzleCampSession;
window.startPuzzleCampNow = startPuzzleCampNow;
window.finishPuzzleCampNow = finishPuzzleCampNow;
window.cancelPuzzleCampSession = cancelPuzzleCampSession;
