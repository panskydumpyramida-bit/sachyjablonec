import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch fresh user data from DB to ensure role is up-to-date
        const user = await prisma.user.findUnique({
            where: { id: decoded.id }
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Role hierarchy: USER < MEMBER < AUTHOR < ADMIN < SUPERADMIN
// Čísla schválně stejná jako v src/middleware/rbac.js, ať jdou obě mapy porovnat okem.
const ROLE_HIERARCHY = { 'USER': 1, 'MEMBER': 2, 'AUTHOR': 3, 'ADMIN': 4, 'SUPERADMIN': 5 };

/**
 * Middleware factory to require a minimum role
 * Usage: router.use(requireRole('MEMBER'))
 */
export const requireRole = (minRole) => {
    return async (req, res, next) => {
        try {
            // First, run auth middleware to get user
            const token = req.headers.authorization?.split(' ')[1];

            if (!token) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await prisma.user.findUnique({
                where: { id: decoded.id }
            });

            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }

            req.user = user;

            // Check role hierarchy
            const userLevel = ROLE_HIERARCHY[user.role] || 0;
            const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

            if (userLevel < requiredLevel) {
                return res.status(403).json({
                    error: `Requires ${minRole} role or higher`,
                    yourRole: user.role
                });
            }

            next();
        } catch (error) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    };
};
