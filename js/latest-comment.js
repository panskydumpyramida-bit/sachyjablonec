/**
 * Latest Comment Widget
 * Fetches and displays the most recent comment on the homepage
 */

class LatestCommentWidget {
    constructor() {
        // Always use bottom container (under hero image) - A/B test showed this is better
        const bottomContainer = document.getElementById('latest-comment-widget');
        const topContainer = document.getElementById('latest-comment-widget-top');

        // Hide top container if exists, use bottom
        if (topContainer) topContainer.style.display = 'none';

        this.container = bottomContainer;

        if (this.container) {
            this.load();
        }
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
        return date.toLocaleDateString('cs-CZ');
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
