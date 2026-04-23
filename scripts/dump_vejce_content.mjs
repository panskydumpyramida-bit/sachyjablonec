import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();

async function main() {
    const article = await prisma.news.findUnique({ where: { id: 18 } });
    writeFileSync('vejce_content_export.html', article.content, 'utf-8');
    console.log('✅ Obsah článku uložen do vejce_content_export.html');
    console.log('   Délka:', article.content.length, 'znaků');
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
