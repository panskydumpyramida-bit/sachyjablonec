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
<p>Připravili jsme pro vás aktualizovaný kalendář s řadou zajímavých turnajů pro mládež i dospělé na první polovinu roku. Všechny akce nyní najdete v hlavním menu v sekci <strong>Kalendář</strong> (podsekce <strong>Turnaje</strong>).</p>

<h4>📅 Jaké turnaje jsme přidali?</h4>

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
    
    <!-- Region -->
    <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
        <h5 style="margin-top: 0; color: #4ade80; font-size: 1.1rem;"><i class="fa-solid fa-house-chimney"></i> Regionální akce</h5>
        <ul style="padding-left: 0; list-style: none;">
            <li style="margin-bottom: 0.8rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                <span><strong>Josefův Důl</strong></span> <span style="color: #94a3b8;">9. 1.</span>
            </li>
            <li style="margin-bottom: 0.8rem; padding-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                <span><strong>Varnsdorf</strong></span> <span style="color: #94a3b8;">30. 1.</span>
            </li>
            <li style="display: flex; justify-content: space-between;">
                <span><strong>Bakov</strong></span> <span style="color: #94a3b8;">31. 1.</span>
            </li>
        </ul>
    </div>

    <!-- Prague -->
    <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
        <h5 style="margin-top: 0; color: #facc15; font-size: 1.1rem;"><i class="fa-solid fa-train-subway"></i> Pražské výpravy</h5>
        <ul style="padding-left: 0; list-style: none;">
            <li style="margin-bottom: 0.8rem;">
                <div style="display: flex; justify-content: space-between;">
                    <strong>OPEN PRAHA</strong> <span style="color: #94a3b8;">od 9. 1.</span>
                </div>
                <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.2rem;">Hotel Olympik (klasický, rapid i blesk)</div>
            </li>
            <li style="margin-top: 1rem;">
                <div style="display: flex; justify-content: space-between;">
                    <strong>PORG Open</strong> <span style="color: #94a3b8;">Leden-Květen</span>
                </div>
                <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.2rem;">Série mládežnických turnajů</div>
            </li>
        </ul>
    </div>
</div>

<div style="background: linear-gradient(145deg, rgba(212, 175, 55, 0.1), rgba(0,0,0,0)); padding: 2rem; border-radius: 12px; border: 1px solid rgba(212, 175, 55, 0.2);">
    <h4 style="margin-top: 0; color: #ffd700;"><i class="fa-solid fa-chess-board"></i> Chcete si zahrát, ale nevíte kde?</h4>
    <p style="margin-bottom: 1.5rem;">Máte chuť zasednout za skutečnou šachovnici, ale ztrácíte se v tom, co se kde hraje? Přesně pro vás jsme to dali dohromady. Už žádné složité hledání po mailech – všechno máte tady:</p>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div style="display: flex; gap: 1rem; align-items: start;">
            <div style="background: rgba(255,255,255,0.1); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; flex-shrink: 0;">
                <i class="fa-solid fa-location-dot" style="color: #f87171;"></i>
            </div>
            <div>
                <strong>Kde to je?</strong><br>
                <span style="font-size: 0.9rem; color: #94a3b8;">Interaktivní mapa přímo v detailu turnaje.</span>
            </div>
        </div>

        <div style="display: flex; gap: 1rem; align-items: start;">
            <div style="background: rgba(255,255,255,0.1); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; flex-shrink: 0;">
                <i class="fa-solid fa-route" style="color: #60a5fa;"></i>
            </div>
            <div>
                <strong>Jak daleko?</strong><br>
                <span style="font-size: 0.9rem; color: #94a3b8;">Automatický výpočet km od Jablonce.</span>
            </div>
        </div>

        <div style="display: flex; gap: 1rem; align-items: start;">
            <div style="background: rgba(255,255,255,0.1); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; flex-shrink: 0;">
                <i class="fa-regular fa-calendar-check" style="color: #4ade80;"></i>
            </div>
            <div>
                <strong>Nezmeškejte</strong><br>
                <span style="font-size: 0.9rem; color: #94a3b8;">Export do Google Kalendáře jedním klikem.</span>
            </div>
        </div>
    </div>
</div>

<div style="margin-top: 2rem; padding: 1.5rem; border-left: 4px solid #3b82f6; background: rgba(59, 130, 246, 0.05);">
    <h4 style="margin-top: 0; font-size: 1.1rem;"><i class="fa-solid fa-user-secret"></i> Staňte se naším skautem!</h4>
    <p style="margin-bottom: 0;">Víte o kvalitním turnaji, který nám proklouzl pod radarem? <strong>Nenechávejte si to pro sebe!</strong><br>
    Napište nám tip dolů 👇 <strong>do diskuze</strong>, nebo pošlete odkaz na <a href="mailto:info@sachyjablonec.cz" style="color: #60a5fa; text-decoration: underline;">info@sachyjablonec.cz</a>.</p>
</div>

<p style="margin-top: 2rem; font-style: italic; color: #94a3b8;">Přejeme hodně štěstí a správných tahů v roce 2026!</p>
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
