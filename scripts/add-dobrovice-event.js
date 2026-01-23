import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inserting Dobrovice rapid event...');

    const description = `
<p><strong>20. Dobrovický rapid – Tereos TTD</strong></p>
<p><strong>5. turnaj GP ČR v rapid šachu jednotlivců</strong></p>
<p><strong>Místo:</strong> Sokolovna Dobrovice, Palackého nám. 48</p>
<p><strong>Termín:</strong> Sobota 28. 2. 2026</p>
<p><strong>Tempo:</strong> 2 x 20 min + 5 s/tah</p>
<p><strong>Rozhodčí:</strong> FA Martin Petr</p>
<p><strong>Startovné:</strong> GM, IM, WGM, WIM zdarma, ostatní viz propozice.</p>
<p><strong>Ceny:</strong> Celkový fond 20 000 Kč. 1. cena 5 000 Kč.</p>
<p><strong>Propozice:</strong> <a href="https://www.sachydobrovice.cz/nove/wp-content/uploads/2026/01/20.-Dobrovicky-rapid-2026.docx-predbezne.docx" target="_blank">Stáhnout DOCX (předběžné)</a></p>
  `.trim();

    // Datum: 28.2.2026.
    // Start presentation usually 8:00
    // Start 1st round usually 9:15
    const startDate = new Date('2026-02-28T09:15:00.000+01:00');
    const endDate = new Date('2026-02-28T17:00:00.000+01:00'); // Estimate

    const event = await prisma.event.create({
        data: {
            title: '20. Dobrovický rapid – Tereos TTD',
            description: description,
            startDate: startDate,
            endDate: endDate,
            location: 'Sokolovna Dobrovice',
            url: 'https://www.sachydobrovice.cz/nove/wp-content/uploads/2026/01/20.-Dobrovicky-rapid-2026.docx-predbezne.docx',
            category: 'tournament',
            ageGroup: 'all',
            eventType: 'individual',
            timeControl: 'rapid',
            registrationDeadline: new Date('2026-02-27T20:00:00.000+01:00'), // Estimate
            presentationEnd: new Date('2026-02-28T08:50:00.000+01:00'), // Estimate
            entryFee: '200 Kč (základní)',
            organizerContact: 'Šachklub Města Dobrovice',
            isInternal: false,
            isPublic: true,
        },
    });

    console.log(`Created Dobrovice event (ID: ${event.id})`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
