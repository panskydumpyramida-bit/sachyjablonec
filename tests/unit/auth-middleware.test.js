import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock PrismaClient before importing the middleware
const mockFindUnique = vi.fn();
vi.mock('@prisma/client', () => {
    return {
        PrismaClient: class MockPrismaClient {
            constructor() {
                this.user = { findUnique: mockFindUnique };
            }
        },
    };
});

// Set JWT_SECRET before importing
process.env.JWT_SECRET = 'test-secret-key';

const { authMiddleware } = await import('../../src/middleware/auth.js');

function createMocks(authHeader = null) {
    const req = { headers: {} };
    if (authHeader) req.headers.authorization = authHeader;
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    return { req, res, next };
}

describe('authMiddleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 when no token provided', async () => {
        const { req, res, next } = createMocks();
        await authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 for invalid token', async () => {
        const { req, res, next } = createMocks('Bearer invalid-token');
        await authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
        expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when user not found in DB', async () => {
        const token = jwt.sign({ id: 999 }, 'test-secret-key');
        mockFindUnique.mockResolvedValueOnce(null);

        const { req, res, next } = createMocks(`Bearer ${token}`);
        await authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
        expect(next).not.toHaveBeenCalled();
    });

    it('attaches user to req and calls next() on valid token', async () => {
        const mockUser = { id: 1, username: 'admin', role: 'ADMIN' };
        const token = jwt.sign({ id: 1 }, 'test-secret-key');
        mockFindUnique.mockResolvedValueOnce(mockUser);

        const { req, res, next } = createMocks(`Bearer ${token}`);
        await authMiddleware(req, res, next);

        expect(req.user).toEqual(mockUser);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 401 for expired token', async () => {
        const token = jwt.sign({ id: 1 }, 'test-secret-key', { expiresIn: '0s' });

        // Small delay to ensure token is expired
        await new Promise(r => setTimeout(r, 10));

        const { req, res, next } = createMocks(`Bearer ${token}`);
        await authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });
});
