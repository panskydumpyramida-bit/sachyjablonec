import express from 'express';
import { getMyReports, createReport, getAllReports, updateReportStatus } from '../controllers/travelReportController.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Všechny endpointy vyžadují přihlášení
router.use(authMiddleware);

// User endpoints
router.post('/', createReport);
router.get('/my', getMyReports);

// Admin endpoints
router.get('/all', requireRole('ADMIN'), getAllReports);
router.put('/:id/status', requireRole('ADMIN'), updateReportStatus);

export default router;
