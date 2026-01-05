import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Updating PORG Open presentation times to 08:40...');

    const events = await prisma.event.findMany({
        where: { title: { contains: 'PORG Open' } }
    });

    console.log(`Found ${events.length} PORG Open events.`);

    for (const event of events) {
        // Create new date based on start date but set time to 08:40
        const pEnd = new Date(event.startDate);
        pEnd.setHours(8, 40, 0, 0);

        await prisma.event.update({
            where: { id: event.id },
            data: { presentationEnd: pEnd }
        });

        console.log(`Updated "${event.title}": Presentation end set to ${pEnd.toLocaleTimeString()}`);
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
