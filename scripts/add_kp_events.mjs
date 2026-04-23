/**
 * Add KP 2026 Rapid + Blesk družstev events
 * Run: node scripts/add_kp_events.mjs
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const events = [
    {
        title: 'Krajský přebor 2026 v rapid šachu družstev',
        description: 'Čtyřčlenná družstva hráčů registrovaných u ŠSČR v Šachovém svazu Libereckého kraje. Tempo 2×15 min + 5 s na tah, švýcarský systém na 9 kol. Přihlášky do 17. 4. 2026 na email: tomas.duran@seznam.cz. Vklad 400 Kč za družstvo. Ceny: 1. místo 1 600 Kč, 2. místo 1 200 Kč, 3. místo 800 Kč.',
        startDate: new Date('2026-04-19T08:30:00'),
        endDate: new Date('2026-04-19T17:30:00'),
        location: 'Sokolovna v Mašově (z Turnova cca 4 km směr Sobotka)',
        category: 'tournament',
        ageGroup: 'open',
        eventType: 'team',
        timeControl: 'rapid',
        registrationDeadline: new Date('2026-04-17T23:59:00'),
        presentationEnd: '9:15',
        entryFee: '400 Kč / družstvo',
        organizerContact: 'Ing. Zdenek Maršálek, mobil: 602 365 904, e-mail: zdenek.marsalek@sachyturnov.cz',
        url: 'https://sachy.org/wp-content/uploads/2026/04/KP2026druzstva-Rapid.pdf',
        isInternal: false,
        isPublic: true,
    },
    {
        title: 'Krajský přebor 2026 v bleskovém šachu družstev',
        description: 'Čtyřčlenná družstva hráčů registrovaných u ŠSČR v Šachovém svazu Libereckého kraje. Tempo 2×4 min + 2 s na tah, švýcarský systém. Přihlášky do 17. 4. 2026 na email: tomas.duran@seznam.cz. Vklad 400 Kč za družstvo. Ceny: 1. místo 1 600 Kč, 2. místo 1 200 Kč, 3. místo 800 Kč.',
        startDate: new Date('2026-04-18T09:00:00'),
        endDate: new Date('2026-04-18T15:30:00'),
        location: 'Sokolovna v Mašově (z Turnova cca 4 km směr Sobotka)',
        category: 'tournament',
        ageGroup: 'open',
        eventType: 'team',
        timeControl: 'blitz',
        registrationDeadline: new Date('2026-04-17T23:59:00'),
        presentationEnd: '9:45',
        entryFee: '400 Kč / družstvo',
        organizerContact: 'Ing. Zdenek Maršálek, mobil: 602 365 904, e-mail: zdenek.marsalek@sachyturnov.cz',
        url: 'https://sachy.org/wp-content/uploads/2026/04/KP2026druzstva-Blesk.pdf',
        isInternal: false,
        isPublic: true,
    },
];

async function main() {
    for (const evt of events) {
        const existing = await prisma.event.findFirst({
            where: { title: evt.title }
        });
        if (existing) {
            console.log(`⏭️  Již existuje: ${evt.title}`);
            continue;
        }
        const created = await prisma.event.create({ data: evt });
        console.log(`✅ Vytvořeno: ${created.title} (ID: ${created.id})`);
    }
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
