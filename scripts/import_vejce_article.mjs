/**
 * Import script: Velikonoční vejce 2026
 * - Converts photos from Downloads/veli_blitz to WebP
 * - Saves them to uploads/ with thumbnails
 * - Inserts gallery images into DB
 * - Creates the article in the news table with gallery_json
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const uploadsDir = path.join(__dirname, '../uploads');
const sourceDir = '/Users/antoninduda/Downloads/veli_blitz';

async function main() {
    console.log('🐣 Import: Jablonecké Velikonoční vejce 2026\n');

    // 1. Get source photos
    const files = fs.readdirSync(sourceDir)
        .filter(f => f.endsWith('.jpeg') || f.endsWith('.jpg'))
        .sort();

    console.log(`📸 Nalezeno ${files.length} fotek v ${sourceDir}`);

    const galleryUrls = [];

    // 2. Process each photo -> WebP + thumbnail, save to uploads & DB
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const srcPath = path.join(sourceDir, file);
        const buffer = fs.readFileSync(srcPath);

        const timestamp = Date.now() + i; // ensure unique
        const rand = Math.round(Math.random() * 1E9);
        const filename = `${timestamp}-${rand}.webp`;
        const thumbName = filename.replace('.webp', '-thumb.webp');

        const filepath = path.join(uploadsDir, filename);
        const thumbPath = path.join(uploadsDir, thumbName);

        // Full size (max 1200x800)
        await sharp(buffer)
            .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toFile(filepath);

        // Thumbnail (400px wide)
        await sharp(buffer)
            .resize(400, null, { withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(thumbPath);

        const url = `/uploads/${filename}`;
        galleryUrls.push(url);

        // Save to images table
        await prisma.image.create({
            data: {
                filename,
                originalName: `velikonocni_vejce_${i + 1}.jpeg`,
                url,
                altText: `Velikonoční vejce 2026 - foto ${i + 1}`,
                category: 'velikonocni-vejce-2026',
                isPublic: true,
            }
        });

        process.stdout.write(`  ✓ ${i + 1}/${files.length} ${file} → ${filename}\r`);
    }

    console.log(`\n✅ Všech ${files.length} fotek zpracováno a nahráno.\n`);

    // 3. Build gallery JSON
    const galleryJson = JSON.stringify(galleryUrls);

    // 4. Article HTML content
    const content = `
<p style="margin-bottom: 1.5rem;">O Velikonocích jsme opět usedli k šachovnicím v rámci tradičního bleskového turnaje <strong>Jablonecké Velikonoční vejce</strong>. Letošní ročník přilákal do naší hrací místnosti celkem 33 šachistů z širokého okolí, což jen potvrzuje oblibu tohoto svátečního klání.</p>

<p style="margin-bottom: 1.5rem;">Vítězem napínavého desetikolového turnaje se stal domácí <strong>Antonín Duda</strong>, který ziskem 8,5 bodu potvrdil výbornou formu a zaslouženě ovládl konečné pořadí. Hned v závěsu za ním si stříbrnou pozici s 8 body vybojoval <strong>Marek Sýkora</strong> (ŠK Zikuda Turnov). Pro skvělé třetí místo (7,5 bodu) si nakonec došel <strong>Martin Vašák</strong> hrající za TJ Jiskru Tanvald.</p>

<p style="margin-bottom: 1.5rem;">Turnaj se tradičně odehrál ve velmi přátelské a pohodové sváteční atmosféře a přinesl nespočet bojovných partií i napínavých koncovek. Děkujeme všem za účast a parádní šachový prožitek!</p>

<h3 style="color: var(--primary-color); margin: 2rem 0 1rem;">🏆 Konečné pořadí (TOP 5)</h3>

<div style="overflow-x: auto; margin-bottom: 2rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
    <table style="width: 100%; border-collapse: collapse; text-align: left; background-color: rgba(255,255,255,0.02); min-width: 500px;">
        <thead>
            <tr style="background-color: rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.1);">
                <th style="padding: 1rem; color: var(--primary-color);">Poř.</th>
                <th style="padding: 1rem; color: var(--primary-color);">Jméno</th>
                <th style="padding: 1rem; color: var(--primary-color);">Klub</th>
                <th style="padding: 1rem; color: var(--primary-color); text-align: right;">Body</th>
            </tr>
        </thead>
        <tbody>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 1rem;">🥇 1.</td>
                <td style="padding: 1rem;"><strong>Antonín Duda</strong></td>
                <td style="padding: 1rem; color: var(--text-muted);">TJ Bižuterie Jablonec n.N.</td>
                <td style="padding: 1rem; text-align: right; font-weight: bold; color: #fff;">8,5</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 1rem;">🥈 2.</td>
                <td style="padding: 1rem;"><strong>Marek Sýkora</strong></td>
                <td style="padding: 1rem; color: var(--text-muted);">ŠK ZIKUDA Turnov</td>
                <td style="padding: 1rem; text-align: right; font-weight: bold; color: #fff;">8,0</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 1rem;">🥉 3.</td>
                <td style="padding: 1rem;"><strong>Martin Vašák</strong></td>
                <td style="padding: 1rem; color: var(--text-muted);">TJ Jiskra Tanvald</td>
                <td style="padding: 1rem; text-align: right; font-weight: bold; color: #fff;">7,5</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 1rem;">4.</td>
                <td style="padding: 1rem;">Jiří Jareš</td>
                <td style="padding: 1rem; color: var(--text-muted);">ŠK SLAVIA Liberec</td>
                <td style="padding: 1rem; text-align: right;">7,0</td>
            </tr>
            <tr>
                <td style="padding: 1rem;">5.</td>
                <td style="padding: 1rem;">Vladimír Vltavský</td>
                <td style="padding: 1rem; color: var(--text-muted);">ŠK ZIKUDA Turnov</td>
                <td style="padding: 1rem; text-align: right;">6,5</td>
            </tr>
        </tbody>
    </table>
</div>

<div style="text-align: center; margin-top: 2rem; margin-bottom: 2rem;">
    <a href="https://s3.chess-results.com/tnr1389644.aspx?lan=5&SNode=S0" target="_blank" class="btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; padding: 0.75rem 1.5rem; background-color: var(--primary-color); color: var(--secondary-color); font-weight: 600; border-radius: 4px; transition: opacity 0.3s;">
        <i class="fa-solid fa-square-up-right"></i> Kompletní výsledky na Chess-Results
    </a>
</div>
`.trim();

    // 5. Use first gallery image as thumbnail
    const thumbnailUrl = galleryUrls[0] || null;

    // 6. Insert article into news table
    const article = await prisma.news.create({
        data: {
            title: 'Jablonecké Velikonoční vejce 2026',
            slug: 'jablonecke-velikonocni-vejce-2026',
            category: 'turnaje',
            excerpt: 'Výsledky tradičního bleskového turnaje Jablonecké Velikonoční vejce 2026. Vítězem se stal Antonín Duda se ziskem 8,5 bodu z 10 kol.',
            content,
            thumbnailUrl,
            galleryJson,
            publishedDate: new Date('2026-04-09'),
            isPublished: true,
            authorName: 'Antonín Duda',
        }
    });

    console.log(`📰 Článek vytvořen! ID: ${article.id}, slug: ${article.slug}`);
    console.log(`🔗 URL: https://www.sachyjablonec.cz/article.html?id=${article.id}`);
    console.log(`📸 Galerie: ${galleryUrls.length} fotek`);
    console.log('\n🎉 Hotovo! Článek je publikován.');

    await prisma.$disconnect();
}

main().catch(e => {
    console.error('❌ Chyba:', e);
    prisma.$disconnect();
    process.exit(1);
});
