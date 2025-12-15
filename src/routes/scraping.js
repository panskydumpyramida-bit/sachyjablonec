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

        // Split by TR to isolate rows
        const rows = html.split('<tr');

        // Column mapping for Start List (art=1? No, default start list)
        // Adjust indices based on observation:
        // 0: Rank (class CRc)
        // 1: Empty
        // 2: Name (class CR)
        // 3: FideID
        // 4: FED (class CR)
        // 5: Rtg (class CRr)
        // 6: Club (class CR)

        rows.forEach(row => {
            // Check for content rows (CRg1/CRg2) - Case insensitive check for safety
            if (!row.match(/class=["']?CRg/i)) return;

            const cells = row.split('</td>');
            if (cells.length < 5) return;

            // Extract Name (Cell 2)
            // Look for link content or just cell content
            const cell2 = cells[2] || '';
            let name = clean(cell2);

            // Extract Rank (Cell 0)
            let rank = clean(cells[0] || '');

            // Extract Elo (Cell 5)
            let elo = clean(cells[5] || '');
            if (!elo.match(/\d+/)) elo = ''; // clear if not number

            // Extract Club (Cell 6)
            let club = clean(cells[6] || '');

            // Extract FED (Cell 4)
            let fed = clean(cells[4] || '');

            if (name) {
                players.push({
                    rank,
                    name,
                    elo,
                    club,
                    fed
                });
            }
        });

        res.json({ players, count: players.length });

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ error: 'Failed to scrape data', details: error.message });
    }
});

export default router;
