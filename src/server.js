// Main server file
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
import { requireAdmin, requireSuperadmin } from './middleware/rbac.js';
import newsRoutes from './routes/news.js';
import reportsRoutes from './routes/reports.js';
import imagesRoutes from './routes/images.js';
import userRoutes from './routes/users.js';
import memberRoutes from './routes/members.js';
import messageRoutes from './routes/messages.js';
import racerRoutes from './routes/racer.js';
import gamesRoutes from './routes/games.js';
import apiGamesRoutes from './routes/api-games.js';
import scrapingRoutes from './routes/scraping.js';
import commentsRoutes from './routes/comments.js';
import eventsRoutes from './routes/events.js';
import chessRoutes from './routes/chessRoutes.js';
import aiRoutes from './routes/ai.js';
import oauthRoutes from './routes/oauth.js';
import passport from './config/passport.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for Railway/Heroku (required for express-rate-limit behind reverse proxy)
app.set('trust proxy', 1);

// Redirect non-www to www (production only)
app.use((req, res, next) => {
    const host = req.headers.host;
    // Only redirect in production and if host is non-www
    if (host && host === 'sachyjablonec.cz') {
        return res.redirect(301, `https://www.sachyjablonec.cz${req.url}`);
    }
    next();
});

// Basic Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check (for Railway zero-downtime and Cloudflare Worker)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// Maintenance Mode Middleware
app.use(async (req, res, next) => {
    // 1. Health check - always allow
    if (req.path === '/health') return next();

    // 2. Static assets - always allow
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        return next();
    }

    // 3. Admin login/settings needed to disable maintenance
    // Allow login and settings endpoints so admin can turn it off!
    if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/settings')) {
        return next();
    }
    // Also allow admin.html main page to load so they can access the panel
    if (req.path === '/admin.html') return next();


    let maintenance = process.env.MAINTENANCE_MODE === 'true';

    // Check DB
    try {
        const setting = await prisma.systemSetting.findUnique({ where: { key: 'maintenance_mode' } });
        if (setting && setting.value === 'true') maintenance = true;
        if (setting && setting.value === 'false') maintenance = false; // DB overrides ENV? Or OR?
        // Let's say DB overrides if present.
    } catch (e) {
        console.error('Failed to check maintenance settings:', e);
        // Fallback to env if DB fails
    }

    if (maintenance) {
        if (req.path.startsWith('/api')) {
            return res.status(503).json({ error: 'System is under maintenance. Please try again later.' });
        }
        return res.status(503).sendFile(path.join(__dirname, '../public/maintenance.html'));
    }
    next();
});

// Static Files Serving
// Static Files Serving with Cache Policy
const staticOptions = {
    maxAge: 0, // Disable cache for development/debugging
    etag: true
};

app.use(express.static(path.join(__dirname, '../public'), staticOptions));
app.use('/js', express.static(path.join(__dirname, '../js'), staticOptions));
app.use('/css', express.static(path.join(__dirname, '../css'), staticOptions));
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), staticOptions));
app.use('/images', express.static(path.join(__dirname, '../images'), staticOptions));

// SEO Files - Explicit rules to ensure they are served correctly
app.get('/robots.txt', (req, res) => res.sendFile(path.join(__dirname, '../robots.txt')));
app.get('/sitemap.xml', (req, res) => res.sendFile(path.join(__dirname, '../sitemap.xml')));

// Serve specific HTML pages (since they are in root)
// Serve specific HTML pages (Clean URLs support)
// Generate a unique version ID at server start (e.g. timestamp)
const APP_VERSION = process.env.RAILWAY_GIT_COMMIT_SHA
    ? process.env.RAILWAY_GIT_COMMIT_SHA.substring(0, 7) // Use commit hash if available
    : Date.now().toString(); // Fallback to timestamp

console.log(`🚀 Starting server with APP_VERSION: ${APP_VERSION}`);

// Enhanced servePage with Automatic Cache Busting
const servePage = (page) => async (req, res) => {
    try {
        const filePath = path.join(__dirname, `../${page}`);
        let html = await fs.readFile(filePath, 'utf-8');

        // Inject APP_VERSION to window for client-side scripts
        const versionScript = `<script>window.APP_VERSION = '${APP_VERSION}';</script>\n`;
        html = html.replace('<head>', '<head>\n' + versionScript);

        // Regex to find local JS and CSS imports
        // Matches src="..." or href="..." where the value ends in .js or .css (ignoring external links starting with http)
        // Also captures existing query params if any
        // Group 1: src=" or href=" without the closing quote
        // Group 2: The URL path
        // Group 3: Extension
        html = html.replace(/(src|href)="((?!http)[^"]+\.(css|js))(\?v=[^"]*)?"/g, (match, attrName, url) => {
            // Reconstruct with new version
            return `${attrName}="${url}?v=${APP_VERSION}"`;
        });

        res.send(html);
    } catch (err) {
        console.error(`Error serving page ${page}:`, err);
        res.status(500).send('Internal Server Error');
    }
};

app.get('/admin', servePage('admin.html'));
app.get('/admin.html', servePage('admin.html'));

// Explicitly serve root to ensure version injection
app.get('/', servePage('index.html'));
app.get('/index.html', servePage('index.html'));

app.get('/gallery', servePage('gallery.html'));
app.get('/gallery.html', servePage('gallery.html'));

app.get('/youth', servePage('youth.html'));
app.get('/youth.html', servePage('youth.html'));

app.get('/teams', servePage('teams.html'));
app.get('/teams.html', servePage('teams.html'));

app.get('/calendar', servePage('calendar.html'));
app.get('/calendar.html', servePage('calendar.html'));

app.get('/tournaments', servePage('tournaments.html'));
app.get('/tournaments.html', servePage('tournaments.html'));

app.get('/about', servePage('about.html'));
app.get('/about.html', servePage('about.html'));

app.get('/members', servePage('members.html'));
app.get('/members.html', servePage('members.html'));

app.get('/account', servePage('account.html'));
app.get('/account.html', servePage('account.html'));

app.get('/blicak', servePage('blicak.html'));
app.get('/blicak.html', servePage('blicak.html'));

app.get('/bleskovy_report', (req, res) => {
    res.redirect(301, '/article.html?id=54');
});

app.get('/puzzle-racer', servePage('puzzle-racer.html'));
app.get('/puzzle-racer.html', servePage('puzzle-racer.html'));

app.get('/game-recorder', servePage('game-recorder.html'));
app.get('/game-recorder.html', servePage('game-recorder.html'));

app.get('/club-tournaments', servePage('club-tournaments.html'));
app.get('/club-tournaments.html', servePage('club-tournaments.html'));

app.get('/partie', servePage('partie.html'));
app.get('/partie.html', servePage('partie.html'));

app.get('/games', servePage('games.html'));
app.get('/games.html', servePage('games.html'));

app.get('/chess-database', servePage('chess-database.html'));
app.get('/chess-database.html', servePage('chess-database.html'));

app.get('/article', servePage('article.html')); // Dynamic article page often uses query params
app.get('/article.html', servePage('article.html'));

app.get('/index', servePage('index.html'));
app.get('/index.html', servePage('index.html'));

// Initialize Passport for OAuth
app.use(passport.initialize());

// API Routes - MUST be before static catch-all
app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes);  // OAuth routes (Google login)
app.use('/api/news', newsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/images', imagesRoutes);
app.use('/api/users', userRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/racer', racerRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/viewer-games', apiGamesRoutes);
app.use('/api/scraping', scrapingRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/chess', chessRoutes);
app.use('/api/ai', aiRoutes);

// Import helpers from utils
import { clean, isElo, simplify, isMatch, fetchWithHeaders } from './utils/helpers.js';

// Scraping functions extracted to services/scrapingService.js
import { scrapeMatchDetails, scrapeTeamRoster, scrapeCompetitionMatches } from './services/scrapingService.js';
import { updateStandings } from "./services/standingsService.js";
import { seedDatabase, seedCompetitions } from "./utils/seed.js";


// Middleware
app.use(cors({
    origin: true, // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Club-Password']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve specific static directories
// (Redundant block removed - already handled at top of file)
// ['css', 'js', 'images', 'data', 'components'].forEach(dir => {
//    app.use(`/${dir}`, express.static(path.join(__dirname, `../${dir}`), staticOptions));
// });

// Serve HTML files from root
const allowedHtmlFiles = [
    'index.html', 'about.html', 'teams.html', 'club-tournaments.html',
    'youth.html', 'gallery.html', 'admin.html', 'article.html',
    'members.html', 'calendar.html', 'blicak.html', 'partie.html', 'games.html',
    'tournaments.html', 'chess-database.html'
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

// Clean URLs middleware - serve HTML files without .html extension
// e.g. /blicak -> blicak.html, /teams -> teams.html
app.use((req, res, next) => {
    // skip api routes
    if (req.path.startsWith('/api')) return next();

    // Skip if path has a file extension
    if (req.path.includes('.')) return next();

    // Skip root path
    if (req.path === '/') return next();

    // Clean the path and check if corresponding .html file exists
    const cleanPath = req.path.replace(/^\//, ''); // Remove leading slash
    const htmlFile = `${cleanPath}.html`;

    // Check if this is an allowed HTML file
    if (allowedHtmlFiles.includes(htmlFile)) {
        return res.sendFile(path.join(__dirname, `../${htmlFile}`));
    }

    next();
});

// Middleware to serve static files from root safely
app.use((req, res, next) => {
    // skip api routes
    if (req.path.startsWith('/api')) return next();

    // clean path
    const reqPath = req.path === '/' ? '/index.html' : req.path;

    // check if it's an allowed html file
    const filename = reqPath.split('/').pop();
    if (allowedHtmlFiles.includes(filename) && reqPath.split('/').length === 2) {
        return res.sendFile(path.join(__dirname, `../${filename}`));
    }

    next();
});

// Moved API Routes higher up

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// --- Dashboard Stats API ---
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
    try {
        const [newsCount, commentsCount, usersCount, gamesCount, eventsCount, recentComments, recentNews] = await Promise.all([
            prisma.news.count(),
            prisma.comment.count(),
            prisma.user.count(),
            prisma.game.count(),
            prisma.event.count(),
            prisma.comment.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    author: { select: { username: true, realName: true } },
                    news: { select: { title: true, id: true } }
                }
            }),
            prisma.news.findMany({
                take: 3,
                orderBy: { publishedDate: 'desc' },
                select: { id: true, title: true, publishedDate: true, category: true }
            })
        ]);

        res.json({
            stats: {
                news: newsCount,
                comments: commentsCount,
                users: usersCount,
                games: gamesCount,
                events: eventsCount
            },
            recentActivity: recentComments.map(c => ({
                type: 'comment',
                id: c.id,
                text: c.content.substring(0, 100) + (c.content.length > 100 ? '...' : ''),
                author: c.author?.realName || c.author?.username || 'Anonym',
                newsTitle: c.news?.title || 'Smazaný článek',
                newsId: c.news?.id,
                createdAt: c.createdAt
            })),
            recentNews: recentNews
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to load dashboard stats' });
    }
});

// --- System Settings API ---
app.get('/api/settings', authMiddleware, async (req, res) => {
    try {
        const settings = await prisma.systemSetting.findMany();
        const settingsMap = {};
        settings.forEach(s => settingsMap[s.key] = s.value);
        res.json(settingsMap);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/settings', authMiddleware, async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key) return res.status(400).json({ error: 'Key required' });

        const setting = await prisma.systemSetting.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) }
        });
        res.json(setting);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});




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
            },
            orderBy: [
                { category: 'asc' },
                { sortOrder: 'asc' },
                { name: 'asc' }
            ]
        });

        // Transform to expected format: { standings: [ { competitionId, name, standings: [...] } ] }
        // The frontend expects a specific structure: an array of competition objects with a `standings` array inside.
        // Or rather, the previous JSON structure was `{ standings: [...], lastUpdated: ... }`.

        const validCompetitions = competitions.map(comp => ({
            competitionId: comp.id,
            name: comp.name,
            url: comp.url,
            category: comp.category,
            sortOrder: comp.sortOrder,
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

// Look up team SNR by team name within a competition
// Used for fetching opponent rosters dynamically
app.get('/api/standings/team-snr', async (req, res) => {
    const { competitionId, teamName } = req.query;
    if (!competitionId || !teamName) {
        return res.status(400).json({ error: 'Missing parameters: competitionId and teamName required' });
    }

    try {
        // Get competition with standings
        const competition = await prisma.competition.findUnique({
            where: { id: competitionId },
            include: { standings: true }
        });

        if (!competition) {
            return res.status(404).json({ error: 'Competition not found' });
        }

        // Find team by name (fuzzy match)
        const normalizedSearch = teamName.toLowerCase().replace(/\s+/g, '').replace(/["']/g, '');
        const team = competition.standings.find(s => {
            const normalizedTeam = s.team.toLowerCase().replace(/\s+/g, '').replace(/["']/g, '');
            return normalizedTeam.includes(normalizedSearch) || normalizedSearch.includes(normalizedTeam);
        });

        if (!team) {
            // Fallback: try exact substring match
            const exactTeam = competition.standings.find(s =>
                s.team.toLowerCase().includes(teamName.toLowerCase()) ||
                teamName.toLowerCase().includes(s.team.toLowerCase())
            );
            if (!exactTeam) {
                return res.status(404).json({ error: 'Team not found in standings' });
            }
            return res.json({ snr: exactTeam.rank, url: competition.url, team: exactTeam.team });
        }

        // SNR is typically the rank/position in standings for chess-results
        res.json({ snr: team.rank, url: competition.url, team: team.team });
    } catch (e) {
        console.error('Team SNR lookup error:', e);
        res.status(500).json({ error: 'Failed to look up team' });
    }
});


// --- Backup Endpoint ---
app.get('/api/admin/backup', authMiddleware, requireSuperadmin, async (req, res) => {
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

// Manual Migration Endpoint (Protected)
app.post('/api/admin/migrate', authMiddleware, requireSuperadmin, async (req, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Unauthorized' });
    try {
        const { exec } = await import('child_process');
        exec('npx prisma db push', (error, stdout, stderr) => {
            if (error) {
                console.error(`Migration error: ${error.message}`);
                return res.status(500).json({ error: error.message, details: stderr });
            }
            console.log(`Migration stdout: ${stdout}`);
            res.json({ success: true, message: 'Database migration completed', output: stdout });
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
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


// Start server

// --- Graceful Shutdown ---
const gracefulShutdown = async (signal) => {
    console.log(`[${signal}] Received signal to terminate: starting graceful shutdown`);

    // 1. Close HTTP Server
    if (server) {
        server.close(() => {
            console.log('HTTP server closed');
        });
    }

    // 2. Disconnect Database
    try {
        await prisma.$disconnect();
        console.log('Database disconnected');
    } catch (e) {
        console.error('Error disconnecting database:', e);
    }

    console.log('Graceful shutdown completed. Exiting.');
    process.exit(0);
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start Server
const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV}`);

    // Initial Seeding logic
    await seedCompetitions();

    // Initial Standings Update
    console.log('🔄 Auto-refreshing standings data...');
    await updateStandings();
    console.log('✅ Standings data initialization complete');
});
