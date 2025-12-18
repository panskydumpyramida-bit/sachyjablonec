import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Helper to clean HTML text
const clean = (s) => {
    if (!s) return '';
    return s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
};

router.get('/chess-results', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        console.log(`Scraping URL: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const html = await response.text();
        const players = [];

        // Regex to match TRs (case insensitive, multiline dots)
        // We use a simple loop over matches to be safer
        const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let match;

        while ((match = rowRegex.exec(html)) !== null) {
            const rowContent = match[1];

            // Check if it's a data row (contains CRg cells)
            // It usually has class="CRg..." in the TR tag, but we already stripped that.
            // So we check if inner content has CRc/CR classes or looks like data
            // Actually, we can check the original full match if we needed, but checking content is fine.
            // Data rows have multiple TDs.

            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            const cells = [];
            let cellMatch;
            while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
                cells.push(cellMatch[1]);
            }

            if (cells.length < 5) continue;

            // Mapping based on observation:
            // 0: Rank
            // 1: Empty
            // 2: Name
            // 3: FideID
            // 4: FED
            // 5: Rtg
            // 6: Club

            // Verify if it is a player row: Name cell should not be empty
            const nameRaw = cells[2];
            if (!nameRaw) continue;

            const name = clean(nameRaw);
            const rank = clean(cells[0]);

            let elo = clean(cells[5]);
            if (!elo.match(/^\d+$/)) elo = ''; // MUST be digits

            const club = clean(cells[6]);
            const fed = clean(cells[4]);

            // Filter out header rows (where rank is "Čís." or similar)
            if (!rank.match(/^\d+$/)) continue;

            if (name) {
                players.push({
                    rank,
                    name,
                    elo,
                    club,
                    fed
                });
            }
        }

        res.json({ players, count: players.length });

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ error: 'Failed to scrape data', details: error.message });
    }
});

export default router;
