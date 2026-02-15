const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const results = {
    "U8-10": [
        { "rank": 1, "name": "Enkhbaatar, Munkhduuren", "club": "TJ Lázně Bělohrad z.s.", "points": "7.0" },
        { "rank": 2, "name": "Žabka, Jiří", "club": "TJ Desko Liberec", "points": "5.5" },
        { "rank": 3, "name": "Buchta, Marek", "club": "ŠK ZIKUDA Turnov, z.s.", "points": "5.5" },
        { "rank": 8, "name": "Vojnová, Lola", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "5.0" },
        { "rank": 13, "name": "Tsantsala, Roman", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.0" },
        { "rank": 16, "name": "Čermák, David", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.0" },
        { "rank": 28, "name": "Votus, Maiia", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3.0" },
        { "rank": 29, "name": "Votus, Marta", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3.0" }
    ],
    "U12": [
        { "rank": 1, "name": "Marcinkovskij, Michael", "club": "ŠK Česká Lípa", "points": "6.0" },
        { "rank": 2, "name": "Jihlavec, Petr", "club": "ŠK ZIKUDA Turnov, z.s.", "points": "6.0" },
        { "rank": 3, "name": "Dorchynets, Mykhaylo", "club": "ŠK ZIKUDA Turnov, z.s.", "points": "5.5" },
        { "rank": 9, "name": "Bárta, Tobiáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.5" },
        { "rank": 11, "name": "Malý, Jonáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.0" },
        { "rank": 16, "name": "Šikola, Jakub", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.0" },
        { "rank": 18, "name": "Bubeník, Martin", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.0" },
        { "rank": 20, "name": "Yakym, Matvii", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3.5" },
        { "rank": 23, "name": "Bubeník, Jaroslav", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3.0" },
        { "rank": 24, "name": "Kosina, Filip", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3.0" },
        { "rank": 26, "name": "Paul, Matyáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3.0" },
        { "rank": 27, "name": "Žabka, Martin", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3.0" },
        { "rank": 32, "name": "Zasche, Theodor", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "2.5" },
        { "rank": 33, "name": "Novotný, Petr", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "2.0" },
        { "rank": 36, "name": "Bubeník, Václav", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "2.0" },
        { "rank": 38, "name": "Němcová, Anna", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "1.5" }
    ],
    "U14": [
        { "rank": 1, "name": "Roubíček, Jonáš", "club": "ŠK ZIKUDA Turnov, z.s.", "points": "7.0" },
        { "rank": 2, "name": "Král, Michal", "club": "ŠK ZIKUDA Turnov, z.s.", "points": "5.0" },
        { "rank": 3, "name": "Bondarenko, Dmytro", "club": "ŠK ZIKUDA Turnov, z.s.", "points": "5.0" },
        { "rank": 5, "name": "Sengrová, Žofie", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.5" },
        { "rank": 7, "name": "Adámek, Lukáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.0" },
        { "rank": 8, "name": "Busko, Nikita", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.0" },
        { "rank": 10, "name": "Brehmová, Ema", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.0" },
        { "rank": 11, "name": "Dražan, Jonáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.0" },
        { "rank": 15, "name": "Ricka, Mikuláš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3.0" },
        { "rank": 16, "name": "Durda, Šimon", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3.0" },
        { "rank": 18, "name": "Koun, Bartoloměj", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3.0" }
    ],
    "U16-18": [
        { "rank": 1, "name": "Červeň, Aleš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "6.0" },
        { "rank": 2, "name": "Vacek, Ondřej", "club": "TJ Slovan Varnsdorf z.s.", "points": "5.5" },
        { "rank": 3, "name": "Mrlina, Tomáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "5.0" },
        { "rank": 4, "name": "Hádek, Vojtěch", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.5" },
        { "rank": 6, "name": "Sengr, Ivan", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.0" }
    ],
    "Elite": [
        { "rank": 1, "name": "Bělaška, Václav", "club": "TJ Desko Liberec", "points": "6.0" },
        { "rank": 2, "name": "Mauder, Karel", "club": "TJ Desko Liberec", "points": "5.0" },
        { "rank": 3, "name": "Tsantsala, Kostiantyn", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4.5" },
        { "rank": 11, "name": "Chvátal, Jonáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "1.5" }
    ]
};

function generateTable(data) {
    if (!data || data.length === 0) return '';

    let html = '<table class="results-table">';
    html += '<thead><tr><th class="col-narrow">Poř.</th><th>Jméno</th><th>Oddíl</th><th>Body</th></tr></thead>';
    html += '<tbody>';

    data.forEach(player => {
        // Determine if player matches "Bižuterie" (case insensitive)
        const isBizuterie = player.club.toLowerCase().includes('bižuterie');
        const rowClass = isBizuterie ? ' class="bizuterie-player"' : '';

        // Shorten Club Name
        let clubName = player.club;
        if (clubName.includes("Bižuterie")) clubName = "TJ Bižuterie";
        else if (clubName.includes("Liberec")) clubName = "Desko Liberec";
        else if (clubName.includes("Turnov")) clubName = "Zikuda Turnov";
        else if (clubName.includes("Lípa")) clubName = "ŠK Česká Lípa";
        else if (clubName.includes("Varnsdorf")) clubName = "Slovan Varnsdorf";
        else if (clubName.includes("Bělohrad")) clubName = "Lázně Bělohrad";

        html += `<tr${rowClass}>
      <td>${player.rank}.</td>
      <td>${player.name}</td>
      <td class="club-cell">${clubName}</td>
      <td><strong>${player.points}</strong></td>
    </tr>`;
    });

    html += '</tbody></table>';
    return html;
}

async function updateArticle() {
    try {
        const articleId = 75;

        // User Provided Text
        const userText = `
<p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 18.4px;">V sobotu 17. ledna 2026 se v prostorách Základní školy Broumovská v Liberci uskutečnil tradiční šachový turnaj O pohár ředitele ZŠ Broumovská. Přilákal mladé talenty z celého šachového severu.&nbsp;<o:p></o:p></p><p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 18.4px;">Sedmikolový turnaj se hrál standardním rapidovým tempem 2x15 minut na partii s&nbsp;přídavkem 5 sekund na&nbsp;tah. Turnaje se zúčastnilo 125 hráčů především z&nbsp;Libereckého kraje. Účastníky ale byli i&nbsp;šachisté a šachistky z&nbsp;jiných krajů.<o:p></o:p></p><p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 18.4px;">V&nbsp;kategorii U8-10 soutěžily čtyři desítky nejmladších účastníků, mezi nimi sedm z&nbsp;našeho oddílu. Mezi chlapci si výborně vedli v&nbsp;absolutním pořadí třináctý <span class="highlight-name">Roman Tsantsala</span> a patnáctý <span class="highlight-name">David Čermák</span>, oba se 4 body. <span class="highlight-name">Roman Tsantsala</span> získal skvělé zlato v&nbsp;kategorii osmiletých chlapců. Premiéru na tomto turnaji měly dvě sourozenecké dvojice: Maiia a <span class="highlight-name">Marta Votus</span> získaly po 3 body, bodovali i Eduard a Čeněk Arnoštovi. Nejúspěšnější účastnicí v&nbsp;této kategorii byla <span class="highlight-name">Lola Vojnov</span>á, která s&nbsp;5 body vyhrála kategorii desetiletých dívek, když se o prvenství přetahovala až do posledního kola s&nbsp;<span class="highlight-name">Terezií Pospíšilovou</span> z&nbsp;turnovské Zikudy. Celkovým vítězem se stal <span class="highlight-name">Munkhduuren Enkhbaatar</span> z&nbsp;TJ&nbsp;<span class="highlight-name">Lázně Bělohrad</span>.<o:p></o:p></p><p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 18.4px;">Téměř stejně hojný počet účastníků (39) měla soutěžní kategorie U12, patnáct z&nbsp;nich tvořili hráči našeho oddílu. Z&nbsp;chlapců se nejlépe, na 9. místě, umístil <span class="highlight-name">Tobiáš Bárta</span> se 4,5&nbsp;body, do druhé desítky také zamířili čtyřbodoví <span class="highlight-name">Jonáš Mal</span>ý, <span class="highlight-name">Jakub Šikola</span> a <span class="highlight-name">Martin Bubeník</span>. Vítězem v&nbsp;této věkové skupině se stal českolipský <span class="highlight-name">Michael Marcinkovskij</span>.<o:p></o:p></p><p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 18.4px;">&nbsp;V&nbsp;kategorii U14 se utkalo se utkalo více než dvacítka šachistů, z&nbsp;toho polovina v&nbsp;barvách Bižuterie. Dívky byly lepší chlapců. V&nbsp;absolutním pořadí obsadila pěkné 5. místo Žofie Sengrová (4,5 bodů), která těsně vyhrála kategorii dívek před <span class="highlight-name">Emou Brehmovou</span> (4 body). V&nbsp;první desítce byli rovněž na 7. místě <span class="highlight-name">Lukáš Adámek</span> a na 8. místě <span class="highlight-name">Nikita Busko</span>, oba se&nbsp;4&nbsp;body. V&nbsp;kategorii zvítězil <span class="highlight-name">Jonáš Roubíček</span> z&nbsp;ŠK <span class="highlight-name">Zikuda Turnov</span>.<o:p></o:p></p><p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 18.4px;">Ve spojené kategorii šachistů od šestnácti do osmnácti let (U16-18) soutěžila pětice hráčů Bižuterie. V&nbsp;kategorii H16 turnaj skončil velkým úspěchem našeho oddílu, když&nbsp;1.&nbsp;místo obsadil <span class="highlight-name">Aleš Červe</span>ň (6. bodů, 1. celkově), stříbro bral <span class="highlight-name">Tomáš Mrlina</span> (5&nbsp;bodů, 3. celkově) a bronz <span class="highlight-name">Vojtěch Hádek</span> (4,5 bodu, 4. celkově). Šestý v&nbsp;celkovém pořadí byl také <span class="highlight-name">Ivan Sengr</span> (4 body).<o:p></o:p></p><p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 18.4px;">V&nbsp;kategorii Elite jsme měli dvě želízka v&nbsp;ohni. Mezi dvanáctkou hráčů s&nbsp;nejvyšším ratingem na turnaji se na bronzovou příčku prosadil <span class="highlight-name">Kosťa Tsantsala</span> (celkově 4,5 bodu), když po&nbsp;zaváháních v&nbsp;první části turnaje předvedl výborný finiš (2,5 bodu ze 3). Druhý zástupce našeho oddílu, <span class="highlight-name">Jonáš Chvátal</span>, získal 1,5 bodu. Celkovým vítězem kategorie se stal <span class="highlight-name">Václav Bělaška</span> z&nbsp;TJ <span class="highlight-name">Desko Liberec</span>.<o:p></o:p></p><p class="MsoNormal" style="margin: 0cm 0cm 8pt; line-height: 18.4px;">Blahopřejeme našim dětem za dosažené úspěchy v&nbsp;jednotlivých kategoriích libereckého turnaje.<o:p></o:p></p><span style="line-height: 18.4px;">Organizátorům patří poděkování za hladký průběh celého turnaje a přátelské šachové prostředí. ZŠ&nbsp;Broumovská opět potvrdila, že podporuje nejen vzdělávání, ale také smysluplné trávení volného času dětí na čtyřiašedesáti černobílých polích.</span><span style="caret-color: rgb(0, 0, 0); color: rgb(0, 0, 0); font-family: -webkit-standard;"></span><br>
    `;

        // Construct Layout
        let contentHtml = '<div class="article-container">';

        // Left side: Text
        contentHtml += `<div class="article-text">${userText}</div>`;

        // Right side: Tables (Tabbed)
        contentHtml += '<div class="article-results">';

        // Generate Tab Buttons
        contentHtml += '<div class="article-results-tabs-wrapper"><div class="results-tabs">';
        let first = true;
        for (const category of Object.keys(results)) {
            const activeClass = first ? ' active' : '';
            const catId = category.replace(/[^a-zA-Z0-9]/g, '');
            contentHtml += `<button class="results-tab-btn${activeClass}" data-tab="cat-${catId}">Kategorie ${category}</button>`;
            first = false;
        }
        contentHtml += '</div></div>';

        // Generate Tab Content
        first = true;
        for (const [category, players] of Object.entries(results)) {
            const activeClass = first ? ' active' : '';
            const catId = category.replace(/[^a-zA-Z0-9]/g, '');

            contentHtml += `<div id="cat-${catId}" class="results-category-content${activeClass}">`;
            contentHtml += generateTable(players);
            contentHtml += '</div>';
            first = false;
        }

        // Add link to full results
        contentHtml += '<div class="results-link"><a href="https://chess-results.com/tnr1333688.aspx?lan=5&art=0&SNode=S0" target="_blank" rel="noopener noreferrer" class="btn">Kompletní výsledky na Chess-Results</a></div>';

        contentHtml += '</div>'; // End article-results
        contentHtml += '</div>'; // End article-container

        const updatedNews = await prisma.news.upsert({
            where: { id: articleId },
            update: {
                content: contentHtml
            },
            create: {
                id: articleId,
                title: "O pohár ředitele školy ZŠ Broumovská - Výsledky", // Fallback title
                slug: "o-pohar-reditele-skoly-zs-broumovska-vysledky",
                category: "mladez",
                excerpt: "Výsledky našich hráčů z turnaje O pohár ředitele školy ZŠ Broumovská.",
                content: contentHtml,
                publishedDate: new Date(),
                isPublished: true
            }
        });

        console.log(`Updated article ${articleId} successfully.`);
        console.log('New content length:', contentHtml.length);

    } catch (error) {
        console.error('Error updating article:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateArticle();
