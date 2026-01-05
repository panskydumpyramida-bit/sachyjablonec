import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Condensing event descriptions...');

    // 1. Josefův Důl
    const josefuvDul = await prisma.event.findFirst({ where: { title: { contains: 'JOSEFŮV DŮL' } } });
    if (josefuvDul) {
        await prisma.event.update({
            where: { id: josefuvDul.id },
            data: {
                description: `
<p><strong>Okresní přebor družstev mladších žáků</strong></p>
<p><strong>Termín:</strong> pátek 9. ledna 2026</p>
<p><strong>Místo:</strong> Josefův Důl (Muzeum místní historie)</p>
<p><strong>Účast:</strong> Čtyřčlenná družstva žáků 1.-5. ročníku.</p>
<p><strong>Tempo:</strong> 2 x 10 minut + 5 s/tah, 7 kol.</p>
<p><strong>Přihlášky:</strong> do 7. 1. 2026 na obcasnikrp@seznam.cz</p>
<p><em>Podrobnosti v propozicích.</em></p>
        `.trim()
            }
        });
        console.log('Updated Josefův Důl.');
    }

    // 2. Varnsdorf
    const varnsdorf = await prisma.event.findFirst({ where: { title: { contains: 'Pololetní šachový turnaj' } } });
    if (varnsdorf) {
        await prisma.event.update({
            where: { id: varnsdorf.id },
            data: {
                description: `
<p><strong>Pololetní šachový turnaj mládeže</strong></p>
<p><strong>Termín:</strong> pátek 30. ledna 2026</p>
<p><strong>Místo:</strong> DDM Varnsdorf</p>
<p><strong>Kategorie:</strong> Nar. 2008-2013 a 2014 a mladší.</p>
<p><strong>Tempo:</strong> 2 x 12 minut + 5 s/tah, 7 kol.</p>
<p><strong>Přihlášky:</strong> do 29. 1. 2026 na halbavdf@centrum.cz</p>
<p><em>Podrobnosti v propozicích.</em></p>
        `.trim()
            }
        });
        console.log('Updated Varnsdorf.');
    }

    // 3. Turnov
    const turnov = await prisma.event.findFirst({ where: { title: { contains: 'VC jednotlivců mládeže' } } });
    if (turnov) {
        await prisma.event.update({
            where: { id: turnov.id },
            data: {
                description: `
<p><strong>VC jednotlivců mládeže ŠSLK v rapid šachu</strong></p>
<p><strong>Termín:</strong> Sobota 14. 02. 2026</p>
<p><strong>Místo:</strong> OAHŠ Turnov</p>
<p><strong>Kategorie:</strong> U8, U10, U12, U14, U16, U18, Elite.</p>
<p><strong>Tempo:</strong> 2 x 15 min + 5 s/tah, 7 kol.</p>
<p><strong>Přihlášky:</strong> do 12. 2. 2026 na tomas.duran@seznam.cz</p>
<p><em>Podrobnosti v propozicích.</em></p>
        `.trim()
            }
        });
        console.log('Updated Turnov.');
    }

    // 4. Bakov
    const bakov = await prisma.event.findFirst({ where: { title: { contains: 'BAKOVSKÉ DVOJICE' } } });
    if (bakov) {
        await prisma.event.update({
            where: { id: bakov.id },
            data: {
                description: `
<p><strong>29. ročník memoriálu J. Kříže a Z. Zdobiny</strong></p>
<p><strong>Termín:</strong> Sobota 31. 1. 2026</p>
<p><strong>Místo:</strong> Sál radnice Bakov nad Jizerou</p>
<p><strong>Systém:</strong> Turnaj dvojic, 9 kol, 2x15 min + 3 s/tah.</p>
<p><strong>Startovné:</strong> 120 Kč/os (mládež/senioři 80 Kč).</p>
<p><strong>Přihlášky:</strong> Přes <a href="https://1url.cz/@Dvojice26" target="_blank">formulář</a> nebo martin.richter@volny.cz</p>
<p><em>Podrobnosti v propozicích.</em></p>
        `.trim()
            }
        });
        console.log('Updated Bakov.');
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
