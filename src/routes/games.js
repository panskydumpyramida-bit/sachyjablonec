import express from 'express';
import { PrismaClient } from '@prisma/client';
import { checkClubPassword } from '../controllers/messageController.js';

const router = express.Router();
const prisma = new PrismaClient();

// Use club password check for all routes (allows optional user token too)
router.use(checkClubPassword);

// Create new game record
router.post('/', async (req, res) => {
    try {
        const { white, black, result, date, event, pgn } = req.body;

        const game = await prisma.gameRecorded.create({
            data: {
                white: white || '?',
                black: black || '?',
                result: result || '*',
                date: date ? new Date(date) : new Date(),
                event: event || 'Casual Game',
                pgn: pgn || '',
                uploadedBy: req.user ? req.user.id : null // User ID is optional
            }
        });

        res.status(201).json(game);
    } catch (error) {
        console.error('Error saving game:', error);
        res.status(500).json({ error: 'Failed to save game' });
    }
});

// List games (latest first)
router.get('/', async (req, res) => {
    try {
        const games = await prisma.gameRecorded.findMany({
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: { username: true }
                }
            }
        });
        res.json(games);
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});

// Download PGN
router.get('/:id/pgn', async (req, res) => {
    try {
        const game = await prisma.gameRecorded.findUnique({
            where: { id: parseInt(req.params.id) }
        });

        if (!game) return res.status(404).send('Game not found');

        // Force download
        res.setHeader('Content-Disposition', `attachment; filename="game_${game.id}.pgn"`);
        res.setHeader('Content-Type', 'application/x-chess-pgn');
        res.send(game.pgn);
    } catch (error) {
        console.error('Error downloading PGN:', error);
        res.status(500).send('Error downloading file');
    }
});

// Get single game details
router.get('/:id', async (req, res) => {
    try {
        const game = await prisma.gameRecorded.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { user: { select: { username: true } } }
        });
        if (!game) return res.status(404).json({ error: 'Game not found' });
        res.json(game);
    } catch (error) {
        console.error('Error fetching game:', error);
        res.status(500).json({ error: 'Failed to fetch game' });
    }
});

// Update existing game
router.put('/:id', async (req, res) => {
    try {
        const { white, black, result, date, event, pgn } = req.body;
        const gameId = parseInt(req.params.id);

        // Check if game exists
        const existing = await prisma.gameRecorded.findUnique({
            where: { id: gameId }
        });
        if (!existing) return res.status(404).json({ error: 'Game not found' });

        const game = await prisma.gameRecorded.update({
            where: { id: gameId },
            data: {
                white: white || existing.white,
                black: black || existing.black,
                result: result || existing.result,
                date: date ? new Date(date) : existing.date,
                event: event || existing.event,
                pgn: pgn || existing.pgn
            }
        });

        res.json(game);
    } catch (error) {
        console.error('Error updating game:', error);
        res.status(500).json({ error: 'Failed to update game' });
    }
});

// Delete game
router.delete('/:id', async (req, res) => {
    try {
        const gameId = parseInt(req.params.id);
        await prisma.gameRecorded.delete({
            where: { id: gameId }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting game:', error);
        res.status(500).json({ error: 'Failed to delete game' });
    }
});

export default router;
