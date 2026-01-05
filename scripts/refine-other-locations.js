import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Refining locations...');

    // 1. Varnsdorf
    const varnsdorf = await prisma.event.findFirst({ where: { title: { contains: 'Pololetní šachový turnaj' } } });
    if (varnsdorf) {
        await prisma.event.update({
            where: { id: varnsdorf.id },
            data: {
                location: 'DDM Varnsdorf, Otáhalova 1260, 407 47 Varnsdorf'
            }
        });
        console.log('Updated Varnsdorf location.');
    }

    // 2. Josefův Důl
    const josefuvDul = await prisma.event.findFirst({ where: { title: { contains: 'JOSEFŮV DŮL' } } });
    if (josefuvDul) {
        await prisma.event.update({
            where: { id: josefuvDul.id },
            data: {
                location: 'Muzeum místní historie, Josefův Důl 210, 468 44 Josefův Důl'
            }
        });
        console.log('Updated Josefův Důl location.');
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
