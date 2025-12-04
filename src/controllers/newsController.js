import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create slug from title
const createSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

export const getAllNews = async (req, res) => {
    try {
        const { published, category } = req.query;

        const where = {};
        if (published !== undefined) {
            where.isPublished = published === 'true';
        }
        if (category) {
            where.category = category;
        }

        const news = await prisma.news.findMany({
            where: Object.keys(where).length > 0 ? where : undefined,
            include: {
                author: {
                    select: {
                        id: true,
                        username: true
                    }
                }
            },
            orderBy: {
                publishedDate: 'desc'
            }
        });

        res.json(news);
    } catch (error) {
        console.error('Get news error:', error);
        res.status(500).json({ error: 'Failed to get news' });
    }
};


export const getNewsById = async (req, res) => {
    try {
        const { id } = req.params;

        const news = await prisma.news.findUnique({
            where: { id: parseInt(id) },
            include: {
                author: {
                    select: {
                        id: true,
                        username: true
                    }
                },
                matchReport: {
                    include: {
                        games: {
                            orderBy: {
                                positionOrder: 'asc'
                            }
                        }
                    }
                }
            }
        });

        if (!news) {
            return res.status(404).json({ error: 'News not found' });
        }

        res.json(news);
    } catch (error) {
        console.error('Get news by ID error:', error);
        res.status(500).json({ error: 'Failed to get news' });
    }
};

export const createNews = async (req, res) => {
    try {
        const { title, category, excerpt, content, thumbnailUrl, linkUrl, publishedDate, isPublished } = req.body;

        if (!title || !category || !excerpt || !publishedDate) {
            return res.status(400).json({ error: 'Required fields missing' });
        }

        const slug = createSlug(title);

        const news = await prisma.news.create({
            data: {
                title,
                slug,
                category,
                excerpt,
                content,
                thumbnailUrl,
                linkUrl,
                publishedDate: new Date(publishedDate),
                isPublished: isPublished || false,
                authorId: req.user.id
            }
        });

        res.status(201).json(news);
    } catch (error) {
        console.error('Create news error:', error);
        res.status(500).json({ error: 'Failed to create news' });
    }
};

export const updateNews = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, category, excerpt, content, thumbnailUrl, linkUrl, publishedDate, isPublished } = req.body;

        const updateData = {};
        if (title) {
            updateData.title = title;
            updateData.slug = createSlug(title);
        }
        if (category) updateData.category = category;
        if (excerpt) updateData.excerpt = excerpt;
        if (content !== undefined) updateData.content = content;
        if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
        if (linkUrl !== undefined) updateData.linkUrl = linkUrl;
        if (publishedDate) updateData.publishedDate = new Date(publishedDate);
        if (isPublished !== undefined) updateData.isPublished = isPublished;

        const news = await prisma.news.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        res.json(news);
    } catch (error) {
        console.error('Update news error:', error);
        res.status(500).json({ error: 'Failed to update news' });
    }
};

export const deleteNews = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.news.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'News deleted successfully' });
    } catch (error) {
        console.error('Delete news error:', error);
        res.status(500).json({ error: 'Failed to delete news' });
    }
};

export const togglePublish = async (req, res) => {
    try {
        const { id } = req.params;

        const news = await prisma.news.findUnique({
            where: { id: parseInt(id) }
        });

        if (!news) {
            return res.status(404).json({ error: 'News not found' });
        }

        const updated = await prisma.news.update({
            where: { id: parseInt(id) },
            data: { isPublished: !news.isPublished }
        });

        res.json(updated);
    } catch (error) {
        console.error('Toggle publish error:', error);
        res.status(500).json({ error: 'Failed to toggle publish status' });
    }
};
