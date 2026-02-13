/**
 * Tournaments & Events Page Logic
 * Extracted from tournaments.html inline <script>
 */

let allEvents = [];
let currentAge = 'all';
let currentTempo = 'all';
let showPast = false;

document.addEventListener('DOMContentLoaded', loadEvents);

async function loadEvents() {
    try {
        const response = await fetch(`${API_URL}/events`);
        if (response.ok) {
            allEvents = await response.json();
            renderEvents();
        } else {
            showError();
        }
    } catch (error) {
        console.error('Error loading events:', error);
        showError();
    }
}

function filterByAge(age) {
    currentAge = age;
    // Reset all age buttons
    document.querySelectorAll('#age-filters .filter-pill').forEach(btn => {
        btn.classList.remove('active');
    });
    // highlight active
    const activeBtn = document.querySelector(`#age-filters .filter-pill[data-filter="${age}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    renderEvents();
}

function filterByTempo(tempo) {
    currentTempo = tempo;
    // Reset all tempo buttons
    document.querySelectorAll('#tempo-filters .filter-pill').forEach(btn => {
        btn.classList.remove('active');
    });
    // highlight active
    const activeBtn = document.querySelector(`#tempo-filters .filter-pill[data-filter="${tempo}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    renderEvents();
}

function togglePastEvents() {
    const checkbox = document.getElementById('show-past');
    showPast = checkbox.checked;

    // Visual update for custom toggle
    const track = document.getElementById('toggleTrack');
    const thumb = document.getElementById('toggleThumb');
    const icon = document.getElementById('toggleIcon');

    if (showPast) {
        if (track) track.style.background = '#d4af37';
        if (thumb) thumb.style.left = '18px';
        if (icon) { icon.className = 'fa-solid fa-eye'; icon.style.color = '#d4af37'; }
    } else {
        if (track) track.style.background = 'rgba(255,255,255,0.1)';
        if (thumb) thumb.style.left = '2px';
        if (icon) { icon.className = 'fa-solid fa-eye-slash'; icon.style.color = 'var(--text-muted)'; }
    }

    renderEvents();
}

function renderEvents() {
    const container = document.getElementById('events-container');
    const now = new Date();

    let filtered = allEvents.filter(event => {
        // Age filter
        if (currentAge !== 'all' && event.ageGroup !== 'all' && event.ageGroup !== currentAge) return false;

        // Tempo filter
        if (currentTempo !== 'all' && event.timeControl !== currentTempo) return false;

        // Past events filter
        if (!showPast && new Date(event.startDate) < now) return false;

        return true;
    });

    // Sort by date
    filtered.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="no-events">
                <i class="fa-solid fa-calendar-xmark"></i>
                <p>Žádné události neodpovídají zvoleným filtrům.</p>
            </div>
        `;
        return;
    }

    // Group by month
    const grouped = {};
    filtered.forEach(event => {
        const date = new Date(event.startDate);
        const monthKey = date.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
        if (!grouped[monthKey]) grouped[monthKey] = [];
        grouped[monthKey].push(event);
    });

    let html = '';
    for (const [month, events] of Object.entries(grouped)) {
        html += `
            <div class="month-section">
                <h3 class="month-header">
                    <i class="fa-regular fa-calendar"></i>${month.charAt(0).toUpperCase() + month.slice(1)}
                </h3>
                <div class="events-grid">
                    ${events.map(renderEventCard).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// Map Logic
let czechMapSvgContent = null;

// Approximate coordinates for cities (normalized 0-1 relative to CR bounds)
// Bounds: West 12.09, East 18.86, North 51.05, South 48.55
const cityToCoords = {
    'jablonec': { lat: 50.72, lon: 15.17, region: 'LI' },
    'liberec': { lat: 50.76, lon: 15.05, region: 'LI' },
    'turnov': { lat: 50.58, lon: 15.15, region: 'LI' },
    'česká lípa': { lat: 50.68, lon: 14.54, region: 'LI' },
    'semily': { lat: 50.60, lon: 15.33, region: 'LI' },
    'rokytnice': { lat: 50.73, lon: 15.44, region: 'LI' },
    'tanvald': { lat: 50.74, lon: 15.30, region: 'LI' },
    'harrachov': { lat: 50.77, lon: 15.43, region: 'LI' },
    'libštát': { lat: 50.56, lon: 15.41, region: 'LI' },
    'světlá nad sázavou': { lat: 49.66, lon: 15.40 },
    'praha': { lat: 50.07, lon: 14.43 },
    'brno': { lat: 49.19, lon: 16.60 },
    'ostrava': { lat: 49.82, lon: 18.26 },
    'plzeň': { lat: 49.73, lon: 13.37 },
    'hradec králové': { lat: 50.21, lon: 15.83 },
    'pardubice': { lat: 50.03, lon: 15.78 },
    'ústí nad labem': { lat: 50.66, lon: 14.05 },
    'české budějovice': { lat: 48.97, lon: 14.47 },
    'karlovy vary': { lat: 50.23, lon: 12.87 },
    'zlín': { lat: 49.22, lon: 17.66 },
    'olomouc': { lat: 49.59, lon: 17.25 },
    'vysočina': { lat: 49.40, lon: 15.59 },
    'nový bor': { lat: 50.76, lon: 14.55, region: 'LI' },
    'zákupy': { lat: 50.68, lon: 14.65, region: 'LI' },
    'frýdlant': { lat: 50.92, lon: 15.08, region: 'LI' },
    'jilemnice': { lat: 50.61, lon: 15.50, region: 'LI' },
    'desná': { lat: 50.76, lon: 15.30, region: 'LI' },
    'klatovy': { lat: 49.39, lon: 13.29 },
    'frýdek-místek': { lat: 49.68, lon: 18.35 },
    'vsetín': { lat: 49.34, lon: 17.99 },
    'kroměříž': { lat: 49.30, lon: 17.39 },
    'teplice': { lat: 50.64, lon: 13.82 },
    'varnsdorf': { lat: 50.91, lon: 14.62, region: 'LI' },
    'josefův důl': { lat: 50.78, lon: 15.23, region: 'LI' },
    'bakov': { lat: 50.48, lon: 14.94, region: 'LI' },
    'dobrovice': { lat: 50.37, lon: 14.97, region: 'ST' },
    'tábor': { lat: 49.41, lon: 14.66, region: 'JC' },
    'tabor': { lat: 49.41, lon: 14.66, region: 'JC' },
    'nový porg': { lat: 50.02, lon: 14.45 }
};

// Initialize map
fetch('images/Cesko-kraje.svg')
    .then(r => r.text())
    .then(text => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'image/svg+xml');
        const svg = doc.querySelector('svg');
        if (svg) {
            svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svg.id = 'cz-map-svg';
            czechMapSvgContent = svg.outerHTML;
            // Re-render events if they are already loaded
            if (allEvents.length > 0) renderEvents();
        }
    })
    .catch(e => console.error('Error loading map:', e));

function getCoordsFromLocation(location) {
    if (!location) return null;
    const loc = location.toLowerCase();
    for (const [city, coords] of Object.entries(cityToCoords)) {
        if (loc.includes(city)) return coords;
    }
    return null;
}

function getEventMapHtml(location) {
    if (!czechMapSvgContent) return '<div class="map-placeholder"></div>';

    const coords = getCoordsFromLocation(location);
    const homeCoords = cityToCoords['jablonec'];

    const isLiberecRegion = coords && coords.region === 'LI';

    let markersHtml = '';

    const mapLoc = (lat, lon) => {
        const minLon = 12.09;
        const maxLon = 18.88;
        const minLat = 48.55;
        const maxLat = 51.06;

        const x = ((lon - minLon) / (maxLon - minLon)) * 3508;
        const y = ((maxLat - lat) / (maxLat - minLat)) * 2480;
        return { x, y };
    };

    let currentViewBox = '0 0 3508 2480';
    let rHome = 45;
    let rEvent = 150;
    let strokeHome = 0;
    let strokeEvent = 30;

    if (isLiberecRegion) {
        currentViewBox = '1100 0 800 700';
        rHome = 15;
        rEvent = 50;
        strokeHome = 0;
        strokeEvent = 10;
    }

    // Home Marker (Jablonec)
    const home = mapLoc(homeCoords.lat, homeCoords.lon);
    markersHtml += `<circle cx="${home.x}" cy="${home.y}" r="${rHome}" fill="#64748b" />`;

    if (isLiberecRegion) {
        markersHtml += `<text x="${home.x}" y="${home.y + 85}" font-family="Arial" font-size="60" fill="#ffffff" text-anchor="middle" font-weight="900" style="text-shadow: 0 2px 4px #000, 0 0 10px rgba(0,0,0,0.8); letter-spacing: 1px;">Jablonec</text>`;
    }

    // Event Marker
    if (coords) {
        const pt = mapLoc(coords.lat, coords.lon);

        if (Math.abs(pt.x - home.x) > 1 || Math.abs(pt.y - home.y) > 1) {
            markersHtml += `
                <circle cx="${pt.x}" cy="${pt.y}" r="${rEvent}" fill="#22d3ee" stroke="white" stroke-width="${strokeEvent}" />
                <circle cx="${pt.x}" cy="${pt.y}" r="${rEvent * 0.3}" fill="white" />
            `;
        } else {
            markersHtml += `
                <circle cx="${pt.x}" cy="${pt.y}" r="${rEvent}" fill="#22d3ee" stroke="white" stroke-width="${strokeEvent}" />
                <circle cx="${pt.x}" cy="${pt.y}" r="${rEvent * 0.3}" fill="white" />
            `;
        }
    }

    let svgContent = czechMapSvgContent;
    svgContent = svgContent.replace(/viewBox="[^"]*"/, `viewBox="${currentViewBox}"`);
    return svgContent.replace('</svg>', `${markersHtml}</svg>`);
}

function renderEventCard(event) {
    const date = new Date(event.startDate);
    const day = date.getDate();
    const time = date.toLocaleString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

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

    const tags = [];
    if (event.isInternal) tags.push('<span class="event-tag internal"><i class="fa-solid fa-lock"></i> Interní</span>');

    // Age Badge
    let ageIconHtml = '';
    if (event.ageGroup) {
        const isYouth = event.ageGroup === 'youth';
        const label = isYouth ? 'Mládež' : 'Dospělí';
        const icon = isYouth ? 'fa-child' : 'fa-user-tie';
        const style = isYouth
            ? 'background: rgba(74, 222, 128, 0.15); color: #4ade80;'
            : 'background: rgba(167, 139, 250, 0.15); color: #a78bfa;';
        ageIconHtml = `<span class="badge badge-control" style="${style}"><i class="fa-solid ${icon}"></i> ${label}</span>`;
    }

    // Type Badge
    let typeIconHtml = '';
    if (event.eventType) {
        const isTeam = event.eventType === 'team';
        const label = isTeam ? 'Družstva' : 'Jednotlivci';
        const icon = isTeam ? 'fa-users' : 'fa-user';
        typeIconHtml = `<span class="badge badge-control" style="background: rgba(34, 211, 238, 0.15); color: #22d3ee;"><i class="fa-solid ${icon}"></i> ${label}</span>`;
    }

    // Time Control
    let timeControlHtml = '';
    if (event.timeControl) {
        let label = event.timeControl;
        let icon = 'fa-stopwatch';
        let tcStyle = 'background: rgba(251, 146, 60, 0.15); color: #fb923c;';

        if (label === 'blitz') {
            label = 'Blesk';
            icon = 'fa-bolt';
            tcStyle = 'background: rgba(251, 191, 36, 0.15); color: #fbbf24;';
        } else if (label === 'rapid') {
            label = 'Rapid';
            icon = 'fa-stopwatch';
            tcStyle = 'background: rgba(251, 146, 60, 0.15); color: #fb923c;';
        } else if (label === 'classical') {
            label = 'Vážná';
            icon = 'fa-chess-king';
            tcStyle = 'background: rgba(96, 165, 250, 0.15); color: #60a5fa;';
        } else {
            label = label.charAt(0).toUpperCase() + label.slice(1);
        }

        timeControlHtml = `<span class="badge badge-control" style="${tcStyle}"><i class="fa-solid ${icon}"></i> ${label}</span>`;
    }

    // Presence Time
    let presenceTime = '';
    if (event.presentationEnd) {
        presenceTime = new Date(event.presentationEnd).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
    }

    // Distance Badge
    let distanceHtml = '';
    if (event.location) {
        const coords = getCoordsFromLocation(event.location);
        if (coords) {
            const home = cityToCoords['jablonec'];
            if (home && (Math.abs(coords.lat - home.lat) > 0.001 || Math.abs(coords.lon - home.lon) > 0.001)) {
                const dist = calculateHaversineDistance(home.lat, home.lon, coords.lat, coords.lon);
                distanceHtml = `<span class="badge badge-control" style="background: rgba(255, 255, 255, 0.1); color: #94a3b8; border: 1px dashed rgba(148, 163, 184, 0.3);" title="Vzdušná vzdálenost od Jablonce"><i class="fa-solid fa-route"></i> ${dist} km</span>`;
            }
        }
    }

    // Map & Border
    let mapHtml = '';
    let borderClass = 'region-away';
    if (event.location) {
        mapHtml = `<div class="event-map" title="${event.location}">${getEventMapHtml(event.location)}</div>`;
        const coords = getCoordsFromLocation(event.location);
        if (coords && coords.region === 'LI') {
            borderClass = 'region-home';
        }
    } else {
        if (event.isInternal) borderClass = 'region-home';
    }

    const googleCalUrl = generateGoogleCalendarUrl(event);
    const featuredClass = event.isFeatured ? 'featured-card' : '';

    return `
        <div class="event-card ${borderClass} ${featuredClass}">
            <div class="event-content" style="position: relative;">
                 <!-- Google Calendar Icon (Top Right) -->
                <a href="${googleCalUrl}" target="_blank" class="gcal-icon-link" title="Přidat do Google kalendáře">
                    <i class="fa-regular fa-calendar-plus"></i>
                </a>

                <div class="event-header">
                    <div class="event-date-box">
                        <span class="day">${day}</span>
                        <span class="month">${date.toLocaleString('cs-CZ', { month: 'short' }).toUpperCase()}</span>
                        <span class="time">${time}${presenceTime ? ` <span style="display: inline; padding: 0.1rem 0.25rem; font-size: 0.6rem; background: rgba(16, 185, 129, 0.15); color: #10b981; border-radius: 3px; margin-left: 0.25rem;"><i class="fa-solid fa-user-check" style="font-size: 0.5rem;"></i> ${presenceTime}</span>` : ''}</span>
                    </div>
                    
                    <div class="event-main-info">
                        <h3 class="event-title" style="margin-bottom: 0.4rem;">
                            ${event.url ? `<a href="${event.url}" target="_blank" class="hover:underline" style="color: #f1f5f9;">${event.title} <i class="fa-solid fa-external-link-alt text-sm ml-1" style="color: #94a3b8; font-size: 0.8em;"></i></a>` : `<span style="color: #f1f5f9;">${event.title}</span>`}
                        </h3>

                        <!-- Top Row: Category + Icons -->
                        <div class="event-meta-top">
                           <!-- Main Category Badge -->
                           <span class="event-category"><i class="fa-solid ${categoryIcons[event.category] || 'fa-calendar'}"></i> ${categoryLabels[event.category] || event.category}</span>
                           
                           <div class="event-badges-inline">
                                ${ageIconHtml}
                                ${typeIconHtml}
                                ${timeControlHtml}
                                ${distanceHtml}
                           </div>
                        </div>

                        <div class="event-location-row">
                            <i class="fa-solid fa-location-dot"></i>
                            ${event.location ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}" target="_blank" class="location-link">${event.location} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.7em; opacity: 0.7; margin-left: 0.2rem;"></i></a>` : `<span class="location-text">Místo neuvedeno</span>`}
                        </div>

                        ${event.description ? `<div class="event-description">${event.description.replace(/<p>/g, '<p style="margin: 0 0 0.25rem 0;">')}</div>` : ''}

                        <div class="event-footer-details">
                             ${event.url ? `
                                <div class="detail-item" style="margin-bottom: 0.5rem;">
                                    <a href="${event.url}" target="_blank" class="btn-secondary" style="padding: 0.3rem 1rem; font-size: 0.8rem; height: auto; min-height: unset; border-radius: 4px;">
                                        <i class="fa-solid fa-earth-europe"></i> Web / Propozice
                                    </a>
                                </div>` : ''}

                             ${event.registrationDeadline ? `
                                <div class="detail-item alert-deadline">
                                    <i class="fa-regular fa-clock"></i> 
                                    <span>Přihlášky do: <strong style="color: #f87171;">${new Date(event.registrationDeadline).toLocaleDateString('cs-CZ')} ${new Date(event.registrationDeadline).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                                </div>` : ''}
                             
                             ${event.entryFee ? `
                                <div class="detail-item gold-text">
                                    <i class="fa-solid fa-coins"></i> 
                                    <span>${event.entryFee}</span>
                                </div>` : ''}

                             ${event.organizerContact ? `
                                <div class="detail-item">
                                    <i class="fa-solid fa-phone"></i> 
                                    <span>${event.organizerContact}</span>
                                </div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
            ${mapHtml}
        </div>
    `;
}

// Add global toggle function
window.toggleDetails = function (btn) {
    const cardContent = btn.closest('.event-content');
    const details = cardContent.querySelector('.event-details-expanded');

    details.classList.toggle('open');
    btn.classList.toggle('open');
    btn.innerHTML = details.classList.contains('open')
        ? 'Méně informací <i class="fa-solid fa-chevron-down" style="transform: rotate(180deg)"></i>'
        : 'Více informací <i class="fa-solid fa-chevron-down"></i>';
};

function generateGoogleCalendarUrl(event) {
    const formatDateTime = (date) => {
        return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const start = formatDateTime(event.startDate);
    const end = event.endDate ? formatDateTime(event.endDate) : formatDateTime(new Date(new Date(event.startDate).getTime() + 2 * 60 * 60 * 1000));

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: event.title,
        dates: `${start}/${end}`,
        details: event.description || '',
        location: event.location || ''
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

function showError() {
    document.getElementById('events-container').innerHTML = `
        <div class="no-events">
            <i class="fa-solid fa-exclamation-triangle"></i>
            <p>Nepodařilo se načíst události.</p>
            <button onclick="loadEvents()" class="btn" style="margin-top: 1rem;">Zkusit znovu</button>
        </div>
    `;
}
