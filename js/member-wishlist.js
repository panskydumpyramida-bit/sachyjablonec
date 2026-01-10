// Member Wishlist Logic

async function loadWishes() {
    const token = getAuthToken();
    const container = document.getElementById('wishList');
    container.innerHTML = '<p style="color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Načítám...</p>';

    try {
        const res = await fetch(`${API_URL}/messages?type=wish`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const wishes = await res.json();
            if (wishes.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Zatím žádná přání.</p>';
                return;
            }

            container.innerHTML = wishes.map(w => `
                <div class="message-card" style="border-left: 3px solid #f472b6;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="color: #f472b6; font-weight: 700;"><i class="fa-solid fa-wand-magic-sparkles"></i> ${escapeHtml(w.author)}</span>
                        <span style="color: var(--text-muted); font-size: 0.85rem;">${new Date(w.createdAt).toLocaleString('cs-CZ')}</span>
                    </div>
                    <div style="color: var(--text-main);">${escapeHtml(w.content)}</div>
                </div>
            `).join('');
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color: #fca5a5;">Chyba načítání přání.</p>';
    }
}

async function postWish() {
    const author = document.getElementById('wishAuthor').value;
    const content = document.getElementById('wishContent').value;
    const token = getAuthToken();

    if (!author || !content) return alert('Vyplňte jméno a přání.');

    try {
        const res = await fetch(`${API_URL}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ author, content, type: 'wish' })
        });

        if (res.ok) {
            document.getElementById('wishContent').value = '';
            loadWishes();
        }
    } catch (e) {
        console.error('Failed to post wish:', e);
        alert('Chyba při odesílání.');
    }
}
