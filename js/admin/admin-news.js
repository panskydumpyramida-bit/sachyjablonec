/**
 * Admin News Module (Refactored)
 * Contains: News Editor state, Core functions, Games/Gallery management
 * 
 * WYSIWYG functions moved to: js/admin/admin-wysiwyg.js
 * Image functions moved to: js/admin/admin-content-images.js
 * Thumbnail functions moved to: js/admin/admin-thumbnail.js
 */

console.log('[admin-news] Module loading...');

// ================================
// STATE VARIABLES
// ================================

// Editor State (shared with thumbnail module)
let uploadedImageData = null;
let imageCropPosition = '50%';
let games = []; // List of games attached to the article
let galleryImages = []; // List of images attached to the article
let teamSelection = []; // Legacy/Unused but kept for structure

// Thumbnail state - used by admin-thumbnail.js
let pendingThumbnailBlob = null;

// Make state variables globally accessible for other modules
window.uploadedImageData = null;
window.imageCropPosition = '50%';
window.pendingThumbnailBlob = null;

// Sync functions
window.getNewsState = () => ({ uploadedImageData, imageCropPosition, games, galleryImages, pendingThumbnailBlob });
window.setNewsState = (key, value) => {
    if (key === 'uploadedImageData') uploadedImageData = value;
    if (key === 'imageCropPosition') imageCropPosition = value;
    if (key === 'pendingThumbnailBlob') pendingThumbnailBlob = value;
    window[key] = value;
};

// ================================
// COMPONENT INITIALIZATION
// ================================

// Auto-save and Toolbar Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('[admin-news] DOMContentLoaded');
    const content = document.getElementById('articleContent');
    if (!content) {
        console.log('[admin-news] articleContent not found');
        return;
    }

    // Toolbar listeners use checkToolbarState from admin-wysiwyg.js
    if (typeof checkToolbarState === 'function') {
        content.addEventListener('mouseup', checkToolbarState);
        content.addEventListener('keyup', checkToolbarState);
        content.addEventListener('click', checkToolbarState);
    }

    // Auto-save setup
    let saveTimeout;
    const autoSave = () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const titleEl = document.getElementById('newsTitle');
            const contentEl = document.getElementById('articleContent');
            const excerptEl = document.getElementById('newsExcerpt');
            const editIdEl = document.getElementById('editNewsId');

            const draft = {
                title: titleEl?.value || '',
                content: contentEl?.innerHTML || '',
                excerpt: excerptEl?.value || '',
                editId: editIdEl?.value || '',
                savedAt: new Date().toISOString()
            };

            // Only save if there's actual content
            if (draft.title || (draft.content && draft.content !== '<br>' && draft.content.trim() !== '')) {
                localStorage.setItem('newsDraft', JSON.stringify(draft));
                console.log('📝 Draft auto-saved at', new Date().toLocaleTimeString());
            }
        }, 2000); // Save 2s after last change
    };

    content.addEventListener('input', autoSave);
    document.getElementById('newsTitle')?.addEventListener('input', autoSave);
    document.getElementById('newsExcerpt')?.addEventListener('input', autoSave);

    // Check for saved draft on load
    checkDraft();
});

// Check for draft when switching to editor
function checkDraft() {
    setTimeout(() => {
        const savedDraft = localStorage.getItem('newsDraft');
        if (savedDraft) {
            try {
                const draft = JSON.parse(savedDraft);
                const savedTime = new Date(draft.savedAt).toLocaleString('cs-CZ');
                console.log('📋 Found draft from', savedTime);

                // Only restore new articles (not edits)
                if ((draft.title || (draft.content && draft.content !== '<br>')) && !draft.editId) {
                    if (confirm(`Máte rozepsanou novinku z ${savedTime}. Chcete ji obnovit?`)) {
                        document.getElementById('newsTitle').value = draft.title || '';
                        document.getElementById('articleContent').innerHTML = draft.content || '';
                        document.getElementById('newsExcerpt').value = draft.excerpt || '';
                        updatePreview();
                        switchTab('editor'); // Switch to editor tab
                        console.log('✅ Draft restored');
                    } else {
                        localStorage.removeItem('newsDraft');
                        console.log('🗑️ Draft discarded');
                    }
                }
            } catch (e) {
                console.error('Draft restore error:', e);
            }
        }
    }, 500);
}

// ================================
// CORE EDITOR FUNCTIONS
// ================================

function resetEditor() {
    console.log('[admin-news] resetEditor()');
    document.getElementById('editorTitle').textContent = 'Nová novinka';
    document.getElementById('editNewsId').value = '';
    document.getElementById('newsTitle').value = '';
    document.getElementById('articleContent').innerHTML = '';
    document.getElementById('newsExcerpt').value = '';

    // Set date to today (local time)
    const today = new Date();
    const localIso = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    document.getElementById('newsDate').value = localIso;

    document.getElementById('publishCheck').checked = false;
    document.getElementById('imageUrl').value = '';

    uploadedImageData = null;
    window.uploadedImageData = null;
    games = [];
    galleryImages = [];

    document.getElementById('uploadArea').classList.remove('has-image');
    document.getElementById('uploadPlaceholder').style.display = 'block';
    document.getElementById('uploadedImage').style.display = 'none';

    renderGames();
    document.getElementById('galleryPreview').innerHTML = '';
    updatePreview();

    // Clear auto-saved draft
    localStorage.removeItem('newsDraft');
}

async function editNews(id) {
    console.log('[admin-news] editNews()', id);
    try {
        const res = await fetch(`${API_URL}/news/${id}`);
        const item = await res.json();

        switchTab('editor');
        resetEditor(); // Clear previous state

        document.getElementById('editorTitle').textContent = 'Upravit novinku';
        document.getElementById('editNewsId').value = item.id;
        document.getElementById('newsTitle').value = item.title;
        document.getElementById('newsCategory').value = item.category;
        document.getElementById('newsDate').value = item.publishedDate.split('T')[0];
        document.getElementById('articleContent').innerHTML = item.content || '';
        document.getElementById('newsExcerpt').value = item.excerpt;
        document.getElementById('publishCheck').checked = item.isPublished;

        if (item.thumbnailUrl) {
            // Extract crop if present
            let url = item.thumbnailUrl;
            let crop = '50%';
            if (url.includes('#crop=')) {
                const parts = url.split('#crop=');
                url = parts[0];
                crop = parts[1];
            }

            uploadedImageData = url;
            imageCropPosition = crop;
            window.uploadedImageData = url;
            window.imageCropPosition = crop;

            // Set slider
            const numericCrop = parseInt(crop) || 50;
            document.getElementById('cropSlider').value = numericCrop;
            document.getElementById('cropValueLabel').textContent = numericCrop + '%';

            displayImage(url);
            document.getElementById('imageUrl').value = url;
        } else {
            // Reset defaults
            imageCropPosition = '50%';
            document.getElementById('cropSlider').value = 50;
            document.getElementById('cropValueLabel').textContent = '50%';
        }

        // Load games from database
        if (item.gamesJson) {
            try {
                games = JSON.parse(item.gamesJson);
            } catch (e) { console.error(e); }
        }

        // Load gallery from database (with backward compatibility for string-only format)
        if (item.galleryJson) {
            const parsed = JSON.parse(item.galleryJson);
            // Convert legacy string format to object format
            galleryImages = parsed.map(item => typeof item === 'string' ? { url: item, caption: '' } : item);
        } else {
            galleryImages = [];
        }

        renderGames();
        renderGallery();
        updatePreview();
    } catch (e) {
        console.error(e);
        // Fallback rendering in case of partial failure
        renderGames();
        renderGallery();
    }
}

async function saveNews() {
    console.log('[admin-news] saveNews()');

    // Check for pending thumbnail rotation
    if (pendingThumbnailBlob || window.pendingThumbnailBlob) {
        const blob = pendingThumbnailBlob || window.pendingThumbnailBlob;
        const formData = new FormData();
        const fileName = `rotated_thumb_${Date.now()}.jpg`;
        formData.append('image', blob, fileName);

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
                window.uploadedImageData = uploadedImageData;
            } else {
                showAlert('Nepodařilo se nahrát rotovaný náhled', 'error');
                return;
            }
        } catch (e) {
            console.error('Thumbnail upload error:', e);
            showAlert('Chyba při nahrávání náhledu', 'error');
            return;
        }
        pendingThumbnailBlob = null;
        window.pendingThumbnailBlob = null;
    }

    const id = document.getElementById('editNewsId').value;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/news/${id}` : `${API_URL}/news`;

    const data = {
        title: document.getElementById('newsTitle').value,
        category: document.getElementById('newsCategory').value,
        publishedDate: document.getElementById('newsDate').value,
        content: document.getElementById('articleContent').innerHTML,
        excerpt: document.getElementById('newsExcerpt').value,
        thumbnailUrl: uploadedImageData ? (uploadedImageData + '#crop=' + imageCropPosition) : null,
        isPublished: document.getElementById('publishCheck').checked,
        gamesJson: JSON.stringify(games.map(g => ({ ...g, isCommented: g.commented }))),
        galleryJson: JSON.stringify(galleryImages)
    };

    // Validate required fields
    if (!data.title) {
        showAlert('Vyplňte nadpis', 'error');
        return;
    }
    if (!data.publishedDate) {
        showAlert('Vyplňte datum publikace', 'error');
        return;
    }
    if (!data.excerpt) {
        showAlert('Vyplňte krátký popis', 'error');
        return;
    }

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            showAlert('Uloženo!', 'success');
            switchTab('dashboard');
            loadDashboard();
        } else {
            // Try to get error details from response
            let errorMsg = 'Chyba při ukládání';
            try {
                const errorData = await res.json();
                if (errorData.error) {
                    errorMsg = `Chyba: ${errorData.error}`;
                } else if (errorData.message) {
                    errorMsg = `Chyba: ${errorData.message}`;
                }
            } catch (parseErr) {
                const errorText = await res.text();
                if (errorText) {
                    errorMsg = `Chyba ${res.status}: ${errorText.substring(0, 100)}`;
                } else {
                    errorMsg = `Chyba ${res.status}: ${res.statusText}`;
                }
            }
            console.error('Save error:', errorMsg);
            showAlert(errorMsg, 'error');
        }
    } catch (e) {
        console.error('Connection error:', e);
        showAlert('Chyba spojení: ' + e.message, 'error');
    }
}

async function deleteNews(id) {
    if (!confirm('Opravdu smazat tento článek? Tato akce je nevratná!')) return;
    console.log('[admin-news] deleteNews()', id);
    try {
        const res = await fetch(`${API_URL}/news/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } });
        if (res.ok) {
            showAlert('Článek smazán', 'success');
            loadDashboard();
        } else {
            showAlert('Chyba při mazání článku', 'error');
        }
    } catch (e) { console.error(e); showAlert('Chyba spojení', 'error'); }
}

function updatePreview() {
    document.getElementById('previewTitle').textContent = document.getElementById('newsTitle').value || 'Nadpis';
    document.getElementById('previewCategory').textContent = document.getElementById('newsCategory').value;
    document.getElementById('previewExcerpt').textContent = document.getElementById('newsExcerpt').value || 'Krátký popis...';
    const date = document.getElementById('newsDate').value;
    document.getElementById('previewDate').textContent = date ? new Date(date).toLocaleDateString('cs-CZ') : 'Datum';

    // Update card preview image
    const previewImg = document.getElementById('previewImage');
    if (uploadedImageData) {
        previewImg.innerHTML = `<img src="${uploadedImageData}" style="object-position: center ${imageCropPosition};">`;
    } else {
        previewImg.innerHTML = '<i class="fa-solid fa-image" style="font-size: 1.5rem; color: var(--text-muted);"></i>';
    }
}

// ================================
// WYSIWYG & EDITOR HELPERS
// ================================
// NOTE: Functions moved to js/admin/admin-wysiwyg.js
// Includes: formatText, toggleSource, insertHighlight, checkToolbarState,
// applyHeading, insertList, insertLink, insertCollapsibleBlock, insertIntroBlock

// ================================
// IMAGE MANAGEMENT (Content & Thumbnail)
// ================================
// NOTE: Functions moved to js/admin/admin-content-images.js
// Includes: insertImage, showImageModal, closeImageModal, handleImageFile,
// saveImageInsertion, deleteImage, rotateContentImage, uploadRotatedImage

// ================================
// THUMBNAIL MANAGEMENT
// ================================
// NOTE: Functions moved to js/admin/admin-thumbnail.js
// Includes: handleImageUpload, handleImageUrl, displayImage, removeImage,
// updateCropFromSlider, rotateImage

// ================================
// ATTACHED GAMES MANAGEMENT
// ================================

// Note: Uses escapeHtml from utils.js (global)
function renderGames() {
    console.log('[admin-news] renderGames:', games.length);
    const list = document.getElementById('gamesList');
    if (!list) return;

    const items = games.map((game, index) => {
        if (game.type === 'header') {
            return `
            <div class="game-item game-header-item" draggable="true" data-index="${index}" style="background: rgba(212, 175, 55, 0.15); border: 1px solid var(--primary-color);">
                <div class="game-header">
                    <span class="game-number"><i class="fa-solid fa-heading"></i></span>
                    <strong>Oddělovač</strong>
                </div>
                <div class="game-body" style="flex: 1;">
                    <input type="text" 
                           class="game-title-input" 
                           value="${escapeHtml(game.title || '')}" 
                           placeholder="Např. A tým"
                           oninput="updateGameTitle(${index}, this.value)"
                           style="font-weight: bold; color: var(--primary-color);">
                </div>
                <div class="game-actions">
                    <button class="action-btn btn-delete" onclick="removeGame(${index})"><i class="fa-solid fa-times"></i></button>
                </div>
            </div>`;
        }

        // Check if this is a native PGN game or Chess.com embed
        const isPgnGame = !!game.pgn;
        const badgeStyle = isPgnGame
            ? 'background: #3b82f6; color: white;'
            : 'background: #81b64c; color: white;';
        const badgeText = isPgnGame ? 'PGN' : 'CC';
        const badgeIcon = isPgnGame ? 'fa-solid fa-chess' : 'fa-solid fa-globe';

        // ID input only for Chess.com games, avatar selector for PGN games
        const idSection = isPgnGame
            ? `<span style="font-size: 0.7rem; color: #3b82f6; padding: 0.2rem 0.5rem; background: rgba(59,130,246,0.15); border-radius: 4px;">
                <i class="fa-solid fa-database"></i> Nativní
               </span>
               <select onchange="updateGameAvatar(${index}, this.value)" 
                       style="padding: 0.25rem 0.4rem; font-size: 0.7rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: var(--text-color);"
                       title="Avatar v komentářích">
                   <option value="" ${!game.commentAvatar ? 'selected' : ''}>🎭 Auto</option>
                   <option value="random" ${game.commentAvatar === 'random' ? 'selected' : ''}>🎲 Náhodný</option>
                   <option value="antonin" ${game.commentAvatar === 'antonin' ? 'selected' : ''}>🧑 Antonín</option>
                   <option value="filip" ${game.commentAvatar === 'filip' ? 'selected' : ''}>🧑 Filip</option>
                   <option value="lukas" ${game.commentAvatar === 'lukas' ? 'selected' : ''}>🧑 Lukáš</option>
                   <option value="radim" ${game.commentAvatar === 'radim' ? 'selected' : ''}>🧑 Radim</option>
               </select>`
            : `<input type="text" 
                   class="game-id-input" 
                   value="${game.gameId || ''}" 
                   placeholder="Chess.com ID"
                   onchange="updateGameId(${index}, this.value)"
                   style="width: 100px; font-family: monospace;">
               <a href="https://www.chess.com/analysis/game/live/${game.gameId}" target="_blank" class="btn-secondary" style="padding: 4px 8px;" title="Chess.com">
                   <i class="fa-solid fa-external-link-alt"></i>
               </a>`;

        return `
        <div class="game-item" draggable="true" data-index="${index}" data-team="${game.team || ''}" style="${isPgnGame ? 'border-left: 3px solid #3b82f6;' : ''}">
            <div class="game-header">
                <span class="game-number">#${index + 1}</span>
                <span style="font-size: 0.6rem; padding: 0.15rem 0.4rem; border-radius: 3px; font-weight: 700; ${badgeStyle}">
                    <i class="${badgeIcon}" style="font-size: 0.55rem;"></i> ${badgeText}
                </span>
            </div>
            <div class="game-body">
                <input type="text" 
                       class="game-title-input" 
                       value="${escapeHtml(game.title || '')}" 
                       placeholder="Jméno partie"
                       oninput="updateGameTitle(${index}, this.value)">
                ${idSection}
            </div>
            <div class="game-actions">
                <label title="Komentovaná" style="cursor:pointer; display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; color: var(--text-muted);">
                    <input type="checkbox" ${game.commented ? 'checked' : ''} onchange="toggleGameCommented(${index}, this.checked)">
                    <i class="fa-regular fa-comment-dots"></i>
                </label>
                <button class="action-btn btn-delete" onclick="removeGame(${index})"><i class="fa-solid fa-times"></i></button>
            </div>
        </div>
    `}).join('');

    list.innerHTML = items;
    initDragAndDrop();
}

function addGame() {
    console.log('[admin-news] addGame()');
    const titleInput = document.getElementById('gameTitle');
    const idInput = document.getElementById('gameId');
    const commentedInput = document.getElementById('gameCommented');

    const title = titleInput.value.trim();
    let gameId = idInput.value.trim();

    // Sanitize ID
    if (gameId.includes('[gid=')) {
        const match = gameId.match(/\[gid=(\d+)\]/);
        if (match && match[1]) {
            gameId = match[1];
        }
    }

    if (!title) {
        alert('Zadejte jméno partie (Kdo s kým)');
        return;
    }

    games.push({
        title: title,
        gameId: gameId,
        team: 'A tým',
        isCommented: commentedInput.checked,
        commented: commentedInput.checked
    });

    // Clear inputs
    titleInput.value = '';
    idInput.value = '';
    commentedInput.checked = false;

    renderGames();
}

function addHeader() {
    const title = document.getElementById('headerTitle').value.trim();
    if (!title) {
        alert('Zadejte text nadpisu');
        return;
    }
    games.push({
        type: 'header',
        title: title
    });
    document.getElementById('headerTitle').value = '';
    renderGames();
}

function removeGame(index) {
    games.splice(index, 1);
    renderGames();
}

function updateGameTitle(index, newTitle) {
    games[index].title = newTitle;
    updatePreview();
}

function sanitizeGameId(input) {
    if (!input) return '';
    const match = input.match(/\[gid=(\d+)\]/);
    if (match && match[1]) {
        return match[1];
    }
    if (/^\d+$/.test(input.trim())) {
        return input.trim();
    }
    return input.trim();
}

function updateGameId(index, newId) {
    const cleanId = sanitizeGameId(newId);
    games[index].gameId = cleanId;
    games[index].src = `https://www.chess.com/emboard?id=${cleanId}`;
    updatePreview();
}

function toggleGameCommented(index, checked) {
    games[index].commented = checked;
}

function updateGameAvatar(index, avatar) {
    games[index].commentAvatar = avatar || null;
}

// Drag & Drop for Games
let draggedItem = null;
let draggedIndex = null;

function initDragAndDrop() {
    const items = document.querySelectorAll('.game-item[draggable="true"]');
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
        item.addEventListener('drop', handleDrop);
    });
}

function handleDragStart(e) {
    draggedItem = this;
    draggedIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedIndex);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.game-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    draggedItem = null;
    draggedIndex = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    if (this !== draggedItem) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (this === draggedItem) return;

    const fromIndex = draggedIndex;
    const toIndex = parseInt(this.dataset.index);
    if (fromIndex === toIndex) return;

    const [movedGame] = games.splice(fromIndex, 1);
    games.splice(toIndex, 0, movedGame);
    renderGames();
}

// ================================
// ATTACHED GALLERY MANAGEMENT
// ================================

function toggleGalleryUrlInput() {
    document.getElementById('galleryUrlInput').classList.toggle('hidden');
}

function addGalleryFromUrl() {
    const url = document.getElementById('galleryImageUrl').value.trim();
    if (url) {
        galleryImages.push({ url, caption: '' });
        renderGallery();
        document.getElementById('galleryImageUrl').value = '';
    }
}

async function addGalleryImages(event) {
    console.log('[admin-news] addGalleryImages()');
    for (const file of event.target.files) {
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
                const imageUrl = data.url.startsWith('http') ? data.url : `${baseUrl}${data.url}`;
                galleryImages.push({ url: imageUrl, caption: '' });
                renderGallery();
            }
        } catch (e) {
            console.error(e);
        }
    }
    event.target.value = '';
}

function removeGalleryImage(index) {
    galleryImages.splice(index, 1);
    renderGallery();
}

async function rotateGalleryImage(index) {
    console.log('[admin-news] rotateGalleryImage()', index);
    const btn = document.getElementById(`rotateGalleryBtn_${index}`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
        const imgUrl = typeof galleryImages[index] === 'string' ? galleryImages[index] : galleryImages[index].url;
        const newUrl = await uploadRotatedImage(imgUrl);
        if (newUrl) {
            galleryImages[index] = { url: newUrl, caption: galleryImages[index].caption || '' };
            renderGallery();
        }
    } catch (e) {
        alert('Nepodařilo se otočit obrázek.');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
        }
    }
}

function renderGallery() {
    document.getElementById('galleryPreview').innerHTML = galleryImages.length ? galleryImages.map((item, i) => {
        const url = typeof item === 'string' ? item : item.url;
        const caption = typeof item === 'string' ? '' : (item.caption || '');
        return `
        <div style="display: flex; flex-direction: column; gap: 0.3rem; width: 100px;">
            <div style="position: relative;">
                <img src="${url}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;">
                <button onclick="removeGalleryImage(${i})" style="position: absolute; top: -5px; right: -5px; background: #dc2626; border: none; color: white; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center;">×</button>
                <button id="rotateGalleryBtn_${i}" onclick="rotateGalleryImage(${i})" style="position: absolute; bottom: -5px; right: -5px; background: rgba(0,0,0,0.7); border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center;" title="Otočit"><i class="fa-solid fa-rotate-right"></i></button>
            </div>
            <input type="text" value="${caption}" placeholder="Popisek..." onchange="updateGalleryCaption(${i}, this.value)" style="width: 80px; padding: 0.2rem; font-size: 0.7rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: var(--text-color);">
        </div>
    `}).join('') : '<p style="color: var(--text-muted); font-size: 0.85rem;">Žádné obrázky</p>';
}

function updateGalleryCaption(index, caption) {
    if (typeof galleryImages[index] === 'string') {
        galleryImages[index] = { url: galleryImages[index], caption };
    } else {
        galleryImages[index].caption = caption;
    }
}

// ================================
// GALLERY PICKER INTEGRATIONS
// ================================

function selectGalleryForImageModal() {
    if (!window.showGalleryPicker) return;
    showGalleryPicker((url) => {
        document.getElementById('imgUrlInput').value = url;
        document.getElementById('imgPreviewArea').innerHTML = `<img src="${url}" style="max-width:100%; max-height: 300px;">`;
    });
}

function selectGalleryForThumbnail() {
    if (!window.showGalleryPicker) return;
    showGalleryPicker((url, caption) => {
        uploadedImageData = url;
        window.uploadedImageData = url;
        displayImage(url);
    });
}

function selectGalleryForArticleGallery() {
    if (!window.showGalleryPicker) return;
    showGalleryPicker((url, caption) => {
        galleryImages.push({ url, caption: caption || '' });
        renderGallery();
    });
}

// ================================
// GALLERY DRAG & DROP
// ================================

function setupGalleryDropzone() {
    const galleryPreview = document.getElementById('galleryPreview');
    if (!galleryPreview) return;

    const dropzone = galleryPreview.parentElement;
    if (!dropzone || dropzone.dataset.dropzoneInitialized) return;
    dropzone.dataset.dropzoneInitialized = 'true';

    dropzone.style.position = 'relative';

    const overlay = document.createElement('div');
    overlay.id = 'galleryDropOverlay';
    overlay.innerHTML = '<i class="fa-solid fa-cloud-upload-alt"></i><span>Pusťte obrázky zde</span>';
    overlay.style.cssText = `
        display: none;
        position: absolute;
        inset: 0;
        background: rgba(212, 175, 55, 0.15);
        border: 2px dashed var(--primary-color);
        border-radius: 8px;
        z-index: 10;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        color: var(--primary-color);
        font-size: 1.2rem;
        pointer-events: none;
    `;
    dropzone.appendChild(overlay);

    dropzone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        overlay.style.display = 'flex';
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        overlay.style.display = 'flex';
    });

    dropzone.addEventListener('dragleave', (e) => {
        if (!dropzone.contains(e.relatedTarget)) {
            overlay.style.display = 'none';
        }
    });

    dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        overlay.style.display = 'none';

        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return;

        for (const file of files) {
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
                    const imageUrl = data.url.startsWith('http') ? data.url : `${baseUrl}${data.url}`;
                    galleryImages.push({ url: imageUrl, caption: '' });
                }
            } catch (err) {
                console.error('Drop upload error:', err);
            }
        }

        renderGallery();
    });

    console.log('[admin-news] Gallery dropzone initialized');
}

// Initialize dropzone when editor is shown
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupGalleryDropzone, 500);
});

// ================================
// RECORDED GAMES MODAL
// ================================

async function showRecordedGamesModal() {
    console.log('[admin-news] showRecordedGamesModal()');
    const modal = document.getElementById('recordedGamesModal');
    const list = document.getElementById('recordedGamesList');

    modal.style.display = 'flex';
    list.innerHTML = '<p style="color: var(--text-muted); text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Načítám...</p>';

    try {
        const res = await fetch(`${API_URL}/games`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const gamesData = await res.json();

        if (!gamesData.length) {
            list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Žádné nahrané partie</p>';
            return;
        }

        list.innerHTML = gamesData.map(g => `
            <div class="db-game-item" data-game-id="${g.id}" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; margin-bottom: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 8px; cursor: pointer; border-left: 3px solid #3b82f6; transition: all 0.2s;"
                 onmouseover="this.style.background='rgba(59,130,246,0.15)'"
                 onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                <span style="font-size: 0.65rem; padding: 0.15rem 0.35rem; border-radius: 3px; font-weight: 700; background: #3b82f6; color: white;">PGN</span>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">${escapeHtml(g.white)} - ${escapeHtml(g.black)}</div>
                    <div style="display: flex; gap: 0.75rem; font-size: 0.75rem; color: var(--text-muted);">
                        <span style="color: #4ade80; font-weight: 700;">${g.result || '*'}</span>
                        <span>${g.date ? new Date(g.date).toLocaleDateString('cs-CZ') : ''}</span>
                        ${g.event ? `<span>${escapeHtml(g.event)}</span>` : ''}
                    </div>
                </div>
                <i class="fa-solid fa-plus" style="color: #60a5fa;"></i>
            </div>
        `).join('');

        list.querySelectorAll('.db-game-item').forEach(item => {
            item.addEventListener('click', () => {
                const gameId = parseInt(item.dataset.gameId);
                addGameFromDB(gameId);
            });
        });
    } catch (e) {
        console.error('Error loading recorded games:', e);
        list.innerHTML = '<p style="color: #fca5a5; text-align: center;">Chyba načítání</p>';
    }
}

function closeRecordedGamesModal() {
    document.getElementById('recordedGamesModal').style.display = 'none';
}

async function addGameFromDB(gameId) {
    console.log('[admin-news] addGameFromDB()', gameId);
    try {
        const res = await fetch(`${API_URL}/games/${gameId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const gameData = await res.json();

        const title = `${gameData.white || '?'} - ${gameData.black || '?'}`;

        games.push({
            title: title,
            gameId: null,
            pgn: gameData.pgn,
            dbGameId: gameId,
            team: 'A tým',
            isCommented: false,
            commented: false
        });

        renderGames();
        closeRecordedGamesModal();
    } catch (e) {
        console.error('Error fetching game:', e);
        alert('Nepodařilo se načíst partii');
    }
}

// Close modal on outside click
document.getElementById('recordedGamesModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'recordedGamesModal') closeRecordedGamesModal();
});

// ================================
// PGN PASTE MODAL FOR NEWS
// ================================

function showNewsGamePgnModal() {
    const modal = document.getElementById('newsGamePgnModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('newsGamePgnTitle').value = '';
        document.getElementById('newsGamePgnText').value = '';
    }
}

function closeNewsGamePgnModal() {
    const modal = document.getElementById('newsGamePgnModal');
    if (modal) modal.style.display = 'none';
}

function addGameFromPgn() {
    const pgnInput = document.getElementById('newsGamePgnText');
    const pgnText = pgnInput.value.trim();

    if (!pgnText) {
        alert('Vložte PGN notaci');
        return;
    }

    // Split multiple games - each game starts with [Event
    const gameChunks = pgnText.split(/(?=\[Event\s)/);
    const validGames = gameChunks.filter(chunk => chunk.trim().length > 0);

    if (validGames.length === 0) {
        validGames.push(pgnText);
    }

    let addedCount = 0;
    for (const pgn of validGames) {
        const trimmedPgn = pgn.trim();
        if (!trimmedPgn) continue;

        const whiteMatch = trimmedPgn.match(/\[White\s+"([^"]+)"\]/);
        const blackMatch = trimmedPgn.match(/\[Black\s+"([^"]+)"\]/);
        const title = (whiteMatch && blackMatch)
            ? `${whiteMatch[1]} - ${blackMatch[1]}`
            : 'Partie';

        games.push({
            title: title,
            gameId: null,
            pgn: trimmedPgn,
            dbGameId: null,
            team: 'A tým',
            isCommented: false,
            commented: false
        });
        addedCount++;
    }

    renderGames();
    closeNewsGamePgnModal();

    if (addedCount > 1) {
        alert(`Přidáno ${addedCount} partií`);
    }
}

function handlePgnFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('newsGamePgnText').value = e.target.result;
    };
    reader.readAsText(file);
    event.target.value = '';
}

function setupPgnDropZone() {
    const dropZone = document.getElementById('pgnDropZone');
    const overlay = document.getElementById('pgnDropOverlay');
    const textarea = document.getElementById('newsGamePgnText');

    if (!dropZone || !overlay) return;

    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        overlay.style.display = 'flex';
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        overlay.style.display = 'flex';
    });

    dropZone.addEventListener('dragleave', (e) => {
        if (!dropZone.contains(e.relatedTarget)) {
            overlay.style.display = 'none';
        }
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        overlay.style.display = 'none';

        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.pgn') || file.name.endsWith('.txt') || file.type === 'text/plain')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                textarea.value = ev.target.result;
            };
            reader.readAsText(file);
        }
    });
}

// Initialize drop zone when modal opens
const origShowNewsGamePgnModal = showNewsGamePgnModal;
showNewsGamePgnModal = function () {
    origShowNewsGamePgnModal();
    setTimeout(setupPgnDropZone, 100);
};

// Close PGN modal on outside click
document.getElementById('newsGamePgnModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'newsGamePgnModal') closeNewsGamePgnModal();
});

// ================================
// HEADER/SEPARATOR MODAL
// ================================

function showHeaderModal() {
    const modal = document.getElementById('headerModal');
    if (modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('headerTitleModal');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

function closeHeaderModal() {
    const modal = document.getElementById('headerModal');
    if (modal) modal.style.display = 'none';
}

function addHeaderFromModal() {
    const input = document.getElementById('headerTitleModal');
    const title = input?.value.trim();

    if (!title) {
        alert('Zadejte název oddělovače');
        return;
    }

    games.push({
        type: 'header',
        title: title
    });

    renderGames();
    closeHeaderModal();
}

// Close header modal on outside click
document.getElementById('headerModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'headerModal') closeHeaderModal();
});

// ================================
// EXPORTS - Core functions from this module
// ================================
// Note: WYSIWYG, Image, and Thumbnail functions are now
// exported from their respective modules

window.resetEditor = resetEditor;
window.editNews = editNews;
window.saveNews = saveNews;
window.deleteNews = deleteNews;
window.updatePreview = updatePreview;
window.checkDraft = checkDraft;

// Games exports
window.renderGames = renderGames;
window.addGame = addGame;
window.removeGame = removeGame;
window.updateGameTitle = updateGameTitle;
window.updateGameId = updateGameId;
window.toggleGameCommented = toggleGameCommented;
window.updateGameAvatar = updateGameAvatar;
window.addHeader = addHeader;

// Gallery exports
window.toggleGalleryUrlInput = toggleGalleryUrlInput;
window.addGalleryFromUrl = addGalleryFromUrl;
window.addGalleryImages = addGalleryImages;
window.removeGalleryImage = removeGalleryImage;
window.rotateGalleryImage = rotateGalleryImage;
window.updateGalleryCaption = updateGalleryCaption;
window.renderGallery = renderGallery;
window.selectGalleryForImageModal = selectGalleryForImageModal;
window.selectGalleryForThumbnail = selectGalleryForThumbnail;
window.selectGalleryForArticleGallery = selectGalleryForArticleGallery;
window.setupGalleryDropzone = setupGalleryDropzone;

// Recorded Games exports
window.showRecordedGamesModal = showRecordedGamesModal;
window.closeRecordedGamesModal = closeRecordedGamesModal;
window.addGameFromDB = addGameFromDB;

// PGN Modal exports
window.showNewsGamePgnModal = showNewsGamePgnModal;
window.closeNewsGamePgnModal = closeNewsGamePgnModal;
window.addGameFromPgn = addGameFromPgn;
window.handlePgnFileUpload = handlePgnFileUpload;

// Header Modal exports
window.showHeaderModal = showHeaderModal;
window.closeHeaderModal = closeHeaderModal;
window.addHeaderFromModal = addHeaderFromModal;

console.log('[admin-news] Module loaded successfully');
