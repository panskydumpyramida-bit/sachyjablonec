import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inserting Pololetní turnaj Varnsdorf 2026...');

    const description = `
<p><strong>Pololetní šachový turnaj mládeže</strong></p>
<p><strong>Místo:</strong> DDM Varnsdorf, Otáhalova 1260</p>
<p><strong>Termín:</strong> Pátek 30. 1. 2026 (pololetní prázdniny)</p>
<p><strong>Kategorie:</strong> Mládež (2008-2013, 2014 a mladší)</p>
<p><strong>Tempo:</strong> 2 x 12 minut + 5 s/tah (7 kol)</p>
<p><strong>Vklad:</strong> 50 Kč</p>
<p><strong>Ostatní:</strong> Nutno vzít přezůvky! Občerstvení v bufetu.</p>
<p><strong>Přihlášky:</strong> Do 29. 1. 2026 na email <a href="mailto:halbavdf@centrum.cz">halbavdf@centrum.cz</a> (max 44 hráčů).</p>
  `.trim();

    // 30.1.2026 8:00 prezence
    const startDate = new Date('2026-01-30T08:00:00.000+01:00');
    const endDate = new Date('2026-01-30T14:00:00.000+01:00');

    const event = await prisma.event.create({
        data: {
            title: 'Pololetní šachový turnaj mládeže',
            description: description,
            startDate: startDate,
            endDate: endDate,
            location: 'DDM Varnsdorf',
            category: 'tournament',
            ageGroup: 'youth',
            eventType: 'individual',
            timeControl: 'rapid',
            registrationDeadline: new Date('2026-01-29T17:00:00.000+01:00'),
            presentationEnd: new Date('2026-01-30T08:45:00.000+01:00'),
            entryFee: '50 Kč',
            organizerContact: 'Václav Halba (halbavdf@centrum.cz)',
            isInternal: false,
            isPublic: true,
        },
    });

    console.log(`Created Varnsdorf event (ID: ${event.id})`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
