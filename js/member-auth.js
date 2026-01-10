// API_URL is defined in js/config.js
const PASSWORD_KEY = 'club_password';

let currentUserRole = 'USER';

function getAuthToken() {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function logout() {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
    window.location.href = '/';
}

async function checkAuth(redirectIfNoAuth = true) {
    const token = getAuthToken();
    if (!token) {
        if (redirectIfNoAuth) window.location.href = '/members.html?login=true';
        return null;
    }
    try {
        const res = await fetch(`${API_URL}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            const user = await res.json();
            currentUserRole = user.role;
            return user;
        } else {
            console.error('Auth check failed:', res.status, res.statusText);
            if (!redirectIfNoAuth) {
                let text = '';
                try { text = await res.text(); } catch (e) { }
                alert(`Chyba přihlášení: Status ${res.status} (${res.statusText}).\nOdpověď: ${text}`);
            }
            if (redirectIfNoAuth) window.location.href = '/members.html?login=true';
            return null;
        }
    } catch (e) {
        console.error('Auth check error', e);
        if (!redirectIfNoAuth) alert(`Chyba spojení s API: ${e.message}.\nUjistěte se, že server běží a jste na správné adrese.`);
        if (redirectIfNoAuth) window.location.href = '/members.html?login=true';
        return null;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
