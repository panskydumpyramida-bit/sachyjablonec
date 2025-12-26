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
                initMobileMenu(); // Re-init mobile menu after loading header

                // Inject auth.css if not already present
                if (!document.querySelector('link[href*="auth.css"]')) {
                    const authCss = document.createElement('link');
                    authCss.rel = 'stylesheet';
                    authCss.href = `/css/auth.css?v=${version}`;
                    document.head.appendChild(authCss);
                }

                // Initialize auth UI after header is loaded
                // Handle race condition: auth may or may not be initialized yet
                const initAuthUI = () => {
                    if (typeof auth !== 'undefined') {
                        if (!auth.initialized && auth.init) {
                            console.log('LayoutLoader: Calling auth.init() explicitely');
                            auth.init();
                        } else if (auth.updateUI) {
                            auth.updateUI();
                        }
                    }
                };

                // Try immediately
                initAuthUI();

                // Also retry after a short delay in case auth.js hasn't initialized yet
                setTimeout(initAuthUI, 100);
                setTimeout(initAuthUI, 500);
            }
        }
    } catch (e) {
        console.error(`Failed to load component ${file}:`, e);
    }
}

function setActiveLink() {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';

    // Find all links in nav
    const links = document.querySelectorAll('.nav-links a');

    links.forEach(link => {
        const href = link.getAttribute('href');

        // Remove active class first
        link.classList.remove('active');

        // Add active class if matches
        if (href === page) {
            link.classList.add('active');

            // Handle dropdown parent active state
            const parentDropdown = link.closest('.dropdown');
            if (parentDropdown) {
                const parentLink = parentDropdown.querySelector('a');
                if (parentLink) parentLink.classList.add('active');
            }
        }
    });

    // Special case for root
    if (page === '' || page === '/') {
        const homeLink = document.querySelector('.nav-links a[href="index.html"]');
        if (homeLink) homeLink.classList.add('active');
    }
}

// Mobile menu init (extracted from main.js or similar logic)
function initMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        // Remove old listeners to avoid duplicates if re-initialized (though innerHTML replaces elements so listeners are gone)
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }
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
