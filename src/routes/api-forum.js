import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
    getTopics,
    getTopic,
    createTopic,
    createPost,
    togglePin,
    toggleLock,
    deleteTopic
} from '../controllers/forumController.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Member routes
router.get('/', getTopics);
router.get('/:id', getTopic);
router.post('/', createTopic);
router.post('/:id/posts', createPost);

// Admin routes
router.put('/:id/pin', requireRole('ADMIN'), togglePin);
router.put('/:id/lock', requireRole('ADMIN'), toggleLock);
router.delete('/:id', requireRole('ADMIN'), deleteTopic);

export default router;
