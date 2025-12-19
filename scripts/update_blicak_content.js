import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
    try {
        const contentPath = path.join(__dirname, '../static_blicak_content.html');
        const content = fs.readFileSync(contentPath, 'utf8');

        // Update Article 54
        const updated = await prisma.news.update({
            where: { id: 54 },
            data: {
                content: content,
                excerpt: "Tradiční předvánoční bleskový turnaj jsme letos odehráli už po devatenácté – poprvé jako memoriál zesnulého předsedy Čestmíra Drobníka. Na start se postavilo 37 hráčů a po deseti kolech slavil Marek Sýkora (Zikuda Turnov)."
            }
        });

        console.log(`Updated News ID ${updated.id} successfully.`);
    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
