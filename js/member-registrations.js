// Členská správa online registrací ŠSČR
(() => {
    const API = window.API_URL || '/api';
    const headers = () => ({ 'Authorization': `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' });

    let lastCreatedUrl = '';

    window.createRegistration = async () => {
        const btn = document.getElementById('createBtn');
        btn.disabled = true;
        try {
            const res = await fetch(`${API}/registrations`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ note: document.getElementById('newNote').value.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            lastCreatedUrl = data.url;
            document.getElementById('newLinkUrl').textContent = data.url;
            document.getElementById('newLinkBox').style.display = 'block';
            document.getElementById('newNote').value = '';
            loadRegistrations();
        } catch (e) {
            alert('Nepodařilo se vytvořit odkaz: ' + e.message);
        } finally {
            btn.disabled = false;
        }
    };

    window.copyNewLink = async () => {
        try {
            await navigator.clipboard.writeText(lastCreatedUrl);
            const b = document.getElementById('copyBtn');
            b.innerHTML = '<i class="fa-solid fa-check"></i> Zkopírováno';
            setTimeout(() => { b.innerHTML = '<i class="fa-regular fa-copy"></i> Kopírovat'; }, 2000);
        } catch (e) {
            prompt('Zkopíruj odkaz ručně:', lastCreatedUrl);
        }
    };

    window.copyRegLink = async (url, btn) => {
        try {
            await navigator.clipboard.writeText(url);
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
        } catch (e) {
            prompt('Zkopíruj odkaz ručně:', url);
        }
    };

    window.deleteRegistration = async (id) => {
        if (!confirm('Smazat tuto žádost? Odkaz přestane fungovat.')) return;
        try {
            const res = await fetch(`${API}/registrations/${id}`, { method: 'DELETE', headers: headers() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            loadRegistrations();
        } catch (e) {
            alert('Smazání se nepodařilo: ' + e.message);
        }
    };

    window.downloadRegPdf = async (id) => {
        try {
            const res = await fetch(`${API}/registrations/${id}/pdf`, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `zadost-sscr-${id}.pdf`;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (e) {
            alert('PDF se nepodařilo stáhnout: ' + e.message);
        }
    };

    const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };

    window.loadRegistrations = async () => {
        const list = document.getElementById('regsList');
        try {
            const res = await fetch(`${API}/registrations`, { headers: headers() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const regs = await res.json();
            if (!regs.length) {
                list.innerHTML = '<p style="color:var(--text-muted); padding:1rem 0.5rem;">Zatím žádné žádosti — vytvoř první odkaz výš.</p>';
                return;
            }
            list.innerHTML = regs.map(r => {
                const created = new Date(r.createdAt).toLocaleDateString('cs-CZ');
                const who = r.applicant ? `<strong>${esc(r.applicant)}</strong>` : (r.note ? esc(r.note) : '<span style="color:var(--text-muted);">bez poznámky</span>');
                const sub = r.submittedAt ? ` · odesláno ${new Date(r.submittedAt).toLocaleDateString('cs-CZ')}` : '';
                const actions = r.status === 'submitted'
                    ? `<button class="btn-secondary" onclick="downloadRegPdf(${r.id})" title="Stáhnout PDF žádosti"><i class="fa-solid fa-file-pdf"></i> PDF</button>`
                    : `<button class="btn-secondary" onclick="copyRegLink('${esc(r.url)}', this)" title="Kopírovat odkaz"><i class="fa-regular fa-copy"></i></button>`;
                return `
                <div class="reg-row">
                    <span class="reg-status ${r.status}">${r.status === 'submitted' ? '✓ vyplněno' : '⏳ čeká'}</span>
                    <div style="min-width:160px;">${who}
                        <div style="font-size:0.75rem; color:var(--text-muted);">vytvořeno ${created}${sub}${r.note && r.applicant ? ' · ' + esc(r.note) : ''}</div>
                    </div>
                    <div class="reg-actions">
                        ${actions}
                        <button class="btn-secondary" onclick="deleteRegistration(${r.id})" title="Smazat" style="color:#f87171;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
            }).join('');
        } catch (e) {
            list.innerHTML = `<p style="color:#f87171; padding:1rem 0.5rem;">Načtení selhalo: ${esc(e.message)}</p>`;
        }
    };

    // ============ PŘESTUPY ============
    let lastTransferUrl = '';

    window.createTransfer = async () => {
        const btn = document.getElementById('createTransferBtn');
        btn.disabled = true;
        try {
            const res = await fetch(`${API}/transfers`, {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ note: document.getElementById('newTransferNote').value.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            lastTransferUrl = data.url;
            document.getElementById('newTransferUrl').textContent = data.url;
            document.getElementById('newTransferBox').style.display = 'block';
            document.getElementById('newTransferNote').value = '';
            loadTransfers();
        } catch (e) {
            alert('Nepodařilo se vytvořit odkaz: ' + e.message);
        } finally {
            btn.disabled = false;
        }
    };

    window.copyNewTransfer = async () => {
        try {
            await navigator.clipboard.writeText(lastTransferUrl);
            const b = document.getElementById('copyTransferBtn');
            b.innerHTML = '<i class="fa-solid fa-check"></i> Zkopírováno';
            setTimeout(() => { b.innerHTML = '<i class="fa-regular fa-copy"></i> Kopírovat'; }, 2000);
        } catch (e) {
            prompt('Zkopíruj odkaz ručně:', lastTransferUrl);
        }
    };

    window.deleteTransfer = async (id) => {
        if (!confirm('Smazat tento přestup? Odkaz přestane fungovat.')) return;
        try {
            const res = await fetch(`${API}/transfers/${id}`, { method: 'DELETE', headers: headers() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            loadTransfers();
        } catch (e) {
            alert('Smazání se nepodařilo: ' + e.message);
        }
    };

    const downloadBlob = async (url, filename) => {
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${getAuthToken()}` } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    window.downloadTransferPdf = (id) => downloadBlob(`${API}/transfers/${id}/pdf`, `prestup-${id}.pdf`).catch(e => alert('PDF se nepodařilo stáhnout: ' + e.message));
    window.downloadTransferScan = (id) => downloadBlob(`${API}/transfers/${id}/scan`, `prestup-${id}-potvrzeny`).catch(e => alert('Sken se nepodařilo stáhnout: ' + e.message));

    const TR_STATUS = {
        pending: ['⏳ čeká na hráče', 'pending'],
        filled: ['🖨️ čeká na razítko oddílu', 'pending'],
        completed: ['✓ hotovo', 'submitted'],
    };

    window.loadTransfers = async () => {
        const list = document.getElementById('transfersList');
        if (!list) return;
        try {
            const res = await fetch(`${API}/transfers`, { headers: headers() });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const items = await res.json();
            if (!items.length) {
                list.innerHTML = '<p style="color:var(--text-muted); padding:0.5rem;">Zatím žádné přestupy.</p>';
                return;
            }
            list.innerHTML = items.map(t => {
                const [lbl, cls] = TR_STATUS[t.status] || [t.status, 'pending'];
                const who = t.applicant ? `<strong>${esc(t.applicant)}</strong>${t.fromClub ? ' <span style="color:var(--text-muted);">(z ' + esc(t.fromClub) + ')</span>' : ''}` : (t.note ? esc(t.note) : '<span style="color:var(--text-muted);">bez poznámky</span>');
                const created = new Date(t.createdAt).toLocaleDateString('cs-CZ');
                let actions = '';
                if (t.status === 'pending') {
                    actions = `<button class="btn-secondary" onclick="copyRegLink('${esc(t.url)}', this)" title="Kopírovat odkaz"><i class="fa-regular fa-copy"></i></button>`;
                } else {
                    actions = `<button class="btn-secondary" onclick="downloadTransferPdf(${t.id})" title="PDF ohlášení"><i class="fa-solid fa-file-pdf"></i> PDF</button>`;
                    if (t.status === 'filled') actions += ` <button class="btn-secondary" onclick="copyRegLink('${esc(t.url)}', this)" title="Kopírovat odkaz (pro nahrání skenu)"><i class="fa-regular fa-copy"></i></button>`;
                    if (t.status === 'completed') actions += ` <button class="btn-secondary" onclick="downloadTransferScan(${t.id})" title="Potvrzený sken"><i class="fa-solid fa-file-image"></i> Sken</button>`;
                }
                return `
                <div class="reg-row">
                    <span class="reg-status ${cls}">${lbl}</span>
                    <div style="min-width:160px;">${who}
                        <div style="font-size:0.75rem; color:var(--text-muted);">vytvořeno ${created}${t.note && t.applicant ? ' · ' + esc(t.note) : ''}</div>
                    </div>
                    <div class="reg-actions">
                        ${actions}
                        <button class="btn-secondary" onclick="deleteTransfer(${t.id})" title="Smazat" style="color:#f87171;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
            }).join('');
        } catch (e) {
            list.innerHTML = `<p style="color:#f87171; padding:0.5rem;">Načtení přestupů selhalo: ${esc(e.message)}</p>`;
        }
    };
})();
