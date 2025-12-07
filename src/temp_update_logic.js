
// Helper to update standings (shared by API and Startup)
async function updateStandings(competitions = null) {
    if (!competitions) {
        competitions = await prisma.competition.findMany({
            where: { active: true }
        });
    }

    const results = [];

    for (const comp of competitions) {
        try {
            console.log(`Processing ${comp.name}...`);
            let standings = [];
            let competitionMatches = []; // Store full schedule

            if (comp.type === 'chess-results') {
                // 1. Fetch Schedule first (art=2)
                competitionMatches = await scrapeCompetitionMatches(comp.url);

                // 2. Fetch Standings (art=46)
                const response = await fetchWithHeaders(comp.url);
                const html = await response.text();

                const rows = html.split('</tr>');

                for (const row of rows) {
                    if (row.includes('class="CRg1"') || row.includes('class="CRg2"')) {
                        const cells = row.split('</td>');

                        if (cells.length > 7) {
                            const clean = (str) => {
                                let txt = str.replace(/<[^>]*>/g, '').trim();
                                txt = txt.replace(/&nbsp;/g, ' ')
                                    .replace(/&amp;/g, '&')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>')
                                    .replace(/&quot;/g, '"')
                                    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
                                return txt;
                            };

                            let rankStr = clean(cells[0]);
                            let teamStr = clean(cells[2]);
                            const urlMatch = teamStr.match(/href="([^"]+)"/);
                            let teamDetailsUrl = urlMatch ? urlMatch[1] : null;
                            if (teamDetailsUrl && !teamDetailsUrl.startsWith('http')) {
                                const origin = new URL(comp.url).origin;
                                teamDetailsUrl = teamDetailsUrl.startsWith('/') ? origin + teamDetailsUrl : origin + '/' + teamDetailsUrl;
                            }

                            teamStr = clean(teamStr);
                            const games = parseInt(clean(cells[3])) || 0;
                            const wins = parseInt(clean(cells[4])) || 0;
                            const draws = parseInt(clean(cells[5])) || 0;
                            const losses = parseInt(clean(cells[6])) || 0;
                            // Fix comma/dot decimal
                            let pointsStr = clean(cells[7]).replace(',', '.');
                            let scoreStr = clean(cells[8]).replace(',', '.');
                            const rank = parseInt(rankStr);
                            const points = parseFloat(pointsStr);
                            const score = parseFloat(scoreStr);

                            if (!isNaN(rank) && teamStr) {
                                const lowerName = teamStr.toLowerCase();
                                const isBizuterie = lowerName.includes('bižuterie') ||
                                    lowerName.includes('bizuterie') ||
                                    (lowerName.includes('jablonec') &&
                                        (lowerName.includes('tj') || lowerName.includes('šk') ||
                                            lowerName.includes('sk') || lowerName.includes('ddm')));

                                standings.push({
                                    rank,
                                    team: teamStr,
                                    games,
                                    wins,
                                    draws,
                                    losses,
                                    points: isNaN(points) ? 0 : points,
                                    score: isNaN(score) ? 0 : score,
                                    isBizuterie: isBizuterie,
                                    url: teamDetailsUrl
                                });
                            }
                        }
                    }
                }

                // 3. Assign schedule
                for (const team of standings) {
                    if (team.isBizuterie) {
                        team.schedule = competitionMatches.filter(m =>
                            m.home === team.team || m.away === team.team ||
                            m.home.includes(team.team) || m.away.includes(team.team)
                        ).map(m => {
                            const isHome = m.home === team.team || m.home.includes(team.team);
                            return {
                                round: m.round,
                                date: m.date || 'TBD',
                                opponent: isHome ? m.away : m.home,
                                result: m.result,
                                isHome: isHome
                            };
                        });
                    }
                }

            } else {
                // chess.cz logic
                const response = await fetch(`https://www.chess.cz/soutez/${comp.id}/`);
                const html = await response.text();
                const lines = html.split('\n');
                for (const line of lines) {
                    if (line.includes('druzstvo') && line.includes('<tr>')) {
                        const rankMatch = line.match(/<tr>\s*<td>(\d+)<\/td>/);
                        const teamMatch = line.match(/<a[^>]*druzstvo[^>]*>([^<]+)<\/a>/);
                        const pointsMatch = line.match(/<b>(\d+)<\/b>/);

                        if (rankMatch && teamMatch && standings.length < 12) {
                            const rank = parseInt(rankMatch[1]);
                            const teamName = teamMatch[1].trim();
                            const points = pointsMatch ? parseInt(pointsMatch[1]) : null;

                            standings.push({
                                rank,
                                team: teamName,
                                points,
                                isBizuterie: teamName.toLowerCase().includes('bižuterie')
                            });
                        }
                    }
                }
            }

            // Sort by rank
            standings.sort((a, b) => a.rank - b.rank);

            results.push({
                competitionId: comp.id,
                name: comp.name,
                url: comp.url || comp.chessczUrl,
                category: comp.category || 'youth',
                standings: standings,
                updatedAt: new Date().toISOString()
            });

        } catch (err) {
            console.error(`Error fetching ${comp.name}:`, err.message);
            results.push({
                competitionId: comp.id,
                name: comp.name,
                error: err.message,
                standings: []
            });
        }
    }

    // Save results to DB
    for (const competitionResult of results) {
        // Critical Fix: Prevent deletion if scrape failed
        if (competitionResult.error || !competitionResult.standings || competitionResult.standings.length === 0) {
            console.warn(`⚠️ Skipping DB update for ${competitionResult.name} - scraping failed or empty.`);
            continue;
        }

        try {
            await prisma.$transaction(async (tx) => {
                await tx.standing.deleteMany({
                    where: { competitionId: competitionResult.competitionId }
                });

                for (const s of competitionResult.standings) {
                    await tx.standing.create({
                        data: {
                            competitionId: competitionResult.competitionId,
                            team: s.team,
                            rank: parseInt(s.rank) || 0,
                            games: s.games,
                            wins: s.wins,
                            draws: s.draws,
                            losses: s.losses,
                            points: s.points,
                            score: s.score,
                            scheduleJson: JSON.stringify(s.schedule || [])
                        }
                    });
                }
            }, {
                timeout: 20000 // Extended timeout
            });
            console.log(`✅ Standings data saved for ${competitionResult.name}`);
        } catch (dbErr) {
            console.error(`Error saving standings for ${competitionResult.name}:`, dbErr);
            competitionResult.error = `DB Save Error: ${dbErr.message}`;
        }
    }

    return results;
}
