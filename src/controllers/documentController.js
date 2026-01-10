import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_PATH = path.join(__dirname, '../../uploads/documents');

// Get all documents (MEMBER+)
export const getDocuments = async (req, res) => {
    try {
        const documents = await prisma.document.findMany({
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

        res.json(documents);
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
        const filename = req.file.filename; // Multer saves it with unique name
        const url = `/uploads/documents/${filename}`;

        const document = await prisma.document.create({
            data: {
                title: title || req.file.originalname,
                filename,
                url,
                category: category || 'other',
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

        res.status(201).json(document);
    } catch (error) {
        console.error('Error uploading document:', error);
        // Clean up file if DB fails
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkErr) {
                console.error('Failed to delete orphaned file:', unlinkErr);
            }
        }
        res.status(500).json({ error: 'Failed to save document' });
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
        const filePath = path.join(UPLOADS_PATH, document.filename);
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
