async function loadComponent(id, file) {
    try {
        const element = document.getElementById(id);
        if (!element) return;

        const version = window.APP_VERSION || Date.now();
        const response = await fetch(`components/${file}?v=${version}`);
        if (response.ok) {
            const html = await response.text();
            element.innerHTML = html;

            if (file === 'header.html') {
                setActiveLink();
                initMobileMenu();
                initDropdownKeyboard();

                // Inject auth.css if not already present
                if (!document.querySelector('link[href*="auth.css"]')) {
                    const authCss = document.createElement('link');
                    authCss.rel = 'stylesheet';
                    authCss.href = `/css/auth.css?v=${version}`;
                    document.head.appendChild(authCss);
                }

                // Initialize auth UI after header is loaded
                const initAuthUI = () => {
                    if (typeof auth !== 'undefined') {
                        if (!auth.initialized && auth.init) {
                            auth.init();
                        } else if (auth.updateUI) {
                            auth.updateUI();
                        }
                    }
                };

                // Try immediately (auth may already be initialized)
                initAuthUI();

                // Listen for auth:ready event in case auth initializes later
                document.addEventListener('auth:ready', initAuthUI, { once: true });
            }
        }
    } catch (e) {
        console.error(`Failed to load component ${file}:`, e);
    }
}

function setActiveLink() {
    const path = window.location.pathname;

    // Normalize a path: strip .html, trailing slashes, leading slashes
    // e.g. "/about.html" -> "about", "/about" -> "about", "/" -> "", "/teams" -> "teams"
    const normalize = (p) => {
        let s = (p || '').replace(/\.html$/i, '').replace(/^\/+|\/+$/g, '');
        if (s === 'index') s = '';
        return s.toLowerCase();
    };

    const currentPage = normalize(path);

    // Find all links in nav
    const links = document.querySelectorAll('.nav-links a');

    links.forEach(link => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;

        // Remove active class first
        link.classList.remove('active');

        const linkPage = normalize(href);

        // Match current page
        if (linkPage === currentPage) {
            link.classList.add('active');

            // Handle dropdown parent active state
            const parentDropdown = link.closest('.dropdown');
            if (parentDropdown) {
                const parentLink = parentDropdown.querySelector(':scope > a');
                if (parentLink) parentLink.classList.add('active');
            }
        }
    });
}

// Mobile menu init (extracted from main.js or similar logic)
function initMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        // Create overlay backdrop
        let overlay = document.querySelector('.mobile-menu-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'mobile-menu-overlay';
            document.body.appendChild(overlay);
        }

        const closeMenu = () => {
            navLinks.classList.remove('active');
            overlay.classList.remove('active');
            menuToggle.classList.remove('active');
            const icon = menuToggle.querySelector('i');
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        };

        menuToggle.addEventListener('click', () => {
            const isOpen = navLinks.classList.toggle('active');
            overlay.classList.toggle('active', isOpen);
            menuToggle.classList.toggle('active', isOpen);
            const icon = menuToggle.querySelector('i');
            if (isOpen) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });

        // Close on overlay click
        overlay.addEventListener('click', closeMenu);

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navLinks.classList.contains('active')) {
                closeMenu();
            }
        });
    }
}


function initDropdownKeyboard() {
    const dropdowns = document.querySelectorAll('.dropdown > a[aria-haspopup]');
    dropdowns.forEach(trigger => {
        trigger.addEventListener('keydown', (e) => {
            const menu = trigger.nextElementSibling;
            if (!menu) return;
            const items = menu.querySelectorAll('a');

            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const isOpen = trigger.getAttribute('aria-expanded') === 'true';
                trigger.setAttribute('aria-expanded', !isOpen);
                if (!isOpen && items.length) items[0].focus();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                trigger.setAttribute('aria-expanded', 'true');
                if (items.length) items[0].focus();
            } else if (e.key === 'Escape') {
                trigger.setAttribute('aria-expanded', 'false');
                trigger.focus();
            }
        });

        const menu = trigger.nextElementSibling;
        if (!menu) return;
        menu.addEventListener('keydown', (e) => {
            const items = Array.from(menu.querySelectorAll('a'));
            const idx = items.indexOf(document.activeElement);

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (idx < items.length - 1) items[idx + 1].focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (idx > 0) items[idx - 1].focus();
                else trigger.focus();
            } else if (e.key === 'Escape') {
                trigger.setAttribute('aria-expanded', 'false');
                trigger.focus();
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const version = window.APP_VERSION || Date.now();

    loadComponent('global-header', 'header.html');
    loadComponent('global-footer', 'footer.html');

    // Dynamically load auth scripts if not already loaded
    if (typeof API_URL === 'undefined') {
        const configScript = document.createElement('script');
        configScript.src = `/js/config.js?v=${version}`;
        configScript.onload = () => {
            if (typeof auth === 'undefined') {
                const authScript = document.createElement('script');
                authScript.src = `/js/auth.js?v=${version}`;
                document.head.appendChild(authScript);
            }
        };
        document.head.appendChild(configScript);
    } else if (typeof auth === 'undefined') {
        const authScript = document.createElement('script');
        authScript.src = `/js/auth.js?v=${version}`;
        document.head.appendChild(authScript);
    }

    // Load global modal manager
    if (typeof modal === 'undefined') {
        const modalScript = document.createElement('script');
        modalScript.src = `/js/modal-manager.js?v=${version}`;
        document.head.appendChild(modalScript);
    }

    // Google Analytics
    const gaId = 'G-GMHL4VL852';
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', gaId);
});
