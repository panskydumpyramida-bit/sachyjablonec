import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import {
    getTimeline,
    getTimelineEntryById,
    createTimelineEntry,
    updateTimelineEntry,
    deleteTimelineEntry,
} from '../controllers/timelineController.js';

const router = express.Router();

// Public
router.get('/', getTimeline);
router.get('/:id', getTimelineEntryById);

// Admin
router.post('/', authMiddleware, requireAdmin, createTimelineEntry);
router.put('/:id', authMiddleware, requireAdmin, updateTimelineEntry);
router.delete('/:id', authMiddleware, requireAdmin, deleteTimelineEntry);

export default router;
