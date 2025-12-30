/**
 * Admin Content Images Module
 * Contains: Image insertion into article content, modal, rotation, alignment
 * Extracted from admin-news.js for better modularity
 * 
 * Dependencies: updatePreview() from admin-news.js, API_URL and authToken from config
 */

// ================================
// IMAGE MANAGEMENT (Content Images)
// ================================

// Use different variable name to avoid conflict with admin-news.js
let contentSelectedImage = null;
let contentSavedRange = null;
let contentPendingImageBlob = null; // Stores rotated image blob until final save

function insertImage() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        contentSavedRange = sel.getRangeAt(0).cloneRange();
    }
    showImageModal();
}

function showImageModal(existingImg = null) {
    contentSelectedImage = existingImg;

    let modal = document.getElementById('imageModal');

    // Remove old modal if it exists (to clear any cached versions)
    if (modal) {
        modal.remove();
        modal = null;
    }

    if (!modal) {
        // Modal structure needs to be added to DOM if missing, or we assume it exists in admin.html
        // For now, assuming it might be cleaned from admin.html, so generating it here check would be good.
        // But the previous implementation assumed it checks getElementById.
        // Let's stick to using the element from admin.html (if we leave it there)
        // OR construct it here.
        // Construction seems safer for modularity.
        modal = document.createElement('div');
        modal.id = 'imageModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeImageModal()" style="position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: rgba(0,0,0,0.8) !important; z-index: 9998 !important;"></div>
            <div class="modal-content" style="position: fixed !important; top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important; z-index: 9999 !important; background: #1a1a2e !important; border-radius: 12px !important; padding: 1.5rem !important; max-width: 500px !important; width: 90% !important; box-shadow: 0 20px 60px rgba(0,0,0,0.5) !important;">
                <h3 style="margin-bottom: 1rem; color: #d4af37;">${existingImg ? 'Upravit obrázek' : 'Vložit obrázek'}</h3>
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                    <input type="text" id="imgUrlInput" placeholder="URL obrázku" style="flex: 1;">
                    <button type="button" class="btn-secondary" onclick="document.getElementById('imgFileInput').click()">
                        <i class="fa-solid fa-upload"></i> Nahrát
                    </button>
                    <button type="button" class="btn-secondary" onclick="selectGalleryForImageModal()">
                        <i class="fa-regular fa-images"></i> Galerie
                    </button>
                    <input type="file" id="imgFileInput" accept="image/*" style="display: none;" onchange="handleImageFile(event)">
                </div>
                <div id="imgPreviewArea" style="text-align: center; margin-bottom: 1rem; min-height: 100px; border: 1px dashed rgba(255,255,255,0.2); border-radius: 8px; padding: 1rem;">
                    <p style="color: var(--text-muted);">Náhled obrázku</p>
                </div>
                <div style="margin-bottom: 1rem;">
                     <button type="button" onclick="rotateContentImage()" id="rotateContentBtn" style="width: 100%; padding: 0.4rem; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--editor-border); color: var(--text-color); border-radius: 4px; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                        <i class="fa-solid fa-rotate-right"></i> Otočit o 90°
                    </button>
                </div>
                <div style="margin-bottom: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <label style="display:block;margin-bottom:0.5rem; font-size: 0.8rem; color: var(--text-muted);">Zarovnání</label>
                        <select id="imgAlignInput" style="width: 100%; font-size: 0.9rem;">
                            <option value="center">Na střed</option>
                            <option value="left">Vlevo (obtékaný)</option>
                            <option value="right">Vpravo (obtékaný)</option>
                            <option value="full">Roztažený (Full)</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block;margin-bottom:0.5rem; font-size: 0.8rem; color: var(--text-muted);">Velikost</label>
                        <select id="imgSizeInput" style="width: 100%; font-size: 0.9rem;">
                            <option value="100%">100% (Výchozí)</option>
                            <option value="75%">75% (Velká)</option>
                            <option value="50%">50% (Střední)</option>
                            <option value="33%">33% (Malá)</option>
                            <option value="25%">25% (Mini)</option>
                        </select>
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <button type="button" class="btn-custom btn-delete" onclick="deleteImage()" ${existingImg ? '' : 'style="display:none;"'}>Odstranit</button>
                    <div style="display: flex; gap: 0.5rem;">
                        <button type="button" class="btn-secondary" onclick="closeImageModal()">Zrušit</button>
                        <button type="button" class="btn-primary" onclick="saveImageInsertion()">Vložit</button>
                    </div>
                </div>
            </div>
        `;
        // Prepend to body to avoid any CSS inheritance issues
        document.body.insertBefore(modal, document.body.firstChild);
    }

    // Show the modal
    modal.style.display = 'block';

    // Reset/fill input values
    const imgUrlInput = document.getElementById('imgUrlInput');
    const imgPreviewArea = document.getElementById('imgPreviewArea');
    const imgSizeInput = document.getElementById('imgSizeInput');
    contentPendingImageBlob = null; // Reset any pending rotated image

    if (existingImg) {
        const src = existingImg.getAttribute('src');
        imgUrlInput.value = src;
        imgPreviewArea.innerHTML = `<img src="${src}" style="max-width:100%; max-height: 300px;">`;

        if (existingImg.style.float === 'left') imgAlignInput.value = 'left';
        else if (existingImg.style.float === 'right') imgAlignInput.value = 'right';
        else if (existingImg.style.width === '100%' && existingImg.style.display === 'block') imgAlignInput.value = 'full';
        else imgAlignInput.value = 'center';

        // Detect size
        // If width is set, try to match option, otherwise default 100%
        if (existingImg.style.width) {
            // Check if matches one of our options
            const w = existingImg.style.width;
            if (['100%', '75%', '50%', '33%', '25%'].includes(w)) {
                imgSizeInput.value = w;
            } else {
                imgSizeInput.value = '100%'; // Custom or unset
            }
        } else {
            imgSizeInput.value = '100%';
        }

    } else {
        imgUrlInput.value = '';
        imgPreviewArea.innerHTML = '<p style="color: var(--text-muted);">Náhled obrázku</p>';
        imgAlignInput.value = 'center';
        imgSizeInput.value = '100%';
    }

    imgUrlInput.onchange = () => {
        if (imgUrlInput.value) imgPreviewArea.innerHTML = `<img src="${imgUrlInput.value}" style="max-width:100%; max-height: 300px;">`;
    };
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) modal.style.display = 'none';
    contentSelectedImage = null;
}

async function handleImageFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Use shared upload logic? or duplicate?
    // Let's duplicate simple upload for now to avoid cross-dependency complexity or use Admin Gallery helper if available
    // But we are in admin-news.js. Let's write a simple uploader.
    const formData = new FormData();
    formData.append('image', file);

    try {
        const res = await fetch(`${API_URL}/images/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });
        if (res.ok) {
            const data = await res.json();
            const baseUrl = window.location.origin;
            const url = data.url.startsWith('http') ? data.url : `${baseUrl}${data.url}`;
            document.getElementById('imgUrlInput').value = url;
            document.getElementById('imgPreviewArea').innerHTML = `<img src="${url}" style="max-width:100%; max-height: 300px;">`;
        }
    } catch (e) {
        console.error(e);
        alert('Nahrávání selhalo');
    }
}

async function saveImageInsertion() {
    let url = document.getElementById('imgUrlInput').value;
    const align = document.getElementById('imgAlignInput').value;
    const size = document.getElementById('imgSizeInput').value || '100%';

    // If we have a pending rotated image, upload it now
    if (contentPendingImageBlob) {
        const formData = new FormData();
        const fileName = `rotated_${Date.now()}.jpg`;
        formData.append('image', contentPendingImageBlob, fileName);

        try {
            const res = await fetch(`${API_URL}/images/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authToken}` },
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                const baseUrl = window.location.origin;
                url = data.url.startsWith('http') ? data.url : `${baseUrl}${data.url}`;
            } else {
                alert('Nepodařilo se nahrát rotovaný obrázek');
                return;
            }
        } catch (e) {
            console.error('Upload error:', e);
            alert('Chyba při nahrávání obrázku');
            return;
        }
        contentPendingImageBlob = null; // Clear after upload
    }

    if (!url) {
        closeImageModal();
        return;
    }

    // Base style
    let style = `width: ${size}; max-width: 100%; height: auto; border-radius: 8px;`;

    // Logic for alignment + size
    if (align === 'center') {
        style += ' display: block; margin: 1rem auto;';
    } else if (align === 'full') {
        // Full width overrides size selection usually, or acts as 100%
        style = 'width: 100%; height: auto; border-radius: 8px; display: block; margin: 1rem 0;';
    } else if (align === 'left') {
        style += ' float: left; margin: 0 1rem 1rem 0;';
    } else if (align === 'right') {
        style += ' float: right; margin: 0 0 1rem 1rem;';
    }

    if (contentSelectedImage) {
        contentSelectedImage.src = url;
        contentSelectedImage.style.cssText = style;
    } else {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Obrázek';
        img.style.cssText = style;

        const content = document.getElementById('articleContent');
        if (contentSavedRange && content.contains(contentSavedRange.commonAncestorContainer)) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(contentSavedRange);
            contentSavedRange.insertNode(img);
            contentSavedRange.collapse(false);
        } else {
            content.appendChild(img);
        }
    }
    updatePreview();
    closeImageModal();
}

function deleteImage() {
    if (contentSelectedImage) {
        contentSelectedImage.remove();
        updatePreview();
    }
    closeImageModal();
}

// Rotation - now works locally without uploading each time
async function rotateContentImage() {
    const urlInput = document.getElementById('imgUrlInput');
    const previewArea = document.getElementById('imgPreviewArea');

    // Get source - either URL or pending blob
    let imageSrc = urlInput.value;
    if (contentPendingImageBlob) {
        imageSrc = URL.createObjectURL(contentPendingImageBlob);
    }
    if (!imageSrc) return;

    const btn = document.getElementById('rotateContentBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Otáčím...';
    btn.disabled = true;

    try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageSrc;

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        // Rotate on canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.height;
        canvas.height = img.width;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(90 * Math.PI / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        // Store as blob for later upload
        contentPendingImageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));

        // Show preview using data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        previewArea.innerHTML = `<img src="${dataUrl}" style="max-width:100%; max-height: 300px;">`;

        // Clear URL input since we're using pending blob now
        urlInput.value = '';
        urlInput.placeholder = 'Rotovaný obrázek (bude nahrán při vložení)';

    } catch (e) {
        console.error('Rotation error:', e);
        alert('Nepodařilo se otočit obrázek');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Rotation Helper (Extracted)
async function uploadRotatedImage(imageUrl) {
    try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.height;
        canvas.height = img.width;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(90 * Math.PI / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));

        const formData = new FormData();
        // Generate name - primitive since we don't have original name here easily, use timestamp
        const rotationName = `rotated_${Date.now()}.jpg`;
        formData.append('image', blob, rotationName);

        const res = await fetch(`${API_URL}/images/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            const baseUrl = window.location.origin;
            const newUrl = data.url.startsWith('http') ? data.url : `${baseUrl}${data.url}`;
            return newUrl + (newUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
        }
    } catch (e) {
        console.error('Rotation helper error:', e);
        throw e;
    }
}

// ================================
// EXPORTS
// ================================
window.insertImage = insertImage;
window.showImageModal = showImageModal;
window.closeImageModal = closeImageModal;
window.handleImageFile = handleImageFile;
window.saveImageInsertion = saveImageInsertion;
window.deleteImage = deleteImage;
window.rotateContentImage = rotateContentImage;
window.uploadRotatedImage = uploadRotatedImage;

