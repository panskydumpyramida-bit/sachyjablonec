// Debug script to analyze chess-results.com HTML structure for roster data
async function analyzeRosterHtml() {
    const url = 'https://chess-results.com/tnr1276470.aspx?lan=5&art=1&snr=1';
    console.log('Fetching:', url);

    const response = await fetch(url);
    const html = await response.text();

    // Split by table rows
    const rows = html.split('<tr');
    let count = 0;

    for (const row of rows) {
        // Look for player rows (have CRg1 or CRg2 class)
        if (!row.match(/class="CRg[12]/)) continue;

        // Extract name (look for CRdb link)
        const nameMatch = row.match(/<a[^>]*class="CRdb"[^>]*>([^<]+)</i);
        if (!nameMatch) continue;

        const name = nameMatch[1];

        // Extract all CRr values (typically: ELO, Performance)
        const crrMatches = [...row.matchAll(/<td class="CRr">(\d+)/g)];
        const crrValues = crrMatches.map(m => m[1]);

        // Extract all CRc values (rank and round results)
        const crcMatches = [...row.matchAll(/<td class="CRc">([^<]*)/g)];
        const crcValues = crcMatches.map(m => m[1].trim());

        console.log('---');
        console.log('Name:', name);
        console.log('CRr values:', crrValues.join(' | '));
        console.log('CRc values:', crcValues.join(' | '));

        // Interpret: First CRr should be ELO, last CRr could be Perf
        if (crrValues.length >= 1) {
            console.log('  -> ELO:', crrValues[0]);
        }
        if (crrValues.length >= 2) {
            console.log('  -> Perf:', crrValues[crrValues.length - 1]);
        }

        // Count results from CRc (after rank which is first)
        // FIXED: Exclude last 2 cells which are totals (points sum and games played)
        const roundResults = crcValues.slice(1, -2); // skip rank, exclude last 2
        let played = 0, points = 0;
        for (const val of roundResults) {
            if (val === '1') { played++; points += 1; }
            else if (val === '0') { played++; }
            else if (val === '½' || val.includes('frac12')) { played++; points += 0.5; }
        }
        console.log('  -> Score:', points + '/' + played);

        count++;
        if (count >= 6) break;
    }
}

analyzeRosterHtml().catch(console.error);
