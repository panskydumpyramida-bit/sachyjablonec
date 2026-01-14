import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all topics
export const getTopics = async (req, res) => {
    try {
        const topics = await prisma.forumTopic.findMany({
            include: {
                author: {
                    select: { id: true, username: true, realName: true, useRealName: true }
                },
                _count: {
                    select: { posts: true }
                }
            },
            orderBy: [
                { isPinned: 'desc' },
                { updatedAt: 'desc' }
            ]
        });

        res.json(topics);
    } catch (error) {
        console.error('Error fetching forum topics:', error);
        res.status(500).json({ error: 'Failed to fetch topics' });
    }
};

// Get single topic with posts
export const getTopic = async (req, res) => {
    try {
        const { id } = req.params;

        const topic = await prisma.forumTopic.update({
            where: { id: parseInt(id) },
            data: { viewCount: { increment: 1 } },
            include: {
                author: {
                    select: { id: true, username: true, realName: true, useRealName: true, role: true }
                },
                posts: {
                    include: {
                        author: {
                            select: { id: true, username: true, realName: true, useRealName: true, role: true }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        res.json(topic);
    } catch (error) {
        console.error('Error fetching forum topic:', error);
        res.status(500).json({ error: 'Failed to fetch topic' });
    }
};

// Create new topic
export const createTopic = async (req, res) => {
    try {
        const { title, content } = req.body;

        if (!title?.trim() || !content?.trim()) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const topic = await prisma.forumTopic.create({
            data: {
                title: title.trim(),
                content: content.trim(),
                authorId: req.user.id
            },
            include: {
                author: {
                    select: { id: true, username: true, realName: true, useRealName: true }
                }
            }
        });

        res.status(201).json(topic);
    } catch (error) {
        console.error('Error creating forum topic:', error);
        res.status(500).json({ error: 'Failed to create topic' });
    }
};

// Create reply post
export const createPost = async (req, res) => {
    try {
        const { id: topicId } = req.params;
        const { content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({ error: 'Content is required' });
        }

        // Check topic exists and not locked
        const topic = await prisma.forumTopic.findUnique({
            where: { id: parseInt(topicId) }
        });

        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        if (topic.isLocked) {
            return res.status(403).json({ error: 'Topic is locked' });
        }

        const post = await prisma.forumPost.create({
            data: {
                content: content.trim(),
                topicId: parseInt(topicId),
                authorId: req.user.id
            },
            include: {
                author: {
                    select: { id: true, username: true, realName: true, useRealName: true, role: true }
                }
            }
        });

        // Update topic's updatedAt
        await prisma.forumTopic.update({
            where: { id: parseInt(topicId) },
            data: { updatedAt: new Date() }
        });

        res.status(201).json(post);
    } catch (error) {
        console.error('Error creating forum post:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
};

// Toggle pin (admin only)
export const togglePin = async (req, res) => {
    try {
        const { id } = req.params;

        const topic = await prisma.forumTopic.findUnique({
            where: { id: parseInt(id) }
        });

        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        const updated = await prisma.forumTopic.update({
            where: { id: parseInt(id) },
            data: { isPinned: !topic.isPinned }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error toggling pin:', error);
        res.status(500).json({ error: 'Failed to update topic' });
    }
};

// Toggle lock (admin only)
export const toggleLock = async (req, res) => {
    try {
        const { id } = req.params;

        const topic = await prisma.forumTopic.findUnique({
            where: { id: parseInt(id) }
        });

        if (!topic) {
            return res.status(404).json({ error: 'Topic not found' });
        }

        const updated = await prisma.forumTopic.update({
            where: { id: parseInt(id) },
            data: { isLocked: !topic.isLocked }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error toggling lock:', error);
        res.status(500).json({ error: 'Failed to update topic' });
    }
};

// Delete topic (admin only)
export const deleteTopic = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.forumTopic.delete({
            where: { id: parseInt(id) }
        });

        res.json({ success: true, message: 'Topic deleted' });
    } catch (error) {
        console.error('Error deleting topic:', error);
        res.status(500).json({ error: 'Failed to delete topic' });
    }
};
