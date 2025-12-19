
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Find images associated with article 54 logic (based on URL matching)
    // We'll just list all images to see what we have, filtering by category 'blicak' potentially if known, 
    // or just list last updated images.

    const images = await prisma.image.findMany({
        orderBy: { uploadedAt: 'desc' },
        take: 5
    });

    console.log('--- LATEST IMAGES IN DB ---');
    images.forEach(img => {
        console.log(`ID: ${img.id}, URL: ${img.url}, AltText: "${img.altText}", Category: "${img.category}"`);
    });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
