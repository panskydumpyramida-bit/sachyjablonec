/**
 * Admin Core Module
 * Contains: Auth, Navigation, Toast, URL Hash Navigation
 * 
 * @requires js/utils.js (escapeHtml, formatDate)
 */

// Global State
let authToken = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
let currentUser = null;

// API URL from config.js (already declared globally, just ensure fallback)
if (!window.API_URL) {
    window.API_URL = '/api';
}

// ================================
// URL HASH NAVIGATION
// ================================

/**
 * Get active tab from URL hash
 * @returns {string} Tab name or 'dashboard' as default
 */
function getTabFromHash() {
    const hash = window.location.hash;
    const match = hash.match(/#tab=(\w+)/);
    return match ? match[1] : 'dashboard';
}

/**
 * Update URL hash with current tab
 * @param {string} tab - Tab name to save
 */
function setTabHash(tab) {
    if (tab && tab !== 'dashboard') {
        history.replaceState(null, '', `#tab=${tab}`);
    } else {
        // Clean URL for dashboard (default)
        history.replaceState(null, '', window.location.pathname);
    }
}

// ================================
// UTILITIES (using global escapeHtml from utils.js)
// ================================

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

    // Save current tab to URL hash for persistence
    setTabHash(tab);

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
// MAINTENANCE MODE
// ================================

async function toggleMaintenance() {
    const toggle = document.getElementById('maintenanceToggle');
    const value = toggle.checked;

    try {
        const res = await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ key: 'maintenance_mode', value: value })
        });

        if (res.ok) {
            showAlert(value ? 'Režim údržby ZAPNUT' : 'Režim údržby VYPNUT', 'success');
        } else {
            toggle.checked = !value;
            showAlert('Chyba při změně nastavení', 'error');
        }
    } catch (e) {
        toggle.checked = !value;
        showAlert('Chyba spojení', 'error');
    }
}

// ================================
// SIDEBAR SECTIONS
// ================================

function toggleSidebarSection(section) {
    const content = document.getElementById(section + 'Content');
    const icon = document.getElementById(section + 'Icon');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(0deg)';
    } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(-90deg)';
    }
}

// ================================
// INIT
// ================================

// Track saved tab for restoration after login
let savedTabFromHash = null;

document.addEventListener('DOMContentLoaded', () => {
    // Save tab from URL before auth check (in case we need to restore after login)
    savedTabFromHash = getTabFromHash();

    if (authToken) {
        verifyToken();
    } else {
        showLogin();
    }

    // Enter key for login
    document.getElementById('password')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });

    // Password visibility toggle
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.classList.toggle('fa-eye');
            togglePassword.classList.toggle('fa-eye-slash');
        });
    }
});

// Export for global access FIRST (before any wrappers)
window.login = login;
window.logout = logout;
window.showLogin = showLogin;
window.showAdmin = showAdmin;
window.verifyToken = verifyToken;
window.switchTab = switchTab;
window.loadDashboard = loadDashboard;
window.togglePublish = togglePublish;
window.deleteNews = deleteNews;
window.showToast = showToast;
window.showAlert = showAlert;
window.toggleMaintenance = toggleMaintenance;
window.toggleSidebarSection = toggleSidebarSection;

// Restore tab after showAdmin is called
// Wrap AFTER exports so window.showAdmin exists
const _originalShowAdminCore = window.showAdmin;
window.showAdmin = function () {
    _originalShowAdminCore();
    // Restore tab from URL hash after login/auth
    if (savedTabFromHash && savedTabFromHash !== 'dashboard') {
        setTimeout(() => switchTab(savedTabFromHash), 100);
    }
};

// Handle browser back/forward
window.addEventListener('hashchange', () => {
    const tab = getTabFromHash();
    if (currentUser) {
        switchTab(tab);
    }
});

