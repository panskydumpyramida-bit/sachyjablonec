import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { checkClubPassword } from '../controllers/messageController.js';

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
router.post('/upload', checkClubPassword, (req, res, next) => {
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

        // Generate thumbnail (400px width)
        const thumbName = filename.replace('.webp', '-thumb.webp');
        const thumbPath = path.join(__dirname, '../../uploads', thumbName);
        await sharp(req.file.buffer)
            .resize(400, null, {
                withoutEnlargement: true
            })
            .webp({ quality: 80 })
            .toFile(thumbPath);

        const url = `/uploads/${filename}`;
        console.log('Image saved to:', filepath, 'Thumbnail:', thumbPath, 'URL:', url);

        // Save to database using raw SQL to avoid schema mismatch
        let image;
        try {
            image = await prisma.image.create({
                data: {
                    filename,
                    originalName: req.file.originalname,
                    url,
                    altText: req.body.altText || null,
                    category: req.body.category || null
                }
            });
        } catch (dbError) {
            // Fallback: insert without category column
            console.warn('Create with category failed, using raw SQL:', dbError.message);
            const result = await prisma.$queryRaw`
                INSERT INTO images (filename, original_name, url, alt_text, is_public, uploaded_at)
                VALUES (${filename}, ${req.file.originalname}, ${url}, ${req.body.altText || null}, false, NOW())
                RETURNING id, filename, original_name as "originalName", url, alt_text as "altText", 
                          is_public as "isPublic", uploaded_at as "uploadedAt"
            `;
            image = result[0];
        }

        res.status(201).json(image);
    } catch (error) {
        console.error('Upload processing error:', error);
        res.status(500).json({ error: 'Chyba při zpracování obrázku: ' + error.message });
    }
});

// Get public images (all visible)
router.get('/public', async (req, res) => {
    try {
        const { category } = req.query;
        let images;

        try {
            const where = { isPublic: true };
            if (category) {
                where.category = category;
            }
            images = await prisma.image.findMany({
                where,
                orderBy: [
                    { sortOrder: 'asc' },
                    { uploadedAt: 'desc' }
                ]
            });
        } catch (dbError) {
            // Fallback using raw SQL
            console.warn('Category query failed, using raw SQL:', dbError.message);
            // Note: sort_order might not exist in fallback if schema is out of sync, 
            // but we assume migration ran. If not, raw query needs conditional logic or just sorted by time.
            images = await prisma.$queryRaw`
                SELECT id, filename, original_name as "originalName", url, alt_text as "altText", 
                       is_public as "isPublic", uploaded_at as "uploadedAt", sort_order as "sortOrder"
                FROM images 
                WHERE is_public = true 
                ${category ? Prisma.sql`AND category = ${category}` : Prisma.empty}
                ORDER BY sort_order ASC, uploaded_at DESC
            `;
        }

        res.json(images);
    } catch (error) {
        console.error('Get public images error:', error);
        res.status(500).json({ error: 'Failed to get images' });
    }
});

// Get all images (Admin)
router.get('/', checkClubPassword, async (req, res) => {
    try {
        const { category } = req.query;
        let images;

        try {
            const where = {};
            if (category) {
                where.category = category;
            }
            images = await prisma.image.findMany({
                where,
                orderBy: [
                    { sortOrder: 'asc' },
                    { uploadedAt: 'desc' }
                ]
            });
        } catch (dbError) {
            console.warn('Category query failed in admin route, using raw SQL:', dbError.message);
            images = await prisma.$queryRaw`
                SELECT id, filename, original_name as "originalName", url, alt_text as "altText", 
                       is_public as "isPublic", uploaded_at as "uploadedAt", sort_order as "sortOrder"
                FROM images 
                ${category ? Prisma.sql`WHERE category = ${category}` : Prisma.empty}
                ORDER BY sort_order ASC, uploaded_at DESC
            `;
        }

        // Fetch news that use these images as thumbnails
        const newsWithThumbnails = await prisma.news.findMany({
            where: {
                thumbnailUrl: { not: null }
            },
            select: {
                id: true,
                title: true,
                thumbnailUrl: true
            }
        });

        // Enrich images with usage info
        // We need to handle potential crop parameters in thumbnailUrl (e.g. url#crop=...)
        const usageMap = new Map();
        newsWithThumbnails.forEach(n => {
            if (!n.thumbnailUrl) return;
            const cleanUrl = n.thumbnailUrl.split('#')[0];
            // If multiple news use the same image, we just show one (or list them)
            // For simplicity, last one wins or we could make an array
            usageMap.set(cleanUrl, { id: n.id, title: n.title });
        });

        const enrichedImages = images.map(img => {
            const usage = usageMap.get(img.url);
            return {
                ...img,
                usedInNews: usage || null
            };
        });

        res.json(enrichedImages);
    } catch (error) {
        console.error('Get images error:', error);
        res.status(500).json({ error: 'Failed to get images' });
    }
});

// Toggle image visibility
router.patch('/:id/visibility', checkClubPassword, async (req, res) => {
    try {
        const { id } = req.params;
        const { isPublic } = req.body;

        const image = await prisma.image.update({
            where: { id: parseInt(id) },
            data: { isPublic: Boolean(isPublic) }
        });

        res.json(image);
    } catch (error) {
        console.error('Toggle visibility error:', error);
        res.status(500).json({ error: 'Failed to update visibility' });
    }
});

// Update image caption (altText)
router.put('/:id/caption', checkClubPassword, async (req, res) => {
    try {
        const { id } = req.params;
        const { altText, category } = req.body;

        console.log(`Update caption/category for ID: ${id}`, req.body);

        const idInt = parseInt(id);
        if (isNaN(idInt)) {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        const data = {};
        if (altText !== undefined) data.altText = altText || null;
        if (category !== undefined) data.category = category || null;

        const image = await prisma.image.update({
            where: { id: idInt },
            data: data
        });

        res.json(image);
    } catch (error) {
        console.error('Update caption error:', error);
        res.status(500).json({ error: 'Failed to update caption' });
    }
});

// Update image sort order
router.put('/:id/order', checkClubPassword, async (req, res) => {
    try {
        const { id } = req.params;
        const { sortOrder } = req.body;

        const image = await prisma.image.update({
            where: { id: parseInt(id) },
            data: { sortOrder: parseInt(sortOrder) || 0 }
        });

        res.json(image);
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ error: 'Failed to update sort order' });
    }
});

// Delete image
router.delete('/:id', checkClubPassword, async (req, res) => {
    try {
        const { id } = req.params;

        // First get the image to find the filename
        const image = await prisma.image.findUnique({
            where: { id: parseInt(id) }
        });

        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Check for usage in News (thumbnail, content, galleryJson)
        // We search for the filename or URL match.
        // Prisma doesn't have partial string match on all fields easily with findFirst/findMany easily for high scale,
        // but for this size, we can check.

        // 1. Check direct relation
        /* 
           The relation `news News?` exists, but `onDelete: SetNull` means it handles itself DB-wise. 
           However, we want to prevent deletion if it's "used". 
           If it has newsId, it's explicitly part of a news item.
        */
        if (image.newsId) {
            const news = await prisma.news.findUnique({ where: { id: image.newsId }, select: { title: true } });
            if (news) {
                return res.status(409).json({ error: `Obrázek je přiřazen k novince: "${news.title}". Nejdříve ho odeberte z novinky.` });
            }
        }

        // 2. Check string usage (Thumbnail, Content, Gallery)
        // We use like/contains. Note: url is absolute path usually "/uploads/..."
        const urlPart = image.url;

        const usedInNews = await prisma.news.findFirst({
            where: {
                OR: [
                    { thumbnailUrl: { contains: urlPart } },
                    { content: { contains: urlPart } },
                    { galleryJson: { contains: urlPart } }
                ]
            },
            select: { title: true }
        });

        if (usedInNews) {
            return res.status(409).json({ error: `Obrázek je použit v novince "${usedInNews.title}" (náhled, text nebo galerie).` });
        }

        // Delete the physical file from disk
        if (image.filename) {
            const filepath = path.join(__dirname, '../../uploads', image.filename);
            const thumbPath = path.join(__dirname, '../../uploads', image.filename.replace('.', '-thumb.'));

            try {
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                    console.log('Deleted file:', filepath);
                }
                if (fs.existsSync(thumbPath)) {
                    fs.unlinkSync(thumbPath);
                    console.log('Deleted thumbnail:', thumbPath);
                }
            } catch (fileErr) {
                console.error('Error deleting file (continuing anyway):', fileErr);
                // Continue even if file deletion fails - the DB record should still be removed
            }
        }

        // Delete from database
        await prisma.image.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

// Get list of all unique categories
router.get('/categories', checkClubPassword, async (req, res) => {
    try {
        const categories = await prisma.image.findMany({
            distinct: ['category'],
            select: {
                category: true
            },
            where: {
                category: {
                    not: null
                }
            },
            orderBy: {
                category: 'asc'
            }
        });

        // Filter out empty strings if any and map to array
        const result = categories
            .map(c => c.category)
            .filter(c => c && c.trim().length > 0);

        res.json(result);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to get categories' });
    }
});

export default router;
