
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Importing Prague International Chess Festival 2026...');

    const tournaments = [
        {
            title: '8. Prague International Chess Festival 2026',
            description: 'Největší šachový festival v ČR. Masters, Challengers, Open a mládežnické turnaje.',
            startDate: new Date('2026-02-24T12:00:00Z'),
            endDate: new Date('2026-03-06T18:00:00Z'),
            location: 'Hotel Don Giovanni, Praha',
            category: 'tournament',
            eventType: 'individual',
            url: 'https://praguechessfestival.com/',
            isFeatured: true,
            isPublic: true,
            organizerContact: 'novoborsky@chess.cz'
        },
        {
            title: 'PICF 2026 - Karel Janeček Open',
            description: 'Open turnaj v rámci festivalu Prague International Chess Festival. Hraje se o atraktivní cenový fond.',
            startDate: new Date('2026-02-26T15:00:00Z'),
            endDate: new Date('2026-03-06T14:00:00Z'),
            location: 'Hotel Don Giovanni, Praha',
            category: 'tournament',
            eventType: 'individual',
            url: 'https://praguechessfestival.com/',
            isFeatured: false, // Main one is featured
            isPublic: true,
            entryFee: 'viz propozice',
            timeControl: '90m/40 + 30m + 30s'
        }
    ];

    for (const t of tournaments) {
        // Check if exists by title
        const existing = await prisma.event.findFirst({
            where: { title: t.title }
        });

        if (existing) {
            console.log(`Updating ${t.title}...`);
            await prisma.event.update({
                where: { id: existing.id },
                data: t
            });
        } else {
            console.log(`Creating ${t.title}...`);
            await prisma.event.create({
                data: t
            });
        }
    }

    console.log('Import completed.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
