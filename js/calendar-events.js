/**
 * Calendar Events Module
 * Fetches and displays club events in the calendar page
 */

const CalendarEvents = {
    events: [],
    internalEvents: [],
    isAuthenticated: false,
    userRole: null,

    /**
     * Initialize the events module
     */
    async init() {
        // Check authentication status
        this.checkAuth();

        // Load events
        await this.loadEvents();
    },

    /**
     * Check if user is authenticated and get their role
     */
    checkAuth() {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                this.isAuthenticated = true;
                this.userRole = payload.role;
            } catch (e) {
                this.isAuthenticated = false;
                this.userRole = null;
            }
        }
    },

    /**
     * Check if user has at least MEMBER role
     */
    isMember() {
        const memberRoles = ['MEMBER', 'ADMIN', 'SUPERADMIN'];
        return this.isAuthenticated && memberRoles.includes(this.userRole);
    },

    /**
     * Load events from API
     */
    async loadEvents() {
        try {
            // Always load public events
            const publicRes = await fetch(`${API_URL}/events`);
            if (publicRes.ok) {
                this.events = await publicRes.json();
            }

            // If member, also load internal events
            if (this.isMember()) {
                const token = localStorage.getItem('token');
                const internalRes = await fetch(`${API_URL}/events/internal`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (internalRes.ok) {
                    this.internalEvents = await internalRes.json();
                    // Internal endpoint returns all events for members
                    this.events = this.internalEvents;
                }
            }
        } catch (error) {
            console.error('Error loading events:', error);
        }
    },

    /**
     * Get events for a specific date range
     */
    getEventsInRange(from, to) {
        return this.events.filter(event => {
            const eventDate = new Date(event.startDate);
            return eventDate >= from && eventDate <= to;
        });
    },

    /**
     * Get events by category
     */
    getEventsByCategory(category) {
        if (category === 'all') return this.events;
        return this.events.filter(event => event.category === category);
    },

    /**
     * Render events into the calendar container
     */
    renderEvents(containerId = 'events-container') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (this.events.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="fa-regular fa-calendar-xmark fa-2x" style="margin-bottom: 1rem;"></i>
                    <p>Žádné nadcházející události</p>
                </div>
            `;
            return;
        }

        // Group events by month
        const grouped = this.groupEventsByMonth(this.events);

        let html = '';
        for (const [monthKey, monthEvents] of Object.entries(grouped)) {
            html += this.renderMonthSection(monthKey, monthEvents);
        }

        container.innerHTML = html;
    },

    /**
     * Group events by month
     */
    groupEventsByMonth(events) {
        const grouped = {};
        events.forEach(event => {
            const date = new Date(event.startDate);
            const monthKey = date.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
            if (!grouped[monthKey]) {
                grouped[monthKey] = [];
            }
            grouped[monthKey].push(event);
        });
        return grouped;
    },

    /**
     * Render a month section
     */
    renderMonthSection(monthKey, events) {
        const capitalMonth = monthKey.charAt(0).toUpperCase() + monthKey.slice(1);

        let html = `
            <div class="events-month" style="margin-bottom: 2rem;">
                <h3 style="color: var(--primary-color); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fa-regular fa-calendar"></i> ${capitalMonth}
                </h3>
        `;

        events.forEach(event => {
            html += this.renderEventCard(event);
        });

        html += '</div>';
        return html;
    },

    /**
     * Render a single event card
     */
    renderEventCard(event) {
        const date = new Date(event.startDate);
        const day = date.getDate();
        const dayName = date.toLocaleString('cs-CZ', { weekday: 'short' });
        const time = date.toLocaleString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

        // Category icons and labels
        const categoryIcons = {
            tournament: 'fa-trophy',
            training: 'fa-chess-pawn',
            camp: 'fa-campground',
            meeting: 'fa-users',
            other: 'fa-calendar'
        };

        const categoryLabels = {
            tournament: 'Turnaj',
            training: 'Trénink',
            camp: 'Soustředění',
            meeting: 'Schůze',
            other: 'Ostatní'
        };

        const categoryIcon = categoryIcons[event.category] || 'fa-calendar';
        const categoryLabel = categoryLabels[event.category] || event.category;

        // Build chess-specific tags
        const tags = [];

        if (event.ageGroup) {
            const ageLabels = { youth: 'Mládež', adults: 'Dospělí', all: 'Všechny věkové kategorie' };
            const ageIcons = { youth: 'fa-child', adults: 'fa-user', all: 'fa-users' };
            tags.push(`<span style="background: rgba(74, 222, 128, 0.15); color: #4ade80; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.65rem;"><i class="fa-solid ${ageIcons[event.ageGroup] || 'fa-users'}" style="margin-right: 0.2rem;"></i>${ageLabels[event.ageGroup] || event.ageGroup}</span>`);
        }

        if (event.eventType) {
            const typeLabels = { individual: 'Jednotlivci', team: 'Družstva' };
            tags.push(`<span style="background: rgba(96, 165, 250, 0.15); color: #60a5fa; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.65rem;">${typeLabels[event.eventType] || event.eventType}</span>`);
        }

        if (event.timeControl) {
            const timeLabels = { blitz: 'Blitz', rapid: 'Rapid', classical: 'Vážný šach' };
            const timeColors = { blitz: '#fbbf24', rapid: '#fb923c', classical: '#a78bfa' };
            const color = timeColors[event.timeControl] || '#a78bfa';
            tags.push(`<span style="background: ${color}22; color: ${color}; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.65rem;">${timeLabels[event.timeControl] || event.timeControl}</span>`);
        }

        const tagsHtml = tags.length > 0 ? `<div style="display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.35rem;">${tags.join('')}</div>` : '';

        const internalBadge = event.isInternal
            ? '<span style="background: rgba(239, 68, 68, 0.2); color: #f87171; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.7rem; margin-left: 0.5rem;">Pouze pro členy</span>'
            : '';

        const googleCalUrl = this.generateGoogleCalendarUrl(event);

        // Tournament details
        const formatDateShort = (dateStr) => {
            if (!dateStr) return null;
            const d = new Date(dateStr);
            return d.toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        };

        const regDeadline = event.registrationDeadline ? formatDateShort(event.registrationDeadline) : null;
        const presEnd = event.presentationEnd ? formatDateShort(event.presentationEnd) : null;

        let tournamentDetailsHtml = '';
        if (event.category === 'tournament' && (regDeadline || presEnd || event.entryFee || event.organizerContact)) {
            tournamentDetailsHtml = `
                <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.75rem;">
                    ${regDeadline ? `<div style="color: var(--text-muted); margin-bottom: 0.25rem;"><i class="fa-solid fa-clock" style="margin-right: 0.3rem; color: #f87171;"></i>Přihlášky do: <strong style="color: #f87171;">${regDeadline}</strong></div>` : ''}
                    ${presEnd ? `<div style="color: var(--text-muted); margin-bottom: 0.25rem;"><i class="fa-solid fa-user-check" style="margin-right: 0.3rem;"></i>Prezence do: ${presEnd}</div>` : ''}
                    ${event.entryFee ? `<div style="color: var(--text-muted); margin-bottom: 0.25rem;"><i class="fa-solid fa-coins" style="margin-right: 0.3rem; color: #fbbf24;"></i>${event.entryFee}</div>` : ''}
                    ${event.organizerContact ? `<div style="color: var(--text-muted);"><i class="fa-solid fa-phone" style="margin-right: 0.3rem;"></i>${event.organizerContact}</div>` : ''}
                </div>
            `;
        }

        return `
            <div class="event-card" style="
                background: linear-gradient(135deg, rgba(20, 40, 50, 0.85), rgba(15, 30, 40, 0.95));
                backdrop-filter: blur(10px);
                border: 1px solid rgba(34, 211, 238, 0.15);
                border-left: 3px solid #22d3ee;
                border-radius: 12px;
                padding: 1rem;
                margin-bottom: 0.75rem;
                display: flex;
                gap: 1rem;
                align-items: flex-start;
                transition: all 0.3s ease;
            ">
                <div style="text-align: center; min-width: 50px;">
                    <div style="font-size: 1.25rem; font-weight: 700; color: #22d3ee;">${day}.</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${dayName}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem;">${time}</div>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.25rem;">
                        <i class="fa-solid ${categoryIcon}" style="margin-right: 0.25rem; color: #22d3ee;"></i>${categoryLabel}${internalBadge}
                    </div>
                    <div style="font-weight: 600; color: var(--text-color); margin-bottom: 0.25rem;">${event.title}</div>
                    ${tagsHtml}
                    ${event.location ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.35rem;"><i class="fa-solid fa-location-dot" style="margin-right: 0.25rem;"></i>${event.location}</div>` : ''}
                    ${event.description ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">${event.description}</div>` : ''}
                    ${tournamentDetailsHtml}
                </div>
                <a href="${googleCalUrl}" target="_blank" title="Přidat do Google Calendar" style="
                    color: var(--text-muted);
                    font-size: 1rem;
                    padding: 0.5rem;
                    transition: color 0.2s;
                " onmouseover="this.style.color='#22d3ee'" onmouseout="this.style.color='var(--text-muted)'">
                    <i class="fa-solid fa-calendar-plus"></i>
                </a>
            </div>
        `;
    },

    /**
     * Generate Google Calendar URL for an event
     */
    generateGoogleCalendarUrl(event) {
        const formatDate = (date) => {
            return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: event.title,
            dates: `${formatDate(event.startDate)}/${formatDate(event.endDate || event.startDate)}`,
            details: event.description || '',
            location: event.location || ''
        });

        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    },

    /**
     * Get iCal download URL
     */
    getIcalUrl(includeInternal = false) {
        if (includeInternal && this.isMember()) {
            return `${API_URL}/events/ical/internal`;
        }
        return `${API_URL}/events/ical`;
    }
};

// Auto-initialize when DOM is ready if on calendar page
document.addEventListener('DOMContentLoaded', () => {
    const eventsContainer = document.getElementById('events-container');
    if (eventsContainer) {
        CalendarEvents.init().then(() => {
            CalendarEvents.renderEvents('events-container');
        });
    }
});

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.CalendarEvents = CalendarEvents;
}
