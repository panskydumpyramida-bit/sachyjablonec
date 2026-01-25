const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const results = {
    "U8-10": [
        { "rank": "8", "name": "Vojnová, Lola", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "5" },
        { "rank": "13", "name": "Tsantsala, Roman", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4" },
        { "rank": "16", "name": "Čermák, David", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4" },
        { "rank": "28", "name": "Votus, Maiia", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3" },
        { "rank": "29", "name": "Votus, Marta", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3" }
    ],
    "U12": [
        { "rank": "9", "name": "Bárta, Tobiáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4,5" },
        { "rank": "11", "name": "Malý, Jonáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4" },
        { "rank": "16", "name": "Šikola, Jakub", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4" },
        { "rank": "18", "name": "Bubeník, Martin", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4" },
        { "rank": "20", "name": "Yakym, Matvii", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3,5" },
        { "rank": "23", "name": "Bubeník, Jaroslav", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3" },
        { "rank": "24", "name": "Kosina, Filip", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3" },
        { "rank": "26", "name": "Paul, Matyáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3" },
        { "rank": "27", "name": "Žabka, Martin", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3" },
        { "rank": "32", "name": "Zasche, Theodor", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "2,5" },
        { "rank": "33", "name": "Novotný, Petr", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "2" },
        { "rank": "36", "name": "Bubeník, Václav", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "2" },
        { "rank": "38", "name": "Němcová, Anna", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "1,5" }
    ],
    "U14": [
        { "rank": "5", "name": "Sengrová, Žofie", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4,5" },
        { "rank": "7", "name": "Adámek, Lukáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4" },
        { "rank": "8", "name": "Busko, Nikita", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4" },
        { "rank": "10", "name": "Brehmová, Ema", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4" },
        { "rank": "11", "name": "Dražan, Jonáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4" },
        { "rank": "15", "name": "Ricka, Mikuláš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3" },
        { "rank": "16", "name": "Durda, Šimon", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3" },
        { "rank": "18", "name": "Koun, Bartoloměj", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "3" }
    ],
    "U16-18": [
        { "rank": "1", "name": "Červeň, Aleš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "6" },
        { "rank": "3", "name": "Mrlina, Tomáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "5" },
        { "rank": "4", "name": "Hádek, Vojtěch", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4,5" },
        { "rank": "6", "name": "Sengr, Ivan", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4" },
        { "rank": "13", "name": "Nekvinda, Jan", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "2" },
        { "rank": "14", "name": "Vedral, Zbyněk", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "2" }
    ],
    "Elite": [
        { "rank": "3", "name": "Tsantsala, Kostiantyn", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "4,5" },
        { "rank": "11", "name": "Chvátal, Jonáš", "club": "TJ Bižuterie Jablonec n.Nisou", "points": "1,5" }
    ]
};

function generateTable(data) {
    if (!data || data.length === 0) return '';

    let html = '<table class="results-table">';
    html += '<thead><tr><th>Poř.</th><th>Jméno</th><th>Body</th></tr></thead>';
    html += '<tbody>';

    data.forEach(player => {
        html += `<tr>
      <td>${player.rank}.</td>
      <td>${player.name}</td>
      <td><strong>${player.points}</strong></td>
    </tr>`;
    });

    html += '</tbody></table>';
    return html;
}

async function updateArticle() {
    try {
        const articleId = 75;

        let contentHtml = '<p>Proběhl turnaj O pohár ředitele školy ZŠ Broumovská. Zde jsou výsledky našich hráčů v jednotlivých kategoriích:</p>';

        // Generate Tab Buttons
        contentHtml += '<div class="results-tabs">';
        let isFirst = true;
        for (const category of Object.keys(results)) {
            const activeClass = isFirst ? ' active' : '';
            contentHtml += `<button class="results-tab-btn${activeClass}" data-tab="tab-${category}">${category}</button>`;
            isFirst = false;
        }
        contentHtml += '</div>';

        // Generate Content
        isFirst = true;
        for (const [category, players] of Object.entries(results)) {
            const activeClass = isFirst ? ' active' : '';
            contentHtml += `<div id="tab-${category}" class="results-category-content${activeClass}">`;
            contentHtml += `<h3 class="results-category-title">Kategorie ${category}</h3>`;
            contentHtml += generateTable(players);
            contentHtml += `</div>`;
            isFirst = false;
        }

        // Add link to full results
        contentHtml += '<div class="results-link"><a href="https://chess-results.com/tnr1333688.aspx?lan=5&art=0&SNode=S0" target="_blank" rel="noopener noreferrer" class="btn">Kompletní výsledky na Chess-Results</a></div>';

        const updatedNews = await prisma.news.upsert({
            where: { id: articleId },
            update: {
                content: contentHtml
            },
            create: {
                id: articleId,
                title: "O pohár ředitele školy ZŠ Broumovská - Výsledky", // Fallback title
                slug: "o-pohar-reditele-skoly-zs-broumovska-vysledky",
                category: "mladez", // Guessing category
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
