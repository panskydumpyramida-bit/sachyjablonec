import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getTimeline = async (req, res) => {
    try {
        const entries = await prisma.timelineEntry.findMany({
            orderBy: [{ sortOrder: 'asc' }, { year: 'asc' }],
        });
        res.json(entries);
    } catch (error) {
        console.error('Error fetching timeline:', error);
        res.status(500).json({ error: 'Failed to fetch timeline' });
    }
};

export const getTimelineEntryById = async (req, res) => {
    try {
        const { id } = req.params;
        const entry = await prisma.timelineEntry.findUnique({
            where: { id: parseInt(id, 10) },
        });
        if (!entry) return res.status(404).json({ error: 'Not found' });
        res.json(entry);
    } catch (error) {
        console.error('Error fetching timeline entry:', error);
        res.status(500).json({ error: 'Failed to fetch timeline entry' });
    }
};

export const createTimelineEntry = async (req, res) => {
    try {
        const { year, event, icon, sortOrder, isFuture } = req.body;
        if (!year || !event) {
            return res.status(400).json({ error: 'year a event jsou povinné' });
        }
        const entry = await prisma.timelineEntry.create({
            data: {
                year: parseInt(year, 10),
                event,
                icon: icon || 'fa-chess-pawn',
                sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : 0,
                isFuture: Boolean(isFuture),
            },
        });
        res.status(201).json(entry);
    } catch (error) {
        console.error('Error creating timeline entry:', error);
        res.status(500).json({ error: 'Failed to create timeline entry' });
    }
};

export const updateTimelineEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const { year, event, icon, sortOrder, isFuture } = req.body;
        const data = {};
        if (year != null) data.year = parseInt(year, 10);
        if (event != null) data.event = event;
        if (icon != null) data.icon = icon;
        if (sortOrder != null) data.sortOrder = parseInt(sortOrder, 10);
        if (isFuture != null) data.isFuture = Boolean(isFuture);

        const entry = await prisma.timelineEntry.update({
            where: { id: parseInt(id, 10) },
            data,
        });
        res.json(entry);
    } catch (error) {
        if (error.code === 'P2025') return res.status(404).json({ error: 'Not found' });
        console.error('Error updating timeline entry:', error);
        res.status(500).json({ error: 'Failed to update timeline entry' });
    }
};

export const deleteTimelineEntry = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.timelineEntry.delete({
            where: { id: parseInt(id, 10) },
        });
        res.status(204).end();
    } catch (error) {
        if (error.code === 'P2025') return res.status(404).json({ error: 'Not found' });
        console.error('Error deleting timeline entry:', error);
        res.status(500).json({ error: 'Failed to delete timeline entry' });
    }
};
