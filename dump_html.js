
import fs from 'fs';

const URL = 'https://s3.chess-results.com/tnr1243811.aspx?lan=5&art=46&SNode=S0';

async function run() {
    console.log('Fetching...');
    const res = await fetch(URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await res.text();
    console.log('Length:', html.length);
    fs.writeFileSync('debug_output.html', html);
    console.log('Saved to debug_output.html');
}

run();
