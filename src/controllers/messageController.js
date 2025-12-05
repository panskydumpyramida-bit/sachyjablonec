import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CLUB_PASSWORD = process.env.CLUB_PASSWORD || 'gambitjbc';

// Middleware to check password
export const checkClubPassword = (req, res, next) => {
    const password = req.headers['x-club-password'];
    if (password !== CLUB_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

export const getMessages = async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching messages' });
    }
};

export const createMessage = async (req, res) => {
    try {
        const { author, content } = req.body;
        if (!author || !content) {
            return res.status(400).json({ error: 'Author and content are required' });
        }

        const message = await prisma.message.create({
            data: { author, content }
        });
        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ error: 'Error creating message' });
    }
};
