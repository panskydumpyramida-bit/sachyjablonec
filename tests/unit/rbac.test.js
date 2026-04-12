import { describe, it, expect, vi } from 'vitest';
import { requireRole, requireMember, requireAdmin, requireSuperadmin, hasRole } from '../../src/middleware/rbac.js';

// Helper to create mock req/res/next
function createMocks(user = null) {
    const req = { user };
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    return { req, res, next };
}

describe('RBAC middleware', () => {
    describe('hasRole', () => {
        it('returns false for null user', () => {
            expect(hasRole(null, 'USER')).toBe(false);
        });

        it('returns false for user without role', () => {
            expect(hasRole({}, 'USER')).toBe(false);
        });

        it('USER meets USER requirement', () => {
            expect(hasRole({ role: 'USER' }, 'USER')).toBe(true);
        });

        it('ADMIN meets MEMBER requirement', () => {
            expect(hasRole({ role: 'ADMIN' }, 'MEMBER')).toBe(true);
        });

        it('MEMBER does not meet ADMIN requirement', () => {
            expect(hasRole({ role: 'MEMBER' }, 'ADMIN')).toBe(false);
        });

        it('SUPERADMIN meets all requirements', () => {
            expect(hasRole({ role: 'SUPERADMIN' }, 'USER')).toBe(true);
            expect(hasRole({ role: 'SUPERADMIN' }, 'MEMBER')).toBe(true);
            expect(hasRole({ role: 'SUPERADMIN' }, 'ADMIN')).toBe(true);
            expect(hasRole({ role: 'SUPERADMIN' }, 'SUPERADMIN')).toBe(true);
        });
    });

    describe('requireRole middleware', () => {
        it('returns 401 if no user attached', () => {
            const { req, res, next } = createMocks(null);
            requireRole('MEMBER')(req, res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        it('returns 403 if role insufficient', () => {
            const { req, res, next } = createMocks({ username: 'test', role: 'USER' });
            requireRole('ADMIN')(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                error: 'Insufficient permissions',
                required: 'ADMIN',
                current: 'USER',
            }));
            expect(next).not.toHaveBeenCalled();
        });

        it('calls next() if role sufficient', () => {
            const { req, res, next } = createMocks({ username: 'admin', role: 'ADMIN' });
            requireRole('MEMBER')(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('calls next() for exact role match', () => {
            const { req, res, next } = createMocks({ username: 'member', role: 'MEMBER' });
            requireRole('MEMBER')(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('convenience middlewares', () => {
        it('requireMember blocks USER', () => {
            const { req, res, next } = createMocks({ username: 'u', role: 'USER' });
            requireMember(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('requireAdmin allows SUPERADMIN', () => {
            const { req, res, next } = createMocks({ username: 'sa', role: 'SUPERADMIN' });
            requireAdmin(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('requireSuperadmin blocks ADMIN', () => {
            const { req, res, next } = createMocks({ username: 'a', role: 'ADMIN' });
            requireSuperadmin(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });
});
