/**
 * Admin Blicák Module
 * Blicák tournament registration and gallery management
 */

// ================================
// BLICÁK REGISTRATIONS
// ================================

function getSelectedTournament() {
    const sel = document.getElementById('blicakTournamentSelect');
    return sel ? sel.value : 'rapidy-2026';
}

function getSelectedTournamentLabel() {
    const sel = document.getElementById('blicakTournamentSelect');
    if (!sel) return '';
    const opt = sel.options[sel.selectedIndex];
    return opt ? opt.textContent : '';
}

async function loadBlicakRegistrations() {
    try {
        const tournamentId = getSelectedTournament();
        const res = await fetch(`${API_URL}/registration/blicak?tournament=${encodeURIComponent(tournamentId)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (res.ok) {
            const regs = await res.json();
            const tbody = document.getElementById('blicakTableBody');
            const info = document.getElementById('noBlicakInfo');
            const count = document.getElementById('blicakRegCount');
            const label = document.getElementById('blicakTournamentLabel');

            if (label) label.textContent = '· ' + getSelectedTournamentLabel();
            if (count) count.textContent = `Celkem registrací: ${regs.length}`;

            if (regs.length === 0) {
                tbody.innerHTML = '';
                info.style.display = 'block';
                info.textContent = 'Žádné registrace pro tento turnaj.';
            } else {
                info.style.display = 'none';
                tbody.innerHTML = regs.map(reg => {
                    const noteRaw = reg.note || '';
                    const noteHtml = noteRaw
                        ? `<span style="display:inline-block;max-width:280px;color:#fbbf24;font-style:italic;white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(noteRaw)}</span>`
                        : '<span style="color:#64748b;">—</span>';
                    return `
                    <tr>
                        <td><strong>${escapeHtml(reg.name)}</strong></td>
                        <td>${escapeHtml(reg.club || '-')}</td>
                        <td>${escapeHtml(reg.lok || '-')}</td>
                        <td>${escapeHtml(reg.birthYear || '-')}</td>
                        <td style="white-space:nowrap;">${new Date(reg.createdAt).toLocaleString('cs-CZ')}</td>
                        <td>${noteHtml}</td>
                        <td>
                            <button class="btn-danger btn-small" onclick="deleteBlicakRegistration(${reg.id})" title="Smazat hráče">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
                }).join('');
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
