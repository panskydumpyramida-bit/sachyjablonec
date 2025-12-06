import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory:', uploadsDir);
}

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image file!'), false);
        }
    }
});

// Upload image - with multer error handling
router.post('/upload', authMiddleware, (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Soubor je příliš velký (max 5MB)' });
            }
            return res.status(400).json({ error: err.message || 'Chyba při nahrávání souboru' });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nebyl nahrán žádný soubor' });
        }

        console.log('Processing upload:', req.file.originalname, req.file.size, 'bytes');

        const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.webp`;
        const filepath = path.join(__dirname, '../../uploads', filename);

        // Optimize and convert to WebP
        await sharp(req.file.buffer)
            .resize(1200, 800, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .webp({ quality: 85 })
            .toFile(filepath);

        const url = `/uploads/${filename}`;
        console.log('Image saved to:', filepath, 'URL:', url);

        // Save to database
        const image = await prisma.image.create({
            data: {
                filename,
                originalName: req.file.originalname,
                url,
                altText: req.body.altText || null
            }
        });

        res.status(201).json(image);
    } catch (error) {
        console.error('Upload processing error:', error);
        res.status(500).json({ error: 'Chyba při zpracování obrázku: ' + error.message });
    }
});

// Get all images
router.get('/', authMiddleware, async (req, res) => {
    try {
        const images = await prisma.image.findMany({
            orderBy: {
                uploadedAt: 'desc'
            }
        });

        res.json(images);
    } catch (error) {
        console.error('Get images error:', error);
        res.status(500).json({ error: 'Failed to get images' });
    }
});

// Delete image
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.image.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

export default router;
