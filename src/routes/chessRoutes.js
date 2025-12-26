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
    getOpeningTree
} from '../controllers/chessController.js';

const router = express.Router();

// All chess database routes require MEMBER role
router.use(requireRole('MEMBER'));

// Player search
router.get('/players', searchPlayers);

// Player statistics
router.get('/players/:name/stats', getPlayerStats);

// Games list with filtering
router.get('/games', getGames);

// Single game
router.get('/games/:id', getGameById);

// Opening tree
router.get('/tree', getOpeningTree);

export default router;
