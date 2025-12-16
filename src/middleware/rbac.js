/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Role hierarchy: USER < ADMIN < SUPERADMIN
 * Each higher role has all permissions of lower roles.
 */

// Role hierarchy values (higher = more permissions)
const ROLE_HIERARCHY = {
    USER: 1,
    ADMIN: 2,
    SUPERADMIN: 3
};

/**
 * Middleware factory that requires a minimum role level
 * @param {string} minRole - Minimum required role ('USER', 'ADMIN', 'SUPERADMIN')
 * @returns {Function} Express middleware
 */
export function requireRole(minRole) {
    return (req, res, next) => {
        // authMiddleware should have already attached user to request
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userRole = req.user.role || 'USER';
        const userLevel = ROLE_HIERARCHY[userRole] || 0;
        const requiredLevel = ROLE_HIERARCHY[minRole] || 999;

        if (userLevel < requiredLevel) {
            console.warn(`RBAC: User ${req.user.username} (${userRole}) tried to access ${minRole}-only resource`);
            return res.status(403).json({
                error: 'Insufficient permissions',
                required: minRole,
                current: userRole
            });
        }

        next();
    };
}

/**
 * Convenience middleware for admin-only routes
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Convenience middleware for superadmin-only routes
 */
export const requireSuperadmin = requireRole('SUPERADMIN');

/**
 * Check if a user has at least the specified role
 * @param {object} user - User object with role property
 * @param {string} minRole - Minimum required role
 * @returns {boolean}
 */
export function hasRole(user, minRole) {
    if (!user || !user.role) return false;
    const userLevel = ROLE_HIERARCHY[user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 999;
    return userLevel >= requiredLevel;
}

export default { requireRole, requireAdmin, requireSuperadmin, hasRole };
