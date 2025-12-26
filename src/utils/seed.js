import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create admin user
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);

    const admin = await prisma.user.upsert({
        where: { username: process.env.ADMIN_USERNAME || 'admin' },
        update: {},
        create: {
            username: process.env.ADMIN_USERNAME || 'admin',
            email: process.env.ADMIN_EMAIL || 'admin@sachyjablonec.cz',
            passwordHash: hashedPassword,
            role: 'superadmin'
        }
    });

    console.log('✅ Admin user created (Role: superadmin):', admin.username);

    // Create other admins
    const commonPasswordHash = await bcrypt.hash('sachy2025', 10);

    const filip = await prisma.user.upsert({
        where: { username: 'filip' },
        update: {},
        create: {
            username: 'filip',
            email: 'filip@sachyjablonec.cz',
            passwordHash: commonPasswordHash,
            role: 'admin'
        }
    });
    console.log('✅ Admin user created:', filip.username);

    const lukas = await prisma.user.upsert({
        where: { username: 'lukas' },
        update: {},
        create: {
            username: 'lukas',
            email: 'lukas@sachyjablonec.cz',
            passwordHash: commonPasswordHash,
            role: 'admin'
        }
    });
    console.log('✅ Admin user created:', lukas.username);

    // Games for 1. kolo - Derby Bižuterie (8 games, 1 team)
    const games1kolo = [
        { title: "1. Duda - Vacek", gameId: "14096201", team: "A tým", src: "https://www.chess.com/emboard?id=14096201" },
        { title: "2. Völfl - Vltavský", gameId: "14102243", team: "A tým", src: "https://www.chess.com/emboard?id=14102243" },
        { title: "3. Chvátal - Zadražil", gameId: "14096241", team: "A tým", src: "https://www.chess.com/emboard?id=14096241" },
        { title: "4. Šalanda - Žídek", gameId: "14102245", team: "A tým", src: "https://www.chess.com/emboard?id=14102245" },
        { title: "5. Sivák - Tsantsala", gameId: "14102271", team: "A tým", src: "https://www.chess.com/emboard?id=14102271" },
        { title: "6. Koten - Fila", gameId: "14096321", team: "A tým", src: "https://www.chess.com/emboard?id=14096321" },
        { title: "7. Mlot - Cyhelský", gameId: "14096309", team: "A tým", src: "https://www.chess.com/emboard?id=14096309" },
        { title: "8. Brehmová - Vacková", gameId: "14096329", team: "A tým", src: "https://www.chess.com/emboard?id=14096329" }
    ];

    // Games for 2. kolo - Krajský přebor (16 games, 2 teams)
    const games2kolo = [
        // A tým vs Tanvald
        { title: "1. Sýkora - Fraňa", gameId: "14190545", team: "A tým", src: "https://www.chess.com/emboard?id=14190545" },
        { title: "2. Přiborský - Duda", gameId: "14190547", team: "A tým", src: "https://www.chess.com/emboard?id=14190547" },
        { title: "3. Vltavský - Pražák", gameId: "14190553", team: "A tým", src: "https://www.chess.com/emboard?id=14190553" },
        { title: "4. Jedlička - Durán", gameId: "14190555", team: "A tým", src: "https://www.chess.com/emboard?id=14190555" },
        { title: "5. Sivák - Joukl", gameId: "14190557", team: "A tým", src: "https://www.chess.com/emboard?id=14190557" },
        { title: "6. Žamboch - Titěra", gameId: "14190559", team: "A tým", src: "https://www.chess.com/emboard?id=14190559" },
        { title: "7. Žídek - Tejnský", gameId: "14190561", team: "A tým", src: "https://www.chess.com/emboard?id=14190561" },
        { title: "8. Faleš - Fila", gameId: "14190565", team: "A tým", src: "https://www.chess.com/emboard?id=14190565" },
        // B tým vs Desko Liberec
        { title: "1. Vacek - Jina", gameId: "14190569", team: "B tým", src: "https://www.chess.com/emboard?id=14190569" },
        { title: "2. Völfl - Tsantsala", gameId: "14190571", team: "B tým", src: "https://www.chess.com/emboard?id=14190571" },
        { title: "3. Holeč - Jínová", gameId: "14190575", team: "B tým", src: "https://www.chess.com/emboard?id=14190575" },
        { title: "4. Frantsev - Zadražil", gameId: "14190577", team: "B tým", src: "https://www.chess.com/emboard?id=14190577" },
        { title: "5. Koten - Halama", gameId: "14190579", team: "B tým", src: "https://www.chess.com/emboard?id=14190579" },
        { title: "6. Sichrovský - Cyhelský", gameId: "14190581", team: "B tým", src: "https://www.chess.com/emboard?id=14190581" },
        { title: "7. Němec - Drvota", gameId: "14190585", team: "B tým", src: "https://www.chess.com/emboard?id=14190585" },
        { title: "8. Jína - Červen", gameId: "14190589", team: "B tým", src: "https://www.chess.com/emboard?id=14190589" }
    ];

    // Seed original news items with games
    const newsItems = [
        {
            title: '2. kolo Krajský přebor - Report',
            slug: '2-kolo-krajsky-prebor-report',
            category: 'Soutěže družstev',
            excerpt: 'Report z utkání A a B týmu v 2. kole Krajského přeboru. A tým remizoval 4:4 s Tanvaldem, B tým prohrál 3:5 s Deskem Liberec.',
            content: '<p>Report z utkání A a B týmu v 2. kole Krajského přeboru.</p><p>A tým remizoval 4:4 s Tanvaldem, B tým prohrál 3:5 s Deskem Liberec.</p>',
            thumbnailUrl: 'https://i.ibb.co/twbZWXzm/IMG-3192.jpg',
            gamesJson: JSON.stringify(games2kolo),
            teamsJson: JSON.stringify({ all: ['A tým', 'B tým'], selected: ['A tým', 'B tým'] }),
            publishedDate: new Date('2025-12-03'),
            isPublished: true,
            authorId: admin.id
        },
        {
            title: '1. kolo - Derby Bižuterie A vs B',
            slug: '1-kolo-derby-bizuterie',
            category: 'Soutěže družstev',
            excerpt: 'Derby mezi týmy Bižuterie. Áčko zvítězilo 6,5:1,5 v prvním kole soutěže. Najdete vítězný tah z partie Šalanda - Žídek?',
            content: '<p>Derby mezi týmy Bižuterie. Áčko zvítězilo 6,5:1,5 v prvním kole soutěže.</p>',
            thumbnailUrl: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhU8z8yMLXbAZ_6tpOqOElzKBW5KyhvFynQP1n8BdLvv2yqLWF0FW4UwsFMQeKyEhHaaPUX9RsmGJtDFQ9uaeL34O69dy99inypBZncg_jgILJ_BHSn_cI902hOsoEQKyTwOfLwwUgKDskwjZ4ySuRS9rkSE5fnTEn0w9U9m92x-yjWvalAoWcebFNVCCPz/s320/board-2.jpeg',
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
            excerpt: 'Úspěchy našich mladých šachistů na Mistrovství Čech. Konstiantyn Tsantsala bojuje v kategorii HD14.',
            content: '<p>Úspěchy našich mladých šachistů na Mistrovství Čech. Konstiantyn Tsantsala bojuje v kategorii HD14.</p>',
            thumbnailUrl: 'https://blogger.googleusercontent.com/img/a/AVvXsEjJ8B0e9gRNW0Sp2GwMUI3AYxaBzSZE5d9lvjNq1CMHVmwN1aHlSQHcOTL5z-9wIBOoaRwBZimEtF3IlGh61mhFbUUkRMoESgB1eq5hSig9kmrmelvThdTWk1lN-mjmZABjlnu_ljZiDeRzXDD1JRgYDRScKjukllHF4BenjKldVLe6qolzZNWxUj2yWFfh',
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

    console.log('✅ Seeded', newsItems.length, 'news items with games');
    console.log('🎉 Seeding completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

// --- Exported functions for use from server.js ---

/**
 * Initial competitions configuration
 */
const initialCompetitions = [
    { id: "3255", name: "1. liga mládeže A", type: "chess-results", url: "https://s3.chess-results.com/tnr1243811.aspx?lan=5&art=46&SNode=S0", category: "youth" },
    { id: "3363", name: "Krajský přebor mládeže", type: "chess-results", url: "https://s2.chess-results.com/tnr1303510.aspx?lan=5&art=46&SNode=S0", category: "youth", active: true },
    { id: "ks-st-zaku", name: "Krajská soutěž st. žáků", type: "chess-results", url: "https://s1.chess-results.com/tnr1310849.aspx?lan=5&art=0&SNode=S0", category: "youth", active: true },
    { id: "ks-vychod", name: "Krajská soutěž východ", type: "chess-results", url: "https://s2.chess-results.com/tnr1278502.aspx?lan=5&art=46&SNode=S0", category: "teams", active: true },
    { id: "kp-liberec", name: "Krajský přebor", type: "chess-results", url: "https://chess-results.com/tnr1276470.aspx?lan=5&art=46", category: "teams", active: true }
];

/**
 * Seed competitions - exported for server.js startup
 */
export async function seedCompetitions(prismaClient) {
    const db = prismaClient || prisma;
    try {
        console.log('[Seed] Seeding/Updating competitions...');
        for (const comp of initialCompetitions) {
            await db.competition.upsert({
                where: { id: comp.id },
                update: { name: comp.name, category: comp.category },
                create: { ...comp, active: comp.active !== undefined ? comp.active : true }
            });
        }
        console.log('[Seed] Competitions seeded/verified.');
    } catch (e) {
        console.error('[Seed] Error seeding competitions:', e);
    }
}

/**
 * Seed database - exported for server.js API endpoint
 */
export async function seedDatabase(prismaClient) {
    const db = prismaClient || prisma;
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await db.user.upsert({
            where: { username: 'admin' },
            update: {},
            create: { username: 'admin', email: 'admin@sachyjablonec.cz', passwordHash: hashedPassword, role: 'superadmin' }
        });
        console.log('[Seed] Database seeded successfully');
        return { success: true };
    } catch (error) {
        console.error('[Seed] Error:', error);
        return { error: error.message };
    }
}

