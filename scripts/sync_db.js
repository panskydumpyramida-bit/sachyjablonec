
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

// Local client (uses .env)
const localPrisma = new PrismaClient();

// Remote client (never commit the production connection string)
const REMOTE_DB_URL = process.env.REMOTE_DATABASE_URL;
if (!REMOTE_DB_URL) {
    console.error('❌ Chybí proměnná REMOTE_DATABASE_URL.');
    console.error('   Načti ji z Railway a spusť skript znovu.');
    process.exit(1);
}

const remotePrisma = new PrismaClient({
    datasources: {
        db: {
            url: REMOTE_DB_URL,
        },
    },
});

async function main() {
    console.log('🔄 Starting database sync from Remote to Local...');
    console.log('⚠️  WARNING: This will overwrite local data!');

    try {
        // 1. Clear local database (Reverse dependency order)
        console.log('🧹 Clearing local database...');

        // Delete independent or dependent-heavy first
        await localPrisma.game.deleteMany({});
        await localPrisma.matchReport.deleteMany({});
        await localPrisma.news.deleteMany({}); // Delete news after games/reports
        await localPrisma.standing.deleteMany({});
        await localPrisma.competition.deleteMany({});
        await localPrisma.puzzleRaceResult.deleteMany({});
        await localPrisma.gameRecorded.deleteMany({});
        await localPrisma.blicakRegistration.deleteMany({});
        await localPrisma.image.deleteMany({});
        await localPrisma.message.deleteMany({});
        // Users last due to foreign keys from many tables
        await localPrisma.user.deleteMany({});
        await localPrisma.systemSetting.deleteMany({});
        await localPrisma.puzzleRacerSettings.deleteMany({});

        console.log('✅ Local database cleared.');

        // 2. Fetch data from Remote and Insert into Local
        // Order: Independent -> Dependent

        // --- User ---
        console.log('📥 Syncing Users...');
        const users = await remotePrisma.user.findMany();
        if (users.length) {
            await localPrisma.user.createMany({ data: users });
        }
        console.log(`✅ Synced ${users.length} Users`);

        // --- SystemSetting ---
        console.log('📥 Syncing SystemSettings...');
        const systemSettings = await remotePrisma.systemSetting.findMany();
        if (systemSettings.length) {
            await localPrisma.systemSetting.createMany({ data: systemSettings });
        }

        // --- PuzzleRacerSettings ---
        console.log('📥 Syncing PuzzleRacerSettings...');
        const prSettings = await remotePrisma.puzzleRacerSettings.findMany();
        if (prSettings.length) {
            await localPrisma.puzzleRacerSettings.createMany({ data: prSettings });
        }

        // --- Image ---
        console.log('📥 Syncing Images...');
        // Remote DB might be behind (missing category), so we select specific fields
        const images = await remotePrisma.image.findMany({
            select: {
                id: true,
                filename: true,
                originalName: true,
                url: true,
                altText: true,
                // category: true, // SKIPPING category as it might not exist on remote
                // newsId: true, // SKIPPING newsId as it might not exist on remote
                isPublic: true,
                uploadedAt: true
            }
        });
        if (images.length) {
            await localPrisma.image.createMany({ data: images });
        }
        console.log(`✅ Synced ${images.length} Images`);

        // --- Competition ---
        console.log('📥 Syncing Competitions...');
        const competitions = await remotePrisma.competition.findMany();
        if (competitions.length) {
            await localPrisma.competition.createMany({ data: competitions });
        }
        console.log(`✅ Synced ${competitions.length} Competitions`);


        // --- Message ---
        console.log('📥 Syncing Messages...');
        const messages = await remotePrisma.message.findMany();
        if (messages.length) {
            await localPrisma.message.createMany({ data: messages });
        }

        // --- BlicakRegistration ---
        console.log('📥 Syncing BlicakRegistrations...');
        const blicakRegs = await remotePrisma.blicakRegistration.findMany();
        if (blicakRegs.length) {
            await localPrisma.blicakRegistration.createMany({ data: blicakRegs });
        }

        // --- Standing (Depends on Competition) ---
        console.log('📥 Syncing Standings...');
        const standings = await remotePrisma.standing.findMany();
        if (standings.length) {
            await localPrisma.standing.createMany({ data: standings });
        }
        console.log(`✅ Synced ${standings.length} Standings`);

        // --- News (Depends on User) ---
        console.log('📥 Syncing News...');
        const news = await remotePrisma.news.findMany();
        if (news.length) {
            await localPrisma.news.createMany({ data: news });
        }
        console.log(`✅ Synced ${news.length} News articles`);

        // --- MatchReport (Depends on News) ---
        console.log('📥 Syncing MatchReports...');
        const matchReports = await remotePrisma.matchReport.findMany();
        if (matchReports.length) {
            await localPrisma.matchReport.createMany({ data: matchReports });
        }
        console.log(`✅ Synced ${matchReports.length} MatchReports`);

        // --- Game (Depends on MatchReport and News) ---
        console.log('📥 Syncing Games...');
        const games = await remotePrisma.game.findMany();
        if (games.length) {
            await localPrisma.game.createMany({ data: games });
        }
        console.log(`✅ Synced ${games.length} Games`);

        // --- PuzzleRaceResult (Depends on User) ---
        console.log('📥 Syncing PuzzleRaceResults...');
        const puzzleResults = await remotePrisma.puzzleRaceResult.findMany();
        if (puzzleResults.length) {
            await localPrisma.puzzleRaceResult.createMany({ data: puzzleResults });
        }

        // --- GameRecorded (Depends on User) ---
        console.log('📥 Syncing GameRecorded...');
        const gamesRecorded = await remotePrisma.gameRecorded.findMany();
        if (gamesRecorded.length) {
            await localPrisma.gameRecorded.createMany({ data: gamesRecorded });
        }

        console.log('🎉 Database sync complete!');

    } catch (error) {
        console.error('❌ Error during sync:', error);
    } finally {
        await localPrisma.$disconnect();
        await remotePrisma.$disconnect();
    }
}

main();
