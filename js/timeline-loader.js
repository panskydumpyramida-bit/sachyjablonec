(function () {
    'use strict';

    function escape(value) {
        if (value == null) return '';
        return String(value).replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        })[character]);
    }

    function safeImageUrl(value) {
        const url = String(value || '').trim();
        if (!url || !/^(\/|https?:\/\/)/i.test(url)) return '';
        return escape(url);
    }

    function safeIcon(value) {
        const icon = String(value || 'fa-chess-pawn');
        return /^fa-[a-z0-9-]+$/.test(icon) ? icon : 'fa-chess-pawn';
    }

    function renderEntry(entry, index) {
        const title = escape(entry.event);
        const description = escape(entry.description);
        const category = escape(entry.category || (entry.isFuture ? 'Budoucnost' : 'Klub'));
        const year = escape(entry.yearLabel || entry.year);
        const imageUrl = safeImageUrl(entry.imageUrl);
        const imageAlt = escape(entry.imageAlt || entry.event);
        const futureClass = entry.isFuture ? ' tl-item--future' : '';
        const mediaClass = imageUrl ? ' tl-card--media' : '';
        const delay = Math.min(index * 0.08, 0.64).toFixed(2);

        const photo = imageUrl ? `
            <figure class="tl-photo">
                <img src="${imageUrl}" alt="${imageAlt}" loading="lazy" decoding="async">
            </figure>` : '';
        const body = description ? `<p class="tl-description">${description}</p>` : '';

        return `
            <div class="tl-item${futureClass}" style="--tl-delay:${delay}s">
                <div class="tl-marker" aria-hidden="true"><i class="fa-solid ${safeIcon(entry.icon)}"></i></div>
                <article class="tl-card${mediaClass}">
                    ${photo}
                    <div class="tl-copy">
                        <div class="tl-meta">
                            <span class="tl-year">${year}</span>
                            <span class="tl-category">${category}</span>
                        </div>
                        <h3 class="tl-event">${title}</h3>
                        ${body}
                    </div>
                </article>
            </div>`;
    }

    async function loadTimeline() {
        const container = document.getElementById('timeline-items');
        if (!container) return;

        try {
            const response = await fetch((window.API_URL || '/api') + '/timeline');
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const entries = await response.json();
            if (!Array.isArray(entries) || entries.length === 0) return;
            container.innerHTML = entries.map(renderEntry).join('');
        } catch (error) {
            console.warn('[timeline-loader] fallback to static chronicle:', error.message);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadTimeline);
    } else {
        loadTimeline();
    }
})();
