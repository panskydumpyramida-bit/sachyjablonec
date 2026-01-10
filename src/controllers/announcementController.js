import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all announcements
export const getAnnouncements = async (req, res) => {
    try {
        const announcements = await prisma.announcement.findMany({
            orderBy: [
                { isPinned: 'desc' },
                { createdAt: 'desc' }
            ],
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        realName: true
                    }
                }
            }
        });

        res.json(announcements);
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ error: 'Failed to fetch announcements' });
    }
};

// Create announcement
export const createAnnouncement = async (req, res) => {
    try {
        const { title, content, isPinned } = req.body;

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const announcement = await prisma.announcement.create({
            data: {
                title,
                content,
                isPinned: isPinned || false,
                authorId: req.user.id
            },
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        realName: true
                    }
                }
            }
        });

        res.status(201).json(announcement);
    } catch (error) {
        console.error('Error creating announcement:', error);
        res.status(500).json({ error: 'Failed to create announcement' });
    }
};

// Delete announcement
export const deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.announcement.delete({
            where: { id: parseInt(id) }
        });

        res.json({ success: true, message: 'Announcement deleted' });
    } catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({ error: 'Failed to delete announcement' });
    }
};
