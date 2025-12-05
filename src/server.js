import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.js';
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

const app = express();
const PORT = process.env.PORT || 3001;

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
['css', 'js', 'images', 'data'].forEach(dir => {
    app.use(`/${dir}`, express.static(path.join(__dirname, `../${dir}`)));
});

// Serve HTML files from root
const allowedHtmlFiles = [
    'index.html', 'about.html', 'teams.html', 'club-tournaments.html',
    'youth.html', 'gallery.html', 'admin.html', 'article.html',
    'members.html'
];

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

// Standings scraper - fetches latest standings from chess.cz and saves to file
app.post('/api/standings/update', async (req, res) => {
    try {
        const fs = await import('fs/promises');

        // Competition IDs to scrape
        const competitions = [
            { id: '3255', name: '1. liga mládeže A', chessczUrl: 'https://www.chess.cz/soutez/3255/' },
            { id: '3363', name: 'Krajský přebor st. žáků', chessczUrl: 'https://www.chess.cz/soutez/3363/' }
        ];

        const results = [];

        for (const comp of competitions) {
            try {
                const response = await fetch(`https://www.chess.cz/soutez/vysledky/${comp.id}/`);
                const html = await response.text();

                // Parse standings from HTML (simple regex extraction)
                const standings = [];

                // Match table rows with standings data
                // Pattern: looks for team links and extracts ranking info
                const teamPattern = /<a[^>]*href="[^"]*druzstvo[^"]*"[^>]*>([^<]+)<\/a>/gi;
                const matches = [...html.matchAll(teamPattern)];

                // Get unique teams (first occurrence usually is in standings order)
                const seenTeams = new Set();
                let rank = 1;

                for (const match of matches) {
                    const teamName = match[1].trim();
                    if (!seenTeams.has(teamName) && rank <= 12) {
                        seenTeams.add(teamName);
                        standings.push({
                            rank,
                            team: teamName,
                            isBizuterie: teamName.toLowerCase().includes('bižuterie')
                        });
                        rank++;
                    }
                }

                results.push({
                    competitionId: comp.id,
                    name: comp.name,
                    chessczUrl: comp.chessczUrl,
                    standings: standings.slice(0, 6), // Top 6 teams
                    updatedAt: new Date().toISOString()
                });
            } catch (err) {
                console.error(`Error fetching ${comp.name}:`, err.message);
                results.push({
                    competitionId: comp.id,
                    name: comp.name,
                    chessczUrl: comp.chessczUrl,
                    error: err.message,
                    standings: []
                });
            }
        }

        // Save to JSON file
        const standingsData = {
            standings: results,
            lastUpdated: new Date().toISOString()
        };

        const dataPath = path.join(__dirname, '../data');
        try {
            await fs.mkdir(dataPath, { recursive: true });
        } catch (e) { }

        await fs.writeFile(
            path.join(dataPath, 'standings.json'),
            JSON.stringify(standingsData, null, 2)
        );

        res.json({ success: true, ...standingsData });
    } catch (error) {
        console.error('Standings update error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get cached standings from file
app.get('/api/standings', async (req, res) => {
    try {
        const fs = await import('fs/promises');
        const dataPath = path.join(__dirname, '../data/standings.json');
        const data = await fs.readFile(dataPath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (err) {
        // Return empty if file doesn't exist
        res.json({ standings: [], lastUpdated: null });
    }
});

// Seed Function
const seedDatabase = async () => {
    try {
        const { PrismaClient } = await import('@prisma/client');
        const bcrypt = await import('bcrypt');
        const prisma = new PrismaClient();

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
                        <p>Na 4. šachovnici sehráli <span style="font-weight:700; color:var(--primary-color);">Tomáš Duran</span> s <span style="font-weight:700; color:var(--primary-color);">Vláďou Jedličkou</span> velmi plochou variantu Philidorovy obrany. Ani jeden nebyl příliš bojovně naladěn, takže zapisujeme první remízu: <strong>0,5 : 0,5</strong>.</p>
                        <p>Na 3. šachovnici skončil rychlou remízou i duel <span style="font-weight:700; color:var(--primary-color);">Vládi Vltavského</span> s <span style="font-weight:700; color:var(--primary-color);">Ondrou Pražákem</span>. Stav tedy <strong>1 : 1</strong>.</p>
                        <p><span style="font-weight:700; color:var(--primary-color);">Lukáš Sivák</span> na 5. šachovnici získal s <span style="font-weight:700; color:var(--primary-color);">Zdeňkem Jouklem</span> slibnou pozici, ale nakonec mohl být rád za remízu – <strong>1,5 : 1,5</strong>.</p>
                        <p>Na první desce sehrál <span style="font-weight:700; color:var(--primary-color);">Marek Sýkora</span> riskantní partii. Soupeř (<span style="font-weight:700; color:var(--primary-color);">Tomáš Fraňa</span>) chyboval a daroval figuru. Marek materiál beze strachu přijal a partii vyhrál. Stav <strong>2,5 : 1,5</strong>.</p>
                        <p>Na 2. šachovnici jsem nastoupil proti <span style="font-weight:700; color:var(--primary-color);">Marku Přiborskému</span>. Po zvážení situace jsem remízu přijal, protože nás výrazně přiblížila k zápasové výhře – <strong>3 : 2</strong>.</p>
                        <p>Na 8. šachovnici měl <span style="font-weight:700; color:var(--primary-color);">Miloš Fila</span> proti <span style="font-weight:700; color:var(--primary-color);">Toljovi Falesovi</span> šanci, ale zalekl se a prohrál. Stav <strong>3 : 3</strong>.</p>
                        <p><span style="font-weight:700; color:var(--primary-color);">Libor Titěra</span> sehrál ukázkovou partii, ale v časové tísni remizoval – <strong>3,5 : 3,5</strong>.</p>
                        <p>Zápas s Tanvaldem tak končí <strong>4 : 4</strong>.</p>
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
                        <p>Béčko nastoupilo k zápasu s favorizovaným Deskem Liberec v téměř nejsilnější možné sestavě, ale ani to bohužel nestačilo. Konečný výsledek <strong>3:5</strong>.</p>
                        <p>Na osmé šachovnici se <span style="font-weight:700; color:var(--primary-color);">Alešovi Červeňovi</span> partie nepovedla (0:1). Na to odpověděl <span style="font-weight:700; color:var(--primary-color);">Zdeněk Němec</span> výhrou (1:1).</p>
                        <p>Bohužel <span style="font-weight:700; color:var(--primary-color);">Vojta Holeš</span> i <span style="font-weight:700; color:var(--primary-color);">Luděk Cyhelský</span> své partie prohráli – <strong>1:3</strong>.</p>
                        <p>Remízy přidali <span style="font-weight:700; color:var(--primary-color);">Kosťa Tsantsala</span> a <span style="font-weight:700; color:var(--primary-color);">Kristián Koten</span> – <strong>2:4</strong>.</p>
                        <p>Poctivý výkon na jedničce na závěr předvedl <span style="font-weight:700; color:var(--primary-color);">pan Vacek</span>, který korigoval na konečných <strong>3:5</strong>.</p>
                    </div>
                </div>`,
                thumbnailUrl: 'https://i.ibb.co/twbZWXzm/IMG-3192.jpg',
                linkUrl: 'report_2kolo.html',
                gamesJson: JSON.stringify(games2kolo),
                teamsJson: JSON.stringify({ all: ['A tým', 'B tým'], selected: ['A tým', 'B tým'] }),
                galleryJson: JSON.stringify([
                    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhU8z8yMLXbAZ_6tpOqOElzKBW5KyhvFynQP1n8BdLvv2yqLWF0FW4UwsFMQeKyEhHaaPUX9RsmGJtDFQ9uaeL34O69dy99inypBZncg_jgILJ_BHSn_cI902hOsoEQKyTwOfLwwUgKDskwjZ4ySuRS9rkSE5fnTEn0w9U9m92x-yjWvalAoWcebFNVCCPz/s1600/IMG-3192.jpg',
                    'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj7o1c8q8e6yXj9y6b4z3g2f1d5e6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v/s1600/IMG-3196.jpg'
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
                thumbnailUrl: 'https://blogger.googleusercontent.com/img/a/AVvXsEjJ8B0e9gRNW0Sp2GwMUI3AYxaBzSZE5d9lvjNq1CMHVmwN1aHlSQHcOTL5z-9wIBOoaRwBZimEtF3IlGh61mhFbUUkRMoESgB1eq5hSig9kmrmelvThdTWk1lN-mjmZABjlnu_ljZiDeRzXDD1JRgYDRScKjukllHF4BenjKldVLe6qolzZNWvUj2yWFfh',
                linkUrl: 'youth.html',
                publishedDate: new Date('2025-10-25'),
                isPublished: true,
                authorId: admin.id
            },
            {
                title: 'Velká cena Libereckého kraje',
                slug: 'velka-cena-libereckeho-kraje',
                category: 'Mládež',
                excerpt: 'Aleš Červeň a Roman Tsantsala zvítězili ve svých kategoriích na turnaji v ZŠ Liberecká.',
                content: '<p>Aleš Červeň a Roman Tsantsala zvítězili ve svých kategoriích na turnaji v ZŠ Liberecká.</p>',
                thumbnailUrl: 'images/youth_tournament.png',
                linkUrl: 'youth.html',
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

// Seed endpoint - run once to populate database
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
app.listen(PORT, async () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV}`);

    // Auto-seed on startup to ensure data freshness on deployment
    console.log('🌱 starting auto-seed...');
    await seedDatabase();
});
