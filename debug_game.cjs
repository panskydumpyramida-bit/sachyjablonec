
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const games = await prisma.game.findMany({
        where: {
            gameTitle: {
                contains: 'Duda'
            }
        }
    });
    console.log('Found games:', JSON.stringify(games, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
