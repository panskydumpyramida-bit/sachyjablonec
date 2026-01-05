import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting event updates...');

    // 1. Update Josefův Důl
    const josefuvDul = await prisma.event.findFirst({
        where: { title: { contains: 'JOSEFŮV DŮL' } }
    });
    if (josefuvDul) {
        await prisma.event.update({
            where: { id: josefuvDul.id },
            data: { url: 'https://sachy.org/wp-content/uploads/2025/12/Okres_prebor_druzstev_ml_zaku__2026.docx' }
        });
        console.log(`Updated URL for Josefův Důl (ID: ${josefuvDul.id})`);
    }

    // 2. Update Varnsdorf
    const varnsdorf = await prisma.event.findFirst({
        where: { title: { contains: 'Pololetní šachový turnaj' } }
    });
    if (varnsdorf) {
        await prisma.event.update({
            where: { id: varnsdorf.id },
            data: { url: 'https://sachy.org/wp-content/uploads/2025/09/pololetak-2026.pdf' }
        });
        console.log(`Updated URL for Varnsdorf (ID: ${varnsdorf.id})`);
    }

    // 3. Create Turnov Event
    console.log('Inserting Turnov event...');

    const description = `
<p><strong>VC jednotlivců mládeže ŠSLK v rapid šachu 2025/2026</strong></p>
<p><strong>Pořadatel:</strong> ŠK ZIKUDA Turnov, z. s.</p>
<p><strong>Místo:</strong> Prostory OAHŠ Turnov, Zborovská ulice 519, 511 01 Turnov</p>
<p><strong>Termín:</strong> Sobota 14. 02. 2026</p>
<p><strong>Kategorie:</strong>
<ul>
<li>U18 – U16 (2008-2011)</li>
<li>U14 – U12 (2012-2015)</li>
<li>U10 – U8 (2016 a ml.)</li>
<li>Elite 2005 – 2007 (plus ml. s ELO > 1300)</li>
</ul>
</p>
<p><strong>Tempo:</strong> 2 x 15 min + 5 s/tah</p>
<p><strong>Časový plán:</strong>
<ul>
<li>8:00 – 8:45 Prezence</li>
<li>9:00 Zahájení</li>
<li>14:30 – 15:00 Vyhlášení</li>
</ul>
</p>
<p><strong>Startovné:</strong> 80 Kč</p>
<p><strong>Ceny:</strong> Poháry, medaile, diplomy pro první 3 a nejlepší dívku v každé kategorii.</p>
<p><strong>Kontakt:</strong> tomas.duran@seznam.cz (přihlášky do 12. 2. 2026)</p>
  `.trim();

    const turnov = await prisma.event.create({
        data: {
            title: 'VC jednotlivců mládeže ŠSLK v rapid šachu 2025/2026',
            description: description,
            startDate: new Date('2026-02-14T09:00:00.000+01:00'),
            endDate: new Date('2026-02-14T15:00:00.000+01:00'),
            location: 'Prostory OAHŠ Turnov, Zborovská ulice 519, 511 01 Turnov',
            url: 'https://sachy.org/wp-content/uploads/2025/11/2026-02-14_Mladez-VC_Propozice_jednotlivci.pdf',
            category: 'tournament',
            ageGroup: 'youth',
            eventType: 'individual',
            timeControl: 'rapid', // 2x15+5
            registrationDeadline: new Date('2026-02-12T23:59:59.000+01:00'),
            presentationEnd: new Date('2026-02-14T08:45:00.000+01:00'),
            entryFee: '80 Kč',
            organizerContact: 'tomas.duran@seznam.cz',
            isInternal: false,
            isPublic: true,
        },
    });

    console.log(`Created Turnov event (ID: ${turnov.id})`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
