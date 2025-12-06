
async function inspectMatchLinks() {
    const url = 'https://s2.chess-results.com/tnr1278502.aspx?lan=5&art=3&rd=1';
    console.log(`Fetching ${url}...`);
    try {
        const response = await fetch(url);
        const html = await response.text();

        const rows = html.split('</tr>');

        for (const row of rows) {
            if (row.match(/class="CRg[12]b?"/)) {
                let cells = row.split('</th>');
                if (cells.length < 3) cells = row.split('</td>');

                if (cells.length > 3) {
                    console.log('Row HTML:', row);
                    if (cells.length > 10) return; // Stop after a verbose row? No, just print a few.
                    // Just break after 3 rows
                }
            }
        }
        console.log('Match 1 not found.');

    } catch (err) {
        console.error('Error:', err);
    }
}

inspectMatchLinks();
