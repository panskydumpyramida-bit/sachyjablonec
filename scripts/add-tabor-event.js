import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inserting Chess Lady Tabor event...');

    const description = `
<p><strong>19. ročník CHESS LADY 2026</strong></p>
<p><strong>FIDE turnaj DÍVEK do 20 let v rapid šachu</strong></p>
<p><strong>Místo:</strong> Hotel Relax U Drsů Tábor, Varšavská 2708</p>
<p><strong>Termín:</strong> Pátek 30. 1. 2026 (pololetní prázdniny)</p>
<p><strong>Tempo:</strong> 2x20 minut + 5 s/tah</p>
<p><strong>Systém:</strong> 7 kol švýcarským systémem</p>
<p><strong>Kategorie:</strong> Dívky 2005-2009, 2010-2014, 2015 a mladší.</p>
<p><strong>Startovné:</strong> 150 Kč (ELO > 2000 zdarma)</p>
<p><strong>Propozice:</strong> <a href="https://sachklub.cz/wp-content/uploads/2026/01/chesslady2026web.pdf" target="_blank">Stáhnout PDF</a></p>
<p><strong>Přihlášky:</strong> <a href="https://forms.gle/3H39irkjrZ55RwoB6" target="_blank">Online formulář</a></p>
  `.trim();

    const startDate = new Date('2026-01-30T10:00:00.000+01:00');
    const endDate = new Date('2026-01-30T17:00:00.000+01:00');

    const event = await prisma.event.create({
        data: {
            title: '19. ročník CHESS LADY 2026',
            description: description,
            startDate: startDate,
            endDate: endDate,
            location: 'Hotel Relax U Drsů Tábor',
            url: 'https://sachklub.cz/2026/01/sachklub-tabor-porada-19-rocnikc-h-e-s-s-l-a-d-y2026fide-turnaj-divek-do-20-letv-rapid-sachu/',
            category: 'tournament',
            ageGroup: 'youth',
            eventType: 'individual',
            timeControl: 'rapid',
            registrationDeadline: new Date('2026-01-28T23:59:00.000+01:00'),
            presentationEnd: new Date('2026-01-30T09:45:00.000+01:00'),
            entryFee: '150 Kč',
            organizerContact: 'ŠACHklub Tábor',
            isInternal: false,
            isPublic: true,
        },
    });

    console.log(`Created Tabor event (ID: ${event.id})`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
