// Bulletin Board Logic for member-bulletin.html

// --- Tabs ---
function switchBulletinTab(tabName) {
    // Hide all
    document.querySelectorAll('.bulletin-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    // Show
    const content = document.getElementById(`tab-${tabName}`);
    if (content) content.classList.remove('hidden');

    // Active btn
    const btn = document.querySelector(`.tab-btn[onclick*="'${tabName}'"]`);
    if (btn) btn.classList.add('active');

    // Load data
    if (tabName === 'announcements') loadAnnouncements();
    if (tabName === 'documents') loadDocuments();
    if (tabName === 'trip') loadMyTrips();
    if (tabName === 'messages') loadMemberMessages();
}

// --- Announcements ---
async function loadAnnouncements() {
    const container = document.getElementById('announcementsList');
    container.innerHTML = '<p class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Načítám...</p>';
    try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/announcements`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.length === 0) {
            container.innerHTML = '<p class="text-muted text-center" style="color: var(--text-muted);">Žádná oznámení.</p>';
            return;
        }

        container.innerHTML = data.map(ann => `
            <div class="announcement-card ${ann.isPinned ? 'pinned' : ''}">
                <div class="announcement-header">
                    <div class="announcement-title">
                        ${ann.isPinned ? '<i class="fa-solid fa-thumbtack" style="color: #f59e0b;"></i>' : ''}
                        ${escapeHtml(ann.title)}
                    </div>
                    ${currentUserRole === 'ADMIN' || currentUserRole === 'SUPERADMIN' ? `
                        <button class="delete-btn-mini" onclick="deleteAnnouncement(${ann.id})" title="Smazat" style="background:none; border:none; color: #ef4444; cursor: pointer;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
                <div class="announcement-meta">
                    ${new Date(ann.createdAt).toLocaleDateString('cs-CZ')} • ${escapeHtml(ann.author.realName || ann.author.username)}
                </div>
                <div class="announcement-content">
                    ${escapeHtml(ann.content).replace(/\n/g, '<br>')}
                </div>
            </div>
        `).join('');

        if (currentUserRole === 'ADMIN' || currentUserRole === 'SUPERADMIN') {
            document.getElementById('adminAnnouncementActions')?.classList.remove('hidden');
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color: #ef4444;">Chyba při načítání oznámení.</p>';
    }
}

async function deleteAnnouncement(id) {
    if (!confirm('Opravdu smazat toto oznámení?')) return;
    const token = getAuthToken();
    await fetch(`${API_URL}/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    loadAnnouncements();
}

function showAnnouncementModal() {
    document.getElementById('announcementModal').classList.remove('hidden');
}
function closeAnnouncementModal() {
    document.getElementById('announcementModal').classList.add('hidden');
}

async function postAnnouncement() {
    const title = document.getElementById('annTitle').value;
    const content = document.getElementById('annContent').value;
    const isPinned = document.getElementById('annPinned').checked;

    if (!title || !content) return alert('Vyplňte titulek a text.');

    const btn = document.getElementById('annSubmitBtn');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/announcements`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, content, isPinned })
        });

        if (res.ok) {
            closeAnnouncementModal();
            document.getElementById('annTitle').value = '';
            document.getElementById('annContent').value = '';
            loadAnnouncements();
        } else {
            alert('Chyba při ukládání.');
        }
    } catch (e) { console.error(e); alert('Chyba.'); }

    btn.innerHTML = 'Publikovat';
    btn.disabled = false;
}

// --- Documents ---
async function loadDocuments() {
    const container = document.getElementById('documentsList');
    container.innerHTML = '<p class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Načítám...</p>';
    try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/documents`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.length === 0) {
            container.innerHTML = '<p class="text-muted text-center" style="color: var(--text-muted);">Žádné dokumenty.</p>';
            return;
        }

        container.innerHTML = data.map(doc => {
            let icon = 'fa-file';
            let iconClass = 'file';
            if (doc.filename.endsWith('.pdf')) { icon = 'fa-file-pdf'; iconClass = 'pdf'; }
            else if (doc.filename.match(/\.(doc|docx)$/)) { icon = 'fa-file-word'; iconClass = 'word'; }
            else if (doc.filename.match(/\.(xls|xlsx)$/)) { icon = 'fa-file-excel'; iconClass = 'excel'; }
            else if (doc.filename.match(/\.(jpg|png|webp)$/)) { icon = 'fa-file-image'; iconClass = 'image'; }

            return `
            <div class="document-row">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div class="document-icon ${iconClass}">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(doc.title)}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">
                            ${new Date(doc.createdAt).toLocaleDateString('cs-CZ')} • ${doc.category || 'Ostatní'}
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <a href="${doc.url}" target="_blank" class="btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.9rem; text-decoration: none;" download>
                        <i class="fa-solid fa-download"></i> Stáhnout
                    </a>
                    ${currentUserRole === 'ADMIN' || currentUserRole === 'SUPERADMIN' ? `
                        <button class="btn-secondary" style="background: rgba(220, 38, 38, 0.2); color: #fca5a5; border-color: rgba(220, 38, 38, 0.4); padding: 0.4rem 0.6rem;" onclick="deleteDocument(${doc.id})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `}).join('');

        if (currentUserRole === 'ADMIN' || currentUserRole === 'SUPERADMIN') {
            document.getElementById('adminDocumentActions')?.classList.remove('hidden');
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color: #ef4444;">Chyba při načítání dokumentů.</p>';
    }
}

function showDocumentUploadModal() {
    document.getElementById('documentModal').classList.remove('hidden');
}
function closeDocumentUploadModal() {
    document.getElementById('documentModal').classList.add('hidden');
}

async function deleteDocument(id) {
    if (!confirm('Opravdu smazat tento dokument?')) return;
    const token = getAuthToken();
    await fetch(`${API_URL}/documents/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    loadDocuments();
}

async function uploadDocument() {
    const fileInput = document.getElementById('docFile');
    const file = fileInput.files[0];
    const title = document.getElementById('docTitle').value;
    const category = document.getElementById('docCategory').value;

    if (!file) return alert('Vyberte soubor.');

    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    formData.append('category', category);

    const btn = document.getElementById('docSubmitBtn');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/documents`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (res.ok) {
            closeDocumentUploadModal();
            fileInput.value = '';
            document.getElementById('docTitle').value = '';
            loadDocuments();
        } else {
            alert('Chyba při nahrávání.');
        }
    } catch (e) { console.error(e); alert('Chyba.'); }

    btn.innerHTML = 'Nahrát';
    btn.disabled = false;
}

// --- Travel Reports ---
async function loadMyTrips() {
    const container = document.getElementById('tripList');
    container.innerHTML = '<p class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Načítám...</p>';
    try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/travel-reports/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.length === 0) {
            container.innerHTML = '<p class="text-muted text-center" style="color: var(--text-muted);">Žádné záznamy.</p>';
            return;
        }

        container.innerHTML = data.map(trip => `
            <div class="message-card">
                 <div class="message-header">
                    <span class="message-author">${new Date(trip.date).toLocaleDateString('cs-CZ')} • ${escapeHtml(trip.from)} → ${escapeHtml(trip.to)}</span>
                    <span class="message-time">${trip.status === 'pending' ? 'Čeká na schválení' : trip.status}</span>
                 </div>
                 <div class="message-content">
                    ${escapeHtml(trip.purpose)} (${trip.distance} km, ${trip.vehicle})
                 </div>
            </div>
        `).join('');
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color: #ef4444;">Chyba při načítání.</p>';
    }
}

async function submitTripReport() {
    const date = document.getElementById('tripDate').value;
    const purpose = document.getElementById('tripPurpose').value;
    const from = document.getElementById('tripFrom').value;
    const to = document.getElementById('tripTo').value;
    const distance = document.getElementById('tripDistance').value;
    const vehicle = document.getElementById('tripVehicle').value;

    if (!date || !purpose || !from || !to || !distance) return alert('Vyplňte všechna pole.');

    try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/travel-reports`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ date, purpose, from, to, distance: parseInt(distance), vehicle })
        });

        if (res.ok) {
            alert('Cestovní příkaz odeslán ke schválení.');
            document.getElementById('tripPurpose').value = '';
            loadMyTrips();
        } else {
            alert('Chyba při odesílání.');
        }
    } catch (e) { console.error(e); alert('Chyba.'); }
}

// --- Messages ---
async function loadMemberMessages() {
    const container = document.getElementById('messageList');
    try {
        const token = getAuthToken();
        const res = await fetch(`${API_URL}/messages`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const messages = await res.json();
        if (messages.length === 0) {
            container.innerHTML = '<p class="text-muted text-center" style="color: var(--text-muted);">Žádné vzkazy.</p>';
            return;
        }
        container.innerHTML = messages.map(msg => `
            <div class="message-card">
                <div class="message-header">
                     <span class="message-author"><i class="fa-solid fa-user"></i> ${escapeHtml(msg.author)}</span>
                     <span class="message-time">${new Date(msg.createdAt).toLocaleString('cs-CZ')}</span>
                </div>
                <div class="message-content">${escapeHtml(msg.content)}</div>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

async function submitMemberMessage() {
    const author = document.getElementById('msgAuthor').value;
    const content = document.getElementById('msgContent').value;
    if (!author || !content) return alert('Vyplňte jméno a zprávu.');
    const token = getAuthToken();
    await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, content })
    });
    document.getElementById('msgContent').value = '';
    loadMemberMessages();
}
