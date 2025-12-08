import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { existsSync, writeFileSync } from 'fs'; // Import sync methods separately if needed, or use fs/promises entirely

// Import routes
import authRoutes from './routes/auth.js';
import { authMiddleware } from './middleware/auth.js';
import newsRoutes from './routes/news.js';
import reportsRoutes from './routes/reports.js';
import imagesRoutes from './routes/images.js';
import userRoutes from './routes/users.js';
import memberRoutes from './routes/members.js';
import messageRoutes from './routes/messages.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');

const app = express();
const PORT = process.env.PORT || 3001;

// Redirect non-www to www (production only)
app.use((req, res, next) => {
    const host = req.headers.host;
    // Only redirect in production and if host is non-www
    if (host && host === 'sachyjablonec.cz') {
        return res.redirect(301, `https://www.sachyjablonec.cz${req.url}`);
    }
    next();
});

// Health Check (for Railway zero-downtime)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Maintenance Mode Middleware
app.use((req, res, next) => {
    // FORCED MAINTENANCE FOR TESTING (Simulace údržby)
    if (true || process.env.MAINTENANCE_MODE === 'true') {
        // Allow health check even in maintenance
        if (req.path === '/health') return next();

        // Allow admin/login related API calls if needed? 
        // For now, blocking everything except static assets if crucial? 
        // Actually simplest is: if API -> JSON error. If page -> HTML page.

        // Skip for static assets (css, js, images) to ensure maintenance page looks good
        if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
            return next();
        }

        if (req.path.startsWith('/api')) {
            return res.status(503).json({ error: 'System is under maintenance. Please try again later.' });
        }

        // Serve maintenance page for all other routes
        return res.status(503).sendFile(path.join(__dirname, '../public/maintenance.html'));
    }
    next();
});

// Helper: Clean HTML text
const clean = (s) => {
    if (!s) return '';
    // Replace tags with space to prevent merging text
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

const isElo = (s) => {
    if (!s) return false;
    // Checks if string is a number (Elo) or standard placeholders like "-" or empty
    // But we use this to select PREFERRED column, so we want "looks like Elo"
    return /^\d{3,4}$/.test(s) || s === '-';
};

// Helper to fetch with headers
const fetchWithHeaders = (url) => fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

// Helper to scrape match details (art=3)
async function scrapeMatchDetails(compUrl, round, homeTeam, awayTeam) {
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

    console.log(`Scraping details: ${detailsUrl} for ${homeTeam} vs ${awayTeam}`);

    try {
        const response = await fetchWithHeaders(detailsUrl);
        const html = await response.text();

        // Check if blocked or empty
        if (html.length < 500) {
            console.error('Warning: Scraped HTML is very short, might be blocked.');
        }

        // Split by starting tag of main rows to handle nested tables
        const parts = html.split('<tr class="');
        const rows = parts.map(p => '<tr class="' + p);

        const boards = [];
        let capturing = false;

        // Helper for fuzzy matching
        const simplify = (str) => {
            return str.toLowerCase()
                .replace(/n\.n\./g, '')
                .replace(/["']/g, '')
                // Strip common team suffixes like A, B, JR1, JR2 etc.
                .replace(/\s+(jr\d*|[a-d]|"\w+")$/i, '')
                .replace(/\s+/g, ' ')
                .trim();
        };

        const isMatch = (team, rowText) => {
            const simpleTeam = simplify(team);
            const rowLower = rowText.toLowerCase();

            // 1. Direct weak match
            if (rowLower.includes(simpleTeam)) return true;

            // 2. Keyword match (if > 60% of keywords match)
            const words = simpleTeam.split(' ').filter(w => w.length > 2);
            const matches = words.filter(w => rowLower.includes(w));
            return matches.length >= (words.length * 0.6);
        };

        const SimpleHome = simplify(homeTeam);
        const SimpleAway = simplify(awayTeam);

        for (const row of rows) {
            const cleanRow = clean(row);

            // Detect Match Header
            if (!capturing) {
                // Check if row contains both team names using fuzzy logic
                if (isMatch(homeTeam, cleanRow) && isMatch(awayTeam, cleanRow)) {
                    capturing = true;
                    // console.log(`Match found in row: ${cleanRow}`);
                    continue;
                }
            } else {
                // If capturing, check if we hit next match header
                if (row.includes('<th ') || row.includes('class="CRg1b"')) {
                    // This likely means a new match header or table header
                    break;
                }

                // Parse Board Row
                if (row.match(/class="CRg[12]"/)) {
                    const cells = row.split('</td>');
                    // Structure based on observation:
                    // Cell 0: Board (e.g. "3.1")
                    // Cell 2: White Name
                    // Cell 3: White Elo
                    // Cell 6: Black Name
                    // Cell 7: Black Elo
                    // Cell 8: Result (e.g. "1 - 0")

                    if (cells.length > 5) {
                        // Board number (e.g. "1", "2.1")
                        const board = clean(cells[0]);

                        // White/Black variable names were misleading. 
                        // Col 3 is Home Team Player. Col (Find Comma) is Guest Team Player.
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
                            // Look for name format "Surname, Name"
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
                            // Match results like "1 - 0", "½ - ½", "0.5 - 0.5", "1:0"
                            if (txt.match(/^[\d½]+[.,]?[\d½]?\s*[:\-]\s*[\d½]+[.,]?[\d½]?$/)) {
                                result = txt;
                                break;
                            }
                            // Also check for standalone ½ which indicates a draw result
                            if (txt === '½' || txt === '0.5' || txt === '0,5') {
                                // Look for paired ½ in adjacent cells to form "½ - ½"
                                const prevTxt = i > 1 ? clean(cells[i - 1]) : '';
                                if (prevTxt === '½' || prevTxt === '0.5' || prevTxt === '0,5') {
                                    result = '½ - ½';
                                    break;
                                }
                            }
                        }
                        // If no result found but there are enough cells, last resort
                        if (!result && cells.length > 10) result = clean(cells[10]) || '-';

                        boards.push({ board, homePlayer, homeElo, guestPlayer, guestElo, result });
                    } else {
                        // Fallback if structure is different (sometimes Elo is missing?)
                        // Just capture the raw cleaned text
                        boards.push({ raw: cleanRow });
                    }
                }
            }
        }
        return boards;
    } catch (e) {
        console.error('Error scraping details:', e.message);
        return [];
    }
}

// Helper to scrape team roster with individual results (art=1)
async function scrapeTeamRoster(compUrl, teamSnr) {
    // Build URL for team roster page
    let rosterUrl = compUrl
        .replace(/&snr=\d+/, '')
        .replace(/&SNode=[^&]+/, '');

    if (rosterUrl.includes('art=')) {
        rosterUrl = rosterUrl.replace(/art=\d+/, 'art=1');
    } else {
        rosterUrl += '&art=1';
    }
    rosterUrl += `&snr=${teamSnr}`;

    console.log(`Scraping roster: ${rosterUrl}`);

    try {
        const response = await fetchWithHeaders(rosterUrl);
        const html = await response.text();

        const players = [];

        // Split by table rows
        const rows = html.split('<tr');

        for (const row of rows) {
            // Look for player rows (have CRg1 or CRg2 class)
            if (!row.match(/class="CRg[12]/)) continue;

            const cells = row.split('</td>');
            if (cells.length < 6) continue;

            // Extract rank (first CRc cell)
            const rankMatch = cells[0]?.match(/<td class="CRc">(\d+)/);
            const rank = rankMatch ? parseInt(rankMatch[1]) : null;

            // Extract name (look for CRdb link)
            const nameMatch = row.match(/<a[^>]*class="CRdb"[^>]*>([^<]+)</i);
            const name = nameMatch ? clean(nameMatch[1]) : null;

            // Extract ELO (first CRr class - before results)
            const eloMatch = row.match(/<td class="CRr">(\d+)/);
            const elo = eloMatch ? parseInt(eloMatch[1]) : null;

            // Extract Performance (last CRr class - after results)
            const allCrrMatches = row.match(/<td class="CRr">(\d+)/g) || [];
            let perf = null;
            if (allCrrMatches.length >= 2) {
                const lastCrr = allCrrMatches[allCrrMatches.length - 1];
                const perfMatch = lastCrr.match(/(\d+)/);
                perf = perfMatch ? parseInt(perfMatch[1]) : null;
            }

            // Count results in round columns (after FIDE ID column)
            // Results are in CRc cells and can be: 1, 0, ½, empty
            let played = 0;
            let points = 0;

            // Find all result cells (after the FIDE ID link)
            // Note: Last 2 CRc cells are TOTALS (points sum and games played), not round results!
            const fideIndex = row.indexOf('ratings.fide.com');
            if (fideIndex > -1) {
                const afterFide = row.substring(fideIndex);
                const resultCells = afterFide.match(/<td class="CRc">([^<]*)/g) || [];

                // Exclude last 2 cells (they are totals, not round results)
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
        console.error('Error scraping roster:', e.message);
        return [];
    }
}

// Helper to scrape team schedule (art=23)
// Helper to scrape all matches from competition (art=2)
async function scrapeCompetitionMatches(compUrl) {
    // Optimized: Always try art=2 (Pairings of all rounds) first.
    // It works for almost all team competitions and is much faster (1 request vs N rounds).

    let matchesUrl = compUrl;
    if (matchesUrl.includes('art=')) {
        matchesUrl = matchesUrl.replace(/art=\d+/, 'art=2');
    } else {
        matchesUrl += '&art=2';
    }



    try {
        console.log(`Scraping pairings: ${matchesUrl} `);
        const response = await fetchWithHeaders(matchesUrl);
        const html = await response.text();
        const rows = html.split('</tr>');
        const allMatches = [];

        let currentRound = null;
        let currentDate = null;

        for (const row of rows) {
            // Check for Round header (often separate row or in h4)
            // e.g. "1. Runde am 20.10.2024"
            if (row.includes('Runde') || row.includes('Round') || row.includes('Kolo')) {
                const text = clean(row);
                // "1. Kolo 20.10.2024"
                const roundMatch = text.match(/(\d+)\.\s*(Runde|Round|Kolo)/i);
                if (roundMatch) {
                    currentRound = roundMatch[1];

                    // Try to find date with "Datum kola" prefix (common in Czech)
                    let dateMatch = text.match(/Datum kola\s*([\d\/.]+)/);
                    if (!dateMatch) {
                        // Fallback to searching for DD.MM.YYYY or YYYY/MM/DD matches
                        dateMatch = text.match(/(\d{1,2}\.\d{1,2}\.\d{4}|\d{4}\/\d{1,2}\/\d{1,2})/);
                    }

                    if (dateMatch) currentDate = dateMatch[1];
                }
            }

            // Match generic CRg rows
            if (row.match(/class="CRg[12]b?"/)) {
                let cells = row.split('</th>');
                if (cells.length < 3) cells = row.split('</td>');

                // art=2 columns:
                // Col 0: Match No
                // Col 1: Home Team
                // Col 2: Away Team
                // Col 3: Home Result (can be 1½)
                // Col 4: : 
                // Col 5: Away Result

                if (cells.length > 5) {
                    const col0 = clean(cells[0]); // match no
                    const col1 = clean(cells[1]); // Home
                    const col2 = clean(cells[2]); // Away

                    // Verify if col0 is integer (Match number)
                    if (col0.match(/^\d+$/)) {
                        const homeTeam = col1;
                        const awayTeam = col2;

                        let resultMatch = null;

                        // Priority 1: Extract from specific cells (3 and 5)
                        const r1 = clean(cells[3]);
                        const r2 = clean(cells[5]);
                        // If both resemble scores (digits or ½) or are empty/dash
                        // Note: sometimes "-" is used for not played
                        if ((r1.match(/[\d½]/) && r2.match(/[\d½]/)) || (r1 === '½' || r2 === '½')) {
                            resultMatch = [`${r1} : ${r2} `, r1, r2];
                        } else if (r1 === '' && r2 === '') {
                            // Maybe empty cells means not played?
                        }

                        // Priority 2: Fallback to regex on row (safer now with space injection)
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
                                result: resultMatch ? `${resultMatch[1]} : ${resultMatch[2]} ` : '-'
                            });
                        }
                    }
                }
            }
        }
        return allMatches;
    } catch (e) {
        console.error('Error scraping pairings:', e.message);
        return [];
    }
}




// Middleware
app.use(cors({
    origin: true, // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve specific static directories
// Serve specific static directories
['css', 'js', 'images', 'data', 'components'].forEach(dir => {
    app.use(`/ ${dir} `, express.static(path.join(__dirname, `../ ${dir} `)));
});

// Serve HTML files from root
const allowedHtmlFiles = [
    'index.html', 'about.html', 'teams.html', 'club-tournaments.html',
    'youth.html', 'gallery.html', 'admin.html', 'article.html',
    'members.html', 'calendar.html', 'blicak.html'
];

// --- Blicak Registration Endpoints ---
// --- Blicak Registration Endpoints ---

app.get('/api/registration/blicak', async (req, res) => {
    try {
        const registrations = await prisma.blicakRegistration.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(registrations);
    } catch (error) {
        console.error('Error reading registrations:', error);
        res.status(500).json({ error: 'Failed to read registrations' });
    }
});

app.post('/api/registration/blicak', async (req, res) => {
    try {
        const { name, club, lok, year } = req.body;

        if (!name || !year) {
            return res.status(400).json({ error: 'Name and year are required' });
        }

        const newReg = await prisma.blicakRegistration.create({
            data: {
                name,
                club: club || '',
                lok: lok ? String(lok) : '',
                birthYear: parseInt(year),
                eventDate: new Date() // Sets to current time, effectively registering for "now"
            }
        });

        // Return structure matching frontend expectation if needed, or just standard success
        res.json({ success: true, registration: newReg });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Failed to process registration' });
    }
});

app.use(express.static(path.join(__dirname, '../'))); // Serve static files from root loops back to * logic safely
// Middleware to serve static files from root safely
app.use((req, res, next) => {
    // skip api routes
    if (req.path.startsWith('/api')) return next();

    // clean path
    const reqPath = req.path === '/' ? '/index.html' : req.path;

    // check if it's an allowed html file
    const filename = reqPath.split('/').pop();
    if (allowedHtmlFiles.includes(filename) && reqPath.split('/').length === 2) {
        return res.sendFile(path.join(__dirname, `../ ${filename} `));
    }

    next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/users', userRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/messages', messageRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

// Standings scraper - fetches latest standings from chess.cz and saves to file
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

// Standings scraper - fetches latest standings from chess.cz and saves to file
app.post('/api/standings/update', authMiddleware, async (req, res) => {
    try {
        const results = await updateStandings();
        // Return formatted data as frontend expects
        res.json({ success: true, standings: results, lastUpdated: new Date().toISOString() });
    } catch (error) {
        console.error('Standings update error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get competition sources
app.get('/api/competitions', async (req, res) => {
    try {
        const competitions = await prisma.competition.findMany();
        res.json(competitions);
    } catch (err) {
        console.error('Error loading competitions:', err);
        res.status(500).json({ error: 'Failed to load competitions' });
    }
});

// Update competition URL
// Update competition URL or Status
app.put('/api/competitions/:id/url', async (req, res) => {
    try {
        const { id } = req.params;
        const { url, active } = req.body;

        const data = {};
        if (url !== undefined) data.url = url;
        if (active !== undefined) data.active = active;

        const updated = await prisma.competition.update({
            where: { id },
            data
        });

        res.json({ success: true, competition: updated });
    } catch (err) {
        console.error('Error updating competition:', err);
        res.status(500).json({ error: 'Failed to update competition' });
    }
});

// Get cached standings from DB
app.get('/api/standings', async (req, res) => {
    try {
        const competitions = await prisma.competition.findMany({
            include: {
                standings: true
            }
        });

        // Transform to expected format: { standings: [ { competitionId, name, standings: [...] } ] }
        // The frontend expects a specific structure: an array of competition objects with a `standings` array inside.
        // Or rather, the previous JSON structure was `{ standings: [...], lastUpdated: ... }`.

        const validCompetitions = competitions.map(comp => ({
            competitionId: comp.id,
            name: comp.name,
            url: comp.url,
            category: comp.category,
            updatedAt: comp.updatedAt, // Use competition's updatedAt
            standings: comp.standings.map(s => ({
                rank: s.rank,
                team: s.team,
                games: s.games,
                wins: s.wins,
                draws: s.draws,
                losses: s.losses,
                points: s.points,
                score: s.score,
                schedule: JSON.parse(s.scheduleJson || '[]'),
                isBizuterie: s.team.toLowerCase().includes('bižuterie') || s.team.toLowerCase().includes('bizuterie')
            })).sort((a, b) => a.rank - b.rank)
        }));

        res.json({ standings: validCompetitions, lastUpdated: new Date().toISOString() });

    } catch (err) {
        console.error('Error reading standings:', err);
        res.json({ standings: [] });
    }
});

// Fetch detailed match results
app.get('/api/standings/match-details', async (req, res) => {
    const { url, round, home, away } = req.query;
    if (!url || !round || !home || !away) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    const boards = await scrapeMatchDetails(url, round, home, away);
    res.json({ boards });
});

// Get team roster with individual player results
app.get('/api/standings/team-roster', async (req, res) => {
    const { url, snr } = req.query;
    if (!url || !snr) {
        return res.status(400).json({ error: 'Missing parameters: url and snr required' });
    }
    try {
        const players = await scrapeTeamRoster(url, snr);
        res.json({ players });
    } catch (e) {
        console.error('Roster error:', e);
        res.status(500).json({ error: 'Failed to fetch roster' });
    }
});

// Seed Function
const seedDatabase = async () => {
    try {
        const bcrypt = await import('bcrypt');
        // Reuse global prisma instance


        // Check if admin exists to avoid re-hashing password unnecessarily (optional optimization but safe to upsert)
        // Actually, upsert is fine.

        // Create admin user if not exists
        const hashedPassword = await bcrypt.default.hash('admin123', 10);
        const admin = await prisma.user.upsert({
            where: { username: 'admin' },
            update: {}, // Don't update password if exists
            create: {
                username: 'admin',
                email: 'admin@sachyjablonec.cz',
                passwordHash: hashedPassword,
                role: 'superadmin'
            }
        });

        // Games data
        const games1kolo = [
            { title: "1. Duda - Vacek", gameId: "14096201", team: "A tým", commented: true },
            { title: "2. Völfl - Vltavský", gameId: "14102243", team: "A tým" },
            { title: "3. Chvátal - Zadražil", gameId: "14096241", team: "A tým" },
            { title: "4. Šalanda - Žídek", gameId: "14102245", team: "A tým", commented: true },
            { title: "5. Sivák - Tsantsala", gameId: "14102271", team: "A tým" },
            { title: "6. Koten - Fila", gameId: "14096321", team: "A tým" },
            { title: "7. Mlot - Cyhelský", gameId: "14096309", team: "A tým" },
            { title: "8. Brehmová - Vacková", gameId: "14096329", team: "A tým" }
        ];

        const games2kolo = [
            { title: "1. Sýkora - Fraňa", gameId: "14190545", team: "A tým" },
            { title: "2. Přiborský - Duda", gameId: "14190547", team: "A tým", commented: true },
            { title: "3. Vltavský - Pražák", gameId: "14190553", team: "A tým" },
            { title: "4. Jedlička - Durán", gameId: "14190555", team: "A tým" },
            { title: "5. Sivák - Joukl", gameId: "14190557", team: "A tým" },
            { title: "6. Žamboch - Titěra", gameId: "14190559", team: "A tým" },
            { title: "7. Žídek - Tejnský", gameId: "14190561", team: "A tým" },
            { title: "8. Faleš - Fila", gameId: "14190565", team: "A tým" },
            { title: "1. Vacek - Jina", gameId: "14190569", team: "B tým" },
            { title: "2. Völfl - Tsantsala", gameId: "14190571", team: "B tým", commented: true },
            { title: "3. Holeč - Jínová", gameId: "14190575", team: "B tým" },
            { title: "4. Frantsev - Zadražil", gameId: "14190577", team: "B tým" },
            { title: "5. Koten - Halama", gameId: "14190579", team: "B tým" },
            { title: "6. Sichrovský - Cyhelský", gameId: "14190581", team: "B tým" },
            { title: "7. Němec - Drvota", gameId: "14190585", team: "B tým" },
            { title: "8. Jína - Červen", gameId: "14190589", team: "B tým" }
        ];

        // News items
        const newsItems = [
            {
                title: '2. kolo Krajský přebor - Report',
                slug: '2-kolo-krajsky-prebor-report',
                category: 'Soutěže družstev',
                excerpt: 'Report z utkání A a B týmu v 2. kole Krajského přeboru.',
                content: `<p style="margin-bottom: 2rem;">Report z utkání A a B týmu v 2. kole Krajského přeboru. A tým remizoval 4:4 s Tanvaldem, B tým prohrál 3:5 s Deskem Liberec.</p>
                
<!-- Report A Tým -->
<div class="collapsible-wrapper">
    <div class="collapsible-header" onclick="toggleSection('reportA', 'iconA')">
        <h3><i class="fa-solid fa-chess-king"></i> Report z utkání A týmu</h3>
        <i id="iconA" class="fa-solid fa-chevron-up"></i>
    </div>
    <div id="reportA" class="collapsible-content">
        <img src="https://i.ibb.co/twbZWXzm/IMG-3192.jpg" alt="Zápas s Tanvaldem" style="width: 100%; border-radius: var(--border-radius); margin-bottom: 1rem;">
        <p>Áčko nastoupilo proti tradičnímu soupeři z Tanvaldu a oba týmy dorazily v poměrně silných sestavách.</p>
        <p>Na 4. šachovnici sehráli <span class="highlight-name">Tomáš Duran</span> s <span class="highlight-name">Vláďou Jedličkou</span> velmi plochou variantu Philidorovy obrany. Ani jeden nebyl příliš bojovně naladěn, takže zapisujeme první remízu: <span class="highlight-score">0,5 : 0,5</span>.</p>
        <p>Na 3. šachovnici skončil rychlou remízou i duel <span class="highlight-name">Vládi Vltavského</span> s <span class="highlight-name">Ondrou Pražákem</span>, který se odehrál v symetrické pěšcové struktuře. Stav tedy <span class="highlight-score">1 : 1</span>.</p>
        <p><span class="highlight-name">Lukáš Sivák</span> na 5. šachovnici získal s <span class="highlight-name">Zdeňkem Jouklem</span> slibnou pozici s možností útoku, ale pokračoval nepřesně. Nakonec mohl být rád, že mu koryfej jizerského šachu nabídl remízu – <span class="highlight-score">1,5 : 1,5</span>.</p>
        <p>Na první desce sehrál <span class="highlight-name">Marek Sýkora</span> riskantní partii. Sezobl pěšce, za kterého měl černý (<span class="highlight-name">Tomáš Fraňa</span>) kompenzaci, ale soupeř poté příliš ambiciózně a neuváženě „daroval" celou figuru – střelce na a6. Marek materiál beze strachu přijal, přešel do protiútoku a partii rychle a pěkně vyhrál. Stav <span class="highlight-score">2,5 : 1,5</span>.</p>
        <p>Na 2. šachovnici jsem nastoupil proti někdejšímu elitnímu mládežníkovi <span class="highlight-name">Marku Přiborskému</span>. Hrál se výměnný Caro–Kann a bílý pokračoval urychleným f4. To mi poskytlo poměrně snadnou, i když objektivně vyrovnanou pozici. Získal jsem velký časový náskok a dostal nabídku remízy. Chvíli jsem váhal, ale pozice na 6. a 7. šachovnici vypadaly pro nás nadějně. Po zvážení situace jsem remízu přijal, protože nás výrazně přiblížila k zápasové výhře – <span class="highlight-score">3 : 2</span>.</p>
        <p>Na 8. šachovnici měl <span class="highlight-name">Miloš Fila</span> proti <span class="highlight-name">Toljovi Falesovi</span> šanci na protihru, pokud by sebral pěšce na a2. Zalekl se však a soupeř ho postupně „umačkal". Stav <span class="highlight-score">3 : 3</span>.</p>
        <p><span class="highlight-name">Libor Titěra</span> sehrál černými v Blumenfeldově gambitu ukázkovou partii proti <span class="highlight-name">Romanu Žambochovi</span> a zcela ho přehrál. Kvůli nedostatku času ale promarnil několik cest k výhře a po 40. tahu partie skončila vyrovnaně – <span class="highlight-score">3,5 : 3,5</span>.</p>
        <p>Zápas se tedy snažil zlomit v náš prospěch <span class="highlight-name">Mirek Žídek</span>. Měl partii s <span class="highlight-name">Břéťou Tejským</span> dobře rozehranou, ale v časové tísni se začaly kupit chyby na obou stranách. Přesto si udržel nějakou výhodu, jenže materiál už byl velmi zredukovaný. Mirek bojoval dlouho, ale vítězství z toho bohužel nevytěžil.</p>
        <p>Zápas s Tanvaldem tak končí <span class="highlight-score">4 : 4</span>.</p>
    </div>
</div>

<!-- Report B Tým -->
<div class="collapsible-wrapper">
    <div class="collapsible-header" onclick="toggleSection('reportB', 'iconB')">
        <h3><i class="fa-solid fa-chess-pawn"></i> Report z utkání B týmu</h3>
        <i id="iconB" class="fa-solid fa-chevron-up"></i>
    </div>
    <div id="reportB" class="collapsible-content">
        <img src="https://i.ibb.co/wZ1wgcRT/IMG-3196.jpg" alt="Zápas s Deskem Liberec" style="width: 100%; border-radius: var(--border-radius); margin-bottom: 1rem;">
        <p>Béčko nastoupilo k zápasu s favorizovaným Deskem Liberec v téměř nejsilnější možné sestavě, ale ani to bohužel na body nestačilo. Utkání našeho béčka s béčkem českolipským skončilo porážkou <span class="highlight-score">3:5</span>. Někteří naši hráči si uhráli pěkné výsledky, ale jako tým jsme tentokrát k bodům měli daleko.</p>
        <p>Na osmé šachovnici jsme měli jako na jediné elově navrch, ale <span class="highlight-name">Alešovi Červeňovi</span> se partie nepovedla, a tak jsme brzy prohrávali <span class="highlight-score">0:1</span>. Na to ještě dokázal odpovědět <span class="highlight-name">Zdeněk Němec</span>, když na sedmičce srovnal na <span class="highlight-score">1:1</span>, jenže v dalších pěti minutách už to bylo <span class="highlight-score">1:3</span>, když se <span class="highlight-name">Vojta Holeš</span> zamotal bílými ve francouzské s <span class="highlight-name">p. Jínovou</span> a <span class="highlight-name">Luděk Cyhelský</span> podcenil nebezpečí subjektivně vyrovnané pozice.</p>
        <p>Ve čtvrté hodině hry přidali cenné remízy po kvalitních výkonech s <span class="highlight-name">p. Völflem</span>, respektive <span class="highlight-name">p. Halamou</span> <span class="highlight-name">Kosťa Tsantsala</span> s <span class="highlight-name">Kristiánem Kotenem</span> <span class="highlight-score">2:4</span>.</p>
        <p>Teprve pak jsem dohrál na čtyřce já, i když zdechlý proti <span class="highlight-name">Frantsevovi</span> jsem byl už dlouho. Paradoxně jsem se vzdal v momentě, kdy jsem krásným Vxg2 s patovým motivem mohl remízu přeci jen vybojovat. <span class="highlight-score">2:5</span>.</p>
        <p>Poctivý výkon na jedničce na závěr předvedl <span class="highlight-name">pan Vacek</span>, který po pěti hodinách korigoval na konečných <span class="highlight-score">3:5</span>.</p>
    </div>
</div>`,
                thumbnailUrl: 'https://i.ibb.co/twbZWXzm/IMG-3192.jpg',
                linkUrl: 'report_2kolo.html',
                gamesJson: JSON.stringify(games2kolo),
                teamsJson: JSON.stringify({ all: ['A tým', 'B tým'], selected: ['A tým', 'B tým'] }),
                galleryJson: JSON.stringify([
                    'https://i.ibb.co/twbZWXzm/IMG-3192.jpg',
                    'https://i.ibb.co/wZ1wgcRT/IMG-3196.jpg'
                ]),
                publishedDate: new Date('2025-12-03'),
                isPublished: true,
                authorId: admin.id
            },
            {
                title: '1. kolo - Derby Bižuterie A vs B',
                slug: '1-kolo-derby-bizuterie',
                category: 'Soutěže družstev',
                excerpt: 'Derby mezi týmy Bižuterie. Áčko zvítězilo 6,5:1,5.',
                content: `<div class="puzzle-section">
    <p style="font-size: 1.1rem; margin-bottom: 1rem;">
        🧩 <strong>Pozice z partie Šalanda – Žídek</strong><br>
        Bílý je na tahu a mohl rozhodnout partii ve svůj prospěch.<br>
        Najdete vítězný tah? ♟️
    </p>
    <img src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhU8z8yMLXbAZ_6tpOqOElzKBW5KyhvFynQP1n8BdLvv2yqLWF0FW4UwsFMQeKyEhHaaPUX9RsmGJtDFQ9uaeL34O69dy99inypBZncg_jgILJ_BHSn_cI902hOsoEQKyTwOfLwwUgKDskwjZ4ySuRS9rkSE5fnTEn0w9U9m92x-yjWvalAoWcebFNVCCPz/s320/board-2.jpeg" alt="Pozice z partie Šalanda – Žídek" style="max-width: 320px; display: block; margin: 1rem auto;">
</div>
<div class="card" style="margin: 2rem 0;">
    <div class="card-content">
        <p style="font-size: 1.1rem; line-height: 1.8;">
            Derby Bižuterie mělo tentokrát jasného favorita a Áčko to na úvod soutěže potvrdilo, i přesto že se partie často otáčeli vícekrát než jedou. <strong>Bižu A – Bižu B 6,5 : 1,5</strong> (9. 11. 2025).
        </p>
        <p style="font-size: 1.1rem; line-height: 1.8; margin-top: 1rem;">
            Body vítězů obstarali Antonín Duda, Vladimír Vltavský, Lukáš Sivák, Miroslav Žídek, Miloš Fila a František Mlot, půl bodu přidal Jonáš Chvátal. Za béčko se radovala jen Ema Brehmová na 8. šachovnici.
        </p>
    </div>
</div>`,
                thumbnailUrl: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhU8z8yMLXbAZ_6tpOqOElzKBW5KyhvFynQP1n8BdLvv2yqLWF0FW4UwsFMQeKyEhHaaPUX9RsmGJtDFQ9uaeL34O69dy99inypBZncg_jgILJ_BHSn_cI902hOsoEQKyTwOfLwwUgKDskwjZ4ySuRS9rkSE5fnTEn0w9U9m92x-yjWvalAoWcebFNVCCPz/s320/board-2.jpeg',
                linkUrl: 'report_1kolo.html',
                gamesJson: JSON.stringify(games1kolo),
                teamsJson: JSON.stringify({ all: ['A tým'], selected: ['A tým'] }),
                publishedDate: new Date('2025-11-09'),
                isPublished: true,
                authorId: admin.id
            },
            {
                title: 'Mistrovství Čech v Harrachově',
                slug: 'mistrovstvi-cech-harrachov',
                category: 'Mládež',
                excerpt: 'Úspěchy našich mladých šachistů na Mistrovství Čech.',
                content: `<p style="margin-bottom: 1.5rem;">V prosinci 2025 se naši mládežníci zúčastnili Mistrovství Čech v rapid šachu v Harrachově. Turnaj se konal v krásném prostředí Krkonoš a přilákal desítky nadějných šachistů z celé republiky.</p>
<p style="margin-bottom: 1.5rem;">Naši hráči předvedli vynikající výkony a reprezentovali oddíl se ctí. Atmosféra turnaje byla skvělá a všichni si odvezli cenné zkušenosti.</p>`,
                thumbnailUrl: 'https://blogger.googleusercontent.com/img/a/AVvXsEjJ8B0e9gRNW0Sp2GwMUI3AYxaBzSZE5d9lvjNq1CMHVmwN1aHlSQHcOTL5z-9wIBOoaRwBZimEtF3IlGh61mhFbUUkRMoESgB1eq5hSig9kmrmelvThdTWk1lN-mjmZABjlnu_ljZiDeRzXDD1JRgYDRScKjukllHF4BenjKldVLe6qolzZNWxUj2yWFfh',
                galleryJson: JSON.stringify([
                    'https://blogger.googleusercontent.com/img/a/AVvXsEjJ8B0e9gRNW0Sp2GwMUI3AYxaBzSZE5d9lvjNq1CMHVmwN1aHlSQHcOTL5z-9wIBOoaRwBZimEtF3IlGh61mhFbUUkRMoESgB1eq5hSig9kmrmelvThdTWk1lN-mjmZABjlnu_ljZiDeRzXDD1JRgYDRScKjukllHF4BenjKldVLe6qolzZNWxUj2yWFfh',
                    'https://blogger.googleusercontent.com/img/a/AVvXsEj6hZaHt57il2zLx53Ghi1HdethKcZMvEPeWsiCAv705hspIViBpNwr42h_9XMU2M_qqwPbm7k8U0sk0P7Z3FLUNZr4nvy11LsTkyYgBUSER2M7PVJJQUPpKs1Xt7lH1w4PldaAOesTwYuhfS604wdzu-fElXhoXjB1shW6CcK6I-FdzzeEQawLsw-tZiYN',
                    'https://blogger.googleusercontent.com/img/a/AVvXsEilHUjvMIQ6ncFfGSurDge1M8A4qceK2KvE9mA24en0J1NsOk95vL7f7CUG4m5GGh_NVhzq16ut9-qq6_hg1BUePZs1Cp0Dxbe7jhd6EMCxp1drqqD_1YylDacp-hqRpQPb_CRyT8-NVB2ooovrtc1nK_uqgG2P2qbQqVgdVQvp_oTSIMlprlOih5-SyHno',
                    'https://blogger.googleusercontent.com/img/a/AVvXsEi5N9PChSstZeutWot9LwVxNtAs5eSdbukW9_wEkX3D-vBAe-A0dYluneLmbCZwRSNIr3KsfQDP2C86n3nt2DmOTlvEMo3fUfMPQ1rq9-Pby9gJRT1Deq-7PySsSGye8zjxgyebWfWZMQZRTTTJCX2OzDB6jz4lhyBhFXiUTyCru3bjISaun5DdQ-5W_x4L'
                ]),
                publishedDate: new Date('2025-10-25'),
                isPublished: true,
                authorId: admin.id
            },
            {
                title: 'Velká cena Libereckého kraje',
                slug: 'velka-cena-libereckeho-kraje',
                category: 'Mládež',
                excerpt: 'Aleš Červeň a Roman Tsantsala zvítězili ve svých kategoriích na turnaji v ZŠ Liberecká.',
                content: `<p style="margin-bottom: 1rem; font-style: italic;">Jablonec nad Nisou – ZŠ Liberecká, sobota 27. září 2025</p>
<p style="margin-bottom: 1rem;">Osm desítek nadějných šachistů se o víkendu utkalo v prvním dílu seriálu Velké ceny Libereckého kraje v rapid šachu mládeže. Hrálo se ve čtyřech kategoriích tempem 15 minut + 5 sekund za tah, systémem 7, resp. 9 kol.</p>
<p style="margin-bottom: 1rem;">Turnaj do 10 let ovládl Ondřej Nožička (ŠK ZIKUDA Turnov), kategorii do 14 let jeho oddílový kolega Michal Král a do 18 let zvítězil turnovský Ondřej Svoboda. Elitní otevřený turnaj bez rozdílu věku vyhrál Jonáš Zeman (TJ Desko Liberec).</p>
<p style="margin-bottom: 1.5rem;">Dařilo se i domácím. Z hráčů TJ Bižuterie Jablonec n. N. nastoupilo přes dvacet účastníků; <strong>Aleš Červeň zvítězil ve věkové kategorii do 16 let</strong> a <strong>Roman Tsantsala v kategorii do 8 let</strong>. Romanovi mohla pomoci i „domácí půda", je totiž žákem ZŠ Liberecká.</p>

<h3 style="color: var(--primary-color); margin: 2rem 0 1rem;">Výsledky podle kategorií</h3>

<h4 style="margin-bottom: 0.5rem;">ELITE (každý s každým, 9 kol)</h4>
<ol style="padding-left: 1.5rem; margin-bottom: 1.5rem; color: var(--text-muted);">
    <li>Jonáš Zeman (TJ Desko Liberec) – 6,5 b.</li>
    <li>Ivan Bureha (TJ Lokomotiva Liberec) – 6 b.</li>
    <li>Vojta Holeš (TJ Desko Liberec) – 5,5 b.</li>
</ol>

<h4 style="margin-bottom: 0.5rem;">U16, U18 (každý s každým, 7 kol)</h4>
<ol style="padding-left: 1.5rem; margin-bottom: 1.5rem; color: var(--text-muted);">
    <li>Ondřej Svoboda (ŠK ZIKUDA Turnov) – 6,5 b.</li>
    <li>Valentina Mohylová (TJ Lokomotiva Liberec) – 5,5 b.</li>
    <li><strong>Aleš Červeň (TJ Bižuterie Jablonec n. N.) – 4,5 b.</strong></li>
</ol>

<h4 style="margin-bottom: 0.5rem;">U12, U14 (švýcarský systém, 7 kol)</h4>
<ol style="padding-left: 1.5rem; margin-bottom: 1.5rem; color: var(--text-muted);">
    <li>Michal Král (ŠK ZIKUDA Turnov) – 6,5 b.</li>
    <li>Jonáš Roubíček (ŠK ZIKUDA Turnov) – 6 b.</li>
    <li>Vojtěch Horáček (ŠK ZIKUDA Turnov) – 5,5 b.</li>
</ol>

<h4 style="margin-bottom: 0.5rem;">U08, U10 (švýcarský systém, 7 kol)</h4>
<ol style="padding-left: 1.5rem; margin-bottom: 1.5rem; color: var(--text-muted);">
    <li>Ondřej Nožička (ŠK ZIKUDA Turnov) – 7 b.</li>
    <li>David Krejčí (ŠK ZIKUDA Turnov) – 6 b.</li>
    <li><strong>Roman Tsantsala (TJ Bižuterie Jablonec n. N.) – 5,5 b.</strong></li>
</ol>`,
                thumbnailUrl: 'images/youth_tournament.png',
                publishedDate: new Date('2025-09-27'),
                isPublished: true,
                authorId: admin.id
            }
        ];

        for (const item of newsItems) {
            await prisma.news.upsert({
                where: { slug: item.slug },
                update: item,
                create: item
            });
        }

        await prisma.$disconnect();
        console.log('Database seeded successfully');
        return { success: true };
    } catch (error) {
        console.error('Seed error:', error);
        return { error: error.message };
    }
};

// --- Backup Endpoint ---
app.get('/api/admin/backup', authMiddleware, async (req, res) => {
    try {
        console.log('Starting database backup...');

        // Fetch all data from important tables
        const [
            users,
            news,
            matchReports,
            games,
            images,
            members,
            competitions,
            standings,
            blicakRegistrations
        ] = await Promise.all([
            prisma.user.findMany(),
            prisma.news.findMany(),
            prisma.matchReport.findMany(),
            prisma.game.findMany(),
            prisma.image.findMany(),
            prisma.member.findMany(),
            prisma.competition.findMany(),
            prisma.standing.findMany(),
            prisma.blicakRegistration.findMany()
        ]);

        const backupData = {
            metadata: {
                timestamp: new Date().toISOString(),
                version: '1.0'
            },
            data: {
                users,
                news,
                matchReports,
                games,
                images,
                members,
                competitions,
                standings,
                blicakRegistrations
            }
        };

        const fileName = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.json(backupData);

        console.log('Backup generated successfully');
    } catch (error) {
        console.error('Backup failed:', error);
        res.status(500).json({ error: 'Backup generation failed' });
    }
});

// Seed Endpoint (Protected)un once to populate database
app.post('/api/seed', async (req, res) => {
    const result = await seedDatabase();
    if (result.error) {
        res.status(500).json({ error: 'Seed failed', details: result.error });
    } else {
        res.json({ success: true, message: 'Database seeded successfully!' });
    }
});

// Serve index.html for any other route (SPA fallback, though mostly static here)
app.get('*', (req, res) => {
    // Exclude API routes from fallback to avoid confusion
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Seed Competitions Function
const seedCompetitions = async () => {
    try {
        console.log('Seeding/Updating competitions...');
        const initialCompetitions = [
            {
                id: "3255",
                name: "1. liga mládeže A",
                type: "chess-results",
                url: "https://s3.chess-results.com/tnr1243811.aspx?lan=5&art=46&SNode=S0",
                category: "youth"
            },
            {
                id: "3363",
                name: "Krajský přebor mládeže",
                type: "chess-cz",
                chessczUrl: "https://www.chess.cz/soutez/3363/",
                url: "",
                category: "youth",
                active: false // Inactive by default until URL provided
            },
            {
                id: "ks-st-zaku",
                name: "Krajská soutěž st. žáků", // Renamed
                type: "chess-results",
                url: "https://s1.chess-results.com/tnr1310849.aspx?lan=5&art=0&SNode=S0",
                category: "youth",
                active: true
            },
            {
                id: "ks-vychod",
                name: "Krajská soutěž východ",
                type: "chess-results",
                url: "https://s2.chess-results.com/tnr1278502.aspx?lan=5&art=46&SNode=S0",
                category: "teams",
                active: true
            },
            {
                id: "kp-liberec",
                name: "Krajský přebor",
                type: "chess-results",
                url: "https://chess-results.com/tnr1276470.aspx?lan=5&art=46",
                category: "teams",
                active: true
            }
        ];

        for (const comp of initialCompetitions) {
            await prisma.competition.upsert({
                where: { id: comp.id },
                update: {
                    name: comp.name,
                    url: comp.url,
                    chessczUrl: comp.chessczUrl || null,
                    type: comp.type,
                    category: comp.category,
                    // Only update active if specific logic requires, or just keep DB state.
                    // But for renaming/seeding new defaults, we might want to ensure default state.
                    // However, we shouldn't overwrite user's manual "active" toggle on restart unless it's a structural change.
                    // Let's only set 'active' on create, or if we want to enforce it for the new comp.
                },
                create: {
                    ...comp,
                    active: comp.active !== undefined ? comp.active : true
                }
            });
        }
        console.log('Competitions seeded/verified.');
    } catch (e) {
        console.error('Error seeding competitions:', e);
    }
};

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV}`);

    // Attempt to seed competitions on startup
    await seedCompetitions();

    // Auto-refresh standings data on each deploy/restart
    console.log('🔄 Auto-refreshing standings data...');
    try {
        await updateStandings();
        console.log('✅ Standings data initialization complete');
    } catch (error) {
        console.error('Startup standings update failed:', error.message);
    }
});
