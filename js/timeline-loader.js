(function () {
    'use strict';

    async function loadTimeline() {
        const container = document.getElementById('timeline-items');
        if (!container) return;

        try {
            const apiBase = (window.API_URL || '/api') + '/timeline';
            const res = await fetch(apiBase);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const entries = await res.json();
            if (!Array.isArray(entries) || entries.length === 0) return; // keep fallback

            // Adjust grid columns to actual count
            const count = entries.length;
            container.style.gridTemplateColumns = `repeat(${Math.min(count, 6)}, 1fr)`;

            container.innerHTML = entries.map((e, idx) => {
                const future = e.isFuture ? ' tl-item--future' : '';
                const delay = (0.6 + idx * 0.3).toFixed(2);
                const escaped = String(e.event).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
                return `
                    <div class="tl-item${future}" style="animation-delay: ${delay}s">
                        <div class="tl-marker" title="${escaped}"><i class="fa-solid ${e.icon || 'fa-chess-pawn'}"></i></div>
                        <div class="tl-year">${e.year}</div>
                        <div class="tl-event">${escaped}</div>
                    </div>
                `;
            }).join('');

            // Adjust track animation width — stop before the first future item
            const firstFutureIdx = entries.findIndex(e => e.isFuture);
            const track = document.querySelector('.about-timeline-section .tl-track');
            if (track && firstFutureIdx > 0) {
                // Markers at centers (100/count)*(i+0.5). Left offset 12%, total 75%.
                // Simplest: keep CSS default behavior (set by hero-v2.css for 4-item layout).
                // If future marker is not the last, we could compute; for now CSS default is fine.
            }
        } catch (e) {
            console.warn('[timeline-loader] fallback to static items:', e.message);
            // leave the static HTML in place
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadTimeline);
    } else {
        loadTimeline();
    }
})();
