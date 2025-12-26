/**
 * Admin Thumbnail Module
 * Contains: Sidebar thumbnail upload, crop position, rotation
 * Extracted from admin-news.js for better modularity
 * 
 * Dependencies: uploadedImageData, imageCropPosition, pendingThumbnailBlob (shared state from admin-news.js)
 */

// ================================
// THUMBNAIL MANAGEMENT
// ================================

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    pendingThumbnailBlob = null; // Reset pending rotation

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
            uploadedImageData = data.url.startsWith('http') ? data.url : `${baseUrl}${data.url}`;
            displayImage(uploadedImageData);
        } else {
            alert('Nahrávání selhalo');
        }
    } catch (e) {
        console.error(e);
        alert('Chyba při nahrávání');
    }
}

function handleImageUrl() {
    const url = document.getElementById('imageUrl').value;
    if (!url) return;

    pendingThumbnailBlob = null; // Reset pending rotation
    uploadedImageData = url;
    displayImage(url);
}

function displayImage(src) {
    document.getElementById('uploadArea').classList.add('has-image');
    document.getElementById('uploadPlaceholder').style.display = 'none';
    document.getElementById('imageUrlWrapper').style.display = 'none';
    document.getElementById('removeImageBtn').style.display = 'block';
    document.getElementById('cropPositionWrapper').style.display = 'block';

    const img = document.getElementById('uploadedImage');
    img.src = src;
    img.style.display = 'block';
    img.style.objectPosition = `center ${imageCropPosition}`;

    const previewImg = document.getElementById('previewImage');
    previewImg.innerHTML = `<img src="${src}" style="object-position: center ${imageCropPosition};">`;
}

function removeImage() {
    uploadedImageData = null;
    imageCropPosition = '50%';
    document.getElementById('cropSlider').value = 50;
    document.getElementById('cropValueLabel').textContent = '50%';

    document.getElementById('uploadArea').classList.remove('has-image');
    document.getElementById('uploadPlaceholder').style.display = 'block';
    document.getElementById('uploadedImage').style.display = 'none';
    document.getElementById('uploadedImage').src = '';
    document.getElementById('imageUrlWrapper').style.display = 'flex';
    document.getElementById('imageUrl').value = '';
    document.getElementById('removeImageBtn').style.display = 'none';
    document.getElementById('cropPositionWrapper').style.display = 'none';
    document.getElementById('previewImage').innerHTML = '<i class="fa-solid fa-image" style="font-size: 1.5rem; color: var(--text-muted);"></i>';
    document.getElementById('imageInput').value = '';
}

function updateCropFromSlider(val) {
    imageCropPosition = val + '%';
    document.getElementById('cropValueLabel').textContent = imageCropPosition;

    const img = document.getElementById('uploadedImage');
    if (img) img.style.objectPosition = `center ${imageCropPosition}`;

    const previewImg = document.getElementById('previewImage');
    const imgTag = previewImg.querySelector('img');
    if (imgTag) imgTag.style.objectPosition = `center ${imageCropPosition}`;
}

// Thumbnail Rotation - now works locally
async function rotateImage() {
    // Get source - either uploadedImageData or pending blob
    let imageSrc = uploadedImageData;
    if (pendingThumbnailBlob) {
        imageSrc = URL.createObjectURL(pendingThumbnailBlob);
    }

    if (!imageSrc) return;

    const btn = document.querySelector('button[onclick="rotateImage()"]');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

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
        pendingThumbnailBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));

        // Show preview using data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        displayImage(dataUrl); // This updates the preview

        // Note: we KEEP uploadedImageData as the base, because displayImage updates the preview 
        // but doesn't change uploadedImageData. Wait, actually displayImage MIGHT rely on 
        // us not changing uploadedImageData to something invalid. 
        // But for consistency until save, let's just rely on pendingThumbnailBlob.

    } catch (e) {
        console.error('Thumbnail rotation error:', e);
        alert('Nepodařilo se otočit obrázek');
    } finally {
        if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Otočit o 90°';
    }
}

// ================================
// EXPORTS
// ================================
window.handleImageUpload = handleImageUpload;
window.handleImageUrl = handleImageUrl;
window.displayImage = displayImage;
window.removeImage = removeImage;
window.updateCropFromSlider = updateCropFromSlider;
window.rotateImage = rotateImage;

