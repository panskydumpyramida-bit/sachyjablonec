import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Updating Prague Open presentation times...');

    // 1. OPEN PRAHA 2026 (A, B, 30+) -> 14:00 (Jan 9th)
    const updateAB30 = await prisma.event.updateMany({
        where: { title: 'OPEN PRAHA 2026 (A, B, 30+)' },
        data: {
            presentationEnd: new Date('2026-01-09T14:00:00')
        }
    });
    console.log(`Updated A/B/30+ (Count: ${updateAB30.count})`);

    // 2. OPEN PRAHA C 2026 (Rapid) -> 9:15 (Jan 11th)
    const updateC = await prisma.event.updateMany({
        where: { title: 'OPEN PRAHA C 2026 (Rapid)' },
        data: {
            presentationEnd: new Date('2026-01-11T09:15:00')
        }
    });
    console.log(`Updated C Rapid (Count: ${updateC.count})`);

    // 3. OPEN PRAHA D 2026 (Blesk) -> 9:45 (Jan 14th)
    const updateD = await prisma.event.updateMany({
        where: { title: 'OPEN PRAHA D 2026 (Blesk)' },
        data: {
            presentationEnd: new Date('2026-01-14T09:45:00')
        }
    });
    console.log(`Updated D Blitz (Count: ${updateD.count})`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
