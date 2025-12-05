import express from 'express';
import { getMessages, createMessage, checkClubPassword } from '../controllers/messageController.js';

const router = express.Router();

// Apply password check to all message routes
router.use(checkClubPassword);

router.get('/', getMessages);
router.post('/', createMessage);

export default router;
