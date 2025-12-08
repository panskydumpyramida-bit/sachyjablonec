/**
 * Shared logic for Match Cards (Teams and Youth)
 * Handles rendering, navigation, and details expansion.
 */

// Global state for team schedules
window.teamData = window.teamData || {};

/**
 * Initializes match cards for a specific container usage.
 * @param {string} containerId - DOM ID of the container
 * @param {object|Array} inputData - Data object or Array of objects { schedule, teamName, teamUrl, compName }
 */
window.initMatchCard = function (containerId, inputData) {
    if (!window.teamData[containerId]) {
        // Normalize to array
        const teams = Array.isArray(inputData) ? inputData : [inputData];

        // Pre-process each team to find last played match
        teams.forEach(team => {
            let lastPlayedIndex = 0; // Default to 0 (first match) if no matches played
            const hasResult = (r) => r && /\d/.test(r);

            if (team.schedule && team.schedule.length > 0) {
                lastPlayedIndex = 0;
                for (let i = 0; i < team.schedule.length; i++) {
                    if (hasResult(team.schedule[i].result)) {
                        lastPlayedIndex = i;
                    }
                }
            }

            team.currentIndex = lastPlayedIndex;
        });

        window.teamData[containerId] = {
            teams: teams,
            activeTeamIndex: 0
        };
    }

    renderMatchBadge(containerId);
}

window.switchTeam = function (containerId, teamIndex) {
    if (window.teamData && window.teamData[containerId]) {
        if (teamIndex >= 0 && teamIndex < window.teamData[containerId].teams.length) {
            window.teamData[containerId].activeTeamIndex = teamIndex;
            renderMatchBadge(containerId);
        }
    }
}

window.changeMatch = function (containerId, delta) {
    if (window.teamData && window.teamData[containerId]) {
        const state = window.teamData[containerId];
        const activeTeam = state.teams[state.activeTeamIndex];

        const newIndex = activeTeam.currentIndex + delta;
        if (newIndex >= 0 && newIndex < activeTeam.schedule.length) {
            activeTeam.currentIndex = newIndex;
            renderMatchBadge(containerId);
        }
    }
}

function renderMatchBadge(containerId) {
    const container = document.getElementById(containerId);
    const state = window.teamData[containerId];
    if (!container || !state) return;

    const activeTeam = state.teams[state.activeTeamIndex];
    if (!activeTeam) return;

    const match = activeTeam.schedule[activeTeam.currentIndex];
    if (!match) {
        container.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted);">Žádné zápasy</div>';
        return;
    }

    // --- RENDER TEAM SWITCHER ---
    let switcherHtml = '';
    if (state.teams.length > 1) {
        switcherHtml = `<div style="display: flex; gap: 0.5rem; margin-bottom: 0.8rem; overflow-x: auto; padding-bottom: 2px;">`;
        state.teams.forEach((team, idx) => {
            const isActive = idx === state.activeTeamIndex;
            const label = team.teamName.replace(/TJ Bižuterie Jablonec( n\.N\.)? /i, '').replace(/Jablonec( n\.N\.)? /i, '');

            switcherHtml += `
                <button onclick="switchTeam('${containerId}', ${idx})" 
                    style="
                        padding: 0.25rem 0.75rem; 
                        border-radius: 12px; 
                        border: 1px solid ${isActive ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)'}; 
                        background: ${isActive ? 'rgba(212,175,55,0.15)' : 'rgba(0,0,0,0.2)'}; 
                        color: ${isActive ? 'var(--primary-color)' : 'var(--text-muted)'}; 
                        font-size: 0.75rem; 
                        font-weight: 600; 
                        cursor: pointer; 
                        white-space: nowrap;
                        transition: all 0.2s;
                    "
                    onmouseover="this.style.borderColor='var(--primary-color)'"
                    onmouseout="this.style.borderColor='${isActive ? 'var(--primary-color)' : 'rgba(255,255,255,0.1)'}'"
                >
                    ${label}
                </button>
            `;
        });
        switcherHtml += `</div>`;
    }

    // --- RENDER MATCH CARD ---
    const isLast = activeTeam.currentIndex === activeTeam.schedule.length - 1;
    const isFirst = activeTeam.currentIndex === 0;

    // Analyze result
    const hasResult = match.result && /\d/.test(match.result);
    let statusIcon = '📅'; // Calendar for future
    let statusColor = 'var(--text-muted)';
    let bgColor = 'rgba(255,255,255,0.05)';
    let borderColor = 'rgba(255,255,255,0.1)';

    if (hasResult) {
        const resultParts = match.result.split(':').map(p => parseFloat(p.replace(',', '.')));
        if (resultParts.length === 2) {
            const [home, away] = resultParts;
            const isHome = match.isHome !== false;
            const ourScore = isHome ? home : away;
            const theirScore = isHome ? away : home;

            if (ourScore > theirScore) {
                statusIcon = '✅';
                statusColor = '#4ade80';
                bgColor = 'rgba(74,222,128,0.15)';
                borderColor = '#4ade80';
            } else if (ourScore < theirScore) {
                statusIcon = '❌';
                statusColor = '#f87171';
                bgColor = 'rgba(248,113,113,0.15)';
                borderColor = '#f87171';
            } else {
                statusIcon = '🤝';
                statusColor = '#fbbf24';
                bgColor = 'rgba(251,191,36,0.15)';
                borderColor = '#fbbf24';
            }
        }
    } else {
        // Future match
        borderColor = 'var(--primary-color)';
        bgColor = 'rgba(212,175,55,0.1)';
        statusColor = 'var(--primary-color)';
    }

    // Prepare details data
    const detailsId = `details-${containerId}`;
    const matchUrl = activeTeam.teamUrl;
    // Only clickable for details IF played
    const canShowDetails = hasResult;

    // Format date to Czech "d. m. yyyy"
    let formattedDate = match.date;
    try {
        if (match.date.includes('/')) {
            const parts = match.date.split('/');
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    const d = new Date(match.date);
                    formattedDate = d.toLocaleDateString('cs-CZ');
                } else {
                    formattedDate = `${parseInt(parts[0])}. ${parseInt(parts[1])}. ${parts[2]}`;
                }
            }
        } else if (match.date.includes('.')) {
            const parts = match.date.split('.');
            if (parts.length >= 3) {
                formattedDate = `${parseInt(parts[0])}. ${parseInt(parts[1])}. ${parts[2].trim()}`;
            }
        }
    } catch (e) {
        console.warn('Date formatting failed', e);
    }

    // Determine Home/Away
    const isHome = match.isHome !== false;
    const homeAwayLabel = isHome ? 'DOMA' : 'VENKU';
    const homeAwayColor = isHome ? 'var(--text-color)' : 'var(--text-muted)';
    const homeAwayBg = isHome ? 'rgba(255, 255, 255, 0.1)' : 'transparent';

    container.innerHTML = `
        ${switcherHtml}
        <div style="display: flex; align-items: center; gap: 0.25rem;">
            <!-- Prev Button -->
            <button onclick="changeMatch('${containerId}', -1)"
                style="background: transparent; border: none; color: var(--text-muted); width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: ${isFirst ? 0.2 : 0.8}; pointer-events: ${isFirst ? 'none' : 'auto'}; transition: all 0.2s; font-size: 1.1rem; border-radius: 50%;"
                onmouseover="this.style.backgroundColor='rgba(255,255,255,0.05)'; this.style.color='var(--text-color)'"
                onmouseout="this.style.backgroundColor='transparent'; this.style.color='var(--text-muted)'">
                <i class="fa-solid fa-chevron-left"></i>
            </button>

            <!-- Main Badge -->
            <div ${canShowDetails ? `onclick="toggleMatchBadgeDetails('${detailsId}', '${encodeURIComponent(matchUrl)}', '${match.round}', '${encodeURIComponent(activeTeam.teamName)}', '${encodeURIComponent(match.opponent)}', this)"` : ''}
                 style="flex: 1; padding: 0.6rem 0.75rem; background: linear-gradient(135deg, ${bgColor} 0%, rgba(0,0,0,0.3) 100%); border-radius: 12px; border: 1px solid ${borderColor}; cursor: ${canShowDetails ? 'pointer' : 'default'}; transition: all 0.2s; box-shadow: 0 4px 15px rgba(0,0,0,0.2); position: relative; overflow: hidden;"
                 onmouseover="${canShowDetails ? 'this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 8px 25px rgba(0,0,0,0.3)\'' : ''}"
                 onmouseout="${canShowDetails ? 'this.style.transform=\'translateY(0)\';this.style.boxShadow=\'0 4px 15px rgba(0,0,0,0.2)\'' : ''}">

                <!-- Status Strip -->
                <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background-color: ${statusColor};"></div>

                <div style="display: flex; flex-direction: column; gap: 0.2rem; padding-left: 0.5rem;">
                     <!-- Top Row: Round + Home/Away -->
                     <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">
                        <span>${match.round}. KOLO • ${formattedDate}</span>
                        <span style="font-weight: 700; color: ${homeAwayColor}; background: ${homeAwayBg}; padding: 1px 6px; border-radius: 4px; font-size: 0.9em;">${homeAwayLabel}</span>
                     </div>

                     <!-- Middle Row: Result and Status -->
                     <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.2rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <span style="font-size: 1.4em; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${statusIcon}</span>
                            <div style="font-weight: 700; color: ${statusColor}; font-size: 1.5em; line-height: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${hasResult ? match.result : ' - : - '}</div>
                        </div>

                        ${canShowDetails ? `
                        <div style="display: flex; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.2rem 0.6rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                            <span style="font-size: 0.7em; color: var(--text-muted); font-weight: 500; text-transform: uppercase;">Detail</span>
                            <i class="fa-solid fa-chevron-down details-icon" style="color: var(--primary-color); font-size: 0.7em; transition: transform 0.2s;"></i>
                        </div>
                        ` : `
                         <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 0.75em; color: var(--text-icon); font-weight: 600; background: rgba(212,175,55,0.1); padding: 0.2em 0.5em; border-radius: 4px; color: var(--primary-color);">BUDOUCÍ</span>
                        </div>
                        `}
                    </div>

                    <!-- Bottom Row: Opponent -->
                    <div style="margin-top: 0.5rem; padding-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.05); color: var(--text-light); font-size: 0.9em;">
                        <span style="color: var(--text-muted); font-size: 0.9em;">vs</span> <strong style="color: var(--text-color); font-size: 1.05em;">${match.opponent}</strong>
                    </div>
                </div>
            </div>

            <!-- Next Button -->
            <button onclick="changeMatch('${containerId}', 1)"
                style="background: transparent; border: none; color: var(--text-muted); width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: ${isLast ? 0.2 : 0.8}; pointer-events: ${isLast ? 'none' : 'auto'}; transition: all 0.2s; font-size: 1.1rem; border-radius: 50%;"
                onmouseover="this.style.backgroundColor='rgba(255,255,255,0.05)'; this.style.color='var(--text-color)'"
                onmouseout="this.style.backgroundColor='transparent'; this.style.color='var(--text-muted)'">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>

        <!-- Expanded Details Container -->
        <div id="${detailsId}" style="display: none; margin-top: 0.5rem; padding: 0.6rem; background: rgba(0,0,0,0.3); border-radius: 8px; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.1);"></div>
    `;
}

window.toggleMatchBadgeDetails = async function (detailsId, urlEncoded, round, homeEncoded, awayEncoded) {
    const container = document.getElementById(detailsId);
    const icon = document.getElementById(`icon-${detailsId}`);
    if (!container) return;

    // Toggle visibility
    const isHidden = container.style.display === 'none';
    container.style.display = isHidden ? 'block' : 'none';
    if (icon) icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';

    if (!isHidden) return; // Hiding

    // If empty, fetch data
    if (container.innerHTML.trim() === '' || container.innerHTML.includes('Načítám') || container.innerHTML.includes('loading')) {
        container.innerHTML = '<div style="text-align: center; padding: 0.5rem;"><i class="fa-solid fa-spinner fa-spin"></i> Načítám...</div>';

        try {
            const url = decodeURIComponent(urlEncoded);
            const home = decodeURIComponent(homeEncoded);
            const away = decodeURIComponent(awayEncoded);

            if (!url) {
                container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Detaily nejsou k dispozici.</p>';
                return;
            }

            const res = await fetch(`${API_URL}/standings/match-details?url=${encodeURIComponent(url)}&round=${round}&home=${encodeURIComponent(home)}&away=${encodeURIComponent(away)}`);
            if (!res.ok) throw new Error('Fetch failed');
            const data = await res.json();

            if (data.boards && data.boards.length > 0) {
                let html = '<table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">';
                html += '<thead><tr style="border-bottom: 1px solid rgba(255,255,255,0.1);"><th style="padding: 0.3rem; text-align: left; width: 1.5rem;">Š</th><th style="padding: 0.3rem; text-align: left;">Domácí</th><th style="padding: 0.3rem; text-align: center; white-space: nowrap;">Výs.</th><th style="padding: 0.3rem; text-align: right;">Hosté</th></tr></thead><tbody>';
                data.boards.forEach((b, idx) => {
                    const boardNum = idx + 1;
                    const formatPlayer = (name, elo) => {
                        if (!name || name === '-') return '-';
                        const eloStr = elo && elo !== '-' ? `<span style="color: var(--text-muted); font-size: 0.8em;"> (${elo})</span>` : '';
                        return name + eloStr;
                    };
                    const homeName = formatPlayer(b.white || b.homePlayer, b.whiteElo || b.homeElo);
                    const guestName = formatPlayer(b.black || b.guestPlayer, b.blackElo || b.guestElo);

                    html += `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <td style="padding: 0.3rem; color: var(--text-muted);">${boardNum}</td>
                        <td style="padding: 0.3rem;">${homeName}</td>
                        <td style="padding: 0.3rem; text-align: center; font-weight: 600; white-space: nowrap;">${b.result || '-'}</td>
                        <td style="padding: 0.3rem; text-align: right;">${guestName}</td>
                    </tr>`;
                });
                html += '</tbody></table>';
                container.innerHTML = html;
            } else {
                container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Detaily nejsou k dispozici.</p>';
            }
        } catch (e) {
            console.error('Error loading match details:', e);
            container.innerHTML = '<p style="color: #fca5a5; text-align: center;">Chyba načítání.</p>';
        }
    }
}
