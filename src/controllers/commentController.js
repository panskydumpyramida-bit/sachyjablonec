import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../utils/mailer.js';

const prisma = new PrismaClient();

// Get the single latest comment for homepage
export const getLatestComment = async (req, res) => {
    try {
        const comment = await prisma.comment.findFirst({
            where: {
                isHidden: false,
                isDeleted: false
            },
            include: {
                author: {
                    select: { id: true, username: true, realName: true, useRealName: true }
                },
                news: {
                    select: { id: true, title: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(comment);
    } catch (error) {
        console.error('Get latest comment error:', error);
        res.status(500).json({ error: 'Failed to get latest comment' });
    }
};

// Get comments for a news article
export const getComments = async (req, res) => {
    try {
        const { newsId } = req.params;
        const { includeHidden } = req.query;

        const where = {
            newsId: parseInt(newsId),
            parentId: null // Only top-level comments
        };

        // Only show hidden comments to admins
        if (!includeHidden || !req.user || !['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
            where.isHidden = false;
        }

        const comments = await prisma.comment.findMany({
            where,
            include: {
                author: {
                    select: { id: true, username: true, realName: true, useRealName: true, role: true }
                },
                replies: {
                    where: includeHidden ? {} : { isHidden: false },
                    include: {
                        author: {
                            select: { id: true, username: true, realName: true, useRealName: true, role: true }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(comments);
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Failed to get comments' });
    }
};

// Create a new comment
export const createComment = async (req, res) => {
    try {
        const { newsId, content, parentId } = req.body;

        if (!newsId || !content?.trim()) {
            return res.status(400).json({ error: 'News ID and content are required' });
        }

        // Verify news exists and get author info
        const news = await prisma.news.findUnique({
            where: { id: parseInt(newsId) },
            include: {
                author: {
                    select: { id: true, email: true, username: true }
                }
            }
        });
        if (!news) {
            return res.status(404).json({ error: 'Article not found' });
        }

        // If replying, verify parent exists
        if (parentId) {
            const parent = await prisma.comment.findUnique({ where: { id: parseInt(parentId) } });
            if (!parent || parent.newsId !== parseInt(newsId)) {
                return res.status(404).json({ error: 'Parent comment not found' });
            }
        }

        const comment = await prisma.comment.create({
            data: {
                content: content.trim(),
                newsId: parseInt(newsId),
                authorId: req.user.id,
                parentId: parentId ? parseInt(parentId) : null
            },
            include: {
                author: {
                    select: { id: true, username: true, realName: true, useRealName: true, role: true }
                }
            }
        });

        // Send email notification to article author (if not commenting on own article)
        if (news.author && news.author.id !== req.user.id && news.author.email) {
            const commenterName = comment.author.useRealName && comment.author.realName
                ? comment.author.realName
                : comment.author.username;
            const articleUrl = `https://sachyjablonec.cz/novinky/${news.slug || news.id}`;

            sendEmail(
                news.author.email,
                `Nový komentář k článku "${news.title}"`,
                `
                <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #c9a227;">Nový komentář</h2>
                    <p>Uživatel <strong>${commenterName}</strong> přidal komentář k vašemu článku:</p>
                    <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin: 1rem 0; border-left: 4px solid #c9a227;">
                        <p style="margin: 0; white-space: pre-wrap;">${content.trim().substring(0, 500)}${content.length > 500 ? '...' : ''}</p>
                    </div>
                    <p><a href="${articleUrl}" style="color: #c9a227;">Zobrazit článek →</a></p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 2rem 0;">
                    <p style="color: #888; font-size: 0.85rem;">Tato notifikace byla odeslána automaticky z webu Šachový oddíl TJ Bižuterie Jablonec.</p>
                </div>
                `
            ).catch(err => console.error('Failed to send comment notification:', err));
        }

        res.status(201).json(comment);
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
};

// Update own comment
export const updateComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const comment = await prisma.comment.findUnique({ where: { id: parseInt(id) } });

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Only author can edit (or admin)
        if (comment.authorId !== req.user.id && !['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const updated = await prisma.comment.update({
            where: { id: parseInt(id) },
            data: { content: content.trim() },
            include: {
                author: {
                    select: { id: true, username: true, realName: true, useRealName: true, role: true }
                }
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Update comment error:', error);
        res.status(500).json({ error: 'Failed to update comment' });
    }
};

// Delete comment
export const deleteComment = async (req, res) => {
    try {
        const { id } = req.params;

        const comment = await prisma.comment.findUnique({ where: { id: parseInt(id) } });

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Only author or admin can delete
        if (comment.authorId !== req.user.id && !['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Soft delete: keep record, mark as deleted
        await prisma.comment.update({
            where: { id: parseInt(id) },
            data: {
                isDeleted: true,
                deletedBy: req.user.id
            }
        });

        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
};

// Toggle hide/show (admin only)
export const toggleHidden = async (req, res) => {
    try {
        const { id } = req.params;
        const { isHidden } = req.body;

        const comment = await prisma.comment.findUnique({ where: { id: parseInt(id) } });

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        const updated = await prisma.comment.update({
            where: { id: parseInt(id) },
            data: { isHidden: Boolean(isHidden) }
        });

        res.json(updated);
    } catch (error) {
        console.error('Toggle hidden error:', error);
        res.status(500).json({ error: 'Failed to update comment' });
    }
};
