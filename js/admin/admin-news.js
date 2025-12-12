/**
 * Admin News Module
 * Contains: News Editor, WYSIWYG logic, Image management for articles
 */

// Editor State
let uploadedImageData = null;
let imageCropPosition = '50%';
let games = []; // List of games attached to the article
let galleryImages = []; // List of images attached to the article
let teamSelection = []; // Legacy/Unused but kept for structure

// ================================
// COMPONENT INITIALIZATION
// ================================

// Auto-save and Toolbar Listeners
document.addEventListener('DOMContentLoaded', () => {
    const content = document.getElementById('articleContent');
    if (!content) return; // Might not be on admin page or tab hidden

    content.addEventListener('mouseup', checkToolbarState);
    content.addEventListener('keyup', checkToolbarState);
    content.addEventListener('click', checkToolbarState);

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

// Check for draft when switching to editor? or on load?
// We'll expose a function to check draft
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

        // Load gallery from database
        if (item.galleryJson) {
            galleryImages = JSON.parse(item.galleryJson);
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
        gamesJson: JSON.stringify(games),
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

function formatText(command) {
    document.execCommand(command, false, null);
    document.getElementById('articleContent').focus();
    checkToolbarState();
}

function toggleSource() {
    const contentDiv = document.getElementById('articleContent');
    const sourceArea = document.getElementById('articleSource');
    const btn = document.getElementById('btnSource');

    if (sourceArea.classList.contains('hidden')) {
        // Switch to Source
        sourceArea.value = contentDiv.innerHTML;
        contentDiv.classList.add('hidden');
        sourceArea.classList.remove('hidden');
        btn.classList.add('active');
    } else {
        // Switch to WYSIWYG
        contentDiv.innerHTML = sourceArea.value;
        sourceArea.classList.add('hidden');
        contentDiv.classList.remove('hidden');
        btn.classList.remove('active');
        updatePreview();
    }
}

function updateContentFromSource() {
    const contentDiv = document.getElementById('articleContent');
    const sourceArea = document.getElementById('articleSource');
    contentDiv.innerHTML = sourceArea.value;
    updatePreview();
}

function insertHighlight(type) {
    const editor = document.getElementById('articleContent');
    const selection = window.getSelection();

    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const className = type === 'name' ? 'highlight-name' : 'highlight-score';
    let parentSpan = null;

    // 1. Check if we are inside a highlight span
    let el = range.commonAncestorContainer;
    if (el.nodeType === 3) el = el.parentNode;

    while (el && el !== editor) {
        if (el.classList && (el.classList.contains('highlight-name') || el.classList.contains('highlight-score'))) {
            parentSpan = el;
            break;
        }
        el = el.parentNode;
    }

    if (parentSpan) {
        // We are inside a span.
        // If it is the SAME type -> Exit (Toggle Off)
        if (parentSpan.classList.contains(className)) {
            // SAME TYPE: Move cursor OUT via a neutral buffer
            // Check if there is already a neutral node after
            let nextNode = parentSpan.nextSibling;
            if (nextNode && nextNode.nodeType === 1 && nextNode.tagName === 'SPAN' && !nextNode.className) {
                // Already have a buffer span, just move into it
                const newRange = document.createRange();
                newRange.selectNodeContents(nextNode);
                newRange.collapse(false); // End of span
                selection.removeAllRanges();
                selection.addRange(newRange);
            } else if (nextNode && nextNode.nodeType === 3) {
                // Text node exists, move to start of it
                const newRange = document.createRange();
                newRange.setStart(nextNode, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } else {
                // Create neutral span buffer
                const neutralSpan = document.createElement('span');
                neutralSpan.innerHTML = '&nbsp;'; // Visible space

                if (parentSpan.nextSibling) {
                    parentSpan.parentNode.insertBefore(neutralSpan, parentSpan.nextSibling);
                } else {
                    parentSpan.parentNode.appendChild(neutralSpan);
                }

                const newRange = document.createRange();
                newRange.setStart(neutralSpan.firstChild, 1); // After the &nbsp;
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
            editor.focus();
        } else {
            // If DIFFERENT type -> Switch type
            parentSpan.className = className;
        }
    } else {
        // Not inside a span -> Create new highlight
        if (!selection.isCollapsed) {
            // Text selected: wrap it
            const span = document.createElement('span');
            span.className = className;
            try {
                const contents = range.extractContents();
                span.appendChild(contents);
                range.insertNode(span);

                // FIX: Place cursor at the end of the new span
                const newRange = document.createRange();
                newRange.selectNodeContents(span);
                newRange.collapse(false);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } catch (e) { console.error(e); }
        } else {
            // No text selected: insert placeholder
            const placeholder = type === 'name' ? '[Jméno]' : '[Skóre]';
            const span = document.createElement('span');
            span.className = className;
            span.innerHTML = '\u200B' + placeholder;
            range.insertNode(span);

            // Add space after
            const space = document.createTextNode('\u00A0');
            if (span.nextSibling) {
                span.parentNode.insertBefore(space, span.nextSibling);
            } else {
                span.parentNode.appendChild(space);
            }

            // Move cursor to space
            const newRange = document.createRange();
            newRange.setStart(space, 1);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
    }

    editor.focus();
    updatePreview();
    checkToolbarState();
}

function checkToolbarState() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const anchorNode = selection.anchorNode;
    if (!anchorNode) return;

    // B/I/U
    const isBold = document.queryCommandState('bold');
    const isItalic = document.queryCommandState('italic');
    const isUnderline = document.queryCommandState('underline');

    const btnBold = document.getElementById('btnBold');
    const btnItalic = document.getElementById('btnItalic');
    const btnUnderline = document.getElementById('btnUnderline');

    if (btnBold) {
        if (isBold) btnBold.classList.add('active'); else btnBold.classList.remove('active');
        btnBold.style.background = '';
    }
    if (btnItalic) {
        if (isItalic) btnItalic.classList.add('active'); else btnItalic.classList.remove('active');
        btnItalic.style.background = '';
    }
    if (btnUnderline) {
        if (isUnderline) btnUnderline.classList.add('active'); else btnUnderline.classList.remove('active');
        btnUnderline.style.background = '';
    }

    // Highlight buttons
    const btnName = document.getElementById('btnHighlightName');
    const btnScore = document.getElementById('btnHighlightScore');

    if (btnName && btnScore) {
        btnName.classList.remove('active');
        btnScore.classList.remove('active');
        btnName.style.background = ''; // clear legacy
        btnScore.style.background = ''; // clear legacy

        let el = anchorNode.nodeType === 3 ? anchorNode.parentElement : anchorNode;
        // Check current node and parents
        while (el && el.id !== 'articleContent') {
            if (el.classList && el.classList.contains('highlight-name')) {
                btnName.classList.add('active');
                break;
            } else if (el.classList && el.classList.contains('highlight-score')) {
                btnScore.classList.add('active');
                break;
            }
            el = el.parentElement;
        }
    }

    // Heading
    const headingSelect = document.getElementById('headingSelect');
    if (headingSelect) {
        const blockValue = document.queryCommandValue('formatBlock');
        if (blockValue && blockValue.toLowerCase().startsWith('h')) {
            headingSelect.value = blockValue.toLowerCase();
        } else {
            headingSelect.value = 'p';
        }
    }
}

function applyHeading(tag) {
    document.execCommand('formatBlock', false, tag);
    document.getElementById('articleContent').focus();
    checkToolbarState();
}

function insertList(type) {
    const command = type === 'ul' ? 'insertUnorderedList' : 'insertOrderedList';
    document.execCommand(command, false, null);
    document.getElementById('articleContent').focus();
    updatePreview();
}

function insertLink() {
    const editor = document.getElementById('articleContent');
    const selection = window.getSelection();
    let selectedText = '';
    let savedRange = null;

    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        savedRange = selection.getRangeAt(0).cloneRange();
        selectedText = selection.toString();
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'linkModal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="document.getElementById('linkModal').remove()"></div>
        <div class="modal-content" style="max-width: 400px;">
            <h3 style="margin-bottom:1rem;">Vložit odkaz</h3>
            <div style="margin-bottom:1rem;">
                <label style="display:block;margin-bottom:0.3rem;color:var(--text-muted);font-size:0.85rem;">URL *</label>
                <input type="url" id="linkUrl" placeholder="https://..." style="width:100%;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:1rem;">
                <label style="display:block;margin-bottom:0.3rem;color:var(--text-muted);font-size:0.85rem;">Text odkazu</label>
                <input type="text" id="linkText" value="${selectedText}" placeholder="Zobrazovaný text" style="width:100%;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:1rem;">
                <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;color:var(--text-muted);font-size:0.85rem;">
                    <input type="checkbox" id="linkNewTab" checked style="width:auto;">
                    Otevřít v novém okně
                </label>
            </div>
            <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
                <button id="linkCancel" class="btn-secondary">Zrušit</button>
                <button id="linkInsert" class="btn-primary">Vložit</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const urlInput = modal.querySelector('#linkUrl');
    const textInput = modal.querySelector('#linkText');
    const newTabCheck = modal.querySelector('#linkNewTab');

    urlInput.focus();

    modal.querySelector('#linkCancel').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.querySelector('#linkInsert').onclick = () => {
        const url = urlInput.value.trim();
        const text = textInput.value.trim() || url;
        const newTab = newTabCheck.checked;

        if (!url) {
            urlInput.style.borderColor = '#f87171';
            return;
        }

        if (savedRange) {
            selection.removeAllRanges();
            selection.addRange(savedRange);
            savedRange.deleteContents();
        }

        const a = document.createElement('a');
        a.href = url;
        a.textContent = text;
        if (newTab) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        }

        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange();
        if (!editor.contains(range.commonAncestorContainer)) {
            editor.appendChild(a);
            editor.appendChild(document.createTextNode(' '));
        } else {
            range.insertNode(a);
            const space = document.createTextNode(' ');
            a.parentNode.insertBefore(space, a.nextSibling);
            range.setStartAfter(space);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        modal.remove();
        editor.focus();
        updatePreview();
    };

    urlInput.onkeydown = textInput.onkeydown = (e) => {
        if (e.key === 'Enter') modal.querySelector('#linkInsert').click();
        if (e.key === 'Escape') modal.remove();
    };
}

function insertCollapsibleBlock() {
    const id = 'collapse_' + Date.now();
    const iconId = 'icon_' + Date.now();

    const html = `
        <div class="collapsible-wrapper" contenteditable="false" style="user-select: none;">
            <div class="collapsible-header" onclick="toggleSection('${id}', '${iconId}')" style="cursor: pointer;">
                <h3 contenteditable="true" style="cursor: text; user-select: text;">Nadpis sekce</h3>
                <i id="${iconId}" class="fa-solid fa-chevron-down"></i>
            </div>
            <div id="${id}" class="collapsible-content hidden" contenteditable="true" style="cursor: text; user-select: text;">
                <p>Zde napište obsah...</p>
            </div>
        </div>
        <p><br></p>
    `;

    document.execCommand('insertHTML', false, html);
}

// Preview toggle logic for editor
window.toggleSection = function (id, iconId) {
    const content = document.getElementById(id);
    const icon = document.getElementById(iconId);

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (icon) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }
    } else {
        content.classList.add('hidden');
        if (icon) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    }
}

function insertIntroBlock() {
    const content = document.getElementById('articleContent');
    const selection = window.getSelection();

    if (selection.rangeCount > 0) {
        let node = selection.getRangeAt(0).commonAncestorContainer;
        while (node && node !== content) {
            if (node.nodeType === 1 && node.classList?.contains('puzzle-section')) {
                let afterBlock = node.nextElementSibling;
                if (!afterBlock || afterBlock.tagName !== 'P') {
                    afterBlock = document.createElement('p');
                    afterBlock.innerHTML = '<br>';
                    node.parentNode.insertBefore(afterBlock, node.nextSibling);
                }
                const newRange = document.createRange();
                newRange.setStart(afterBlock, 0);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
                content.focus();
                updatePreview();
                return;
            }
            node = node.parentNode;
        }
    }

    const introHtml = `<div class="puzzle-section">
<p style="font-size: 1.1rem; margin-bottom: 1rem;">
🧩 <strong>Pozice z partie...</strong><br>
Popis pozice nebo úkolu.<br>
Najdete vítězný tah? ♟️
</p>
</div>`;
    document.execCommand('insertHTML', false, introHtml);
    content.focus();
    updatePreview();
}

// ================================
// IMAGE MANAGEMENT (Content & Thumbnail)
// ================================

let selectedImage = null;
let savedRange = null;

function insertImage() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        savedRange = sel.getRangeAt(0).cloneRange();
    }
    showImageModal();
}

function showImageModal(existingImg = null) {
    selectedImage = existingImg;

    let modal = document.getElementById('imageModal');
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
            <div class="modal-overlay" onclick="closeImageModal()"></div>
            <div class="modal-content">
                <h3 style="margin-bottom: 1rem;">${existingImg ? 'Upravit obrázek' : 'Vložit obrázek'}</h3>
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
                <div style="margin-bottom: 1rem;">
                    <label style="display:block;margin-bottom:0.5rem;">Zarovnání</label>
                    <select id="imgAlignInput" style="width: 100%;">
                        <option value="center">Na střed (výchozí)</option>
                        <option value="left">Vlevo (obtékaný)</option>
                        <option value="right">Vpravo (obtékaný)</option>
                        <option value="full">Plná šířka</option>
                    </select>
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
        document.body.appendChild(modal);
    }

    // reset/fill logic
    const imgUrlInput = document.getElementById('imgUrlInput');
    const imgPreviewArea = document.getElementById('imgPreviewArea');
    const imgAlignInput = document.getElementById('imgAlignInput');

    if (existingImg) {
        const src = existingImg.getAttribute('src');
        imgUrlInput.value = src;
        imgPreviewArea.innerHTML = `<img src="${src}" style="max-width:100%; max-height: 300px;">`;

        if (existingImg.style.float === 'left') imgAlignInput.value = 'left';
        else if (existingImg.style.float === 'right') imgAlignInput.value = 'right';
        else if (existingImg.style.width === '100%') imgAlignInput.value = 'full';
        else imgAlignInput.value = 'center';

    } else {
        imgUrlInput.value = '';
        imgPreviewArea.innerHTML = '<p style="color: var(--text-muted);">Náhled obrázku</p>';
        imgAlignInput.value = 'center';
    }

    modal.style.display = 'flex';
    imgUrlInput.onchange = () => {
        if (imgUrlInput.value) imgPreviewArea.innerHTML = `<img src="${imgUrlInput.value}" style="max-width:100%; max-height: 300px;">`;
    };
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) modal.style.display = 'none';
    selectedImage = null;
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

function saveImageInsertion() {
    const url = document.getElementById('imgUrlInput').value;
    const align = document.getElementById('imgAlignInput').value;

    if (!url) {
        closeImageModal();
        return;
    }

    let style = 'max-width: 100%; height: auto; border-radius: 8px;';
    if (align === 'center') {
        style += ' display: block; margin: 1rem auto;';
    } else if (align === 'full') {
        style += ' width: 100%; margin: 1rem 0;';
    } else if (align === 'left') {
        style += ' float: left; margin: 0 1rem 1rem 0;';
    } else if (align === 'right') {
        style += ' float: right; margin: 0 0 1rem 1rem;';
    }

    if (selectedImage) {
        selectedImage.src = url;
        selectedImage.style.cssText = style;
    } else {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Obrázek';
        img.style.cssText = style;

        const content = document.getElementById('articleContent');
        if (savedRange && content.contains(savedRange.commonAncestorContainer)) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
            savedRange.insertNode(img);
            savedRange.collapse(false);
        } else {
            content.appendChild(img);
        }
    }
    updatePreview();
    closeImageModal();
}

function deleteImage() {
    if (selectedImage) {
        selectedImage.remove();
        updatePreview();
    }
    closeImageModal();
}

// Rotation
async function rotateContentImage() {
    const urlInput = document.getElementById('imgUrlInput');
    const url = urlInput.value;
    if (!url) return;

    const btn = document.getElementById('rotateContentBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Otáčím...';
    btn.disabled = true;

    try {
        const newUrl = await uploadRotatedImage(url);
        if (newUrl) {
            urlInput.value = newUrl;
            document.getElementById('imgPreviewArea').innerHTML = `<img src="${newUrl}" style="max-width:100%; max-height: 300px;">`;

            // If editing existing, update it too
            if (selectedImage) {
                selectedImage.src = newUrl;
            }
        }
    } catch (e) {
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
// THUMBNAIL MANAGEMENT
// ================================

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

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
    if (url) {
        uploadedImageData = url;
        displayImage(url);
    }
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

async function rotateImage() {
    if (!uploadedImageData) return;
    const btn = document.querySelector('button[onclick="rotateImage()"]');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const newUrl = await uploadRotatedImage(uploadedImageData);
        if (newUrl) {
            uploadedImageData = newUrl;
            displayImage(newUrl);
            document.getElementById('imageUrl').value = newUrl;
        }
    } catch (e) {
        alert('Nepodařilo se otočit obrázek');
    } finally {
        if (btn) btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
    }
}

// ================================
// ATTACHED GAMES MANAGEMENT
// ================================

function renderGames() {
    const list = document.getElementById('gamesList');
    if (!list) return; // Should exist

    const items = games.map((game, index) => `
        <div class="game-item" draggable="true" data-index="${index}" data-team="${game.team || ''}">
            <div class="game-header">
                <div>
                    <span class="game-number">#${index + 1}</span>
                    <i class="fa-solid fa-chess-board" style="color:var(--primary-color);margin-left:8px;"></i>
                </div>
                <div class="game-actions">
                     <label title="Komentovaná partie" style="cursor:pointer; margin-right: 0.5rem; display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: var(--text-muted);">
                        <input type="checkbox" ${game.commented ? 'checked' : ''} onchange="toggleGameCommented(${index}, this.checked)">
                        <i class="fa-regular fa-comment-dots"></i>
                    </label>
                    <button class="action-btn btn-delete" onclick="removeGame(${index})"><i class="fa-solid fa-times"></i></button>
                </div>
            </div>
            <div class="game-body">
                <input type="text" 
                       class="game-title-input" 
                       value="${escapeHtml(game.title || '')}" 
                       placeholder="Nadpis partie (např. Duda - Soupeř)"
                       oninput="updateGameTitle(${index}, this.value)">
                
                 <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                    <div style="flex:1;">
                         <input type="text" 
                           class="game-id-input" 
                           value="${game.gameId || ''}" 
                           placeholder="Chess.com ID (např. 123456)"
                           onchange="updateGameId(${index}, this.value)"
                           style="width: 100%; box-sizing: border-box; font-family: monospace;">
                    </div>
                    <a href="https://www.chess.com/analysis/game/live/${game.gameId}" target="_blank" class="btn-secondary" style="padding: 4px 8px;" title="Otevřít na Chess.com">
                        <i class="fa-solid fa-external-link-alt"></i>
                    </a>
                </div>
            </div>
        </div>
    `).join('');

    list.innerHTML = items;

    // Attach drag listeners (assuming handled by common initDragAndDrop if preserved, or we move it here)
    // The previous initDragAndDrop was global. We should probably move it here too if it's specific to this list.
    initDragAndDrop();
}

function addGame() {
    games.push({
        title: '',
        gameId: '',
        src: '',
        team: 'A tým' // default
    });
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

function updateGameId(index, newId) {
    games[index].gameId = newId;
    games[index].src = `https://www.chess.com/emboard?id=${newId}`;
    updatePreview();
}

function toggleGameCommented(index, checked) {
    games[index].commented = checked;
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

    // Reorder
    const [movedGame] = games.splice(fromIndex, 1);

    // Simple reorder logic, ignoring legacy "team" grouping for now
    let newIndex = toIndex;
    if (fromIndex < toIndex) newIndex = toIndex; // adjustment handled by splice logic usually? 
    // actually splitting at fromIndex removed 1 item.
    // if from < to, toIndex has shifted down by 1? No.
    // Let's use standard move logic.

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
        galleryImages.push(url);
        renderGallery();
        document.getElementById('galleryImageUrl').value = '';
    }
}

async function addGalleryImages(event) {
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
                galleryImages.push(imageUrl);
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
    const btn = document.getElementById(`rotateGalleryBtn_${index}`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
        const newUrl = await uploadRotatedImage(galleryImages[index]);
        if (newUrl) {
            galleryImages[index] = newUrl;
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
    document.getElementById('galleryPreview').innerHTML = galleryImages.length ? galleryImages.map((img, i) => `
        <div style="position: relative;">
            <img src="${img}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px;">
            <button onclick="removeGalleryImage(${i})" style="position: absolute; top: -5px; right: -5px; background: #dc2626; border: none; color: white; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center;">×</button>
            <button id="rotateGalleryBtn_${i}" onclick="rotateGalleryImage(${i})" style="position: absolute; bottom: -5px; right: -5px; background: rgba(0,0,0,0.7); border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center;" title="Otočit"><i class="fa-solid fa-rotate-right"></i></button>
        </div>
    `).join('') : '<p style="color: var(--text-muted); font-size: 0.85rem;">Žádné obrázky</p>';
}


// ================================
// GALLERY PICKER INTEGRATIONS
// ================================

// These rely on showGalleryPicker being available globally from admin-gallery.js
function selectGalleryForImageModal() {
    if (!window.showGalleryPicker) return;
    showGalleryPicker((url) => {
        document.getElementById('imgUrlInput').value = url;
        document.getElementById('imgPreviewArea').innerHTML = `<img src="${url}" style="max-width:100%; max-height: 300px;">`;
    });
}

function selectGalleryForThumbnail() {
    if (!window.showGalleryPicker) return;
    showGalleryPicker((url) => {
        uploadedImageData = url;
        displayImage(url);
    });
}

function selectGalleryForArticleGallery() {
    if (!window.showGalleryPicker) return;
    showGalleryPicker((url) => {
        galleryImages.push(url);
        renderGallery();
    });
}

// ================================
// EXPORTS
// ================================

window.resetEditor = resetEditor;
window.editNews = editNews;
window.saveNews = saveNews;
window.deleteNews = deleteNews;
window.formatText = formatText;
window.toggleSource = toggleSource;
window.updateContentFromSource = updateContentFromSource;
window.insertHighlight = insertHighlight;
window.insertList = insertList;
window.insertLink = insertLink;
window.insertCollapsibleBlock = insertCollapsibleBlock;
window.insertIntroBlock = insertIntroBlock;
window.insertImage = insertImage;
window.closeImageModal = closeImageModal;
window.handleImageFile = handleImageFile;
window.saveImageInsertion = saveImageInsertion;
window.deleteImage = deleteImage;
window.rotateContentImage = rotateContentImage;
window.handleImageUpload = handleImageUpload;
window.handleImageUrl = handleImageUrl;
window.removeImage = removeImage;
window.updateCropFromSlider = updateCropFromSlider;
window.rotateImage = rotateImage;
window.renderGames = renderGames;
window.addGame = addGame;
window.removeGame = removeGame;
window.updateGameTitle = updateGameTitle;
window.updateGameId = updateGameId;
window.toggleGameCommented = toggleGameCommented;
window.toggleGalleryUrlInput = toggleGalleryUrlInput;
window.addGalleryFromUrl = addGalleryFromUrl;
window.addGalleryImages = addGalleryImages;
window.removeGalleryImage = removeGalleryImage;
window.rotateGalleryImage = rotateGalleryImage;
window.selectGalleryForImageModal = selectGalleryForImageModal;
window.selectGalleryForThumbnail = selectGalleryForThumbnail;
window.selectGalleryForArticleGallery = selectGalleryForArticleGallery;
window.updatePreview = updatePreview;
window.checkDraft = checkDraft;
