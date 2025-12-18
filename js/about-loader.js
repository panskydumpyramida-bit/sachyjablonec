/**
 * about-loader.js
 * Handles dynamic content for the About page, specifically FIDE ratings.
 */

document.addEventListener('DOMContentLoaded', () => {
    loadFideRatings();
});

async function loadFideRatings() {
    const cards = document.querySelectorAll('.management-card[data-fide-id]');

    // We can fetch in parallel or sequence. Parallel is better.
    const promises = Array.from(cards).map(async card => {
        const fideId = card.getAttribute('data-fide-id');
        const eloEl = card.querySelector('.elo-value');

        if (!fideId || !eloEl) return;

        try {
            // Fallback for API_URL if not defined
            const baseUrl = (typeof API_URL !== 'undefined') ? API_URL : '/api';
            const response = await fetch(`${baseUrl}/scraping/fide/${fideId}`);
            if (!response.ok) throw new Error('Failed');

            const data = await response.json();

            if (data.stdRating && data.stdRating !== 'N/A') {
                eloEl.textContent = data.stdRating;
                // Add a small highlight animation
                eloEl.style.color = '#fff';
                setTimeout(() => eloEl.style.color = '', 300);
            } else {
                eloEl.textContent = '-';
            }
        } catch (error) {
            console.error(`Error loading FIDE for ${fideId}`, error);
            eloEl.textContent = '?';
            eloEl.title = 'Nepodařilo se načíst';
        }
    });

    await Promise.allSettled(promises);
}
