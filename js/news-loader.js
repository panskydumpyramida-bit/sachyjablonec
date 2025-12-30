// News Loader - dynamically loads news from API
// Uses API_URL from config.js (loaded before this script)

// Helper: Check if article has games and return indicator HTML
function getGamesIndicator(item) {
    if (!item.gamesJson || item.gamesJson === '[]' || item.gamesJson === 'null') {
        return '';
    }
    // Return a 2x2 chessboard mini-icon
    return `<span class="games-indicator" title="Obsahuje přehrávač partií">
        <span class="mini-board">
            <span class="sq sq-light"></span>
            <span class="sq sq-dark"></span>
            <span class="sq sq-dark"></span>
            <span class="sq sq-light"></span>
        </span>
    </span>`;
}

// Helper: Get comment indicator with count and latest info
function getCommentsIndicator(item) {
    const count = item._count?.comments || 0;
    if (count === 0) return '';

    let items = [`<span title="${count} komentářů"><i class="fa-solid fa-comment"></i> ${count}</span>`];

    // Add latest comment info if available
    if (item.comments && item.comments.length > 0) {
        const last = item.comments[0];
        const date = new Date(last.createdAt);
        const timeStr = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('cs-CZ');

        let authorName = 'Anonym';
        if (last.author) {
            authorName = (last.author.useRealName && last.author.realName) ? last.author.realName : (last.author.username || 'Anonym');
        }

        items.push(`<span class="latest-comment-info" title="Poslední komentář: ${authorName}, ${dateStr} ${timeStr}">
            <i class="fa-solid fa-clock-rotate-left"></i> ${timeStr} • ${escapeHtml(authorName)}
        </span>`);
    }

    const commentLink = (item.comments && item.comments.length > 0)
        ? `${getArticleUrl(item)}#comment-${item.comments[0].id}`
        : `${getArticleUrl(item)}#comments-section`;

    return `<div class="card-meta-comments">
        <a href="${commentLink}" onclick="event.stopPropagation()" class="meta-comment-link">
            ${items.join('')}
        </a>
    </div>`;
}

// Load and render news
async function loadNews(options = {}) {
    const {
        containerId = 'newsGrid',
        category = null,
        limit = null,
        displayMode = 'cards' // 'cards' or 'list'
    } = options;

    const container = document.getElementById(containerId);

    if (!container) return;

    // Show loading state only if we are probably doing a fresh load (limit is not 0)
    // If limit is 0, it means we are expanding "Show More", so we might want to keep content
    // But currently loadNews fetches everything again.
    // To prevent layout shift (footer jump), let's keep the old content and append spinner, 
    // OR just set min-height.
    // Simplest fix for jump: Don't clear innerHTML immediately if container has content.
    const isExpanding = limit === 0 && container.children.length > 0;

    if (!isExpanding) {
        container.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-chess-knight fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i></div>';
    } else {
        // Appending spinner to end
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner-append';
        spinner.innerHTML = '<i class="fa-solid fa-chess-knight fa-spin" style="font-size: 2rem; color: var(--primary-color);"></i>';
        spinner.style.cssText = 'text-align: center; padding: 2rem; width: 100%; grid-column: 1 / -1;';

        // Remove old "Show More" button if it exists to avoid confusion
        const oldBtn = container.querySelector('button.read-more');
        if (oldBtn) oldBtn.closest('div').remove();

        container.appendChild(spinner);
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

        // Save full list for stats before applying limit
        // Filter out empty news (no title)
        news = news.filter(item => item.title && item.title.trim() !== '');

        const fullNewsList = [...news];

        // Apply limit logic
        let hasMore = false;
        if (limit && limit > 0 && news.length > limit) {
            news = news.slice(0, limit);
            hasMore = true;
        }

        if (news.length === 0) {
            // Check if we should hide the parent wrapper
            if (options.hideIfEmptyId) {
                const wrapper = document.getElementById(options.hideIfEmptyId);
                if (wrapper) wrapper.style.display = 'none';
                return; // Stop rendering
            }

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

        // Check if we should show stats header (data-news-show-stats attribute)
        const showStats = container.hasAttribute('data-news-show-stats');
        let statsHtml = '';

        if (showStats && fullNewsList && fullNewsList.length > 0) {
            const totalCount = fullNewsList.length;
            const latestPost = fullNewsList[0]; // First item is the latest (sorted by date)
            const latestDate = formatDate(latestPost.publishedDate);
            const latestTitle = escapeHtml(latestPost.title);

            statsHtml = `
                <div class="news-stats-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; padding: 0.75rem; margin-bottom: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="display: flex; align-items: center; gap: 0.4rem; color: var(--primary-color); font-weight: 600; font-size: 0.85rem;">
                            <i class="fa-solid fa-newspaper"></i>
                            ${totalCount} příspěvků
                        </span>
                    </div>
                    <a href="${getArticleUrl(latestPost)}" style="display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.8rem; text-decoration: none; transition: color 0.2s;" onmouseover="this.style.color='var(--primary-color)'" onmouseout="this.style.color='var(--text-muted)'">
                        <i class="fa-solid fa-clock" style="color: var(--primary-color);"></i>
                        <span>Poslední: <strong style="color: var(--text-light);">${latestTitle.length > 40 ? latestTitle.substring(0, 40) + '...' : latestTitle}</strong></span>
                        <span style="opacity: 0.7;">${latestDate}</span>
                    </a>
                </div>
            `;
        }

        let htmlContent = '';

        // Render based on display mode
        if (displayMode === 'cards') {
            htmlContent = news.map((item, index) => `
                <article class="card" onclick="window.location.href='${getArticleUrl(item)}'" style="cursor: pointer;">
                    <div class="card-image">
                        ${(() => {
                    let thumb = item.thumbnailUrl || 'images/chess_placeholder.jpg';
                    let crop = 'center';
                    if (thumb.includes('#crop=')) {
                        const parts = thumb.split('#crop=');
                        thumb = parts[0];
                        crop = parts[1]; // e.g. "25%" or "50%"
                    }

                    // Use thumbnail version for local uploads if available
                    // We assume thumbnail exists if it matches our upload pattern
                    let src = thumb;
                    if (thumb.startsWith('/uploads/') && !thumb.includes('-thumb')) {
                        const ext = thumb.split('.').pop();
                        src = thumb.replace(`.${ext}`, `-thumb.${ext}`);
                    }

                    const loadingAttr = index < 2 ? 'eager' : 'lazy';
                    return `<img src="${src}" 
                                     alt="${escapeHtml(item.title)}"
                                     loading="${loadingAttr}"
                                     width="400" height="300"
                                     style="object-position: center ${crop};"
                                     onerror="this.src='${thumb}'; this.onerror=null; this.src='images/chess_placeholder.jpg'">`;
                })()}
                    </div>
                    <div class="card-content">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                            <span class="card-category" style="margin-bottom: 0;">${escapeHtml(item.category)}${getGamesIndicator(item)}</span>
                            <span class="card-date" style="margin-bottom: 0; font-size: 0.8rem;">${formatDate(item.publishedDate)}</span>
                        </div>
                        
                        <h3 class="card-title" style="margin-bottom: 0.25rem; line-height: 1.3;">${escapeHtml(item.title)}</h3>
                        
                        <!-- Author & Stats -->
                        <div style="display: flex; gap: 1rem; color: var(--text-muted); font-size: 0.8rem; margin: 0 0 0.75rem 0; align-items: center; opacity: 0.8;">
                            ${(() => {
                    let author = item.authorName;
                    if (!author && item.author) {
                        author = (item.author.useRealName && item.author.realName) ? item.author.realName : (item.author.username || 'Admin');
                    }
                    if (item.coAuthorName || item.coAuthor) {
                        let co = item.coAuthorName;
                        if (!co && item.coAuthor) {
                            co = (item.coAuthor.useRealName && item.coAuthor.realName) ? item.coAuthor.realName : item.coAuthor.username;
                        }
                        if (co) author += ` a ${co}`;
                    }
                    return author ? `<span><i class="fa-solid fa-user-pen" style="font-size: 0.8em;"></i> ${escapeHtml(author)}</span>` : '';
                })()}
                            ${item.viewCount !== undefined ? `<span title="Počet zobrazení"><i class="fa-regular fa-eye" style="font-size: 0.8em;"></i> ${item.viewCount}</span>` : ''}
                        </div>

                        <p class="card-excerpt">${item.excerpt}</p>
                        ${getCommentsIndicator(item)}
                        <a href="${getArticleUrl(item)}" class="read-more" onclick="event.stopPropagation()">
                            Číst více <i class="fa-solid fa-arrow-right"></i>
                        </a>
                    </div>
                </article>
            `).join('');
        } else if (displayMode === 'full' || displayMode === 'full-short') {
            // Full content display mode - side-by-side layout
            htmlContent = news.map(item => `
                <article class="card" onclick="window.location.href='${getArticleUrl(item)}'" style="cursor: pointer;">
                    <div class="card-content">
                        <div class="news-cols-layout">
                            <div class="news-cols-content">
                                <h2 style="font-family: 'Playfair Display', serif; margin: 0 0 0.5rem 0; color: var(--primary-color);">${escapeHtml(item.title)}</h2>
                                <div style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;">${formatDate(item.publishedDate)}${getGamesIndicator(item)}</div>
                                
                                <div style="line-height: 1.6; color: var(--text-light); margin-bottom: 1.5rem;">
                                    ${displayMode === 'full'
                    ? (item.content || `<p>${escapeHtml(item.excerpt || '')}</p>`)
                    : `<p>${escapeHtml(item.excerpt || '')}</p>`
                }
                                </div>
                                
                                <div>
                                    <a href="${getArticleUrl(item)}" class="read-more" onclick="event.stopPropagation()">
                                        Zobrazit detail <i class="fa-solid fa-arrow-right"></i>
                                    </a>
                                </div>
                            </div>
                            
                            ${item.thumbnailUrl ? (() => {
                    let thumb = item.thumbnailUrl;
                    let crop = 'center';
                    if (thumb.includes('#crop=')) {
                        const parts = thumb.split('#crop=');
                        thumb = parts[0];
                        crop = parts[1];
                    }
                    return `
                                <div class="news-cols-image">
                                    <img src="${thumb}" 
                                         alt="${escapeHtml(item.title)}"
                                         loading="lazy"
                                         width="280" height="210"
                                         style="object-position: center ${crop};"
                                         onerror="this.style.display='none'">
                                </div>`;
                })() : ''}
                        </div>
                    </div>
                </article>
            `).join('');
        } else {
            // List display mode
            htmlContent = `
                <ul class="news-list">
                    ${news.map(item => `
                        <li>
                            <a href="${getArticleUrl(item)}" class="news-link">
                                <span class="news-date">${formatDate(item.publishedDate)}</span>
                                <span class="news-title">${escapeHtml(item.title)}${getGamesIndicator(item)}</span>
                            </a>
                        </li>
                    `).join('')}
                </ul>
            `;
        }

        // Add Show More button if there are more items
        if (hasMore) {
            const catArg = category ? `'${category}'` : 'null';
            htmlContent += `
                <div style="grid-column: 1 / -1; text-align: center; margin-top: 2rem; width: 100%;">
                    <button onclick="loadNews({ containerId: '${containerId}', category: ${catArg}, displayMode: '${displayMode}', limit: 0 })"
                        class="read-more"
                        style="background: transparent; border: 1px solid var(--primary-color); color: var(--primary-color); cursor: pointer; padding: 0.8rem 2rem; border-radius: 50px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.3s;"
                        onmouseover="this.style.background='rgba(212,175,55,0.1)'"
                        onmouseout="this.style.background='transparent'">
                        <i class="fa-solid fa-clock-rotate-left"></i> Zobrazit starší novinky
                    </button>
                </div>
            `;
        } else {
            // Check if we are in "Expanded" state to show "Show Less" button
            // We need to know what the original limit was.
            const el = document.getElementById(containerId);
            const originalLimit = el && el.dataset.newsLimit ? parseInt(el.dataset.newsLimit) : 0;

            if (limit === 0 && originalLimit > 0 && news.length > originalLimit) {
                const catArg = category ? `'${category}'` : 'null';
                htmlContent += `
                    <div style="grid-column: 1 / -1; text-align: center; margin-top: 2rem; width: 100%;">
                        <button onclick="loadNews({ containerId: '${containerId}', category: ${catArg}, displayMode: '${displayMode}', limit: ${originalLimit} })"
                            class="read-more"
                            style="background: transparent; border: 1px solid var(--primary-color); color: var(--primary-color); cursor: pointer; padding: 0.8rem 2rem; border-radius: 50px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.5rem; transition: all 0.3s;"
                            onmouseover="this.style.background='rgba(212,175,55,0.1)'"
                            onmouseout="this.style.background='transparent'">
                            <i class="fa-solid fa-compress-arrows-alt"></i> Zobrazit méně
                        </button>
                    </div>
                `;
            }
        }

        container.innerHTML = statsHtml + htmlContent;

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
        const el = document.getElementById('newsGrid');
        const limit = el.dataset.newsLimit ? parseInt(el.dataset.newsLimit) : null;
        loadNews({ containerId: 'newsGrid', displayMode: 'cards', limit });
    }

    // Load section-specific news
    document.querySelectorAll('[data-news-category]').forEach(el => {
        const category = el.dataset.newsCategory;
        const displayMode = el.dataset.newsDisplay || 'list';
        const limit = el.dataset.newsLimit ? parseInt(el.dataset.newsLimit) : null;
        const hideIfEmptyId = el.dataset.newsHideIfEmpty || null;
        loadNews({ containerId: el.id, category, displayMode, limit, hideIfEmptyId });
    });
}

// Load news when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNewsLoader);
} else {
    initNewsLoader();
}

// Add styles
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .news-cols-layout {
        display: flex;
        gap: 2rem;
        align-items: flex-start;
    }
    
    .news-cols-content {
        flex: 1;
        min-width: 0; /* Prevents flex overflow */
    }
    
    .news-cols-image {
        flex-shrink: 0;
        width: 280px;
    }
    
    .news-cols-image img {
        width: 100%;
        border-radius: 8px;
        object-fit: cover;
        aspect-ratio: 4/3;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    
    @media (max-width: 768px) {
        .news-cols-layout {
            flex-direction: column-reverse;
        }
        .news-cols-image {
            width: 100%;
            margin-bottom: 1rem;
        }
        .news-cols-image img {
            max-height: 250px;
        }
    }
    
    /* Games Indicator - Mini Chessboard Icon */
    .games-indicator {
        display: inline-flex;
        align-items: center;
        margin-left: 0.5rem;
        vertical-align: middle;
    }
    .mini-board {
        display: grid;
        grid-template-columns: repeat(2, 7px);
        grid-template-rows: repeat(2, 7px);
        gap: 0;
        border-radius: 2px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }
    .sq { display: block; }
    .sq-light { background: #f0d9b5; }
    .sq-dark { background: #b58863; }

    /* Comment Indicators */
    .card-meta-comments {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-top: 0.5rem;
        margin-bottom: 1rem;
        font-size: 0.85rem;
        color: var(--text-muted);
        border-top: 1px solid rgba(255,255,255,0.05);
        padding-top: 0.5rem;
    }
    .card-meta-comments i {
        color: var(--primary-color);
        margin-right: 0.3rem;
    }
    .latest-comment-info {
        display: inline-flex;
        align-items: center;
        opacity: 0.8;
        font-size: 0.8rem;
    }

    .meta-comment-link {
        display: flex;
        align-items: center;
        gap: 1rem;
        color: inherit;
        text-decoration: none;
        transition: color 0.2s;
        width: 100%;
    }
    
    .meta-comment-link:hover {
        color: var(--primary-color);
        text-decoration: none;
    }
    .meta-comment-link:hover .latest-comment-info {
        opacity: 1;
        color: var(--primary-color);
    }
`;
document.head.appendChild(style);
