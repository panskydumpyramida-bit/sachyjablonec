import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CLUB_PASSWORD = process.env.CLUB_PASSWORD || 'gambitjbc';
const JWT_SECRET = process.env.JWT_SECRET || 'sachy-jablonec-secret-key-2024';

// Middleware to check password OR admin token
export const checkClubPassword = (req, res, next) => {
    const password = req.headers['x-club-password'];
    const authHeader = req.headers.authorization;

    // Allow club password
    if (password === CLUB_PASSWORD) {
        return next();
    }

    // Allow Bearer token (admin access)
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            return next();
        } catch (e) {
            // Token invalid, fall through to 401
        }
    }

    return res.status(401).json({ error: 'Unauthorized' });
};

export const getMessages = async (req, res) => {
    try {
        const { type = 'chat' } = req.query;
        const messages = await prisma.message.findMany({
            where: { type },
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
        const { author, content, type = 'chat' } = req.body;
        if (!author || !content) {
            return res.status(400).json({ error: 'Author and content are required' });
        }

        const message = await prisma.message.create({
            data: { author, content, type }
        });
        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ error: 'Error creating message' });
    }
};

export const deleteMessage = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.message.delete({
            where: { id: parseInt(id) }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting message' });
    }
};
