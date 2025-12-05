// News Loader - dynamically loads news from API
// Uses API_URL from config.js (loaded before this script)

// Load and render news
async function loadNews(options = {}) {
    const {
        containerId = 'newsGrid',
        category = null,
        limit = null,
        displayMode = 'cards' // 'cards' or 'list'
    } = options;

    const container = document.getElementById(containerId);

    if (!container) {
        console.log(`News container '${containerId}' not found, skipping...`);
        return;
    }

    // Show loading state
    if (displayMode === 'cards') {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid rgba(212, 175, 55, 0.2); border-radius: 50%; border-top-color: var(--primary-color); animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 1rem; color: var(--text-muted);">Načítání novinek...</p>
            </div>
        `;
    } else {
        container.innerHTML = `<p style="color: var(--text-muted);">Načítání...</p>`;
    }

    try {
        let url = `${API_URL}/news?published=true`;
        if (category) {
            url += `&category=${encodeURIComponent(category)}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch news');
        }

        let news = await response.json();

        // Apply limit if specified
        if (limit && news.length > limit) {
            news = news.slice(0, limit);
        }

        if (news.length === 0) {
            if (displayMode === 'cards') {
                container.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                        <i class="fa-solid fa-newspaper" style="font-size: 3rem; color: var(--text-muted); opacity: 0.3;"></i>
                        <p style="margin-top: 1rem; color: var(--text-muted);">Zatím nejsou k dispozici žádné novinky${category ? ' v této kategorii' : ''}.</p>
                    </div>
                `;
            } else {
                container.innerHTML = `<p style="color: var(--text-muted); font-style: italic;">Žádné novinky</p>`;
            }
            return;
        }

        // Render based on display mode
        if (displayMode === 'cards') {
            container.innerHTML = news.map(item => `
                <article class="card">
                    <div class="card-image">
                        <img src="${item.thumbnailUrl || 'images/chess_placeholder.png'}" 
                             alt="${escapeHtml(item.title)}"
                             onerror="this.src='images/chess_placeholder.png'">
                    </div>
                    <div class="card-content">
                        <span class="card-category">${escapeHtml(item.category)}</span>
                        <span class="card-date">${formatDate(item.publishedDate)}</span>
                        <h3 class="card-title">${escapeHtml(item.title)}</h3>
                        <p class="card-excerpt">${item.excerpt}</p>
                        <a href="${getArticleUrl(item)}" class="read-more">
                            Číst více <i class="fa-solid fa-arrow-right"></i>
                        </a>
                    </div>
                </article>
            `).join('');
        } else if (displayMode === 'full') {
            // Full content display mode - shows entire article content with thumbnail
            container.innerHTML = news.map(item => `
                <article class="card">
                    <div class="card-content">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
                            <div style="flex: 1; min-width: 250px;">
                                <h2 style="font-family: 'Playfair Display', serif; margin: 0 0 0.5rem 0;">${escapeHtml(item.title)}</h2>
                                <span style="color: var(--text-muted); font-size: 0.9rem;">${formatDate(item.publishedDate)}</span>
                            </div>
                            ${item.thumbnailUrl ? `
                                <img src="${item.thumbnailUrl}" 
                                     alt="${escapeHtml(item.title)}"
                                     style="max-width: 200px; max-height: 150px; border-radius: 8px; object-fit: cover;"
                                     onerror="this.style.display='none'">
                            ` : ''}
                        </div>
                        <div style="line-height: 1.8; color: var(--text-light);">
                            ${item.content || `<p>${escapeHtml(item.excerpt || '')}</p>`}
                        </div>
                        <div style="margin-top: 1.5rem;">
                            <a href="${getArticleUrl(item)}" class="read-more">
                                Zobrazit detail <i class="fa-solid fa-arrow-right"></i>
                            </a>
                        </div>
                    </div>
                </article>
            `).join('');
        } else {
            // List display mode
            container.innerHTML = `
                <ul class="news-list">
                    ${news.map(item => `
                        <li>
                            <a href="${getArticleUrl(item)}" class="news-link">
                                <span class="news-date">${formatDate(item.publishedDate)}</span>
                                <span class="news-title">${escapeHtml(item.title)}</span>
                            </a>
                        </li>
                    `).join('')}
                </ul>
            `;
        }
    } catch (error) {
        console.error('Error loading news:', error);
        if (displayMode === 'cards') {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
                    <i class="fa-solid fa-exclamation-triangle" style="font-size: 3rem; color: #fca5a5;"></i>
                    <p style="margin-top: 1rem; color: var(--text-muted);">
                        Nepodařilo se načíst novinky. Zkuste prosím obnovit stránku.
                    </p>
                    <button onclick="loadNews()" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: var(--primary-color); color: var(--secondary-color); border: none; border-radius: 6px; cursor: pointer;">
                        Zkusit znovu
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `<p style="color: #fca5a5;">Chyba při načítání</p>`;
        }
    }
}

function getArticleUrl(item) {
    // Always use article.html with ID for proper detail view
    return `article.html?id=${item.id}`;
}


// Format date to Czech format
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-load news based on page data attributes
function initNewsLoader() {
    // Load main news grid (homepage)
    if (document.getElementById('newsGrid')) {
        loadNews({ containerId: 'newsGrid', displayMode: 'cards' });
    }

    // Load section-specific news
    document.querySelectorAll('[data-news-category]').forEach(el => {
        const category = el.dataset.newsCategory;
        const displayMode = el.dataset.newsDisplay || 'list';
        const limit = el.dataset.newsLimit ? parseInt(el.dataset.newsLimit) : null;
        loadNews({ containerId: el.id, category, displayMode, limit });
    });
}

// Load news when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNewsLoader);
} else {
    initNewsLoader();
}

// Add spinner animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
