

async function testScraper() {
    console.log('Starting Scraper Test...');

    const competitions = [
        {
            id: 'ks-vychod',
            name: 'Krajská soutěž východ',
            type: 'chess-results',
            url: 'https://s2.chess-results.com/tnr1278502.aspx?lan=5&art=46&SNode=S0'
        },
        {
            id: 'kp-liberec',
            name: 'Krajský přebor',
            type: 'chess-results',
            url: 'https://chess-results.com/tnr1276470.aspx?lan=5&art=46'
        }
    ];

    for (const comp of competitions) {
        console.log(`Fetching ${comp.name}...`);
        try {
            const response = await fetch(comp.url);
            const html = await response.text();
            console.log(`Fetched ${html.length} bytes.`);

            const rows = html.split('</tr>');
            console.log(`Found ${rows.length} row chunks.`);

            const standings = [];

            for (const row of rows) {
                if (row.includes('class="CRg1"') || row.includes('class="CRg2"')) {
                    const cells = row.split('</td>');

                    if (cells.length > 7) {
                        const clean = (str) => str.replace(/<[^>]*>/g, '').trim();

                        let rankStr = cells[0];
                        rankStr = clean(rankStr);

                        let teamStr = cells[2];
                        teamStr = clean(teamStr);

                        let pointsStr = cells[7];
                        pointsStr = clean(pointsStr).replace(',', '.');

                        const rank = parseInt(rankStr);
                        const points = parseFloat(pointsStr);

                        if (!isNaN(rank) && teamStr) {
                            standings.push({
                                rank,
                                team: teamStr,
                                points: isNaN(points) ? 0 : points,
                                isBizuterie: teamStr.toLowerCase().includes('bižuterie')
                            });
                        }
                    }
                }
            }

            console.log(`Parsed ${standings.length} teams.`);
            if (standings.length > 0) {
                console.log('Top 3:', standings.slice(0, 3));
            } else {
                console.log('WARNING: No teams parsed!');
                // Log failed row sample?
            }

        } catch (err) {
            console.error('Error:', err);
        }
    }
}

testScraper();
