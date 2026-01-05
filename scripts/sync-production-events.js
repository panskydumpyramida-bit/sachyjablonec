import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const events = [
    // 1. Josefův Důl (Jan 9)
    {
        title: 'Okresní přebor družstev mladších žáků - "O POHÁR OBCE JOSEFŮV DŮL"',
        description: `
<p><strong>Okresní přebor družstev mladších žáků pro okres Jablonec nad Nisou</strong></p>
<p><strong>Pořadatel:</strong> ZŠ a MŠ Josefův Důl ve spolupráci s ŠO TJ Bižuterie Jablonec nad Nisou</p>
<p><strong>Místo:</strong> Muzeum místní historie, Josefův Důl 210, 468 44 Josefův Důl (vedle josefodolského kostela), společenský sál v 1. patře</p>
<p><strong>Právo účasti:</strong> Čtyřčlenná družstva žáků 1.-5. ročníku z každé školy (max. 5 hráčů na soupisce).<br>
Podmínky pro nasazení na soupisku a ELO viz propozice.</p>
<p><strong>Hrací systém:</strong> Švýcarský systém na 7 kol podle pravidel FIDE pro rapid šach.</p>
<p><strong>Tempo:</strong> 2 x 10 minut + 5 sekund na tah.</p>
<p><strong>Rozhodčí:</strong> Tomáš Ďúran, <strong>Ředitel turnaje:</strong> Radim Podrazký</p>
<p><strong>Ceny:</strong> Pohár pro 1. místo, medaile za 1.-5. místo a diplomy pro všechna družstva.</p>
<p><strong>Doprava a parkování:</strong> Vlak přijíždí v 8:24. Parkování u budovy muzea nebo naproti u samoobsluhy.</p>
<p><em>V průběhu turnaje bude v provozu malý bufet.</em></p>
      `.trim(),
        startDate: new Date('2026-01-09T08:00:00.000+01:00'),
        endDate: new Date('2026-01-09T14:30:00.000+01:00'),
        location: 'Muzeum místní historie, Josefův Důl 210, 468 44 Josefův Důl',
        url: 'http://sachy.jbll.net/files/propozice_OP_skol_1_5_trida_2024_2025.pdf',
        category: 'tournament',
        ageGroup: 'youth',
        eventType: 'team',
        timeControl: 'rapid',
        registrationDeadline: new Date('2026-01-07T23:59:59.000+01:00'),
        presentationEnd: new Date('2026-01-09T08:40:00.000+01:00'),
        entryFee: '100 Kč / družstvo',
        organizerContact: 'obcasnikrp@seznam.cz',
        isPublic: true
    },
    // 2. Varnsdorf (Jan 30)
    {
        title: 'Pololetní šachový turnaj mládeže',
        description: `
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
  `.trim(),
        startDate: new Date('2026-01-30T08:00:00.000+01:00'),
        endDate: new Date('2026-01-30T14:00:00.000+01:00'),
        location: 'DDM Varnsdorf, Otáhalova 1260, 407 47 Varnsdorf',
        url: 'http://sachy.jbll.net/files/propozice_Varnsdorf_leden_2025.pdf',
        category: 'tournament',
        ageGroup: 'youth',
        eventType: 'individual',
        timeControl: 'rapid',
        registrationDeadline: new Date('2026-01-29T17:00:00.000+01:00'),
        presentationEnd: new Date('2026-01-30T08:45:00.000+01:00'),
        entryFee: '50 Kč',
        organizerContact: 'halbavdf@centrum.cz',
        isPublic: true
    },
    // 3. Bakov (Jan 31)
    {
        title: '29. ročník memoriálu J. Kříže a Z. Zdobiny - "BAKOVSKÉ DVOJICE"',
        description: `
<p><strong>29. ročník memoriálu J. Kříže a Z. Zdobiny - "BAKOVSKÉ DVOJICE"</strong></p>
<p><strong>Pořadatel:</strong> Šachový klub Bakov nad Jizerou (Ředitel: Martin Richter)</p>
<p><strong>Místo konání:</strong> Sál radnice města Bakova nad Jizerou, Mírové náměstí</p>
<p><strong>Termín:</strong> Sobota 31. 1. 2026</p>
<p><strong>Hrací systém:</strong> Turnaj dvojic, Švýcarský systém na 9 kol, 2x15 min + 3 s/tah.</p>
<p><strong>Hodnocení:</strong> Body dvojice (součet, vzájemný zápas, atd.).</p>
<p><strong>Startovné:</strong> 120 Kč / osoba (Mládež do 18 let a Senioři 65+: 80 Kč).</p>
<p><strong>Časový plán:</strong>
<ul>
<li>08:15 – 08:45 Prezence</li>
<li>09:15 – 09:55 1. kolo</li>
<li>16:45 – 17:00 Vyhlášení výsledků</li>
</ul>
</p>
<p><strong>Ceny:</strong> Finanční ceny pro první 4 dvojice (1. místo 2000 Kč). Věcné ceny pro kategorie.</p>
<p><strong>Přihlášky:</strong> <a href="https://1url.cz/@Dvojice26" target="_blank">Elektronický formulář</a> nebo email martin.richter@volny.cz (Kapacita 50 dvojic).</p>
<p><strong>Poznámky:</strong> Občerstvení na místě. Turnaj je přihlášen do konkurzu na KP dvojic v rapid šachu.</p>
  `.trim(),
        startDate: new Date('2026-01-31T08:15:00.000+01:00'),
        endDate: new Date('2026-01-31T17:00:00.000+01:00'),
        location: 'Sál radnice města Bakova nad Jizerou, Mírové náměstí',
        url: 'https://drive.google.com/file/d/17jq9YC18gf4In6U8Y0UGoy2pe7Bm5jEd/view',
        category: 'tournament',
        ageGroup: 'all',
        eventType: 'team',
        timeControl: 'rapid',
        presentationEnd: new Date('2026-01-31T08:45:00.000+01:00'),
        entryFee: '120 Kč / 80 Kč',
        organizerContact: 'martin.richter@volny.cz',
        isPublic: true
    },
    // 4. OPEN PRAHA 2026 (Merged A, B, 30+)
    {
        title: 'OPEN PRAHA 2026 (A, B, 30+)',
        description: 'Série mistrovských a ratingových turnajů (A, B, 30+). Švýcarský systém na 9 kol, 2x 1,5h/40 + 30min + 30s/tah. Hotel Olympik.',
        startDate: new Date('2026-01-09T16:00:00.000+01:00'),
        endDate: new Date('2026-01-16T14:00:00.000+01:00'),
        location: 'Hotel Olympik, U Sluncové 14, 186 76 Praha 8',
        url: 'https://www.czechtour.net/cz/open-praha/propozice/',
        category: 'tournament',
        ageGroup: 'all',
        eventType: 'individual',
        timeControl: 'classical',
        entryFee: '1500 - 2000 Kč',
        presentationEnd: new Date('2026-01-09T14:00:00.000+01:00'), // Updated 14:00
        isPublic: true
    },
    // 5. OPEN PRAHA C (Rapid)
    {
        title: 'OPEN PRAHA C 2026 (Rapid)',
        description: 'Otevřený turnaj v rapid šachu. 7 kol, 2x 10 min + 5s/tah.',
        startDate: new Date('2026-01-11T09:00:00.000+01:00'),
        endDate: new Date('2026-01-11T14:00:00.000+01:00'),
        location: 'Hotel Olympik, U Sluncové 14, 186 76 Praha 8',
        url: 'https://www.czechtour.net/cz/open-praha/propozice/',
        category: 'tournament',
        ageGroup: 'all',
        eventType: 'individual',
        timeControl: 'rapid',
        entryFee: '200 Kč',
        presentationEnd: new Date('2026-01-11T09:15:00.000+01:00'), // Updated 09:15
        isPublic: true
    },
    // 6. OPEN PRAHA D (Blitz)
    {
        title: 'OPEN PRAHA D 2026 (Blesk)',
        description: 'Otevřený bleskový turnaj. 11 kol, 2x 3 min + 2s/tah.',
        startDate: new Date('2026-01-14T09:00:00.000+01:00'),
        endDate: new Date('2026-01-14T12:00:00.000+01:00'),
        location: 'Hotel Olympik, U Sluncové 14, 186 76 Praha 8',
        url: 'https://www.czechtour.net/cz/open-praha/propozice/',
        category: 'tournament',
        ageGroup: 'all',
        eventType: 'individual',
        timeControl: 'blitz',
        entryFee: '200 Kč',
        presentationEnd: new Date('2026-01-14T09:45:00.000+01:00'), // Updated 09:45
        isPublic: true
    },
    // 7. PORG Open Series (104-108)
    {
        title: '104. PORG Open',
        startDate: new Date('2026-01-10T09:00:00.000+01:00'),
        endDate: new Date('2026-01-10T14:15:00.000+01:00'),
        registrationDeadline: new Date('2026-01-08T16:00:00.000+01:00'),
        presentationEnd: new Date('2026-01-10T08:40:00.000+01:00') // Updated 08:40
    },
    {
        title: '105. PORG Open',
        startDate: new Date('2026-02-07T09:00:00.000+01:00'),
        endDate: new Date('2026-02-07T14:15:00.000+01:00'),
        registrationDeadline: new Date('2026-02-05T16:00:00.000+01:00'),
        presentationEnd: new Date('2026-02-07T08:40:00.000+01:00')
    },
    {
        title: '106. PORG Open',
        startDate: new Date('2026-03-14T09:00:00.000+01:00'),
        endDate: new Date('2026-03-14T14:15:00.000+01:00'),
        registrationDeadline: new Date('2026-03-12T16:00:00.000+01:00'),
        presentationEnd: new Date('2026-03-14T08:40:00.000+01:00')
    },
    {
        title: '107. PORG Open',
        startDate: new Date('2026-04-18T09:00:00.000+01:00'),
        endDate: new Date('2026-04-18T14:15:00.000+01:00'),
        registrationDeadline: new Date('2026-04-16T16:00:00.000+01:00'),
        presentationEnd: new Date('2026-04-18T08:40:00.000+01:00')
    },
    {
        title: '108. PORG Open',
        startDate: new Date('2026-05-16T09:00:00.000+01:00'),
        endDate: new Date('2026-05-16T14:15:00.000+01:00'),
        registrationDeadline: new Date('2026-05-14T16:00:00.000+01:00'),
        presentationEnd: new Date('2026-05-16T08:40:00.000+01:00')
    }
];

// Common data for PORG
const porgCommon = {
    location: 'Nový PORG, Pod Krčským lesem 1300/25, 142 00 Praha 4',
    url: 'https://www.chess.cz/wp-content/uploads/2025/09/102_108_PORG_Open_Propozice.pdf',
    category: 'tournament',
    ageGroup: 'youth',
    eventType: 'individual',
    timeControl: 'rapid',
    entryFee: '150 Kč',
    organizerContact: 'sach.porg@gmail.com',
    isPublic: true,
    description: '15. ročník turnajů pro mládež do 20 let. Rapid šach 2x12 min + 3s. Dvě skupiny: Open A (U20) a Open B (U10). Prezence 8:00-8:40.'
};

async function main() {
    console.log('Starting synchronization of production events...');

    // Process main list
    for (const evt of events) {
        let finalData = { ...evt };

        // Merge common data for PORG events
        if (evt.title.includes('PORG Open')) {
            finalData = { ...porgCommon, ...evt };
        }

        const existing = await prisma.event.findFirst({
            where: {
                title: finalData.title,
                startDate: finalData.startDate
            }
        });

        if (existing) {
            console.log(`Updating existing event: "${finalData.title}"`);
            await prisma.event.update({
                where: { id: existing.id },
                data: finalData
            });
        } else {
            console.log(`Creating new event: "${finalData.title}"`);
            await prisma.event.create({
                data: finalData
            });
        }
    }

    // Cleanup: Ensure old individual Prague Open events are gone if they exist
    const titlesToDelete = ['OPEN PRAHA A 2026', 'OPEN PRAHA B 2026', 'OPEN PRAHA 30+ 2026'];
    const deleted = await prisma.event.deleteMany({
        where: {
            title: { in: titlesToDelete }
        }
    });

    if (deleted.count > 0) {
        console.log(`Cleaned up ${deleted.count} obsolete Prague Open A/B/30+ individual events.`);
    }

    console.log('Sync complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
