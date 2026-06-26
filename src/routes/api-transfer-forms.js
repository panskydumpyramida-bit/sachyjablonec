import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FORMS_DIR = path.join(__dirname, '../../private/transfer-forms');

const router = express.Router();

router.get('/vacek/base', authMiddleware, requireAdmin, (req, res) => {
    res.setHeader('Content-Disposition', 'inline; filename="prestup_vacek_radomir_predvyplneno.pdf"');
    res.sendFile(path.join(FORMS_DIR, 'prestup_vacek_radomir_predvyplneno.pdf'));
});

router.get('/vacek/preview', authMiddleware, requireAdmin, (req, res) => {
    res.setHeader('Content-Disposition', 'inline; filename="prestup_vacek_radomir_predvyplneno.png"');
    res.sendFile(path.join(FORMS_DIR, 'prestup_vacek_radomir_predvyplneno.png'));
});

export default router;
