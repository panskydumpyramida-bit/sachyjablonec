/**
 * Admin Blicák Module
 * Blicák tournament registration and gallery management
 */

// ================================
// BLICÁK REGISTRATIONS
// ================================

async function loadBlicakRegistrations() {
    try {
        const res = await fetch(`${API_URL}/registration/blicak`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (res.ok) {
            const regs = await res.json();
            const tbody = document.getElementById('blicakTableBody');
            const info = document.getElementById('noBlicakInfo');

            if (regs.length === 0) {
                tbody.innerHTML = '';
                info.style.display = 'block';
            } else {
                info.style.display = 'none';
                tbody.innerHTML = regs.map(reg => `
                    <tr>
                        <td><strong>${escapeHtml(reg.name)}</strong></td>
                        <td>${escapeHtml(reg.club || '-')}</td>
                        <td>${escapeHtml(reg.lok || '-')}</td>
                        <td>${escapeHtml(reg.birthYear)}</td>
                        <td>${new Date(reg.createdAt).toLocaleString('cs-CZ')}</td>
                        <td>${escapeHtml(reg.note || '-')}</td>
                        <td>
                            <button class="btn-danger btn-small" onclick="deleteBlicakRegistration(${reg.id})" title="Smazat hráče">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        }
    } catch (e) {
        console.error('Load Blicák registrations error:', e);
    }
}

async function deleteBlicakRegistration(id) {
    if (!confirm('Opravdu chcete smazat tuto přihlášku?')) return;
    try {
        const res = await fetch(`${API_URL}/registration/blicak/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            showToast('Přihláška úspěšně smazána', 'success');
            loadBlicakRegistrations();
        } else {
            showToast('Chyba při mazání přihlášky', 'error');
        }
    } catch (e) {
        console.error('Delete Blicák registration error:', e);
        showToast('Chyba komunikace se serverem', 'error');
    }
}

// Export for global access
window.loadBlicakRegistrations = loadBlicakRegistrations;
window.deleteBlicakRegistration = deleteBlicakRegistration;
