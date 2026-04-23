/**
 * Update script: Upgrade článku Velikonoční vejce 2026 na styl článku 54 (Blicák)
 * - Podium karty s hover efekty
 * - Perex s okrajem
 * - Highlight names
 * - Rozbalitelné celkové pořadí všech 33 hráčů s ELO
 * - Gradient Chess-Results tlačítko
 * - Mobile responsive CSS
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const content = `
<!-- Report Section -->
<div style="max-width: 800px; margin: 0 auto 3rem;">
    <!-- Headline -->
    <h2 style="color: var(--primary-color); font-family: 'Playfair Display', serif; margin-bottom: 1.5rem; line-height: 1.3;">
        Velikonoční vejce 2026: Duda ovládl tradiční bleskový turnaj
    </h2>

    <!-- Perex -->
    <p style="font-size: 1.1rem; font-weight: 500; font-style: italic; color: #ccc; margin-bottom: 2rem; line-height: 1.6; border-left: 3px solid var(--primary-color); padding-left: 1rem;">
        Tradiční velikonoční bleskový turnaj přilákal do jabloneckého klubu 33 šachistů z celého regionu. Po deseti kolech napínavých partií slavil domácí <span class="highlight-name">Antonín Duda</span> se ziskem 8,5 bodu. Stříbrnou příčku obsadil turnovský <span class="highlight-name">Marek Sýkora</span> (8 bodů) a bronz si vybojoval tanvaldský <span class="highlight-name">Martin Vašák</span> (7,5 bodu).
    </p>

    <!-- Body Text -->
    <div style="line-height: 1.8; color: #ddd; font-size: 1rem;">
        <p style="margin-bottom: 1rem;">
            O Velikonocích jsme opět usedli k šachovnicím v rámci tradičního <strong>Jabloneckého Velikonočního vejce</strong>. Letošní ročník potvrdil oblibu tohoto svátečního klání – na start se postavilo 33 hráčů z celého Libereckého kraje i dalších regionů.
        </p>
        <p style="margin-bottom: 1rem;">
            Vítězem desetikolového turnaje se stal domácí <span class="highlight-name">Antonín Duda</span>, který ziskem <span class="highlight-score">8,5 bodu</span> z 10 kol potvrdil výbornou formu a suverénně ovládl konečné pořadí. Hned v závěsu za ním si stříbrnou pozici s <span class="highlight-score">8 body</span> vybojoval turnovský <span class="highlight-name">Marek Sýkora</span> z ŠK Zikuda. Pro skvělé třetí místo (<span class="highlight-score">7,5 bodu</span>) si nakonec došel tanvaldský <span class="highlight-name">Martin Vašák</span> z TJ Jiskry.
        </p>
        <p style="margin-bottom: 1rem;">
            Za zmínku stojí také výborný výkon libereckého <span class="highlight-name">Jiřího Jareše</span> na 4. místě a turnovského <span class="highlight-name">Vladimíra Vltavského</span> na 5. příčce. Pěkného umístění dosáhl i mladý <span class="highlight-name">Kostiantyn Tsantsala</span>, který potvrzuje svůj stoupající trend.
        </p>
        <p>
            Turnaj se tradičně odehrál ve velmi přátelské a pohodové sváteční atmosféře a přinesl nespočet bojovných partií i napínavých koncovek. Děkujeme všem za účast a parádní šachový prožitek!
        </p>
    </div>
</div>

<!-- Síň slávy sekce -->
<div style="margin: 2rem 0;">
    <h3 style="color: var(--primary-color); text-align: center; font-family: 'Playfair Display', serif; margin-bottom: 2rem; font-size: 1.8rem;">
        🏆 Stupně vítězů
    </h3>

    <!-- Podium Section -->
    <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-end; gap: 0.5rem; max-width: 100%; margin-bottom: 3rem;">

        <!-- 2nd Place - Sýkora -->
        <div class="podium-card podium-silver" style="order: 1; flex: 1 1 0%; min-width: 0px; padding: 1.5rem 0.8rem; background: rgba(192, 192, 192, 0.1); border-radius: 12px; border-top: 4px solid rgb(192, 192, 192); display: flex; flex-direction: column; align-items: center; min-height: 280px; justify-content: space-between; transition: transform 0.2s, box-shadow 0.2s; cursor: default;" onmouseenter="this.style.transform='scale(1.03)'; this.style.boxShadow='0 8px 25px rgba(192,192,192,0.3)';" onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='none';">
            <div style="margin-bottom: auto; width: 100%; text-align: center;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">🥈</div>
                <div class="podium-name" style="font-size: 1.1rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; word-wrap: break-word; overflow-wrap: break-word; hyphens: auto;">Marek Sýkora</div>
                <div style="font-size: 0.85rem; color: #888;">ŠK ZIKUDA Turnov</div>
            </div>
            <div style="margin-top: 1rem; font-weight: bold; color: #D4AF37; font-size: 1.5rem;">8</div>
        </div>

        <!-- 1st Place - Duda -->
        <div class="podium-card podium-gold" style="order: 2; flex: 1.2 1 0%; min-width: 0px; padding: 2rem 0.8rem; background: rgba(212, 175, 55, 0.15); border-radius: 12px; border-top: 4px solid rgb(255, 215, 0); transform: translateY(-1rem); display: flex; flex-direction: column; align-items: center; box-shadow: rgba(212, 175, 55, 0.2) 0px 10px 30px; min-height: 300px; justify-content: space-between; transition: transform 0.2s, box-shadow 0.2s; cursor: default;" onmouseenter="this.style.transform='translateY(-1rem) scale(1.05)'; this.style.boxShadow='0 15px 40px rgba(212,175,55,0.4)';" onmouseleave="this.style.transform='translateY(-1rem)'; this.style.boxShadow='0 10px 30px rgba(212,175,55,0.2)';">
            <div style="margin-bottom: auto; width: 100%; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">🥇</div>
                <div class="podium-name" style="font-weight: bold; font-size: 1.3rem; color: #FFD700; margin-bottom: 0.5rem; word-wrap: break-word; overflow-wrap: break-word; hyphens: auto;">Antonín Duda</div>
                <div style="font-size: 0.85rem; color: #888;">TJ Bižuterie Jablonec n.N.</div>
            </div>
            <div style="margin-top: 1rem; font-weight: bold; color: #FFD700; font-size: 2rem;">8,5</div>
        </div>

        <!-- 3rd Place - Vašák -->
        <div class="podium-card podium-bronze" style="order: 3; flex: 1 1 0%; min-width: 0px; padding: 1rem 0.5rem; background: rgba(205, 127, 50, 0.1); border-radius: 12px; border-top: 4px solid rgb(205, 127, 50); display: flex; flex-direction: column; align-items: center; min-height: 200px; justify-content: space-between; transition: transform 0.2s, box-shadow 0.2s; cursor: default;" onmouseenter="this.style.transform='scale(1.03)'; this.style.boxShadow='0 8px 25px rgba(205,127,50,0.3)';" onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='none';">
            <div style="margin-bottom: auto; width: 100%; text-align: center;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">🥉</div>
                <div class="podium-name" style="font-weight: bold; font-size: 1rem; color: #fff; margin-bottom: 0.5rem; word-wrap: break-word; overflow-wrap: break-word; hyphens: auto;">Martin Vašák</div>
                <div style="font-size: 0.8rem; color: #888;">TJ Jiskra Tanvald</div>
            </div>
            <div style="margin-top: 1rem; font-weight: bold; color: #D4AF37; font-size: 1.5rem;">7,5</div>
        </div>
    </div>

    <!-- Kompletní pořadí (CSS Only Toggle) -->
    <div style="margin-top: 3rem;">
        <details>
            <summary style="cursor: pointer; color: #D4AF37; font-family: 'Playfair Display', serif; font-size: 1.4rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(212,175,55,0.3); padding-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between; user-select: none; list-style: none;">
                Celkové pořadí <i class="fa-solid fa-chevron-down" style="font-size: 1rem; transition: transform 0.3s;"></i>
            </summary>

            <div style="padding: 1rem; overflow-x: auto; background: rgba(255,255,255,0.03); border-radius: 8px;">
                <table id="resultsTable" style="width: 100%; border-collapse: collapse; color: #fff; min-width: 300px; font-size: 0.9rem;">
                    <thead>
                        <tr style="border-bottom: 1px solid #D4AF37; text-align: left;">
                            <th style="padding: 0.5rem; width: 50px; text-align: center;">Poř.</th>
                            <th style="padding: 0.5rem;">Jméno</th>
                            <th style="padding: 0.5rem; color: #aaa; text-align: center;">ELO</th>
                            <th style="padding: 0.5rem;">Klub</th>
                            <th style="padding: 0.5rem; text-align: right; width: 60px;">Body</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #D4AF37;">1.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Duda, Antonín</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1970</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">8,5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #D4AF37;">2.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Sýkora, Marek</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">2091</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">ŠK ZIKUDA Turnov, z.s.</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">8</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #D4AF37;">3.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Vašák, Martin</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1789</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Jiskra Tanvald</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">7,5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">4.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Jareš, Jiří</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">2041</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">ŠK SLAVIA Liberec, z.s.</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">7</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">5.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Vltavský, Vladimír</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">2018</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">ŠK ZIKUDA Turnov, z.s.</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">6,5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">6.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Tsantsala, Kostiantyn</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1871</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">6</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">7.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Sivák, Lukáš</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1682</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">6</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">8.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Joukl, Zdeněk</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1843</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Jiskra Tanvald</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">6</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">9.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Žamboch, Roman</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">2013</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ KRALUPY, z.s.</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">6</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">10.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Titěra, Libor</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1855</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">6</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">11.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Sýkora, Ondřej</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1994</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">ŠK ZIKUDA Turnov, z.s.</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">5,5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">12.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Zimovčák, Kryštof</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1465</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">Šachový klub Frýdlant, z.s.</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">5,5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">13.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Podrazký, Radim</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1707</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">5,5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">14.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Křivánek, Jaroslav</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1532</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">5,5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">15.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Červeň, Aleš</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1305</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">5,5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">16.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Kobylka, Vojtěch</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">0</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">17.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Žídek, Miroslav</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1755</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">18.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Hurt, Marek</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1219</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Desko Liberec</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">19.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Zadražil, Filip</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1539</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">20.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Šikolová, Barbora</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1231</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">21.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Šafránek, David</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1646</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">DDM Praha 6</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">22.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Ricka, Mikuláš</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1039</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">23.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Sengr, Ivan</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1097</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">4,5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">24.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Adámek, Lukáš</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1065</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">4,5</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">25.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Hádek, Vojtěch</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1244</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">4</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">26.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Louda, Karel</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1536</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">4</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">27.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Petržilková, Eliška</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1074</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">4</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">28.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Trsek, Adam</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">0</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">ŠK ZIKUDA Turnov, z.s.</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">4</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">29.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Trsek, Jan</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">0</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">ŠK ZIKUDA Turnov, z.s.</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">4</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">30.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Dražan, Jonáš</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">0</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;"></td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">3</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">31.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Šikola, Jakub</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">1040</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;">TJ Bižuterie Jablonec n.Nisou</td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">3</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">32.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Vlaháč, Michal</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">0</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;"></td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">3</td>
                        </tr>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); height: 40px;">
                            <td style="padding: 0.5rem; text-align: center; font-weight: bold; color: #888;">33.</td>
                            <td style="padding: 0.5rem; font-weight: 500;">Tvrdíková, Veronika</td>
                            <td style="padding: 0.5rem; text-align: center; color: #888; font-family: monospace;">0</td>
                            <td style="padding: 0.5rem; color: #ccc; font-size: 0.85rem;"></td>
                            <td style="padding: 0.5rem; text-align: right; font-weight: bold; color: #D4AF37;">1</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </details>
        <style>
            .podium-name {
                word-wrap: break-word;
                overflow-wrap: break-word;
                hyphens: auto;
                max-width: 100%;
            }

            @media (max-width: 600px) {
                table td:nth-child(3),
                table th:nth-child(3),
                table td:nth-child(4),
                table th:nth-child(4) {
                    display: none !important;
                }

                .podium-card {
                    padding: 0.8rem 0.3rem !important;
                }

                .podium-name {
                    font-size: 0.9rem !important;
                    line-height: 1.2;
                }
            }
        </style>
    </div>

    <!-- Link na Chess-Results -->
    <div style="margin-top: 2rem; text-align: center;">
        <a href="https://chess-results.com/tnr1389644.aspx?lan=5&art=1&rd=10" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #987619 100%); color: #000; padding: 0.8rem 2rem; text-decoration: none; border-radius: 8px; font-weight: bold; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(212,175,55,0.4)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
            Otevřít na Chess-Results <i class="fa-solid fa-external-link-alt" style="margin-left: 0.5rem;"></i>
        </a>
    </div>
</div>
`.trim();

async function main() {
    const result = await prisma.news.update({
        where: { id: 18 },
        data: { content }
    });
    
    console.log('✅ Článek ID ' + result.id + ' aktualizován na styl Blicáku 54!');
    console.log('   - Podium karty s hover efekty');
    console.log('   - Perex se zlatým okrajem');
    console.log('   - Highlight names');
    console.log('   - Rozbalitelné celkové pořadí (33 hráčů + ELO)');
    console.log('   - Gradient Chess-Results tlačítko');
    console.log('   - Mobile responsive (skryje ELO + Klub na mobilu)');
    
    await prisma.$disconnect();
}

main().catch(e => {
    console.error('❌ Chyba:', e);
    prisma.$disconnect();
    process.exit(1);
});
