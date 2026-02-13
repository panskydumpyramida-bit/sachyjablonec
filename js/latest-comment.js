/**
 * Latest Comment Widget
 * Fetches and displays the most recent comment on the homepage
 * Respects the show_latest_comment admin setting
 */

class LatestCommentWidget {
    constructor() {
        // Always use bottom container (under hero image)
        this.container = document.getElementById('latest-comment-widget');

        if (this.container) {
            this.init();
        }
    }

    async init() {
        // Check if the widget is enabled in admin settings
        try {
            const settingRes = await fetch(`${API_URL}/settings/public/show_latest_comment`);
            if (settingRes.ok) {
                const { value } = await settingRes.json();
                // If setting exists and is explicitly 'false', hide the widget
                if (value === 'false') {
                    this.container.classList.add('hidden');
                    return;
                }
            }
        } catch (e) {
            // If settings check fails, default to showing the widget
            console.warn('Could not check show_latest_comment setting:', e);
        }

        this.load();
    }

    async load() {
        try {
            const response = await fetch(`${API_URL}/comments/latest`);
            if (!response.ok) return;

            const comment = await response.json();
            if (comment) {
                this.render(comment);
            }
        } catch (error) {
            console.error('Failed to load latest comment:', error);
        }
    }

    render(comment) {
        if (!this.container || !comment) return;

        // Get author display name
        let authorName = 'Anonym';
        if (comment.author) {
            if (comment.author.useRealName && comment.author.realName) {
                authorName = comment.author.realName;
            } else {
                authorName = comment.author.username || 'Anonym';
            }
        }

        // Truncate content
        const content = comment.content.length > 80
            ? comment.content.substring(0, 80) + '...'
            : comment.content;

        const timeAgo = this.getTimeAgo(new Date(comment.createdAt));

        this.container.innerHTML = `
            <a href="/article.html?id=${comment.newsId}#comment-${comment.id}" class="latest-comment-card compact">
                <div class="lc-badge-wrapper">
                    <span class="lc-badge-label"><i class="fa-solid fa-comments"></i> Nový komentář</span>
                    <span class="lc-time-inline">(${timeAgo})</span>
                </div>
                
                <div class="lc-separator"></div>

                <div class="lc-content-inline">
                    <span class="lc-author">${this.escapeHtml(authorName)}:</span>
                    <span class="lc-text">"${this.escapeHtml(content)}"</span>
                </div>
                
                <div class="lc-meta-inline">
                     <i class="fa-solid fa-arrow-right" style="opacity:0.5; font-size: 0.8em;"></i>
                     <span class="lc-article-title" title="${this.escapeHtml(comment.news.title)}">${this.escapeHtml(comment.news.title)}</span>
                </div>
            </a>
        `;

        this.container.classList.remove('hidden');
    }

    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'právě teď';
        if (diff < 3600000) return `před ${Math.floor(diff / 60000)} min`;
        if (diff < 86400000) return `před ${Math.floor(diff / 3600000)} hod`;
        // Short date format without year: "1. 2."
        return `${date.getDate()}. ${date.getMonth() + 1}.`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

// Initialize on DOM loaded
document.addEventListener('DOMContentLoaded', () => {
    new LatestCommentWidget();
});
