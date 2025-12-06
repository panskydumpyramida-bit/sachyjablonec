
// Prototype for scraping specific match details from art=3 page
async function scrapeRoundDetails(compUrl, round, homeTeam, awayTeam) {
    // Construct art=3 url
    let detailsUrl = compUrl;
    if (detailsUrl.includes('art=')) {
        detailsUrl = detailsUrl.replace(/art=\d+/, 'art=3');
    } else {
        detailsUrl += '&art=3';
    }
    detailsUrl += `&rd=${round}`;

    console.log(`Fetching details from: ${detailsUrl}`);

    try {
        const response = await fetch(detailsUrl);
        const html = await response.text();
        // Split by starting tag of main rows to avoid issues with nested tables
        // Main rows have class="CRg..."
        const parts = html.split('<tr class="');
        const rows = parts.map(p => '<tr class="' + p);
        console.log(`Found ${rows.length} rows.`);

        const boards = [];
        let capturing = false;

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

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const cleanRow = clean(row);
            if (i < 10) console.log(`[${i}] Clean:`, cleanRow);
            // 1. Detect Match Header
            // We look for a row containing both team names.
            // Note: Team names in art=3 might be slightly different or truncated depending on view, 
            // but usually consistent.
            if (!capturing) {
                const cleanRow = clean(row);
                // Normalize for comparison
                const normRow = cleanRow.toLowerCase();
                const normHome = homeTeam.toLowerCase();
                const normAway = awayTeam.toLowerCase();

                // Debug potential matches
                if (normRow.includes('bižuterie')) {
                    console.log('Potential header row found:', cleanRow);
                }

                if (normRow.includes(normHome) && normRow.includes(normAway)) {
                    console.log('Found match header:', cleanRow);
                    capturing = true;
                    continue;
                }
                // Try partial match if names are long
                if (normRow.includes('bižuterie') && normRow.includes('c') && normRow.includes('d')) {
                    // Fallback check
                }
            }

            if (capturing) {
                // If we hit another header (new match), stop.
                // New match header usually has "class="CRg1b"" or similar distinctive style
                if (row.includes('<th ') || row.includes('class="CRg1b"')) {
                    // Check if it's just a sub-header or next match
                    // Usually CRg1b and it has team names -> next match
                    // But maybe we should just check if the row DOES NOT look like a board row.

                    // Board row usually has: Board No | ... | Name | ...
                    // If row has <th> it is a header.
                    if (row.includes('<th')) break;
                }

                // Parse Board Row
                // Board | Title | Name | Rtg | Result | Title | Name | Rtg
                // Structure varies.
                // Looking at previous output:
                // <tr class="CRg2"><td class="CRc">3.1</td>... <a ...>Mlot, František</a> ...

                if (row.match(/class="CRg[12]"/)) {
                    // Extract data
                    const cells = row.split('</td>');

                    if (boards.length === 0) {
                        console.log('Board Row HTML:', row);
                    }

                    // Actually let's just log what we found for now to verify.
                    const txt = clean(row);
                    boards.push(txt);
                }
            }
        }

        console.log('Extracted Boards:', boards);
        return boards;

    } catch (e) {
        console.error(e);
    }
}

// Test with known data
scrapeRoundDetails(
    'https://s2.chess-results.com/tnr1278502.aspx?lan=5&art=2',
    1, // Round
    'TJ Bižuterie Jablonec n.Nisou "C"', // Home
    'TJ Bižuterie Jablonec n.Nisou "D"'  // Away
);
