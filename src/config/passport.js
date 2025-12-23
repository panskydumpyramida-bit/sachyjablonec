import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configure Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails?.[0]?.value;
        const googleId = profile.id;

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

        // Check if user exists by email (to link existing account)
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
                role: 'USER'
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
