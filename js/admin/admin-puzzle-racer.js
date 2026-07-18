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
let selectedPuzzleCampHistoryId = null;
let loadedPuzzleCampHistoryId = null;
let puzzleCampAdminSessions = [];
let puzzleCampAdminPlayers = [];

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

function formatCampAdminDuration(milliseconds) {
    const seconds = Math.max(0, Math.round((Number(milliseconds) || 0) / 1000));
    const minutes = Math.floor(seconds / 60);
    return minutes ? `${minutes}:${String(seconds % 60).padStart(2, '0')}` : `${seconds} s`;
}

function formatCampAdminDate(value) {
    return new Date(value).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

function renderCampAdminBadges(badges = []) {
    if (!badges.length) return '<span class="camp-racer-no-badge">Zatím bez odznaku</span>';
    return `<span class="camp-racer-badges">${badges.map(badge => `
        <span class="camp-racer-badge" title="${campAdminEscape(badge.description)}"><b>${campAdminEscape(badge.icon)}</b>${campAdminEscape(badge.name)}</span>
    `).join('')}</span>`;
}

function renderPuzzleCampHistorySelector(sessions = [], players = []) {
    const select = document.getElementById('prCampHistorySelect');
    const deleteButton = document.getElementById('prCampDeleteBtn');
    if (!select) return;
    puzzleCampAdminSessions = sessions;
    puzzleCampAdminPlayers = players;
    if (!sessions.length) {
        selectedPuzzleCampHistoryId = null;
        select.innerHTML = '<option value="">Zatím žádná rozcvička</option>';
        select.disabled = true;
        if (deleteButton) {
            deleteButton.disabled = true;
            deleteButton.title = 'Zatím není co smazat';
        }
        renderPuzzleCampMakeup();
        return;
    }

    select.disabled = false;
    if (!sessions.some(session => session.id === selectedPuzzleCampHistoryId)) {
        selectedPuzzleCampHistoryId = sessions[0].id;
    }
    const labels = { scheduled: 'čeká', live: 'živě', finished: 'hotovo' };
    select.innerHTML = sessions.map(session => `
        <option value="${session.id}" ${session.id === selectedPuzzleCampHistoryId ? 'selected' : ''}>
            ${formatCampAdminDate(session.startsAt)} · ${campAdminEscape(session.title)} · ${labels[session.status] || session.status}
        </option>
    `).join('');
    updatePuzzleCampDeleteButton();
    renderPuzzleCampMakeup();
}

function updatePuzzleCampDeleteButton() {
    const button = document.getElementById('prCampDeleteBtn');
    if (!button) return;
    const selected = puzzleCampAdminSessions.find(session => session.id === selectedPuzzleCampHistoryId);
    const canDelete = selected?.status === 'finished';
    button.disabled = !canDelete;
    button.title = canDelete
        ? 'Trvale smaže rozcvičku včetně všech výsledků'
        : 'Smazat lze pouze ukončenou rozcvičku';
}

function updatePuzzleCampMakeupButton() {
    const session = puzzleCampAdminSessions.find(item => item.id === selectedPuzzleCampHistoryId);
    const select = document.getElementById('prCampMakeupPlayer');
    const button = document.getElementById('prCampMakeupGrantBtn');
    if (!button) return;
    button.disabled = session?.status !== 'finished' || !Number.parseInt(select?.value, 10);
}

function renderPuzzleCampMakeup() {
    const session = puzzleCampAdminSessions.find(item => item.id === selectedPuzzleCampHistoryId);
    const select = document.getElementById('prCampMakeupPlayer');
    const list = document.getElementById('prCampMakeupList');
    if (!select || !list) return;

    const access = session?.makeupPlayers || [];
    const unavailableIds = new Set([
        ...access.map(player => player.userId),
        ...(session?.completedUserIds || [])
    ]);
    const eligible = puzzleCampAdminPlayers.filter(player => !unavailableIds.has(player.id));

    if (session?.status !== 'finished') {
        select.innerHTML = '<option value="">Nejprve vyberte ukončenou rozcvičku</option>';
        select.disabled = true;
    } else if (!eligible.length) {
        select.innerHTML = '<option value="">Všichni dostupní hráči už mají výsledek nebo povolení</option>';
        select.disabled = true;
    } else {
        select.disabled = false;
        select.innerHTML = '<option value="">Vyberte hráče…</option>' + eligible.map(player => {
            const account = player.playerName === player.username ? '' : ` · ${player.username}`;
            return `<option value="${player.id}">${campAdminEscape(player.playerName)}${campAdminEscape(account)}</option>`;
        }).join('');
    }

    if (!access.length) {
        list.innerHTML = '<span class="camp-racer-makeup__empty">Nikdo zatím nemá povolený náhradní termín.</span>';
    } else {
        list.innerHTML = access.map(player => {
            const playing = player.status === 'makeup_playing';
            return `
                <span class="camp-racer-makeup-player">
                    <i class="fa-solid ${playing ? 'fa-bolt' : 'fa-clock'}"></i>
                    ${campAdminEscape(player.playerName)}
                    <small>${playing ? 'právě hraje' : 'čeká na spuštění'}</small>
                    <button type="button" title="${playing ? 'Rozehraný pokus už nelze odebrat' : 'Odebrat povolení'}" onclick="revokePuzzleCampMakeup(${player.userId})" ${playing ? 'disabled' : ''}>
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </span>
            `;
        }).join('');
    }
    updatePuzzleCampMakeupButton();
}

function renderPuzzleCampHistory(detail) {
    const summary = document.getElementById('prCampHistorySummary');
    const players = document.getElementById('prCampHistoryPlayers');
    if (!summary || !players) return;
    if (!detail) {
        summary.innerHTML = '<div><strong>–</strong><span>účastníků</span></div><div><strong>–</strong><span>průměrně vyřešeno</span></div><div><strong>–</strong><span>úloh v sadě</span></div><div><strong>–</strong><span>nejvyšší skóre</span></div>';
        players.innerHTML = '<div class="camp-racer-empty"><i class="fa-solid fa-list-check"></i><span>Pro tento den zatím nejsou dostupná data.</span></div>';
        return;
    }

    const participants = detail.participants || [];
    const puzzleCount = detail.puzzles?.length || detail.session?.puzzleCount || 0;
    const averageCorrect = participants.length
        ? (participants.reduce((sum, player) => sum + player.correctCount, 0) / participants.length).toFixed(1).replace('.0', '')
        : '0';
    const bestScore = participants.length ? Math.max(...participants.map(player => player.score)) : 0;
    summary.innerHTML = `
        <div><strong>${participants.length}</strong><span>účastníků</span></div>
        <div><strong>${averageCorrect}</strong><span>průměrně vyřešeno</span></div>
        <div><strong>${puzzleCount}</strong><span>úloh v sadě</span></div>
        <div><strong>${bestScore}</strong><span>nejvyšší skóre</span></div>
    `;

    if (!participants.length) {
        players.innerHTML = '<div class="camp-racer-empty"><i class="fa-solid fa-user-clock"></i><span>Do této rozcvičky se nikdo nepřipojil.</span></div>';
        return;
    }

    players.innerHTML = participants.map(player => {
        const cellsByIndex = new Map((player.cells || []).map(cell => [cell.puzzleIndex, cell]));
        const puzzleCells = detail.puzzles.map(puzzle => {
            const cell = cellsByIndex.get(puzzle.index);
            if (!cell) return `<span class="camp-racer-puzzle camp-racer-puzzle--empty" title="Úloha ${puzzle.index + 1} · bez pokusu"><b>${puzzle.index + 1}</b><small>—</small></span>`;
            const state = cell.correct ? 'correct' : cell.skipped ? 'skipped' : 'wrong';
            const value = cell.correct ? formatCampAdminDuration(cell.responseMs) : cell.skipped ? 'přeskočeno' : 'chyba';
            const detailText = `${cell.wrongAttempts || 0} chyb · ${cell.points || 0} bodů`;
            return `<span class="camp-racer-puzzle camp-racer-puzzle--${state}" title="Úloha ${puzzle.index + 1} · ${value} · ${detailText}"><b>${puzzle.index + 1}</b><small>${value}</small></span>`;
        }).join('');

        return `
            <details class="camp-racer-history-player">
                <summary>
                    <span class="camp-racer-history-player__rank">${player.rank}.</span>
                    <span class="camp-racer-history-player__name"><strong>${campAdminEscape(player.playerName)}</strong>${renderCampAdminBadges(player.badges)}</span>
                    <span class="camp-racer-history-player__metric"><strong>${player.score}</strong><small>bodů</small></span>
                    <span class="camp-racer-history-player__metric"><strong>${player.correctCount}/${puzzleCount}</strong><small>vyřešeno</small></span>
                    <i class="fa-solid fa-chevron-down"></i>
                </summary>
                <div class="camp-racer-history-player__detail">
                    <div class="camp-racer-history-player__stats">
                        <span><b>${player.wrongCount}</b> chybné tahy</span>
                        <span><b>${player.skippedCount}</b> přeskočeno</span>
                        <span><b>${player.maxStreak}</b> nejdelší série</span>
                        <span><b>${formatCampAdminDuration(player.durationMs)}</b> čas v úlohách</span>
                    </div>
                    <div class="camp-racer-puzzles">${puzzleCells}</div>
                </div>
            </details>
        `;
    }).join('');
}

async function loadPuzzleCampHistory(sessionId) {
    if (!sessionId) return renderPuzzleCampHistory(null);
    const players = document.getElementById('prCampHistoryPlayers');
    if (players) players.setAttribute('aria-busy', 'true');
    try {
        const res = await fetch(`${API_URL}/racer/camp/leaderboard?sessionId=${sessionId}`, { headers: campAdminTokenHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        loadedPuzzleCampHistoryId = Number(sessionId);
        renderPuzzleCampHistory(data.sessionDetail);
    } catch (error) {
        console.error('Camp history load error:', error);
        renderPuzzleCampHistory(null);
    } finally {
        if (players) players.setAttribute('aria-busy', 'false');
    }
}

function selectPuzzleCampHistory(value) {
    selectedPuzzleCampHistoryId = Number.parseInt(value, 10) || null;
    updatePuzzleCampDeleteButton();
    renderPuzzleCampMakeup();
    const notice = document.getElementById('prCampMakeupNotice');
    if (notice) notice.textContent = '';
    return loadPuzzleCampHistory(selectedPuzzleCampHistoryId);
}

async function grantPuzzleCampMakeup() {
    const session = puzzleCampAdminSessions.find(item => item.id === selectedPuzzleCampHistoryId);
    const select = document.getElementById('prCampMakeupPlayer');
    const button = document.getElementById('prCampMakeupGrantBtn');
    const notice = document.getElementById('prCampMakeupNotice');
    const userId = Number.parseInt(select?.value, 10);
    const player = puzzleCampAdminPlayers.find(item => item.id === userId);
    if (!session || session.status !== 'finished' || !player) return;
    if (!confirm(`Povolit hráči ${player.playerName} dodatečně odehrát „${session.title}“ se stejnou sadou a plným časem?`)) return;

    const original = button?.innerHTML || '';
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Povolujeme…';
    }
    try {
        const res = await fetch(`${API_URL}/racer/camp/sessions/${session.id}/makeup`, {
            method: 'POST',
            headers: campAdminTokenHeaders(true),
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Náhradní termín se nepodařilo povolit');
        await loadPuzzleCampAdmin(true);
        if (notice) notice.innerHTML = `<span style="color:#4ade80"><i class="fa-solid fa-circle-check"></i> ${campAdminEscape(data.access.playerName)} může rozcvičku dodatečně spustit.</span>`;
    } catch (error) {
        if (notice) notice.innerHTML = `<span style="color:#fca5a5"><i class="fa-solid fa-triangle-exclamation"></i> ${campAdminEscape(error.message)}</span>`;
    } finally {
        if (button) button.innerHTML = original;
        updatePuzzleCampMakeupButton();
    }
}

async function revokePuzzleCampMakeup(userId) {
    const session = puzzleCampAdminSessions.find(item => item.id === selectedPuzzleCampHistoryId);
    const access = session?.makeupPlayers?.find(player => player.userId === userId);
    const notice = document.getElementById('prCampMakeupNotice');
    if (!session || !access || access.status === 'makeup_playing') return;
    if (!confirm(`Odebrat hráči ${access.playerName} možnost dodatečného dohrání?`)) return;

    try {
        const res = await fetch(`${API_URL}/racer/camp/sessions/${session.id}/makeup/${userId}`, {
            method: 'DELETE',
            headers: campAdminTokenHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Povolení se nepodařilo odebrat');
        await loadPuzzleCampAdmin(true);
        if (notice) notice.innerHTML = `<span style="color:#94a3b8"><i class="fa-solid fa-lock"></i> Povolení pro ${campAdminEscape(access.playerName)} bylo odebráno.</span>`;
    } catch (error) {
        if (notice) notice.innerHTML = `<span style="color:#fca5a5"><i class="fa-solid fa-triangle-exclamation"></i> ${campAdminEscape(error.message)}</span>`;
    }
}

async function deleteSelectedPuzzleCampHistory() {
    const session = puzzleCampAdminSessions.find(item => item.id === selectedPuzzleCampHistoryId);
    if (!session || session.status !== 'finished') return;

    const count = session.participantCount || 0;
    const players = count === 1 ? '1 hráče' : `${count} hráčů`;
    const confirmed = confirm(
        `Opravdu trvale smazat „${session.title}“ a výsledky ${players}?\n\nTuto akci nelze vrátit.`
    );
    if (!confirmed) return;

    const button = document.getElementById('prCampDeleteBtn');
    const notice = document.getElementById('prCampHistoryNotice');
    const original = button?.innerHTML || '';
    if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mažu…';
    }

    try {
        const res = await fetch(`${API_URL}/racer/camp/sessions/${session.id}`, {
            method: 'DELETE',
            headers: campAdminTokenHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Rozcvičku se nepodařilo smazat');

        selectedPuzzleCampHistoryId = null;
        loadedPuzzleCampHistoryId = null;
        await loadPuzzleCampAdmin(true);
        if (notice) notice.innerHTML = `<span style="color:#4ade80"><i class="fa-solid fa-circle-check"></i> „${campAdminEscape(data.title)}“ byla trvale smazána.</span>`;
    } catch (error) {
        if (notice) notice.innerHTML = `<span style="color:#fca5a5"><i class="fa-solid fa-triangle-exclamation"></i> ${campAdminEscape(error.message)}</span>`;
    } finally {
        if (button) button.innerHTML = original;
        updatePuzzleCampDeleteButton();
    }
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
        renderPuzzleCampHistorySelector(data.sessions, data.players);
        const session = data.sessions.find(item => ['scheduled', 'live'].includes(item.status)) || data.sessions[0] || null;
        const selectedHistory = data.sessions.find(item => item.id === selectedPuzzleCampHistoryId);
        const shouldRefreshHistory = loadedPuzzleCampHistoryId !== selectedPuzzleCampHistoryId
            || ['scheduled', 'live'].includes(selectedHistory?.status);
        renderPuzzleCampStatus(session, session?.participantCount || 0);
        await Promise.all([
            loadPuzzleCampLeaderboard(session?.id),
            shouldRefreshHistory ? loadPuzzleCampHistory(selectedPuzzleCampHistoryId) : Promise.resolve()
        ]);

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
window.selectPuzzleCampHistory = selectPuzzleCampHistory;
window.deleteSelectedPuzzleCampHistory = deleteSelectedPuzzleCampHistory;
window.updatePuzzleCampMakeupButton = updatePuzzleCampMakeupButton;
window.grantPuzzleCampMakeup = grantPuzzleCampMakeup;
window.revokePuzzleCampMakeup = revokePuzzleCampMakeup;
