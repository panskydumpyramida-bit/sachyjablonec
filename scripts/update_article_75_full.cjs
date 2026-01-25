
const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

// URLs for each category
const categories = [
    { name: 'U8-10', url: 'https://chess-results.com/tnr1091599.aspx?lan=5&art=1' },
    { name: 'U12', url: 'https://chess-results.com/tnr1091600.aspx?lan=5&art=1' },
    { name: 'U14', url: 'https://chess-results.com/tnr1091601.aspx?lan=5&art=1' },
    { name: 'U16-18', url: 'https://chess-results.com/tnr1091602.aspx?lan=5&art=1' },
    { name: 'Elite', url: 'https://chess-results.com/tnr1091604.aspx?lan=5&art=1' }
];

async function scrapeCategory(category) {
    console.log(`Scraping ${category.name}...`);
    try {
        const response = await fetch(category.url);
        const html = await response.text();
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        const table = doc.querySelector('.CRs1');
        if (!table) return [];

        const rows = Array.from(table.querySelectorAll('tr')).slice(1); // Skip header with slice(1) if needed, but CRs1 usually has headers
        // actually looking at CRs1 structure, headers are often in the first row.

        const players = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 5) return;

            const rankText = cells[0].textContent.trim();
            const rank = parseInt(rankText);
            if (isNaN(rank)) return; // Skip non-data rows

            // Improved Scraping with dynamic index detection
            let nameIndex = 3; // Default fallback
            let teamIndex = 4;
            let pointsIndex = 8; // Usually near end

            // Try to find headers in the first row of table if possible, but we are iterating rows.
            // Let's assume standard layout but inspect closely.
            // Columns often: Rank, SNo, Name, Rtg, FED, Club, Pts...

            // Log first row to debug (only once)
            if (rank === 1) {
                console.log(`[DEBUG CATEGORY ${category.name}] Row 1 cells:`, Array.from(cells).map((c, i) => `${i}:${c.textContent.trim()}`));
            }

            // Based on observed failure (TUR in name col), it seems I picked FED column or similar.
            // Let's look for Name. It usually has comma.
            for (let i = 0; i < cells.length; i++) {
                const txt = cells[i].textContent.trim();
                if (txt.includes(',')) {
                    nameIndex = i;
                    break;
                }
            }

            // Name found?
            let name = cells[nameIndex].textContent.trim();

            // Club is usually Name Index + 2 or 3.
            // If Name is 3 (Poř, St.č, Jméno), then:
            // 4: Rtg
            // 5: FED
            // 6: Club
            // 7: Pts

            // Let's try to find Club by looking for known strings "ŠK", "TJ", "Sokol" or just taking Name+3
            let clubIndex = nameIndex + 3;

            // Points is usually the last one or close.
            let points = cells[cells.length - 1].textContent.trim();
            // Verify if it is a number
            if (isNaN(parseFloat(points.replace(',', '.')))) {
                // Try one before last (TB headers sometimes exist)
                let candidate = cells[cells.length - 2].textContent.trim();
                // Or look for column with header "Body" if we could...
                // Let's iterate from back
                for (let j = cells.length - 1; j > nameIndex; j--) {
                    const val = cells[j].textContent.trim();
                    if (/^\d{1,2}([,.]\d)?$/.test(val)) {
                        points = val;
                        break;
                    }
                }
            }

            // Correction for specific Chess-Results column layouts
            // Sometimes: Rank, SNo, Name, Fed, Club, Pts
            // Cells: 0, 1, 2, 3, 4, 5

            // Let's try standard indices if dynamic fails or as baseline
            // If I see "TUR" in name, it means I picked index 2 and it was FED.
            // That means Name was index 1? Or 3?
            // Actually, if Name was index 2 and got "TUR", maybe index 2 IS Fed?
            // Wait, if 0:Rank, 1:SNo, 2:Name...

            // Let's trust the comma detection for Name.

            const rawClub = cells[clubIndex] ? cells[clubIndex].textContent.trim() : "";
            const rawPoints = points;

            // Clean up Name (remove format like "CM", "FM" if any? mostly clean)
            // Name format: "Surname, Firstname" usually.

            // Normalize Club name
            let displayTeam = rawClub;
            if (rawClub.includes('Bižuterie') || rawClub.includes('Jablonec')) {
                displayTeam = '<strong>TJ Bižuterie</strong>';
            } else {
                // Shorten others
                displayTeam = rawClub.replace('ŠK ', '').replace('TJ ', '').replace('Sokol ', '');
            }

            players.push({
                rank: rank,
                name: name,
                team: displayTeam,
                clubOriginal: rawClub,
                points: rawPoints
            });
        });

        // Filter: Top 3 + Bižuterie
        const top3 = players.filter(p => p.rank <= 3);
        const bizuterie = players.filter(p => p.clubOriginal.includes('Bižuterie') || p.clubOriginal.includes('Bižu'));

        // Merge without duplicates
        const map = new Map();
        [...top3, ...bizuterie].forEach(p => map.set(p.rank + p.name, p));

        const finalPlayers = Array.from(map.values()).sort((a, b) => a.rank - b.rank);

        return finalPlayers;

    } catch (e) {
        console.error(`Error scraping ${category.name}:`, e);
        return [];
    }
}

async function generateTableHtml(categoryName, players) {
    let rows = players.map(p => {
        const isBizuterie = p.clubOriginal.includes('Bižuterie') || p.clubOriginal.includes('Bižu');
        const rowClass = isBizuterie ? 'bizuterie-row' : '';
        const nameClass = isBizuterie ? 'highlight-name' : '';
        const nameStyle = isBizuterie ? 'color: #ffca28; font-weight: bold;' : '';
        const rowStyle = isBizuterie ? 'background-color: rgba(59, 130, 246, 0.15);' : '';

        return `
            <tr style="${rowStyle}">
                <td style="padding: 8px; border-bottom: 1px solid #333; text-align: center;">${p.rank}.</td>
                <td style="padding: 8px; border-bottom: 1px solid #333;">${p.name}</td>
                <td style="padding: 8px; border-bottom: 1px solid #333; font-size: 0.9em; color: #aaa;">${p.team}</td>
                <td style="padding: 8px; border-bottom: 1px solid #333; text-align: center;"><strong>${p.points}</strong></td>
            </tr>
        `;
    }).join('');

    return `
        <div id="tab-${categoryName}" class="results-category-content">
            <h3 class="results-category-title" style="color: #d4af37; margin-bottom: 1rem;">Kategorie ${categoryName}</h3>
            <table class="results-table" style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                <thead>
                    <tr style="background: rgba(255,255,255,0.05);">
                        <th style="padding: 8px; text-align: center; color: #888; font-size: 0.85rem;">Poř.</th>
                        <th style="padding: 8px; text-align: left; color: #888; font-size: 0.85rem;">Jméno</th>
                        <th style="padding: 8px; text-align: left; color: #888; font-size: 0.85rem;">Oddíl</th>
                        <th style="padding: 8px; text-align: center; color: #888; font-size: 0.85rem;">Body</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

async function main() {
    let fullHtml = `<div class="results-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">`;

    // Generate tabs header
    categories.forEach((cat, index) => {
        const active = index === 0 ? 'active' : '';
        fullHtml += `<button class="results-tab-btn ${active}" data-tab="tab-${cat.name}" style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #ccc; cursor: pointer; border-radius: 4px; transition: all 0.2s;">${cat.name}</button>`;
    });
    fullHtml += `</div>`;

    // Generate content
    for (const cat of categories) {
        const players = await scrapeCategory(cat);
        const html = await generateTableHtml(cat.name, players);
        // Make first tab active by default logic in HTML usually, or simple class add
        // We will post-process string to add 'active' to first content div
        let content = html;
        if (cat.name === 'U8-10') {
            content = content.replace('class="results-category-content"', 'class="results-category-content active"');
        }
        fullHtml += content;
    }

    // Footer link
    fullHtml += `
    <div class="results-link" style="margin-top: 1.5rem; text-align: center;">
        <a href="https://chess-results.com/tnr1091599.aspx?lan=5&art=1" target="_blank" rel="noopener noreferrer" class="btn" style="display: inline-block; padding: 0.6rem 1.2rem; background: linear-gradient(135deg, #d4af37, #b8941f); color: #000; font-weight: 600; text-decoration: none; border-radius: 4px;">
            Kompletní výsledky na Chess-Results
        </a>
    </div>`;

    console.log(fullHtml);

    // Write to file for easy copy/import
    fs.writeFileSync('generated_table.html', fullHtml);
}

main();
