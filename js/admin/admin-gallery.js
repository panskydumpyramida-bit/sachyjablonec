/**
 * Admin Gallery Module
 * Contains: Gallery management, image upload, gallery picker
 */

// ================================
// GALLERY MANAGEMENT
// ================================

async function loadAdminGallery() {
    console.log('loadAdminGallery called');
    const tbody = document.getElementById('galleryTableBody');
    if (!tbody) { console.error('Gallery tbody not found'); return; }

    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Načítám...</td></tr>';

    if (!authToken) {
        console.error('No auth token available');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Chyba: Chybí přihlášení</td></tr>';
        return;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        console.log('Fetching images from', `${API_URL}/images`);
        const res = await fetch(`${API_URL}/images`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        console.log('Fetch response:', res.status, res.statusText);

        if (!res.ok) {
            const txt = await res.text();
            console.error('Fetch failed:', txt);
            throw new Error(`Failed to load images: ${res.status}`);
        }

        const images = await res.json();
        console.log('Images loaded:', images.length);

        if (!Array.isArray(images)) {
            console.error('Response is not an array:', images);
            throw new Error('Invalid response format');
        }

        if (images.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Žádné obrázky</td></tr>';
            return;
        }

        tbody.innerHTML = images.map(img => `
            <tr>
                <td style="width: 80px;">
                    <img src="${img.url}" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="window.open('${img.url}', '_blank')">
                </td>
                <td>
                    <div style="font-weight: 500;">${img.originalName || 'Bez názvu'}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${img.altText || ''}</div>
                </td>
                <td style="font-size: 0.85rem; color: var(--text-muted);">
                    ${new Date(img.uploadedAt).toLocaleString('cs-CZ')}
                </td>
                <td>
                    <button class="action-btn btn-danger" onclick="deleteGalleryImage(${img.id})" title="Smazat">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        console.error('Gallery load error:', e);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #fca5a5;">Chyba načítání: ${e.message}</td></tr>`;
    }
}

async function deleteGalleryImage(id) {
    if (!confirm('Opravdu chcete smazat tento obrázek? Tato akce je nevratná.')) return;

    try {
        const res = await fetch(`${API_URL}/images/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (res.ok) {
            showToast('Obrázek smazán');
            loadAdminGallery();
        } else {
            showToast('Nepodařilo se smazat obrázek', 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Chyba při mazání', 'error');
    }
}

async function handleAdminGalleryUpload(input) {
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    let successCount = 0;

    for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch(`${API_URL}/images/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
                body: formData
            });

            if (res.ok) successCount++;
        } catch (e) {
            console.error('Upload failed for file:', file.name, e);
        }
    }

    if (successCount > 0) {
        showToast(`Nahráno ${successCount} obrázků`);
        loadAdminGallery();
    } else {
        showToast('Nahrávání selhalo', 'error');
    }

    input.value = '';
}

// ================================
// GALLERY PICKER MODAL
// ================================

let galleryPickerCallback = null;

async function showGalleryPicker(callback) {
    galleryPickerCallback = callback;

    let modal = document.getElementById('galleryPickerModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'galleryPickerModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeGalleryPicker()"></div>
            <div class="modal-content" style="max-width: 700px; max-height: 80vh;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0;"><i class="fa-regular fa-images"></i> Vybrat z galerie</h3>
                    <button type="button" onclick="closeGalleryPicker()" style="background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer;">&times;</button>
                </div>
                <div id="galleryPickerGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem; max-height: 60vh; overflow-y: auto; padding: 0.5rem;">
                    <p style="color: var(--text-muted); grid-column: 1 / -1; text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Načítám...</p>
                </div>
            </div>
        `;
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 3000; display: flex; align-items: center; justify-content: center;';
        document.body.appendChild(modal);

        if (!document.getElementById('galleryPickerStyles')) {
            const style = document.createElement('style');
            style.id = 'galleryPickerStyles';
            style.textContent = `
                #galleryPickerModal .modal-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); }
                #galleryPickerModal .modal-content { position: relative; background: var(--surface-color); padding: 1.5rem; border-radius: var(--border-radius); width: 90%; }
                #galleryPickerModal .gallery-picker-item { aspect-ratio: 1; overflow: hidden; border-radius: 8px; border: 2px solid transparent; cursor: pointer; transition: all 0.2s; }
                #galleryPickerModal .gallery-picker-item:hover { border-color: var(--primary-color); transform: scale(1.05); }
                #galleryPickerModal .gallery-picker-item img { width: 100%; height: 100%; object-fit: cover; }
            `;
            document.head.appendChild(style);
        }
    } else {
        modal.style.display = 'flex';
    }

    const grid = document.getElementById('galleryPickerGrid');
    try {
        const res = await fetch(`${API_URL}/images`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!res.ok) throw new Error('Failed to fetch');

        const images = await res.json();

        if (images.length === 0) {
            grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1; text-align: center;">Galerie je prázdná.</p>';
            return;
        }

        grid.innerHTML = images.map(img => `
            <div class="gallery-picker-item" onclick="selectFromGallery('${img.url}')">
                <img src="${img.url}" alt="${img.originalName || 'Gallery image'}">
            </div>
        `).join('');
    } catch (e) {
        console.error('Gallery picker error:', e);
        grid.innerHTML = '<p style="color: #fca5a5; grid-column: 1 / -1; text-align: center;">Nepodařilo se načíst galerii.</p>';
    }
}

function selectFromGallery(url) {
    if (galleryPickerCallback) {
        galleryPickerCallback(url);
    }
    closeGalleryPicker();
}

function closeGalleryPicker() {
    const modal = document.getElementById('galleryPickerModal');
    if (modal) modal.style.display = 'none';
    galleryPickerCallback = null;
}

// Helpers for gallery selection in different contexts
function selectGalleryForImageModal() {
    showGalleryPicker((url) => {
        document.getElementById('imgUrlInput').value = url;
        document.getElementById('imgPreviewArea').innerHTML = `<img src="${url}">`;
    });
}

function selectGalleryForThumbnail() {
    showGalleryPicker((url) => {
        uploadedImageData = url;
        displayImage(url);
    });
}

function selectGalleryForArticleGallery() {
    showGalleryPicker((url) => {
        galleryImages.push(url);
        renderGallery();
    });
}

// Export for global access
window.loadAdminGallery = loadAdminGallery;
window.deleteGalleryImage = deleteGalleryImage;
window.handleAdminGalleryUpload = handleAdminGalleryUpload;
window.showGalleryPicker = showGalleryPicker;
window.selectFromGallery = selectFromGallery;
window.closeGalleryPicker = closeGalleryPicker;
window.selectGalleryForImageModal = selectGalleryForImageModal;
window.selectGalleryForThumbnail = selectGalleryForThumbnail;
window.selectGalleryForArticleGallery = selectGalleryForArticleGallery;
