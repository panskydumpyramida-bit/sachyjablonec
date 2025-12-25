import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin, requireMember } from '../middleware/rbac.js';
import {
    getPublicEvents,
    getInternalEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    exportIcal
} from '../controllers/eventsController.js';

const router = express.Router();

// Public routes
router.get('/', getPublicEvents);
router.get('/ical', exportIcal);

// Protected routes (MEMBER+)
router.get('/internal', authMiddleware, requireMember, getInternalEvents);
router.get('/ical/internal', authMiddleware, requireMember, (req, res) => {
    req.query.internal = 'true';
    exportIcal(req, res);
});

// Single event (public or protected based on event type)
router.get('/:id', getEventById);

// Admin routes (ADMIN+)
router.post('/', authMiddleware, requireAdmin, createEvent);
router.put('/:id', authMiddleware, requireAdmin, updateEvent);
router.delete('/:id', authMiddleware, requireAdmin, deleteEvent);

export default router;
