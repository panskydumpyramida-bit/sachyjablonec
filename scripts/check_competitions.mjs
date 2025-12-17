import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCompetitions() {
    try {
        const competitions = await prisma.competition.findMany({
            where: { category: 'youth' },
            orderBy: { sortOrder: 'asc' }
        });

        console.log('Youth competitions:');
        competitions.forEach(c => {
            console.log(`\nID: ${c.id}`);
            console.log(`  Name: ${c.name}`);
            console.log(`  URL: ${c.url || '(empty)'}`);
            console.log(`  Type: ${c.type}`);
            console.log(`  Active: ${c.active}`);
            console.log(`  SortOrder: ${c.sortOrder}`);
        });
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

checkCompetitions();
