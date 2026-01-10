// Member Gallery Logic

async function loadMemberGallery() {
    const container = document.getElementById('galleryGrid');
    container.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1;"><i class="fa-solid fa-spinner fa-spin"></i> Načítám...</p>';

    try {
        const token = getAuthToken();
        // Assuming API accepts Token now
        const res = await fetch(`${API_URL}/images`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to load logic');

        const images = await res.json();

        if (images.length === 0) {
            container.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1; text-align: center;">Zatím žádné fotky.</p>';
            return;
        }

        container.innerHTML = images.slice(0, 30).map(img => `
            <a href="${img.url}" target="_blank" class="gallery-item" style="position: relative;">
                <img src="${img.url}" alt="${img.altText || 'Gallery image'}">
                ${img.altText ? `<div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); color: white; font-size: 0.7rem; padding: 0.3rem; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(img.altText)}</div>` : ''}
            </a>
        `).join('');
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color: #fca5a5; grid-column: 1 / -1;">Chyba načítání. (Možná vyžadováno heslo klubu - TODO)</p>';
    }
}

async function handleMemberGalleryUpload(input) {
    if (!input.files || input.files.length === 0) return;

    const token = getAuthToken();
    const files = Array.from(input.files);
    let successCount = 0;

    const container = document.getElementById('galleryGrid');
    container.innerHTML = `<p style="color: #a855f7; grid-column: 1 / -1; text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Nahrávám ${files.length} fotek...</p>`;

    for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('category', 'members');

        try {
            const res = await fetch(`${API_URL}/images/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.ok) successCount++;
        } catch (e) { console.error('Upload failed:', e); }
    }

    if (successCount > 0) loadMemberGallery();
    else container.innerHTML = '<p style="color: #fca5a5; grid-column: 1 / -1;">Nahrávání selhalo.</p>';

    input.value = '';
}
