/**
 * Admin Messages Module
 * Contains: Messages management (view, delete)
 */

// Admin is already authenticated — send the JWT instead of a hardcoded club
// password (the backend accepts a Bearer token in checkClubPassword).
const msgAuthHeader = () => ({ 'Authorization': `Bearer ${window.authToken || ''}` });

async function loadAdminMessages() {
    try {
        const res = await fetch(`${API_URL}/messages`, { headers: msgAuthHeader() });
        const messages = await res.json();
        const tbody = document.getElementById('messagesTableBody');
        const noInfo = document.getElementById('noMessagesInfo');

        if (!tbody || !noInfo) return;

        if (messages.length === 0) {
            tbody.innerHTML = '';
            noInfo.style.display = 'block';
        } else {
            noInfo.style.display = 'none';
            tbody.innerHTML = messages.map(m => `
                <tr>
                    <td><strong>${escapeHtml(m.author)}</strong></td>
                    <td style="max-width: 400px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(m.content)}</td>
                    <td>${new Date(m.createdAt).toLocaleString('cs-CZ')}</td>
                    <td><button class="action-btn btn-delete" onclick="deleteAdminMessage(${m.id})"><i class="fa-solid fa-trash"></i></button></td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error(e);
        if (window.showAlert) showAlert('Chyba při načítání vzkazů', 'error');
    }
}

async function deleteAdminMessage(id) {
    if (!confirm('Opravdu smazat tento vzkaz?')) return;
    try {
        await fetch(`${API_URL}/messages/${id}`, { method: 'DELETE', headers: msgAuthHeader() });
        if (window.showAlert) showAlert('Vzkaz smazán', 'success');
        loadAdminMessages();
    } catch (e) {
        console.error(e);
        if (window.showAlert) showAlert('Chyba při mazání', 'error');
    }
}

window.loadAdminMessages = loadAdminMessages;
window.deleteAdminMessage = deleteAdminMessage;
