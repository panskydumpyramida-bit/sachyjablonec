
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const password = await bcrypt.hash('admin123', 10);

    // Upsert admin user
    const user = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {
            passwordHash: password,
            role: 'SUPERADMIN'
        },
        create: {
            username: 'admin',
            email: 'admin@example.com',
            passwordHash: password,
            role: 'SUPERADMIN'
        }
    });

    console.log('Admin user created/updated:', user.username);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
