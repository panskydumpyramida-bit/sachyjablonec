
import fetch from 'node-fetch';
import fs from 'fs';

const id = '326720';
const url = `https://ratings.fide.com/profile/${id}`;

async function run() {
    console.log(`Fetching ${url}...`);
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await response.text();
    fs.writeFileSync('fide_profile.html', html);
    console.log('Saved to fide_profile.html');
}

run();
