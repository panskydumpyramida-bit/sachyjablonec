/**
 * RosterLoader - Global module for team roster display
 * Used across calendar.html, teams.html, youth.html
 */
window.RosterLoader = (function () {
    'use strict';

    // Static mappings for our teams (known SNRs)
    const ourTeamMappings = {
        'A': { url: 'https://chess-results.com/tnr1276470.aspx?lan=5', snr: 1, competitionId: 'kp-liberec' },
        'B': { url: 'https://chess-results.com/tnr1276470.aspx?lan=5', snr: 10, competitionId: 'kp-liberec' },
        'C': { url: 'https://chess-results.com/tnr1278502.aspx?lan=5', snr: 4, competitionId: 'ks-vychod' },
        'D': { url: 'https://chess-results.com/tnr1278502.aspx?lan=5', snr: 5, competitionId: 'ks-vychod' }
    };

    // Cache for fetched rosters
    const rosterCache = {};

    /**
     * Extract team letter if it's a Bižuterie team
     */
    function getTeamLetter(teamName) {
        const match = teamName.match(/"([ABCD])"/);
        return match ? match[1] : null;
    }

    /**
     * Check if team name belongs to Bižuterie
     */
    function isBizuterieTeam(teamName) {
        return /bižuterie|bizuterie/i.test(teamName);
    }

    /**
     * Fetch roster data from API
     */
    async function fetchRoster(url, snr) {
        const cacheKey = `${url}__${snr}`;
        if (rosterCache[cacheKey]) {
            return rosterCache[cacheKey];
        }

        const res = await fetch(`${API_URL}/standings/team-roster?url=${encodeURIComponent(url)}&snr=${snr}`);
        if (!res.ok) throw new Error('Failed to fetch roster');
        const data = await res.json();
        rosterCache[cacheKey] = data.players || [];
        return rosterCache[cacheKey];
    }

    /**
     * Look up opponent SNR dynamically
     */
    async function lookupTeamSnr(competitionId, teamName) {
        const res = await fetch(`${API_URL}/standings/team-snr?competitionId=${encodeURIComponent(competitionId)}&teamName=${encodeURIComponent(teamName)}`);
        if (!res.ok) {
            console.warn('Could not find SNR for team:', teamName);
            return null;
        }
        const data = await res.json();
        return { url: data.url, snr: data.snr };
    }

    /**
     * Render roster table HTML
     */
    function renderRosterTable(players) {
        if (!players || players.length === 0) {
            return '<p style="color: var(--text-muted); text-align: center; margin: 0;">Soupiska není k dispozici.</p>';
        }

        let html = '<table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">';
        html += '<thead><tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">';
        html += '<th style="padding: 0.3rem; text-align: center; color: var(--primary-color); width: 1.5rem;">#</th>';
        html += '<th style="padding: 0.3rem; text-align: left; color: var(--primary-color);">Hráč</th>';
        html += '<th style="padding: 0.3rem; text-align: right; color: var(--primary-color);">ELO</th>';
        html += '<th style="padding: 0.3rem; text-align: center; color: var(--primary-color);">Body</th>';
        html += '</tr></thead><tbody>';

        players.forEach((p, idx) => {
            const bgColor = idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.1)';
            const hasPlayed = p.score && p.score !== '-' && p.score !== '0/0';
            let scoreColor = 'var(--text-muted)';

            if (hasPlayed) {
                const scoreParts = p.score.split('/');
                if (scoreParts.length === 2) {
                    const points = parseFloat(scoreParts[0].replace(',', '.'));
                    const games = parseInt(scoreParts[1]);
                    if (games > 0) {
                        scoreColor = points >= games / 2 ? '#4ade80' : '#f87171';
                    }
                }
            }

            const scoreText = p.score && p.score !== '-' ? p.score : '-';
            html += `<tr style="background: ${bgColor};">
                <td style="padding: 0.25rem; text-align: center; color: var(--text-muted);">${p.rank}</td>
                <td style="padding: 0.25rem;">${p.name}</td>
                <td style="padding: 0.25rem; text-align: right; color: var(--text-muted); font-family: monospace;">${p.elo || '-'}</td>
                <td style="padding: 0.25rem; text-align: center; font-weight: 600; color: ${scoreColor};">${scoreText}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        return html;
    }

    /**
     * Toggle inline roster display - side-by-side layout
     * @param {string} rosterId - Unique ID for roster container
     * @param {string} teamName - Team name to look up
     * @param {string} competitionId - Competition ID (for opponent lookup)
     * @param {HTMLElement} element - Clicked element
     */
    /**
     * Toggle inline roster display - side-by-side layout with fixed slots
     * @param {string} rosterId - Unique ID for roster container
     * @param {string} teamName - Team name to look up
     * @param {string} competitionId - Competition ID
     * @param {HTMLElement} element - Clicked element
     * @param {string} side - 'left' or 'right'
     */
    async function toggleInlineRoster(rosterId, teamName, competitionId, element, side = 'left') {
        const matchCard = element.closest('.match-card') || element.closest('.card') || element.parentElement;
        if (!matchCard) return;

        // Auto-close match results details if open
        const resultsDetails = matchCard.querySelector('.inline-details');
        if (resultsDetails && resultsDetails.style.display !== 'none') {
            resultsDetails.style.display = 'none';
        }

        // Create or get shared wrapper
        let rosterWrapper = matchCard.querySelector('.roster-wrapper');
        let leftSlot, rightSlot;

        if (!rosterWrapper) {
            rosterWrapper = document.createElement('div');
            rosterWrapper.className = 'roster-wrapper';
            // Flex container with 2 slots
            rosterWrapper.style.cssText = 'display: flex; gap: 1rem; margin-top: 0.75rem; width: 100%; align-items: flex-start;';

            // Create slots
            leftSlot = document.createElement('div');
            leftSlot.className = 'roster-slot-left';
            leftSlot.style.cssText = 'flex: 1; min-width: 0;'; // Takes 50% available space

            rightSlot = document.createElement('div');
            rightSlot.className = 'roster-slot-right';
            rightSlot.style.cssText = 'flex: 1; min-width: 0;'; // Takes 50% available space

            rosterWrapper.appendChild(leftSlot);
            rosterWrapper.appendChild(rightSlot);

            const detailsDiv = matchCard.querySelector('.match-details') || matchCard;
            detailsDiv.appendChild(rosterWrapper);
        } else {
            leftSlot = rosterWrapper.querySelector('.roster-slot-left');
            rightSlot = rosterWrapper.querySelector('.roster-slot-right');
        }

        // Target correct slot
        const targetSlot = side === 'left' ? leftSlot : rightSlot;

        // Check if roster already exists in the slot
        let container = document.getElementById(rosterId);

        // If container exists but is in wrong slot (shouldn't happen with unique IDs but just in case), move it
        if (container && container.parentElement !== targetSlot) {
            targetSlot.appendChild(container);
        }

        if (!container) {
            container = document.createElement('div');
            container.id = rosterId;
            container.className = 'inline-roster';
            container.style.cssText = 'display: none; width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.3); border-radius: 8px; font-size: 0.8rem; border: 1px solid rgba(212,175,55,0.2);';
            targetSlot.appendChild(container); // Append to slot, not wrapper
        }

        // Toggle visibility
        const isHidden = container.style.display === 'none';

        // Close other roster in same slot if any (though usually only one per slot)
        // ... (not needed if IDs unique per team)

        container.style.display = isHidden ? 'block' : 'none';

        // Show wrapper if at least one roster is visible
        const visibleRosters = rosterWrapper.querySelectorAll('.inline-roster[style*="display: block"]');
        const hasVisible = visibleRosters.length > 0;
        rosterWrapper.style.display = hasVisible ? 'flex' : 'none';

        if (!isHidden) return;

        // Load data if needed
        if (container.dataset.loaded === 'true') return;

        container.innerHTML = `<div style="font-weight: 600; color: var(--primary-color); margin-bottom: 0.5rem; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${teamName}</div><div style="text-align: center; padding: 0.5rem;"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

        try {
            let url, snr;
            if (isBizuterieTeam(teamName)) {
                const letter = getTeamLetter(teamName);
                if (letter && ourTeamMappings[letter]) {
                    url = ourTeamMappings[letter].url;
                    snr = ourTeamMappings[letter].snr;
                }
            }
            if (!url || !snr) {
                const lookup = await lookupTeamSnr(competitionId, teamName);
                if (lookup) { url = lookup.url; snr = lookup.snr; }
                else {
                    container.innerHTML = `<div style="font-weight: 600; color: var(--primary-color); margin-bottom: 0.5rem; font-size: 0.75rem;">${teamName}</div><p style="color: var(--text-muted); text-align: center; margin: 0; font-size: 0.75rem;">Soupiska není k dispozici.</p>`;
                    return;
                }
            }

            const players = await fetchRoster(url, snr);
            container.innerHTML = `<div style="font-weight: 600; color: var(--primary-color); margin-bottom: 0.5rem; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${teamName}</div>` + renderRosterTable(players);
            container.dataset.loaded = 'true';

        } catch (e) {
            console.error('Error loading roster:', e);
            container.innerHTML = `<div style="font-weight: 600; color: var(--primary-color); margin-bottom: 0.5rem; font-size: 0.75rem;">${teamName}</div><p style="color: #fca5a5; text-align: center; margin: 0;">Chyba načítání.</p>`;
        }
    }

    /**
     * Make a team name HTML element clickable with roster toggle
     * @param {string} teamName - Team name
     * @param {string} matchId - Unique match ID
     * @param {string} competitionId - Comp ID
     * @param {string} side - 'left' or 'right'
     */
    function makeClickable(teamName, matchId, competitionId, side = 'left') {
        const rosterId = `roster-${matchId}-${teamName.replace(/[^a-zA-Z0-9]/g, '')}`.substring(0, 50);
        const escapedTeam = teamName.replace(/'/g, "\\'").replace(/"/g, '\\"');
        const escapedComp = competitionId.replace(/'/g, "\\'");

        return `<span onclick="event.stopPropagation(); RosterLoader.toggle('${rosterId}', '${escapedTeam}', '${escapedComp}', this, '${side}')" 
                style="text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; cursor: pointer;" 
                title="Zobrazit soupisku">${teamName} <i class="fa-solid fa-users" style="font-size: 0.7em; margin-left: 2px; opacity: 0.7;"></i></span>`;
    }

    // Public API
    return {
        toggle: toggleInlineRoster,
        makeClickable: makeClickable,
        fetchRoster: fetchRoster,
        render: renderRosterTable,
        isBizuterie: isBizuterieTeam,
        getTeamLetter: getTeamLetter,
        ourTeams: ourTeamMappings
    };
})();
