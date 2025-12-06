async function loadComponent(id, file) {
    try {
        const element = document.getElementById(id);
        if (!element) return;

        const response = await fetch(`components/${file}`);
        if (response.ok) {
            const html = await response.text();
            element.innerHTML = html;

            if (file === 'header.html') {
                setActiveLink();
                initMobileMenu(); // Re-init mobile menu after loading header
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
    loadComponent('global-header', 'header.html');
    loadComponent('global-footer', 'footer.html');

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
