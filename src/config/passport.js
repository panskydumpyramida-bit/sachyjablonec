import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configure Google Strategy ONLY if credentials are available
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
        passReqToCallback: true
    }, async (req, accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            const googleId = profile.id;

            // Check for Linking State (JWT token passed in state)
            const state = req.query.state;
            let linkingUserId = null;

            if (state) {
                try {
                    // Try to decode state as a JWT (it might be our auth token)
                    // We need to import jwt here if not available, but it might be easier to rely on a custom "link" flow
                    // For now, let's assume the state IS the token.
                    // Note: In production, we should probably sign a specific "link_token" 
                    // but using the main auth token is acceptable for this scope if not expired.
                    // We need to dynamic import or require jwt.
                    const jwt = await import('jsonwebtoken');
                    const decoded = jwt.default.verify(state, process.env.JWT_SECRET);
                    if (decoded && decoded.id) {
                        linkingUserId = decoded.id;
                    }
                } catch (e) {
                    // State was not a valid token, ignore (might be normal login)
                }
            }

            if (linkingUserId) {
                // LINKING FLOW
                console.log(`Linking Google Account ${googleId} to User ${linkingUserId}`);

                // Check if this Google ID is already used by another user
                const existingGoogleUser = await prisma.user.findUnique({ where: { googleId } });
                if (existingGoogleUser && existingGoogleUser.id !== linkingUserId) {
                    return done(new Error('Tento Google účet je již propojen s jiným uživatelem'), null);
                }

                // Update the current user
                const updatedUser = await prisma.user.update({
                    where: { id: linkingUserId },
                    data: { googleId: googleId }
                });
                return done(null, updatedUser);
            }

            // NORMAL LOGIN FLOW
            if (!email) {
                return done(new Error('No email provided by Google'), null);
            }

            // Check if user exists by googleId first
            let user = await prisma.user.findUnique({
                where: { googleId: googleId }
            });

            if (user) {
                return done(null, user);
            }

            // Check if user exists by email (to link existing account automatically)
            user = await prisma.user.findUnique({
                where: { email: email }
            });

            if (user) {
                // Link existing account with Google
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { googleId: googleId }
                });
                return done(null, user);
            }

            // New user - create with unique temporary username
            const timestamp = Date.now().toString(36);
            const randomPart = Math.random().toString(36).substring(2, 6);
            const tempUsername = `user_${timestamp}${randomPart}`;

            user = await prisma.user.create({
                data: {
                    email: email,
                    googleId: googleId,
                    username: tempUsername,
                    // Temporary: Grant MEMBER access for testing until End of Jan 2026
                    role: (new Date() < new Date('2026-02-01')) ? 'MEMBER' : 'USER'
                    // passwordHash is null for OAuth users
                }
            });

            // Mark as needing username setup
            user.needsUsername = true;

            return done(null, user);
        } catch (error) {
            console.error('Google OAuth error:', error);
            return done(error, null);
        }
    }));
} else {
    console.log('Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing');
}

// Serialize user for session (we don't use sessions, using JWT instead)
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

export default passport;
