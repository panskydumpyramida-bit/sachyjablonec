/**
 * about-loader.js
 * Handles dynamic content for the About page, specifically FIDE ratings.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Load ELO from Rosada (Domestic Source)
    async function loadRatings() {
        const cards = document.querySelectorAll('.management-card[data-rosada-id]');

        const baseUrl = (typeof API_URL !== 'undefined') ? API_URL : '/api';
        console.log('Loading Ratings from Rosada...');

        const promises = Array.from(cards).map(async card => {
            const rosadaId = card.getAttribute('data-rosada-id');
            const eloEl = card.querySelector('.elo-value');

            if (!rosadaId || !eloEl) return;

            try {
                const response = await fetch(`${baseUrl}/scraping/rosada/${rosadaId}`);
                if (!response.ok) throw new Error('Failed');

                const data = await response.json();

                // Prefer ELO CR, fallback to FIDE
                const rating = (data.eloCr && data.eloCr !== 'N/A') ? data.eloCr : data.eloFide;

                if (rating && rating !== 'N/A') {
                    eloEl.textContent = rating;
                    eloEl.style.color = '#fff';
                    // Add tooltip about source
                    eloEl.title = `ELO ČR: ${data.eloCr || '-'}, FIDE: ${data.eloFide || '-'}`;
                } else {
                    eloEl.textContent = '-';
                }
            } catch (error) {
                console.error(`Error loading Rosada for ${rosadaId}`, error);
                eloEl.textContent = '-';
            }
        });

        await Promise.allSettled(promises);
    }

    // Initial load
    loadRatings();
});
