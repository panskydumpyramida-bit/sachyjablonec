/**
 * Blunder Analysis API Routes
 * GET /:playerName — cached blunders from DB
 * GET /:playerName/status — scan progress
 * POST /:playerName/scan — trigger analysis of next batch
 */

import express from 'express';
import { getPlayerBlunders, getPlayerStatus, scanPlayerGames } from '../services/blunderService.js';

const router = express.Router();

// Get cached blunders for player
router.get('/:playerName', async (req, res) => {
    try {
        const { playerName } = req.params;
        const threshold = parseFloat(req.query.threshold) || 12;

        const blunders = await getPlayerBlunders(playerName, threshold);
        res.json(blunders);
    } catch (error) {
        console.error('[Blunder] Get error:', error);
        res.status(500).json({ error: 'Failed to fetch blunders' });
    }
});

// Get scan status for player
router.get('/:playerName/status', async (req, res) => {
    try {
        const { playerName } = req.params;
        const status = await getPlayerStatus(playerName);
        res.json(status);
    } catch (error) {
        console.error('[Blunder] Status error:', error);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// Trigger scan for player (max 10 new games per day)
router.post('/:playerName/scan', async (req, res) => {
    try {
        const { playerName } = req.params;
        const result = await scanPlayerGames(playerName);

        if (result.error === 'daily_limit') {
            return res.status(429).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('[Blunder] Scan error:', error);
        res.status(500).json({ error: 'Scan failed' });
    }
});

export default router;
