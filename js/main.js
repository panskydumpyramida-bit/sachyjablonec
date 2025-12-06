document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = menuToggle.querySelector('i');
            if (icon) {
                if (navLinks.classList.contains('active')) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-times');
                } else {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
        });
    }

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
                // Close mobile menu if open
                if (navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    const icon = menuToggle.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-times');
                        icon.classList.add('fa-bars');
                    }
                }
            }
        });
    });

    // Show admin button if logged in (and not already on admin page)
    if (localStorage.getItem('authToken') && !window.location.pathname.includes('admin')) {
        const adminBtn = document.createElement('a');
        adminBtn.href = 'admin.html';
        adminBtn.innerHTML = '<i class="fa-solid fa-cog"></i>';
        adminBtn.title = 'Admin Panel';
        adminBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #d4af37, #b8941f);
            color: #1a1a1a;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            box-shadow: 0 4px 15px rgba(212, 175, 55, 0.4);
            z-index: 9999;
            transition: transform 0.3s, box-shadow 0.3s;
            text-decoration: none;
        `;
        adminBtn.onmouseover = () => {
            adminBtn.style.transform = 'scale(1.1)';
            adminBtn.style.boxShadow = '0 6px 20px rgba(212, 175, 55, 0.6)';
        };
        adminBtn.onmouseout = () => {
            adminBtn.style.transform = 'scale(1)';
            adminBtn.style.boxShadow = '0 4px 15px rgba(212, 175, 55, 0.4)';
        };
        document.body.appendChild(adminBtn);
    }

    // Minimal Cookie Consent
    const checkCookieConsent = () => {
        if (!localStorage.getItem('cookieConsent')) {
            const banner = document.createElement('div');
            banner.id = 'cookie-banner';
            banner.innerHTML = `
                <p>Používáme cookies pro zlepšení funkčnosti webu. Procházením stránky s tím souhlasíte.</p>
                <button id="accept-cookies">Rozumím</button>
            `;
            document.body.appendChild(banner);

            // Force reflow
            banner.offsetHeight;
            banner.classList.add('visible');

            document.getElementById('accept-cookies').addEventListener('click', () => {
                localStorage.setItem('cookieConsent', 'true');
                banner.classList.remove('visible');
                setTimeout(() => banner.remove(), 500);
            });
        }
    };

    // Small delay to not annoy user immediately
    setTimeout(checkCookieConsent, 1000);
});
