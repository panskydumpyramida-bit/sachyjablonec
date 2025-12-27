/**
 * Admin Events Module
 * Manages club events (create, edit, delete)
 */

const AdminEvents = {
    events: [],
    currentEvent: null,

    /**
     * Initialize the module
     */
    async init() {
        await this.loadEvents();
        this.bindEvents();
        this.initAddressAutocomplete();
    },

    /**
     * Initialize Address Autocomplete (Nominatim)
     */
    initAddressAutocomplete() {
        const input = document.getElementById('eventLocationInput');
        const list = document.getElementById('locationSuggestions');

        if (!input || !list) return;

        let debounceTimer;

        // Input handler
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            clearTimeout(debounceTimer);

            if (query.length < 2) {
                list.style.display = 'none';
                return;
            }

            debounceTimer = setTimeout(() => {
                this.fetchAddressSuggestions(query, list);
            }, 300);
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !list.contains(e.target)) {
                list.style.display = 'none';
            }
        });
    },

    /**
     * Fetch suggestions from Nominatim
     */
    async fetchAddressSuggestions(query, listElement) {
        try {
            // Using OpenStreetMap Nominatim API
            // countrycodes=cz limits to Czech Republic
            // limit=5 limits results
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=cz&limit=10&addressdetails=1`);

            if (!response.ok) return;

            const data = await response.json();

            listElement.innerHTML = '';

            if (data.length === 0) {
                listElement.style.display = 'none';
                return;
            }

            data.forEach(item => {
                // Parse address components
                const addr = item.address;
                const road = addr.road || addr.pedestrian || addr.footway || addr.residential || addr.path || '';
                const houseNumber = addr.house_number || addr.conscriptionnumber || addr.street_number || '';
                const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || addr.suburb || '';
                const postcode = addr.postcode || '';

                // Extra building identifiers
                const building = addr.amenity || addr.building || addr.leisure || addr.tourism || addr.office || addr.shop || '';

                // Format: "Městská hala, U Přehrady 4747/12, Jablonec nad Nisou, 46601"

                const streetPart = [road, houseNumber].filter(Boolean).join(' ');

                let addressParts = [];

                // Add building name if it exists and isn't just the road name
                if (building && building !== road && building !== city) {
                    addressParts.push(building);
                }

                if (road) {
                    addressParts.push(streetPart);
                } else if (!building) {
                    // If no road and no building, fallback to just City Number
                    addressParts.push(`${city} ${houseNumber}`);
                } else if (building && houseNumber) {
                    // Building + Number? Rare but possible
                    addressParts.push(`${houseNumber}`);
                }

                addressParts.push(city);
                addressParts.push(postcode);

                // Deduplicate parts (simple check)
                addressParts = [...new Set(addressParts)];

                let formattedAddress = addressParts.filter(Boolean).join(', ').trim();

                const div = document.createElement('div');
                div.className = 'suggestion-item';

                // Display splitting
                const mainText = addressParts[0]; // Building or Street
                // Secondary is the rest
                const secondaryText = addressParts.slice(1).join(', ');

                div.innerHTML = `<span class="suggestion-main">${mainText}</span>, <span class="suggestion-secondary">${secondaryText}</span>`;

                div.addEventListener('click', () => {
                    // Populate input with formatted address
                    const input = document.getElementById('eventLocationInput');
                    input.value = formattedAddress;
                    listElement.style.display = 'none';
                });

                listElement.appendChild(div);
            });

            listElement.style.display = 'block';

        } catch (error) {
            console.error('Error fetching address suggestions:', error);
        }
    },

    /**
     * Load all events from API
     */
    async loadEvents() {
        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token') || localStorage.getItem('token') || (window.authToken);

            if (!token) {
                console.warn('No authToken found, cannot load events');
                this.showNotification('Nejste přihlášeni. Prosím přihlašte se znovu.', 'error');
                if (typeof window.logout === 'function') setTimeout(() => window.logout(), 1500);
                return;
            }

            // Admin panel: Try internal endpoint first (includes all events)
            let response = await fetch(`${API_URL}/events/internal`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // If unauthorized, try public events as fallback
            if (response.status === 401 || response.status === 403) {
                console.warn('Internal endpoint failed, trying public events');
                response = await fetch(`${API_URL}/events`);
            }

            if (response.ok) {
                this.events = await response.json();
                // Sort by date descending (newest first in admin)
                this.events.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
                this.renderEventsTable();
            } else {
                console.error('Failed to load events:', response.status);
                this.showNotification('Nepodařilo se načíst události', 'error');
                this.events = [];
                this.renderEventsTable();
            }
        } catch (error) {
            console.error('Error loading events:', error);
            this.showNotification('Chyba při načítání událostí', 'error');
        }
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        const form = document.getElementById('event-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        const cancelBtn = document.getElementById('event-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.resetForm());
        }
    },

    /**
     * Render events table
     */
    renderEventsTable() {
        // Desktop Table
        const tbody = document.getElementById('events-table-body');
        // Mobile List
        const mobileList = document.getElementById('events-mobile-list');

        if (!tbody && !mobileList) return;

        if (this.events.length === 0) {
            const emptyHtml = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        Žádné události. Přidejte první událost pomocí formuláře.
                    </td>
                </tr>
            `;
            if (tbody) tbody.innerHTML = emptyHtml;
            if (mobileList) mobileList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">Žádné události.</div>`;
            return;
        }

        const categoryLabels = {
            tournament: 'Turnaj',
            training: 'Trénink',
            camp: 'Soustředění',
            meeting: 'Schůze',
            other: 'Ostatní'
        };

        const sortedEvents = [...this.events].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

        // Render Desktop Table
        if (tbody) {
            tbody.innerHTML = sortedEvents.map(event => {
                const date = new Date(event.startDate);
                const dateStr = date.toLocaleDateString('cs-CZ');
                const timeStr = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

                const badges = [];
                if (event.isInternal) badges.push('<span class="badge badge-warning">Interní</span>');
                if (event.ageGroup) badges.push(`<span class="badge badge-info">${event.ageGroup === 'youth' ? 'Mládež' : event.ageGroup === 'adults' ? 'Dospělí' : 'Vše'}</span>`);
                if (event.timeControl) badges.push(`<span class="badge badge-secondary">${event.timeControl}</span>`);

                return `
                    <tr>
                        <td>${dateStr} ${timeStr}</td>
                        <td><strong>${event.title}</strong></td>
                        <td>${categoryLabels[event.category] || event.category}</td>
                        <td>${badges.join(' ')}</td>
                        <td>${event.location || '-'}</td>
                        <td>
                            <button onclick="AdminEvents.editEvent(${event.id})" class="btn btn-sm btn-secondary" title="Upravit">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="AdminEvents.deleteEvent(${event.id})" class="btn btn-sm btn-danger" title="Smazat">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Render Mobile List
        if (mobileList) {
            mobileList.innerHTML = sortedEvents.map(event => {
                const date = new Date(event.startDate);
                const dateStr = date.toLocaleDateString('cs-CZ');
                const timeStr = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });

                return `
                    <div class="mobile-event-card">
                        <div class="mobile-event-header">
                            <div>
                                <div class="mobile-event-date">${dateStr} ${timeStr}</div>
                                <h4 style="margin: 0.25rem 0; color: #f1f5f9;">${event.title}</h4>
                            </div>
                            <span class="badge badge-secondary">${categoryLabels[event.category] || event.category}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.25rem;">
                            ${event.location ? `<i class="fa-solid fa-location-dot"></i> ${event.location}` : ''}
                        </div>
                        <div class="mobile-event-actions">
                            <button onclick="AdminEvents.editEvent(${event.id})" style="background: none; border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; padding: 0.4rem 0.8rem; border-radius: 6px;">
                                <i class="fa-solid fa-pen"></i> Upravit
                            </button>
                            <button onclick="AdminEvents.deleteEvent(${event.id})" style="background: none; border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 0.4rem 0.8rem; border-radius: 6px;">
                                <i class="fa-solid fa-trash"></i> Smazat
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    },

    /**
     * Handle form submission
     */
    async handleSubmit(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);

        const data = {
            title: formData.get('title'),
            description: formData.get('description') || null,
            startDate: formData.get('startDate'),
            endDate: formData.get('endDate') || null,
            location: formData.get('location') || null,
            category: formData.get('category'),
            ageGroup: formData.get('ageGroup') || null,
            eventType: formData.get('eventType') || null,
            timeControl: formData.get('timeControl') || null,
            registrationDeadline: formData.get('registrationDeadline') || null,
            presentationEnd: formData.get('presentationEnd') || null,
            entryFee: formData.get('entryFee') || null,
            organizerContact: formData.get('organizerContact') || null,
            url: formData.get('url') || null,
            isInternal: formData.get('isInternal') === 'on',
            isPublic: formData.get('isPublic') !== 'off'
        };

        const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token') || localStorage.getItem('token');

        try {
            let response;
            if (this.currentEvent) {
                // Update existing
                response = await fetch(`${API_URL}/events/${this.currentEvent.id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
            } else {
                // Create new
                response = await fetch(`${API_URL}/events`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
            }

            if (response.ok) {
                this.resetForm();
                await this.loadEvents();
                this.showNotification('Událost byla úspěšně uložena', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Chyba při ukládání', 'error');
            }
        } catch (error) {
            console.error('Error saving event:', error);
            this.showNotification('Chyba při ukládání události', 'error');
        }
    },

    /**
     * Edit an event
     */
    editEvent(id) {
        const event = this.events.find(e => e.id === id);
        if (!event) return;

        this.currentEvent = event;

        const form = document.getElementById('event-form');
        if (!form) return;

        // Populate form
        form.querySelector('[name="title"]').value = event.title;
        form.querySelector('[name="description"]').value = event.description || '';
        form.querySelector('[name="startDate"]').value = this.formatDateTimeLocal(event.startDate);
        form.querySelector('[name="endDate"]').value = event.endDate ? this.formatDateTimeLocal(event.endDate) : '';
        form.querySelector('[name="location"]').value = event.location || '';
        form.querySelector('[name="category"]').value = event.category;
        form.querySelector('[name="ageGroup"]').value = event.ageGroup || '';
        form.querySelector('[name="eventType"]').value = event.eventType || '';
        form.querySelector('[name="timeControl"]').value = event.timeControl || '';
        form.querySelector('[name="registrationDeadline"]').value = event.registrationDeadline ? this.formatDateTimeLocal(event.registrationDeadline) : '';
        form.querySelector('[name="presentationEnd"]').value = event.presentationEnd ? this.formatDateTimeLocal(event.presentationEnd) : '';
        form.querySelector('[name="entryFee"]').value = event.entryFee || '';
        form.querySelector('[name="organizerContact"]').value = event.organizerContact || '';
        form.querySelector('[name="url"]').value = event.url || '';
        form.querySelector('[name="isInternal"]').checked = event.isInternal;

        // Update form title
        const formTitle = document.getElementById('event-form-title');
        if (formTitle) formTitle.textContent = 'Upravit událost';

        // Show cancel button
        const cancelBtn = document.getElementById('event-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = 'inline-block';

        // Scroll to form
        form.scrollIntoView({ behavior: 'smooth' });
    },

    /**
     * Delete an event
     */
    /**
     * Delete an event
     */
    async deleteEvent(id) {
        const event = this.events.find(e => e.id === id);
        const title = event ? event.title : `ID ${id}`;

        const confirmed = await this.showConfirmModal(
            'Smazat událost?',
            `Opravdu chcete smazat událost "${title}"? Tato akce je nevratná.`,
            true // isDestructive
        );

        if (!confirmed) return;

        const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token') || localStorage.getItem('token');

        try {
            const response = await fetch(`${API_URL}/events/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                await this.loadEvents();
                this.showNotification('Událost byla smazána', 'success');
            } else {
                this.showNotification('Chyba při mazání události', 'error');
            }
        } catch (error) {
            console.error('Error deleting event:', error);
            this.showNotification('Chyba při mazání události', 'error');
        }
    },

    /**
     * Reset form to default state
     */
    resetForm() {
        this.currentEvent = null;

        const form = document.getElementById('event-form');
        if (form) form.reset();

        const formTitle = document.getElementById('event-form-title');
        if (formTitle) formTitle.textContent = 'Nová událost';

        const cancelBtn = document.getElementById('event-cancel-btn');
        if (cancelBtn) cancelBtn.style.display = 'none';
    },

    /**
     * Format date for datetime-local input
     */
    formatDateTimeLocal(dateString) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    },

    /**
     * Show custom confirmation modal
     */
    showConfirmModal(title, message, isDestructive = false) {
        return new Promise((resolve) => {
            // Colors
            const btnColor = isDestructive ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #3b82f6, #2563eb)';
            const iconClass = isDestructive ? 'fa-trash' : 'fa-question-circle';
            const iconColor = isDestructive ? '#f87171' : '#60a5fa';
            const confirmText = isDestructive ? 'Smazat' : 'Potvrdit';

            const modalHtml = `
                <div id="custom-confirm-modal" style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.85);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    backdrop-filter: blur(5px);
                    animation: fadeIn 0.2s ease;
                ">
                    <div style="
                        background: linear-gradient(135deg, #1e293b, #0f172a);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 16px;
                        padding: 2rem;
                        max-width: 400px;
                        width: 90%;
                        text-align: center;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    ">
                        <i class="fa-solid ${iconClass}" style="font-size: 3rem; color: ${iconColor}; margin-bottom: 1rem;"></i>
                        <h3 style="color: #f1f5f9; margin-bottom: 0.5rem; font-size: 1.5rem;">${title}</h3>
                        <p style="color: #94a3b8; margin-bottom: 1.5rem; line-height: 1.5;">${message}</p>
                        <div style="display: flex; gap: 1rem; justify-content: center;">
                            <button id="confirm-modal-cancel" style="
                                padding: 0.75rem 1.5rem;
                                border: 1px solid rgba(255,255,255,0.1);
                                background: rgba(255,255,255,0.05);
                                color: #cbd5e1;
                                border-radius: 8px;
                                cursor: pointer;
                                transition: all 0.2s;
                                font-weight: 500;
                            ">Zrušit</button>
                            <button id="confirm-modal-yes" style="
                                padding: 0.75rem 1.5rem;
                                border: none;
                                background: ${btnColor};
                                color: #fff;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 600;
                                transition: all 0.2s;
                                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
                            ">${confirmText}</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = document.getElementById('custom-confirm-modal');
            const cancelBtn = document.getElementById('confirm-modal-cancel');
            const yesBtn = document.getElementById('confirm-modal-yes');

            const cleanup = (result) => {
                modal.style.opacity = '0';
                setTimeout(() => modal.remove(), 200);
                resolve(result);
            };

            cancelBtn.onclick = () => cleanup(false);
            yesBtn.onclick = () => cleanup(true);

            // Hover effects
            cancelBtn.onmouseenter = () => cancelBtn.style.background = 'rgba(255,255,255,0.1)';
            cancelBtn.onmouseleave = () => cancelBtn.style.background = 'rgba(255,255,255,0.05)';

            yesBtn.onmouseenter = () => yesBtn.style.opacity = '0.9';
            yesBtn.onmouseleave = () => yesBtn.style.opacity = '1';

            modal.onclick = (e) => {
                if (e.target === modal) cleanup(false);
            };

            // ESC key to close
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    cleanup(false);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    },

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (typeof showNotification === 'function') {
            showNotification(message, type);
        } else if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            // Fallback: create temporary toast if system missing
            const toast = document.createElement('div');
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: ${type === 'error' ? '#ef4444' : '#3b82f6'};
                color: white;
                padding: 1rem 2rem;
                border-radius: 8px;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                z-index: 10000;
                animation: slideIn 0.3s ease;
            `;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    }
};

// Export for global access
if (typeof window !== 'undefined') {
    window.AdminEvents = AdminEvents;
}
