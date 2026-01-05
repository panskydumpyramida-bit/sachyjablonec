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

<h4>🗺️ Novinky na webu</h4>
<p>Pro lepší orientaci jsme vylepšili zobrazení turnajů:</p>
<ul>
    <li><strong>Interaktivní mapa:</strong> U každého turnaje nyní vidíte přesnou polohu.</li>
    <li><strong>Vzdálenost:</strong> Web automaticky počítá vzdušnou vzdálenost od Jablonce, abyste věděli, jak daleko to máte.</li>
    <li><strong>Google Kalendář:</strong> Jedním kliknutím si můžete akci přidat do svého kalendáře.</li>
</ul>

<h4>✍️ Chybí nám nějaký turnaj?</h4>
<p>Pokud víte o zajímavém turnaji, který by v našem kalendáři neměl chybět, dejte nám vědět! Napište nám propozice nebo odkaz na email <a href="mailto:info@sachyjablonec.cz">info@sachyjablonec.cz</a>, případně <strong>napište do diskuze pod tímto článkem</strong>, a my ho rádi přidáme.</p>

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
