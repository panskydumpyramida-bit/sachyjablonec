/**
 * Admin Core Module
 * Contains: Auth, Navigation, Toast, URL Hash Navigation
 * 
 * @requires js/utils.js (escapeHtml, formatDate)
 */

// Global State
// Global State
let authToken = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
window.authToken = authToken; // Expose globally
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
    const search = window.location.search; // Preserve ?editId=... etc
    if (tab && tab !== 'dashboard') {
        history.replaceState(null, '', `${search}#tab=${tab}`);
    } else {
        // Clean URL for dashboard (default)
        // Keep search params? Usually dashboard doesn't need them.
        // But if we navigate to dashboard explicitly, we might want to clear specific params.
        // However, generic behavior: setTab('dashboard') -> clean tab.
        // Let's preserve search params unless we explicitly want to clear them.
        // Actually dashboard usually implies clean state.

        // If we want to preserve generic search params:
        // history.replaceState(null, '', `${search}${window.location.pathname}`);

        // But current implementation wiped everything.
        // Let's stick to safe preservation or minimal change.
        history.replaceState(null, '', `${window.location.pathname}${search}`);
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
            window.authToken = data.token;
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
    window.authToken = null;
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
            window.currentUser = currentUser; // Make globally accessible
            document.getElementById('userInfo').textContent = `${currentUser.username} (${currentUser.role})`;
            showAdmin();
            window.dispatchEvent(new Event('authChecked'));
        } else {
            logout();
        }
    } catch (e) {
        console.error('[admin-core] verifyToken error:', e);
        logout();
    }
}

// ================================
// NAVIGATION
// ================================

function switchTab(tab) {
    if (!currentUser) return; // Guard against unauthenticated access

    // Check for unsaved changes in Editor
    // 'editor' is the ID of the news editor view.
    // If we are currently ON the editor tab (which is active), and isNewsDirty is true.
    const currentActive = document.querySelector('.nav-tab.active');
    // Simple check: if editor view is not hidden and dirty...
    const editorView = document.getElementById('editorView');
    if (editorView && !editorView.classList.contains('hidden') && window.isNewsDirty) {
        showUnsavedChangesModal(tab);
        return;
    }

    // Cleanup any open modals from previous section
    const imageModal = document.getElementById('imageModal');
    if (imageModal) imageModal.style.display = 'none';
    const galleryPicker = document.getElementById('galleryPickerModal');
    if (galleryPicker) galleryPicker.style.display = 'none';

    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.nav-tab[onclick="switchTab('${tab}')"]`);
    if (activeTab) activeTab.classList.add('active');

    // Hide all views
    ['dashboard', 'editor', 'members', 'users', 'messages', 'blicak', 'competitions', 'gallery', 'games', 'events', 'puzzleRacer', 'chessdb', 'changelog'].forEach(v => {
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
    else if (tab === 'chessdb' && window.loadChessDBStats) loadChessDBStats();
}

/**
 * Show Unsaved Changes Modal
 */
function showUnsavedChangesModal(destinationTab) {
    let modal = document.getElementById('unsavedChangesModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'unsavedChangesModal';
        modal.innerHTML = `
            <div class="modal-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:10010;" onclick="closeUnsavedChangesModal()"></div>
            <div class="modal-content" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10011;background:#1e293b;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:2rem;width:90%;max-width:400px;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
                <div style="margin-bottom:1.5rem;color:#fbbf24;font-size:3rem;"><i class="fa-solid fa-triangle-exclamation"></i></div>
                <h3 style="margin-bottom:1rem;color:#f1f5f9;font-size:1.25rem;">Máte neuložené změny</h3>
                <p style="color:#94a3b8;margin-bottom:2rem;line-height:1.5;">Chcete změny před odchodem uložit? Pokud odejdete bez uložení, změny budou ztraceny.</p>
                <div style="display:flex;flex-direction:column;gap:0.75rem;">
                    <button id="unsavedSaveBtn" class="btn-primary" style="width:100%;justify-content:center;padding:0.75rem;">Uložit a odejít</button>
                    <button id="unsavedDiscardBtn" class="btn-secondary" style="width:100%;justify-content:center;padding:0.75rem;color:#f87171;border-color:rgba(248,113,113,0.3);">Zahodit změny</button>
                    <button onclick="closeUnsavedChangesModal()" class="btn-secondary" style="width:100%;justify-content:center;padding:0.75rem;">Zrušit</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Setup handlers (re-attach to capture current destinationTab)
    const saveBtn = modal.querySelector('#unsavedSaveBtn');
    const discardBtn = modal.querySelector('#unsavedDiscardBtn');

    saveBtn.onclick = () => {
        closeUnsavedChangesModal();
        if (window.saveNews) {
            // saveNews redirects to dashboard on success. 
            // We could modify saveNews, or accept this behavior. 
            // User just wants to save. "Uložit a odejít" implies leaving editor.
            // If saveNews succeeds, it goes to Dashboard. If fail, stays.
            window.saveNews();
        }
    };

    discardBtn.onclick = () => {
        closeUnsavedChangesModal();
        window.isNewsDirty = false; // Force clear
        switchTab(destinationTab);
    };

    modal.style.display = 'block';
}

function closeUnsavedChangesModal() {
    const modal = document.getElementById('unsavedChangesModal');
    if (modal) modal.style.display = 'none';
}

// Export global
window.switchTab = switchTab;
window.showUnsavedChangesModal = showUnsavedChangesModal;
window.closeUnsavedChangesModal = closeUnsavedChangesModal;

// ================================
// DASHBOARD
// ================================

async function loadDashboard() {
    // Initialize new dashboard module (stats, activity feed)
    if (typeof initDashboard === 'function') {
        initDashboard();
    }

    // Load news table
    try {
        const res = await fetch(`${API_URL}/news`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const news = await res.json();
        document.getElementById('newsTableBody').innerHTML = news.map(item => {
            // Determine status: published, scheduled (future date), or draft
            const now = new Date();
            const pubDate = new Date(item.publishedDate);
            const isScheduled = item.isPublished && pubDate > now;
            const isPublished = item.isPublished && pubDate <= now;

            let statusClass, statusIcon, statusText;
            if (isScheduled) {
                statusClass = 'status-scheduled';
                statusIcon = '⏰';
                statusText = ' Naplán';
            } else if (isPublished) {
                statusClass = 'status-published';
                statusIcon = '✓';
                statusText = ' Pub';
            } else {
                statusClass = 'status-draft';
                statusIcon = '○';
                statusText = ' Konc';
            }

            return `
            <tr>
                <td>${new Date(item.publishedDate).toLocaleDateString('cs-CZ')}</td>
                <td>${item.title}</td>
                <td class="hide-mobile">${item.category}</td>
                <td class="hide-mobile"><span class="highlight-name" style="font-size: 0.85rem;">${item.author?.username || '-'}</span></td>
                <td class="hide-mobile"><span class="status-badge ${statusClass}">${statusIcon}<span class="status-text">${statusText}</span></span></td>
                <td>
                    <button class="action-btn btn-edit" onclick="editNews(${item.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn btn-publish" onclick="togglePublish(${item.id})" title="${item.isPublished ? 'Skrýt' : 'Publikovat'}"><i class="fa-solid fa-${item.isPublished ? 'eye-slash' : 'eye'}"></i></button>
                    ${['ADMIN', 'SUPERADMIN'].includes((currentUser?.role || '').toUpperCase()) ? `<button class="action-btn btn-delete" onclick="deleteNews(${item.id})"><i class="fa-solid fa-trash"></i></button>` : ''}
                </td>
            </tr>
        `}).join('');
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

/**
 * Check maintenance mode status on load
 */
async function checkMaintenance() {
    try {
        const res = await fetch(`${API_URL}/settings`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const settings = await res.json();
        const toggle = document.getElementById('maintenanceToggle');
        if (toggle) toggle.checked = settings.maintenance_mode === 'true';
    } catch (e) {
        console.error('Failed to check maintenance status:', e);
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
window.checkMaintenance = checkMaintenance;
window.toggleSidebarSection = toggleSidebarSection;

// Restore tab after showAdmin is called
// Wrap AFTER exports so window.showAdmin exists
const _originalShowAdminCore = window.showAdmin;
window.showAdmin = function () {
    _originalShowAdminCore();
    // Check maintenance status on admin load
    if (typeof checkMaintenance === 'function') {
        checkMaintenance();
    }
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

