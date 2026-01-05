import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inserting Varnsdorf event...');

    const description = `
<p><strong>Pololetní šachový turnaj mládeže</strong></p>
<p><strong>Pořadatel:</strong> DDM Varnsdorf ve spolupráci s ŠK</p>
<p><strong>Místo konání:</strong> DDM Varnsdorf, Otáhalova 1260, 407 47 Varnsdorf</p>
<p><strong>Vedoucí soutěže:</strong> Václav Halba</p>
<p><strong>Rozhodčí:</strong> Jakub Spyrka a Václav Paulus</p>
<p><strong>Kategorie:</strong> 2 samostatné turnaje:
<ul>
<li>Dívky a chlapci narození 2008-2013</li>
<li>Dívky a chlapci narození 2014 a mladší</li>
</ul>
<em>Pořadatel si vyhrazuje právo upravit kategorie dle počtu účastníků.</em></p>
<p><strong>Hrací systém:</strong> 7 kol švýcarským systémem dle pravidel FIDE</p>
<p><strong>Tempo:</strong> 2 x 12 minut + 5 sekund na tah</p>
<p><strong>Časový plán:</strong>
<ul>
<li>08:00 – 08:45 Prezence</li>
<li>08:45 – 08:55 Zahájení a losování</li>
<li>09:00 1. kolo</li>
<li>14:00 Předpokládaný konec</li>
</ul>
</p>
<p><strong>Startovné:</strong> 50 Kč</p>
<p><strong>Ceny:</strong> Poháry pro vítěze, medaile a diplomy pro první 3 v každé kategorii.</p>
<p><strong>Přihlášky:</strong> Do 29. 1. 2026 17:00 na email <strong>halbavdf@centrum.cz</strong> (max kapacita 44 hráčů).</p>
<p><strong>Poznámky:</strong> Nutné přezůvky. Drobné občerstvení (káva, čaj, párky) v bufetu. Turnaj je součástí GP ŠSLK mládeže v rapidu.</p>
  `.trim();

    const event = await prisma.event.create({
        data: {
            title: 'Pololetní šachový turnaj mládeže',
            description: description,
            startDate: new Date('2026-01-30T08:00:00.000+01:00'), // 30. ledna 08:00 (prezence od 8:00)
            endDate: new Date('2026-01-30T14:00:00.000+01:00'),   // 14:00 predpokladany konec
            location: 'DDM Varnsdorf, Otáhalova 1260, 407 47 Varnsdorf',
            category: 'tournament', // GP SSLK rapid -> tournament
            ageGroup: 'youth', // mládež
            eventType: 'individual', // Not team implies individual usually for these defaults
            timeControl: 'rapid', // 2x12+5 is rapid
            registrationDeadline: new Date('2026-01-29T17:00:00.000+01:00'),
            presentationEnd: new Date('2026-01-30T08:45:00.000+01:00'),
            entryFee: '50 Kč',
            organizerContact: 'halbavdf@centrum.cz',
            isInternal: false,
            isPublic: true,
        },
    });

    console.log(`Event created with ID: ${event.id}`);
    console.log(event);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
