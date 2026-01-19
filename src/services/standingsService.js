/**
 * Standings Service - Competition standings scraping and database updates
 * Extracted from server.js to reduce monolithic file size
 */

import { PrismaClient } from '@prisma/client';
import { clean, isMatch, fetchWithHeaders } from '../utils/helpers.js';
import { scrapeCompetitionMatches } from './scrapingService.js';

const prisma = new PrismaClient();

/**
 * Update standings for all active competitions
 * Fetches latest data from chess-results.com and saves to database
 * 
 * @param {Array|null} competitions - Optional array of competitions to update (defaults to all active)
 * @returns {Promise<Array>} Array of update results per competition
 */
export async function updateStandings(competitions = null) {
    if (!competitions) {
        competitions = await prisma.competition.findMany({
            where: { active: true }
        });
    }

    const results = [];

    for (const comp of competitions) {
        try {
            console.log(`[StandingsService] Processing ${comp.name}...`);
            let standings = [];
            let competitionMatches = [];

            // Auto-detect type from URL
            const isChessResults = comp.url && comp.url.includes('chess-results.com');

            if (isChessResults) {
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
                            let rankStr = clean(cells[0]);

                            // Find team cell dynamically - it's the one with <a href containing team link
                            // This handles cases where "St.č." column is missing in some rows
                            let teamCellIndex = -1;
                            let teamStr = '';
                            let teamDetailsUrl = null;

                            for (let i = 1; i < Math.min(cells.length, 4); i++) {
                                const urlMatch = cells[i].match(/href="([^"]+)"/);
                                if (urlMatch && (cells[i].includes('snr=') || cells[i].includes('art='))) {
                                    teamCellIndex = i;
                                    teamDetailsUrl = urlMatch[1];
                                    teamStr = clean(cells[i]);
                                    break;
                                }
                            }

                            // If no team cell found, skip this row
                            if (teamCellIndex === -1) continue;

                            if (teamDetailsUrl && !teamDetailsUrl.startsWith('http')) {
                                const origin = new URL(comp.url).origin;
                                teamDetailsUrl = teamDetailsUrl.startsWith('/') ? origin + teamDetailsUrl : origin + '/' + teamDetailsUrl;
                            }

                            // Calculate data column indices relative to team cell
                            // Data columns are: games, wins, draws, losses, points, score (6 columns after team)
                            const dataStart = teamCellIndex + 1;
                            const games = parseInt(clean(cells[dataStart])) || 0;
                            const wins = parseInt(clean(cells[dataStart + 1])) || 0;
                            const draws = parseInt(clean(cells[dataStart + 2])) || 0;
                            const losses = parseInt(clean(cells[dataStart + 3])) || 0;
                            // Fix comma/dot decimal
                            let pointsStr = clean(cells[dataStart + 4]).replace(',', '.');
                            let scoreStr = clean(cells[dataStart + 5]).replace(',', '.');

                            // Try to parse rank from cells[0], fallback to cells[1] (St.č.), or use row position
                            let rank = parseInt(rankStr);
                            if (isNaN(rank) && teamCellIndex > 1) {
                                // If cells[0] is empty (e.g. merged row), try cells[1]
                                rank = parseInt(clean(cells[1]));
                            }
                            if (isNaN(rank)) {
                                // Last resort: assign rank based on parsed order
                                rank = standings.length + 1;
                            }

                            const points = parseFloat(pointsStr);
                            const score = parseFloat(scoreStr);

                            if (teamStr) {
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
                            isMatch(team.team, m.home) || isMatch(team.team, m.away)
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
                // LEGACY: chess.cz parser (deprecated)
                console.warn(`[StandingsService] ⚠️ LEGACY: Using chess.cz parser for ${comp.name} - this is deprecated!`);
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
                            const pts = pointsMatch ? parseInt(pointsMatch[1]) : null;

                            standings.push({
                                rank,
                                team: teamName,
                                points: pts,
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
            console.error(`[StandingsService] Error fetching ${comp.name}:`, err.message);
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
            console.warn(`[StandingsService] ⚠️ Skipping DB update for ${competitionResult.name} - scraping failed or empty.`);
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
                timeout: 20000
            });
            console.log(`[StandingsService] ✅ Standings data saved for ${competitionResult.name}`);
        } catch (dbErr) {
            console.error(`[StandingsService] Error saving standings for ${competitionResult.name}:`, dbErr);
            competitionResult.error = `DB Save Error: ${dbErr.message}`;
        }
    }

    return results;
}

export default { updateStandings };
