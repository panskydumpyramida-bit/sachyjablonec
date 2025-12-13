/**
 * Migration script: Parse existing news.gamesJson and insert into games table
 * 
 * Run with: node scripts/migrate-games-json.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Parse title like "1. Duda - Vacek" into white/black players
 */
function parseTitle(title) {
    // Remove leading number like "1. " or "1."
    const cleaned = title.replace(/^\d+\.\s*/, '').trim();

    // Split by " - " to get players
    const parts = cleaned.split(/\s*-\s*/);

    if (parts.length === 2) {
        return {
            whitePlayer: parts[0].trim(),
            blackPlayer: parts[1].trim()
        };
    }

    return { whitePlayer: null, blackPlayer: null };
}

async function migrateGamesJson() {
    console.log('Starting gamesJson migration...\n');

    // Get all news with gamesJson
    const newsWithGames = await prisma.news.findMany({
        where: {
            gamesJson: { not: null }
        },
        select: {
            id: true,
            title: true,
            gamesJson: true
        }
    });

    console.log(`Found ${newsWithGames.length} news items with gamesJson\n`);

    let totalGames = 0;
    let errors = 0;

    for (const news of newsWithGames) {
        try {
            const games = JSON.parse(news.gamesJson);

            if (!Array.isArray(games) || games.length === 0) {
                continue;
            }

            console.log(`Processing news #${news.id}: "${news.title}" (${games.length} games)`);

            for (let i = 0; i < games.length; i++) {
                const gameData = games[i];
                const { whitePlayer, blackPlayer } = parseTitle(gameData.title || '');

                // Check if game already exists for this news
                const existing = await prisma.game.findFirst({
                    where: {
                        newsId: news.id,
                        chessComId: gameData.gameId
                    }
                });

                if (existing) {
                    console.log(`  - Skipping "${gameData.title}" (already exists)`);
                    continue;
                }

                await prisma.game.create({
                    data: {
                        gameTitle: gameData.title || `Game ${i + 1}`,
                        chessComId: gameData.gameId,
                        whitePlayer,
                        blackPlayer,
                        team: gameData.team || null,
                        positionOrder: i + 1,
                        newsId: news.id
                    }
                });

                console.log(`  + Added "${gameData.title}" (${gameData.gameId})`);
                totalGames++;
            }
        } catch (e) {
            console.error(`Error processing news #${news.id}:`, e.message);
            errors++;
        }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   Total games migrated: ${totalGames}`);
    console.log(`   Errors: ${errors}`);
}

migrateGamesJson()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e);
        prisma.$disconnect();
        process.exit(1);
    });
