
async function testScraper() {
    // Krajsky prebor art=14
    const url = 'https://s2.chess-results.com/tnr1278502.aspx?lan=5&art=2';
    console.log(`Fetching ${url}...`);
    try {
        const response = await fetch(url);
        const html = await response.text();

        const rows = html.split('</tr>');
        console.log(`Found ${rows.length} rows.`);

        let count = 0;
        for (const row of rows) {
            const clean = row.replace(/<[^>]*>/g, '').trim();
            // Check if row contains date-like string
            if (clean.match(/\d{1,2}\.\d{1,2}\.\d{4}/)) {
                console.log(`Potential Date Row: ${clean}`);
            }

            if (row.includes('class="CRg1"') || row.includes('class="CRg2"')) {
                const cells = row.split('</td>');
                const col0 = cells[0].replace(/<[^>]*>/g, '').trim();

                // If it looks like a match row (starts with number)
                if (col0.match(/^\d+$/)) {
                    console.log(`Match Row (No ${col0}):`);
                    cells.forEach((cell, idx) => {
                        // Minimal cleaning to see entities
                        const rawClean = cell.replace(/<[^>]*>/g, '').trim();
                        console.log(`  Col ${idx}: ${rawClean}`);
                    });
                    if (count++ > 5) break;
                }
            }
        }
        console.log('Done.');

    } catch (err) {
        console.error('Error:', err);
    }
}

testScraper();
