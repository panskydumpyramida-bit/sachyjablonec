import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// --- Diagram API ---
router.get('/diagrams', authMiddleware, async (req, res) => {
    try {
        const where = {};
        if (req.query.mine === 'true' && req.user) {
            where.userId = req.user.id;
        }
        const diagrams = await prisma.diagram.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { user: { select: { username: true } } }
        });
        res.json(diagrams);
    } catch (error) {
        console.error('Error fetching diagrams:', error);
        res.status(500).json({ error: 'Failed to fetch diagrams' });
    }
});

router.get('/diagrams/:id', authMiddleware, async (req, res) => {
    try {
        const diagram = await prisma.diagram.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { user: { select: { username: true } } }
        });
        if (!diagram) return res.status(404).json({ error: 'Diagram not found' });
        res.json(diagram);
    } catch (error) {
        console.error('Error fetching diagram:', error);
        res.status(500).json({ error: 'Failed to fetch diagram' });
    }
});

router.post('/diagrams', authMiddleware, async (req, res) => {
    try {
        const { fen, annotations, solution, name, description } = req.body;

        if (!fen) return res.status(400).json({ error: 'FEN string is required' });

        const diagram = await prisma.diagram.create({
            data: {
                fen,
                annotations: annotations || {},
                solution: solution || {}, 
                name: name || `Diagram ${new Date().toLocaleString('cs-CZ')}`,
                description,
                userId: req.user.id
            }
        });
        res.json(diagram);
    } catch (error) {
        console.error('Error creating diagram:', error);
        res.status(500).json({ error: 'Failed to create diagram' });
    }
});

router.put('/diagrams/:id', authMiddleware, async (req, res) => {
    try {
        const { fen, annotations, solution, name, description } = req.body;
        const id = parseInt(req.params.id);

        const existing = await prisma.diagram.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Diagram not found' });

        const diagram = await prisma.diagram.update({
            where: { id },
            data: {
                fen,
                annotations: annotations || {},
                solution: solution || {},
                name,
                description
            }
        });
        res.json(diagram);
    } catch (error) {
        console.error('Error updating diagram:', error);
        res.status(500).json({ error: 'Failed to update diagram' });
    }
});

router.delete('/diagrams/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.diagram.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting diagram:', error);
        res.status(500).json({ error: 'Failed to delete diagram' });
    }
});

// --- Fragment API ---
router.get('/fragments', async (req, res) => {
    try {
        const where = {};
        if (req.query.mine === 'true') {
            try {
                const authHeader = req.headers.authorization;
                if (authHeader) {
                    const token = authHeader.replace('Bearer ', '');
                    const jwt = await import('jsonwebtoken');
                    const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
                    where.userId = decoded.id;
                }
            } catch (e) { /* ignore auth errors for filtering */ }
        }
        const fragments = await prisma.fragment.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: { user: { select: { username: true } } }
        });
        res.json(fragments);
    } catch (error) {
        console.error('Error fetching fragments:', error);
        res.status(500).json({ error: 'Failed to fetch fragments' });
    }
});

router.get('/fragments/:id', async (req, res) => {
    try {
        const fragment = await prisma.fragment.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { user: { select: { username: true } } }
        });
        if (!fragment) return res.status(404).json({ error: 'Fragment not found' });
        res.json(fragment);
    } catch (error) {
        console.error('Error fetching fragment:', error);
        res.status(500).json({ error: 'Failed to fetch fragment' });
    }
});

router.post('/fragments', authMiddleware, async (req, res) => {
    try {
        const { title, pgn, startFen, fromMove, toMove, sourceGameId, white, black } = req.body;

        if (!pgn || !startFen) return res.status(400).json({ error: 'PGN and startFen are required' });

        const fragment = await prisma.fragment.create({
            data: {
                title: title || `Fragment ${new Date().toLocaleString('cs-CZ')}`,
                pgn,
                startFen,
                fromMove: fromMove || 1,
                toMove: toMove || 99,
                sourceGameId: sourceGameId || null,
                white: white || null,
                black: black || null,
                userId: req.user.id
            }
        });
        res.json(fragment);
    } catch (error) {
        console.error('Error creating fragment:', error);
        res.status(500).json({ error: 'Failed to create fragment' });
    }
});

router.delete('/fragments/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.fragment.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting fragment:', error);
        res.status(500).json({ error: 'Failed to delete fragment' });
    }
});

export default router;
