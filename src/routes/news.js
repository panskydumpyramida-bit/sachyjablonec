import express from 'express';
import { getAllNews, getNewsById, createNews, updateNews, deleteNews, togglePublish, shareToFacebook, shareToInstagramStories, incrementViewCount } from '../controllers/newsController.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin, requireAuthor } from '../middleware/rbac.js';

const router = express.Router();

// Public routes
router.get('/', getAllNews);
router.get('/:id', getNewsById);
router.post('/:id/view', incrementViewCount);  // Track views (no auth needed)

// Protected routes
router.post('/', authMiddleware, requireAuthor, createNews);
router.put('/:id', authMiddleware, requireAuthor, updateNews);
router.delete('/:id', authMiddleware, deleteNews);
router.patch('/:id/publish', authMiddleware, requireAdmin, togglePublish);
router.post('/:id/share-to-facebook', authMiddleware, requireAdmin, shareToFacebook);
router.post('/:id/share-to-instagram-story', authMiddleware, requireAdmin, shareToInstagramStories);

export default router;

