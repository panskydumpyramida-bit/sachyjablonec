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
                    </tr>
                `).join('');
            }
        }
    } catch (e) {
        console.error('Load Blicák registrations error:', e);
    }
}

// Export for global access
window.loadBlicakRegistrations = loadBlicakRegistrations;
