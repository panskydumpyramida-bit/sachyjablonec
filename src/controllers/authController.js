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
                // Temporary: Grant MEMBER access for testing until End of Jan 2026
                role: (new Date() < new Date('2026-02-01')) ? 'MEMBER' : 'USER'
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
                role: user.role,
                realName: user.realName,
                club: user.club,
                useRealName: user.useRealName,
                googleId: user.googleId,
                createdAt: user.createdAt
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
                realName: true,
                club: true,
                useRealName: true,
                googleId: true,
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

export const updateProfile = async (req, res) => {
    try {
        const { realName, club, useRealName } = req.body;
        const userId = req.user.id;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                realName: realName || null,
                club: club || null,
                useRealName: useRealName === true
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                realName: true,
                club: true,
                useRealName: true,
                googleId: true,
                createdAt: true
            }
        });

        res.json({
            success: true,
            user: updatedUser
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Současné i nové heslo jsou povinné' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Nové heslo musí mít alespoň 6 znaků' });
        }

        // Get current user
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ error: 'Uživatel nenalezen' });
        }

        // Check if user has a password (OAuth users might not)
        if (!user.passwordHash) {
            return res.status(400).json({ error: 'Tento účet používá přihlášení přes Google a nemá nastavené heslo' });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Nesprávné současné heslo' });
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Update password
        await prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newPasswordHash }
        });

        res.json({ success: true, message: 'Heslo bylo úspěšně změněno' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Nepodařilo se změnit heslo' });
    }
};

export const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        // Delete user's comments first (foreign key constraint)
        await prisma.comment.deleteMany({ where: { authorId: userId } });

        // Delete user's puzzle results
        await prisma.puzzleRaceResult.deleteMany({ where: { userId } });

        // Delete user's recorded games
        await prisma.gameRecorded.deleteMany({ where: { userId } });

        // Delete the user
        await prisma.user.delete({ where: { id: userId } });

        res.json({ success: true, message: 'Účet byl smazán' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
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
                        role: 'ADMIN'
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
