/**
 * Convert old JPEG/PNG images to WebP format
 * Also generates thumbnails for images that don't have them
 * 
 * Usage: node scripts/convert_to_webp.js [--dry-run]
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '../uploads');
const DRY_RUN = process.argv.includes('--dry-run');

async function convertToWebP() {
    console.log('🔍 Scanning uploads directory:', UPLOADS_DIR);
    console.log('Mode:', DRY_RUN ? '🔵 DRY RUN (no changes)' : '🟢 LIVE RUN');
    console.log('---');

    if (!fs.existsSync(UPLOADS_DIR)) {
        console.log('❌ Uploads directory not found');
        return;
    }

    const files = fs.readdirSync(UPLOADS_DIR);
    const imageFiles = files.filter(f =>
        /\.(jpg|jpeg|png)$/i.test(f) &&
        !f.includes('-thumb.')
    );

    console.log(`Found ${imageFiles.length} non-WebP images to convert`);

    let converted = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of imageFiles) {
        const filePath = path.join(UPLOADS_DIR, file);
        const baseName = file.replace(/\.(jpg|jpeg|png)$/i, '');
        const webpPath = path.join(UPLOADS_DIR, `${baseName}.webp`);
        const thumbPath = path.join(UPLOADS_DIR, `${baseName}-thumb.webp`);

        // Check if WebP already exists
        if (fs.existsSync(webpPath)) {
            console.log(`⏭️  ${file} → WebP already exists, skipping`);
            skipped++;
            continue;
        }

        try {
            console.log(`🔄 Converting: ${file}`);

            if (!DRY_RUN) {
                // Convert main image
                await sharp(filePath)
                    .resize(1200, 800, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .webp({ quality: 85 })
                    .toFile(webpPath);

                // Generate thumbnail
                await sharp(filePath)
                    .resize(400, null, {
                        withoutEnlargement: true
                    })
                    .webp({ quality: 80 })
                    .toFile(thumbPath);

                // Get file sizes for comparison
                const originalSize = fs.statSync(filePath).size;
                const newSize = fs.statSync(webpPath).size;
                const savings = Math.round((1 - newSize / originalSize) * 100);

                console.log(`   ✅ → ${baseName}.webp (${savings}% smaller)`);
                console.log(`   ✅ → ${baseName}-thumb.webp`);
            } else {
                console.log(`   📋 Would create: ${baseName}.webp`);
                console.log(`   📋 Would create: ${baseName}-thumb.webp`);
            }

            converted++;
        } catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
            errors++;
        }
    }

    console.log('---');
    console.log(`📊 Summary:`);
    console.log(`   Converted: ${converted}`);
    console.log(`   Skipped:   ${skipped}`);
    console.log(`   Errors:    ${errors}`);

    if (DRY_RUN && converted > 0) {
        console.log('\n💡 Run without --dry-run to apply changes');
    }

    if (!DRY_RUN && converted > 0) {
        console.log('\n⚠️  Remember to update database URLs if needed!');
        console.log('   Old .jpg/.png files kept as backup.');
    }
}

convertToWebP().catch(console.error);
