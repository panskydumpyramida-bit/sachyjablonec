import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get public events (no auth required)
export const getPublicEvents = async (req, res) => {
    try {
        const { category, from, to } = req.query;

        const where = {
            isPublic: true,
            isInternal: false
        };

        if (category && category !== 'all') {
            where.category = category;
        }

        if (from) {
            where.startDate = { gte: new Date(from) };
        }

        if (to) {
            where.startDate = { ...where.startDate, lte: new Date(to) };
        }

        const events = await prisma.event.findMany({
            where,
            orderBy: { startDate: 'asc' }
        });

        res.json(events);
    } catch (error) {
        console.error('Error fetching public events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
};

// Get internal events (MEMBER+ required)
export const getInternalEvents = async (req, res) => {
    try {
        const { category, from, to } = req.query;

        const where = {};

        if (category && category !== 'all') {
            where.category = category;
        }

        if (from) {
            where.startDate = { gte: new Date(from) };
        }

        if (to) {
            where.startDate = { ...where.startDate, lte: new Date(to) };
        }

        // Return all events (public + internal) for members
        const events = await prisma.event.findMany({
            where,
            orderBy: { startDate: 'asc' }
        });

        res.json(events);
    } catch (error) {
        console.error('Error fetching internal events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
};

// Get single event by ID
export const getEventById = async (req, res) => {
    try {
        const { id } = req.params;

        const event = await prisma.event.findUnique({
            where: { id: parseInt(id) }
        });

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Check if event is internal and user is not authenticated
        if (event.isInternal && !req.user) {
            return res.status(403).json({ error: 'This event is only available for members' });
        }

        res.json(event);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ error: 'Failed to fetch event' });
    }
};

// Create event (ADMIN+ required)
export const createEvent = async (req, res) => {
    try {
        const {
            title, description, startDate, endDate, location,
            category, ageGroup, eventType, timeControl,
            registrationDeadline, presentationEnd, entryFee, organizerContact, url,
            isInternal, isPublic
        } = req.body;

        if (!title || !startDate) {
            return res.status(400).json({ error: 'Title and start date are required' });
        }

        const event = await prisma.event.create({
            data: {
                title,
                description: description || null,
                startDate: new Date(startDate),
                endDate: endDate ? new Date(endDate) : null,
                location: location || null,
                category: category || 'tournament',
                ageGroup: ageGroup || null,
                eventType: eventType || null,
                timeControl: timeControl || null,
                registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
                presentationEnd: presentationEnd ? new Date(presentationEnd) : null,
                entryFee: entryFee || null,
                organizerContact: organizerContact || null,
                url: url || null,
                isInternal: isInternal || false,
                isPublic: isPublic !== false, // default true
                createdBy: req.user?.id || null
            }
        });

        res.status(201).json(event);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
};

// Update event (ADMIN+ required)
export const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, description, startDate, endDate, location,
            category, ageGroup, eventType, timeControl,
            registrationDeadline, presentationEnd, entryFee, organizerContact, url,
            isInternal, isPublic
        } = req.body;

        const existingEvent = await prisma.event.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingEvent) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = await prisma.event.update({
            where: { id: parseInt(id) },
            data: {
                title: title !== undefined ? title : existingEvent.title,
                description: description !== undefined ? description : existingEvent.description,
                startDate: startDate ? new Date(startDate) : existingEvent.startDate,
                endDate: endDate !== undefined ? (endDate ? new Date(endDate) : null) : existingEvent.endDate,
                location: location !== undefined ? location : existingEvent.location,
                category: category !== undefined ? category : existingEvent.category,
                ageGroup: ageGroup !== undefined ? ageGroup : existingEvent.ageGroup,
                eventType: eventType !== undefined ? eventType : existingEvent.eventType,
                timeControl: timeControl !== undefined ? timeControl : existingEvent.timeControl,
                registrationDeadline: registrationDeadline !== undefined ? (registrationDeadline ? new Date(registrationDeadline) : null) : existingEvent.registrationDeadline,
                presentationEnd: presentationEnd !== undefined ? (presentationEnd ? new Date(presentationEnd) : null) : existingEvent.presentationEnd,
                entryFee: entryFee !== undefined ? entryFee : existingEvent.entryFee,
                organizerContact: organizerContact !== undefined ? organizerContact : existingEvent.organizerContact,
                url: url !== undefined ? url : existingEvent.url,
                isInternal: isInternal !== undefined ? isInternal : existingEvent.isInternal,
                isPublic: isPublic !== undefined ? isPublic : existingEvent.isPublic
            }
        });

        res.json(event);
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
};

// Delete event (ADMIN+ required)
export const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;

        const existingEvent = await prisma.event.findUnique({
            where: { id: parseInt(id) }
        });

        if (!existingEvent) {
            return res.status(404).json({ error: 'Event not found' });
        }

        await prisma.event.delete({
            where: { id: parseInt(id) }
        });

        res.json({ success: true, message: 'Event deleted' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
};

// Export events as iCal format
export const exportIcal = async (req, res) => {
    try {
        const { internal } = req.query;

        const where = internal === 'true' ? {} : { isInternal: false, isPublic: true };

        const events = await prisma.event.findMany({
            where,
            orderBy: { startDate: 'asc' }
        });

        // Generate iCal content
        let ical = 'BEGIN:VCALENDAR\r\n';
        ical += 'VERSION:2.0\r\n';
        ical += 'PRODID:-//Sachy Jablonec//Calendar//CS\r\n';
        ical += 'CALSCALE:GREGORIAN\r\n';
        ical += 'METHOD:PUBLISH\r\n';
        ical += 'X-WR-CALNAME:Šachy Jablonec\r\n';

        events.forEach(event => {
            const formatDate = (date) => {
                return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            };

            ical += 'BEGIN:VEVENT\r\n';
            ical += `UID:event-${event.id}@sachyjablonec.cz\r\n`;
            ical += `DTSTAMP:${formatDate(new Date())}\r\n`;
            ical += `DTSTART:${formatDate(event.startDate)}\r\n`;
            if (event.endDate) {
                ical += `DTEND:${formatDate(event.endDate)}\r\n`;
            }
            ical += `SUMMARY:${event.title.replace(/,/g, '\\,')}\r\n`;
            if (event.description) {
                ical += `DESCRIPTION:${event.description.replace(/\n/g, '\\n').replace(/,/g, '\\,')}\r\n`;
            }
            if (event.location) {
                ical += `LOCATION:${event.location.replace(/,/g, '\\,')}\r\n`;
            }
            ical += `CATEGORIES:${event.category.toUpperCase()}\r\n`;
            ical += 'END:VEVENT\r\n';
        });

        ical += 'END:VCALENDAR\r\n';

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="sachyjablonec-calendar.ics"');
        res.send(ical);
    } catch (error) {
        console.error('Error exporting iCal:', error);
        res.status(500).json({ error: 'Failed to export calendar' });
    }
};
