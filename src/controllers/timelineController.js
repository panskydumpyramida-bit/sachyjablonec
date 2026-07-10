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
        const {
            year,
            yearLabel,
            event,
            description,
            category,
            icon,
            imageUrl,
            imageAlt,
            sortOrder,
            isFuture,
        } = req.body;
        if (!year || !event) {
            return res.status(400).json({ error: 'year a event jsou povinné' });
        }
        const entry = await prisma.timelineEntry.create({
            data: {
                year: parseInt(year, 10),
                yearLabel: yearLabel?.trim() || null,
                event: event.trim(),
                description: description?.trim() || null,
                category: category?.trim() || null,
                icon: icon || 'fa-chess-pawn',
                imageUrl: imageUrl?.trim() || null,
                imageAlt: imageAlt?.trim() || null,
                sortOrder: sortOrder != null ? parseInt(sortOrder, 10) : 0,
                isFuture: isFuture === true || isFuture === 'true' || isFuture === 1,
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
        const {
            year,
            yearLabel,
            event,
            description,
            category,
            icon,
            imageUrl,
            imageAlt,
            sortOrder,
            isFuture,
        } = req.body;
        const data = {};
        if (year != null) data.year = parseInt(year, 10);
        if (yearLabel != null) data.yearLabel = yearLabel.trim() || null;
        if (event != null) data.event = event.trim();
        if (description != null) data.description = description.trim() || null;
        if (category != null) data.category = category.trim() || null;
        if (icon != null) data.icon = icon;
        if (imageUrl != null) data.imageUrl = imageUrl.trim() || null;
        if (imageAlt != null) data.imageAlt = imageAlt.trim() || null;
        if (sortOrder != null) data.sortOrder = parseInt(sortOrder, 10);
        if (isFuture != null) data.isFuture = isFuture === true || isFuture === 'true' || isFuture === 1;

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
