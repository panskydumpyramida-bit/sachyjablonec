/**
 * Update: Přidání výsledků kategorií (S60, U15) a nejlepších žen
 * do článku Velikonoční vejce 2026 (ID 18)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // First, fetch current content
    const article = await prisma.news.findUnique({ where: { id: 18 } });
    if (!article) {
        console.error('❌ Článek ID 18 nenalezen!');
        process.exit(1);
    }

    console.log('📄 Aktuální délka obsahu:', article.content.length, 'znaků');

    // The new results sections to insert BEFORE the Chess-Results button
    const resultsSections = `
    <!-- Výsledky kategorií -->
    <div style="margin-top: 3rem;">
        <h3 style="color: var(--primary-color); text-align: center; font-family: 'Playfair Display', serif; margin-bottom: 2rem; font-size: 1.8rem;">
            📊 Výsledky kategorií
        </h3>

        <!-- S60 kategorie -->
        <div class="vejce-category-section" style="margin-bottom: 2.5rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(212,175,55,0.3);">
                <span style="background: linear-gradient(135deg, #D4AF37 0%, #987619 100%); color: #000; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.75rem; border-radius: 4px; letter-spacing: 0.05em;">S60</span>
                <span style="color: var(--primary-color); font-family: 'Playfair Display', serif; font-size: 1.3rem;">Senioři 60+</span>
            </div>
            <div style="overflow-x: auto; background: rgba(255,255,255,0.03); border-radius: 8px; padding: 0.5rem;">
                <table class="vejce-results-table" style="width: 100%; border-collapse: collapse; color: #fff; min-width: 280px; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid rgba(212,175,55,0.4); text-align: left;">
                            <th style="padding: 0.6rem 0.5rem; width: 40px; text-align: center; color: #D4AF37; font-size: 0.8rem;">Poř.</th>
                            <th style="padding: 0.6rem 0.5rem; color: #D4AF37; font-size: 0.8rem;">Jméno</th>
                            <th class="vejce-hide-mobile" style="padding: 0.6rem 0.5rem; color: #888; text-align: center; font-size: 0.8rem;">ELO</th>
                            <th style="padding: 0.6rem 0.5rem; text-align: right; width: 55px; color: #D4AF37; font-size: 0.8rem;">Body</th>
                            <th class="vejce-hide-mobile" style="padding: 0.6rem 0.5rem; text-align: right; width: 55px; color: #888; font-size: 0.8rem;">BH</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="vejce-row vejce-row-top3" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; font-weight: 700; color: #FFD700;">1.</td>
                            <td style="padding: 0.5rem; font-weight: 600; color: #fff;">Vltavský Vladimír</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">2018</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">6,5</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">57,5</td>
                        </tr>
                        <tr class="vejce-row vejce-row-top3" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; font-weight: 700; color: #C0C0C0;">2.</td>
                            <td style="padding: 0.5rem; font-weight: 600; color: #fff;">Joukl Zdeněk</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1843</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">6</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">58,5</td>
                        </tr>
                        <tr class="vejce-row vejce-row-top3" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; font-weight: 700; color: #CD7F32;">3.</td>
                            <td style="padding: 0.5rem; font-weight: 600; color: #fff;">Žamboch Roman</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">2013</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">6</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">55,5</td>
                        </tr>
                        <tr class="vejce-row" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; color: #888;">4.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Titěra Libor</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1855</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">6</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">55</td>
                        </tr>
                        <tr class="vejce-row" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; color: #888;">5.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Sýkora Ondřej</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1994</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">5,5</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">65,5</td>
                        </tr>
                        <tr class="vejce-row" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; color: #888;">6.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Křivánek Jaroslav</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1532</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">5,5</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">49</td>
                        </tr>
                        <tr class="vejce-row" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; color: #888;">7.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Žídek Miroslav</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1755</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">5</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">53</td>
                        </tr>
                        <tr class="vejce-row" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; color: #888;">8.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Louda Karel</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1536</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">4</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">43,5</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- U15 kategorie -->
        <div class="vejce-category-section" style="margin-bottom: 2.5rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(212,175,55,0.3);">
                <span style="background: linear-gradient(135deg, #5B9BD5 0%, #2E75B6 100%); color: #fff; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.75rem; border-radius: 4px; letter-spacing: 0.05em;">U15</span>
                <span style="color: var(--primary-color); font-family: 'Playfair Display', serif; font-size: 1.3rem;">Mládež do 15 let</span>
            </div>
            <div style="overflow-x: auto; background: rgba(255,255,255,0.03); border-radius: 8px; padding: 0.5rem;">
                <table class="vejce-results-table" style="width: 100%; border-collapse: collapse; color: #fff; min-width: 280px; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid rgba(212,175,55,0.4); text-align: left;">
                            <th style="padding: 0.6rem 0.5rem; width: 40px; text-align: center; color: #D4AF37; font-size: 0.8rem;">Poř.</th>
                            <th style="padding: 0.6rem 0.5rem; color: #D4AF37; font-size: 0.8rem;">Jméno</th>
                            <th class="vejce-hide-mobile" style="padding: 0.6rem 0.5rem; color: #888; text-align: center; font-size: 0.8rem;">ELO</th>
                            <th style="padding: 0.6rem 0.5rem; text-align: right; width: 55px; color: #D4AF37; font-size: 0.8rem;">Body</th>
                            <th class="vejce-hide-mobile" style="padding: 0.6rem 0.5rem; text-align: right; width: 55px; color: #888; font-size: 0.8rem;">BH</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="vejce-row vejce-row-top3" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; font-weight: 700; color: #FFD700;">1.</td>
                            <td style="padding: 0.5rem; font-weight: 600; color: #fff;">Tsantsala Kostiantyn</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1871</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">6</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">62,5</td>
                        </tr>
                        <tr class="vejce-row vejce-row-top3" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; font-weight: 700; color: #C0C0C0;">2.</td>
                            <td style="padding: 0.5rem; font-weight: 600; color: #fff;">Zimovčák Kryštof</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1465</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">5,5</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">57</td>
                        </tr>
                        <tr class="vejce-row vejce-row-top3" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; font-weight: 700; color: #CD7F32;">3.</td>
                            <td style="padding: 0.5rem; font-weight: 600; color: #fff;">Hurt Marek</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1219</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">5</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">52,5</td>
                        </tr>
                        <tr class="vejce-row" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; color: #888;">4.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Ricka Mikuláš</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1039</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">5</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">47,5</td>
                        </tr>
                        <tr class="vejce-row" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; color: #888;">5.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Sengr Ivan</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1097</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">4,5</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">47,5</td>
                        </tr>
                        <tr class="vejce-row" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; color: #888;">6.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Adámek Lukáš</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1065</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">4,5</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">44</td>
                        </tr>
                        <tr class="vejce-row" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; color: #888;">7.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Hádek Vojtěch</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1244</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">4</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">48</td>
                        </tr>
                        <tr class="vejce-row" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; color: #888;">8.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Petržilková Eliška</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1074</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">4</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: right; color: #888;">42,5</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Nejlepší ženy -->
        <div class="vejce-category-section" style="margin-bottom: 2rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(212,175,55,0.3);">
                <span style="background: linear-gradient(135deg, #E91E8C 0%, #B71570 100%); color: #fff; font-weight: 700; font-size: 0.8rem; padding: 0.25rem 0.75rem; border-radius: 4px; letter-spacing: 0.05em;">♀</span>
                <span style="color: var(--primary-color); font-family: 'Playfair Display', serif; font-size: 1.3rem;">Nejlepší ženy</span>
            </div>
            <div style="overflow-x: auto; background: rgba(255,255,255,0.03); border-radius: 8px; padding: 0.5rem;">
                <table class="vejce-results-table" style="width: 100%; border-collapse: collapse; color: #fff; min-width: 280px; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid rgba(212,175,55,0.4); text-align: left;">
                            <th style="padding: 0.6rem 0.5rem; width: 40px; text-align: center; color: #D4AF37; font-size: 0.8rem;">Poř.</th>
                            <th style="padding: 0.6rem 0.5rem; color: #D4AF37; font-size: 0.8rem;">Jméno</th>
                            <th class="vejce-hide-mobile" style="padding: 0.6rem 0.5rem; color: #888; text-align: center; font-size: 0.8rem;">ELO</th>
                            <th class="vejce-hide-mobile" style="padding: 0.6rem 0.5rem; color: #888; font-size: 0.8rem;">Klub</th>
                            <th style="padding: 0.6rem 0.5rem; text-align: center; width: 55px; color: #888; font-size: 0.8rem;">Celk.</th>
                            <th style="padding: 0.6rem 0.5rem; text-align: right; width: 55px; color: #D4AF37; font-size: 0.8rem;">Body</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="vejce-row vejce-row-top3" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; font-weight: 700; color: #FFD700;">1.</td>
                            <td style="padding: 0.5rem; font-weight: 600; color: #fff;">Šikolová Barbora</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1231</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888;">20.</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">5</td>
                        </tr>
                        <tr class="vejce-row vejce-row-top3" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; font-weight: 700; color: #C0C0C0;">2.</td>
                            <td style="padding: 0.5rem; font-weight: 600; color: #fff;">Petržilková Eliška</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">1074</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888;">27.</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">4</td>
                        </tr>
                        <tr class="vejce-row vejce-row-top3" style="border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <td style="padding: 0.5rem; text-align: center; font-weight: 700; color: #CD7F32;">3.</td>
                            <td style="padding: 0.5rem; font-weight: 600; color: #fff;">Tvrdíková Veronika</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; text-align: center; color: #888; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">—</td>
                            <td class="vejce-hide-mobile" style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;"></td>
                            <td style="padding: 0.5rem; text-align: center; color: #888;">33.</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: 700; color: #D4AF37;">1</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Responsive styles for category tables -->
    <style>
        .vejce-results-table .vejce-row {
            transition: background-color 0.15s ease;
        }
        .vejce-results-table .vejce-row:hover {
            background-color: rgba(212,175,55,0.07) !important;
        }
        .vejce-results-table .vejce-row-top3 {
            background-color: rgba(255,255,255,0.02);
        }
        @media (max-width: 600px) {
            .vejce-hide-mobile {
                display: none !important;
            }
            .vejce-category-section {
                margin-bottom: 2rem !important;
            }
            .vejce-results-table {
                font-size: 0.85rem !important;
            }
        }
    </style>`;

    // Insert before the Chess-Results button
    const chessResultsMarker = '<!-- Link na Chess-Results -->';
    
    if (!article.content.includes(chessResultsMarker)) {
        console.error('❌ Nenalezen marker pro Chess-Results tlačítko!');
        console.log('Hledám alternativní místo...');
        // Try to insert before the closing </div> that wraps everything
        const lastDivClose = article.content.lastIndexOf('</div>');
        if (lastDivClose === -1) {
            console.error('❌ Nelze najít místo pro vložení!');
            process.exit(1);
        }
        const newContent = article.content.slice(0, lastDivClose) + resultsSections + '\n' + article.content.slice(lastDivClose);
        await updateArticle(newContent);
    } else {
        const newContent = article.content.replace(chessResultsMarker, resultsSections + '\n\n    ' + chessResultsMarker);
        await updateArticle(newContent);
    }
}

async function updateArticle(newContent) {
    const result = await prisma.news.update({
        where: { id: 18 },
        data: { content: newContent }
    });

    console.log('✅ Článek ID ' + result.id + ' aktualizován!');
    console.log('   📊 Přidány výsledky kategorií:');
    console.log('      - S60 (Senioři 60+) — 8 hráčů');
    console.log('      - U15 (Mládež do 15 let) — 8 hráčů');
    console.log('      - ♀ Nejlepší ženy — Šikolová, Petržilková, Tvrdíková');
    console.log('   📱 Mobile responsive (skryje ELO, BH, Klub na mobilu)');
    console.log('   🎨 Hover efekty na řádcích, barevné top 3 medaile');
    console.log('   Nová délka obsahu:', newContent.length, 'znaků');

    await prisma.$disconnect();
}

main().catch(e => {
    console.error('❌ Chyba:', e);
    prisma.$disconnect();
    process.exit(1);
});
