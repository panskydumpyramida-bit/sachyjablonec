import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../uploads');

async function generateThumbnails() {
    console.log('Starting thumbnail generation in:', uploadsDir);

    if (!fs.existsSync(uploadsDir)) {
        console.error('Uploads directory not found!');
        return;
    }

    const files = fs.readdirSync(uploadsDir);
    let count = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of files) {
        // Process only main images (skip existing thumbs and non-image files)
        if (!file.match(/\.(webp|jpg|jpeg|png)$/i) || file.includes('-thumb')) {
            continue;
        }

        const filePath = path.join(uploadsDir, file);
        const ext = path.extname(file);
        const baseName = path.basename(file, ext);
        const thumbName = `${baseName}-thumb${ext}`;
        const thumbPath = path.join(uploadsDir, thumbName);

        if (fs.existsSync(thumbPath)) {
            console.log(`Skipping (thumb exists): ${file}`);
            skipped++;
            continue;
        }

        try {
            console.log(`Processing: ${file}`);
            await sharp(filePath)
                .resize(400, null, { // Width 400, auto height
                    withoutEnlargement: true
                })
                .toFile(thumbPath);
            count++;
        } catch (err) {
            console.error(`Error processing ${file}:`, err.message);
            errors++;
        }
    }

    console.log(`\nDone! Generated: ${count}, Skipped: ${skipped}, Errors: ${errors}`);
}

generateThumbnails();
