import express from 'express';
import { getMessages, createMessage, deleteMessage, checkClubPassword } from '../controllers/messageController.js';

const router = express.Router();

// Apply password check to all message routes
router.use(checkClubPassword);

router.get('/', getMessages);
router.post('/', createMessage);
router.delete('/:id', deleteMessage);

export default router;
