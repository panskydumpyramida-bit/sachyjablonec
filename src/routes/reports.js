import express from 'express';
import { createReport, getReport, updateReport, addGameToReport, deleteGame } from '../controllers/reportsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/:id', getReport);

// Protected routes
router.post('/', authMiddleware, createReport);
router.put('/:id', authMiddleware, updateReport);
router.post('/:reportId/games', authMiddleware, addGameToReport);
router.delete('/games/:gameId', authMiddleware, deleteGame);

export default router;
