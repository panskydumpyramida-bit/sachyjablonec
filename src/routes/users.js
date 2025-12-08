import express from 'express';
import { getAllUsers, createUser, deleteUser, updateUser } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = express.Router();

// All routes require authentication and admin or superadmin role
router.use(authMiddleware);
router.use(requireRole(['superadmin', 'admin']));

router.get('/', getAllUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
