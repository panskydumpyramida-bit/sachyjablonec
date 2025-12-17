import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Correct URL for Krajský přebor mládeže (from chess-results.com)
const CORRECT_URL = 'https://s2.chess-results.com/tnr1303510.aspx?lan=5&art=46&SNode=S0';

async function fixCompetition() {
    try {
        console.log('Fixing Krajský přebor mládeže...');

        const result = await prisma.competition.update({
            where: { id: '3363' },
            data: {
                url: CORRECT_URL,
                type: 'chess-results',
                active: true
            }
        });

        console.log('Updated:');
        console.log(`  Name: ${result.name}`);
        console.log(`  URL: ${result.url}`);
        console.log(`  Type: ${result.type}`);
        console.log(`  Active: ${result.active}`);
        console.log('\n✅ Done!');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

fixCompetition();
