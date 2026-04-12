/**
 * One-time image optimization script
 * Converts large PNG files to WebP + compressed PNG fallback
 * Uses sharp (already in project dependencies)
 *
 * Usage: node scripts/optimize-images.mjs [--dry-run]
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const IMAGES_DIR = path.resolve('images');
const MIN_SIZE_KB = 100; // Only optimize files > 100KB
const MAX_WIDTH = 1200;  // Resize images wider than this
const WEBP_QUALITY = 80;
const PNG_QUALITY = 80;

const isDryRun = process.argv.includes('--dry-run');

async function getFiles(dir, ext) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await getFiles(full, ext));
        } else if (entry.name.toLowerCase().endsWith(ext)) {
            files.push(full);
        }
    }
    return files;
}

async function optimizeImage(filePath) {
    const stat = await fs.stat(filePath);
    const sizeKB = stat.size / 1024;

    if (sizeKB < MIN_SIZE_KB) return null;

    const ext = path.extname(filePath).toLowerCase();
    const webpPath = filePath.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    const meta = await sharp(filePath).metadata();

    // Skip if already optimized (webp version exists and is newer)
    try {
        const webpStat = await fs.stat(webpPath);
        if (webpStat.mtimeMs > stat.mtimeMs) {
            return null; // WebP already exists and is newer
        }
    } catch { /* WebP doesn't exist yet */ }

    const needsResize = meta.width > MAX_WIDTH;
    const pipeline = sharp(filePath);

    if (needsResize) {
        pipeline.resize(MAX_WIDTH, null, { withoutEnlargement: true });
    }

    if (isDryRun) {
        console.log(`[DRY RUN] Would optimize: ${path.relative(IMAGES_DIR, filePath)} (${sizeKB.toFixed(0)}KB, ${meta.width}x${meta.height})`);
        return { file: filePath, originalKB: sizeKB };
    }

    // Create WebP version
    const webpBuffer = await pipeline.clone().webp({ quality: WEBP_QUALITY }).toBuffer();
    await fs.writeFile(webpPath, webpBuffer);

    // Compress original PNG/JPG in-place
    let compressedBuffer;
    if (ext === '.png') {
        compressedBuffer = await pipeline.clone().png({ quality: PNG_QUALITY, compressionLevel: 9 }).toBuffer();
    } else {
        compressedBuffer = await pipeline.clone().jpeg({ quality: PNG_QUALITY, mozjpeg: true }).toBuffer();
    }

    // Only overwrite if smaller
    if (compressedBuffer.length < stat.size) {
        await fs.writeFile(filePath, compressedBuffer);
    }

    const savedKB = sizeKB - (compressedBuffer.length / 1024);
    const webpKB = webpBuffer.length / 1024;

    console.log(
        `✅ ${path.relative(IMAGES_DIR, filePath)}: ${sizeKB.toFixed(0)}KB → ${(compressedBuffer.length / 1024).toFixed(0)}KB (PNG) / ${webpKB.toFixed(0)}KB (WebP)` +
        (needsResize ? ` [resized to ${MAX_WIDTH}px]` : '')
    );

    return { file: filePath, originalKB: sizeKB, savedKB, webpKB };
}

async function main() {
    console.log(`🖼️  Image optimizer ${isDryRun ? '(DRY RUN)' : ''}`);
    console.log(`   Directory: ${IMAGES_DIR}`);
    console.log(`   Min size: ${MIN_SIZE_KB}KB, Max width: ${MAX_WIDTH}px\n`);

    const pngs = await getFiles(IMAGES_DIR, '.png');
    const jpgs = await getFiles(IMAGES_DIR, '.jpg');
    const jpegs = await getFiles(IMAGES_DIR, '.jpeg');
    const files = [...pngs, ...jpgs, ...jpegs];

    console.log(`Found ${files.length} image files\n`);

    let totalSaved = 0;
    let optimized = 0;

    for (const file of files) {
        try {
            const result = await optimizeImage(file);
            if (result) {
                optimized++;
                totalSaved += result.savedKB || 0;
            }
        } catch (err) {
            console.error(`❌ Error processing ${file}: ${err.message}`);
        }
    }

    console.log(`\n📊 Summary: ${optimized} files optimized, ${totalSaved.toFixed(0)}KB saved`);
}

main().catch(console.error);
