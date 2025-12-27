/**
 * Calendar Logic
 */
console.log("Calendar JS loaded");

let allMatchesData = [];
let showingPast = true; // Show past matches by default
let selectedCategory = 'all'; // 'all', 'teams', 'youth'

// Competition color palette for visual differentiation
const competitionColors = {
    'Krajský přebor': '#D4AF37',           // Gold - hlavní soutěž
    'Krajský přebor Liberec': '#D4AF37',   // Gold
    'Krajská soutěž I. - východ': '#60A5FA', // Blue
    'Krajská soutěž východ': '#60A5FA',    // Blue  
    'Krajský přebor mládeže': '#4ADE80',   // Green
    'Krajský přebor mládeže - Liberec': '#4ADE80', // Green
    'KPM': '#4ADE80',                       // Green
    'default': '#A78BFA'                   // Purple for unknown
};

function getCompetitionColor(compName) {
    // Try exact match first
    if (competitionColors[compName]) return competitionColors[compName];
    // Try partial match
    for (const [key, color] of Object.entries(competitionColors)) {
        if (compName.toLowerCase().includes(key.toLowerCase())) return color;
    }
    return competitionColors['default'];
}

// Competition to ID mapping for roster lookups
// IDs must match actual database competition IDs from /api/competitions
const competitionIdMap = {
    // Adult teams
    'Krajský přebor': 'kp-liberec',
    'Krajský přebor Liberec': 'kp-liberec',
    'Krajská soutěž I. - východ': 'ks-vychod',
    'Krajská soutěž východ': 'ks-vychod',
    // Youth teams - NOTE: IDs are numbers from chess.cz
    '1. liga mládeže A': '3255',
    '1. liga mládeže': '3255',
    'Krajský přebor mládeže': '3363',
    'Krajský přebor mládeže - Liberec': '3363',
    'KPM': '3363',
    'Krajská soutěž st. žáků': 'ks-st-zaku'
};

function getCompetitionId(compName) {
    if (competitionIdMap[compName]) return competitionIdMap[compName];
    // Fuzzy match
    for (const [key, id] of Object.entries(competitionIdMap)) {
        if (compName.toLowerCase().includes(key.toLowerCase())) return id;
    }
    return compName.replace(/\s+/g, '-').toLowerCase();
}

// Make any team name clickable (both our teams and opponents)
function makeTeamClickable(teamName, matchId, compName, side) {
    const competitionId = getCompetitionId(compName);
    // Use global RosterLoader module
    if (typeof RosterLoader !== 'undefined') {
        return RosterLoader.makeClickable(teamName, matchId, competitionId, side);
    }
    // Fallback if module not loaded
    return teamName;
}

// Parse URL parameters for pre-filtering
function applyUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);

    // Category filter (?category=teams or ?category=youth)
    const categoryParam = urlParams.get('category');
    if (categoryParam === 'teams' || categoryParam === 'youth') {
        selectedCategory = categoryParam;
    }

    // History toggle (?history=false to hide past matches)
    const historyParam = urlParams.get('history');
    if (historyParam === 'false' || historyParam === '0') {
        showingPast = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyUrlParams();

    // Update UI to match URL params
    if (selectedCategory !== 'all') {
        const activeBtn = document.getElementById(selectedCategory === 'teams' ? 'catTeams' : 'catYouth');
        document.querySelectorAll('.cat-pill').forEach(btn => {
            btn.style.background = 'transparent';
            btn.style.color = 'var(--text-muted)';
        });
        if (activeBtn) {
            activeBtn.style.background = 'var(--primary-color)';
            activeBtn.style.color = '#000';
        }
    }

    // Update history toggle UI
    if (!showingPast) {
        const checkbox = document.getElementById('togglePastSwitch');
        const track = document.getElementById('toggleTrack');
        const thumb = document.getElementById('toggleThumb');
        const icon = document.getElementById('toggleIcon');

        if (checkbox) checkbox.checked = false;
        if (track) track.style.background = 'rgba(255,255,255,0.2)';
        if (thumb) thumb.style.left = '2px';
        if (icon) { icon.className = 'fa-solid fa-eye-slash'; icon.style.color = 'var(--text-muted)'; }
    }

    loadCalendar();
});

async function loadCalendar() {
    const container = document.getElementById('calendar-container');
    const errorDiv = document.getElementById('calendar-error');
    const filterSelect = document.getElementById('competitionFilter');

    try {
        // Fetch standings data which contains schedules
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout po 10s')), 10000)
        );

        const fetchPromise = fetch(`${API_URL}/standings`);
        const response = await Promise.race([fetchPromise, timeout]);

        if (!response.ok) throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);

        const data = await response.json();
        const competitions = data.standings || [];

        // Extract all matches
        allMatchesData = [];
        const competitionNames = new Set();
        const seenMatches = new Set(); // For derby deduplication

        competitions.forEach(comp => {
            const compName = comp.name;
            if (comp.standings && Array.isArray(comp.standings)) {
                comp.standings.forEach(teamData => {
                    if (teamData.isBizuterie && teamData.schedule && Array.isArray(teamData.schedule)) {
                        const teamName = teamData.team;
                        teamData.schedule.forEach(match => {
                            // Parse date
                            let dateObj = null;
                            let dateStr = match.date.replace(/\s/g, ''); // remove spaces

                            if (dateStr.includes('/')) {
                                dateObj = new Date(dateStr);
                            } else if (dateStr.includes('.')) {
                                const parts = dateStr.split('.');
                                // Assume DD.MM.YYYY - use T12:00:00 to avoid UTC timezone shift
                                if (parts.length === 3) {
                                    dateObj = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T12:00:00`);
                                }
                            }

                            if (dateObj && !isNaN(dateObj.getTime())) {
                                // Derby deduplication: if opponent also contains bižuterie, 
                                // create a unique key based on sorted team names to avoid duplicates
                                const isBizuDerby = match.opponent &&
                                    (match.opponent.toLowerCase().includes('bižuterie') ||
                                        match.opponent.toLowerCase().includes('bizuterie'));

                                let matchKey = `${compName}-${match.round}-${dateStr}`;
                                if (isBizuDerby) {
                                    // Sort team names alphabetically to create consistent key
                                    const sortedTeams = [teamName, match.opponent].sort().join('-');
                                    matchKey = `${compName}-${match.round}-${sortedTeams}`;

                                    if (seenMatches.has(matchKey)) {
                                        return; // Skip duplicate derby match
                                    }
                                    seenMatches.add(matchKey);
                                }

                                allMatchesData.push({
                                    date: dateObj,
                                    originalDate: match.date,
                                    competition: compName,
                                    category: comp.category || 'teams', // 'youth' or 'teams'
                                    myTeam: teamName,
                                    opponent: match.opponent,
                                    result: match.result,
                                    round: match.round,
                                    isHome: match.isHome,
                                    url: comp.chessczUrl || comp.url // Store URL for details fetching
                                });
                                competitionNames.add(compName);
                            }
                        });
                    }
                });
            }
        });

        // Populate filter based on available competitions from API
        try {
            const compsRes = await fetch(`${API_URL}/competitions`);
            const compsList = await compsRes.json();

            compsList.forEach(comp => {
                // Avoid duplicates if scraped data has different name format
                if (![...filterSelect.options].some(o => o.value === comp.name)) {
                    const option = document.createElement('option');
                    option.value = comp.name;
                    // Add child icon for youth categories
                    const prefix = comp.category === 'youth' ? '👶 ' : '';
                    option.textContent = prefix + comp.name;
                    filterSelect.appendChild(option);
                }
            });
        } catch (e) {
            console.warn('Failed to fetch competition list for filter:', e);
            // Fallback to scraped names
            [...competitionNames].sort().forEach(name => {
                if (![...filterSelect.options].some(o => o.value === name)) {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    filterSelect.appendChild(option);
                }
            });
        }

        filterSelect.addEventListener('change', () => renderCalendar());

        // Sort all matches by date
        allMatchesData.sort((a, b) => a.date - b.date);

        renderCalendar();

    } catch (err) {
        console.error('Error loading calendar:', err);
        container.style.display = 'none';
        errorDiv.style.display = 'block';
        // Show debug info
        const debugInfo = document.createElement('div');
        debugInfo.style.cssText = 'margin-top: 1rem; font-size: 0.8rem; color: var(--text-muted); font-family: monospace; word-break: break-all;';
        debugInfo.innerHTML = `API: ${API_URL}/standings<br>Error: ${err.message}`;
        errorDiv.appendChild(debugInfo);
    }
}

function togglePastMatches() {
    const checkbox = document.getElementById('togglePastSwitch');
    showingPast = checkbox ? checkbox.checked : !showingPast;

    // Update toggle switch visuals
    const track = document.getElementById('toggleTrack');
    const thumb = document.getElementById('toggleThumb');
    const icon = document.getElementById('toggleIcon');

    if (showingPast) {
        if (track) track.style.background = 'var(--primary-color)';
        if (thumb) thumb.style.left = '18px';
        if (icon) { icon.className = 'fa-solid fa-eye'; icon.style.color = 'var(--primary-color)'; }
    } else {
        if (track) track.style.background = 'rgba(255,255,255,0.2)';
        if (thumb) thumb.style.left = '2px';
        if (icon) { icon.className = 'fa-solid fa-eye-slash'; icon.style.color = 'var(--text-muted)'; }
    }
    renderCalendar();
}

function filterByCategory(category) {
    selectedCategory = category;

    // Update pill button styles
    document.querySelectorAll('.cat-pill').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-muted)';
    });

    const activeBtn = document.getElementById(category === 'all' ? 'catAll' : category === 'teams' ? 'catTeams' : 'catYouth');
    if (activeBtn) {
        activeBtn.style.background = 'var(--primary-color)';
        activeBtn.style.color = '#000';
    }

    renderCalendar();
}

function navigateMonth(direction) {
    const monthJump = document.getElementById('monthJump');
    if (!monthJump) return; // Element removed, use scrollMonthNav instead
    const options = [...monthJump.options].filter(o => o.value);
    if (options.length === 0) return;

    const currentIndex = options.findIndex(o => o.value === monthJump.value);
    let newIndex = currentIndex + direction;

    // Wrap around or clamp
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= options.length) newIndex = options.length - 1;

    monthJump.value = options[newIndex].value;
    jumpToMonth(options[newIndex].value);
}

function scrollMonthNav(currentMonthId, direction) {
    const monthDivs = [...document.querySelectorAll('.calendar-month')];
    const currentIndex = monthDivs.findIndex(div => div.id === 'month-' + currentMonthId);
    if (currentIndex === -1) return;

    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= monthDivs.length) newIndex = monthDivs.length - 1;

    // Scroll with offset for fixed header (100px offset)
    const target = monthDivs[newIndex];
    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - 100;
    window.scrollTo({ top: targetPosition, behavior: 'smooth' });
}

function renderCalendar() {
    const container = document.getElementById('calendar-container');
    const filterValue = document.getElementById('competitionFilter').value;

    // Filter by competition
    let filteredMatches = allMatchesData;
    if (filterValue !== 'all') {
        filteredMatches = allMatchesData.filter(m => m.competition === filterValue);
    }

    // Filter by category (teams/youth)
    if (selectedCategory !== 'all') {
        filteredMatches = filteredMatches.filter(m => m.category === selectedCategory);
    }

    if (filteredMatches.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                Žádné zápasy neodpovídají výběru.
            </div>
        `;
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Split into past and upcoming/today
    const pastMatches = filteredMatches.filter(m => m.date < today);
    const upcomingMatches = filteredMatches.filter(m => m.date >= today);

    let html = '';

    // Render Past Matches (if toggled)
    if (showingPast && pastMatches.length > 0) {
        html += '<div class="past-matches-container" style="opacity: 0.7; margin-bottom: 2rem; border-bottom: 2px dashed rgba(255,255,255,0.1); padding-bottom: 1rem;">';
        html += '<h3 style="color: var(--text-muted); font-size: 1.1rem; margin-bottom: 1rem;">Uplynulé zápasy</h3>';
        html += generateMatchesHtml(pastMatches, today);
        html += '</div>';
    }

    // Render Upcoming Matches
    if (upcomingMatches.length > 0) {
        html += generateMatchesHtml(upcomingMatches, today);
    } else if (!showingPast) {
        html += `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                Žádné nadcházející zápasy. <br>
                <button onclick="togglePastMatches()" class="btn-link" style="margin-top:0.5rem;">Zobrazit historii</button>
            </div>
        `;
    }

    container.innerHTML = html;

    // Populate month jump dropdown
    populateMonthJump();

    // highlight deep linked match
    checkDeepLink();
}

function populateMonthJump() {
    const monthJump = document.getElementById('monthJump');
    if (!monthJump) return; // Element removed, skip
    const monthDivs = document.querySelectorAll('.calendar-month[id]');

    // Reset options
    monthJump.innerHTML = '<option value="">Přeskočit na měsíc...</option>';

    monthDivs.forEach(div => {
        const monthId = div.id.replace('month-', '');
        // monthId format is like "prosinec-2025" - convert back to readable format
        const cleanTitle = monthId.replace(/-/g, ' ').replace(/^(\w)/, c => c.toUpperCase());
        const option = document.createElement('option');
        option.value = div.id;
        option.textContent = cleanTitle;
        monthJump.appendChild(option);
    });
}

function jumpToMonth(monthId) {
    if (!monthId) return;
    const element = document.getElementById(monthId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function generateMatchesHtml(matches, today) {
    let html = '';
    let currentMonth = '';

    matches.forEach(match => {
        const monthName = match.date.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
        const capitalMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        if (monthName !== currentMonth) {
            if (currentMonth !== '') html += '</div>'; // Close previous month div
            const monthId = monthName.replace(/\s+/g, '-');
            html += `
                <div class="calendar-month" id="month-${monthId}">
                    <div class="month-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                        <button onclick="scrollMonthNav('${monthId}', -1)" class="month-nav-btn" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: var(--text-muted); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <h2 class="month-title" style="margin: 0; flex: 1; text-align: center;">
                            <i class="fa-regular fa-calendar"></i> ${capitalMonth}
                        </h2>
                        <button onclick="scrollMonthNav('${monthId}', 1)" class="month-nav-btn" style="width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: var(--text-muted); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
            `;
            currentMonth = monthName;
        }

        const isPast = match.date < today;
        const isToday = match.date.toDateString() === today.toDateString();

        // Check if match has a valid result (not empty, not just time, not dash)
        const matchHasResult = match.result &&
            match.result !== '-' &&
            match.result.trim() !== '' &&
            match.result.trim() !== ':' &&
            /[\d½]/.test(match.result);

        let statusClass = 'status-upcoming';
        let statusText = 'Nadcházející';
        let isUpcoming = true; // Track if match is upcoming for ROZPIS button

        // If match has result, it's finished - regardless of date
        if (matchHasResult) {
            statusClass = 'status-finished';
            statusText = 'Odehráno';
            isUpcoming = false;
        } else if (isToday) {
            statusClass = 'status-today';
            statusText = 'Dnes';
        } else if (isPast) {
            statusClass = 'status-finished';
            statusText = 'Odehráno';
            isUpcoming = false;
        }

        // Format day
        const day = match.date.getDate();
        const dayName = match.date.toLocaleString('cs-CZ', { weekday: 'short' });

        // Generate unique matchId for roster containers
        const matchId = `${match.competition.replace(/\s+/g, '')}-${match.round}-${day}`.replace(/[^a-zA-Z0-9-]/g, '');

        // Determine display order based on Home/Away
        let team1 = match.isHome !== false ? match.myTeam : match.opponent;
        let team2 = match.isHome !== false ? match.opponent : match.myTeam;

        // Make ALL teams clickable with roster (using RosterLoader module)
        const team1Display = makeTeamClickable(team1, matchId, match.competition, 'left');
        const team2Display = makeTeamClickable(team2, matchId, match.competition, 'right');

        // Check if teams are Bižuterie for styling
        const isBizu1 = /bižuterie|bizuterie/i.test(team1);
        const isBizu2 = /bižuterie|bizuterie/i.test(team2);

        // Highlight my team (only if not already made clickable with styling)
        const highlightStyle = 'color: var(--primary-color); font-weight: 700;';
        const t1Style = (team1 === match.myTeam && !isBizu1) ? highlightStyle : '';
        const t2Style = (team2 === match.myTeam && !isBizu2) ? highlightStyle : '';

        const hasResult = match.result &&
            match.result !== '-' &&
            match.result !== '' &&
            match.result.trim() !== ':' &&
            !/^\s*:\s*$/.test(match.result) && // Just colon with spaces
            /[\d½]/.test(match.result) && // Must contain digits or ½
            !/^\d{2}:\d{2}$/.test(match.result); // Must NOT be just time (HH:MM)

        // Escape quotes for onclick handler
        // We use &quot; for double quotes in HTML attributes
        // But for JS strings inside onclick, we need to be careful.
        // Best approach: Pass pre-calculated detailsId and raw values (escaped for HTML attribute)
        const safeTeam1 = team1.replace(/"/g, '&quot;').replace(/'/g, "\\'");
        const safeTeam2 = team2.replace(/"/g, '&quot;').replace(/'/g, "\\'");
        const safeComp = match.competition.replace(/"/g, '&quot;').replace(/'/g, "\\'");

        // Inline Details Container ID
        const detailsId = `details-${match.competition.replace(/\s+/g, '-')}-${match.round}-${team1.replace(/\s+/g, '-')}`.replace(/[^a-zA-Z0-9-]/g, '');

        // Only show result if it's a valid score (not empty, not just colon)
        const isValidDisplayResult = match.result &&
            match.result.trim() !== '' &&
            match.result.trim() !== '-' &&
            match.result.trim() !== ':' &&
            !/^\s*:\s*$/.test(match.result.trim());

        const resultHtml = hasResult
            ? `<span class="match-result clickable" onclick="toggleMatchDetails('${safeComp}', '${match.round}', '${safeTeam1}', '${safeTeam2}', this, '${detailsId}')" 
                   style="cursor: pointer; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 4px;" 
                   title="Zobrazit detailní výsledky">${match.result}</span>`
            : (isValidDisplayResult ? `<span class="match-result">${match.result}</span>` : '');

        // Youth vs Adult styling
        const isYouth = match.category === 'youth';
        const categoryIcon = isYouth ? '<i class="fa-solid fa-child" style="margin-right: 0.3rem; color: #4ade80;"></i>' : '';
        const categoryBorder = isYouth ? 'border-left-color: #4ade80;' : '';

        // Generate Google Calendar URL for upcoming matches
        const generateMatchCalendarUrl = () => {
            const title = encodeURIComponent(`${match.competition}: ${team1} - ${team2}`);
            const startDate = match.date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            const endDate = new Date(match.date.getTime() + 4 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            const details = encodeURIComponent(`${match.round}. kolo - ${match.competition}`);
            return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}`;
        };

        const calendarBtn = !isPast && !matchHasResult
            ? `<a href="${generateMatchCalendarUrl()}" target="_blank" title="Přidat do kalendáře" style="color: var(--text-muted); padding: 0.25rem; transition: color 0.2s;" onmouseover="this.style.color='#22d3ee'" onmouseout="this.style.color='var(--text-muted)'"><i class="fa-solid fa-calendar-plus"></i></a>`
            : '';

        // Get competition-specific color
        const compColor = getCompetitionColor(match.competition);
        const borderColor = isPast ? 'var(--text-muted)' : compColor;

        // Status badge or ROZPIS button for upcoming matches
        const statusBadge = isUpcoming
            ? `<button onclick="openScheduleModalFromMatch('${safeComp}', '${match.myTeam.replace(/"/g, '&quot;')}')" 
                 class="rozpis-btn" 
                 style="display: flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.6rem; background: rgba(212,175,55,0.15); border: 1px solid rgba(212,175,55,0.3); border-radius: 6px; color: var(--primary-color); font-size: 0.7rem; font-weight: 600; cursor: pointer; transition: all 0.2s;"
                 onmouseover="this.style.background='rgba(212,175,55,0.25)'; this.style.borderColor='var(--primary-color)'"
                 onmouseout="this.style.background='rgba(212,175,55,0.15)'; this.style.borderColor='rgba(212,175,55,0.3)'"
                 title="Zobrazit rozpis zápasů">
                <i class="fa-regular fa-calendar-days"></i> ROZPIS
               </button>`
            : `<span class="status-badge ${statusClass}">${statusText}</span>`;

        html += `
            <div id="${matchId}" class="match-card ${isPast ? 'past-match' : ''}" style="border-left: 3px solid ${borderColor}; scroll-margin-top: 150px;">
                <div class="match-header" style="display: flex; gap: 1rem; width: 100%;">
                    <div class="match-date-row" style="display: contents;">
                        <div class="match-date">
                            <div class="match-day">${day}.</div>
                            <div class="match-month">${dayName}</div>
                        </div>
                        <div class="match-status-mobile" style="display: none; margin-left: auto;">
                            ${statusBadge}
                        </div>
                    </div>
                    <div class="match-details">
                        <div class="match-competition">${categoryIcon}${match.competition} • ${match.round}. kolo</div>
                        <div class="match-teams">
                            <span style="${t1Style}">${team1Display}</span> - <span style="${t2Style}">${team2Display}</span>
                            ${resultHtml}
                        </div>
                    </div>
                    <div class="match-actions match-status-desktop" style="display: flex; align-items: center; gap: 0.5rem;">
                        ${calendarBtn}
                        ${statusBadge}
                    </div>
                </div>
                <div id="${detailsId}" class="inline-details" style="display: none; width: 100%; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 1rem; padding-top: 1rem;">
                    <!-- Details Content -->
                </div>
            </div>
        `;
    });

    if (matches.length > 0) html += '</div>'; // Close last month div
    return html;
}

// Inline Toggle Function
async function toggleMatchDetails(competition, round, team1, team2, element, explicitDetailsId) {
    console.log('toggleMatchDetails called', { competition, round, team1, team2, explicitDetailsId });

    // Auto-close roster details if open (Mutual Exclusion)
    if (element) {
        const matchCard = element.closest('.match-card') || element.closest('.card') || element.parentElement;
        if (matchCard) {
            const rosterWrapper = matchCard.querySelector('.roster-wrapper');
            if (rosterWrapper && rosterWrapper.style.display !== 'none') {
                rosterWrapper.style.display = 'none';
            }
        }
    }

    // Use explicit ID if provided, otherwise reconstruct (legacy fallback)
    const detailsId = explicitDetailsId || `details-${competition.replace(/\s+/g, '-')}-${round}-${team1.replace(/\s+/g, '-')}`.replace(/[^a-zA-Z0-9-]/g, '');
    const container = document.getElementById(detailsId);

    if (!container) {
        console.error('Container not found:', detailsId);
        return;
    }

    // Toggle visibility
    const isHidden = container.style.display === 'none';
    container.style.display = isHidden ? 'block' : 'none';

    if (!isHidden) return; // Hiding, done.

    // If empty, fetch data
    if (container.innerHTML.trim() === '' || container.innerHTML.includes('<!-- Details Content -->')) {
        container.innerHTML = `
            <div style="text-align: center; padding: 1rem;">
                <i class="fa-solid fa-spinner fa-spin" style="color: var(--primary-color);"></i> Načítám...
            </div>
        `;

        // Find data - use fuzzy matching for team names
        const fuzzyMatch = (a, b) => {
            const la = a.toLowerCase().trim();
            const lb = b.toLowerCase().trim();
            return la === lb || la.includes(lb) || lb.includes(la);
        };

        const matchData = allMatchesData.find(m =>
            m.competition === competition &&
            // Loose equality for round (json is number, attr is string)
            m.round == round &&
            ((fuzzyMatch(m.myTeam, team1) && fuzzyMatch(m.opponent, team2)) ||
                (fuzzyMatch(m.myTeam, team2) && fuzzyMatch(m.opponent, team1)))
        );

        if (matchData && matchData.url) {
            try {
                const res = await fetch(`${API_URL}/standings/match-details?url=${encodeURIComponent(matchData.url)}&round=${round}&home=${encodeURIComponent(matchData.myTeam)}&away=${encodeURIComponent(matchData.opponent)}`);
                if (!res.ok) throw new Error('Network response was not ok');
                const data = await res.json();

                console.log('Boards data:', data); // Debug log

                if (data.boards && data.boards.length > 0) {
                    renderBoardsInline(data.boards, container, team1, team2);
                } else {
                    container.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.9rem;">Podrobnosti nejsou k dispozici.</p>';
                }
            } catch (e) {
                console.error('Fetch error:', e);
                container.innerHTML = '<p style="text-align: center; color: #fca5a5; font-size: 0.9rem;">Chyba načítání.</p>';
            }
        } else {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted); font-size: 0.9rem;">Chybí odkaz na soutěž.</p>';
        }
    }
}

function renderBoardsInline(boards, container, team1, team2) {
    container.innerHTML = `
    <table class="boards-table" style="font-size: 0.85rem;">
             <thead>
                <tr>
                    <th style="padding: 0.5rem;">Šach.</th>
                    <th style="padding: 0.5rem;">Domácí</th>
                    <th style="padding: 0.5rem;">ELO</th>
                    <th style="padding: 0.5rem;">Výs.</th>
                    <th style="padding: 0.5rem;">Hosté</th>
                    <th style="padding: 0.5rem;">ELO</th>
                </tr>
            </thead>
            <tbody>
                ${boards.map(b => {
        // Parse board number to determine color
        // Format usually "1", "2" or "1.1", "1.2"
        let boardNum = 1;
        const parts = (b.board || '').split('.');
        if (parts.length > 1) {
            boardNum = parseInt(parts[1]);
        } else {
            boardNum = parseInt(b.board);
        }
        if (isNaN(boardNum)) boardNum = 1;

        // Odd board = Home is White
        const homeIsWhite = boardNum % 2 !== 0;

        // Determine if Home/Away team is "My Team" (matches myTeam passed to this function, or use matchData context?)
        // We don't have isHome flag easily here inside map loop, but we know team1 is Home in the table header context? 
        // Ah wait, header is "Domácí" / "Hosté".
        // "team1" argument to toggleMatchDetails is the Home team (Domácí).
        // "team2" is Hosté.
        // We need to know which one is Bižuterie.
        const bizuterieName = 'Bižuterie'; // Keyword to identify. Or better, check specific known names?
        // Actually, toggleMatchDetails receives team1, team2. 
        // One of them is likely "TJ Bižuterie ...".
        // Let's assume we want to highlight the team that CONTAINS "Bižuterie" (case insensitive).

        const isTeam1Bizu = team1.toLowerCase().includes('bižuterie') || team1.toLowerCase().includes('bizuterie');
        const isTeam2Bizu = team2.toLowerCase().includes('bižuterie') || team2.toLowerCase().includes('bizuterie');

        // If both are Bižuterie (derby), highlight both? Or just verify logic.

        const homeName = homeIsWhite ? b.white : b.black;
        const homeElo = homeIsWhite ? b.whiteElo : b.blackElo;
        const isHomePlayerBizu = isTeam1Bizu; // Domácí is Team 1.

        // Highlighting style
        const bizuStyle = 'font-weight: 700; color: var(--primary-color);';
        const homeStyle = isHomePlayerBizu ? bizuStyle : '';
        const homeIcon = homeIsWhite ? '<i class="fa-solid fa-square" style="color: #fff; text-shadow: 0 0 1px #999; margin-right: 5px;"></i>' : '<i class="fa-solid fa-square" style="color: #000; margin-right: 5px;"></i>';

        const awayName = homeIsWhite ? b.black : b.white;
        const awayElo = homeIsWhite ? b.blackElo : b.whiteElo;
        const isAwayPlayerBizu = isTeam2Bizu; // Hosté is Team 2.
        const awayStyle = isAwayPlayerBizu ? bizuStyle : '';
        const awayIcon = homeIsWhite ? '<i class="fa-solid fa-square" style="color: #000; margin-right: 5px;"></i>' : '<i class="fa-solid fa-square" style="color: #fff; text-shadow: 0 0 1px #999; margin-right: 5px;"></i>';

        return `
                    <tr>
                        <td style="padding: 0.5rem; color: var(--text-muted);">${b.board || '-'}</td>
                        <td style="padding: 0.5rem; ${homeStyle}">${homeIcon} ${b.homePlayer || '-'}</td>
                        <td style="padding: 0.5rem; font-size: 0.8em; color: var(--text-muted);">${b.homeElo && b.homeElo !== '-' ? b.homeElo : ''}</td>
                        <td style="padding: 0.5rem; font-weight: bold; color: var(--text-color);">${b.result || '-'}</td>
                        <td style="padding: 0.5rem; ${awayStyle}">${awayIcon} ${b.guestPlayer || '-'}</td>
                        <td style="padding: 0.5rem; font-size: 0.8em; color: var(--text-muted);">${b.guestElo && b.guestElo !== '-' ? b.guestElo : ''}</td>
                    </tr>
                `;
    }).join('')}
            </tbody>
        </table>
    `;
}

// Schedule Modal Functions
function openScheduleModalFromMatch(competition, myTeamName) {
    const modal = document.getElementById('scheduleModal');
    const modalTeamName = document.getElementById('modalTeamName');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalBody) return;

    // Find all matches for this team in this competition
    const teamMatches = allMatchesData.filter(m =>
        m.competition === competition &&
        (m.myTeam === myTeamName || m.opponent === myTeamName)
    );

    // Extract team letter for title
    const teamLetter = myTeamName.match(/"([ABCD])"/)?.[1] || '';
    modalTeamName.textContent = teamLetter ? `Rozpis - ${teamLetter} Tým` : `Rozpis - ${myTeamName}`;

    if (teamMatches.length === 0) {
        modalBody.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Žádné zápasy nenalezeny.</p>';
    } else {
        let html = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem;">
                <thead>
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.2);">
                        <th style="padding: 0.5rem; text-align: left; color: var(--primary-color);">Kolo</th>
                        <th style="padding: 0.5rem; text-align: left; color: var(--primary-color);">Datum</th>
                        <th style="padding: 0.5rem; text-align: left; color: var(--primary-color);">Soupeř</th>
                        <th style="padding: 0.5rem; text-align: center; color: var(--primary-color);">Výsledek</th>
                    </tr>
                </thead>
                <tbody>
        `;

        teamMatches.forEach(m => {
            const hasResult = m.result && /[\d½]/.test(m.result) && m.result.trim() !== ':';
            const resultColor = hasResult ? 'var(--text-color)' : 'var(--text-muted)';
            const resultText = hasResult ? m.result : '-';
            const homeAway = m.isHome !== false ? '(D)' : '(V)';

            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <td style="padding: 0.5rem;">${m.round}.</td>
                    <td style="padding: 0.5rem;">${m.originalDate}</td>
                    <td style="padding: 0.5rem;">${m.opponent} <span style="color: var(--text-muted); font-size: 0.8em;">${homeAway}</span></td>
                    <td style="padding: 0.5rem; text-align: center; font-weight: 600; color: ${resultColor};">${resultText}</td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        modalBody.innerHTML = html;
    }

    modal.style.display = 'block';

    // Close on click outside
    modal.onclick = (e) => {
        if (e.target === modal) closeScheduleModal();
    };

    // Close on Escape key
    document.addEventListener('keydown', handleScheduleModalEscape);
}

function handleScheduleModalEscape(e) {
    if (e.key === 'Escape') closeScheduleModal();
}

function closeScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    if (modal) modal.style.display = 'none';
    document.removeEventListener('keydown', handleScheduleModalEscape);
}

// Check for matchId in URL and highlight
function checkDeepLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const matchId = urlParams.get('matchId');
    if (matchId) {
        // Wait for render
        setTimeout(() => {
            // Try to find by ID (we need to ensure ID generation matches)
            // In render loop, we generated matchId but didn't assign it to the card element ID.
            // We need to update render loop to set ID on card.

            // Actually, let's find the element by ID if we set it. 
            // If not set yet, we must update generateMatchesHtml.
            const el = document.getElementById(matchId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('highlight-match');
                // Remove highlight after animation (3 pulses * 2s = 6s)
                setTimeout(() => {
                    el.classList.remove('highlight-match');
                }, 6000);

                // Auto-expand details if actionable
                const clickableSpan = el.querySelector('.match-result.clickable');
                if (clickableSpan) {
                    clickableSpan.click();
                }
            }
        }, 500);
    }
}

console.log("Calendar JS v16 (END) loaded");

// Expose functions globally to ensure they can be called from onclick
window.toggleMatchDetails = toggleMatchDetails;
window.openScheduleModalFromMatch = openScheduleModalFromMatch;
