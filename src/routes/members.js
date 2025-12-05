import express from 'express';
import { getAllMembers, createMember, updateMember, deleteMember } from '../controllers/memberController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllMembers);

// Protected routes
router.post('/', authMiddleware, createMember);
router.put('/:id', authMiddleware, updateMember);
router.delete('/:id', authMiddleware, deleteMember);

export default router;
