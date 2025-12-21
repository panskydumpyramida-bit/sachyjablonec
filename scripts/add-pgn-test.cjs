
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addTestPgn() {
    // Find a game related to "Soutěže družstev" via News
    const game = await prisma.game.findFirst({
        where: {
            news: {
                category: 'Soutěže družstev'
            }
        }
    });

    if (!game) {
        console.log('No game found in category to update.');
        return;
    }

    console.log(`Updating game ID ${game.id}: ${game.gameTitle}`);

    const pgn = `[Event "Test Game"]
[Site "Jablonec"]
[Date "2025.12.21"]
[Round "1"]
[White "${game.whitePlayer || 'White'}"]
[Black "${game.blackPlayer || 'Black'}"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 *`;

    await prisma.game.update({
        where: { id: game.id },
        data: { pgn: pgn }
    });

    console.log('PGN updated successfully.');
}

addTestPgn()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
