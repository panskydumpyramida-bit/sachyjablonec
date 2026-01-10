import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin, requireMember } from '../middleware/rbac.js';
import {
    getAnnouncements,
    createAnnouncement,
    deleteAnnouncement
} from '../controllers/announcementController.js';

const router = express.Router();

// Get announcements (MEMBER+)
router.get('/', authMiddleware, requireMember, getAnnouncements);

// Admin routes (ADMIN+)
router.post('/', authMiddleware, requireAdmin, createAnnouncement);
router.delete('/:id', authMiddleware, requireAdmin, deleteAnnouncement);

export default router;
