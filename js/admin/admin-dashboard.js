/**
 * Admin Dashboard Module
 * 
 * Provides dashboard functionality including:
 * - Stats cards with key metrics
 * - Recent activity feed
 * - Quick action buttons
 */

// ================================
// DASHBOARD STATE
// ================================
let dashboardStats = null;
let dashboardRefreshInterval = null;

// ================================
// LOAD DASHBOARD DATA
// ================================
async function loadDashboardStats() {
    console.log('[admin-dashboard] Loading dashboard stats...');

    const statsContainer = document.getElementById('dashboardStats');
    const activityContainer = document.getElementById('dashboardActivity');

    if (!statsContainer) {
        console.warn('[admin-dashboard] Stats container not found');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/dashboard/stats`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!res.ok) throw new Error('Failed to fetch stats');

        dashboardStats = await res.json();
        renderDashboardStats(dashboardStats);
        renderRecentActivity(dashboardStats.recentActivity);

    } catch (error) {
        console.error('[admin-dashboard] Error loading stats:', error);
        statsContainer.innerHTML = `
            <div class="stat-card stat-card-error">
                <i class="fa-solid fa-exclamation-triangle"></i>
                <span>Nepodařilo se načíst statistiky</span>
            </div>
        `;
    }
}

// ================================
// RENDER FUNCTIONS
// ================================
function renderDashboardStats(data) {
    const container = document.getElementById('dashboardStats');
    if (!container || !data.stats) return;

    const stats = [
        { key: 'news', label: 'Články', icon: 'fa-newspaper', color: '#d4af37' },
        { key: 'comments', label: 'Komentáře', icon: 'fa-comments', color: '#60a5fa' },
        { key: 'users', label: 'Uživatelé', icon: 'fa-users', color: '#4ade80' },
        { key: 'games', label: 'Partie', icon: 'fa-chess', color: '#a78bfa' },
        { key: 'events', label: 'Události', icon: 'fa-calendar', color: '#f472b6' }
    ];

    container.innerHTML = stats.map(stat => `
        <div class="stat-card" style="--accent-color: ${stat.color}">
            <div class="stat-card-icon">
                <i class="fa-solid ${stat.icon}"></i>
            </div>
            <div class="stat-card-content">
                <div class="stat-card-value">${data.stats[stat.key] || 0}</div>
                <div class="stat-card-label">${stat.label}</div>
            </div>
        </div>
    `).join('');
}

function renderRecentActivity(activity) {
    const container = document.getElementById('dashboardActivity');
    if (!container) return;

    if (!activity || activity.length === 0) {
        container.innerHTML = `
            <div class="activity-empty">
                <i class="fa-regular fa-comment-dots"></i>
                <span>Žádná nedávná aktivita</span>
            </div>
        `;
        return;
    }

    container.innerHTML = activity.map(item => `
        <div class="activity-item" onclick="window.open('article.html?id=${item.newsId}', '_blank')">
            <div class="activity-icon">
                <i class="fa-solid fa-comment"></i>
            </div>
            <div class="activity-content">
                <div class="activity-author">${escapeHtml(item.author)}</div>
                <div class="activity-text">${escapeHtml(item.text)}</div>
                <div class="activity-meta">
                    <span class="activity-news">${escapeHtml(item.newsTitle)}</span>
                    <span class="activity-time">${formatTimeAgo(item.createdAt)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ================================
// UTILITY FUNCTIONS
// ================================
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'právě teď';
    if (diffMins < 60) return `před ${diffMins} min`;
    if (diffHours < 24) return `před ${diffHours} h`;
    if (diffDays < 7) return `před ${diffDays} dny`;

    return date.toLocaleDateString('cs-CZ');
}

// ================================
// QUICK ACTIONS
// ================================
function dashboardQuickAction(action) {
    switch (action) {
        case 'new-article':
            switchTab('editor');
            resetEditor();
            break;
        case 'new-game':
            switchTab('games');
            break;
        case 'new-event':
            switchTab('events');
            break;
        case 'gallery':
            switchTab('gallery');
            break;
        case 'refresh-standings':
            refreshStandings();
            break;
        default:
            console.warn('[admin-dashboard] Unknown action:', action);
    }
}

async function refreshStandings() {
    const btn = document.querySelector('[onclick*="refresh-standings"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Aktualizuji...';
    }

    try {
        const res = await fetch(`${API_URL}/standings/update`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (res.ok) {
            showAlert('Tabulky aktualizovány!', 'success');
        } else {
            throw new Error('Update failed');
        }
    } catch (e) {
        showAlert('Chyba při aktualizaci tabulek', 'error');
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-sync"></i> Aktualizovat tabulky';
    }
}

// ================================
// INITIALIZATION
// ================================
function initDashboard() {
    console.log('[admin-dashboard] Initializing dashboard...');
    loadDashboardStats();

    // Auto-refresh every 60 seconds
    if (dashboardRefreshInterval) {
        clearInterval(dashboardRefreshInterval);
    }
    dashboardRefreshInterval = setInterval(loadDashboardStats, 60000);
}

// Stop refresh when leaving dashboard
function stopDashboardRefresh() {
    if (dashboardRefreshInterval) {
        clearInterval(dashboardRefreshInterval);
        dashboardRefreshInterval = null;
    }
}

// ================================
// EXPORTS
// ================================
window.loadDashboardStats = loadDashboardStats;
window.dashboardQuickAction = dashboardQuickAction;
window.initDashboard = initDashboard;
window.stopDashboardRefresh = stopDashboardRefresh;
window.formatTimeAgo = formatTimeAgo;

console.log('[admin-dashboard] Module loaded');
