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
                body: JSON.stringify({
                    note: document.getElementById('newNote').value.trim(),
                    firstName: document.getElementById('newFirstName').value.trim(),
                    lastName: document.getElementById('newLastName').value.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            lastCreatedUrl = data.url;
            window.lastRegUrl = data.url;
            window.lastRegId = data.id;
            document.getElementById('newLinkUrl').textContent = data.url;
            document.getElementById('newLinkBox').style.display = 'block';
            document.getElementById('newNote').value = '';
            document.getElementById('newFirstName').value = '';
            document.getElementById('newLastName').value = '';
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
                const actions = (r.status === 'submitted'
                    ? `<button class="btn-secondary" onclick="downloadRegPdf(${r.id})" title="Stáhnout PDF žádosti"><i class="fa-solid fa-file-pdf"></i> PDF</button>`
                    : `<button class="btn-secondary" onclick="copyRegLink('${esc(r.url)}', this)" title="Kopírovat odkaz"><i class="fa-regular fa-copy"></i></button>`)
                    + `<button class="btn-secondary" onclick="editRegistration(${r.id}, '${r.status}')" title="Upravit (jen autor odkazu / superadmin)"><i class="fa-solid fa-pen"></i></button>`;
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

    // ---- úprava žádosti (superadmin / autor odkazu) ----
    const REG_FIELDS = [
        ['lastName', 'Příjmení'], ['firstName', 'Jméno'], ['middleName', 'Další jméno'], ['title', 'Titul'],
        ['birthNumber', 'Rodné číslo'], ['birthDate', 'Datum narození'], ['street', 'Ulice'], ['houseNumber', 'Č. popisné/orient.'],
        ['city', 'Město'], ['cityPart', 'Část obce'], ['zip', 'PSČ'], ['birthCountry', 'Stát narození'],
        ['citizenship', 'Občanství'], ['phone', 'Telefon'], ['email', 'E-mail'],
    ];

    window.editRegistration = async (id, status) => {
        let detail;
        try {
            const res = await fetch(`${API}/registrations/${id}`, { headers: headers() });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            detail = data;
        } catch (e) {
            return alert(e.message);
        }

        document.getElementById('regEditModal')?.remove();
        const d = detail.data || {};
        const pending = detail.status === 'pending';
        const inputStyle = 'width:100%; box-sizing:border-box; padding:0.55rem 0.7rem; background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.12); border-radius:8px; color:#fff; font-family:inherit; font-size:0.88rem;';

        const fieldsHtml = pending
            ? `<div style="display:grid; grid-template-columns:1fr 1fr; gap:0.7rem;">
                 <div><label style="font-size:0.75rem; color:var(--text-muted);">Jméno</label><input id="re_firstName" value="${esc(d.prefill?.firstName || '')}" style="${inputStyle}"></div>
                 <div><label style="font-size:0.75rem; color:var(--text-muted);">Příjmení</label><input id="re_lastName" value="${esc(d.prefill?.lastName || '')}" style="${inputStyle}"></div>
               </div>`
            : `<div style="display:grid; grid-template-columns:1fr 1fr; gap:0.7rem; max-height:55vh; overflow-y:auto; padding-right:0.3rem;">
                 ${REG_FIELDS.map(([k, label]) => `<div><label style="font-size:0.75rem; color:var(--text-muted);">${label}</label><input id="re_${k}" value="${esc(d[k] || '')}" style="${inputStyle}"></div>`).join('')}
               </div>
               <label style="display:flex; align-items:center; gap:0.5rem; margin-top:0.7rem; font-size:0.85rem; cursor:pointer;">
                 <input type="checkbox" id="re_registerThisYear" ${d.registerThisYear ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--primary-color);"> Registrovat pro aktuální rok
               </label>`;

        const modal = document.createElement('div');
        modal.id = 'regEditModal';
        modal.innerHTML = `
            <div onclick="document.getElementById('regEditModal').remove()" style="position:fixed; inset:0; background:rgba(8,8,12,0.7); backdrop-filter:blur(3px); z-index:9998;"></div>
            <div style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:9999; width:92%; max-width:560px; max-height:92vh; overflow-y:auto; background:#15151f; border:1px solid rgba(212,175,55,0.25); border-radius:14px; padding:1.4rem;">
                <h3 style="margin:0 0 1rem; color:var(--primary-color);"><i class="fa-solid fa-pen"></i> Upravit žádost ${pending ? '(předvyplnění)' : '— PDF se přegeneruje'}</h3>
                ${fieldsHtml}
                <div style="margin-top:0.8rem;"><label style="font-size:0.75rem; color:var(--text-muted);">Poznámka</label><input id="re_note" value="${esc(detail.note || '')}" style="${inputStyle}"></div>
                <div style="display:flex; gap:0.6rem; justify-content:flex-end; margin-top:1.2rem;">
                    <button class="btn-secondary" onclick="document.getElementById('regEditModal').remove()">Zrušit</button>
                    <button class="btn-primary" id="reSaveBtn">Uložit</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        document.getElementById('reSaveBtn').onclick = async () => {
            const btn = document.getElementById('reSaveBtn');
            btn.disabled = true;
            const body = { note: document.getElementById('re_note').value };
            if (pending) {
                body.firstName = document.getElementById('re_firstName').value;
                body.lastName = document.getElementById('re_lastName').value;
            } else {
                REG_FIELDS.forEach(([k]) => { body[k] = document.getElementById('re_' + k).value; });
                body.registerThisYear = document.getElementById('re_registerThisYear').checked;
            }
            try {
                const res = await fetch(`${API}/registrations/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                modal.remove();
                loadRegistrations();
            } catch (e) {
                alert('Uložení se nepodařilo: ' + e.message);
                btn.disabled = false;
            }
        };
    };

    // ---- sdílení a e-mail ----
    window.shareLink = async (url) => {
        if (!url) return;
        if (navigator.share) {
            try { await navigator.share({ title: 'Šachy Bižuterie Jablonec', url }); } catch (e) { /* zrušeno */ }
        } else {
            prompt('Zkopíruj odkaz (sdílení podporuje mobil):', url);
        }
    };

    const sendLinkMail = async (endpoint, id, inputId, btnId) => {
        const email = document.getElementById(inputId).value.trim();
        const btn = document.getElementById(btnId);
        if (!id) return alert('Nejdřív vytvoř odkaz.');
        if (!email) return alert('Vyplň e-mail.');
        btn.disabled = true;
        try {
            const res = await fetch(`${API}/${endpoint}/${id}/send`, {
                method: 'POST', headers: headers(), body: JSON.stringify({ email }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Odesláno';
            setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-envelope"></i> Poslat mailem'; btn.disabled = false; }, 2500);
        } catch (e) {
            alert('E-mail se nepodařilo odeslat: ' + e.message);
            btn.disabled = false;
        }
    };
    window.sendRegEmail = () => sendLinkMail('registrations', window.lastRegId, 'sendRegEmail', 'sendRegBtn');
    window.sendTransferEmail = () => sendLinkMail('transfers', window.lastTransferId, 'sendTransferEmail', 'sendTransferBtn');

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
            window.lastTransferUrlPub = data.url;
            window.lastTransferId = data.id;
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
