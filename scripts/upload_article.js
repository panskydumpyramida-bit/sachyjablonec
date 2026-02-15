
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const content = `
    <style>
        .article-container {
            max-width: 900px;
            margin: 0 auto;
            color: #e5e7eb;
            font-family: 'Open Sans', sans-serif;
            line-height: 1.8;
        }
        
        .article-text p {
            margin-bottom: 1.5rem;
            font-size: 1.1rem;
        }

        .article-highlight {
            font-size: 1.25rem;
            color: #d4af37; /* Gold */
            font-weight: 600;
            margin: 2rem 0;
            text-align: center;
            border-top: 1px solid rgba(212, 175, 55, 0.3);
            border-bottom: 1px solid rgba(212, 175, 55, 0.3);
            padding: 1.5rem 0;
        }

        .article-gallery {
            display: grid;
            grid-template-columns: 1fr;
            gap: 2rem;
            margin: 3rem 0;
            text-align: center;
        }

        @media (min-width: 768px) {
            .article-gallery {
                grid-template-columns: 1fr 1fr;
                align-items: center;
            }
        }

        .article-image-card {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            transition: transform 0.2s;
        }
        
        .article-image-card:hover {
            transform: translateY(-2px);
        }

        .article-image-card img {
            width: 100%;
            height: 300px; /* Fixed height for alignment */
            object-fit: cover; /* Cover to fill comfortably */
            object-position: center;
            display: block;
        }

        .article-image-caption {
            padding: 1rem;
            font-size: 0.9rem;
            color: #9ca3af;
            text-align: center;
            border-top: 1px solid rgba(255,255,255,0.05);
        }

        .article-source {
            margin-top: 3rem;
            padding-top: 1rem;
            border-top: 1px solid #333;
            font-size: 0.9rem;
            color: #888;
        }

        .article-source a {
            color: #d4af37;
            text-decoration: none;
        }
        .article-source a:hover {
            text-decoration: underline;
        }
    </style>
    
    <div class="article-container">
        
        <div class="article-text">
            <p>V pondělí 2. února proběhlo v Městském divadle v Jablonci nad Nisou slavnostní vyhlášení ankety <strong>Nejúspěšnější sportovec Jablonecka</strong>. Součástí večera bylo také uvedení významných osobností do Síně slávy jabloneckého sportu.</p>
            
            <p>Jedním z oceněných byl <strong>Čestmír Drobník</strong>, který byl do síně slávy uveden <em>in memoriam</em>. Dlouholetý trenér, funkcionář a neúnavný propagátor šachu patřil k lidem, kteří po desítky let formovali sportovní život v Jablonci nad Nisou. Svou prací, nasazením a lidským přístupem ovlivnil generace hráčů a zanechal za sebou stopu, která jen tak nezmizí.</p>
            
            <div class="article-highlight">
                Uvedení Čestmíra Drobníka do Síně slávy je důstojným poděkováním za vše, co pro jablonecký sport udělal.
            </div>

            <div class="article-gallery">
                <div class="article-image-card">
                    <img src="images/predavani_sportovec_2025.jpg" alt="Předávání ceny">
                    <div class="article-image-caption">
                        Cenu přebírá předseda oddílu Antonín Duda<br>
                        <span style="font-size: 0.8em; opacity: 0.8;">📸 foto: Liberecký kraj</span>
                    </div>
                </div>
                <div class="article-image-card">
                    <img src="images/plaketa_sportovec_2025.png" alt="Plaketa Síň slávy - Čestmír Drobník">
                    <div class="article-image-caption">
                        Pamětní plaketa In Memoriam
                    </div>
                </div>
            </div>

            <div class="article-source">
                Zdroj: <a href="https://www.kraj-lbc.cz/aktuality/sportovcem-jablonecka-za-minuly-rok-je-jan-chramosta-n587011.htm" target="_blank">Liberecký kraj</a> (a Facebook)
            </div>
        </div>
        
    </div>
  `;

    try {
        const slug = 'sportovec-jablonecka-2024-sin-slavy';
        const existing = await prisma.news.findUnique({ where: { slug } });

        let article;
        if (existing) {
            console.log(`Article with slug '${slug}' already exists. Updating...`);
            article = await prisma.news.update({
                where: { slug },
                data: {
                    title: 'Čestmír Drobník uveden do Síně slávy jabloneckého sportu',
                    category: 'Aktuality',
                    excerpt: 'Večer plný emocí a vzpomínek. Šachový trenér a funkcionář Čestmír Drobník byl v Městském divadle v Jablonci uveden do Síně slávy jabloneckého sportu.',
                    content: content,
                    // isPublished updated to ensure visibility
                    isPublished: true,
                }
            });
        } else {
            console.log(`Creating new article '${slug}'...`);
            article = await prisma.news.create({
                data: {
                    title: 'Čestmír Drobník uveden do Síně slávy jabloneckého sportu',
                    slug: slug,
                    category: 'Aktuality',
                    excerpt: 'Večer plný emocí a vzpomínek. Šachový trenér a funkcionář Čestmír Drobník byl v Městském divadle v Jablonci uveden do Síně slávy jabloneckého sportu.',
                    content: content,
                    publishedDate: new Date(),
                    isPublished: true,
                    authorName: 'Redakce',
                }
            });
        }
        console.log('Article saved successfully. ID:', article.id);
    } catch (e) {
        console.error('Error saving article:', e);
        process.exit(1);
    }
}

main()
    .catch(e => {
        throw e
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
