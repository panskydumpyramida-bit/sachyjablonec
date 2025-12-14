import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const syncGamesData = async (newsId, gamesJson, teamName) => {
    // 1. Delete existing games linked to this news
    await prisma.game.deleteMany({
        where: { newsId: newsId }
    });

    if (!gamesJson) return;

    let games = [];
    try {
        games = JSON.parse(gamesJson);
    } catch (e) {
        console.error(`Failed to parse gamesJson for news ${newsId}:`, e);
        return;
    }

    if (!Array.isArray(games) || games.length === 0) return;

    // 2. Prepare new game records
    const gameRecords = games.map((g, index) => {
        // Skip headers
        if (g.type === 'header') return null;

        // Try to parse players from title "White - Black"
        let white = null;
        let black = null;
        if (g.title && g.title.includes('-')) {
            const parts = g.title.split('-');
            if (parts.length === 2) {
                white = parts[0].trim();
                black = parts[1].trim();
            }
        }

        return {
            gameTitle: g.title || 'Untitled',
            chessComId: g.gameId || '', // Map gameId to chessComId
            whitePlayer: white,
            blackPlayer: black,
            team: teamName || g.team || null,
            positionOrder: index,
            isCommented: g.isCommented || g.commented || false,
            newsId: newsId
        };
    }).filter(g => g !== null);

    // 3. Insert new records
    if (gameRecords.length > 0) {
        await prisma.game.createMany({
            data: gameRecords
        });
        console.log(`Synced ${gameRecords.length} games for news ${newsId}`);
    }
};

const main = async () => {
    console.log('Starting games sync...');
    const allNews = await prisma.news.findMany({
        where: {
            gamesJson: {
                not: null
            }
        }
    });

    console.log(`Found ${allNews.length} articles with games.`);

    for (const news of allNews) {
        if (news.gamesJson) {
            await syncGamesData(news.id, news.gamesJson, news.category);
        }
    }

    console.log('Sync complete.');
};

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
