/**
 * Admin Gallery Module
 * Contains: Gallery management, image upload, gallery picker
 */

// ================================
// GALLERY MANAGEMENT
// ================================

// Pagination State
let currentGalleryPage = 1;
let galleryItemsPerPage = 50;

async function loadAdminGallery(page = 1) {
    console.log('loadAdminGallery called, page:', page);
    currentGalleryPage = page;

    const grid = document.getElementById('galleryGrid');
    const paginationContainer = document.getElementById('galleryPagination');

    if (!grid) { console.error('Gallery grid not found'); return; }

    // Reset batch actions state
    const selectAll = document.getElementById('selectAllGallery');
    if (selectAll) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    }
    updateBatchActions();

    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Načítám...</p>';

    if (!authToken) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #fca5a5;">Chyba: Chybí přihlášení</p>';
        return;
    }

    const categoryFilter = document.getElementById('galleryCategoryFilter')?.value || '';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let url = `${API_URL}/images?page=${page}&limit=${galleryItemsPerPage}`;
        if (categoryFilter) {
            url += `&category=${encodeURIComponent(categoryFilter)}`;
        }

        console.log('Fetching images from', url);
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${authToken}` },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            throw new Error(`Failed to load images: ${res.status}`);
        }

        const responseData = await res.json();
        // Handle both paginated and non-paginated (legacy/fallback) responses
        const images = responseData.data || responseData;
        const pagination = responseData.pagination || null;

        if (!Array.isArray(images) || images.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Žádné obrázky</p>';
            paginationContainer.innerHTML = '';
            return;
        }

        grid.innerHTML = images.map(img => renderGalleryCard(img)).join('');

        // Render Pagination Controls
        if (pagination) {
            renderPagination(pagination, paginationContainer);
        } else {
            paginationContainer.innerHTML = '';
        }

    } catch (e) {
        console.error('Gallery load error:', e);
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #fca5a5;">Chyba načítání: ${e.message}</p>`;
    }

    // Load dynamic categories for batch select and filter
    loadCategoryDatalist();
}

function renderGalleryCard(img) {
    let thumbUrl = img.url;
    if (img.url.startsWith('/uploads/') && !img.url.includes('-thumb')) {
        const ext = img.url.split('.').pop();
        thumbUrl = img.url.replace(`.${ext}`, `-thumb.${ext}`);
    }

    const visibilityIcon = img.isPublic ? 'fa-eye' : 'fa-eye-slash';
    const visibilityColor = img.isPublic ? '#4ade80' : '#f87171'; // Green : Red
    const visibilityTitle = img.isPublic ? 'Veřejný' : 'Skrytý';

    return `
    <div class="gallery-card ${img.isPublic ? '' : 'is-hidden'}" id="card-${img.id}">
        <div class="gallery-card-img" 
             onclick="openAdminImagePreview('${img.url}', '${(img.originalName || '').replace(/'/g, "\\'")}', '${(img.altText || '').replace(/'/g, "\\'")}', ${img.isPublic})">
            <img src="${thumbUrl}" 
                 onerror="this.style.display='none';this.parentElement.classList.add('img-error')" 
                 loading="lazy">
            <div class="gallery-card-overlay">
                <i class="fa-solid fa-magnifying-glass-plus" style="font-size: 1.5rem; color: white;"></i>
            </div>
            ${!img.isPublic ? '<div class="gallery-status-badge">Skryto</div>' : ''}
        </div>
        
        <input type="checkbox" class="gallery-checkbox gallery-card-select" value="${img.id}" onchange="updateBatchActions()">
        
        <div class="gallery-card-content">
            <input type="text" value="${img.altText || ''}" placeholder="Popisek..." 
                   onchange="updateImageCaption(${img.id}, this.value)">
            
            <input type="text" list="categoryList" value="${img.category || ''}" placeholder="Kategorie" 
                   onchange="updateImageCategory(${img.id}, this.value)">

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.2rem 0.4rem; border-radius: 4px;">
                    <i class="fa-solid fa-sort" style="font-size: 0.7rem; color: var(--text-muted);"></i>
                    <input type="number" value="${img.sortOrder || 0}" 
                           style="width: 40px; padding: 0.1rem; border: none; background: transparent; color: var(--text-color); font-size: 0.8rem; text-align: center;"
                           onchange="updateSortOrder(${img.id}, this.value)">
                </div>

                <div style="display: flex; gap: 0.5rem;">
                    <button class="action-btn" onclick="toggleImageVisibility(${img.id}, ${!img.isPublic})" title="${visibilityTitle}">
                        <i class="fa-solid ${visibilityIcon}" style="color: ${visibilityColor};"></i>
                    </button>
                    <button class="action-btn btn-delete" onclick="deleteGalleryImage(${img.id})" title="Smazat">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>

            ${img.usedInNews ? `
                <div style="font-size: 0.75rem; margin-top: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <span style="color: #d4af37;">
                        <i class="fa-solid fa-newspaper"></i> <a href="article.html?id=${img.usedInNews.id}" target="_blank" style="color: inherit; text-decoration: underline;" title="${img.usedInNews.title}">Použito v článku</a>
                    </span>
                </div>
            ` : ''}
        </div>
    </div>
    `;
}

function renderPagination(pagination, container) {
    const { page, pages, total } = pagination;

    let html = `
        <span style="font-size: 0.9rem; color: var(--text-muted);">
            Celkem: <strong style="color: var(--text-color);">${total}</strong> | Strana ${page} z ${pages}
        </span>
    `;

    if (pages > 1) {
        html += `
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn-secondary btn-small" ${page <= 1 ? 'disabled' : ''} onclick="loadAdminGallery(${page - 1})">
                    <i class="fa-solid fa-chevron-left"></i> Předchozí
                </button>
                <button class="btn-secondary btn-small" ${page >= pages ? 'disabled' : ''} onclick="loadAdminGallery(${page + 1})">
                    Další <i class="fa-solid fa-chevron-right"></i>
                </button>
            </div>
        `;
    }

    container.innerHTML = html;
}


async function loadCategoryDatalist() {
    try {
        // Ensure datalist exists
        let dl = document.getElementById('categoryList');
        if (!dl) {
            dl = document.createElement('datalist');
            dl.id = 'categoryList';
            document.body.appendChild(dl);
        }

        const res = await fetch(`${API_URL}/images/categories`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (res.ok) {
            const categories = await res.json();
            // Default categories that should always be there
            const defaults = ['news', 'members', 'intro', 'blicak'];
            // Merge and dedup
            const allCats = [...new Set([...defaults, ...categories])].filter(c => c).sort();

            dl.innerHTML = allCats.map(c => `<option value="${c}">`).join('');

            // Also populate batch category select
            const batchSelect = document.getElementById('batchCategorySelect');
            if (batchSelect) {
                // Keep the first default option
                const firstOpt = batchSelect.querySelector('option[value=""]');
                batchSelect.innerHTML = '';
                if (firstOpt) batchSelect.appendChild(firstOpt);
                else batchSelect.innerHTML = '<option value="">Změnit kategorii...</option>';

                allCats.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c;
                    opt.textContent = c;
                    batchSelect.appendChild(opt);
                });
            }
        }
    } catch (e) {
        console.error('Failed to load categories:', e);
    }
}

async function applyBatchCategory() {
    const checkboxes = document.querySelectorAll('.gallery-checkbox:checked');
    if (checkboxes.length === 0) return;

    const category = document.getElementById('batchCategorySelect').value;
    if (!category) {
        showToast('Vyberte kategorii', 'error');
        return;
    }

    const btn = document.querySelector('button[onclick="applyBatchCategory()"]');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const ids = Array.from(checkboxes).map(cb => cb.value);
        let successCount = 0;

        // Process in parallel with concurrency limit effectively handled by browser per-domain limit (usually 6)
        // or just Promise.all since we likely don't have thousands selected
        const promises = ids.map(id =>
            updateImageCategory(id, category).then(res => 1).catch(() => 0)
        );

        // Note: updateImageCategory shows toast on individual success, which might spam. 
        // Ideally refactor updateImageCategory to return status and handle global toast here.
        // For now, let's just wait.

        await Promise.all(promises);

        showToast(`Kategorie aktualizována`); // Simple summary
        loadAdminGallery(currentGalleryPage); // Reload to reflect changes

    } catch (e) {
        console.error(e);
        showToast('Chyba při hromadné úpravě', 'error');
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

async function toggleImageVisibility(id, newState) {
    try {
        const res = await fetch(`${API_URL}/images/${id}/visibility`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ isPublic: newState })
        });

        if (res.ok) {
            // Update UI directly without full reload if possible, but loadAdminGallery is safer for sync
            // showToast(newState ? 'Obrázek je nyní veřejný' : 'Obrázek je nyní skrytý', 'success');
            loadAdminGallery(currentGalleryPage);
        } else {
            showToast('Chyba při změně viditelnosti', 'error');
        }
    } catch (e) { console.error(e); }
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
            loadAdminGallery(currentGalleryPage);
        } else {
            const data = await res.json();
            showToast(data.error || 'Nepodařilo se smazat obrázek', 'error');
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

async function updateSortOrder(id, sortOrder) {
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
            body: JSON.stringify({ category: category.trim() })
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

    const actionBar = document.getElementById('batchActionsBar');
    const countSpan = document.getElementById('selectedCount');
    const batchBtn = document.getElementById('batchDeleteBtn');

    if (actionBar && countSpan) {
        countSpan.textContent = count;

        if (count > 0) {
            actionBar.style.opacity = '1';
            actionBar.style.pointerEvents = 'auto';
            if (batchBtn) batchBtn.disabled = false;
        } else {
            actionBar.style.opacity = '0.5';
            actionBar.style.pointerEvents = 'none';
            if (batchBtn) batchBtn.disabled = true;
        }
    }

    // Update visuals for selected cards
    document.querySelectorAll('.gallery-card').forEach(card => {
        card.classList.remove('selected');
    });
    checkboxes.forEach(cb => {
        const card = document.getElementById(`card-${cb.value}`);
        if (card) card.classList.add('selected');
    });

    const selectAll = document.getElementById('selectAllGallery');
    const allCheckboxes = document.querySelectorAll('.gallery-checkbox');
    if (selectAll) {
        if (allCheckboxes.length > 0) {
            selectAll.checked = checkboxes.length === allCheckboxes.length;
            selectAll.indeterminate = count > 0 && count < allCheckboxes.length;
        } else {
            selectAll.checked = false;
            selectAll.indeterminate = false;
        }
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

let adminImagePreviewModal = null;

function openAdminImagePreview(url, originalName, altText, isPublic) {
    if (!adminImagePreviewModal) {
        // Create modal DOM if not exists
        adminImagePreviewModal = document.createElement('div');
        adminImagePreviewModal.className = 'modal-overlay';
        adminImagePreviewModal.style.zIndex = '100000';
        adminImagePreviewModal.style.display = 'none';

        adminImagePreviewModal.innerHTML = `
            <div class="modal-content" style="max-width: 90vw; max-height: 90vh; width: auto; height: auto; padding: 0; background: transparent; display: flex; flex-direction: column; align-items: center; position: relative;">
                <button onclick="closeAdminImagePreview()" style="position: absolute; top: -40px; right: 0; background: none; border: none; color: white; font-size: 2rem; cursor: pointer;">&times;</button>
                <img id="adminPreviewImage" src="" style="max-width: 100%; max-height: 80vh; border-radius: 4px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                <div id="adminPreviewCaption" style="background: rgba(0,0,0,0.8); color: white; padding: 1rem; margin-top: 1rem; border-radius: 8px; text-align: center; min-width: 300px;">
                    <h4 id="adminPreviewTitle" style="margin: 0 0 0.5rem 0; color: #d4af37;"></h4>
                    <p id="adminPreviewAlt" style="margin: 0; font-style: italic; color: #ccc;"></p>
                    <div id="adminPreviewWarning" style="margin-top: 0.5rem; color: #f87171; font-weight: bold; display: none;">
                        <i class="fa-solid fa-eye-slash"></i> Obrázek je skrytý ve veřejné galerii
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(adminImagePreviewModal);

        // Close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && adminImagePreviewModal.style.display === 'flex') {
                closeAdminImagePreview();
            }
        });

        // Close on click outside
        adminImagePreviewModal.addEventListener('click', (e) => {
            if (e.target === adminImagePreviewModal) closeAdminImagePreview();
        });
    }

    const img = adminImagePreviewModal.querySelector('#adminPreviewImage');
    const title = adminImagePreviewModal.querySelector('#adminPreviewTitle');
    const alt = adminImagePreviewModal.querySelector('#adminPreviewAlt');
    const warning = adminImagePreviewModal.querySelector('#adminPreviewWarning');

    img.src = url;
    title.textContent = originalName || 'Bez názvu';
    alt.textContent = altText || '';

    if (isPublic === false) {
        warning.style.display = 'block';
        img.style.border = '2px solid #f87171';
    } else {
        warning.style.display = 'none';
        img.style.border = 'none';
    }

    adminImagePreviewModal.style.display = 'flex';
}

function closeAdminImagePreview() {
    if (adminImagePreviewModal) {
        adminImagePreviewModal.style.display = 'none';
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

        grid.innerHTML = images.map(img => {
            let thumbUrl = img.url;
            if (img.url.startsWith('/uploads/') && !img.url.includes('-thumb')) {
                const ext = img.url.split('.').pop();
                thumbUrl = img.url.replace(`.${ext}`, `-thumb.${ext}`);
            }
            return `
            <div class="gallery-picker-item" onclick="selectFromGallery('${img.url}', '${(img.altText || '').replace(/'/g, "\\'")}')">
                <img src="${thumbUrl}" alt="${img.originalName || 'Gallery image'}" onerror="this.src='${img.url}'">
            </div>
            `;
        }).join('');
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
window.toggleImageVisibility = toggleImageVisibility;
window.updateSortOrder = updateSortOrder;
window.updateImageCategory = updateImageCategory;
window.deleteSelectedImages = deleteSelectedImages;
window.openAdminImagePreview = openAdminImagePreview;
window.closeAdminImagePreview = closeAdminImagePreview;
