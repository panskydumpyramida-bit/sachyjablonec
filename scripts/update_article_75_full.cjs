
const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

// URLs for each category
const categories = [
    { name: 'U8-10', url: 'https://chess-results.com/tnr1333688.aspx?lan=5&art=1' },
    { name: 'U12', url: 'https://chess-results.com/tnr1333689.aspx?lan=5&art=1' },
    { name: 'U14', url: 'https://chess-results.com/tnr1334536.aspx?lan=5&art=1' },
    { name: 'U16-18', url: 'https://chess-results.com/tnr1333690.aspx?lan=5&art=1' },
    { name: 'Elite', url: 'https://chess-results.com/tnr1333694.aspx?lan=5&art=1' }
];

async function scrapeCategory(category) {
    console.log(`Scraping ${category.name}...`);
    try {
        const response = await fetch(category.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();
        const dom = new JSDOM(html);
        const doc = dom.window.document;

        const table = doc.querySelector('.CRs1');
        if (!table) return [];

        const rows = Array.from(table.querySelectorAll('tr')).slice(1);

        const players = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 5) return;

            const rankText = cells[0].textContent.trim();
            const rank = parseInt(rankText);

            if (isNaN(rank)) return;

            // Hardcoded indices for art=1 (Start list with results)
            const nameIndex = 3;
            const clubIndex = 6;
            const pointsIndex = 7;

            let name = cells[nameIndex] ? cells[nameIndex].textContent.trim() : "";
            let rawClub = cells[clubIndex] ? cells[clubIndex].textContent.trim() : "";
            let points = cells[pointsIndex] ? cells[pointsIndex].textContent.trim() : "0";

            let displayTeam = rawClub;
            if (rawClub.includes('Bižuterie') || rawClub.includes('Jablonec')) {
                displayTeam = '<strong>TJ Bižuterie</strong>';
            } else {
                displayTeam = rawClub.replace('ŠK ', '').replace('TJ ', '').replace('Sokol ', '');
            }

            players.push({
                rank: rank,
                name: name,
                team: displayTeam,
                clubOriginal: rawClub,
                points: points
            });
        });

        const top3 = players.filter(p => p.rank <= 3);
        const bizuterie = players.filter(p => p.clubOriginal.includes('Bižuterie') || p.clubOriginal.includes('Bižu'));

        const map = new Map();
        [...top3, ...bizuterie].forEach(p => map.set(p.rank + p.name, p));

        const finalPlayers = Array.from(map.values()).sort((a, b) => a.rank - b.rank);

        return finalPlayers;

    } catch (e) {
        console.error(`Error scraping ${category.name}:`, e);
        return [];
    }
}

async function generateTableHtml(categoryName, players) {
    let rows = players.map(p => {
        const isBizuterie = p.clubOriginal.includes('Bižuterie') || p.clubOriginal.includes('Bižu');

        // CLASSIC STYLES RESTORED
        // Bizuterie: Gold Name, Subtle Blue Bg (Dark Theme Friendly)
        const nameStyle = isBizuterie ? 'color: #ffca28; font-weight: bold;' : '';
        const rowStyle = isBizuterie ? 'background-color: rgba(59, 130, 246, 0.15); border-left: 2px solid #2563eb;' : 'border-bottom: 1px solid #333;';

        return `
            <tr style="${rowStyle}">
                <td style="padding: 8px; text-align: center; color: #aaa;">${p.rank}.</td>
                <td style="padding: 8px; ${nameStyle}">${p.name}</td>
                <td style="padding: 8px; font-size: 0.9em; color: #aaa;">${p.team}</td>
                <td style="padding: 8px; text-align: center;"><strong>${p.points}</strong></td>
            </tr>
        `;
    }).join('');

    return `
        <div id="tab-${categoryName}" class="results-category-content">
            <h3 class="results-category-title" style="color: #d4af37; margin-bottom: 1rem;">Kategorie ${categoryName}</h3>
            <table class="results-table" style="width: 100%; border-collapse: collapse; font-size: 0.95rem;">
                <thead>
                    <tr style="background: rgba(255,255,255,0.05);">
                        <th style="padding: 8px; text-align: center; color: #888; font-size: 0.85rem;">Poř.</th>
                        <th style="padding: 8px; text-align: left; color: #888; font-size: 0.85rem;">Jméno</th>
                        <th style="padding: 8px; text-align: left; color: #888; font-size: 0.85rem;">Oddíl</th>
                        <th style="padding: 8px; text-align: center; color: #888; font-size: 0.85rem;">Body</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

async function main() {

    // Inject CSS for Layout
    const styleBlock = `
    <style>
        .article-container {
            display: flex;
            flex-direction: column;
            gap: 2rem;
        }
        @media (min-width: 1024px) {
            .article-container {
                flex-direction: row;
                align-items: flex-start;
            }
            .article-text {
                flex: 1;
                padding-right: 2rem;
            }
            .article-results {
                flex: 1;
                min-width: 0;
            }
        }
        
        /* Tab Buttons - Classic Dark */
        .results-tab-btn {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: #ccc;
            padding: 0.5rem 1rem;
            cursor: pointer;
            border-radius: 4px;
            font-weight: 500;
            transition: all 0.2s;
        }
        .results-tab-btn:hover {
            background: rgba(255,255,255,0.1);
            color: #fff;
        }
        .results-tab-btn.active {
            background: rgba(255,255,255,0.15);
            color: #d4af37; /* Gold accent */
            border-color: #d4af37;
        }
        
        /* Animation */
        .results-category-content {
            display: none;
            animation: fadeIn 0.3s ease-in-out;
        }
        .results-category-content.active {
            display: block;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
    `;

    // 1. Text Content (Light gray text enabled for readability)
    const textHtml = `
    <div class="article-text">
        <p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 1.6; color: #e5e7eb;">V sobotu 17. ledna 2026 se v prostorách Základní školy Broumovská v Liberci uskutečnil tradiční šachový turnaj O pohár ředitele ZŠ Broumovská. Přilákal mladé talenty z celého šachového severu.</p>
        <p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 1.6; color: #e5e7eb;">Sedmikolový turnaj se hrál standardním rapidovým tempem 2x15 minut na partii s přídavkem 5 sekund na tah. Turnaje se zúčastnilo 125 hráčů především z Libereckého kraje. Účastníky ale byli i šachisté a šachistky z jiných krajů.</p>
        <p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 1.6; color: #e5e7eb;">V kategorii U8-10 soutěžily čtyři desítky nejmladších účastníků, mezi nimi sedm z našeho oddílu. Mezi chlapci si výborně vedli v absolutním pořadí třináctý <strong>Roman Tsantsala</strong> a patnáctý <strong>David Čermák</strong>, oba se 4 body. <strong>Roman Tsantsala</strong> získal skvělé zlato v kategorii osmiletých chlapců. Premiéru na tomto turnaji měly dvě sourozenecké dvojice: Maiia a <strong>Marta Votus</strong> získaly po 3 body, bodovali i Eduard a Čeněk Arnoštovi. Nejúspěšnější účastnicí v této kategorii byla <strong>Lola Vojnová</strong>, která s 5 body vyhrála kategorii desetiletých dívek, když se o prvenství přetahovala až do posledního kola s Terezií Pospíšilovou z turnovské Zikudy. Celkovým vítězem se stal Munkhduuren Enkhbaatar z TJ Lázně Bělohrad.</p>
        <p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 1.6; color: #e5e7eb;">Téměř stejně hojný počet účastníků (39) měla soutěžní kategorie U12, patnáct z nich tvořili hráči našeho oddílu. Z chlapců se nejlépe, na 9. místě, umístil <strong>Tobiáš Bárta</strong> se 4,5 body, do druhé desítky také zamířili čtyřbodoví Jonáš Malý, Jakub Šikola a Martin Bubeník. Vítězem v této věkové skupině se stal českolipský Michael Marcinkovskij.</p>
        <p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 1.6; color: #e5e7eb;">V kategorii U14 se utkalo se utkalo více než dvacítka šachistů, z toho polovina v barvách Bižuterie. Dívky byly lepší chlapců. V absolutním pořadí obsadila pěkné 5. místo Žofie Sengrová (4,5 bodů), která těsně vyhrála kategorii dívek před Emou Brehmovou (4 body). V první desítce byli rovněž na 7. místě Lukáš Adámek a na 8. místě Nikita Busko, oba se 4 body. V kategorii zvítězil Jonáš Roubíček z ŠK Zikuda Turnov.</p>
        <p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 1.6; color: #e5e7eb;">Ve spojené kategorii šachistů od šestnácti do osmnácti let (U16-18) soutěžila pětice hráčů Bižuterie. V kategorii H16 turnaj skončil velkým úspěchem našeho oddílu, když 1. místo obsadil <strong>Aleš Červeň</strong> (6. bodů, 1. celkově), stříbro bral <strong>Tomáš Mrlina</strong> (5 bodů, 3. celkově) a bronz <strong>Vojtěch Hádek</strong> (4,5 bodu, 4. celkově). Šestý v celkovém pořadí byl také Ivan Sengr (4 body).</p>
        <p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 1.6; color: #e5e7eb;">V kategorii Elite jsme měli dvě želízka v ohni. Mezi dvanáctkou hráčů s nejvyšším ratingem na turnaji se na bronzovou příčku prosadil <strong>Kosťa Tsantsala</strong> (celkově 4,5 bodu), když po zaváháních v první části turnaje předvedl výborný finiš (2,5 bodu ze 3). Druhý zástupce našeho oddílu, Jonáš Chvátal, získal 1,5 bodu. Celkovým vítězem kategorie se stal Václav Bělaška z TJ Desko Liberec.</p>
        <p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 1.6; color: #e5e7eb;">Blahopřejeme našim dětem za dosažené úspěchy v jednotlivých kategoriích libereckého turnaje.</p>
        <p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 1.6; color: #e5e7eb;">Organizátorům patří poděkování za hladký průběh celého turnaje a přátelské šachové prostředí. ZŠ Broumovská opět potvrdila, že podporuje nejen vzdělávání, ale také smysluplné trávení volného času dětí na čtyřiašedesáti černobílých polích.</p>
    </div>
    `;

    // 2. Generate Tables
    let tablesHtml = `<div class="article-results"><div class="article-results-tabs-wrapper"><div class="results-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">`;

    // Generate tabs header
    categories.forEach((cat, index) => {
        const active = index === 0 ? 'active' : '';
        tablesHtml += `<button class="results-tab-btn ${active}" data-tab="tab-${cat.name}">${cat.name}</button>`;
    });
    tablesHtml += `</div></div>`;

    // Generate content
    for (const cat of categories) {
        const players = await scrapeCategory(cat);
        const html = await generateTableHtml(cat.name, players);

        let content = html;
        if (cat.name === 'U8-10') {
            content = content.replace('class="results-category-content"', 'class="results-category-content active"');
        }
        tablesHtml += content;
    }

    // Footer link
    tablesHtml += `
    <div class="results-link" style="margin-top: 2rem; text-align: center;">
        <a href="https://chess-results.com/tnr1333688.aspx?lan=5&art=1" target="_blank" rel="noopener noreferrer" class="btn" style="display: inline-block; padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #d4af37, #b8941f); color: #000; font-weight: 600; text-decoration: none; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: background 0.2s;">
            Kompletní výsledky na Chess-Results
        </a>
    </div></div>`;

    // 3. Combine in Container
    const fullHtml = `
    ${styleBlock}
    <div class="article-container">
        ${textHtml}
        ${tablesHtml}
    </div>
    `;

    console.log(fullHtml);

    // Write to file for easy copy/import
    fs.writeFileSync('generated_table.html', fullHtml);
}

main();
