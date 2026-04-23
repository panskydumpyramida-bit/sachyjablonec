import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const event = {
    title: 'Strážský rapid 2026 — KP ŠSLK v rapid šachu',
    description: `30. ročník šachového turnaje — Memoriál Evžena Blaháčka, zároveň Krajský přebor ŠSLK v rapid šachu.

Systém: 9 kol švýcar (FIDE rapid, čl. A5)
Tempo: 2× 12 min + 4 s/tah
Kategorie: OPEN, žáci do 15 let (2011 a ml.), KP ŠSLK
Kapacita: cca 50 hráčů

Časový plán:
• 8:30–9:15 prezence
• 9:45–15:00 1.–9. kolo
• 15:15 vyhlášení výsledků

Vklad: 100 Kč (po termínu +50 Kč)

Ceny: 1. cena 800 Kč, další pořadí věcné ceny, drobná cena pro každého. Zvláštní ceny KP: 1. 500 Kč, 2. 400 Kč, 3. 300 Kč.

Přihlášky: e-mailem/telefonicky hlavnímu rozhodčímu Janu Malcovi do 1. 5. 2026.
Podmínka: lichý hráč registrovaný v oddílu přiveze kompletní soupravu včetně digitálních hodin.

Turnaj bude započten na LOK-rapid. Ředitel: Jaroslav Holub.`,
    startDate: new Date('2026-05-03T07:45:00Z'),
    endDate: new Date('2026-05-03T13:15:00Z'),
    location: 'Kulturní dům „U Jezera", Máchova 203, Stráž pod Ralskem',
    category: 'tournament',
    ageGroup: 'open',
    eventType: 'individual',
    timeControl: 'rapid',
    registrationDeadline: new Date('2026-05-01T21:59:00Z'),
    presentationEnd: new Date('2026-05-03T07:15:00Z'),
    entryFee: '100 Kč (po termínu +50 Kč)',
    organizerContact: 'Jan Malec, tel. 722 973 542, malec17@seznam.cz',
    url: 'https://sachy.org/wp-content/uploads/2026/02/StrazRapid2026-05-03.pdf',
    isInternal: false,
    isPublic: true,
    isFeatured: false,
};

try {
    const existing = await prisma.event.findFirst({
        where: { title: event.title },
    });
    if (existing) {
        console.log(`Již existuje: id=${existing.id}, přeskakuji.`);
        process.exit(0);
    }
    const created = await prisma.event.create({ data: event });
    console.log(`✅ Vloženo: id=${created.id}, ${created.title}`);
    console.log(`   start: ${created.startDate.toISOString()}`);
    console.log(`   end:   ${created.endDate?.toISOString()}`);
} catch (e) {
    console.error('❌ Chyba:', e.message);
    process.exit(1);
} finally {
    await prisma.$disconnect();
}
