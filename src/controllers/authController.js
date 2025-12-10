import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email and password required' });
        }

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ username }, { email }] }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                email,
                passwordHash,
                role: 'user' // SECURITY FIX: Default to 'user', not 'admin'
            }
        });

        res.status(201).json({
            message: 'User created',
            user: { id: user.id, username: user.username, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed', details: error.message });
    }
};

export const login = async (req, res) => {
    try {
        let { username, password } = req.body;
        username = username?.trim();
        password = password?.trim();

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.passwordHash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

export const me = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
};

export const fixAdmins = async (req, res) => {
    try {
        const usersToAdd = [
            { username: 'filip', email: 'filip@sachyjablonec.cz', pass: 'sachy2025' },
            { username: 'lukas', email: 'lukas@sachyjablonec.cz', pass: 'sachy2025' }
        ];

        const results = [];

        for (const u of usersToAdd) {
            const existing = await prisma.user.findFirst({
                where: { OR: [{ username: u.username }, { email: u.email }] }
            });

            if (!existing) {
                const passwordHash = await bcrypt.hash(u.pass, 10);
                await prisma.user.create({
                    data: {
                        username: u.username,
                        email: u.email,
                        passwordHash,
                        role: 'admin'
                    }
                });
                results.push(`Created user ${u.username}`);
            } else {
                results.push(`User ${u.username} already exists`);
            }
        }

        res.json({ message: 'Admin check complete', results });
    } catch (error) {
        console.error('Fix admins error:', error);
        res.status(500).json({ error: error.message });
    }
};
