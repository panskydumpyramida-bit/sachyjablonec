import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Dates for PORG Open 2026 events (104-108)
// 104. turnaj – sobota 10. 1. 2026
// 105. turnaj – sobota 7. 2. 2026
// 106. turnaj – sobota 14. 3. 2026
// 107. turnaj – sobota 18. 4. 2026
// 108. turnaj – sobota 16. 5. 2026

const commonData = {
    location: 'Nový PORG, Pod Krčským lesem 1300/25, 142 00 Praha 4',
    url: 'https://www.chess.cz/wp-content/uploads/2025/09/102_108_PORG_Open_Propozice.pdf',
    category: 'tournament',
    ageGroup: 'youth', // Primary specific for U20/U10
    eventType: 'individual',
    timeControl: 'rapid',
    entryFee: '150 Kč',
    organizerContact: 'sach.porg@gmail.com',
    isPublic: true,
    description: '15. ročník turnajů pro mládež do 20 let. Rapid šach 2x12 min + 3s. Dvě skupiny: Open A (U20) a Open B (U10). Prezence 8:00-8:40.'
};

const events = [
    {
        title: '104. PORG Open',
        startDate: new Date('2026-01-10T09:00:00'),
        endDate: new Date('2026-01-10T14:15:00'),
        registrationDeadline: new Date('2026-01-08T16:00:00'), // 2 days before
    },
    {
        title: '105. PORG Open',
        startDate: new Date('2026-02-07T09:00:00'),
        endDate: new Date('2026-02-07T14:15:00'),
        registrationDeadline: new Date('2026-02-05T16:00:00'),
    },
    {
        title: '106. PORG Open',
        startDate: new Date('2026-03-14T09:00:00'),
        endDate: new Date('2026-03-14T14:15:00'),
        registrationDeadline: new Date('2026-03-12T16:00:00'),
    },
    {
        title: '107. PORG Open',
        startDate: new Date('2026-04-18T09:00:00'),
        endDate: new Date('2026-04-18T14:15:00'),
        registrationDeadline: new Date('2026-04-16T16:00:00'),
    },
    {
        title: '108. PORG Open',
        startDate: new Date('2026-05-16T09:00:00'),
        endDate: new Date('2026-05-16T14:15:00'),
        registrationDeadline: new Date('2026-05-14T16:00:00'),
    }
];

async function main() {
    console.log('Inserting PORG Open 2026 tournaments...');

    for (const evt of events) {
        const eventData = { ...commonData, ...evt };

        const existing = await prisma.event.findFirst({
            where: {
                title: eventData.title,
                startDate: eventData.startDate
            }
        });

        if (existing) {
            console.log(`Event "${eventData.title}" already exists. Skipping.`);
        } else {
            await prisma.event.create({
                data: eventData
            });
            console.log(`Created event "${eventData.title}".`);
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
