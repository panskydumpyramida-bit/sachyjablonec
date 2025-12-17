import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Correct URL for Krajský přebor mládeže (from chess-results.com)
const CORRECT_URL = 'https://s2.chess-results.com/tnr1303510.aspx?lan=5&art=46&SNode=S0';

async function fixCompetition() {
    try {
        console.log('🔍 Finding Krajský přebor mládeže by name...');

        // Find by name (more reliable than ID)
        const comp = await prisma.competition.findFirst({
            where: {
                name: { contains: 'Krajský přebor mládeže' }
            }
        });

        if (!comp) {
            console.log('❌ Competition not found!');
            return;
        }

        console.log(`Found: ID=${comp.id}, current URL=${comp.url || '(empty)'}, type=${comp.type}`);

        // Update it
        const result = await prisma.competition.update({
            where: { id: comp.id },
            data: {
                url: CORRECT_URL,
                type: 'chess-results',
                active: true
            }
        });

        console.log('✅ Updated:');
        console.log(`  Name: ${result.name}`);
        console.log(`  URL: ${result.url}`);
        console.log(`  Type: ${result.type}`);
        console.log(`  Active: ${result.active}`);
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

fixCompetition();
