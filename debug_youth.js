import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001/api';

async function check() {
    try {
        console.log('Fetching standings...');
        const res = await fetch(`${API_URL}/standings`);
        const data = await res.json();
        const standings = data.standings || data;
        const youth = standings.filter(c => c.category === 'youth');

        console.log(`Found ${youth.length} youth competitions`);

        youth.forEach(c => {
            if (c.name.includes('Krajská soutěž')) {
                console.log(`\nCompetition: ${c.name}`);
                const teams = c.standings.filter(s => /bižuterie|jablonec/i.test(s.team));
                teams.forEach(t => {
                    console.log(`  Team: ${t.team}`);
                    if (t.schedule && t.schedule.length > 0) {
                        console.log(`    First Match: ${JSON.stringify(t.schedule[0])}`);
                        // Create a hash of the schedule to verify uniqueness
                        const hash = t.schedule.map(m => m.date + m.opponent).join('|');
                        console.log(`    Schedule Hash (first 50 chars): ${hash.substring(0, 50)}...`);
                    } else {
                        console.log('    No schedule');
                    }
                });
            }
        });

    } catch (e) {
        console.error('Error:', e);
    }
}

check();
