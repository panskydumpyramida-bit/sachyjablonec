/**
 * Admin Sidebar — sidebar nav populate + mobile drawer toggle.
 * Pracuje s existujícím .admin-nav (zdroj pravdy o visibility) — každou sidebar
 * položku zrcadlí k odpovídajícímu #xxxTab aby RBAC display:none fungoval stejně.
 */
(function () {
    'use strict';

    const NAV = {
        content: [
            { tab: 'dashboard',   label: 'Články & přehled', icon: 'fa-newspaper' },
            { tab: 'games',       label: 'Partie',           icon: 'fa-chess-board' },
            { tab: 'timeline',    label: 'Timeline',         icon: 'fa-timeline' },
            { tab: 'gallery',     label: 'Galerie',          icon: 'fa-images' },
        ],
        community: [
            { tab: 'events',      label: 'Události',     icon: 'fa-calendar-days' },
            { tab: 'members',     label: 'Členové',      icon: 'fa-address-book' },
            { tab: 'blicak',      label: 'Blicák',       icon: 'fa-bolt' },
            { tab: 'users',       label: 'Uživatelé',    icon: 'fa-users' },
            { tab: 'competitions', label: 'Soutěže',     icon: 'fa-trophy' },
        ],
        tools: [
            { tab: 'chessdb',     label: 'Databáze',     icon: 'fa-database' },
            { tab: 'puzzleRacer', label: 'Puzzle Racer', icon: 'fa-puzzle-piece' },
            { tab: 'changelog',   label: 'Changelog',    icon: 'fa-code-branch' },
        ],
        footer: [
            { tab: 'settings',                label: 'Nastavení',    icon: 'fa-gear' },
            { href: 'docs/admin-manual.html', label: 'Manuál',       icon: 'fa-book', external: true },
            { href: 'docs/api-manual.html',   label: 'API',          icon: 'fa-code', external: true },
            { href: '/',                      label: 'Zobrazit web', icon: 'fa-external-link-alt', external: true },
            { action: 'logout',               label: 'Odhlásit',     icon: 'fa-sign-out-alt', danger: true },
        ],
    };

    function createNavItem(item) {
        if (item.href) {
            const a = document.createElement('a');
            a.className = 'nav-tab';
            a.href = item.href;
            if (item.external) a.target = '_blank';
            a.dataset.label = item.label;
            if (item.danger) a.classList.add('nav-tab--danger');
            a.innerHTML = `<i class="fa-solid ${item.icon}"></i><span>${item.label}</span>`;
            return a;
        }
        if (item.action === 'logout') {
            const a = document.createElement('a');
            a.className = 'nav-tab nav-tab--danger';
            a.href = '#';
            a.dataset.label = item.label;
            a.onclick = (e) => { e.preventDefault(); if (window.logout) window.logout(); };
            a.innerHTML = `<i class="fa-solid ${item.icon}"></i><span>${item.label}</span>`;
            return a;
        }
        // tab item
        const div = document.createElement('div');
        div.className = 'nav-tab';
        div.dataset.tab = item.tab;
        div.dataset.label = item.label;
        div.onclick = () => { if (window.switchTab) window.switchTab(item.tab); };
        div.innerHTML = `<i class="fa-solid ${item.icon}"></i><span>${item.label}</span>`;
        return div;
    }

    function populateGroup(containerId, items) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        items.forEach(item => {
            const el = createNavItem(item);
            container.appendChild(el);
        });
    }

    function syncVisibility() {
        // Mirror display state from legacy #xxxTab to sidebar items
        document.querySelectorAll('.admin-sidebar .nav-tab[data-tab]').forEach(el => {
            const tabKey = el.dataset.tab;
            const legacy = document.getElementById(tabKey + 'Tab');
            if (legacy) {
                // Visibility is controlled by inline style (display:none for restricted)
                const legacyHidden = legacy.style.display === 'none';
                el.style.display = legacyHidden ? 'none' : '';
            }
        });
    }

    function syncActive() {
        // Find active legacy tab
        const activeLegacy = document.querySelector('.admin-container > .admin-nav .nav-tab.active');
        const activeKey = activeLegacy && activeLegacy.getAttribute('onclick')
            ? (activeLegacy.getAttribute('onclick').match(/switchTab\('([^']+)'\)/) || [])[1]
            : null;

        document.querySelectorAll('.admin-sidebar .nav-tab[data-tab]').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === activeKey);
        });

        // Update topbar title from active item label
        if (activeKey) {
            const activeItem = document.querySelector(`.admin-sidebar .nav-tab[data-tab="${activeKey}"]`);
            if (activeItem) {
                const label = activeItem.dataset.label || 'Přehled';
                const iconClass = activeItem.querySelector('i')?.className.match(/fa-[a-z0-9-]+/g)?.filter(c => c !== 'fa-solid')?.[0] || 'fa-list';
                const titleEl = document.getElementById('currentTabTitle');
                if (titleEl) {
                    titleEl.innerHTML = `<i class="fa-solid ${iconClass}"></i><span>${label}</span>`;
                }
            }
        }
    }

    function init() {
        populateGroup('sidebarNavContent',   NAV.content);
        populateGroup('sidebarNavCommunity', NAV.community);
        populateGroup('sidebarNavTools',     NAV.tools);
        populateGroup('sidebarNavFooter',    NAV.footer);

        document.body.classList.add('has-sidebar');

        // Observe legacy .admin-nav for visibility changes (RBAC may hide tabs post-auth)
        const legacyNav = document.querySelector('.admin-container > .admin-nav');
        if (legacyNav) {
            const mo = new MutationObserver(() => { syncVisibility(); syncActive(); });
            mo.observe(legacyNav, { attributes: true, subtree: true, attributeFilter: ['style', 'class'] });
        }

        // Initial sync
        setTimeout(() => { syncVisibility(); syncActive(); }, 100);

        // Watch for tab switches (switchTab updates legacy .active class)
        // Use periodic poll since switchTab implementation may not dispatch events
        setInterval(syncActive, 500);

        // First-run onboarding hint — explains Ctrl+B collapse (shown once per device)
        try {
            if (!localStorage.getItem('adminSidebarHintDismissed')) {
                const host = document.querySelector('.sidebar-brand');
                if (host) {
                    const pop = document.createElement('div');
                    pop.className = 'sidebar-onboard';
                    pop.innerHTML = '<div class="title">Věděli jste?</div> Menu můžete sbalit přes <kbd>Ctrl+B</kbd> nebo tlačítkem na okraji.'
                        + '<button style="margin-top:.5rem;background:var(--primary-color);border:none;color:#000;padding:.25rem .6rem;border-radius:3px;font-size:.72rem;cursor:pointer;">Rozumím</button>';
                    host.style.position = 'relative';
                    host.appendChild(pop);
                    const dismiss = () => { pop.remove(); try { localStorage.setItem('adminSidebarHintDismissed', '1'); } catch (e) {} };
                    pop.querySelector('button').onclick = dismiss;
                    setTimeout(dismiss, 12000);
                }
            }
        } catch (e) {}
    }

    // Mobile drawer toggle (exposed globally)
    window.toggleAdminSidebar = function () {
        const sb = document.getElementById('adminSidebar');
        const ov = document.getElementById('adminSidebarOverlay');
        if (!sb) return;
        sb.classList.toggle('open');
        if (ov) ov.classList.toggle('open');
    };

    window.closeAdminSidebar = function () {
        const sb = document.getElementById('adminSidebar');
        const ov = document.getElementById('adminSidebarOverlay');
        if (sb) sb.classList.remove('open');
        if (ov) ov.classList.remove('open');
    };

    // Desktop collapse toggle (persisted to localStorage)
    window.toggleSidebarCollapse = function () {
        const collapsed = document.body.classList.toggle('sidebar-collapsed');
        try { localStorage.setItem('adminSidebarCollapsed', collapsed ? '1' : '0'); } catch (e) {}
    };

    // Restore collapsed state from localStorage on init
    try {
        if (localStorage.getItem('adminSidebarCollapsed') === '1') {
            document.body.classList.add('sidebar-collapsed');
        }
    } catch (e) {}

    // Keyboard shortcut: Ctrl+B / Cmd+B to toggle
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
            // Don't capture if user is typing in an input/textarea/editor
            const tag = e.target.tagName;
            const isEditable = e.target.isContentEditable;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return;
            e.preventDefault();
            window.toggleSidebarCollapse();
        }
    });

    // Close on nav item click (mobile)
    document.addEventListener('click', (e) => {
        const tap = e.target.closest('.admin-sidebar .nav-tab[data-tab]');
        if (tap && window.innerWidth < 768) {
            window.closeAdminSidebar();
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
