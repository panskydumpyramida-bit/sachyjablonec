import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const events = [
    {
        title: 'OPEN PRAHA A 2026',
        description: 'Otevřený mistrovský turnaj s normou IM. Švýcarský systém na 9 kol, 2x 1,5h/40 + 30min + 30s/tah.',
        startDate: new Date('2026-01-09T16:00:00'), // Assuming start time, usually afternoon
        endDate: new Date('2026-01-16T14:00:00'),
        location: 'Hotel Olympik, U Sluncové 14, 186 76 Praha 8',
        url: 'https://www.czechtour.net/cz/open-praha/propozice/',
        category: 'tournament', // adult tournament
        ageGroup: 'all',
        eventType: 'individual',
        timeControl: 'classical',
        entryFee: '2000 Kč (základní)',
        isPublic: true
    },
    {
        title: 'OPEN PRAHA B 2026',
        description: 'Otevřený ratingový turnaj (ELO < 2000). Švýcarský systém na 9 kol, 2x 1,5h/40 + 30min + 30s/tah.',
        startDate: new Date('2026-01-09T16:00:00'),
        endDate: new Date('2026-01-16T14:00:00'),
        location: 'Hotel Olympik, U Sluncové 14, 186 76 Praha 8',
        url: 'https://www.czechtour.net/cz/open-praha/propozice/',
        category: 'tournament',
        ageGroup: 'all', // limits by ELO, not age per se (though usually adults/youth mixed)
        eventType: 'individual',
        timeControl: 'classical',
        entryFee: '1500 Kč (základní)',
        isPublic: true
    },
    {
        title: 'OPEN PRAHA 30+ 2026',
        description: 'Otevřený ratingový turnaj pro hráče narozené 1996 a starší. Švýcarský systém na 9 kol.',
        startDate: new Date('2026-01-09T16:00:00'),
        endDate: new Date('2026-01-16T14:00:00'),
        location: 'Hotel Olympik, U Sluncové 14, 186 76 Praha 8',
        url: 'https://www.czechtour.net/cz/open-praha/propozice/',
        category: 'tournament',
        ageGroup: 'adults',
        eventType: 'individual',
        timeControl: 'classical',
        entryFee: '1500 Kč (základní)',
        isPublic: true
    },
    {
        title: 'OPEN PRAHA C 2026 (Rapid)',
        description: 'Otevřený turnaj v rapid šachu. 7 kol, 2x 10 min + 5s/tah.',
        startDate: new Date('2026-01-11T09:00:00'), // Usually morning
        endDate: new Date('2026-01-11T14:00:00'),
        location: 'Hotel Olympik, U Sluncové 14, 186 76 Praha 8',
        url: 'https://www.czechtour.net/cz/open-praha/propozice/',
        category: 'tournament',
        ageGroup: 'all',
        eventType: 'individual',
        timeControl: 'rapid',
        entryFee: '200 Kč',
        isPublic: true
    },
    {
        title: 'OPEN PRAHA D 2026 (Blesk)',
        description: 'Otevřený bleskový turnaj. 11 kol, 2x 3 min + 2s/tah.',
        startDate: new Date('2026-01-14T09:00:00'), // Usually morning
        endDate: new Date('2026-01-14T12:00:00'),
        location: 'Hotel Olympik, U Sluncové 14, 186 76 Praha 8',
        url: 'https://www.czechtour.net/cz/open-praha/propozice/',
        category: 'tournament',
        ageGroup: 'all',
        eventType: 'individual',
        timeControl: 'blitz',
        entryFee: '200 Kč',
        isPublic: true
    }
];

async function main() {
    console.log('Inserting Prague Open 2026 tournaments...');

    for (const event of events) {
        const existing = await prisma.event.findFirst({
            where: {
                title: event.title,
                startDate: event.startDate
            }
        });

        if (existing) {
            console.log(`Event "${event.title}" already exists. Skipping.`);
        } else {
            await prisma.event.create({
                data: event
            });
            console.log(`Created event "${event.title}".`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
