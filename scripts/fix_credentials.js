import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting credential fix...');

    // Password for all admins — nikdy nezapisovat natvrdo, repo je veřejné
    const password = process.env.SEED_PASSWORD;
    if (!password) {
        console.error('❌ Chybí proměnná SEED_PASSWORD.');
        console.error('   Spusť skript takto: SEED_PASSWORD="<heslo>" node scripts/fix_credentials.js');
        process.exit(1);
    }
    const hash = await bcrypt.hash(password, 10);

    const admins = [
        { username: 'antonin', email: 'antonin@sachyjablonec.cz' },
        { username: 'filip', email: 'filip@sachyjablonec.cz' },
        { username: 'lukas', email: 'lukas@sachyjablonec.cz' }
    ];

    for (const admin of admins) {
        try {
            const user = await prisma.user.upsert({
                where: { username: admin.username },
                update: {
                    role: 'ADMIN',
                    passwordHash: hash
                },
                create: {
                    username: admin.username,
                    email: admin.email,
                    passwordHash: hash,
                    role: 'ADMIN'
                }
            });
            console.log(`✅ Fixed credentials for: ${admin.username}`);
        } catch (e) {
            console.error(`❌ Failed to fix ${admin.username}:`, e.message);
        }
    }
}

main()
    .catch(e => {
        console.error('Fatal error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
