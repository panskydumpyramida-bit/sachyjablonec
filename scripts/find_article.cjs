const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const id = 75;
    console.log(`Checking for News with ID ${id}...`);
    const news75 = await prisma.news.findUnique({ where: { id } });

    if (news75) {
        console.log('Found Article 75:', news75.title);
    } else {
        console.log('Article 75 NOT FOUND.');

        // Check max ID
        const lastNews = await prisma.news.findFirst({ orderBy: { id: 'desc' } });
        console.log('Max News ID:', lastNews ? lastNews.id : 0);

        // Search by title
        const search = await prisma.news.findMany({
            where: { title: { contains: 'Broumovská', mode: 'insensitive' } }
        });
        console.log('Articles with "Broumovská" in title:', search.map(n => `${n.id}: ${n.title}`));
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
