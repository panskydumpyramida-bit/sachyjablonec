/**
 * Home Matches Widget
 * Displays upcoming home matches for adult teams on the homepage
 */

const UpcomingMatches = {
    containerId: 'upcoming-matches-widget',

    async init() {
        // Find the rotator elements - New Target
        const rotator = document.querySelector('#match-rotator-tile .rotator-inner');
        // Fallback for old container if still present (should not be)
        const container = document.getElementById(this.containerId);

        // If neither exists, we can't do anything
        if (!rotator && !container) return;

        // If rotator exists, show loading on front face?
        // Actually, Front face is static "Kalendář akcí". We keep it until data loads.

        try {
            const res = await fetch(`${API_URL}/standings`);
            if (!res.ok) throw new Error('Failed to fetch');

            const data = await res.json();
            const competitions = data.standings || data;
            const adultComps = competitions.filter(c => c.category !== 'youth');

            // Collect all upcoming matches
            let allUpcoming = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const comp of adultComps) {
                if (!comp.standings) continue;
                for (const team of comp.standings) {
                    if (!team.isBizuterie && !/bižuterie|bizuterie/i.test(team.team)) continue;
                    if (!team.schedule) continue;

                    for (const match of team.schedule) {
                        // Parse date
                        let matchDate = null;
                        const dateStr = (match.date || '').replace(/\s/g, '');
                        if (dateStr.includes('/')) {
                            const parts = dateStr.split('/');
                            if (parts.length === 3) matchDate = new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}T12:00:00`);
                        } else if (dateStr.includes('.')) {
                            const parts = dateStr.split('.');
                            if (parts.length >= 3) matchDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T12:00:00`);
                        }

                        // Has result?
                        const hasResult = match.result && /[\d]/.test(match.result);

                        if (matchDate && matchDate >= today && !hasResult) {
                            // Generate Match ID
                            const day = matchDate.getDate();
                            const compName = comp.name || comp.competitionName;
                            const matchId = `${compName.replace(/\s+/g, '')}-${match.round}-${day}`.replace(/[^a-zA-Z0-9-]/g, '');

                            allUpcoming.push({
                                date: matchDate,
                                dateStr: match.date,
                                round: match.round,
                                team: team.team,
                                teamShort: this.getTeamShort(team.team),
                                opponent: match.opponent,
                                isHome: match.isHome !== false,
                                competition: compName,
                                matchId: matchId
                            });
                        }
                    }
                }
            }

            allUpcoming.sort((a, b) => a.date - b.date);

            // Select strategy: Try to get next match for A, B, C, D
            const teamLetters = ['A', 'B', 'C', 'D'];
            const selectedMatches = [];
            const usedIndices = new Set();

            // 1. Find next match for each team letter
            for (const letter of teamLetters) {
                const idx = allUpcoming.findIndex((m, i) => !usedIndices.has(i) && m.teamShort === letter);
                if (idx !== -1) {
                    selectedMatches.push(allUpcoming[idx]);
                    usedIndices.add(idx);
                }
            }

            // 2. Fill remaining slots (up to 4) with next chronological matches
            let fillIdx = 0;
            while (selectedMatches.length < 4 && fillIdx < allUpcoming.length) {
                if (!usedIndices.has(fillIdx)) {
                    selectedMatches.push(allUpcoming[fillIdx]);
                    usedIndices.add(fillIdx);
                }
                fillIdx++;
            }

            // Sort selected by date for display
            selectedMatches.sort((a, b) => a.date - b.date);

            if (selectedMatches.length === 0) {
                // No matches - maybe do nothing or show message on rotator back?
                return;
            }

            // Render to Rotator
            this.render(null, selectedMatches);
        } catch (e) {
            console.error('UpcomingMatches error:', e);
        }
    },

    getTeamShort(teamName) {
        const match = teamName.match(/"([ABCD])"/);
        return match ? match[1] : '';
    },

    formatDate(dateStr) {
        try {
            const cleanDate = dateStr.replace(/\s/g, '');
            if (cleanDate.includes('/')) {
                const parts = cleanDate.split('/');
                return `${parseInt(parts[2])}. ${parseInt(parts[1])}.`;
            }
            if (cleanDate.includes('.')) {
                const parts = cleanDate.split('.');
                // Assuming d.m.yyyy or similar
                return `${parseInt(parts[0])}. ${parseInt(parts[1])}.`;
            }
            return dateStr;
        } catch (e) { return dateStr; }
    },

    render(container, matches) {
        // Find the rotator elements
        const tile = document.getElementById('match-rotator-tile');
        const rotator = tile.querySelector('.rotator-inner');
        if (!rotator) return;

        // Static click handler - always go to calendar
        // If we want specific match anchor, we can update a data attribute
        tile.onclick = (e) => {
            // Check if we have a specific match ID stored
            const matchId = tile.dataset.matchId;
            if (matchId) {
                window.location.href = `calendar.html?matchId=${matchId}`;
            } else {
                window.location.href = 'calendar.html';
            }
        };

        const faceFront = rotator.querySelector('.face-front');
        const faceBack = rotator.querySelector('.face-back');

        // Save original Title content
        const titleContent = faceFront.innerHTML;

        // Create rotation sequence: Title -> Match 1 -> Match 2 -> ... -> Title
        const items = [
            { type: 'title', content: titleContent },
            ...matches.map(m => ({ type: 'match', data: m }))
        ];

        let currentIndex = 0;
        let isFlipped = false;

        // Function to render match content
        const getMatchHtml = (m) => {
            const homeAway = m.isHome ? 'DOMA' : 'VENKU';
            const homeAwayColor = m.isHome ? 'var(--primary-color)' : 'rgba(255,255,255,0.7)';
            // We need to re-format date from the object
            // The object has dateStr which is original string
            const dateFmt = this.formatDate(m.dateStr);

            return `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 2px;">
                        <span style="font-weight: 700; color: var(--primary-color); font-size: 0.9rem;">${dateFmt}</span>
                        <span style="background: var(--primary-color); color: #000; width: 16px; height: 16px; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.65rem;">${m.teamShort}</span>
                    </div>
                    
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 0.85rem; line-height: 1.1; font-weight: 600; color: #fff; padding: 2px 0;">
                        ${m.opponent}
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
                        <span style="font-size: 0.65rem; font-weight: 700; color: ${homeAwayColor}; text-transform: uppercase;">${homeAway}</span>
                        <span style="font-size: 0.6rem; color: rgba(255,255,255,0.4);">${m.round}. kolo</span>
                    </div>
                </div>
            `;
        };

        // Rotation Interval
        setInterval(() => {
            const nextIndex = (currentIndex + 1) % items.length;
            const item = items[nextIndex];

            // Determine content for the NEXT face
            // If currently front (isFlipped=false), we want to update BACK and then flip to True.
            // If currently back (isFlipped=true), we want to update FRONT and then flip to False.

            const targetFace = isFlipped ? faceFront : faceBack;

            if (item.type === 'title') {
                targetFace.innerHTML = item.content;
                tile.dataset.matchId = ''; // Clear match ID
            } else {
                targetFace.innerHTML = getMatchHtml(item.data);
                tile.dataset.matchId = item.data.matchId; // Store match ID
            }

            // Perform flip
            isFlipped = !isFlipped;
            if (isFlipped) {
                rotator.classList.add('rotated');
            } else {
                rotator.classList.remove('rotated');
            }

            currentIndex = nextIndex;

        }, 4000); // Rotate every 4 seconds
    }
};

// Auto-init on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    UpcomingMatches.init();
});
