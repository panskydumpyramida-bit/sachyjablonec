const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const lastNews = await prisma.news.findFirst({
            orderBy: { updatedAt: 'desc' }
        });

        if (!lastNews) {
            console.log('No news found');
            return;
        }

        console.log('--- Last News Item ---');
        console.log('ID:', lastNews.id);
        console.log('Title:', lastNews.title);
        console.log('Slug:', lastNews.slug);
        console.log('GamesJson Type:', typeof lastNews.gamesJson);
        console.log('GamesJson Content:', lastNews.gamesJson);

        if (lastNews.gamesJson) {
            try {
                const games = JSON.parse(lastNews.gamesJson);
                console.log('Parsed Games Array Length:', games.length);
                if (games.length > 0) {
                    console.log('First Game:', JSON.stringify(games[0], null, 2));
                }
            } catch (e) {
                console.error('JSON Parse Error:', e.message);
            }
        } else {
            console.log('GamesJson is null or undefined');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
