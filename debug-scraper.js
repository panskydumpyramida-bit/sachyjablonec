// Native fetch is available in Node 18+

// Copying necessary parts from server.js for standalone testing
const clean = (s) => {
    if (!s) return '';
    let txt = s.replace(/<[^>]*>/g, ' ').trim();
    txt = txt.replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&frac12;/g, '½')
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
    return txt.replace(/\s+/g, ' ').trim();
};

const isElo = (s) => {
    if (!s) return false;
    s = s.trim();
    return s === '-' || /^\d+$/.test(s);
};

async function scrapeMatchDetails(compUrl, round, homeTeam, awayTeam) {
    let detailsUrl = compUrl;
    if (detailsUrl.includes('art=')) {
        detailsUrl = detailsUrl.replace(/art=\d+/, 'art=3');
    } else {
        detailsUrl += '&art=3';
    }
    detailsUrl += `&rd=${round}`;

    console.log(`Scraping details: ${detailsUrl}`);

    try {
        const response = await fetch(detailsUrl);
        const html = await response.text();

        // Split by starting tag of main rows to handle nested tables
        const parts = html.split('<tr class="');
        const rows = parts.map(p => '<tr class="' + p);

        const boards = [];
        let capturing = false;

        for (const row of rows) {
            const cleanRow = clean(row);
            const normRow = cleanRow.toLowerCase();
            const normHome = homeTeam.toLowerCase();
            const normAway = awayTeam.toLowerCase();

            // Detect Match Header
            if (!capturing) {
                // Check if row contains both team names.
                // We use a relatively strict check but allow for some noise.
                if (normRow.includes(normHome) && normRow.includes(normAway)) {
                    capturing = true;
                    console.log('Match Found in row:', cleanRow);
                    continue;
                }
            } else {
                // If capturing, check if we hit next match header
                if (row.includes('<th ') || row.includes('class="CRg1b"')) {
                    // This likely means a new match header or table header
                    break;
                }

                // Parse Board Row
                if (row.match(/class="CRg[12]"/)) {
                    const cells = row.split('</td>');
                    // Structure based on observation:
                    // Cell 0: Board (e.g. "3.1")
                    // Cell 2: White Name
                    // Cell 3: White Elo
                    // Cell 6: Black Name
                    // Cell 7: Black Elo
                    // Cell 8: Result (e.g. "1 - 0")

                    if (cells.length > 5) {
                        // White/Black variable names were misleading.
                        // Col 3 is Home Team Player. Col (Find Comma) is Guest Team Player.
                        const board = clean(cells[0]);
                        const homePlayer = clean(cells[3]);

                        // Home Elo
                        const rawElo4 = clean(cells[4]);
                        const rawElo5 = clean(cells[5]);
                        let homeElo = isElo(rawElo5) ? rawElo5 : (isElo(rawElo4) ? rawElo4 : '');

                        // Find Guest Player (look for comma) start from 6
                        let guestIndex = -1;
                        let guestPlayer = '';
                        for (let i = 6; i < cells.length; i++) {
                            const txt = clean(cells[i]);
                            // Look for name format "Surname, Name"
                            if (txt.includes(',') && txt.length > 3) {
                                guestPlayer = txt;
                                guestIndex = i;
                                break;
                            }
                        }

                        // Fallback
                        if (!guestPlayer) {
                            if (clean(cells[8]).length > 2) { guestPlayer = clean(cells[8]); guestIndex = 8; }
                            else if (clean(cells[9]).length > 2) { guestPlayer = clean(cells[9]); guestIndex = 9; }
                        }

                        // Guest Elo
                        let guestElo = '';
                        if (guestIndex > -1) {
                            const after1 = clean(cells[guestIndex + 1]);
                            const after2 = clean(cells[guestIndex + 2]);
                            if (isElo(after2)) guestElo = after2;
                            else if (isElo(after1)) guestElo = after1;
                        }

                        // Result
                        let result = '';
                        for (let i = cells.length - 1; i > 0; i--) {
                            const txt = clean(cells[i]);
                            if (txt.match(/^\d+[½\.]?\s*[:\-]\s*\d+[½\.]?$/)) {
                                result = txt;
                                break;
                            }
                        }
                        if (!result && cells.length > 10) result = clean(cells[10]);

                        boards.push({ board, homePlayer, homeElo, guestPlayer, guestElo, result });
                    } else {
                        // Fallback if structure is different (sometimes Elo is missing?)
                        // Just capture the raw cleaned text
                        boards.push({ raw: cleanRow });
                    }
                }
            }
        }
        console.log('End of capturing group');
        return boards;
    } catch (e) {
        console.error('Error scraping details:', e.message);
        return [];
    }
}

// Test Data (from listings)
// URL: https://s3.chess-results.com/tnr1243811.aspx?lan=5&art=46&SNode=S0
// Match: TJ Bižuterie Jablonec (Home) vs ŠK Teplice (Away) - Round 2
// Result: 5 : 1
// Debugging Adult League KP Liberec (tnr1276470)
// Full Flow Test
const STANDINGS_URL = 'https://s2.chess-results.com/tnr1278502.aspx?lan=5&art=46&SNode=S0';
const MY_TEAM_NAME = 'TJ Bižuterie Jablonec';
const ROUND = 1;
const HOME_TEAM = 'Desko Liberec'; // Short in this case
const AWAY_TEAM = 'TJ Bižuterie Jablonec n.N. A'; // Long version that likely causes failure

async function testFullFlow() {
    console.log('Fetching standings from:', STANDINGS_URL);
    const response = await fetch(STANDINGS_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await response.text();
    console.log('HTML length:', html.length);
    console.log('Contains "Bižuterie"?', html.toLowerCase().includes('bižuterie'));
    const rows = html.split('</tr>');

    // Helper to decode entities for matching
    const decode = (str) => str.replace(/&#(\d+);/g, (m, d) => String.fromCharCode(d));

    // Fuzzy name matcher: Remove common suffixes/prefixes that vary
    const simplify = (name) => {
        return name.toLowerCase()
            .replace(/n\.n\./g, '')
            .replace(/["']/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    let teamUrl = null;

    // Use Long Names to simulate issue
    const searchHome = simplify(HOME_TEAM);
    const searchAway = simplify(AWAY_TEAM);

    console.log(`Searching for teams simplified: '${searchHome}' and '${searchAway}'`);

    for (const row of rows) {
        // ... (find url logic - simplified for this test)
        if (decode(row).toLowerCase().includes('bižuterie')) {
            if (!teamUrl) { // Only grab first for now
                const urlMatch = row.match(/href="([^"]+)"/);
                if (urlMatch) {
                    teamUrl = urlMatch[1].replace(/&amp;/g, '&');
                    if (!teamUrl.startsWith('http')) {
                        const origin = new URL(STANDINGS_URL).origin;
                        teamUrl = teamUrl.startsWith('/') ? origin + teamUrl : origin + '/' + teamUrl;
                    }
                    console.log('Extracted Team URL:', teamUrl);

                    // Simulate server.js transformation
                    let detailsUrl = teamUrl;
                    if (detailsUrl.includes('art=')) {
                        detailsUrl = detailsUrl.replace(/art=\d+/, 'art=3');
                    } else {
                        detailsUrl += '&art=3';
                    }
                    detailsUrl += `&rd=${ROUND}`;

                    console.log('Transformed Details URL:', detailsUrl);

                    // Use this URL for fetch
                    teamUrl = detailsUrl;
                }
            }
        }
    }

    if (teamUrl) {
        console.log('Fetching Schedule from:', teamUrl);
        // teamUrl is art=20 usually
        const scheduleRes = await fetch(teamUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const scheduleHtml = await scheduleRes.text();
        // Parse schedule for Round 1
        // Usually row: 1 | ... | Opponent | Result
        const sRows = scheduleHtml.split('</tr>');
        let opponent = '';

        for (const sRow of sRows) {
            const txt = clean(sRow);
            // Look for Round 1
            // Format: 1 ... Name ...
            // Assume column with link is opponent?
            if (txt.match(/^1\s+/)) {
                // Opponent is usually in a link that is NOT my team
                // Find all links
                const links = sRow.match(/<a[^>]+>([^<]+)<\/a>/g);
                if (links) {
                    for (const l of links) {
                        const name = clean(l);
                        if (!name.toLowerCase().includes('bižuterie')) {
                            opponent = name;
                            break;
                        }
                    }
                }
            }
            if (opponent) break;
        }

        if (opponent) {
            console.log(`Found Opponent for Round ${ROUND}: ${opponent}`);
            // NOW test details
            console.log('Testing scrapeMatchDetails with this URL...');
            const boards = await scrapeMatchDetails(teamUrl, ROUND, MY_TEAM_NAME, opponent);
            console.log('Result:', JSON.stringify(boards, null, 2));
        } else {
            console.log('Could not find opponent for Round 1 in schedule.');
            console.log('Schedule HTML sample:', scheduleHtml.substring(0, 1000));
        }

    } else {
        console.error('Could not find team URL in standings.');
    }
}

testFullFlow();
