/**
 * SJ Lightbox - Sdílený lightbox modul pro galerii a články
 * Použití: SJLightbox.open(images, startIndex)
 */

const SJLightbox = (function () {
    let images = [];
    let currentIndex = 0;
    let lightboxEl = null;
    let touchStartX = 0;
    let touchEndX = 0;

    // Vytvoří HTML strukturu lightboxu
    function createLightbox() {
        // Check if lightbox already exists
        const existingLightbox = document.getElementById('sj-lightbox');
        if (existingLightbox) {
            // Ensure lightboxEl is set even if container already exists
            lightboxEl = existingLightbox;
            // Verify all child elements exist
            const imgEl = document.getElementById('sj-lightbox-img');
            if (imgEl) {
                return; // Everything is fine, return early
            }
            // Child elements missing, remove and recreate
            existingLightbox.remove();
        }

        const lightbox = document.createElement('div');
        lightbox.id = 'sj-lightbox';
        lightbox.className = 'sj-lightbox';
        lightbox.innerHTML = `
            <div class="sj-lightbox-overlay" onclick="SJLightbox.close()"></div>
            <button class="sj-lightbox-close" onclick="SJLightbox.close()" aria-label="Zavřít">
                <i class="fa-solid fa-times"></i>
            </button>
            <button class="sj-lightbox-nav sj-lightbox-prev" onclick="SJLightbox.prev()" aria-label="Předchozí">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <div class="sj-lightbox-content">
                <img id="sj-lightbox-img" src="" alt="">
                <div class="sj-lightbox-info">
                    <span id="sj-lightbox-caption" class="sj-lightbox-caption"></span>
                    <span id="sj-lightbox-counter" class="sj-lightbox-counter"></span>
                </div>
            </div>
            <button class="sj-lightbox-nav sj-lightbox-next" onclick="SJLightbox.next()" aria-label="Další">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        `;
        document.body.appendChild(lightbox);
        lightboxEl = lightbox;

        // Touch events pro swipe
        lightbox.addEventListener('touchstart', handleTouchStart, { passive: true });
        lightbox.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    function handleTouchStart(e) {
        touchStartX = e.changedTouches[0].screenX;
    }

    function handleTouchEnd(e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }

    function handleSwipe() {
        const diff = touchStartX - touchEndX;
        const threshold = 50;

        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                next(); // Swipe left = next
            } else {
                prev(); // Swipe right = prev
            }
        }
    }

    function updateLightbox() {
        const img = images[currentIndex];
        const imgEl = document.getElementById('sj-lightbox-img');
        const captionEl = document.getElementById('sj-lightbox-caption');
        const counterEl = document.getElementById('sj-lightbox-counter');

        // Defensive checks - ensure elements and data exist
        if (!imgEl || !captionEl || !counterEl || !lightboxEl) {
            console.error('Lightbox elements not found');
            return;
        }

        if (!img) {
            console.error('No image at index', currentIndex);
            return;
        }

        // Podpora pro různé formáty dat (objekt s url/altText nebo přímo string URL)
        const imgUrl = typeof img === 'string' ? img : img.url;
        const imgAlt = typeof img === 'string' ? '' : (img.altText || img.alt || '');

        imgEl.src = imgUrl;
        imgEl.alt = imgAlt || 'Obrázek z galerie';
        captionEl.textContent = imgAlt;
        counterEl.textContent = `${currentIndex + 1} / ${images.length}`;

        // Skrýt/zobrazit navigační tlačítka pokud je jen jeden obrázek
        const prevBtn = lightboxEl.querySelector('.sj-lightbox-prev');
        const nextBtn = lightboxEl.querySelector('.sj-lightbox-next');

        if (images.length <= 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            counterEl.style.display = 'none';
        } else {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
            counterEl.style.display = 'inline';
        }
    }

    function open(imageArray, startIndex = 0) {
        createLightbox();

        images = imageArray || [];
        currentIndex = Math.max(0, Math.min(startIndex, images.length - 1));

        if (images.length === 0) return;

        updateLightbox();
        lightboxEl.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        if (lightboxEl) {
            lightboxEl.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    function next() {
        if (images.length === 0) return;
        currentIndex = (currentIndex + 1) % images.length;
        updateLightbox();
    }

    function prev() {
        if (images.length === 0) return;
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        updateLightbox();
    }

    // Klávesové zkratky
    document.addEventListener('keydown', (e) => {
        if (!lightboxEl || !lightboxEl.classList.contains('active')) return;

        switch (e.key) {
            case 'Escape':
                close();
                break;
            case 'ArrowLeft':
                prev();
                break;
            case 'ArrowRight':
                next();
                break;
        }
    });

    // Public API
    return {
        open,
        close,
        next,
        prev
    };
})();

// Export pro globální použití
window.SJLightbox = SJLightbox;
