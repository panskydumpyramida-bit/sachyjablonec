/**
 * Admin Timeline Module
 * Správa klubové timeliny v about.html (milníky + budoucí cíle)
 */
const AdminTimeline = {
    entries: [],
    editingId: null,

    async init() {
        await this.load();
        this.bindForm();
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
        const el = document.getElementById('alertContainer');
        if (!el) return alert(message);
        const color = type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#64748b';
        el.innerHTML = `<div style="padding:0.75rem 1rem;margin:1rem 0;border-left:3px solid ${color};background:rgba(255,255,255,0.03);">${message}</div>`;
        setTimeout(() => { el.innerHTML = ''; }, 4000);
    },

    async load() {
        try {
            const res = await fetch(this.apiBase());
            if (!res.ok) throw new Error('Load failed');
            this.entries = await res.json();
            this.render();
        } catch (e) {
            console.error('[AdminTimeline] load error', e);
            this.showNotification('Nepodařilo se načíst timelinu', 'error');
        }
    },

    render() {
        const tbody = document.getElementById('timeline-table-body');
        if (!tbody) return;
        if (!this.entries.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:2rem;">Žádné milníky. Přidej první nahoře.</td></tr>';
            return;
        }
        tbody.innerHTML = this.entries.map(e => `
            <tr>
                <td style="color:#94a3b8;">${e.sortOrder}</td>
                <td style="font-weight:700;color:var(--primary-color);">${e.year}</td>
                <td><i class="fa-solid ${e.icon}" style="color:var(--primary-color);font-size:1.1rem;"></i></td>
                <td>${this.escape(e.event)}</td>
                <td>${e.isFuture ? '<span style="padding:0.2rem 0.5rem;border-radius:4px;background:rgba(212,175,55,0.1);color:#d4af37;font-size:0.75rem;">Cíl</span>' : '<span style="color:#94a3b8;font-size:0.75rem;">Historie</span>'}</td>
                <td>
                    <button onclick="AdminTimeline.edit(${e.id})" class="btn btn-sm btn-secondary" title="Upravit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="AdminTimeline.remove(${e.id})" class="btn btn-sm btn-danger" title="Smazat">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    escape(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    bindForm() {
        const form = document.getElementById('timeline-form');
        if (!form || form.__bound) return;
        form.__bound = true;
        form.addEventListener('submit', (e) => this.handleSubmit(e));
    },

    async handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const fd = new FormData(form);
        const payload = {
            year: parseInt(fd.get('year'), 10),
            event: String(fd.get('event') || '').trim(),
            icon: fd.get('icon') || 'fa-chess-pawn',
            sortOrder: parseInt(fd.get('sortOrder'), 10) || 0,
            isFuture: fd.get('isFuture') === 'on',
        };
        if (!payload.year || !payload.event) {
            return this.showNotification('Rok a událost jsou povinné', 'error');
        }

        const token = this.getToken();
        if (!token) return this.showNotification('Nejste přihlášeni', 'error');

        const id = this.editingId;
        const url = id ? `${this.apiBase()}/${id}` : this.apiBase();
        const method = id ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return this.showNotification(err.error || 'Chyba při ukládání', 'error');
            }
            this.showNotification(id ? 'Milník upraven' : 'Milník přidán', 'success');
            this.resetForm();
            await this.load();
        } catch (err) {
            console.error('[AdminTimeline] save error', err);
            this.showNotification('Chyba při ukládání', 'error');
        }
    },

    edit(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry) return;
        this.editingId = id;
        const form = document.getElementById('timeline-form');
        form.elements.year.value = entry.year;
        form.elements.event.value = entry.event;
        form.elements.icon.value = entry.icon;
        form.elements.sortOrder.value = entry.sortOrder;
        form.elements.isFuture.checked = entry.isFuture;

        document.getElementById('timeline-form-title').innerHTML = '<i class="fa-solid fa-pen"></i>Upravit milník';
        document.getElementById('timeline-cancel-btn').style.display = 'inline-flex';
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    cancelEdit() {
        this.resetForm();
    },

    resetForm() {
        this.editingId = null;
        const form = document.getElementById('timeline-form');
        if (form) form.reset();
        const title = document.getElementById('timeline-form-title');
        if (title) title.innerHTML = '<i class="fa-solid fa-plus"></i>Nový milník';
        const btn = document.getElementById('timeline-cancel-btn');
        if (btn) btn.style.display = 'none';
    },

    async remove(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry) return;
        if (!confirm(`Smazat milník "${entry.year} — ${entry.event}"?`)) return;

        const token = this.getToken();
        if (!token) return this.showNotification('Nejste přihlášeni', 'error');

        try {
            const res = await fetch(`${this.apiBase()}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                return this.showNotification(err.error || 'Chyba při mazání', 'error');
            }
            this.showNotification('Milník smazán', 'success');
            await this.load();
        } catch (err) {
            console.error('[AdminTimeline] delete error', err);
            this.showNotification('Chyba při mazání', 'error');
        }
    },
};

window.AdminTimeline = AdminTimeline;
document.addEventListener('DOMContentLoaded', () => AdminTimeline.init());
