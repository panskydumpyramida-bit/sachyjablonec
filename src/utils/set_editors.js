import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setEditors() {
    try {
        console.log('Searching for users to downgrade to "editor"...');

        // Find users with names like Filip or Lukas/Lukáš
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { username: { contains: 'Filip', mode: 'insensitive' } },
                    { username: { contains: 'Lukas', mode: 'insensitive' } },
                    { username: { contains: 'Lukáš', mode: 'insensitive' } }
                ]
            }
        });

        console.log(`Found ${users.length} users:`, users.map(u => u.username));

        for (const user of users) {
            // Skip if already superadmin just in case (though unlikely)
            if (user.role === 'superadmin') {
                console.log(`Skipping ${user.username} (superadmin)`);
                continue;
            }

            await prisma.user.update({
                where: { id: user.id },
                data: { role: 'editor' }
            });
            console.log(`Updated ${user.username} to role "editor"`);
        }

        console.log('Done.');
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

setEditors();
