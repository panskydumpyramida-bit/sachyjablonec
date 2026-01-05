import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Merging Prague Open A, B, 30+ events...');

    // 1. Delete existing individual events
    const titlesToDelete = [
        'OPEN PRAHA A 2026',
        'OPEN PRAHA B 2026',
        'OPEN PRAHA 30+ 2026'
    ];

    const deleteResult = await prisma.event.deleteMany({
        where: {
            title: {
                in: titlesToDelete
            }
        }
    });

    console.log(`Deleted ${deleteResult.count} individual events.`);

    // 2. Create Combined Event
    // Using startDate from the main events (Jan 9th)
    // Using generalized description
    const combinedEvent = {
        title: 'OPEN PRAHA 2026 (A, B, 30+)',
        description: 'Série mistrovských a ratingových turnajů (A, B, 30+). Švýcarský systém na 9 kol, 2x 1,5h/40 + 30min + 30s/tah. Hotel Olympik.',
        startDate: new Date('2026-01-09T16:00:00'),
        endDate: new Date('2026-01-16T14:00:00'),
        location: 'Hotel Olympik, U Sluncové 14, 186 76 Praha 8',
        url: 'https://www.czechtour.net/cz/open-praha/propozice/',
        category: 'tournament',
        ageGroup: 'all', // Covers multiple categories
        eventType: 'individual',
        timeControl: 'classical',
        entryFee: '1500 - 2000 Kč',
        isPublic: true
    };

    const created = await prisma.event.create({
        data: combinedEvent
    });

    console.log(`Created merged event: "${created.title}"`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
