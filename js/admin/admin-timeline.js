/**
 * Správa obrazové klubové kroniky v about.html.
 */
const AdminTimeline = {
    entries: [],
    editingId: null,

    async init() {
        this.bindForm();
        this.bindImageUpload();
        this.updateLivePreview();
        await this.load();
    },

    getToken() {
        return localStorage.getItem('authToken') || localStorage.getItem('auth_token') || localStorage.getItem('token') || window.authToken;
    },

    apiBase() {
        return (window.API_URL || '/api') + '/timeline';
    },

    showNotification(message, type = 'info') {
        if (typeof window.showNotification === 'function') {
            return window.showNotification(message, type);
        }
        const element = document.getElementById('alertContainer');
        if (!element) return alert(message);
        const color = type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#64748b';
        element.innerHTML = `<div style="padding:.75rem 1rem;margin:1rem 0;border-left:3px solid ${color};background:rgba(255,255,255,.03);">${this.escape(message)}</div>`;
        setTimeout(() => { element.innerHTML = ''; }, 4000);
    },

    async load() {
        try {
            const response = await fetch(this.apiBase());
            if (!response.ok) throw new Error('Load failed');
            this.entries = await response.json();
            this.render();
            this.updateStats();
            if (!this.editingId) this.setSuggestedOrder();
        } catch (error) {
            console.error('[AdminTimeline] load error', error);
            this.showNotification('Nepodařilo se načíst časovou osu', 'error');
        }
    },

    updateStats() {
        const historicEntries = this.entries.filter(entry => !entry.isFuture);
        const years = historicEntries.map(entry => Number(entry.year)).filter(Number.isFinite);
        const firstYear = years.length ? Math.min(...years) : 0;
        const lastYear = years.length ? Math.max(...years) : 0;
        document.getElementById('timeline-total').textContent = this.entries.length;
        document.getElementById('timeline-with-photo').textContent = this.entries.filter(entry => entry.imageUrl).length;
        document.getElementById('timeline-years').textContent = firstYear && lastYear ? lastYear - firstYear : 0;
    },

    render() {
        const tbody = document.getElementById('timeline-table-body');
        if (!tbody) return;
        if (!this.entries.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="timeline-empty"><i class="fa-solid fa-timeline"></i><strong>Zatím tu nejsou žádné milníky.</strong><span>Přidejte první v editoru výše.</span></td></tr>';
            return;
        }

        tbody.innerHTML = this.entries.map((entry, index) => {
            const imageUrl = this.safeImageUrl(entry.imageUrl);
            const thumbnail = imageUrl
                ? `<img class="timeline-table-thumb" src="${this.escape(imageUrl)}" alt="">`
                : `<span class="timeline-table-no-photo"><i class="fa-solid ${this.safeIcon(entry.icon)}"></i></span>`;
            const description = entry.description
                ? `<small>${this.escape(entry.description)}</small>`
                : '<small class="timeline-table-muted">Bez doprovodného příběhu</small>';
            const type = entry.isFuture
                ? '<span class="timeline-type timeline-type--future">Cíl</span>'
                : '<span class="timeline-type">Historie</span>';

            return `
                <tr>
                    <td data-label="Pořadí">
                        <div class="timeline-order-controls">
                            <button type="button" onclick="AdminTimeline.move(${entry.id}, -1)" title="Posunout nahoru" ${index === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                            <span>${Number(entry.sortOrder) || 0}</span>
                            <button type="button" onclick="AdminTimeline.move(${entry.id}, 1)" title="Posunout dolů" ${index === this.entries.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                        </div>
                    </td>
                    <td data-label="Rok"><strong class="timeline-table-year">${this.escape(entry.yearLabel || entry.year)}</strong></td>
                    <td data-label="Foto">${thumbnail}</td>
                    <td data-label="Událost" class="timeline-table-story">
                        <strong>${this.escape(entry.event)}</strong>
                        ${description}
                    </td>
                    <td data-label="Typ">${type}</td>
                    <td data-label="Akce">
                        <div class="timeline-row-actions">
                            <button type="button" onclick="AdminTimeline.edit(${entry.id})" class="btn btn-sm btn-secondary" title="Upravit"><i class="fa-solid fa-pen"></i></button>
                            <button type="button" onclick="AdminTimeline.remove(${entry.id})" class="btn btn-sm btn-danger" title="Smazat"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    },

    escape(value) {
        if (value == null) return '';
        return String(value).replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        })[character]);
    },

    safeImageUrl(value) {
        const url = String(value || '').trim();
        return /^(\/|https?:\/\/)/i.test(url) ? url : '';
    },

    safeIcon(value) {
        const icon = String(value || 'fa-chess-pawn');
        return /^fa-[a-z0-9-]+$/.test(icon) ? icon : 'fa-chess-pawn';
    },

    bindForm() {
        const form = document.getElementById('timeline-form');
        if (!form || form.__bound) return;
        form.__bound = true;
        form.addEventListener('submit', event => this.handleSubmit(event));
        form.addEventListener('input', () => this.updateLivePreview());
        form.addEventListener('change', () => this.updateLivePreview());
    },

    bindImageUpload() {
        const fileInput = document.getElementById('timeline-image-file');
        const dropArea = document.getElementById('timeline-image-drop');
        const urlInput = document.getElementById('timeline-image-url');
        const clearButton = document.getElementById('timeline-image-clear');
        if (!fileInput || fileInput.__bound) return;
        fileInput.__bound = true;

        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (file) this.uploadImage(file);
        });
        urlInput.addEventListener('input', () => {
            this.setImagePreview(urlInput.value);
            this.updateLivePreview();
        });
        clearButton.addEventListener('click', () => this.clearImage());

        ['dragenter', 'dragover'].forEach(eventName => dropArea.addEventListener(eventName, event => {
            event.preventDefault();
            dropArea.classList.add('is-dragging');
        }));
        ['dragleave', 'drop'].forEach(eventName => dropArea.addEventListener(eventName, event => {
            event.preventDefault();
            dropArea.classList.remove('is-dragging');
        }));
        dropArea.addEventListener('drop', event => {
            const file = event.dataTransfer.files && event.dataTransfer.files[0];
            if (file) this.uploadImage(file);
        });
    },

    async uploadImage(file) {
        if (!file.type.startsWith('image/')) return this.showNotification('Vyberte obrázek', 'error');
        if (file.size > 5 * 1024 * 1024) return this.showNotification('Obrázek může mít nejvýše 5 MB', 'error');
        const token = this.getToken();
        if (!token) return this.showNotification('Nejste přihlášeni', 'error');

        const status = document.getElementById('timeline-upload-status');
        status.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Nahrávám a optimalizuji fotografii…';
        const formData = new FormData();
        formData.append('image', file);
        formData.append('altText', document.getElementById('timeline-image-alt').value || 'Fotografie z klubové kroniky');
        formData.append('category', 'timeline');

        try {
            const response = await fetch(`${window.API_URL || '/api'}/images/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'Nahrávání selhalo');
            document.getElementById('timeline-image-url').value = result.url;
            this.setImagePreview(result.url);
            this.updateLivePreview();
            status.textContent = 'Fotografie je nahraná a připravená k uložení milníku.';
        } catch (error) {
            console.error('[AdminTimeline] upload error', error);
            status.textContent = error.message;
            this.showNotification(error.message, 'error');
        }
    },

    setImagePreview(value) {
        const url = this.safeImageUrl(value);
        const image = document.getElementById('timeline-image-preview');
        const placeholder = document.getElementById('timeline-image-placeholder');
        const dropArea = document.getElementById('timeline-image-drop');
        if (url) {
            image.src = url;
            image.hidden = false;
            placeholder.hidden = true;
            dropArea.classList.add('has-image');
        } else {
            image.removeAttribute('src');
            image.hidden = true;
            placeholder.hidden = false;
            dropArea.classList.remove('has-image');
        }
    },

    clearImage() {
        document.getElementById('timeline-image-url').value = '';
        document.getElementById('timeline-image-file').value = '';
        this.setImagePreview('');
        this.updateLivePreview();
    },

    updateLivePreview() {
        const form = document.getElementById('timeline-form');
        if (!form) return;
        const imageUrl = this.safeImageUrl(form.elements.imageUrl.value);
        const liveImage = document.getElementById('timeline-live-image');
        document.getElementById('timeline-live-year').textContent = form.elements.yearLabel.value.trim() || form.elements.year.value || 'Rok';
        document.getElementById('timeline-live-category').textContent = form.elements.category.value.trim() || (form.elements.isFuture.checked ? 'Budoucnost' : 'Klub');
        document.getElementById('timeline-live-event').textContent = form.elements.event.value.trim() || 'Název události';
        document.getElementById('timeline-live-description').textContent = form.elements.description.value.trim() || 'Tady se průběžně ukáže příběh milníku.';
        document.getElementById('timeline-live-preview').classList.toggle('is-future', form.elements.isFuture.checked);
        if (imageUrl) {
            liveImage.style.backgroundImage = `url(${JSON.stringify(imageUrl)})`;
            liveImage.hidden = false;
        } else {
            liveImage.style.backgroundImage = '';
            liveImage.hidden = true;
        }
    },

    payloadFromForm(form) {
        const formData = new FormData(form);
        return {
            year: parseInt(formData.get('year'), 10),
            yearLabel: String(formData.get('yearLabel') || '').trim(),
            event: String(formData.get('event') || '').trim(),
            description: String(formData.get('description') || '').trim(),
            category: String(formData.get('category') || '').trim(),
            icon: formData.get('icon') || 'fa-chess-pawn',
            imageUrl: String(formData.get('imageUrl') || '').trim(),
            imageAlt: String(formData.get('imageAlt') || '').trim(),
            sortOrder: parseInt(formData.get('sortOrder'), 10) || 0,
            isFuture: formData.get('isFuture') === 'on',
        };
    },

    async handleSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const payload = this.payloadFromForm(form);
        if (!payload.year || !payload.event) {
            return this.showNotification('Rok a název události jsou povinné', 'error');
        }
        const token = this.getToken();
        if (!token) return this.showNotification('Nejste přihlášeni', 'error');

        const id = this.editingId;
        try {
            const response = await fetch(id ? `${this.apiBase()}/${id}` : this.apiBase(), {
                method: id ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || 'Chyba při ukládání');
            this.showNotification(id ? 'Milník upraven' : 'Milník přidán', 'success');
            this.resetForm();
            await this.load();
        } catch (error) {
            console.error('[AdminTimeline] save error', error);
            this.showNotification(error.message, 'error');
        }
    },

    edit(id) {
        const entry = this.entries.find(item => item.id === id);
        if (!entry) return;
        this.editingId = id;
        const form = document.getElementById('timeline-form');
        form.elements.year.value = entry.year;
        form.elements.yearLabel.value = entry.yearLabel || '';
        form.elements.event.value = entry.event;
        form.elements.description.value = entry.description || '';
        form.elements.category.value = entry.category || '';
        form.elements.icon.value = entry.icon || 'fa-chess-pawn';
        form.elements.imageUrl.value = entry.imageUrl || '';
        form.elements.imageAlt.value = entry.imageAlt || '';
        form.elements.sortOrder.value = entry.sortOrder;
        form.elements.isFuture.checked = entry.isFuture;
        this.setImagePreview(entry.imageUrl);
        this.updateLivePreview();

        document.getElementById('timeline-form-title').innerHTML = '<i class="fa-solid fa-pen"></i>Upravit milník';
        document.getElementById('timeline-cancel-btn').hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    cancelEdit() {
        this.resetForm();
    },

    setSuggestedOrder() {
        const orderInput = document.getElementById('timeline-order');
        if (!orderInput || this.editingId) return;
        const highestOrder = this.entries.reduce((highest, entry) => Math.max(highest, Number(entry.sortOrder) || 0), 0);
        orderInput.value = highestOrder + 10;
    },

    resetForm() {
        this.editingId = null;
        const form = document.getElementById('timeline-form');
        if (form) form.reset();
        document.getElementById('timeline-form-title').innerHTML = '<i class="fa-solid fa-plus"></i>Nový milník';
        document.getElementById('timeline-cancel-btn').hidden = true;
        document.getElementById('timeline-upload-status').textContent = 'Doporučený poměr 16 : 10, minimálně 1200 px na šířku.';
        this.clearImage();
        this.setSuggestedOrder();
        this.updateLivePreview();
    },

    async move(id, direction) {
        const index = this.entries.findIndex(entry => entry.id === id);
        const targetIndex = index + direction;
        if (index < 0 || targetIndex < 0 || targetIndex >= this.entries.length) return;
        const token = this.getToken();
        if (!token) return this.showNotification('Nejste přihlášeni', 'error');

        const current = this.entries[index];
        const target = this.entries[targetIndex];
        try {
            const requests = [
                fetch(`${this.apiBase()}/${current.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ sortOrder: target.sortOrder }),
                }),
                fetch(`${this.apiBase()}/${target.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ sortOrder: current.sortOrder }),
                }),
            ];
            const responses = await Promise.all(requests);
            if (responses.some(response => !response.ok)) throw new Error('Pořadí se nepodařilo změnit');
            await this.load();
        } catch (error) {
            console.error('[AdminTimeline] reorder error', error);
            this.showNotification(error.message, 'error');
        }
    },

    async remove(id) {
        const entry = this.entries.find(item => item.id === id);
        if (!entry || !confirm(`Smazat milník „${entry.yearLabel || entry.year} — ${entry.event}“?`)) return;
        const token = this.getToken();
        if (!token) return this.showNotification('Nejste přihlášeni', 'error');

        try {
            const response = await fetch(`${this.apiBase()}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.error || 'Chyba při mazání');
            }
            if (this.editingId === id) this.resetForm();
            this.showNotification('Milník smazán', 'success');
            await this.load();
        } catch (error) {
            console.error('[AdminTimeline] delete error', error);
            this.showNotification(error.message, 'error');
        }
    },
};

window.AdminTimeline = AdminTimeline;
document.addEventListener('DOMContentLoaded', () => AdminTimeline.init());
