import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inserting news article for 2026 tournaments...');

    const title = 'Šachový rok 2026: Nové turnaje a vylepšený kalendář';
    const slug = 'sachovy-rok-2026-nove-turnaje';

    // Check if exists
    const existing = await prisma.news.findFirst({
        where: { slug: slug }
    });

    // Article Content
    const content = `
<h3>Vítejte v novém šachovém roce 2026!</h3>
<p>Připravili jsme pro vás aktualizovaný kalendář s řadou zajímavých turnajů pro mládež i dospělé na první polovinu roku. Všechny akce nyní najdete přehledně seřazené v sekci <strong>Turnaje</strong> a v <strong>Kalendáři</strong>.</p>

<h4>📅 Jaké turnaje jsme přidali?</h4>
<ul>
    <li><strong>Josefův Důl (9. 1.):</strong> Okresní přebor družstev ml. žáků.</li>
    <li><strong>OPEN PRAHA (od 9. 1.):</strong> Prestižní série turnajů v Hotelu Olympik (klasický, rapid i blesk).</li>
    <li><strong>Varnsdorf (30. 1.):</strong> Pololetní turnaj mládeže.</li>
    <li><strong>Bakov (31. 1.):</strong> Oblíbený turnaj dvojic.</li>
    <li><strong>PORG Open (Leden–Květen):</strong> Kompletní série mládežnických turnajů v Praze.</li>
</ul>

<h4>🚀 Váš osobní šachový navigátor</h4>
<p>Náš web dostal do nového roku pořádný upgrade! Už nemusíte složitě googlit, kde leží ta či ona sokolovna:</p>
<ul>
    <li><strong>📌 Kde to sakra je?</strong> Mrkněte na interaktivní mapu přímo v detailu turnaje.</li>
    <li><strong>🚗 Jak je to daleko?</strong> Spočítali jsme to za vás. Vzdušnou čarou z Jablonce – ať víte, jestli stačí kolo, nebo startovat auto.</li>
    <li><strong>🔔 Nezmeškejte start:</strong> Jedním kliknutím si turnaj pošlete do svého Google kalendáře. Organizace času nikdy nebyla snazší.</li>
</ul>

<h4>🕵️‍♂️ Staňte se naším skautem!</h4>
<p>Kalendář tvoříme pro vás, ale bez vás to nejde. Víte o kvalitním turnaji, který nám proklouzl pod radarem? <strong>Nenechávejte si to pro sebe!</strong></p>
<p>Napište nám tip dolů 👇 <strong>do diskuze</strong>, nebo pošlete odkaz na <a href="mailto:info@sachyjablonec.cz">info@sachyjablonec.cz</a>. Rádi ho přidáme, ať o něm ví i ostatní.</p>

<p>Přejeme hodně štěstí a správných tahů v roce 2026!</p>
    `.trim();

    const excerpt = 'Přidali jsme do kalendáře nové turnaje na rok 2026 (Josefův Důl, Praha, Varnsdorf, Bakov) a vylepšili mapové funkce. Podívejte se, co nás čeká!';

    if (existing) {
        console.log('Article exists, updating content...');
        await prisma.news.update({
            where: { id: existing.id },
            data: {
                content: content,
                excerpt: excerpt
            }
        });
        console.log(`Article updated: ${title}`);
    } else {
        const article = await prisma.news.create({
            data: {
                title: title,
                slug: slug,
                category: 'O nás',
                excerpt: excerpt,
                content: content,
                publishedDate: new Date(),
                isPublished: true,
                authorName: 'Admin Tým',
                thumbnailUrl: '/images/pf2026.jpg'
            }
        });
        console.log(`Article created: ${article.title} (ID: ${article.id})`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
