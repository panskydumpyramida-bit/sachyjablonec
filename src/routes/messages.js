import express from 'express';
import { getMessages, createMessage, deleteMessage } from '../controllers/messageController.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireMember, requireAdmin } from '../middleware/rbac.js';

const router = express.Router();

// Member content: require a real logged-in MEMBER (not the legacy club-password gate).
router.use(authMiddleware);

router.get('/', requireMember, getMessages);
router.post('/', requireMember, createMessage);
router.delete('/:id', requireAdmin, deleteMessage);

export default router;
