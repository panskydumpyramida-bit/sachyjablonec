import express from 'express';
import { getAllNews, getNewsById, createNews, updateNews, deleteNews, togglePublish } from '../controllers/newsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllNews);
router.get('/:id', getNewsById);

// Protected routes
router.post('/', authMiddleware, createNews);
router.put('/:id', authMiddleware, updateNews);
router.delete('/:id', authMiddleware, deleteNews);
router.patch('/:id/publish', authMiddleware, togglePublish);

export default router;
