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

        // Competition IDs to scrape (main page has the standings table)
        const competitions = [
            { id: '3255', name: '1. liga mládeže A', chessczUrl: 'https://www.chess.cz/soutez/3255/' },
            { id: '3363', name: 'Krajský přebor st. žáků', chessczUrl: 'https://www.chess.cz/soutez/3363/' }
        ];

        const results = [];

        for (const comp of competitions) {
            try {
                // Fetch from main competition page which has the standings table
                const response = await fetch(`https://www.chess.cz/soutez/${comp.id}/`);
                const html = await response.text();

                const standings = [];

                // Parse standings table - capture rank, team, and points
                // Structure: <tr><td>rank</td><td><a>team</a></td>...<td class="..."><b>points</b></td>
                const tableRowPattern = /<tr>\s*<td>(\d+)<\/td>\s*<td>\s*<a[^>]*href="[^"]*druzstvo[^"]*"[^>]*>([^<]+)<\/a><\/td>(?:<td[^>]*>[^<]*<\/td>)*<td[^>]*>\s*<b>(\d+)<\/b>/gi;

                let match;
                while ((match = tableRowPattern.exec(html)) !== null && standings.length < 12) {
                    const rank = parseInt(match[1]);
                    const teamName = match[2].trim();
                    const points = parseInt(match[3]);

                    if (rank > 0 && rank <= 20 && teamName) {
                        standings.push({
                            rank,
                            team: teamName,
                            points,
                            isBizuterie: teamName.toLowerCase().includes('bižuterie')
                        });
                    }
                }

                // Sort by rank and take top 8
                standings.sort((a, b) => a.rank - b.rank);

                results.push({
                    competitionId: comp.id,
                    name: comp.name,
                    chessczUrl: comp.chessczUrl,
                    standings: standings.slice(0, 8),
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
});
