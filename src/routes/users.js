import express from 'express';
import { getAllUsers, createUser, deleteUser } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = express.Router();

// All routes require authentication and superadmin role
router.use(authMiddleware);
router.use(requireRole('superadmin'));

router.get('/', getAllUsers);
router.post('/', createUser);
router.delete('/:id', deleteUser);

export default router;
