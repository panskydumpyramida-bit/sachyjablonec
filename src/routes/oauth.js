import express from 'express';
import passport from '../config/passport.js';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Initiate Google OAuth
// Initiate Google OAuth (supports Login and Linking)
router.get('/google', (req, res, next) => {
    const token = req.query.token;
    const options = {
        scope: ['profile', 'email'],
        session: false
    };

    // If token is provided, pass it as state for linking account
    if (token) {
        options.state = token;
    }

    passport.authenticate('google', options)(req, res, next);
});

// Google OAuth callback
router.get('/google/callback',
    passport.authenticate('google', {
        session: false,
        failureRedirect: '/login-failed'
    }),
    (req, res) => {
        try {
            const user = req.user;

            // Generate JWT token
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Check if this was likely a linking action
            // If we have a state token (we can't check it easily here unless we passed it through), 
            // but we can check if the user object looks "setup".
            // Actually, for linking, we want to go back to Account page.

            // Check state from query (Google echoes it back)
            const wasLinking = req.query.state ? true : false;

            if (wasLinking) {
                // If linking, redirect back to account page with success indicator
                return res.redirect(`/account.html?auth_token=${token}&linked=true`);
            }

            // Normal Login Flow
            // Check if user needs to set username (temp username pattern)
            const needsUsername = user.username.startsWith('user_') || user.needsUsername;

            const redirectUrl = needsUsername
                ? `/?auth_token=${token}&needs_username=true`
                : `/?auth_token=${token}`;

            res.redirect(redirectUrl);
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect('/login-failed');
        }
    }
);

// Set username for OAuth users (first time setup)
router.post('/set-username', authMiddleware, async (req, res) => {
    try {
        const { username } = req.body;
        const userId = req.user.id;

        if (!username || username.length < 3 || username.length > 30) {
            return res.status(400).json({ error: 'Přezdívka musí mít 3-30 znaků' });
        }

        // Check if username is alphanumeric with underscores
        if (!/^[a-zA-Z0-9_áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]+$/.test(username)) {
            return res.status(400).json({ error: 'Přezdívka může obsahovat pouze písmena, čísla a podtržítka' });
        }

        // Check if username is taken
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing && existing.id !== userId) {
            return res.status(400).json({ error: 'Tato přezdívka je již obsazena' });
        }

        // Update username
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { username }
        });

        // Generate new token with updated username
        const token = jwt.sign(
            { id: updatedUser.id, username: updatedUser.username, role: updatedUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role
            }
        });
    } catch (error) {
        console.error('Set username error:', error);
        res.status(500).json({ error: 'Nepodařilo se nastavit přezdívku' });
    }
});

export default router;
