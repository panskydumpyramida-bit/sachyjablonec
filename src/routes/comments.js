import express from 'express';
import * as commentController from '../controllers/commentController.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';

const router = express.Router();

// Public route - get latest comment
router.get('/latest', commentController.getLatestComment);

// Public route - get comments for article
router.get('/:newsId', commentController.getComments);

// Protected routes - require login
router.post('/', authMiddleware, commentController.createComment);
router.put('/:id', authMiddleware, commentController.updateComment);
router.delete('/:id', authMiddleware, commentController.deleteComment);

// Admin only - hide/show comments
router.put('/:id/hide', authMiddleware, requireAdmin, commentController.toggleHidden);

export default router;
