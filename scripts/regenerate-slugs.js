// Jednorázová regenerace slugů z titulků (oprava rozbité transliterace diakritiky).
// Spuštění: node scripts/regenerate-slugs.js          (dry-run, jen vypíše změny)
//           node scripts/regenerate-slugs.js --apply  (zapíše do DB)
import { PrismaClient } from '@prisma/client';
import { createSlug } from '../src/utils/slug.js';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const all = await prisma.news.findMany({
    select: { id: true, title: true, slug: true },
    orderBy: { id: 'asc' }
});

const used = new Set();
const changes = [];
for (const n of all) {
    const base = createSlug(n.title) || `clanek-${n.id}`;
    let candidate = base;
    let c = 1;
    while (used.has(candidate)) candidate = `${base}-${c++}`;
    used.add(candidate);
    if (candidate !== n.slug) changes.push({ id: n.id, from: n.slug, to: candidate });
}

console.log(`Článků: ${all.length}, ke změně: ${changes.length}${apply ? '' : ' (dry-run, spusť s --apply)'}`);
for (const ch of changes) console.log(`  ${ch.id}: ${ch.from} -> ${ch.to}`);

if (apply && changes.length) {
    // Fáze 1: dočasné slugy (nový slug jednoho článku může kolidovat se starým slugem jiného)
    for (const ch of changes) {
        await prisma.news.update({ where: { id: ch.id }, data: { slug: `tmp-${ch.id}-${Date.now()}` } });
    }
    // Fáze 2: finální slugy
    for (const ch of changes) {
        await prisma.news.update({ where: { id: ch.id }, data: { slug: ch.to } });
    }
    console.log('Hotovo.');
}

await prisma.$disconnect();
