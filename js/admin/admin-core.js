/**
 * Admin Core Module
 * Contains: Auth, Navigation, Toast, Utilities
 */

// Global State
let authToken = localStorage.getItem('authToken');
let currentUser = null;

// API URL from config
const API_URL = window.API_URL || '/api';

// ================================
// UTILITIES
// ================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fa-solid fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        ${message}
    `;
    toast.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: ${type === 'success' ? '#22c55e' : '#ef4444'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

const showAlert = showToast; // Alias for backward compatibility

// ================================
// AUTHENTICATION
// ================================

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            const data = await res.json();
            authToken = data.token;
            localStorage.setItem('authToken', data.token);
            currentUser = data.user;
            showAdmin();
        } else {
            document.getElementById('loginError').style.display = 'block';
        }
    } catch (e) {
        console.error('Login error:', e);
        alert('Chyba při přihlašování');
    }
}

function logout() {
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    showLogin();
}

function showLogin() {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
}

function showAdmin() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');

    // Role-based tab visibility
    // Role hierarchy: USER < ADMIN < SUPERADMIN (uppercase from DB enum)
    const role = (currentUser?.role || 'USER').toUpperCase();
    const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
    const isSuperadmin = role === 'SUPERADMIN';

    console.log('[RBAC] User:', currentUser?.username, 'Role:', currentUser?.role, '-> Normalized:', role);
    console.log('[RBAC] isAdmin:', isAdmin, 'isSuperadmin:', isSuperadmin);

    // Tabs visible to ADMIN and SUPERADMIN
    const adminTabs = ['galleryTab', 'usersTab', 'competitionsTab'];
    adminTabs.forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) {
            console.log('[RBAC] Tab:', tabId, 'found:', !!tab, 'setting display:', isAdmin ? 'inline-flex' : 'none');
            tab.classList.remove('hidden');  // Remove hidden class first
            tab.style.display = isAdmin ? 'inline-flex' : 'none';
        } else {
            console.warn('[RBAC] Tab not found:', tabId);
        }
    });

    // SUPERADMIN-only sections (backup, dangerous operations)
    // These are controlled via backend RBAC, but we can hide UI hints
    const superadminElements = document.querySelectorAll('[data-role="superadmin"]');
    superadminElements.forEach(el => {
        el.style.display = isSuperadmin ? '' : 'none';
    });

    // Show role badge in user info
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        const roleBadge = role === 'SUPERADMIN' ? '👑' : role === 'ADMIN' ? '⚙️' : '👤';
        userInfo.textContent = `${roleBadge} ${currentUser.username}`;
        userInfo.title = `Role: ${role}`;
    }

    loadDashboard();
}

async function verifyToken() {
    try {
        const res = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            currentUser = await res.json();
            document.getElementById('userInfo').textContent = `${currentUser.username} (${currentUser.role})`;
            showAdmin();
        } else {
            logout();
        }
    } catch (e) {
        logout();
    }
}

// ================================
// NAVIGATION
// ================================

function switchTab(tab) {
    // Cleanup any open modals from previous section
    const imageModal = document.getElementById('imageModal');
    if (imageModal) imageModal.style.display = 'none';
    const galleryPicker = document.getElementById('galleryPickerModal');
    if (galleryPicker) galleryPicker.style.display = 'none';

    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.nav-tab[onclick="switchTab('${tab}')"]`);
    if (activeTab) activeTab.classList.add('active');

    // Hide all views
    ['dashboard', 'editor', 'members', 'users', 'messages', 'blicak', 'competitions', 'gallery', 'games', 'events', 'puzzleRacer'].forEach(v => {
        const el = document.getElementById(v + 'View');
        if (el) el.classList.add('hidden');
    });

    // Show selected view
    const view = document.getElementById(tab + 'View');
    if (view) view.classList.remove('hidden');

    // Load data for view
    if (tab === 'dashboard') loadDashboard();
    else if (tab === 'members') loadMembers();
    else if (tab === 'users') loadUsers();
    else if (tab === 'messages') loadAdminMessages();
    else if (tab === 'blicak') loadBlicakRegistrations();
    else if (tab === 'competitions') loadCompetitions();
    else if (tab === 'gallery') loadAdminGallery();
    else if (tab === 'games') loadRecordedGames();
    else if (tab === 'events' && window.AdminEvents) AdminEvents.init();
    else if (tab === 'puzzleRacer' && window.loadPuzzleRacerSettings) loadPuzzleRacerSettings();
}

// ================================
// DASHBOARD
// ================================

async function loadDashboard() {
    try {
        const res = await fetch(`${API_URL}/news`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const news = await res.json();
        document.getElementById('newsTableBody').innerHTML = news.map(item => `
            <tr>
                <td>${new Date(item.publishedDate).toLocaleDateString('cs-CZ')}</td>
                <td>${item.title}</td>
                <td class="hide-mobile">${item.category}</td>
                <td class="hide-mobile"><span class="highlight-name" style="font-size: 0.85rem;">${item.author?.username || '-'}</span></td>
                <td class="hide-mobile"><span class="status-badge ${item.isPublished ? 'status-published' : 'status-draft'}">${item.isPublished ? '✓' : '○'}<span class="status-text">${item.isPublished ? ' Pub' : ' Konc'}</span></span></td>
                <td>
                    <button class="action-btn btn-edit" onclick="editNews(${item.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn btn-publish" onclick="togglePublish(${item.id})" title="${item.isPublished ? 'Skrýt' : 'Publikovat'}"><i class="fa-solid fa-${item.isPublished ? 'eye-slash' : 'eye'}"></i></button>
                    ${['ADMIN', 'SUPERADMIN'].includes((currentUser?.role || '').toUpperCase()) ? `<button class="action-btn btn-delete" onclick="deleteNews(${item.id})"><i class="fa-solid fa-trash"></i></button>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Dashboard load error:', e);
    }
}

async function togglePublish(id) {
    try {
        await fetch(`${API_URL}/news/${id}/publish`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        loadDashboard();
    } catch (e) {
        console.error(e);
    }
}

async function deleteNews(id) {
    if (!confirm('Opravdu smazat tuto novinku?')) return;
    try {
        await fetch(`${API_URL}/news/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        showToast('Novinka smazána');
        loadDashboard();
    } catch (e) {
        console.error(e);
        showToast('Nepodařilo se smazat', 'error');
    }
}

// ================================
// INIT
// ================================

document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        verifyToken();
    }

    // Enter key for login
    document.getElementById('password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });
});

// Export for global access
window.login = login;
window.logout = logout;
window.switchTab = switchTab;
window.editNews = editNews;
window.togglePublish = togglePublish;
window.deleteNews = deleteNews;
window.showToast = showToast;
window.showAlert = showAlert;
window.escapeHtml = escapeHtml;
