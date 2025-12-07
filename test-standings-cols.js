// Debug script to analyze all columns in art=46 standings table
async function analyzeStandingsHtml() {
    const url = 'https://chess-results.com/tnr1276470.aspx?lan=5&art=46';
    console.log('Fetching:', url);

    const response = await fetch(url);
    const html = await response.text();

    // Find the header row to understand column structure
    const headerMatch = html.match(/<tr[^>]*>[\s\S]*?<th[\s\S]*?<\/tr>/i);
    if (headerMatch) {
        const headerCells = headerMatch[0].split('</th>');
        console.log('=== HEADER COLUMNS ===');
        headerCells.forEach((cell, idx) => {
            const text = cell.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
            if (text) console.log(`Col ${idx}: "${text}"`);
        });
    }

    // Parse first few data rows
    const rows = html.split('<tr');
    let count = 0;
    console.log('\n=== DATA ROWS ===');

    for (const row of rows) {
        if (row.includes('CRg1') || row.includes('CRg2')) {
            const cells = row.split('</td>');
            console.log(`\n--- Row ${++count} ---`);
            cells.forEach((cell, idx) => {
                let text = cell.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
                text = text.replace(/\s+/g, ' ').trim();
                if (text) console.log(`  Cell ${idx}: "${text}"`);
            });
            if (count >= 3) break;
        }
    }
}

analyzeStandingsHtml().catch(console.error);
