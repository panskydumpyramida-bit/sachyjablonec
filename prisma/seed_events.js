import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding events...');

    // Delete placeholder if exists
    await prisma.event.deleteMany({
        where: { title: 'Vánoční bleskový turnaj Libštát' }
    });

    const events = [
        {
            title: 'Vánoční rapid Rokytnice 2025',
            startDate: new Date('2025-12-26T09:30:00'),
            description: 'Otevřený turnaj v rapid šachu pro všechny registrované i neregistrované příznivce šachové hry. Švýcarský systém na 7 kol. Hrací materiál zajistí pořadatel. Občerstvení zajištěno.\n\nPřihlášky do: 25. 12. 2025 23:59\nVýdělečně činní: 100 Kč, Ostatní: 70 Kč, Na místě: +50 Kč\nZdenek Lenc, zdeneklenc@seznam.cz, 605 876 471 (pouze SMS)',
            location: 'Sportovní hala, Horní Rokytnice 461, Rokytnice nad Jizerou',
            category: 'tournament',
            ageGroup: 'adults',
            eventType: 'individual',
            timeControl: 'rapid',
            presentationEnd: new Date('2025-12-26T09:20:00'),
            isPublic: true,
            isInternal: false,
        },
        {
            title: 'Memoriál Vlastimila Mareše - 8. ročník GP ČR rapid',
            startDate: new Date('2025-12-27T09:00:00'),
            description: '4. turnaj seriálu GRAND PRIX ČR v rapid šachu 2025/2026 (19. ročník). Švýcarský systém na 9 kol. Tempo 2x12 min + 5 sec/tah. Turnaj na LOK-rapid i FRL-rapid. Max 160 hráčů. Po 4.-5. kole 45 min přestávka na oběd.\n\nPřihlášky do: 17. 12. 2025 23:59',
            location: 'Taneční sál nám. Trčků z Lípy č. p. 217 Světlá nad Sázavou',
            category: 'tournament',
            ageGroup: 'adults',
            eventType: 'individual',
            timeControl: 'rapid',
            presentationEnd: new Date('2025-12-27T08:45:00'),
            isPublic: true,
            isInternal: false,
        },
        {
            title: 'Vánoční bleskový turnaj Libštát 2025',
            startDate: new Date('2025-12-27T17:00:00'),
            description: '38. ročník Vánočního šachového turnaje v bleskové hře.\n\nFormát: 2x5 minut. Ceny pro každého!\nPodmínka: Každý lichý hráč oddílu přiveze soupravu a hodiny.\nStartovné: 100 Kč (mládež do 15 let 50 Kč).\nPřihlášky do 22. 12. 2025: Jiří Pospíšil (731 893 934, sachylibstat@seznam.cz).\nMožnost občerstvení v restauraci.',
            location: 'Kulturní Dům v Libštátě (na náměstí)',
            category: 'tournament',
            ageGroup: 'all',
            eventType: 'individual',
            timeControl: 'blitz',
            presentationEnd: new Date('2025-12-27T16:45:00'),
            registrationDeadline: new Date('2025-12-22T23:59:00'),
            organizerContact: 'Jan Šimůnek 602 289 012',
            isPublic: true,
            isInternal: false,
        }
    ];

    for (const event of events) {
        // Check if exists to avoid dupes
        const existing = await prisma.event.findFirst({
            where: { title: event.title }
        });

        if (!existing) {
            await prisma.event.create({ data: event });
            console.log(`Created event: ${event.title}`);
        } else {
            console.log(`Event already exists: ${event.title}`);
        }
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
