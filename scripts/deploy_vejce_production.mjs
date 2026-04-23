/**
 * Production deploy script: Velikonoční vejce 2026
 * - Logs into production API
 * - Uploads 38 photos via /api/images/upload
 * - Creates article with gallery JSON via /api/news
 * 
 * Run: node scripts/deploy_vejce_production.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROD_URL = 'https://www.sachyjablonec.cz/api';
const SOURCE_DIR = '/Users/antoninduda/Downloads/veli_blitz';

// Usage: PROD_PASS="heslo" node scripts/deploy_vejce_production.mjs
const USERNAME = process.env.PROD_USER || 'antonin';
const PASSWORD = process.env.PROD_PASS;

if (!PASSWORD) {
    console.error('❌ Zadej heslo: PROD_PASS="tvoje_heslo" node scripts/deploy_vejce_production.mjs');
    process.exit(1);
}

async function main() {
    console.log('🐣 Production deploy: Jablonecké Velikonoční vejce 2026\n');

    // 1. Login
    console.log('🔐 Přihlašuji se na produkci...');
    const loginRes = await fetch(`${PROD_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USERNAME, password: PASSWORD })
    });

    if (!loginRes.ok) {
        const err = await loginRes.text();
        throw new Error('Login failed: ' + err);
    }

    const { token } = await loginRes.json();
    console.log('✅ Přihlášen!\n');

    // 2. Upload photos
    const files = fs.readdirSync(SOURCE_DIR)
        .filter(f => f.endsWith('.jpeg') || f.endsWith('.jpg'))
        .sort();

    console.log('📸 Nahrávám ' + files.length + ' fotek na produkci...');

    const uploadedUrls = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = path.join(SOURCE_DIR, file);
        const buffer = fs.readFileSync(filePath);
        
        // Create FormData with the image
        const blob = new Blob([buffer], { type: 'image/jpeg' });
        const formData = new FormData();
        formData.append('image', blob, file);
        formData.append('category', 'velikonocni-vejce-2026');

        const uploadRes = await fetch(`${PROD_URL}/images/upload`, {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });

        if (uploadRes.ok) {
            const data = await uploadRes.json();
            uploadedUrls.push(data.url);
            process.stdout.write('  ✓ ' + (i + 1) + '/' + files.length + ' ' + file + ' → ' + data.url + '\r');
        } else {
            const err = await uploadRes.text();
            console.error('\n  ✗ ' + file + ': ' + err);
        }
    }

    console.log('\n✅ Nahráno ' + uploadedUrls.length + '/' + files.length + ' fotek.\n');

    if (uploadedUrls.length === 0) {
        throw new Error('Žádné fotky se nenahráli!');
    }

    // 3. Create article
    console.log('📰 Vytvářím článek...');

    const galleryJson = JSON.stringify(uploadedUrls);
    const thumbnailUrl = uploadedUrls[0];

    const content = `<!-- Report Section -->
<div style="max-width: 800px; margin: 0 auto 3rem;">
    <h2 style="color: var(--primary-color); font-family: 'Playfair Display', serif; margin-bottom: 1.5rem; line-height: 1.3;">
        Velikonoční vejce 2026: Duda ovládl tradiční bleskový turnaj
    </h2>
    <p style="font-size: 1.1rem; font-weight: 500; font-style: italic; color: #ccc; margin-bottom: 2rem; line-height: 1.6; border-left: 3px solid var(--primary-color); padding-left: 1rem;">
        Tradiční velikonoční bleskový turnaj přilákal do jabloneckého klubu 33 šachistů z celého regionu. Po deseti kolech napínavých partií slavil domácí <span class="highlight-name">Antonín Duda</span> se ziskem 8,5 bodu. Stříbrnou příčku obsadil turnovský <span class="highlight-name">Marek Sýkora</span> (8 bodů) a bronz si vybojoval tanvaldský <span class="highlight-name">Martin Vašák</span> (7,5 bodu).
    </p>
    <div style="line-height: 1.8; color: #ddd; font-size: 1rem;">
        <p style="margin-bottom: 1rem;">O Velikonocích jsme opět usedli k šachovnicím v rámci tradičního <strong>Jabloneckého Velikonočního vejce</strong>. Letošní ročník potvrdil oblibu tohoto svátečního klání – na start se postavilo 33 hráčů z celého Libereckého kraje i dalších regionů.</p>
        <p style="margin-bottom: 1rem;">Vítězem desetikolového turnaje se stal domácí <span class="highlight-name">Antonín Duda</span>, který ziskem <span class="highlight-score">8,5 bodu</span> z 10 kol potvrdil výbornou formu a suverénně ovládl konečné pořadí. Hned v závěsu za ním si stříbrnou pozici s <span class="highlight-score">8 body</span> vybojoval turnovský <span class="highlight-name">Marek Sýkora</span> z ŠK Zikuda. Pro skvělé třetí místo (<span class="highlight-score">7,5 bodu</span>) si nakonec došel tanvaldský <span class="highlight-name">Martin Vašák</span> z TJ Jiskry.</p>
        <p style="margin-bottom: 1rem;">Za zmínku stojí také výborný výkon libereckého <span class="highlight-name">Jiřího Jareše</span> na 4. místě a turnovského <span class="highlight-name">Vladimíra Vltavského</span> na 5. příčce. Pěkného umístění dosáhl i mladý <span class="highlight-name">Kostiantyn Tsantsala</span>, který potvrzuje svůj stoupající trend.</p>
        <p>Turnaj se tradičně odehrál ve velmi přátelské a pohodové sváteční atmosféře a přinesl nespočet bojovných partií i napínavých koncovek. Děkujeme všem za účast a parádní šachový prožitek!</p>
    </div>
</div>
<div style="margin: 2rem 0;">
    <h3 style="color: var(--primary-color); text-align: center; font-family: 'Playfair Display', serif; margin-bottom: 2rem; font-size: 1.8rem;">🏆 Stupně vítězů</h3>
    <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-end; gap: 0.5rem; max-width: 100%; margin-bottom: 3rem;">
        <div class="podium-card podium-silver" style="order: 1; flex: 1 1 0%; min-width: 0px; padding: 1.5rem 0.8rem; background: rgba(192, 192, 192, 0.1); border-radius: 12px; border-top: 4px solid rgb(192, 192, 192); display: flex; flex-direction: column; align-items: center; min-height: 280px; justify-content: space-between; transition: transform 0.2s, box-shadow 0.2s; cursor: default;" onmouseenter="this.style.transform='scale(1.03)'; this.style.boxShadow='0 8px 25px rgba(192,192,192,0.3)';" onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='none';">
            <div style="margin-bottom: auto; width: 100%; text-align: center;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">🥈</div>
                <div class="podium-name" style="font-size: 1.1rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem;">Marek Sýkora</div>
                <div style="font-size: 0.85rem; color: #888;">ŠK ZIKUDA Turnov</div>
            </div>
            <div style="margin-top: 1rem; font-weight: bold; color: #D4AF37; font-size: 1.5rem;">8</div>
        </div>
        <div class="podium-card podium-gold" style="order: 2; flex: 1.2 1 0%; min-width: 0px; padding: 2rem 0.8rem; background: rgba(212, 175, 55, 0.15); border-radius: 12px; border-top: 4px solid rgb(255, 215, 0); transform: translateY(-1rem); display: flex; flex-direction: column; align-items: center; box-shadow: rgba(212, 175, 55, 0.2) 0px 10px 30px; min-height: 300px; justify-content: space-between; transition: transform 0.2s, box-shadow 0.2s; cursor: default;" onmouseenter="this.style.transform='translateY(-1rem) scale(1.05)'; this.style.boxShadow='0 15px 40px rgba(212,175,55,0.4)';" onmouseleave="this.style.transform='translateY(-1rem)'; this.style.boxShadow='0 10px 30px rgba(212,175,55,0.2)';">
            <div style="margin-bottom: auto; width: 100%; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">🥇</div>
                <div class="podium-name" style="font-weight: bold; font-size: 1.3rem; color: #FFD700; margin-bottom: 0.5rem;">Antonín Duda</div>
                <div style="font-size: 0.85rem; color: #888;">TJ Bižuterie Jablonec n.N.</div>
            </div>
            <div style="margin-top: 1rem; font-weight: bold; color: #FFD700; font-size: 2rem;">8,5</div>
        </div>
        <div class="podium-card podium-bronze" style="order: 3; flex: 1 1 0%; min-width: 0px; padding: 1rem 0.5rem; background: rgba(205, 127, 50, 0.1); border-radius: 12px; border-top: 4px solid rgb(205, 127, 50); display: flex; flex-direction: column; align-items: center; min-height: 200px; justify-content: space-between; transition: transform 0.2s, box-shadow 0.2s; cursor: default;" onmouseenter="this.style.transform='scale(1.03)'; this.style.boxShadow='0 8px 25px rgba(205,127,50,0.3)';" onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='none';">
            <div style="margin-bottom: auto; width: 100%; text-align: center;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">🥉</div>
                <div class="podium-name" style="font-weight: bold; font-size: 1rem; color: #fff; margin-bottom: 0.5rem;">Martin Vašák</div>
                <div style="font-size: 0.8rem; color: #888;">TJ Jiskra Tanvald</div>
            </div>
            <div style="margin-top: 1rem; font-weight: bold; color: #D4AF37; font-size: 1.5rem;">7,5</div>
        </div>
    </div>
    <div style="margin-top: 3rem;">
        <details>
            <summary style="cursor: pointer; color: #D4AF37; font-family: 'Playfair Display', serif; font-size: 1.4rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(212,175,55,0.3); padding-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;">Celkové pořadí <i class="fa-solid fa-chevron-down" style="font-size: 1rem;"></i></summary>
            <div style="padding: 1rem; overflow-x: auto; background: rgba(255,255,255,0.03); border-radius: 8px;">
                <table id="resultsTable" style="width: 100%; border-collapse: collapse; color: #fff; min-width: 300px; font-size: 0.9rem;">
                    <thead><tr style="border-bottom: 1px solid #D4AF37; text-align: left;">
                        <th style="padding: 0.5rem; width: 50px; text-align: center;">Poř.</th>
                        <th style="padding: 0.5rem;">Jméno</th>
                        <th style="padding: 0.5rem; color: #aaa; text-align: center;">ELO</th>
                        <th style="padding: 0.5rem;">Klub</th>
                        <th style="padding: 0.5rem; text-align: right; width: 60px;">Body</th>
                    </tr></thead>
                    <tbody>${[
['1.','Duda, Antonín','1970','TJ Bižuterie Jablonec n.Nisou','8,5'],
['2.','Sýkora, Marek','2091','ŠK ZIKUDA Turnov, z.s.','8'],
['3.','Vašák, Martin','1789','TJ Jiskra Tanvald','7,5'],
['4.','Jareš, Jiří','2041','ŠK SLAVIA Liberec, z.s.','7'],
['5.','Vltavský, Vladimír','2018','ŠK ZIKUDA Turnov, z.s.','6,5'],
['6.','Tsantsala, Kostiantyn','1871','TJ Bižuterie Jablonec n.Nisou','6'],
['7.','Sivák, Lukáš','1682','TJ Bižuterie Jablonec n.Nisou','6'],
['8.','Joukl, Zdeněk','1843','TJ Jiskra Tanvald','6'],
['9.','Žamboch, Roman','2013','TJ KRALUPY, z.s.','6'],
['10.','Titěra, Libor','1855','TJ Bižuterie Jablonec n.Nisou','6'],
['11.','Sýkora, Ondřej','1994','ŠK ZIKUDA Turnov, z.s.','5,5'],
['12.','Zimovčák, Kryštof','1465','Šachový klub Frýdlant, z.s.','5,5'],
['13.','Podrazký, Radim','1707','TJ Bižuterie Jablonec n.Nisou','5,5'],
['14.','Křivánek, Jaroslav','1532','TJ Bižuterie Jablonec n.Nisou','5,5'],
['15.','Červeň, Aleš','1305','TJ Bižuterie Jablonec n.Nisou','5,5'],
['16.','Kobylka, Vojtěch','0','TJ Bižuterie Jablonec n.Nisou','5'],
['17.','Žídek, Miroslav','1755','TJ Bižuterie Jablonec n.Nisou','5'],
['18.','Hurt, Marek','1219','TJ Desko Liberec','5'],
['19.','Zadražil, Filip','1539','TJ Bižuterie Jablonec n.Nisou','5'],
['20.','Šikolová, Barbora','1231','TJ Bižuterie Jablonec n.Nisou','5'],
['21.','Šafránek, David','1646','DDM Praha 6','5'],
['22.','Ricka, Mikuláš','1039','TJ Bižuterie Jablonec n.Nisou','5'],
['23.','Sengr, Ivan','1097','TJ Bižuterie Jablonec n.Nisou','4,5'],
['24.','Adámek, Lukáš','1065','TJ Bižuterie Jablonec n.Nisou','4,5'],
['25.','Hádek, Vojtěch','1244','TJ Bižuterie Jablonec n.Nisou','4'],
['26.','Louda, Karel','1536','TJ Bižuterie Jablonec n.Nisou','4'],
['27.','Petržilková, Eliška','1074','TJ Bižuterie Jablonec n.Nisou','4'],
['28.','Trsek, Adam','0','ŠK ZIKUDA Turnov, z.s.','4'],
['29.','Trsek, Jan','0','ŠK ZIKUDA Turnov, z.s.','4'],
['30.','Dražan, Jonáš','0','','3'],
['31.','Šikola, Jakub','1040','TJ Bižuterie Jablonec n.Nisou','3'],
['32.','Vlaháč, Michal','0','','3'],
['33.','Tvrdíková, Veronika','0','','1'],
].map(([rank, name, elo, club, pts]) => {
    const isTop3 = rank.startsWith('1.') || rank.startsWith('2.') || rank.startsWith('3.');
    const rankColor = isTop3 ? '#D4AF37' : '#888';
    return '<tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">' +
        '<td style="padding: 0.5rem; text-align: center; font-weight: bold; color: ' + rankColor + ';">' + rank + '</td>' +
        '<td style="padding: 0.5rem; font-weight: 500;">' + name + '</td>' +
        '<td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">' + elo + '</td>' +
        '<td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">' + club + '</td>' +
        '<td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">' + pts + '</td></tr>';
}).join('')}
                    </tbody>
                </table>
            </div>
        </details>
        <style>
            .podium-name { word-wrap: break-word; overflow-wrap: break-word; hyphens: auto; max-width: 100%; }
            @media (max-width: 600px) {
                table td:nth-child(3), table th:nth-child(3), table td:nth-child(4), table th:nth-child(4) { display: none !important; }
                .podium-card { padding: 0.8rem 0.3rem !important; }
                .podium-name { font-size: 0.9rem !important; line-height: 1.2; }
            }
        </style>
    </div>
    <div style="margin-top: 2rem; text-align: center;">
        <a href="https://chess-results.com/tnr1389644.aspx?lan=5&amp;art=1&amp;rd=10" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #987619 100%); color: #000; padding: 0.8rem 2rem; text-decoration: none; border-radius: 8px; font-weight: bold; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(212,175,55,0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">Otevřít na Chess-Results <i class="fa-solid fa-external-link-alt" style="margin-left: 0.5rem;"></i></a>
    </div>
</div>`;

    const articleRes = await fetch(`${PROD_URL}/news`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
            title: 'Jablonecké Velikonoční vejce 2026',
            slug: 'jablonecke-velikonocni-vejce-2026',
            category: 'turnaje',
            excerpt: 'Výsledky tradičního bleskového turnaje Jablonecké Velikonoční vejce 2026. Vítězem se stal Antonín Duda se ziskem 8,5 bodu z 10 kol.',
            content,
            thumbnailUrl,
            galleryJson,
            publishedDate: new Date('2026-04-09').toISOString(),
            isPublished: true,
            authorName: 'Antonín Duda'
        })
    });

    if (!articleRes.ok) {
        const err = await articleRes.text();
        throw new Error('Article creation failed: ' + err);
    }

    const article = await articleRes.json();
    console.log('✅ Článek vytvořen! ID: ' + (article.id || article.news?.id || 'OK'));
    console.log('🔗 URL: https://www.sachyjablonec.cz/article.html?id=' + (article.id || article.news?.id));
    console.log('📸 Galerie: ' + uploadedUrls.length + ' fotek');
    console.log('\n🎉 Vše hotovo na produkci!');
}

main().catch(e => {
    console.error('❌ Chyba:', e.message || e);
    process.exit(1);
});
