
// MOCK SERVER LOGIC
async function testServerLogic() {
    const url = 'https://s2.chess-results.com/tnr1278502.aspx?lan=5&art=2';
    console.log(`Fetching ${url}...`);
    const response = await fetch(url);
    const html = await response.text();
    const rows = html.split('</tr>');

    let allMatches = [];

    const clean = (s) => {
        if (!s) return '';
        // Replace tags with space to prevent merging text (e.g. "Name</td><td>Score")
        let txt = s.replace(/<[^>]*>/g, ' ').trim();
        txt = txt.replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&frac12;/g, '½')
            .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
        // Collapse multiple spaces
        return txt.replace(/\s+/g, ' ').trim();
    };

    for (const row of rows) {
        if (row.match(/class="CRg[12]b?"/)) {
            let cells = row.split('</th>');
            if (cells.length < 3) cells = row.split('</td>');
            if (cells.length > 5) {
                const col0 = clean(cells[0]); // match no
                const col1 = clean(cells[1]); // Home
                const col2 = clean(cells[2]); // Away
                if (col0.match(/^\d+$/)) {
                    console.log(`Row ${col0}:`);
                    const r1 = clean(cells[3]);
                    const r2 = clean(cells[5]);
                    console.log(`  Cells 3/5: "${r1}" : "${r2}"`);

                    const cleanRow = clean(row);
                    const resultMatch = cleanRow.match(/(\d*[,.]?\d*[½]?)\s*[:]\s*(\d*[,.]?\d*[½]?)/);
                    console.log(`  Regex Row: ${resultMatch ? resultMatch[0] : 'No match'}`);
                }
            }
        }
    }
}

testServerLogic();
