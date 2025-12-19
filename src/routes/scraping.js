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
        const isResults = url.includes('art=1') || url.includes('art=4'); // art=1 is standings, art=4 is cross table but maybe art=1 is safer
        const players = [];

        // Parsing logic
        // We look for rows. 
        // For Standings (art=1): Rank, ..., Name, ..., Pts, ...
        // We reuse the row regex approach but interpret cells differently.

        const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let match;

        while ((match = rowRegex.exec(html)) !== null) {
            const rowContent = match[1];
            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            const cells = [];
            let cellMatch;
            while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
                cells.push(cellMatch[1]);
            }

            if (cells.length < 5) continue;

            // Mapping based on observation:
            // Rank cell is usually first or second depending on if there is a 'No.' col
            // Let's assume standard Chess-Results structure for art=1
            // Col 0: Rank
            // Col 1: SNo (maybe)
            // Col 2: Name (usually with link)
            // ...
            // Points usually near end
            // We need to be a bit robust.

            // Clean all cells
            const cleanedCells = cells.map(c => clean(c));

            // Heuristic for data row: Rank is a number, content is not just header text
            const firstCell = cleanedCells[0];
            const secondCell = cleanedCells[1];

            // Start List (art=0 or default) Logic
            if (!isResults) {
                // Usually: Rank/No., Name, ID, Fed, Rtg, Club...
                const nameRaw = cells[2];
                if (!nameRaw) continue; // Must have name col
                const name = clean(nameRaw);
                const rank = clean(cells[0]);

                if (!rank.match(/^\d+$/)) continue; // Header row check

                let elo = clean(cells[5]);
                if (!elo.match(/^\d+$/)) elo = '';
                const club = clean(cells[6]);
                const fed = clean(cells[4]);

                if (name) {
                    players.push({ rank, name, elo, club, fed });
                }
            }
            // Results (art=1) Logic
            else {
                // Usually: Rank, SNo, Name, Rtg, Club, Pts, TB1, TB2...
                // Index might vary. Let's find Name column by content link or position?
                // Standard: 0:Rank, 1:SNo, 2:Name, 3:Fed, 4:Rtg, 5:Club, 6:Pts...

                const rank = cleanedCells[0];
                if (!rank.match(/^\d+$/)) continue; // Header check

                // Name is typically index 2 or 3 depending on formatting
                // Let's verify commonly Name is at index 3 if there is a Title/Sex col, or 2 if simple.
                // We'll search for the longest string index among first 5 that looks like name?
                // Or sticky to 2.

                // Let's try flexible search for Name (has text, not number)
                let name = cleanedCells[2];
                let club = cleanedCells[5];
                let points = cleanedCells[6]; // Guess

                // Refined mapping for typical Rapid tournament
                // 0: Rk
                // 1: SNo
                // 2: Name
                // 3: Fed
                // 4: Rtg
                // 5: Club/City
                // 6: Pts
                // 7: TB1
                // 8: TB2 
                // 9: TB3

                // Correction if Name is at 3 (sometimes Title is at 2)
                // Just simpler: If cell 3 is FED (3 letters), then Name is 2.

                name = clean(cells[2]); // Name typically has link <a>
                club = cleanedCells[5];
                const rtg = cleanedCells[4];
                points = cleanedCells[cleanedCells.length - 4]; // Points often locally fixed or from end? 
                // Actually scraping standard table is safer by fixed index if layout is standard.
                // Re-check standard: 

                // Let's assume standard layout.
                // If it fails we might need user feedback or more advanced scraping.
                // For now, let's trust index 2=Name, 4=Rtg, 5=Club, last-but-3=Pts? NO.
                // Let's find "Pts." column index in Header and map dynamically? Too complex for regex scrape.

                // Simplified assumptions:
                // Find "Name" cell
                const nameLinkMatch = cells[2].match(/<a[^>]*>(.*?)<\/a>/);
                if (nameLinkMatch) name = clean(nameLinkMatch[1]);

                // Points: usually the cell with number/half (e.g. "6,5" or "7") after club.
                // Let's grab specific cells for now.
                points = cleanedCells[6]; // Common
                const tb1 = cleanedCells[7];
                const tb2 = cleanedCells[8];
                const tb3 = cleanedCells[9];

                players.push({
                    rank,
                    name,
                    elo: rtg,
                    club,
                    points,
                    tb1,
                    tb2,
                    tb3,
                    isResult: true
                });
            }
        }

        res.json({ players, count: players.length, type: isResults ? 'results' : 'startlist' });

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ error: 'Failed to scrape data', details: error.message });
    }
});
// Rosada Profile Scraping
router.get('/rosada/:id', async (req, res) => {
    const { id } = req.params;
    if (!id || !/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'Invalid Rosada ID' });
    }

    const url = `https://elo.rosada.cz/lide/id.php?id=${id}`;

    try {
        console.log(`Scraping Rosada Profile: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch Rosada: ${response.statusText}`);
        }

        const html = await response.text();

        // Helper regex extraction
        // Structure: <td>Elo ČR</td><td>2097</td>
        const eloCrMatch = html.match(/Elo ČR<\/td><td>\s*(\d+)/i);
        const eloFideMatch = html.match(/Elo FIDE<\/td><td>[\s\S]*?>(\d+)<\/a>/i);

        const eloCr = eloCrMatch ? eloCrMatch[1] : 'N/A';
        const eloFide = eloFideMatch ? eloFideMatch[1] : 'N/A';

        res.json({
            id,
            eloCr,
            eloFide,
            url
        });

    } catch (error) {
        console.error('Rosada Scraping error:', error);
        res.status(500).json({ error: 'Failed to scrape Rosada', eloCr: 'N/A', eloFide: 'N/A' });
    }
});

export default router;
