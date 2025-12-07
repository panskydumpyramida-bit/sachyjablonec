import fetch from 'node-fetch';

const fetchWithHeaders = (url) => fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

const clean = (str) => {
    let txt = str.replace(/<[^>]*>/g, '').trim();
    txt = txt.replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(d));
    return txt;
};

async function scrapeCompetitionMatches(compUrl) {
    console.log(`Testing URL: ${compUrl}`);

    // Standard art=2 logic for competitions with art=46
    let matchesUrl = compUrl;
    if (matchesUrl.includes('art=')) {
        matchesUrl = matchesUrl.replace(/art=\d+/, 'art=2');
    } else {
        matchesUrl += '&art=2';
    }

    try {
        console.log(`Scraping pairings: ${matchesUrl}`);
        const response = await fetchWithHeaders(matchesUrl);
        if (!response.ok) {
            console.error(`FAILED: ${response.status} ${response.statusText}`);
            return [];
        }

        const html = await response.text();
        console.log(`Length: ${html.length}`);

        const rows = html.split('</tr>');
        const allMatches = [];
        let currentRound = null;
        let currentDate = null;

        let matchCount = 0;

        for (const row of rows) {
            if (row.includes('Runde') || row.includes('Round') || row.includes('Kolo')) {
                const text = clean(row);
                const roundMatch = text.match(/(\d+)\.\s*(Runde|Round|Kolo)/i);
                if (roundMatch) {
                    currentRound = roundMatch[1];
                    let dateMatch = text.match(/Datum kola\s*([\d\/.]+)/);
                    if (!dateMatch) {
                        dateMatch = text.match(/(\d{1,2}\.\d{1,2}\.\d{4}|\d{4}\/\d{1,2}\/\d{1,2})/);
                    }
                    if (dateMatch) currentDate = dateMatch[1];
                }
            }

            if (row.match(/class="CRg[12]b?"/)) {
                let cells = row.split('</th>');
                if (cells.length < 3) cells = row.split('</td>');

                if (cells.length > 5) {
                    const col0 = clean(cells[0]);
                    if (col0.match(/^\d+$/)) {
                        matchCount++;
                    }
                }
            }
        }
        console.log(`Found ${matchCount} matches`);
        return allMatches;
    } catch (e) {
        console.error(`Error: ${e.message}`);
        return [];
    }
}

// Test known URLs
const urls = [
    "https://s1.chess-results.com/tnr1310849.aspx?lan=5&art=0&SNode=S0" // KS st. zaku (art=0)
];

(async () => {
    for (const url of urls) {
        await scrapeCompetitionMatches(url);
    }
})();
