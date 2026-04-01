/**
 * Chess Database Routes
 * All routes require MEMBER role or higher
 */

import express from 'express';
import { requireRole } from '../middleware/auth.js';
import {
    searchPlayers,
    getGames,
    getGameById,
    getPlayerStats,
    getOpeningTree,
    importGames,
    checkDuplicates,
    cleanDuplicates
} from '../controllers/chessController.js';

const router = express.Router();

// === PUBLIC routes (no auth required — used by Blunder Grid & public search) ===
router.get('/players', searchPlayers);
router.get('/players/:name/stats', getPlayerStats);
router.get('/games', getGames);
router.get('/games/:id', getGameById);
router.get('/tree', getOpeningTree);

// === PROTECTED routes (require MEMBER role) ===
router.use(requireRole('MEMBER'));

// Import games (ADMIN only - bypasses MEMBER check internally)
router.post('/import', importGames);

// Check duplicates (Admin tool)
router.get('/duplicates', checkDuplicates);
router.delete('/duplicates', cleanDuplicates);

export default router;
