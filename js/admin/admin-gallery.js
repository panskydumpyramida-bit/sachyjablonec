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

    // Reset batch actions state
    const selectAll = document.getElementById('selectAllGallery');
    if (selectAll) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    }
    const batchBtn = document.getElementById('batchDeleteBtn');
    if (batchBtn) {
        // batchBtn.style.display = 'none'; // Keep visible but disabled
        batchBtn.disabled = true;
        batchBtn.style.opacity = '0.5';
        batchBtn.style.cursor = 'not-allowed';
        // Reset button content if it was stuck in loading state
        batchBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Smazat vybrané (<span id="selectedCount">0</span>)';
    }

    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Načítám...</td></tr>';

    if (!authToken) {
        console.error('No auth token available');
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: red;">Chyba: Chybí přihlášení</td></tr>';
        return;
    }

    const categoryFilter = document.getElementById('galleryCategoryFilter')?.value || '';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let url = `${API_URL}/images`;
        if (categoryFilter) {
            url += `?category=${encodeURIComponent(categoryFilter)}`;
        }

        console.log('Fetching images from', url);
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            const txt = await res.text();
            console.error('Fetch failed:', txt);
            throw new Error(`Failed to load images: ${res.status}`);
        }

        const images = await res.json();

        if (!Array.isArray(images)) throw new Error('Invalid response format');

        if (images.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Žádné obrázky</td></tr>';
            return;
        }

        tbody.innerHTML = images.map(img => `
            <tr>
                <td style="text-align: center; width: 40px;">
                    <input type="checkbox" class="gallery-checkbox" value="${img.id}" onchange="updateBatchActions()">
                </td>
                <td style="width: 80px;">
                    <img src="${img.url}" style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px; cursor: pointer;" onclick="openAdminImagePreview('${img.url}', '${(img.originalName || '').replace(/'/g, "\\'")}', '${(img.altText || '').replace(/'/g, "\\'")}')">
                </td>
                <td>
                    <input type="number" 
                           value="${img.sortOrder || 0}" 
                           onchange="updateImageOrder(${img.id}, this.value)"
                           style="width: 60px; padding: 0.3rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: var(--text-color); text-align: center;">
                </td>
                <td>
                    <div style="font-weight: 500; font-size: 0.85rem; margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;" title="${img.originalName}">${img.originalName || 'Bez názvu'}</div>
                    <input type="text" 
                           class="caption-input" 
                           value="${img.altText || ''}" 
                           placeholder="Přidat popisek..." 
                           onblur="updateImageCaption(${img.id}, this.value)"
                           style="width: 100%; padding: 0.3rem 0.5rem; font-size: 0.8rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: var(--text-color);">
                </td>
                <td>
                    <input type="text" list="categoryList"
                           value="${img.category || ''}" 
                           placeholder="Kategorie"
                           onchange="updateImageCategory(${img.id}, this.value)"
                           style="width: 100%; padding: 0.3rem 0.5rem; font-size: 0.8rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: var(--text-color);">
                </td>
                <td style="text-align: center;">
                    <input type="checkbox" ${!img.isPublic ? 'checked' : ''} onchange="toggleGalleryVisibility(${img.id}, !this.checked)">
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

        // Ensure datalist exists
        if (!document.getElementById('categoryList')) {
            const dl = document.createElement('datalist');
            dl.id = 'categoryList';
            dl.innerHTML = `
                <option value="members">
                <option value="news">
                <option value="intro">
                <option value="blicak">
            `;
            document.body.appendChild(dl);
        }

    } catch (e) {
        console.error('Gallery load error:', e);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #fca5a5;">Chyba načítání: ${e.message}</td></tr>`;
    }
}

async function toggleGalleryVisibility(id, isPublic) {
    try {
        const res = await fetch(`${API_URL}/images/${id}/toggle`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ isPublic })
        });

        if (res.ok) {
            showToast(isPublic ? 'Obrázek je veřejný' : 'Obrázek je skrytý');
        } else {
            showToast('Nepodařilo se změnit viditelnost', 'error');
            loadAdminGallery(); // Reload to reset checkbox state
        }
    } catch (e) {
        console.error(e);
        showToast('Chyba komunikace', 'error');
        loadAdminGallery();
    }
}

async function deleteGalleryImage(id) {
    // Use custom modal instead of native confirm() to avoid Chrome focus issues
    const confirmed = await showConfirm('Opravdu chcete smazat tento obrázek?', 'Tato akce je nevratná.');
    if (!confirmed) return;

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

// Custom confirm modal to replace native confirm() which has Chrome issues
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.id = 'confirmModal';
        modal.innerHTML = `
            <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100000; display: flex; align-items: center; justify-content: center;">
                <div style="background: var(--surface-color, #1e1e1e); padding: 1.5rem; border-radius: 12px; max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.5); border: 1px solid rgba(212,175,55,0.2);">
                    <h3 style="color: var(--primary-color, #d4af37); margin: 0 0 0.5rem 0; font-size: 1.2rem;">${title}</h3>
                    <p style="color: var(--text-muted, #a0a0a0); margin: 0 0 1.5rem 0;">${message}</p>
                    <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                        <button id="confirmNo" style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 6px; cursor: pointer;">Zrušit</button>
                        <button id="confirmYes" style="padding: 0.5rem 1rem; background: #dc2626; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: 600;">Smazat</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#confirmNo').onclick = () => {
            modal.remove();
            resolve(false);
        };
        modal.querySelector('#confirmYes').onclick = () => {
            modal.remove();
            resolve(true);
        };

        // Focus the cancel button by default
        modal.querySelector('#confirmNo').focus();
    });
}

// Update image caption (altText)
async function updateImageCaption(id, altText) {
    try {
        const res = await fetch(`${API_URL}/images/${id}/caption`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ altText })
        });

        if (res.ok) {
            showToast('✓ Popisek uložen', 'success');
        } else {
            showToast('Nepodařilo se uložit popisek', 'error');
        }
    } catch (e) {
        console.error('Update caption error:', e);
        showToast('Chyba při ukládání', 'error');
    }
}

async function updateImageOrder(id, sortOrder) {
    try {
        const res = await fetch(`${API_URL}/images/${id}/order`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ sortOrder: parseInt(sortOrder, 10) })
        });

        if (res.ok) {
            showToast('✓ Pořadí uloženo', 'success');
            // Optional: reload to re-sort, but might be annoying while editing multiple. 
            // Better to let user reload manually or just update UI locally if needed.
        } else {
            showToast('Nepodařilo se uložit pořadí', 'error');
        }
    } catch (e) {
        console.error('Update order error:', e);
        showToast('Chyba při ukládání', 'error');
    }
}

async function updateImageCategory(id, category) {
    try {
        // We reuse caption endpoint as it supports category now, or we should create specific one?
        // Let's use caption endpoint as I updated it to handle category too.
        const res = await fetch(`${API_URL}/images/${id}/caption`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ category })
        });

        if (res.ok) {
            showToast('✓ Kategorie uložena', 'success');
        } else {
            showToast('Nepodařilo se uložit kategorii', 'error');
        }
    } catch (e) {
        console.error('Update category error:', e);
        showToast('Chyba při ukládání', 'error');
    }
}

// Batch Actions Functions
function updateBatchActions() {
    const checkboxes = document.querySelectorAll('.gallery-checkbox:checked');
    const count = checkboxes.length;
    const btn = document.getElementById('batchDeleteBtn');
    const countSpan = document.getElementById('selectedCount');

    if (btn && countSpan) {
        if (count > 0) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            countSpan.textContent = count;
        } else {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
            countSpan.textContent = '0';
        }
    }

    const selectAll = document.getElementById('selectAllGallery');
    const allCheckboxes = document.querySelectorAll('.gallery-checkbox');
    if (selectAll) {
        selectAll.checked = allCheckboxes.length > 0 && checkboxes.length === allCheckboxes.length;
        selectAll.indeterminate = count > 0 && count < allCheckboxes.length;
    }
}

function toggleSelectAllGallery(source) {
    const checkboxes = document.querySelectorAll('.gallery-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateBatchActions();
}

async function deleteSelectedImages() {
    const checkboxes = document.querySelectorAll('.gallery-checkbox:checked');
    if (checkboxes.length === 0) return;

    if (!confirm(`Opravdu smazat ${checkboxes.length} vybraných obrázků? Tato akce je nevratná.`)) return;

    const btn = document.getElementById('batchDeleteBtn');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mazání...';
        btn.disabled = true;
    }

    let successCount = 0;
    const ids = Array.from(checkboxes).map(cb => cb.value);

    // Delete in parallel
    const promises = ids.map(id =>
        fetch(`${API_URL}/images/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        }).then(res => res.ok ? 1 : 0).catch(() => 0)
    );

    const results = await Promise.all(promises);
    successCount = results.reduce((a, b) => a + b, 0);

    if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-trash"></i> Smazat vybrané (<span id="selectedCount">${ids.length}</span>)`;
        btn.disabled = false;
    }

    if (successCount > 0) {
        showToast(`Smazáno ${successCount} obrázků`);
        loadAdminGallery();
    } else {
        showToast('Chyba při mazání', 'error');
        updateBatchActions();
    }
}

async function handleAdminGalleryUpload(input, category = null) {
    if (!input.files || input.files.length === 0) return;

    // Use selected filter category as default if not specified
    if (!category) {
        const filterVal = document.getElementById('galleryCategoryFilter')?.value;
        if (filterVal) category = filterVal;
    }

    const files = Array.from(input.files);
    let successCount = 0;

    for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);
        if (category) {
            formData.append('category', category);
        }

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
// ADMIN IMAGE PREVIEW MODAL
// ================================

function openAdminImagePreview(url, filename, caption) {
    let modal = document.getElementById('adminImagePreviewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'adminImagePreviewModal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="closeAdminImagePreview()"></div>
            <div class="preview-content">
                <button type="button" class="close-btn" onclick="closeAdminImagePreview()">&times;</button>
                <img src="" alt="Preview">
                <div class="preview-caption">
                    <h4 id="previewFilename"></h4>
                    <p id="previewAltText"></p>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Inject Styles
        const style = document.createElement('style');
        style.textContent = `
            #adminImagePreviewModal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 5000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.3s ease;
            }
            #adminImagePreviewModal.active {
                opacity: 1;
                visibility: visible;
            }
            #adminImagePreviewModal .modal-overlay {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.9);
                backdrop-filter: blur(5px);
            }
            #adminImagePreviewModal .preview-content {
                position: relative;
                max-width: 90vw;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                z-index: 10;
            }
            #adminImagePreviewModal img {
                max-width: 100%;
                max-height: 80vh;
                object-fit: contain;
                border-radius: 4px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            }
            #adminImagePreviewModal .preview-caption {
                margin-top: 1rem;
                color: #fff;
                text-align: center;
                background: rgba(0,0,0,0.5);
                padding: 1rem;
                border-radius: 8px;
            }
            #adminImagePreviewModal h4 {
                margin: 0;
                font-size: 0.9rem;
                color: var(--primary-color, #d4af37);
                margin-bottom: 0.25rem;
            }
            #adminImagePreviewModal p {
                margin: 0;
                font-size: 0.85rem;
                color: #ccc;
            }
            #adminImagePreviewModal .close-btn {
                position: absolute;
                top: -40px;
                right: -40px;
                background: none;
                border: none;
                color: #fff;
                font-size: 2rem;
                cursor: pointer;
                transition: transform 0.2s;
            }
            #adminImagePreviewModal .close-btn:hover {
                transform: scale(1.2);
                color: var(--primary-color, #d4af37);
            }
            @media (max-width: 768px) {
                #adminImagePreviewModal .close-btn {
                    top: 10px;
                    right: 10px;
                    background: rgba(0,0,0,0.5);
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    line-height: 1;
                }
            }
        `;
        document.head.appendChild(style);

        // Escape key listener
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeAdminImagePreview();
            }
        });
    }

    const img = modal.querySelector('img');
    const h4 = document.getElementById('previewFilename');
    const p = document.getElementById('previewAltText');

    img.src = url;
    h4.textContent = filename || 'Obrázek';
    p.textContent = caption ? caption : '(bez popisku)';

    // Reset display before fading in
    modal.style.display = 'flex';
    // Small delay to allow transition
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });
}

function closeAdminImagePreview() {
    const modal = document.getElementById('adminImagePreviewModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => {
            if (!modal.classList.contains('active')) {
                // Keep modal in DOM but hide completely if needed, or just let CSS handle visibility
            }
        }, 300);
    }
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
            <div class="gallery-picker-item" onclick="selectFromGallery('${img.url}', '${(img.altText || '').replace(/'/g, "\\'")}')">
                <img src="${img.url}" alt="${img.originalName || 'Gallery image'}">
            </div>
        `).join('');
    } catch (e) {
        console.error('Gallery picker error:', e);
        grid.innerHTML = '<p style="color: #fca5a5; grid-column: 1 / -1; text-align: center;">Nepodařilo se načíst galerii.</p>';
    }
}

function selectFromGallery(url, caption = '') {
    if (galleryPickerCallback) {
        galleryPickerCallback(url, caption);
    }
    closeGalleryPicker();
}

function closeGalleryPicker() {
    const modal = document.getElementById('galleryPickerModal');
    if (modal) modal.style.display = 'none';
    galleryPickerCallback = null;
}

// Export for global access
window.loadAdminGallery = loadAdminGallery;
window.deleteGalleryImage = deleteGalleryImage;
window.updateImageCaption = updateImageCaption;
window.handleAdminGalleryUpload = handleAdminGalleryUpload;
window.showGalleryPicker = showGalleryPicker;
window.selectFromGallery = selectFromGallery;
window.closeGalleryPicker = closeGalleryPicker;
window.updateBatchActions = updateBatchActions;
window.toggleSelectAllGallery = toggleSelectAllGallery;
window.toggleGalleryVisibility = toggleGalleryVisibility;
window.updateImageOrder = updateImageOrder;
window.updateImageCategory = updateImageCategory;
window.deleteSelectedImages = deleteSelectedImages;
window.openAdminImagePreview = openAdminImagePreview;
window.closeAdminImagePreview = closeAdminImagePreview;
