import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_PATH = path.join(__dirname, '../../uploads/documents');
const PRIVATE_DOCUMENTS_PATH = path.join(__dirname, '../../private/documents');

if (!fs.existsSync(PRIVATE_DOCUMENTS_PATH)) {
    fs.mkdirSync(PRIVATE_DOCUMENTS_PATH, { recursive: true });
}

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'];

function isAdmin(user) {
    return ADMIN_ROLES.includes(user?.role);
}

function serializeDocument(document) {
    return {
        ...document,
        downloadUrl: `/api/documents/${document.id}/file`
    };
}

function getDocumentPath(document) {
    const basePath = document.visibility === 'admin' ? PRIVATE_DOCUMENTS_PATH : UPLOADS_PATH;
    return path.join(basePath, document.filename);
}

// Get all documents (MEMBER+)
export const getDocuments = async (req, res) => {
    try {
        const where = isAdmin(req.user) ? {} : { visibility: { not: 'admin' } };
        const documents = await prisma.document.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                uploadedBy: {
                    select: {
                        username: true,
                        realName: true
                    }
                }
            }
        });

        res.json(documents.map(serializeDocument));
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
};

// Upload document (ADMIN+)
export const uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { title, category } = req.body;
        const visibility = req.body.visibility === 'admin' ? 'admin' : 'members';
        const filename = req.file.filename; // Multer saves it with unique name
        const url = `/uploads/documents/${filename}`;

        if (visibility === 'admin') {
            fs.renameSync(req.file.path, path.join(PRIVATE_DOCUMENTS_PATH, filename));
        }

        const document = await prisma.document.create({
            data: {
                title: title || req.file.originalname,
                filename,
                url,
                category: category || 'other',
                visibility,
                uploadedById: req.user.id
            },
            include: {
                uploadedBy: {
                    select: {
                        username: true,
                        realName: true
                    }
                }
            }
        });

        res.status(201).json(serializeDocument(document));
    } catch (error) {
        console.error('Error uploading document:', error);
        // Clean up file if DB fails
        if (req.file) {
            try {
                const uploadPath = req.file.path;
                const privatePath = path.join(PRIVATE_DOCUMENTS_PATH, req.file.filename);
                if (fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath);
                if (fs.existsSync(privatePath)) fs.unlinkSync(privatePath);
            } catch (unlinkErr) {
                console.error('Failed to delete orphaned file:', unlinkErr);
            }
        }
        res.status(500).json({ error: 'Failed to save document' });
    }
};

// Download/open document (MEMBER+; admin-only files require ADMIN+)
export const getDocumentFile = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await prisma.document.findUnique({
            where: { id: parseInt(id) }
        });

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (document.visibility === 'admin' && !isAdmin(req.user)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const filePath = getDocumentPath(document);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.title)}"`);
        res.sendFile(filePath);
    } catch (error) {
        console.error('Error serving document:', error);
        res.status(500).json({ error: 'Failed to serve document' });
    }
};

// Delete document (ADMIN+)
export const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;

        const document = await prisma.document.findUnique({
            where: { id: parseInt(id) }
        });

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Delete file from disk
        const filePath = getDocumentPath(document);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (err) {
                console.error('Error deleting file from disk:', err);
                // Continue to delete from DB
            }
        }

        await prisma.document.delete({
            where: { id: parseInt(id) }
        });

        res.json({ success: true, message: 'Document deleted' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
};
