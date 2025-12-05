import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Try using direct IP
    const originalUrl = process.env.DATABASE_URL;
    // Replace hostname with IP
    const ipUrl = originalUrl.replace('maglev.proxy.rlwy.net', '66.33.22.251');

    console.log('Testing database connection with IP...');
    console.log('URL:', ipUrl);

    const prismaIP = new PrismaClient({
        datasources: {
            db: {
                url: ipUrl
            }
        }
    });

    try {
        await prismaIP.$connect();
        console.log('✅ Connected successfully with IP!');
        const userCount = await prismaIP.user.count();
        console.log('User count:', userCount);
    } catch (e) {
        console.error('❌ Connection failed:', e.message);
    } finally {
        await prismaIP.$disconnect();
    }
}

main();
