import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imageUrl = 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80';
const outputDir = path.join(__dirname, '../images');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Download function
const download = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest);
            reject(err);
        });
    });
};

async function processHero() {
    const tempFile = path.join(outputDir, 'temp_hero.jpg');
    console.log('Downloading hero image...');
    await download(imageUrl, tempFile);

    console.log('Processing images...');

    // Mobile version (800w, WebP)
    await sharp(tempFile)
        .resize(800)
        .webp({ quality: 80 })
        .toFile(path.join(outputDir, 'hero-mobile.webp'));
    console.log('Created hero-mobile.webp');

    // Desktop version (1920w, WebP)
    await sharp(tempFile)
        .resize(1920)
        .webp({ quality: 85 })
        .toFile(path.join(outputDir, 'hero-desktop.webp'));
    console.log('Created hero-desktop.webp');

    // Cleanup
    fs.unlinkSync(tempFile);
    console.log('Done!');
}

processHero().catch(console.error);
