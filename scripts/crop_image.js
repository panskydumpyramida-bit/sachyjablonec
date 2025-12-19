
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const imagePath = path.join(__dirname, '../images/winners_2024.png');
const outputPath = path.join(__dirname, '../images/winners_2024_cropped.png');

async function crop() {
    try {
        const image = sharp(imagePath);
        const metadata = await image.metadata();

        const { width, height } = metadata;

        // Settings for "phone screenshot" crop
        // Top status bar: ~6%
        // Bottom nav/space: ~10%
        const topCrop = Math.floor(height * 0.06);
        const bottomCrop = Math.floor(height * 0.10);
        const newHeight = height - topCrop - bottomCrop;

        console.log(`Original: ${width}x${height}`);
        console.log(`Cropping Top: ${topCrop}px, Bottom: ${bottomCrop}px`);
        console.log(`New Size: ${width}x${newHeight}`);

        await image
            .extract({ left: 0, top: topCrop, width: width, height: newHeight })
            .toFile(outputPath);

        console.log('Crop successful!');
    } catch (err) {
        console.error('Error cropping image:', err);
        process.exit(1);
    }
}

crop();
