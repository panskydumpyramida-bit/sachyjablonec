import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inserting Josefův Důl event...');

    const event = await prisma.event.create({
        data: {
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
            startDate: new Date('2026-01-09T08:00:00.000+01:00'), // 08:00 start
            endDate: new Date('2026-01-09T14:30:00.000+01:00'),   // 14:30 end
            location: 'Muzeum místní historie, Josefův Důl 210, 468 44 Josefův Důl',
            category: 'tournament',
            ageGroup: 'youth',
            eventType: 'team',
            timeControl: 'rapid',
            registrationDeadline: new Date('2026-01-07T23:59:59.000+01:00'), // Do středy 7. ledna
            presentationEnd: new Date('2026-01-09T08:40:00.000+01:00'), // 08:40
            entryFee: '100 Kč / družstvo',
            organizerContact: 'obcasnikrp@seznam.cz',
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
