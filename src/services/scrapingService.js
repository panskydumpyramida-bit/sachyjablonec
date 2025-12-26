/**
 * Scraping Service - Chess.cz result scraping functions
 * Extracted from server.js to reduce monolithic file size
 */

import { clean, isElo, simplify, isMatch, fetchWithHeaders } from '../utils/helpers.js';

/**
 * Scrape match details (board pairings) for a specific match
 * Uses art=3 page from chess-results.com
 * 
 * @param {string} compUrl - Competition URL
 * @param {string} round - Round number
 * @param {string} homeTeam - Home team name
 * @param {string} awayTeam - Away team name
 * @returns {Promise<Array>} Array of board results
 */
export async function scrapeMatchDetails(compUrl, round, homeTeam, awayTeam) {
    // Construct clean URL for pairings (all matches in round)
    // Remove 'snr' (team filter) and 'SNode' to ensure we get general pairings table
    let detailsUrl = compUrl
        .replace(/&snr=\d+/, '')
        .replace(/&SNode=[^&]+/, '');

    if (detailsUrl.includes('art=')) {
        detailsUrl = detailsUrl.replace(/art=\d+/, 'art=3');
    } else {
        detailsUrl += '&art=3';
    }
    detailsUrl += `&rd=${round}`;

    console.log(`[ScrapingService] Scraping details: ${detailsUrl} for ${homeTeam} vs ${awayTeam}`);

    try {
        const response = await fetchWithHeaders(detailsUrl);
        const html = await response.text();

        // Check if blocked or empty
        if (html.length < 500) {
            console.error('[ScrapingService] Warning: Scraped HTML is very short, might be blocked.');
        }

        // Split by starting tag of main rows to handle nested tables
        const parts = html.split('<tr class="');
        const rows = parts.map(p => '<tr class="' + p);

        const boards = [];
        let capturing = false;

        for (const row of rows) {
            const cleanRow = clean(row);

            // Detect Match Header
            if (!capturing) {
                // Check if row contains both team names using fuzzy logic
                if (isMatch(homeTeam, cleanRow) && isMatch(awayTeam, cleanRow)) {
                    capturing = true;
                    continue;
                }
            } else {
                // If capturing, check if we hit next match header
                if (row.includes('<th ') || row.includes('class="CRg1b"')) {
                    break;
                }

                // Parse Board Row
                if (row.match(/class="CRg[12]"/)) {
                    const cells = row.split('</td>');

                    if (cells.length > 5) {
                        // Board number (e.g. "1", "2.1")
                        const board = clean(cells[0]);

                        // Col 3 is Home Team Player
                        const homePlayer = clean(cells[3]);

                        // Home Elo
                        const rawElo4 = clean(cells[4]);
                        const rawElo5 = clean(cells[5]);
                        let homeElo = isElo(rawElo5) ? rawElo5 : (isElo(rawElo4) ? rawElo4 : '');

                        // Find Guest Player (look for comma) start from 6
                        let guestIndex = -1;
                        let guestPlayer = '';
                        for (let i = 6; i < cells.length; i++) {
                            const txt = clean(cells[i]);
                            if (txt.includes(',') && txt.length > 3) {
                                guestPlayer = txt;
                                guestIndex = i;
                                break;
                            }
                        }

                        // Fallback
                        if (!guestPlayer) {
                            if (clean(cells[8]).length > 2) { guestPlayer = clean(cells[8]); guestIndex = 8; }
                            else if (clean(cells[9]).length > 2) { guestPlayer = clean(cells[9]); guestIndex = 9; }
                        }

                        // Guest Elo
                        let guestElo = '';
                        if (guestIndex > -1) {
                            const after1 = clean(cells[guestIndex + 1]);
                            const after2 = clean(cells[guestIndex + 2]);
                            if (isElo(after2)) guestElo = after2;
                            else if (isElo(after1)) guestElo = after1;
                        }

                        // Result
                        let result = '';
                        for (let i = cells.length - 1; i > 0; i--) {
                            const txt = clean(cells[i]);
                            if (txt.match(/^[\d½]+[.,]?[\d½]?\s*[:\-]\s*[\d½]+[.,]?[\d½]?$/)) {
                                result = txt;
                                break;
                            }
                            if (txt === '½' || txt === '0.5' || txt === '0,5') {
                                const prevTxt = i > 1 ? clean(cells[i - 1]) : '';
                                if (prevTxt === '½' || prevTxt === '0.5' || prevTxt === '0,5') {
                                    result = '½ - ½';
                                    break;
                                }
                            }
                        }
                        if (!result && cells.length > 10) result = clean(cells[10]) || '-';

                        boards.push({ board, homePlayer, homeElo, guestPlayer, guestElo, result });
                    } else {
                        boards.push({ raw: cleanRow });
                    }
                }
            }
        }
        return boards;
    } catch (e) {
        console.error('[ScrapingService] Error scraping details:', e.message);
        return [];
    }
}

/**
 * Scrape team roster with individual player results
 * Uses art=1 page from chess-results.com
 * 
 * @param {string} compUrl - Competition URL
 * @param {number} teamSnr - Team serial number
 * @returns {Promise<Array>} Array of player objects
 */
export async function scrapeTeamRoster(compUrl, teamSnr) {
    let rosterUrl = compUrl
        .replace(/&snr=\d+/, '')
        .replace(/&SNode=[^&]+/, '');

    if (rosterUrl.includes('art=')) {
        rosterUrl = rosterUrl.replace(/art=\d+/, 'art=1');
    } else {
        rosterUrl += '&art=1';
    }
    rosterUrl += `&snr=${teamSnr}`;

    console.log(`[ScrapingService] Scraping roster: ${rosterUrl}`);

    try {
        const response = await fetchWithHeaders(rosterUrl);
        const html = await response.text();

        const players = [];
        const rows = html.split('<tr');

        for (const row of rows) {
            if (!row.match(/class="CRg[12]/)) continue;

            const cells = row.split('</td>');
            if (cells.length < 6) continue;

            // Extract rank
            const rankMatch = cells[0]?.match(/<td class="CRc">(\d+)/);
            const rank = rankMatch ? parseInt(rankMatch[1]) : null;

            // Extract name
            const nameMatch = row.match(/<a[^>]*class="CRdb"[^>]*>([^<]+)</i);
            const name = nameMatch ? clean(nameMatch[1]) : null;

            // Extract ELO
            const eloMatch = row.match(/<td class="CRr">(\d+)/);
            const elo = eloMatch ? parseInt(eloMatch[1]) : null;

            // Extract Performance
            const allCrrMatches = row.match(/<td class="CRr">(\d+)/g) || [];
            let perf = null;
            if (allCrrMatches.length >= 2) {
                const lastCrr = allCrrMatches[allCrrMatches.length - 1];
                const perfMatch = lastCrr.match(/(\d+)/);
                perf = perfMatch ? parseInt(perfMatch[1]) : null;
            }

            // Count results
            let played = 0;
            let points = 0;
            const fideIndex = row.indexOf('ratings.fide.com');
            if (fideIndex > -1) {
                const afterFide = row.substring(fideIndex);
                const resultCells = afterFide.match(/<td class="CRc">([^<]*)/g) || [];
                const roundResultCells = resultCells.slice(0, -2);

                for (const cell of roundResultCells) {
                    const val = cell.replace(/<td class="CRc">/, '').trim();
                    if (val === '1') { played++; points += 1; }
                    else if (val === '0') { played++; }
                    else if (val === '½' || val === '&frac12;') { played++; points += 0.5; }
                }
            }

            if (name && rank) {
                players.push({
                    rank,
                    name,
                    elo: elo || null,
                    perf: perf || null,
                    played,
                    points,
                    score: played > 0 ? `${points}/${played}` : '-'
                });
            }
        }

        return players;
    } catch (e) {
        console.error('[ScrapingService] Error scraping roster:', e.message);
        return [];
    }
}

/**
 * Scrape all matches from competition pairings
 * Uses art=2 page from chess-results.com
 * 
 * @param {string} compUrl - Competition URL
 * @returns {Promise<Array>} Array of match objects
 */
export async function scrapeCompetitionMatches(compUrl) {
    let matchesUrl = compUrl;
    if (matchesUrl.includes('art=')) {
        matchesUrl = matchesUrl.replace(/art=\d+/, 'art=2');
    } else {
        matchesUrl += '&art=2';
    }

    try {
        console.log(`[ScrapingService] Scraping pairings: ${matchesUrl}`);
        const response = await fetchWithHeaders(matchesUrl);
        const html = await response.text();
        const rows = html.split('</tr>');
        const allMatches = [];

        let currentRound = null;
        let currentDate = null;

        for (const row of rows) {
            // Check for Round header
            if (row.includes('Runde') || row.includes('Round') || row.includes('Kolo')) {
                const text = clean(row);
                const roundMatch = text.match(/(\d+)\.\s*(Runde|Round|Kolo)/i);
                if (roundMatch) {
                    currentRound = roundMatch[1];

                    let dateMatch = text.match(/Datum kola\s*([\d\/.]+)/);
                    if (!dateMatch) {
                        dateMatch = text.match(/(\d{1,2}\.\d{1,2}\.\d{4}|\d{4}\/\d{1,2}\/\d{1,2})/);
                    }
                    if (dateMatch) currentDate = dateMatch[1];
                }
            }

            // Match generic CRg rows
            if (row.match(/class="CRg[12]b?"/)) {
                let cells = row.split('</th>');
                if (cells.length < 3) cells = row.split('</td>');

                if (cells.length > 5) {
                    const col0 = clean(cells[0]);
                    const col1 = clean(cells[1]);
                    const col2 = clean(cells[2]);

                    if (col0.match(/^\d+$/)) {
                        const homeTeam = col1;
                        const awayTeam = col2;

                        let resultMatch = null;
                        const r1 = clean(cells[3]);
                        const r2 = clean(cells[5]);

                        if ((r1.match(/[\d½]/) && r2.match(/[\d½]/)) || (r1 === '½' || r2 === '½')) {
                            resultMatch = [`${r1} : ${r2}`, r1, r2];
                        }

                        if (!resultMatch) {
                            const cleanRow = clean(row);
                            resultMatch = cleanRow.match(/(\d*[,.]?\d*[½]?)\s*[:]\s*(\d*[,.]?\d*[½]?)/);
                        }

                        if (currentRound && homeTeam && awayTeam) {
                            allMatches.push({
                                round: currentRound,
                                date: currentDate,
                                home: homeTeam,
                                away: awayTeam,
                                result: resultMatch ? `${resultMatch[1]} : ${resultMatch[2]}` : '-'
                            });
                        }
                    }
                }
            }
        }
        return allMatches;
    } catch (e) {
        console.error('[ScrapingService] Error scraping pairings:', e.message);
        return [];
    }
}

export default {
    scrapeMatchDetails,
    scrapeTeamRoster,
    scrapeCompetitionMatches
};
