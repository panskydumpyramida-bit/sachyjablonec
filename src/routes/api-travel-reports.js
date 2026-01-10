import express from 'express';
import { getMyReports, createReport } from '../controllers/travelReportController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Všechny endpointy vyžadují přihlášení
router.use(authMiddleware);

router.post('/', createReport);
router.get('/my', getMyReports);

export default router;
