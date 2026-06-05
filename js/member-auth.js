// API_URL is defined in js/config.js
const MEMBER_ROLES = ['MEMBER', 'ADMIN', 'SUPERADMIN'];

let currentUserRole = 'USER';

// Shown to a logged-in user who is not (yet) a club member, instead of a
// confusing redirect / empty 403 page.
function showPendingMembership() {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;background:#0b0b0f;color:#e8e8ee;font-family:'Inter',system-ui,sans-serif;text-align:center;">
        <div style="max-width:480px;">
          <i class="fa-solid fa-user-clock" style="font-size:3rem;color:#d4af37;display:block;margin-bottom:1.25rem;"></i>
          <h1 style="font-family:'Playfair Display',serif;color:#f1d36b;margin:0 0 0.75rem;">Účet čeká na schválení</h1>
          <p style="color:#a0a0ac;line-height:1.6;margin:0 0 1.25rem;">Jsi přihlášený, ale tvůj účet zatím nemá členský přístup. Členství schvaluje správce klubu po ověření, že patříš mezi členy TJ Bižuterie Jablonec.</p>
          <p style="color:#a0a0ac;line-height:1.6;margin:0 0 1.75rem;">Napiš na <a href="mailto:info@sachyjablonec.cz" style="color:#d4af37;">info@sachyjablonec.cz</a> a uveď své jméno — přístup ti zapneme.</p>
          <a href="/" style="display:inline-block;background:rgba(212,175,55,0.15);border:1px solid #d4af37;color:#d4af37;padding:0.7rem 2rem;border-radius:30px;font-weight:700;text-decoration:none;">Zpět na web</a>
        </div>
      </div>`;
}

function getAuthToken() {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function logout() {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
    window.location.href = '/';
}

async function checkAuth(redirectIfNoAuth = true, requireMember = false) {
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
            // Logged in but not a member yet → show the pending screen instead of
            // letting the page load and hit 403s on every member API call.
            if (requireMember && !MEMBER_ROLES.includes(user.role)) {
                showPendingMembership();
                return null;
            }
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
