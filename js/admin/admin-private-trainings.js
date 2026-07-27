let privateTrainings = [];

const privateTrainingApi = () => `${API_URL}/private-trainings`;
const money = value => `${Math.round(value).toLocaleString('cs-CZ')} Kč`;
const dateLabel = value => new Date(value).toLocaleDateString('cs-CZ', { timeZone: 'UTC' });

async function loadPrivateTrainings() {
    try {
        const res = await fetch(privateTrainingApi(), { headers: { Authorization: `Bearer ${window.authToken}` } });
        if (!res.ok) throw new Error('load');
        privateTrainings = await res.json();
        renderPrivateTrainings();
    } catch (error) {
        console.error(error);
        window.showAlert('Nepodařilo se načíst soukromé tréninky.', 'error');
    }
}

function renderPrivateTrainings() {
    const summary = document.getElementById('privateTrainingSummary');
    const rows = document.getElementById('privateTrainingRows');
    const payers = document.getElementById('privateTrainingPayers');
    if (!summary || !rows || !payers) return;
    const trainers = ['Tsantsala', 'Brehmová'].map(trainer => {
        const sessions = privateTrainings.filter(item => item.trainer === trainer);
        const hours = sessions.reduce((sum, item) => sum + item.hours, 0);
        const total = sessions.reduce((sum, item) => sum + item.hours * item.hourlyRate, 0);
        return { trainer, sessions: sessions.length, hours, total };
    });
    summary.innerHTML = trainers.map(item => `<div style="padding:1rem;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.03);"><strong>${item.trainer}</strong><div style="font-size:1.5rem;margin:.35rem 0;">${item.sessions} tréninků</div><span style="color:var(--text-muted);">${item.hours} h · ${money(item.total)}</span></div>`).join('') + `<div style="padding:1rem;border:1px solid rgba(212,175,55,.35);border-radius:8px;background:rgba(212,175,55,.07);"><strong>Celkem</strong><div style="font-size:1.5rem;margin:.35rem 0;">${privateTrainings.length} tréninků</div><span style="color:var(--text-muted);">${privateTrainings.reduce((sum, item) => sum + item.hours, 0)} h · ${money(privateTrainings.reduce((sum, item) => sum + item.hours * item.hourlyRate, 0))}</span></div>`;
    const byPayer = new Map();
    privateTrainings.forEach(training => {
        const count = training.attendances.length;
        if (!count) return;
        const share = training.hours * training.hourlyRate / count;
        training.attendances.forEach(attendance => byPayer.set(attendance.payerName, (byPayer.get(attendance.payerName) || 0) + share));
    });
    payers.innerHTML = byPayer.size ? `<table class="data-table"><thead><tr><th>Plátce</th><th>Příspěvek</th></tr></thead><tbody>${[...byPayer.entries()].sort((a, b) => a[0].localeCompare(b[0], 'cs')).map(([name, total]) => `<tr><td>${escapeHtml(name)}</td><td><strong>${money(total)}</strong></td></tr>`).join('')}</tbody></table>` : '<p style="color:var(--text-muted);">Doplň účastníky u tréninků, aby šel příspěvek rozdělit mezi rodiče.</p>';
    rows.innerHTML = privateTrainings.length ? privateTrainings.map(training => {
        const cost = training.hours * training.hourlyRate;
        const count = training.attendances.length;
        return `<tr><td>${dateLabel(training.trainingDate)}</td><td>${training.trainer}</td><td>${training.hours} h</td><td>${money(cost)}</td><td>${count || '—'}</td><td>${count ? money(cost / count) : '—'}</td><td><button class="action-btn btn-delete" onclick="deletePrivateTraining(${training.id})" title="Smazat"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    }).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:1.5rem;">Zatím nejsou evidovány žádné tréninky.</td></tr>';
}

async function savePrivateTraining(event) {
    event.preventDefault();
    const attendances = document.getElementById('privateTrainingAttendance').value.split('\n').map(line => line.split('|').map(value => value.trim())).filter(parts => parts[0] && parts[1]).map(([playerName, payerName]) => ({ playerName, payerName }));
    const body = { trainingDate: document.getElementById('privateTrainingDate').value, trainer: document.getElementById('privateTrainingTrainer').value, hours: Number(document.getElementById('privateTrainingHours').value), hourlyRate: Number(document.getElementById('privateTrainingRate').value), note: document.getElementById('privateTrainingNote').value, attendances };
    try {
        const res = await fetch(privateTrainingApi(), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.authToken}` }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('save');
        event.target.reset();
        document.getElementById('privateTrainingHours').value = 1;
        document.getElementById('privateTrainingRate').value = 100;
        window.showAlert('Trénink uložen.', 'success');
        loadPrivateTrainings();
    } catch {
        window.showAlert('Trénink se nepodařilo uložit.', 'error');
    }
}

async function deletePrivateTraining(id) {
    if (!confirm('Opravdu smazat tento trénink?')) return;
    const res = await fetch(`${privateTrainingApi()}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${window.authToken}` } });
    if (!res.ok) return window.showAlert('Trénink se nepodařilo smazat.', 'error');
    window.showAlert('Trénink smazán.', 'success');
    loadPrivateTrainings();
}

async function importPrivateTrainingHistory() {
    if (!confirm('Nahrát 34 tréninků ze zpracovaných výkazů září 2025 až červen 2026? Import lze provést jen do prázdné evidence.')) return;
    const res = await fetch(`${privateTrainingApi()}/import-2025-2026`, { method: 'POST', headers: { Authorization: `Bearer ${window.authToken}` } });
    const data = await res.json();
    if (!res.ok) return window.showAlert(data.error || 'Import se nepodařil.', 'error');
    window.showAlert(`Načteno ${data.imported} tréninků.`, 'success');
    loadPrivateTrainings();
}

window.loadPrivateTrainings = loadPrivateTrainings;
window.savePrivateTraining = savePrivateTraining;
window.deletePrivateTraining = deletePrivateTraining;
window.importPrivateTrainingHistory = importPrivateTrainingHistory;
