/**
 * Auth Manager - Handles user authentication and session management
 */
class AuthManager {
    constructor() {
        this.user = null;
        this.token = null;
        this.listeners = [];
        this.initialized = false;
    }

    // Initialize auth manager - call this after DOM and config are ready
    async init() {
        console.log('[Auth] init() called, initialized:', this.initialized);
        if (this.initialized) return;
        this.initialized = true;

        // Check both storages - localStorage (remember me) or sessionStorage (session only)
        const lsToken = localStorage.getItem('auth_token');
        const ssToken = sessionStorage.getItem('auth_token');
        console.log('[Auth] localStorage token:', lsToken ? lsToken.substring(0, 20) + '...' : 'null');
        console.log('[Auth] sessionStorage token:', ssToken ? ssToken.substring(0, 20) + '...' : 'null');

        this.token = lsToken || ssToken;
        if (this.token) {
            console.log('[Auth] Token found, calling loadUser()');
            await this.loadUser();
        } else {
            console.log('[Auth] No token found, showing login buttons');
            // For guests, still update UI to show login/register buttons
            this.updateUI();
        }
    }

    // Subscribe to auth state changes
    onChange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    // Notify all listeners
    notify() {
        this.listeners.forEach(cb => cb(this.user));
        this.updateUI();
    }

    // Load user from token
    async loadUser() {
        console.log('[Auth] loadUser() called, token:', this.token ? this.token.substring(0, 20) + '...' : 'null');
        if (!this.token) return null;

        try {
            console.log('[Auth] Fetching', API_URL + '/auth/me');
            const response = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });

            console.log('[Auth] Response status:', response.status);
            if (response.ok) {
                this.user = await response.json();
                console.log('[Auth] User loaded:', this.user.username);
                this.notify();
            } else {
                // Only logout if unauthorized (401) or forbidden (403)
                // If server error (500) or network issue, keep the token
                if (response.status === 401 || response.status === 403) {
                    console.warn('[Auth] Token invalid or expired, logging out.');
                    this.logout();
                } else {
                    console.error(`[Auth] Failed to load user (Status ${response.status}), keeping session locally.`);
                }
            }
        } catch (e) {
            console.error('[Auth] Failed to load user:', e);
            // Do not logout on network error - allow retry later
        }

        return this.user;
    }

    // Register new user
    async register(username, email, password) {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registrace selhala');
        }

        return data;
    }

    // Login
    async login(username, password, rememberMe = true) {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Přihlášení selhalo');
        }

        this.token = data.token;
        this.user = data.user;

        // Store token based on remember me preference
        if (rememberMe) {
            localStorage.setItem('auth_token', this.token);
            sessionStorage.removeItem('auth_token');
        } else {
            sessionStorage.setItem('auth_token', this.token);
            localStorage.removeItem('auth_token');
        }

        this.notify();

        return data;
    }

    // Logout
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        this.notify();
    }

    // Get auth headers for API requests
    getHeaders() {
        if (!this.token) return {};
        return { 'Authorization': `Bearer ${this.token}` };
    }

    // Check if user is logged in
    isLoggedIn() {
        return !!this.user;
    }

    // Check if user is admin
    isAdmin() {
        return this.user && ['ADMIN', 'SUPERADMIN'].includes(this.user.role);
    }

    // Check if user is member or higher
    isMember() {
        return this.user && ['MEMBER', 'ADMIN', 'SUPERADMIN'].includes(this.user.role);
    }

    // Update header UI
    updateUI(retryCount = 0) {
        const authContainer = document.getElementById('auth-container');
        if (!authContainer) {
            // Header may not be loaded yet, retry a few times (max 10 seconds)
            if (retryCount < 50) {
                // Exponential backoff or just linear? Linear 200ms is fine.
                setTimeout(() => this.updateUI(retryCount + 1), 200);
            } else {
                console.error('Auth: Failed to find #auth-container after 10s');
            }
            return;
        }

        // Show/hide members link based on login status
        const membersNav = document.getElementById('nav-members');
        if (membersNav) {
            membersNav.style.display = this.user ? '' : 'none';
        }

        if (this.user) {
            const roleBadge = this.user.role === 'SUPERADMIN' ? '<span class="badge-admin">Superadmin</span>'
                : this.user.role === 'ADMIN' ? '<span class="badge-admin">Admin</span>'
                    : this.user.role === 'MEMBER' ? '<span class="badge-member">Člen</span>' : '';

            authContainer.innerHTML = `
                <div class="user-menu">
                    <button class="user-menu-toggle" onclick="auth.toggleUserMenu()">
                        <i class="fa-solid fa-user-circle"></i>
                        <span>${this.escapeHtml(this.user.username)}</span>
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                    <div class="user-dropdown" id="user-dropdown">
                        <div class="user-info">
                            <strong>${this.escapeHtml(this.user.username)}</strong>
                            <small>${this.escapeHtml(this.user.email)}</small>
                            ${roleBadge}
                        </div>
                        <hr>
                        <a href="/account.html" class="dropdown-item">
                            <i class="fa-solid fa-user-gear"></i> Nastavení účtu
                        </a>
                        ${this.isMember() ? `
                        <a href="/members.html" class="dropdown-item">
                            <i class="fa-solid fa-users"></i> Členská sekce
                        </a>
                        ` : ''}
                        ${this.isAdmin() ? `
                        <a href="/admin.html" class="dropdown-item">
                            <i class="fa-solid fa-cog"></i> Administrace
                        </a>
                        ` : ''}
                        <hr>
                        <button onclick="auth.logout()" class="dropdown-item">
                            <i class="fa-solid fa-sign-out-alt"></i> Odhlásit se
                        </button>
                    </div>
                </div>
            `;
        } else {
            authContainer.innerHTML = `
                <button class="auth-btn" onclick="auth.showLoginModal()">
                    <i class="fa-solid fa-sign-in-alt"></i><span class="mobile-text">Přihlásit</span>
                </button>
                <button class="auth-btn auth-btn-outline" onclick="auth.showRegisterModal()">
                    <i class="fa-solid fa-user-plus"></i><span class="mobile-text">Registrace</span>
                </button>
            `;
        }
    }

    toggleUserMenu() {
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    }

    // Show login modal
    showLoginModal() {
        this.showModal('login');
    }

    // Show register modal
    showRegisterModal() {
        this.showModal('register');
    }

    // Generic modal handler
    showModal(type) {
        // Remove existing modal
        const existing = document.getElementById('auth-modal');
        if (existing) existing.remove();

        const isLogin = type === 'login';
        const modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'auth-modal-overlay';
        modal.innerHTML = `
            <div class="auth-modal">
                <button class="auth-modal-close" onclick="auth.closeModal()">
                    <i class="fa-solid fa-times"></i>
                </button>
                
                <h2>${isLogin ? 'Přihlášení' : 'Registrace'}</h2>
                
                ${isLogin ? `
                <button type="button" class="google-signin-btn" onclick="auth.loginWithGoogle()">
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Přihlásit přes Google
                </button>
                
                <div class="auth-divider">
                    <span>nebo</span>
                </div>
                ` : ''}
                
                <form id="auth-form" onsubmit="auth.handleSubmit(event, '${type}')">
                    ${!isLogin ? `
                        <div class="form-group">
                            <label for="auth-email">E-mail</label>
                            <input type="email" id="auth-email" name="email" required placeholder="váš@email.cz">
                        </div>
                    ` : ''}
                    
                    <div class="form-group">
                        <label for="auth-username">Uživatelské jméno</label>
                        <input type="text" id="auth-username" name="username" required 
                               placeholder="${isLogin ? 'Zadejte jméno' : 'Zvolte si přezdívku'}"
                               minlength="3" maxlength="30">
                    </div>
                    
                    <div class="form-group">
                        <label for="auth-password">Heslo</label>
                        <input type="password" id="auth-password" name="password" required 
                               placeholder="${isLogin ? 'Zadejte heslo' : 'Minimálně 6 znaků'}"
                               minlength="${isLogin ? 1 : 6}">
                    </div>
                    
                    ${isLogin ? `
                    <div class="remember-me">
                        <label class="remember-checkbox">
                            <input type="checkbox" id="auth-remember" name="remember" checked>
                            <span>Zapamatovat přihlášení</span>
                        </label>
                    </div>
                    <div class="forgot-password">
                        <a href="#" onclick="auth.showForgotPasswordModal(); return false;">Zapomněli jste heslo?</a>
                    </div>
                    ` : ''}
                    
                    <div id="auth-error" class="auth-error" style="display: none;"></div>
                    
                    <button type="submit" class="auth-submit">
                        ${isLogin ? 'Přihlásit se' : 'Registrovat'}
                    </button>
                </form>
                
                <p class="auth-switch">
                    ${isLogin
                ? 'Nemáte účet? <a href="#" onclick="auth.showRegisterModal(); return false;">Registrovat se</a>'
                : 'Máte účet? <a href="#" onclick="auth.showLoginModal(); return false;">Přihlásit se</a>'}
                </p>
            </div>
        `;

        document.body.appendChild(modal);
        modal.querySelector('input').focus();

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        // Close on Escape
        document.addEventListener('keydown', this.escapeHandler = (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    // Login with Google
    loginWithGoogle() {
        window.location.href = `${API_URL}/auth/google`;
    }

    // Show forgot password modal
    showForgotPasswordModal() {
        const existing = document.getElementById('auth-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'auth-modal';
        modal.className = 'auth-modal-overlay';
        modal.innerHTML = `
            <div class="auth-modal">
                <button class="auth-modal-close" onclick="auth.closeModal()">
                    <i class="fa-solid fa-times"></i>
                </button>
                
                <h2>Obnovení hesla</h2>
                
                <p style="color: var(--text-muted); margin-bottom: 1.5rem; font-size: 0.9rem;">
                    Zadejte svůj email a my vám pošleme odkaz pro obnovení hesla.
                </p>
                
                <form id="forgot-form" onsubmit="auth.handleForgotPassword(event)">
                    <div class="form-group">
                        <label for="forgot-email">E-mail</label>
                        <input type="email" id="forgot-email" name="email" required placeholder="váš@email.cz">
                    </div>
                    
                    <div id="auth-error" class="auth-error" style="display: none;"></div>
                    <div id="auth-success" class="auth-success" style="display: none;"></div>
                    
                    <button type="submit" class="auth-submit">
                        Odeslat odkaz
                    </button>
                </form>
                
                <p class="auth-switch">
                    <a href="#" onclick="auth.showLoginModal(); return false;">Zpět na přihlášení</a>
                </p>
            </div>
        `;

        document.body.appendChild(modal);
        modal.querySelector('input').focus();

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        document.addEventListener('keydown', this.escapeHandler = (e) => {
            if (e.key === 'Escape') this.closeModal();
        });
    }

    async handleForgotPassword(event) {
        event.preventDefault();
        const form = event.target;
        const email = form.email.value.trim();
        const errorDiv = document.getElementById('auth-error');
        const successDiv = document.getElementById('auth-success');
        const submitBtn = form.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';

        try {
            const response = await fetch(`${API_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                successDiv.textContent = 'Pokud účet existuje, odeslali jsme vám email s odkazem pro obnovení hesla.';
                successDiv.style.display = 'block';
                form.style.display = 'none';
            } else {
                throw new Error(data.error || 'Něco se pokazilo');
            }
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Odeslat odkaz';
        }
    }

    closeModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) modal.remove();
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
        }
    }

    async handleSubmit(event, type) {
        event.preventDefault();

        const form = event.target;
        const errorDiv = document.getElementById('auth-error');
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        errorDiv.style.display = 'none';

        try {
            const username = form.username.value.trim();
            const password = form.password.value;

            if (type === 'login') {
                const rememberMe = document.getElementById('auth-remember')?.checked ?? true;
                await this.login(username, password, rememberMe);
            } else {
                const email = form.email.value.trim();
                await this.register(username, email, password);
                // Auto-login after registration (remember by default)
                await this.login(username, password, true);
            }

            this.closeModal();

        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global instance
const auth = new AuthManager();

// Wait for API_URL to be defined (handles race condition with config.js)
const waitForConfig = (maxWait = 5000) => {
    return new Promise((resolve) => {
        if (typeof API_URL !== 'undefined') {
            resolve();
            return;
        }
        const start = Date.now();
        const check = () => {
            if (typeof API_URL !== 'undefined') {
                console.log('[Auth] waitForConfig: API_URL is defined:', API_URL);
                resolve();
            } else if (Date.now() - start > maxWait) {
                console.error('[Auth] waitForConfig: API_URL not defined after 5s');
                resolve(); // Continue anyway
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    });
};

// Initialize auth after DOM is ready (ensures config.js is loaded)
const initAuth = async () => {
    console.log('[Auth] initAuth() starting, readyState:', document.readyState);

    // Wait for API_URL to be defined
    await waitForConfig();

    console.log('[Auth] API_URL ready, checking for OAuth callback');

    // Check for OAuth callback (Google login redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const authToken = urlParams.get('auth_token');
    const needsUsername = urlParams.get('needs_username');

    if (authToken) {
        console.log('[Auth] OAuth callback detected, storing token');
        // Store OAuth token
        localStorage.setItem('auth_token', authToken);
        auth.token = authToken;

        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);

        // Load user data
        await auth.loadUser();

        // Show username setup modal if needed
        if (needsUsername === 'true') {
            auth.showUsernameSetupModal();
        }
    } else {
        console.log('[Auth] No OAuth callback, calling auth.init()');
        // Normal init
        await auth.init();
    }

    console.log('[Auth] initAuth() complete, user:', auth.user?.username || 'null');
};

if (document.readyState === 'loading') {
    console.log('[Auth] DOM loading, adding DOMContentLoaded listener');
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    // DOM is already ready (dynamic load), run immediately
    console.log('[Auth] DOM ready, running initAuth immediately');
    initAuth();
}

// Username setup modal for OAuth users
AuthManager.prototype.showUsernameSetupModal = function () {
    const existing = document.getElementById('auth-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'auth-modal-overlay';
    modal.innerHTML = `
        <div class="auth-modal">
            <h2><i class="fa-solid fa-user-pen"></i> Nastavte si přezdívku</h2>
            
            <p style="color: var(--text-muted); margin-bottom: 1.5rem; font-size: 0.9rem;">
                Vítejte! Prosím zvolte si jedinečnou přezdívku pro komentáře a diskuze.
            </p>
            
            <form id="username-form" onsubmit="auth.handleUsernameSetup(event)">
                <div class="form-group">
                    <label for="setup-username">Přezdívka</label>
                    <input type="text" id="setup-username" name="username" required 
                           placeholder="Zvolte si přezdívku" minlength="3" maxlength="30"
                           pattern="[a-zA-Z0-9_áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]+">
                    <small style="color: var(--text-muted); font-size: 0.75rem;">
                        3-30 znaků, pouze písmena, čísla a podtržítka
                    </small>
                </div>
                
                <div id="auth-error" class="auth-error" style="display: none;"></div>
                
                <button type="submit" class="auth-submit">
                    Uložit přezdívku
                </button>
            </form>
            
            <p class="auth-switch" style="margin-top: 1rem;">
                <a href="#" onclick="auth.cancelUsernameSetup(); return false;">
                    <i class="fa-solid fa-sign-out-alt"></i> Zrušit a odhlásit se
                </a>
            </p>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('input').focus();

    // Don't allow closing this modal by clicking outside
};

AuthManager.prototype.cancelUsernameSetup = async function () {
    // Delete the incomplete user account
    try {
        await fetch(`${API_URL}/auth/delete-account`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
    } catch (e) {
        console.error('Failed to delete account:', e);
    }

    this.logout();
    this.closeModal();
};

AuthManager.prototype.handleUsernameSetup = async function (event) {
    event.preventDefault();
    const form = event.target;
    const username = form.username.value.trim();
    const errorDiv = document.getElementById('auth-error');
    const submitBtn = form.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    errorDiv.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/auth/set-username`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...this.getHeaders()
            },
            body: JSON.stringify({ username })
        });

        const data = await response.json();

        if (response.ok) {
            // Update local state with new token and user
            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('auth_token', data.token);
            this.notify();
            this.closeModal();
        } else {
            throw new Error(data.error || 'Nepodařilo se nastavit přezdívku');
        }
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Uložit přezdívku';
    }
};

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
        const dropdown = document.getElementById('user-dropdown');
        if (dropdown) dropdown.classList.remove('active');
    }
});
