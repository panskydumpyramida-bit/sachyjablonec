/**
 * Comments Component - Handles article comments
 * Style inspired by chess.cz
 */
class CommentsManager {
    constructor(newsId, containerId = 'comments-section') {
        this.newsId = newsId;
        this.container = document.getElementById(containerId);
        this.comments = [];

        if (this.container) {
            this.render();
            this.load();
        }
    }

    async load() {
        try {
            const response = await fetch(`${API_URL}/comments/${this.newsId}`);
            this.comments = await response.json();
            this.renderComments();

            // Handle anchor scrolling after comments precise load
            if (window.location.hash && window.location.hash.startsWith('#comment-')) {
                setTimeout(() => {
                    const el = document.querySelector(window.location.hash);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('highlight-flash');
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Failed to load comments:', error);
            this.showError('Nepodařilo se načíst komentáře');
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="comments-wrapper">
                <h3 class="comments-title">
                    <i class="fa-solid fa-comments"></i>
                    Diskuze
                    <span class="comments-count" id="comments-count"></span>
                </h3>
                
                <div id="comment-form-container"></div>
                <div id="comment-form-container"></div>
                <div id="comments-list" class="comments-list"></div>
            </div>
        `;

        this.renderForm();
    }

    renderForm() {
        const formContainer = document.getElementById('comment-form-container');

        if (!auth.isLoggedIn()) {
            formContainer.innerHTML = `
                <div class="comment-login-prompt">
                    <p>Pro přidání komentáře se prosím 
                        <a href="#" onclick="auth.showLoginModal(); return false;">přihlaste</a> 
                        nebo 
                        <a href="#" onclick="auth.showRegisterModal(); return false;">registrujte</a>.
                    </p>
                </div>
            `;
            return;
        }

        formContainer.innerHTML = `
            <form class="comment-form" onsubmit="commentsManager.submitComment(event)">
                <div class="comment-form-header">
                    <div class="comment-avatar" style="width: 32px; height: 32px;">
                         ${this.getAvatarHtml(auth.user)}
                    </div>
                    <span>${this.escapeHtml(this.getDisplayName(auth.user))}</span>
                </div>
                <textarea 
                    id="comment-input" 
                    placeholder="Napište svůj komentář..." 
                    rows="3"
                    maxlength="2000"
                    required
                ></textarea>
                <div class="comment-form-actions" style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="form-left-actions" style="display: flex; gap: 1rem; align-items: center;">
                        <span class="char-count"><span id="char-count">0</span>/2000</span>
                        <a href="#" onclick="commentsManager.showRules(); return false;" style="color: #888; font-size: 0.85rem; text-decoration: none; opacity: 0.8;">
                             <i class="fa-solid fa-scale-balanced"></i> Pravidla
                        </a>
                    </div>
                    <button type="submit" class="comment-submit">
                        <i class="fa-solid fa-paper-plane"></i> Odeslat
                    </button>
                </div>
            </form>
        `;

        // Character counter
        const textarea = document.getElementById('comment-input');
        const counter = document.getElementById('char-count');
        textarea.addEventListener('input', () => {
            counter.textContent = textarea.value.length;
        });
    }

    renderComments() {
        const list = document.getElementById('comments-list');
        const countEl = document.getElementById('comments-count');

        const totalCount = this.comments.length +
            this.comments.reduce((sum, c) => sum + (c.replies?.length || 0), 0);

        countEl.textContent = totalCount > 0 ? `(${totalCount})` : '';

        if (this.comments.length === 0) {
            list.innerHTML = `
                <div class="no-comments">
                    <i class="fa-regular fa-comment-dots"></i>
                    <p>Zatím žádné komentáře. Buďte první!</p>
                </div>
            `;
            return;
        }

        list.innerHTML = this.comments.map(c => this.renderComment(c)).join('');
    }

    // Create User Avatar Map Helper
    getAvatarHtml(user) {
        if (!user) return '<i class="fa-solid fa-chess-knight"></i>';

        const displayName = this.getDisplayName(user);
        const userAvatars = {
            'Antonín Duda': 'images/management_antonin.png',
            'Filip Zadražil': 'images/management_filip.jpg',
            'Lukáš Sivák': 'images/management_lukas.png',
            'Radim Podrazký': 'images/management_radim.png'
        };

        const avatarSrc = userAvatars[displayName.trim()];

        if (avatarSrc) {
            return `<img src="${avatarSrc}" alt="${displayName}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        }
        return '<i class="fa-solid fa-chess-knight"></i>';
    }

    renderComment(comment, isReply = false) {
        const isOwner = auth.user && auth.user.id === comment.authorId;
        const isAdmin = auth.isAdmin();
        const roleClass = ['ADMIN', 'SUPERADMIN'].includes(comment.author?.role) ? 'author-admin' : '';

        // Handle Deleted Comment
        if (comment.isDeleted) {
            let deletedText = "Příspěvek smazán.";
            if (comment.deletedBy) {
                if (comment.deletedBy === comment.authorId) {
                    deletedText = "Příspěvek smazán uživatelem.";
                } else {
                    deletedText = "Příspěvek smazán pro porušení <a href='#' onclick='commentsManager.showRules(); return false;' style='color: inherit; text-decoration: underline;'>pravidel diskuze</a>.";
                }
            }

            return `
                 <div class="comment ${isReply ? 'comment-reply' : ''} comment-deleted" id="comment-${comment.id}">
                    <div class="comment-avatar">
                        <i class="fa-solid fa-ban" style="color: #666;"></i>
                    </div>
                    <div class="comment-body">
                         <div class="comment-header">
                            <span class="comment-author" style="color: #888;">Neznámý vojín</span>
                            <span class="comment-time">${this.formatDate(comment.createdAt)}</span>
                        </div>
                        <div class="comment-content" style="color: #888; font-style: italic;">
                            ${deletedText}
                        </div>
                    </div>
                 </div>
            `;
        }

        // Get display name based on user preference
        const displayName = this.getDisplayName(comment.author);
        const avatarHtml = this.getAvatarHtml(comment.author);

        return `
            <div class="comment ${isReply ? 'comment-reply' : ''}" id="comment-${comment.id}">
                <div class="comment-avatar">
                    ${avatarHtml}
                </div>
                <div class="comment-body">
                    <div class="comment-header">
                        <span class="comment-author ${roleClass}">
                            ${this.escapeHtml(displayName)}
                            ${roleClass ? '<i class="fa-solid fa-shield-halved" title="Moderátor"></i>' : ''}
                        </span>
                        <span class="comment-time">${this.formatDate(comment.createdAt)}</span>
                    </div>
                    <div class="comment-content" id="comment-content-${comment.id}">${this.escapeHtml(comment.content)}</div>
                    <div class="comment-actions">
                        ${auth.isLoggedIn() ? `
                            <button class="action-btn" onclick="commentsManager.showReplyForm(${comment.id})">
                                <i class="fa-solid fa-reply"></i> Odpovědět
                            </button>
                        ` : ''}
                        ${isOwner ? `
                            <button class="action-btn" onclick="commentsManager.editComment(${comment.id})">
                                <i class="fa-solid fa-edit"></i> Upravit
                            </button>
                            <button class="action-btn action-btn-danger" onclick="commentsManager.deleteComment(${comment.id})">
                                <i class="fa-solid fa-trash"></i> Smazat
                            </button>
                        ` : ''}
                        ${isAdmin && !isOwner ? `
                            <button class="action-btn action-btn-danger" onclick="commentsManager.hideComment(${comment.id})">
                                <i class="fa-solid fa-eye-slash"></i> Skrýt
                            </button>
                        ` : ''}
                    </div>
                    <div id="reply-form-${comment.id}" class="reply-form-container"></div>
                    ${comment.replies && comment.replies.length > 0 ? `
                        <div class="comment-replies">
                            ${comment.replies.map(r => this.renderComment(r, true)).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    async submitComment(event, parentId = null) {
        event.preventDefault();

        const textarea = parentId
            ? document.querySelector(`#reply-form-${parentId} textarea`)
            : document.getElementById('comment-input');

        const content = textarea.value.trim();
        if (!content) return;

        const submitBtn = parentId
            ? document.querySelector(`#reply-form-${parentId} button[type="submit"]`)
            : document.querySelector('.comment-form button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const response = await fetch(`${API_URL}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...auth.getHeaders()
                },
                body: JSON.stringify({
                    newsId: this.newsId,
                    content,
                    parentId
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Chyba při odesílání');
            }

            textarea.value = '';
            if (parentId) {
                document.getElementById(`reply-form-${parentId}`).innerHTML = '';
            }

            await this.load();

        } catch (error) {
            alert(error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Odeslat';
        }
    }

    showReplyForm(parentId) {
        const container = document.getElementById(`reply-form-${parentId}`);

        if (container.innerHTML) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <form class="comment-form reply-form" onsubmit="commentsManager.submitComment(event, ${parentId})">
                <textarea placeholder="Napište odpověď..." rows="2" maxlength="2000" required></textarea>
                <div class="comment-form-actions">
                    <button type="button" class="comment-cancel" onclick="this.closest('.reply-form-container').innerHTML=''">
                        Zrušit
                    </button>
                    <button type="submit" class="comment-submit">
                        <i class="fa-solid fa-paper-plane"></i> Odpovědět
                    </button>
                </div>
            </form>
        `;

        container.querySelector('textarea').focus();
    }

    // Modal Helpers
    showModal(content) {
        this.closeModal(); // Close existing

        const modal = document.createElement('div');
        modal.id = 'comment-global-modal';
        modal.className = 'auth-modal-overlay';
        modal.innerHTML = `
            <div class="auth-modal" style="max-width: 500px;">
                <button class="auth-modal-close" onclick="commentsManager.closeModal()">
                    <i class="fa-solid fa-times"></i>
                </button>
                ${content}
            </div>
        `;

        document.body.appendChild(modal);
    }

    closeModal() {
        const modal = document.getElementById('comment-global-modal');
        if (modal) modal.remove();
    }

    async editComment(commentId) {
        const contentEl = document.getElementById(`comment-content-${commentId}`);
        const currentContent = contentEl.textContent.trim();

        const formId = `edit-form-${commentId}`;

        this.showModal(`
            <h2>Upravit komentář</h2>
            <form id="${formId}" onsubmit="commentsManager.submitEdit(event, ${commentId})">
                <div class="form-group">
                    <textarea id="edit-textarea-${commentId}" rows="5" class="comment-input" style="width: 100%; padding: 0.75rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff;" required>${this.escapeHtml(currentContent)}</textarea>
                </div>
                <div class="auth-form-actions" style="display: flex; gap: 1rem; justify-content: flex-end;">
                    <button type="button" class="comment-cancel" onclick="commentsManager.closeModal()">Zrušit</button>
                    <button type="submit" class="auth-submit" style="width: auto; padding: 0.6rem 1.5rem;">Uložit změny</button>
                </div>
            </form>
        `);

        setTimeout(() => {
            const textarea = document.getElementById(`edit-textarea-${commentId}`);
            if (textarea) textarea.focus();
        }, 100);
    }

    async submitEdit(event, commentId) {
        event.preventDefault();
        const textarea = document.getElementById(`edit-textarea-${commentId}`);
        const newContent = textarea.value.trim();

        if (!newContent) return;

        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ukládání...';

        try {
            const response = await fetch(`${API_URL}/comments/${commentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...auth.getHeaders()
                },
                body: JSON.stringify({ content: newContent })
            });

            if (!response.ok) throw new Error('Chyba při úpravě');

            this.closeModal();
            await this.load();
        } catch (error) {
            alert(error.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Uložit změny';
        }
    }

    deleteComment(commentId) {
        this.showModal(`
            <h2>Smazat komentář?</h2>
            <p style="text-align: center; color: #ccc; margin-bottom: 2rem;">Opravdu chcete smazat tento komentář? Text příspěvku bude nahrazen informací o smazání.</p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button type="button" class="comment-cancel" onclick="commentsManager.closeModal()">Storno</button>
                <button type="button" class="auth-submit" style="background: #ef4444; width: auto; padding: 0.6rem 2rem;" onclick="commentsManager.confirmDelete(${commentId})">Smazat</button>
            </div>
        `);
    }

    // Soft delete comment
    async confirmDelete(commentId) {
        try {
            // Instead of DELETE, update isDeleted to true
            const response = await fetch(`${API_URL}/comments/${commentId}`, {
                method: 'DELETE', // Can keep method as DELETE for API semantics, but backend handles it
                headers: auth.getHeaders()
            });

            if (!response.ok) throw new Error('Chyba při mazání');

            this.closeModal();
            await this.load();
        } catch (error) {
            alert(error.message);
        }
    }

    hideComment(commentId) {
        this.showModal(`
            <h2>Skrýt komentář?</h2>
            <p style="text-align: center; color: #ccc; margin-bottom: 2rem;">Komentář nebude viditelný pro ostatní uživatele.</p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button type="button" class="comment-cancel" onclick="commentsManager.closeModal()">Zrušit</button>
                <button type="button" class="auth-submit" style="width: auto; padding: 0.6rem 2rem;" onclick="commentsManager.confirmHide(${commentId})">Skrýt</button>
            </div>
        `);
    }

    async confirmHide(commentId) {
        try {
            const response = await fetch(`${API_URL}/comments/${commentId}/hide`, {
                method: 'PUT',
                headers: auth.getHeaders()
            });

            if (!response.ok) throw new Error('Chyba při skrývání');

            this.closeModal();
            await this.load();
        } catch (error) {
            alert(error.message);
        }
    }

    showError(message) {
        const list = document.getElementById('comments-list');
        if (list) {
            list.innerHTML = `<div class="comments-error">${message}</div>`;
        }
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;

        // Less than 1 minute
        if (diff < 60000) return 'právě teď';
        // Less than 1 hour
        if (diff < 3600000) return `před ${Math.floor(diff / 60000)} min`;
        // Less than 24 hours
        if (diff < 86400000) return `před ${Math.floor(diff / 3600000)} hod`;
        // Less than 7 days
        if (diff < 604800000) return `před ${Math.floor(diff / 86400000)} dny`;

        return date.toLocaleDateString('cs-CZ');
    }

    getDisplayName(author) {
        if (!author) return 'Anonym';
        // If user prefers real name and has one set, use it
        if (author.useRealName && author.realName) {
            return author.realName;
        }
        return author.username || 'Anonym';
    }

    showRules() {
        this.showModal(`
            <h2><i class="fa-solid fa-scale-balanced"></i> Pravidla diskuze</h2>
            <div style="text-align: left; margin-top: 1rem;">
                <p style="margin-bottom: 1rem; color: #ddd;">Slušná a věcná diskuze je základem naší komunity. Prosíme o dodržování následujících pravidel.</p>
                <ul style="list-style: none; padding: 0; counter-reset: rule-counter;">
                    <li style="margin-bottom: 1.5rem; position: relative; padding-left: 2.5rem;">
                        <span style="position: absolute; left: 0; top: 0; width: 1.8rem; height: 1.8rem; background: #d4af37; color: #000; border-radius: 50%; text-align: center; line-height: 1.8rem; font-weight: bold;">1</span>
                        <strong style="color: #d4af37; display: block; margin-bottom: 0.3rem;">Vzájemný respekt</strong>
                        Diskutujte slušně. Urážky, vulgarismy, vyhrožování nebo jakékoliv útoky na ostatní uživatele nebudou tolerovány.
                    </li>
                    <li style="margin-bottom: 1.5rem; position: relative; padding-left: 2.5rem;">
                         <span style="position: absolute; left: 0; top: 0; width: 1.8rem; height: 1.8rem; background: #d4af37; color: #000; border-radius: 50%; text-align: center; line-height: 1.8rem; font-weight: bold;">2</span>
                        <strong style="color: #d4af37; display: block; margin-bottom: 0.3rem;">Žádný spam</strong>
                        Nevkládejte opakovaně stejné příspěvky, reklamu nebo odkazy nesouvisející s tématem.
                    </li>
                    <li style="margin-bottom: 1.5rem; position: relative; padding-left: 2.5rem;">
                         <span style="position: absolute; left: 0; top: 0; width: 1.8rem; height: 1.8rem; background: #d4af37; color: #000; border-radius: 50%; text-align: center; line-height: 1.8rem; font-weight: bold;">3</span>
                        <strong style="color: #d4af37; display: block; margin-bottom: 0.3rem;">Ochrana soukromí</strong>
                        Nezveřejňujte osobní údaje (telefonní čísla, adresy) své ani ostatních uživatelů bez jejich souhlasu.
                    </li>
                    <li style="margin-bottom: 1.5rem; position: relative; padding-left: 2.5rem;">
                         <span style="position: absolute; left: 0; top: 0; width: 1.8rem; height: 1.8rem; background: #d4af37; color: #000; border-radius: 50%; text-align: center; line-height: 1.8rem; font-weight: bold;">4</span>
                        <strong style="color: #d4af37; display: block; margin-bottom: 0.3rem;">Dodržování zákonů</strong>
                        Je zakázáno vkládat obsah, který je v rozporu se zákony České republiky.
                    </li>
                     <li style="margin-bottom: 1rem; position: relative; padding-left: 2.5rem;">
                         <span style="position: absolute; left: 0; top: 0; width: 1.8rem; height: 1.8rem; background: #d4af37; color: #000; border-radius: 50%; text-align: center; line-height: 1.8rem; font-weight: bold;">5</span>
                        <strong style="color: #d4af37; display: block; margin-bottom: 0.3rem;">Právo moderátora</strong>
                        Administrátoři si vyhrazují právo smazat jakýkoliv komentář, který porušuje tato pravidla, a zablokovat autora.
                    </li>
                </ul>
            </div>
            <div style="margin-top: 2rem; text-align: center;">
                <button type="button" class="auth-submit" style="width: auto; padding: 0.6rem 2rem;" onclick="commentsManager.closeModal()">Rozumím</button>
            </div>
        `);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

// Global reference
let commentsManager = null;

// Auto-init on article pages
document.addEventListener('DOMContentLoaded', () => {
    const commentsSection = document.getElementById('comments-section');
    if (commentsSection) {
        const newsId = commentsSection.dataset.newsId;
        if (newsId) {
            commentsManager = new CommentsManager(parseInt(newsId));
        }
    }
});

// Re-render form when auth state changes
if (typeof auth !== 'undefined') {
    auth.onChange(() => {
        if (commentsManager) {
            commentsManager.renderForm();
        }
    });
}
