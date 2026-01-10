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

// Password Reset - Request
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({ message: 'If the account exists, a password reset email has been sent.' });
        }

        // Check if user has a password (not OAuth-only)
        if (!user.passwordHash && user.googleId) {
            return res.json({ message: 'If the account exists, a password reset email has been sent.' });
        }

        // Generate reset token
        const crypto = await import('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

        await prisma.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExpiry }
        });

        // Send email
        const { sendEmail } = await import('../utils/mailer.js');
        const resetUrl = `${process.env.FRONTEND_URL || 'https://sachyjablonec.cz'}/reset-password.html?token=${resetToken}`;

        await sendEmail(
            email,
            'Obnovení hesla - Šachový oddíl Bižuterie',
            `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d4af37;">Obnovení hesla</h2>
                <p>Obdrželi jsme žádost o obnovení hesla pro váš účet.</p>
                <p>Klikněte na tlačítko níže pro nastavení nového hesla:</p>
                <p style="text-align: center; margin: 2rem 0;">
                    <a href="${resetUrl}" 
                       style="background: #d4af37; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        Nastavit nové heslo
                    </a>
                </p>
                <p style="color: #666; font-size: 0.9rem;">
                    Tento odkaz je platný 1 hodinu. Pokud jste o obnovení hesla nežádali, tento email ignorujte.
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 2rem 0;">
                <p style="color: #999; font-size: 0.8rem;">
                    Šachový oddíl TJ Bižuterie Jablonec nad Nisou
                </p>
            </div>
            `
        );

        res.json({ message: 'If the account exists, a password reset email has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
};

// Password Reset - Set new password
export const resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: { gt: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                resetToken: null,
                resetTokenExpiry: null
            }
        });

        res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};
