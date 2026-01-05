import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const bakov = await prisma.event.findFirst({ where: { title: { contains: 'BAKOVSKÉ DVOJICE' } } });
    if (bakov) {
        await prisma.event.update({
            where: { id: bakov.id },
            data: {
                location: 'Mírové náměstí 208, 294 01 Bakov nad Jizerou' // Radnice address
            }
        });
        console.log('Updated Bakov location for better map accuracy.');
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
