
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.news.count();
    console.log('Total News in DB:', count);

    if (count > 0) {
        const news = await prisma.news.findMany({
            take: 3,
            orderBy: { publishedDate: 'desc' }
        });
        console.log('Recent news:', JSON.stringify(news, null, 2));
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
