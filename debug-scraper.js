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
const url = 'https://chess-results.com/tnr1276470.aspx?lan=5&art=3&rd=1';
const myTeam = 'TJ Bižuterie Jablonec n.N. "A"';
const opponent = 'TJ Bižuterie Jablonec n.N. "B"';

scrapeMatchDetails(url, '1', myTeam, opponent).then(boards => {
    console.log('Result:', JSON.stringify(boards, null, 2));
});
