import express from 'express';
import { getAllNews, getNewsById, createNews, updateNews, deleteNews, togglePublish, shareToFacebook, shareToInstagramStories, incrementViewCount } from '../controllers/newsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllNews);
router.get('/:id', getNewsById);
router.post('/:id/view', incrementViewCount);  // Track views (no auth needed)

// Protected routes
router.post('/', authMiddleware, createNews);
router.put('/:id', authMiddleware, updateNews);
router.delete('/:id', authMiddleware, deleteNews);
router.patch('/:id/publish', authMiddleware, togglePublish);
router.post('/:id/share-to-facebook', authMiddleware, shareToFacebook);
router.post('/:id/share-to-instagram-story', authMiddleware, shareToInstagramStories);

export default router;

