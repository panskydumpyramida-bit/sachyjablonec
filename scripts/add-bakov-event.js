import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inserting Bakov event...');

    const description = `
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
  `.trim();

    const event = await prisma.event.create({
        data: {
            title: '29. ročník memoriálu J. Kříže a Z. Zdobiny - "BAKOVSKÉ DVOJICE"',
            description: description,
            startDate: new Date('2026-01-31T08:15:00.000+01:00'), // Prezence start
            endDate: new Date('2026-01-31T17:00:00.000+01:00'),   // Vyhlaseni end
            location: 'Sál radnice města Bakova nad Jizerou, Mírové náměstí',
            url: 'https://drive.google.com/file/d/17jq9YC18gf4In6U8Y0UGoy2pe7Bm5jEd/view',
            category: 'tournament',
            ageGroup: 'all', // Open event basically, though user said adding adults, it allows everyone.
            eventType: 'team', // Dvojice
            timeControl: 'rapid', // 2x15+3
            registrationDeadline: null, // "Výjimečně na místě", though limited capacity.
            presentationEnd: new Date('2026-01-31T08:45:00.000+01:00'),
            entryFee: '120 Kč / 80 Kč',
            organizerContact: 'martin.richter@volny.cz',
            isInternal: false,
            isPublic: true,
        },
    });

    console.log(`Created Bakov event (ID: ${event.id})`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
