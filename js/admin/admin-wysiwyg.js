/**
 * Admin WYSIWYG Module
 * Contains: Text formatting, toolbar state, highlights, headings, links, collapsibles
 * Extracted from admin-news.js for better modularity
 * 
 * Dependencies: updatePreview() from admin-news.js
 */

// ================================
// WYSIWYG & EDITOR HELPERS
// ================================

function formatText(command) {
    document.execCommand(command, false, null);
    document.getElementById('articleContent').focus();
    checkToolbarState();
}

/**
 * Remove all formatting from selected text
 * Strips HTML tags, removes highlight spans, and converts headings to plain text
 */
function removeFormatting() {
    const selection = window.getSelection();
    const editor = document.getElementById('articleContent');

    if (!selection.rangeCount || selection.isCollapsed) {
        // No selection - use execCommand to remove formatting at cursor
        document.execCommand('removeFormat', false, null);
        // Also try to convert heading to paragraph
        document.execCommand('formatBlock', false, 'p');
        showToast('Formátování odstraněno', 'success');
        return;
    }

    const range = selection.getRangeAt(0);

    // First, find and remove all highlight spans within selection
    const spansToRemove = [];

    // Get all highlight spans in editor
    const allSpans = editor.querySelectorAll('.highlight-name, .highlight-score');

    allSpans.forEach(span => {
        // Check if span is within selection range
        if (range.intersectsNode(span)) {
            spansToRemove.push(span);
        }
    });

    // Remove all found highlight spans (unwrap them)
    spansToRemove.forEach(span => {
        const textContent = span.textContent;
        const textNode = document.createTextNode(textContent);
        span.parentNode.replaceChild(textNode, span);
    });

    // Check for headings
    const container = range.commonAncestorContainer;
    let el = container.nodeType === 3 ? container.parentNode : container;
    let headingEl = null;

    while (el && el !== editor) {
        if (el.tagName && /^H[1-6]$/.test(el.tagName)) {
            headingEl = el;
            break;
        }
        el = el.parentNode;
    }

    if (headingEl) {
        // Convert heading to paragraph
        const p = document.createElement('p');
        p.innerHTML = headingEl.innerHTML;
        headingEl.parentNode.replaceChild(p, headingEl);
    }

    // Also apply browser's removeFormat for standard formatting (bold, italic, etc)
    document.execCommand('removeFormat', false, null);

    editor.focus();
    checkToolbarState();
    updatePreview();

    const count = spansToRemove.length + (headingEl ? 1 : 0);
    showToast(`Formátování odstraněno${count > 0 ? ` (${count} prvků)` : ''}`, 'success');
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
                <h3 contenteditable="true" style="cursor: text; user-select: text;"></h3>
                <i id="${iconId}" class="fa-solid fa-chevron-down"></i>
            </div>
            <div id="${id}" class="collapsible-content hidden" contenteditable="true" style="cursor: text; user-select: text;">
                <p></p>
            </div>
        </div>
        <p><br></p>
    `;

    document.execCommand('insertHTML', false, html);

    // Focus on the header so user can start typing immediately
    setTimeout(() => {
        const headers = document.querySelectorAll('.collapsible-wrapper h3[contenteditable="true"]');
        const lastHeader = headers[headers.length - 1];
        if (lastHeader) {
            lastHeader.focus();
            // Place cursor inside
            const range = document.createRange();
            range.selectNodeContents(lastHeader);
            range.collapse(true);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }, 10);
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

    // If cursor is inside a puzzle-section, move cursor after it
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

    // Insert a clean infobox without placeholder text
    const introHtml = `<div class="puzzle-section">
<p style="font-size: 1.1rem; margin-bottom: 0;"></p>
</div><p><br></p>`;
    document.execCommand('insertHTML', false, introHtml);

    // Focus inside the infobox
    setTimeout(() => {
        const boxes = document.querySelectorAll('.puzzle-section p');
        const lastBox = boxes[boxes.length - 1];
        if (lastBox) {
            lastBox.focus();
            const range = document.createRange();
            range.selectNodeContents(lastBox);
            range.collapse(true);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }, 10);

    content.focus();
    updatePreview();
}

// ================================
// DIAGRAM SELECTOR
// ================================

async function insertDiagram() {
    // Save text selection before opening modal
    const selection = window.getSelection();
    let savedRange = null;
    if (selection.rangeCount > 0) {
        savedRange = selection.getRangeAt(0).cloneRange();
    }

    await window.openDiagramSelector(savedRange);
}

window.openDiagramSelector = async function (savedRange, initialSelection = []) {
    // Fetch available diagrams from API
    let diagrams = [];
    try {
        const token = window.authToken ||
            localStorage.getItem('authToken') ||
            localStorage.getItem('auth_token') ||
            localStorage.getItem('token') ||
            window.auth?.token;
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        document.body.style.cursor = 'wait';

        const response = await fetch(`${window.API_URL}/diagrams`, { headers });
        if (!response.ok) throw new Error('Failed to load diagrams');
        diagrams = await response.json();

    } catch (e) {
        console.error('Error fetching diagrams:', e);
        if (window.modal) {
            await modal.alert('Nepodařilo se načíst seznam diagramů.');
        } else {
            alert('Nepodařilo se načíst seznam diagramů.');
        }
        return;
    } finally {
        document.body.style.cursor = '';
    }

    if (diagrams.length === 0) {
        if (window.modal) await modal.alert('Zatím nejsou uloženy žádné diagramy.');
        else alert('Zatím nejsou uloženy žádné diagramy.');
        return;
    }

    // Show Selector Modal
    showDiagramSelectorModal(diagrams, savedRange, initialSelection);
}

function showDiagramSelectorModal(diagrams, savedRange, initialSelection = []) {
    if (document.getElementById('diagramSelectorModal')) return;

    // Inject Styles
    if (!document.getElementById('diagram-selector-styles')) {
        const style = document.createElement('style');
        style.id = 'diagram-selector-styles';
        style.textContent = `
            .diagram-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                gap: 1rem;
                max-height: 400px;
                overflow-y: auto;
                padding: 0.5rem;
                margin-top: 1rem;
            }
            .diagram-item {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 0.75rem;
                cursor: pointer;
                transition: all 0.2s;
                text-align: center;
            }
            .diagram-item:hover {
                background: rgba(212, 175, 55, 0.15);
                border-color: rgba(212, 175, 55, 0.5);
                transform: translateY(-2px);
            }
            .diagram-item i {
                font-size: 2rem;
                color: #d4af37;
                margin-bottom: 0.5rem;
                display: block;
            }
            .diagram-name {
                font-weight: 600;
                font-size: 0.9rem;
                color: #e0e0e0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .diagram-meta {
                font-size: 0.75rem;
                color: #888;
                margin-top: 0.25rem;
            }
            .diagram-search {
                width: 100%;
                padding: 0.75rem;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                color: white;
                font-size: 1rem;
                box-sizing: border-box;
            }
            .diagram-search:focus {
                outline: none;
                border-color: #d4af37;
            }
            .book-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: rgba(255,255,255,0.2);
                cursor: pointer;
                transition: all 0.2s;
            }
            .book-dot.active {
                background: #d4af37;
                transform: scale(1.2);
            }
            .book-dot:hover {
                background: rgba(212, 175, 55, 0.6);
            }
            .book-prev:hover, .book-next:hover {
                background: rgba(212, 175, 55, 0.3);
                color: #d4af37;
            }
        `;
        document.head.appendChild(style);
    }

    const modalEl = document.createElement('div');
    modalEl.id = 'diagramSelectorModal';
    // Style as fixed overlay
    modalEl.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    modalEl.innerHTML = `
        <div class="modal-overlay" onclick="document.getElementById('diagramSelectorModal').remove()"></div>
        <div class="modal-content" style="max-width: 700px; width: 90%;">
            <h3 style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
                Vybrat diagram
                <button onclick="document.getElementById('diagramSelectorModal').remove()" style="background:none; border:none; color:#888; cursor:pointer; font-size:1.2rem;">
                    <i class="fa-solid fa-times"></i>
                </button>
            </h3>
            
            
            <div style="display: flex; gap: 1rem; margin-bottom: 1rem; align-items: center;">
                <input type="text" class="diagram-search" id="diagramSearch" placeholder="Hledat..." style="flex: 1;" autofocus>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.85rem; color: #aaa; white-space: nowrap;">
                    <input type="checkbox" id="multiSelectMode" style="width: auto;">
                    <i class="fa-solid fa-layer-group"></i> Více najednou
                </label>
            </div>
            
            <div style="display: flex; gap: 1rem; height: 50vh;">
                <!-- Grid Area -->
                <div style="flex: 2; overflow-y: auto; padding-right: 0.5rem; display: flex; flex-direction: column;">
                    <div class="diagram-grid" id="diagramGrid" style="flex: 1;"></div>
                    <div style="margin-top: 1rem;">
                         <span style="font-size: 0.8rem; color: #888;">Nalezeno: <span id="diagramCount">0</span></span>
                    </div>
                </div>

                <!-- Selection Basket -->
                <div id="selectionPanel" style="flex: 1; display: none; flex-direction: column; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 1rem; min-width: 250px;">
                    <!-- Preview Board -->
                    <div id="diagramPreviewContainer" style="width: 220px; height: 220px; margin: 0 auto 1rem auto; background: rgba(0,0,0,0.3); border-radius: 4px; display: flex; align-items: center; justify-content: center; position: relative; border: 1px solid rgba(255,255,255,0.1);">
                        <p style="color: #666; font-size: 0.8rem;">Náhled</p>
                        <div id="previewBoard" style="width: 100%; height: 100%; position: absolute; inset: 0;"></div>
                    </div>

                    <h4 style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #d4af37;">Vybrané diagramy (pořadí)</h4>
                    <div id="selectionList" style="flex: 1; overflow-y: auto; background: rgba(0,0,0,0.2); border-radius: 6px; padding: 0.5rem;">
                        <p style="text-align:center; color:#666; font-size:0.8rem; margin-top:2rem;">Žádné vybrané diagramy</p>
                    </div>
                    <div style="margin-top: 0.5rem; text-align: right;">
                        <button id="insertBookBtn" class="btn-primary" style="padding: 0.5rem 1rem; width: 100%;" disabled>
                            <i class="fa-solid fa-book"></i> Vložit knihu
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);

    const grid = modalEl.querySelector('#diagramGrid');
    const searchInput = modalEl.querySelector('#diagramSearch');
    const countSpan = modalEl.querySelector('#diagramCount');
    const multiSelectCheckbox = modalEl.querySelector('#multiSelectMode');
    const selectionPanel = modalEl.querySelector('#selectionPanel');
    const selectionList = modalEl.querySelector('#selectionList');
    const insertBookBtn = modalEl.querySelector('#insertBookBtn');

    let selectedDiagrams = [...(initialSelection || [])]; // Array of objects, preserving order
    let isMultiSelect = selectedDiagrams.length > 0;

    // Init UI state based on initial selection
    if (isMultiSelect) {
        multiSelectCheckbox.checked = true;
        selectionPanel.style.display = 'flex';
        // Wait for next tick to ensure selectionList is populated? 
        // No, we call renderSelectionList immediately below.
    }
    let previewViewer = null; // DiagramViewer instance

    const updatePreview = (d) => {
        const previewContainer = modalEl.querySelector('#previewBoard');
        if (!previewContainer) return;

        // If DiagramViewer is available (from diagram-viewer.js)
        if (typeof DiagramViewer !== 'undefined') {
            if (!previewViewer) {
                // DiagramViewer expects a container ID. We must ensure it's unique but stable within modal lifespan.
                if (!previewContainer.id) previewContainer.id = 'preview_board_' + Date.now();
                previewViewer = new DiagramViewer(previewContainer.id);
            }
            previewViewer.load(d);
        } else {
            // Fallback if DiagramViewer script missing
            previewContainer.innerHTML = generateMiniBoard(d.fen, 25);
        }
    };

    const renderSelectionList = () => {
        if (selectedDiagrams.length === 0) {
            selectionList.innerHTML = '<p style="text-align:center; color:#666; font-size:0.8rem; margin-top:2rem;">Žádné vybrané diagramy</p>';
            insertBookBtn.disabled = true;
            insertBookBtn.style.opacity = '0.5';
            return;
        }

        selectionList.innerHTML = '';
        insertBookBtn.disabled = selectedDiagrams.length < 1;
        insertBookBtn.style.opacity = '1';

        selectedDiagrams.forEach((d, index) => {
            const row = document.createElement('div');
            // Change layout to column for input
            row.style.cssText = 'display: flex; flex-direction: column; gap: 0.25rem; padding: 0.5rem; background: rgba(255,255,255,0.05); margin-bottom: 6px; border-radius: 4px; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.05);';

            const name = d.name || d.title || `Diagram #${d.id}`;

            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem; width: 100%;">
                    <span style="font-weight: bold; color: #d4af37; width: 20px;">${index + 1}.</span>
                    <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight:500;">${name}</span>
                    <div style="display: flex; gap: 2px;">
                        ${index > 0 ? `<button class="move-up-btn" style="background:none; border:none; color:#aaa; cursor:pointer;" title="Posunout nahoru"><i class="fa-solid fa-arrow-up"></i></button>` : '<span style="width:14px;"></span>'}
                        ${index < selectedDiagrams.length - 1 ? `<button class="move-down-btn" style="background:none; border:none; color:#aaa; cursor:pointer;" title="Posunout dolů"><i class="fa-solid fa-arrow-down"></i></button>` : '<span style="width:14px;"></span>'}
                        <button class="remove-btn" style="background:none; border:none; color:#ef4444; cursor:pointer; margin-left:4px;" title="Odebrat"><i class="fa-solid fa-times"></i></button>
                    </div>
                </div>
                <input type="text" class="desc-input" placeholder="Popisek (např. Bílý na tahu a vyhraje)" value="${d.description || ''}" 
                    style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #ccc; font-size: 0.8rem; padding: 4px 6px; border-radius: 4px;">
            `;

            // Handlers
            const upBtn = row.querySelector('.move-up-btn');
            if (upBtn) upBtn.onclick = (e) => { e.stopPropagation(); moveItem(index, -1); };

            const downBtn = row.querySelector('.move-down-btn');
            if (downBtn) downBtn.onclick = (e) => { e.stopPropagation(); moveItem(index, 1); };

            const removeBtn = row.querySelector('.remove-btn');
            removeBtn.onclick = (e) => { e.stopPropagation(); toggleDiagramSelection(d); };

            const input = row.querySelector('.desc-input');
            input.onclick = (e) => e.stopPropagation();
            input.oninput = (e) => {
                d.description = e.target.value;
            };

            // Preview trigger
            row.onmouseenter = (e) => {
                if (e.target !== input) updatePreview(d);
            };

            selectionList.appendChild(row);
        });
    };

    const moveItem = (index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= selectedDiagrams.length) return;

        const item = selectedDiagrams[index];
        selectedDiagrams.splice(index, 1);
        selectedDiagrams.splice(newIndex, 0, item);
        renderSelectionList();
    };

    const toggleDiagramSelection = (d) => {
        const index = selectedDiagrams.findIndex(item => item.id === d.id);
        if (index >= 0) {
            selectedDiagrams.splice(index, 1);
        } else {
            selectedDiagrams.push(d);
        }
        renderSelectionList();
        renderList(searchInput.value); // Update grid visual
    };

    const renderList = (filter = '') => {
        grid.innerHTML = '';
        const lowerFilter = filter.toLowerCase();

        const filtered = diagrams.filter(d =>
            (d.name || '').toLowerCase().includes(lowerFilter) ||
            (d.title || '').toLowerCase().includes(lowerFilter) ||
            String(d.id).includes(lowerFilter)
        );

        countSpan.textContent = filtered.length;

        if (filtered.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #888;">Žádné diagramy nenalezeny.</div>';
            return;
        }

        filtered.forEach(d => {
            const el = document.createElement('div');
            const isSelected = selectedDiagrams.some(item => item.id === d.id);

            el.className = 'diagram-item';
            el.dataset.id = d.id;

            if (isSelected) {
                el.style.border = '2px solid #d4af37';
                el.style.background = 'rgba(212, 175, 55, 0.15)';
            }

            const miniPreview = generateMiniBoard(d.fen, 18);
            const checkbox = isMultiSelect
                ? `<input type="checkbox" class="diagram-checkbox" ${isSelected ? 'checked' : ''} style="position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; cursor: pointer;">`
                : '';

            const hasSolution = d.solution && Object.keys(d.solution).length > 0;
            const typeBadge = hasSolution
                ? '<span style="display:inline-block;background:#22c55e;color:#000;font-size:0.65rem;padding:2px 6px;border-radius:4px;margin-left:4px;">Hádanka</span>'
                : '<span style="display:inline-block;background:#3b82f6;color:#fff;font-size:0.65rem;padding:2px 6px;border-radius:4px;margin-left:4px;">Diagram</span>';

            // Check for annotations badge
            const hasAnnotations = (d.annotations && (d.annotations.arrows?.length > 0 || d.annotations.squares?.length > 0 || d.annotations.badges?.length > 0));
            const annotBadge = hasAnnotations ? '<span title="Obsahuje grafické značky" style="margin-left:4px; color:#fbbf24;"><i class="fa-solid fa-pen-nib"></i></span>' : '';

            const displayName = d.name || d.title || `Diagram #${d.id}`;

            el.innerHTML = `
                ${checkbox}
                ${miniPreview}
                <div class="diagram-name" title="${displayName}">${displayName} ${typeBadge} ${annotBadge}</div>
                <div class="diagram-meta">${d.toMove === 'w' ? '⬜ Bílý' : '⬛ Černý'}</div>
            `;
            el.style.position = 'relative';

            // Preview trigger
            el.onmouseenter = () => updatePreview(d);

            el.onclick = (e) => {
                if (isMultiSelect) {
                    toggleDiagramSelection(d);
                } else {
                    insertDiagramToEditor(d, savedRange);
                    modalEl.remove();
                }
            };
            grid.appendChild(el);
        });
    };

    // Multi-select mode toggle
    multiSelectCheckbox.onchange = () => {
        isMultiSelect = multiSelectCheckbox.checked;
        selectionPanel.style.display = isMultiSelect ? 'flex' : 'none';

        // Don't auto-clear on toggle off? Maybe useful to keep draft.
        // But original logic cleared it.
        if (!isMultiSelect) {
            selectedDiagrams = [];
            renderSelectionList();
        }

        // Hide/Show selection basket logic done via display prop above
        // Resize Grid logic? Grid is flex 2, panel flex 1. Flexbox handles it.
        renderList(searchInput.value);
    };

    // Insert as book button
    insertBookBtn.onclick = () => {
        if (selectedDiagrams.length >= 1) {
            insertDiagramBookToEditor(selectedDiagrams, savedRange); // Pass sorted array
            modalEl.remove();
        }
    };

    // Init
    if (selectedDiagrams.length > 0) {
        renderSelectionList();
        updateSelectionUI();
    }
    renderList();
    searchInput.oninput = (e) => renderList(e.target.value);

    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape' && document.getElementById('diagramSelectorModal')) {
            modalEl.remove();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

function insertDiagramBookToEditor(diagrams, savedRange) {
    if (savedRange) {
        if (savedRange instanceof Element) {
            // If target is an element (editing mode), select it to replace
            const range = document.createRange();
            range.selectNode(savedRange);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            // Restore saved range
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
        }
    } else {
        document.getElementById('articleContent')?.focus();
    }

    if (!diagrams || diagrams.length === 0) return;

    const bookId = 'book_' + Date.now();
    const diagramsJson = JSON.stringify(diagrams.map(d => ({
        id: d.id,
        fen: d.fen,
        title: d.title, // Keep title for book header
        name: d.name, // Keep name as fallback
        toMove: d.toMove,
        annotations: d.annotations,
        solution: d.solution,
        description: d.description
    })));

    // Generate the first board as preview
    const firstBoard = generateMiniBoard(diagrams[0].fen, 30);

    // Generate page dots
    const dots = diagrams.map((_, i) =>
        `<span class="book-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`
    ).join('');

    // Determine if first diagram is a puzzle
    const hasSolution = diagrams[0].solution && Object.keys(diagrams[0].solution).length > 0;
    const puzzleBadge = hasSolution
        ? `<div class="diagram-type-badge" style="
            position: absolute;
            top: -12px;
            right: -20px;
            background: linear-gradient(135deg, rgba(30,30,30,0.95), rgba(50,50,50,0.9));
            backdrop-filter: blur(12px);
            border: 1px solid rgba(212, 175, 55, 0.4);
            border-radius: 8px;
            padding: 5px 10px;
            font-size: 0.8rem;
            color: #d4af37;
            z-index: 100;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5), 0 0 20px rgba(212, 175, 55, 0.15);
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        "><i class="fa-solid fa-puzzle-piece"></i></div>`
        : '';

    const html = `<p><br></p>
        <div class="diagram-book" id="${bookId}" data-diagrams='${diagramsJson}' data-current="0" style="
            float: right;
            clear: right;
            background: linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98));
            border-radius: 16px;
            padding: 1.25rem;
            box-shadow: 0 10px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.08);
            max-width: 400px;
            margin: 1rem 0 1rem 1.5rem;
            overflow: visible;
        ">
            <!-- Board Container -->
            <div class="book-board-container" style="position: relative; margin: 0 auto; overflow: visible; width: 100%; aspect-ratio: 1/1;">
                ${puzzleBadge}
                ${firstBoard}
            </div>
            
            <!-- Description -->
            <div class="book-description" style="
                font-size: 0.9rem;
                color: #e2e8f0;
                margin-top: 1rem;
                text-align: center;
                min-height: 1.2em;
                line-height: 1.4;
            ">${diagrams[0].description || diagrams[0].name || ''}</div>

            <!-- Navigation -->
            <div class="book-nav" style="display: ${diagrams.length > 1 ? 'flex' : 'none'}; justify-content: center; align-items: center; gap: 1rem; margin-top: 0.5rem;">
                <button class="book-prev" onclick="bookNav('${bookId}', -1)" style="
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: #888;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: all 0.2s;
                "><i class="fa-solid fa-chevron-left"></i></button>
                <div class="book-meta-row">
                    <span class="book-to-move">${(diagrams[0].toMove || (diagrams[0].fen ? diagrams[0].fen.split(' ')[1] : 'w')).startsWith('w') ? 'Bílý na tahu' : 'Černý na tahu'}</span>
                    <span style="opacity:0.3">|</span>
                    <span class="book-counter">1 / ${diagrams.length}</span>
                </div>
                <button class="book-next" onclick="bookNav('${bookId}', 1)" style="
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: #888;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: all 0.2s;
                1 / ${diagrams.length}
            </div>
            
            <!-- Editable Caption -->
            <div class="book-caption" contenteditable="true" style="
                font-size: 0.85rem;
                color: rgba(255,255,255,0.6);
                margin-top: 0.75rem;
                padding: 0.5rem;
                background: rgba(0,0,0,0.2);
                border-radius: 6px;
                min-height: 1.5em;
                text-align: center;
            " data-placeholder="Popis..."></div>
        </div><p><br></p>`;

    // If we are editing (savedRange is an Element), use DOM replacement to avoid nesting bugs
    if (savedRange instanceof Element) {
        // Extract just the book DIV from the full HTML (which contains P wrappers)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const bookDiv = tempDiv.querySelector('.diagram-book');

        if (bookDiv) {
            // Clean replace showing only the book content, no wrappers
            savedRange.outerHTML = bookDiv.outerHTML;
        } else {
            // Fallback if parsing fails
            savedRange.outerHTML = html;
        }
    } else {
        // Standard insertion for new items
        if (savedRange && savedRange instanceof Range) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
        } else {
            document.getElementById('articleContent')?.focus();
        }
        document.execCommand('insertHTML', false, html);
    }

    updatePreview();
}

// Global book navigation function (for onclick handlers in content)
window.bookNav = function (bookId, direction) {
    const book = document.getElementById(bookId);
    if (!book) return;

    const diagrams = JSON.parse(book.dataset.diagrams);
    let current = parseInt(book.dataset.current) || 0;

    current += direction;
    if (current < 0) current = diagrams.length - 1;
    if (current >= diagrams.length) current = 0;

    book.dataset.current = current;

    const d = diagrams[current];

    // Use DiagramViewer if available to show annotations (arrows)
    if (typeof DiagramViewer !== 'undefined') {
        const boardContainer = book.querySelector('.book-board-container');
        if (!boardContainer.id) boardContainer.id = 'board-container-' + bookId;

        const viewer = new DiagramViewer(boardContainer.id);
        viewer.load(d);
    } else {
        // Fallback
        const boardHtml = window.generateMiniBoardGlobal ? window.generateMiniBoardGlobal(d.fen, 30) : '';
        book.querySelector('.book-board-container').innerHTML = boardHtml;
    }

    const toMove = d.toMove || (d.fen ? d.fen.split(' ')[1] : 'w');
    const toMoveText = (toMove === 'w' || toMove === 'white') ? 'Bílý na tahu' : 'Černý na tahu';
    book.querySelector('.book-to-move').textContent = toMoveText;

    book.querySelector('.book-counter').textContent = `${current + 1} / ${diagrams.length}`;

    // Update description if present
    const descriptionEl = book.querySelector('.book-description');
    if (descriptionEl) descriptionEl.textContent = d.description || d.name || '';

    // Update dots
    book.querySelectorAll('.book-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === current);
    });
};

function insertDiagramToEditor(diagram, savedRange) {
    // For single diagram, we reuse the robust Book logic but with a single item array
    insertDiagramBookToEditor([diagram], savedRange);
}

function generateMiniBoard(fen, squareSize = 25) {
    if (!fen) return `<div style="width:${squareSize * 8}px;height:${squareSize * 8}px;background:#b58863;margin:0 auto;border-radius:4px;"></div>`;

    const position = fen.split(' ')[0];
    const rows = position.split('/');

    let html = '<table style="border-collapse: collapse; margin: 0 auto; border: 1px solid #555; border-radius: 2px; overflow: hidden;">';

    for (let i = 0; i < 8; i++) {
        html += '<tr>';
        const row = rows[i] || '8';
        let colIdx = 0;

        for (const char of row) {
            if (/\d/.test(char)) {
                const emptyCount = parseInt(char);
                for (let k = 0; k < emptyCount; k++) {
                    const isLight = (i + colIdx) % 2 === 0;
                    const bg = isLight ? '#f0d9b5' : '#b58863';
                    html += `<td style="width:${squareSize}px;height:${squareSize}px;background:${bg};"></td>`;
                    colIdx++;
                }
            } else {
                const isLight = (i + colIdx) % 2 === 0;
                const bg = isLight ? '#f0d9b5' : '#b58863';
                const color = char === char.toLowerCase() ? 'b' : 'w';
                const piece = char.toUpperCase();
                const pieceUrl = `https://chessboardjs.com/img/chesspieces/wikipedia/${color}${piece}.png`;

                html += `<td style="width:${squareSize}px;height:${squareSize}px;background:${bg};padding:0;">
                    <img src="${pieceUrl}" style="width:100%;height:100%;display:block;">
                </td>`;
                colIdx++;
            }
        }
        html += '</tr>';
    }
    html += '</table>';
    return html;
}

// ================================
// FLOATING TOOLBAR
// ================================

let floatingToolbar = null;

function initFloatingToolbar() {
    if (document.getElementById('floatingToolbar')) return;

    floatingToolbar = document.createElement('div');
    floatingToolbar.id = 'floatingToolbar';
    floatingToolbar.className = 'floating-toolbar';

    // Define buttons
    const buttons = [
        { icon: 'fa-bold', action: () => formatText('bold'), title: 'Tučně' },
        { icon: 'fa-italic', action: () => formatText('italic'), title: 'Kurzíva' },
        { divider: true },
        { icon: 'fa-heading', action: () => applyHeading('h2'), title: 'Nadpis 2' },
        { icon: 'fa-link', action: () => insertLink(), title: 'Odkaz' },
        { divider: true },
        { icon: 'fa-user', action: () => insertHighlight('name'), title: 'Jméno' },
        { icon: 'fa-trophy', action: () => insertHighlight('score'), title: 'Skóre' }
    ];

    buttons.forEach(btn => {
        if (btn.divider) {
            const div = document.createElement('div');
            div.className = 'floating-divider';
            floatingToolbar.appendChild(div);
        } else {
            const button = document.createElement('button');
            button.className = 'floating-btn';
            button.innerHTML = `<i class="fa-solid ${btn.icon}"></i>`;
            button.title = btn.title;
            // Prevent toolbar from stealing focus (mouseDown defaults to focus)
            button.onmousedown = (e) => {
                e.preventDefault(); // Critical!
                btn.action();
            };
            floatingToolbar.appendChild(button);
        }
    });

    document.body.appendChild(floatingToolbar);

    // Listeners
    document.addEventListener('selectionchange', updateFloatingToolbar);
    // Also update on scroll to keep position correct
    document.addEventListener('scroll', updateFloatingToolbar, true);

    // Hide when clicking outside editor
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('#articleContent') && !e.target.closest('#floatingToolbar')) {
            hideFloatingToolbar();
        }
    });
}

function updateFloatingToolbar() {
    if (!floatingToolbar) return initFloatingToolbar();

    const selection = window.getSelection();
    const editor = document.getElementById('articleContent');

    // Valid selection check
    if (!selection.rangeCount || selection.isCollapsed || !editor.contains(selection.anchorNode)) {
        hideFloatingToolbar();
        return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
        hideFloatingToolbar();
        return;
    }

    // Show toolbar
    floatingToolbar.classList.add('visible');

    // Calculate position (centered above selection)
    // Toolbar height approx 40px, width dynamic
    const toolbarRect = floatingToolbar.getBoundingClientRect();

    let top = rect.top - toolbarRect.height - 8; // 8px buffer
    let left = rect.left + (rect.width / 2) - (toolbarRect.width / 2);

    // Bounds checking (keep within viewport)
    if (top < 0) top = rect.bottom + 8; // Flip to bottom if no space top
    if (left < 10) left = 10;
    if (left + toolbarRect.width > window.innerWidth - 10) left = window.innerWidth - toolbarRect.width - 10;

    floatingToolbar.style.top = `${top}px`;
    floatingToolbar.style.left = `${left}px`;
}

function hideFloatingToolbar() {
    if (floatingToolbar) {
        floatingToolbar.classList.remove('visible');
    }
}

// ================================
// AUTO-FORMATTING (Results & Names)
// ================================

/**
 * Patterns for auto-detection and formatting
 */
const AUTO_FORMAT_PATTERNS = {
    // Chess results: 1-0, 0-1, ½-½, 1/2-1/2, 0.5-0.5
    results: /\b(1-0|0-1|½-½|1\/2-1\/2|0\.5-0\.5|remis|remíza)\b/gi,

    // Score-like patterns: "3:2", "5,5 : 4,5"
    scores: /\b(\d+[.,]?\d*)\s*[:\-]\s*(\d+[.,]?\d*)\b/g,

    // Common Czech chess names (can be expanded)
    // Format: "Příjmení, J." or "J. Příjmení" - detected by capital letters
    names: /\b([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+),?\s+([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])\./g
};

/**
 * Auto-format selected text or scan content for patterns
 */
function autoFormatSelection() {
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
        showToast('Nejdříve vyberte text k formátování', 'error');
        return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString();

    // Check for result pattern
    if (AUTO_FORMAT_PATTERNS.results.test(selectedText)) {
        // Wrap in score highlight
        wrapSelectionWithClass('highlight-score');
        showToast('Výsledek naformátován ✓', 'success');
        return;
    }

    // Check for score pattern
    if (AUTO_FORMAT_PATTERNS.scores.test(selectedText)) {
        wrapSelectionWithClass('highlight-score');
        showToast('Skóre naformátováno ✓', 'success');
        return;
    }

    // Check for name pattern or just assume it's a name
    if (AUTO_FORMAT_PATTERNS.names.test(selectedText) || /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(selectedText)) {
        wrapSelectionWithClass('highlight-name');
        showToast('Jméno naformátováno ✓', 'success');
        return;
    }

    // Default: ask what to format as
    showFormatChoiceModal(range);
}

/**
 * Wrap current selection with a CSS class
 */
function wrapSelectionWithClass(className) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.className = className;

    try {
        span.appendChild(range.extractContents());
        range.insertNode(span);

        // Move cursor after span
        const newRange = document.createRange();
        newRange.setStartAfter(span);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
    } catch (e) {
        console.error('wrapSelectionWithClass error:', e);
    }

    updatePreview();
}

/**
 * Quick format choice modal
 */
function showFormatChoiceModal(range) {
    const modal = document.createElement('div');
    modal.id = 'formatChoiceModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.7); z-index: 10100;
        display: flex; align-items: center; justify-content: center;
    `;
    modal.innerHTML = `
        <div style="background: #1a1a2e; border-radius: 12px; padding: 1.5rem; max-width: 300px; text-align: center;">
            <h4 style="margin-bottom: 1rem; color: #f1f5f9;">Formátovat jako:</h4>
            <div style="display: flex; gap: 0.75rem; justify-content: center;">
                <button id="fmtName" class="btn-primary" style="flex: 1;">
                    <i class="fa-solid fa-user"></i> Jméno
                </button>
                <button id="fmtScore" class="btn-primary" style="flex: 1; background: #22c55e;">
                    <i class="fa-solid fa-star"></i> Skóre
                </button>
            </div>
            <button id="fmtCancel" class="btn-secondary" style="margin-top: 1rem; width: 100%;">Zrušit</button>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#fmtName').onclick = () => {
        modal.remove();
        wrapSelectionWithClass('highlight-name');
    };

    modal.querySelector('#fmtScore').onclick = () => {
        modal.remove();
        wrapSelectionWithClass('highlight-score');
    };

    modal.querySelector('#fmtCancel').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

/**
 * Scan entire content and auto-format detected patterns
 * Detects: Results (1-0, 0-1, ½-½) and potential player names (Příjmení, J.)
 */
function autoFormatEntireContent() {
    const editor = document.getElementById('articleContent');
    if (!editor) return;

    let html = editor.innerHTML;
    let scoreChanges = 0;
    let nameChanges = 0;

    // 1. Format chess results (only if not already wrapped in a span)
    // Patterns: 1-0, 0-1, ½-½, 1/2-1/2, remíza
    const resultPatterns = [
        /(?<!<span[^>]*>)\b(1-0)\b(?![^<]*<\/span>)/g,
        /(?<!<span[^>]*>)\b(0-1)\b(?![^<]*<\/span>)/g,
        /(?<!<span[^>]*>)(½-½|½ - ½)(?![^<]*<\/span>)/g,
        /(?<!<span[^>]*>)\b(1\/2-1\/2|1\/2 - 1\/2)\b(?![^<]*<\/span>)/g,
        /(?<!<span[^>]*>)\b(remíza|remis)\b(?![^<]*<\/span>)/gi
    ];

    resultPatterns.forEach(pattern => {
        html = html.replace(pattern, (match) => {
            scoreChanges++;
            // Convert 1/2-1/2 to nice ½-½
            const display = match.includes('1/2') ? '½-½' : match;
            // Add zero-width space after for cursor positioning
            return `<span class="highlight-score">${display}</span>\u200B`;
        });
    });

    // 2. Format player names: Two words with first capital letter = name
    // Examples: "Petr Novák", "Jan Kowalski", "Marie Dvořáková"
    // Pattern: Word starting with uppercase + space + Word starting with uppercase
    const namePattern = /(?<!<span[^>]*>)\b([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+)\s+([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+)\b(?![^<]*<\/span>)/g;

    html = html.replace(namePattern, (match, firstName, lastName) => {
        nameChanges++;
        // Add zero-width space after for cursor positioning
        return `<span class="highlight-name">${firstName} ${lastName}</span>\u200B`;
    });

    // 3. Format team match scores like "5,5 : 2,5" or "4:4"
    const teamScorePattern = /(?<!<span[^>]*>)\b(\d+[,.]?\d*)\s*:\s*(\d+[,.]?\d*)\b(?![^<]*<\/span>)/g;

    html = html.replace(teamScorePattern, (match, score1, score2) => {
        scoreChanges++;
        // Add zero-width space after for cursor positioning
        return `<span class="highlight-score">${score1} : ${score2}</span>\u200B`;
    });

    // 4. Format fraction-style scores like "3/5", "4,5/6", "2.5/5"
    // This pattern matches: number (with optional decimal) / number
    const fractionScorePattern = /(?<!<span[^>]*>)\b(\d+[,.]?\d*)\/(\d+[,.]?\d*)\b(?![^<]*<\/span>)/g;

    html = html.replace(fractionScorePattern, (match, score1, score2) => {
        scoreChanges++;
        // Add zero-width space after for cursor positioning
        return `<span class="highlight-score">${score1}/${score2}</span>\u200B`;
    });

    const totalChanges = scoreChanges + nameChanges;

    if (totalChanges > 0) {
        editor.innerHTML = html;
        updatePreview();

        const message = [];
        if (scoreChanges > 0) message.push(`${scoreChanges} výsledků`);
        if (nameChanges > 0) message.push(`${nameChanges} jmen`);

        showToast(`✨ Naformátováno: ${message.join(', ')}`, 'success');
    } else {
        showToast('Žádné vzory k formátování nenalezeny', 'info');
    }
}

/**
 * Insert result template at cursor
 */
function insertResultTemplate() {
    const editor = document.getElementById('articleContent');
    const selection = window.getSelection();

    const template = document.createElement('span');
    template.innerHTML = `<span class="highlight-name">Bílý</span> – <span class="highlight-name">Černý</span> <span class="highlight-score">1-0</span>`;

    if (selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.insertNode(template);

        // Move cursor after
        const newRange = document.createRange();
        newRange.setStartAfter(template);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    editor.focus();
    updatePreview();
}

// ================================
// AUTO-SUGGEST (Inline Predictions)
// ================================

let autoSuggestTooltip = null;
let lastSuggestPattern = null;

const RESULT_SUGGESTIONS = {
    '1-0': { display: '1-0', formatted: '<span class="highlight-score">1-0</span>' },
    '0-1': { display: '0-1', formatted: '<span class="highlight-score">0-1</span>' },
    '1/2': { display: '½-½', formatted: '<span class="highlight-score">½-½</span>' },
    '0.5': { display: '½-½', formatted: '<span class="highlight-score">½-½</span>' },
    'remis': { display: '½-½ (remíza)', formatted: '<span class="highlight-score">½-½</span>' },
    'remíza': { display: '½-½ (remíza)', formatted: '<span class="highlight-score">½-½</span>' }
};

function createAutoSuggestTooltip() {
    if (autoSuggestTooltip) return autoSuggestTooltip;

    const tooltip = document.createElement('div');
    tooltip.id = 'autoSuggestTooltip';
    tooltip.className = 'auto-suggest-tooltip';
    tooltip.innerHTML = `
        <span class="suggest-text"></span>
        <span class="suggest-hint">Klikni nebo Tab</span>
    `;
    tooltip.style.cssText = `
        position: absolute;
        z-index: 10200;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: 1px solid rgba(212, 175, 55, 0.3);
        border-radius: 8px;
        padding: 0.5rem 0.75rem;
        display: none;
        align-items: center;
        gap: 0.75rem;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
        font-size: 0.9rem;
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
    `;

    // Click/tap to accept suggestion (works on mobile!)
    tooltip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        acceptAutoSuggest();
    });

    // Touch support
    tooltip.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        acceptAutoSuggest();
    });

    document.body.appendChild(tooltip);
    autoSuggestTooltip = tooltip;
    return tooltip;
}

function showAutoSuggest(pattern, replacement, range) {
    const tooltip = createAutoSuggestTooltip();

    tooltip.querySelector('.suggest-text').innerHTML = `
        <span style="color: var(--text-muted);">${pattern}</span>
        <span style="margin: 0 0.5rem;">→</span>
        <span style="color: #d4af37; font-weight: 600;">${replacement.display}</span>
    `;
    tooltip.querySelector('.suggest-hint').style.cssText = `
        background: rgba(212, 175, 55, 0.15);
        color: #d4af37;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
    `;

    // Position near cursor
    const rect = range.getBoundingClientRect();
    tooltip.style.display = 'flex';
    tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;

    lastSuggestPattern = { pattern, replacement, range };
}

function hideAutoSuggest() {
    if (autoSuggestTooltip) {
        autoSuggestTooltip.style.display = 'none';
    }
    lastSuggestPattern = null;
}

function acceptAutoSuggest() {
    if (!lastSuggestPattern) return false;

    const { pattern, replacement, range } = lastSuggestPattern;
    const selection = window.getSelection();
    const node = range.startContainer;
    const editor = document.getElementById('articleContent');

    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        const patternIndex = text.lastIndexOf(pattern);

        if (patternIndex !== -1) {
            // Split text node
            const before = text.substring(0, patternIndex);
            const after = text.substring(patternIndex + pattern.length);

            // Create formatted span
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = replacement.formatted;
            const formattedSpan = tempDiv.firstChild;

            // Replace content
            node.textContent = before;

            // Create text node with zero-width space (invisible) + remaining text
            // Zero-width space ensures cursor can be positioned outside the span
            const afterNode = document.createTextNode('\u200B' + after); // Zero-width space + rest

            if (node.nextSibling) {
                node.parentNode.insertBefore(formattedSpan, node.nextSibling);
                node.parentNode.insertBefore(afterNode, formattedSpan.nextSibling);
            } else {
                node.parentNode.appendChild(formattedSpan);
                node.parentNode.appendChild(afterNode);
            }

            // Move cursor right after zero-width space (position 1)
            const newRange = document.createRange();
            newRange.setStart(afterNode, 1); // After the zero-width space
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);

            // Focus editor to ensure cursor is visible
            editor.focus();

            hideAutoSuggest();
            updatePreview();

            return true;
        }
    }

    hideAutoSuggest();
    return false;
}

function checkForAutoSuggest(e) {
    const editor = document.getElementById('articleContent');
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;

    if (node.nodeType !== Node.TEXT_NODE) {
        hideAutoSuggest();
        return;
    }

    const text = node.textContent;
    const cursorPos = range.startOffset;
    const textBeforeCursor = text.substring(0, cursorPos);

    // Debug log (remove after testing)
    // console.log('[auto-suggest] Text before cursor:', JSON.stringify(textBeforeCursor));

    // Check for result patterns
    for (const [pattern, replacement] of Object.entries(RESULT_SUGGESTIONS)) {
        // Use case-insensitive match for text patterns like 'remis'
        const lowerText = textBeforeCursor.toLowerCase();
        const lowerPattern = pattern.toLowerCase();

        if (textBeforeCursor.endsWith(pattern) || lowerText.endsWith(lowerPattern)) {
            // Check if already inside a highlight span
            let parent = node.parentNode;
            while (parent && parent !== editor) {
                if (parent.classList && (parent.classList.contains('highlight-score') || parent.classList.contains('highlight-name'))) {
                    hideAutoSuggest();
                    return;
                }
                parent = parent.parentNode;
            }

            console.log('[auto-suggest] Match found:', pattern);
            showAutoSuggest(pattern, replacement, range);
            return;
        }
    }

    hideAutoSuggest();
}

function handleAutoSuggestKeydown(e) {
    if (!lastSuggestPattern) return;

    if (e.key === 'Tab' || e.key === 'Enter') {
        if (acceptAutoSuggest()) {
            e.preventDefault();
        }
    } else if (e.key === 'Escape') {
        hideAutoSuggest();
    }
}

// Initialize auto-suggest on editor
function initAutoSuggest() {
    const editor = document.getElementById('articleContent');
    if (!editor) return;

    editor.addEventListener('input', checkForAutoSuggest);
    editor.addEventListener('keydown', handleAutoSuggestKeydown);

    // Hide on blur
    editor.addEventListener('blur', () => {
        setTimeout(hideAutoSuggest, 200);
    });

    console.log('[wysiwyg] Auto-suggest initialized');
}

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initAutoSuggest, 300);
});

// ================================
// AI FEATURES
// ================================

/**
 * AI Spell Check - Send content to AI for correction
 */
async function aiSpellCheck() {
    const editor = document.getElementById('articleContent');
    if (!editor) return;

    const content = editor.innerHTML;
    if (!content.trim()) {
        showToast('Nejdříve napište nějaký text', 'error');
        return;
    }

    // Show loading state
    const btn = document.querySelector('[onclick="aiSpellCheck()"]');
    const originalHtml = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;
    }

    try {
        const token = window.authToken || localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/ai/spellcheck`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text: content })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Chyba při kontrole pravopisu', 'error');
            return;
        }

        if (data.changed) {
            editor.innerHTML = data.corrected;
            updatePreview();
            showToast('✨ Text opraven AI', 'success');
        } else {
            showToast('✓ Text je v pořádku', 'success');
        }

    } catch (error) {
        console.error('[AI] Spell check error:', error);
        showToast('Nepodařilo se spojit s AI', 'error');
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
}

/**
 * AI Text to Table - Convert selected text to HTML table
 */
async function aiTextToTable() {
    const selection = window.getSelection();
    const editor = document.getElementById('articleContent');

    if (!selection.rangeCount || selection.isCollapsed) {
        showToast('Nejdříve vyberte text k převodu na tabulku', 'error');
        return;
    }

    const selectedText = selection.toString();
    if (!selectedText.trim()) {
        showToast('Vyberte text obsahující data', 'error');
        return;
    }

    // Show loading state
    const btn = document.querySelector('[onclick="aiTextToTable()"]');
    const originalHtml = btn?.innerHTML;
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;
    }

    try {
        const token = window.authToken || localStorage.getItem('auth_token');
        const response = await fetch(`${API_URL}/ai/text-to-table`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text: selectedText })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || 'Chyba při generování tabulky', 'error');
            return;
        }

        if (data.isTable) {
            // Replace selection with table
            const range = selection.getRangeAt(0);
            range.deleteContents();

            const temp = document.createElement('div');

            // Clean markdown wrappers if present
            let tableHtml = data.table;
            tableHtml = tableHtml.replace(/```html/g, '').replace(/```/g, '').trim();

            temp.innerHTML = tableHtml;
            range.insertNode(temp.firstChild);

            updatePreview();
            showToast('✨ Tabulka vytvořena', 'success');
        } else {
            showToast('Text neobsahuje tabulková data', 'info');
        }

    } catch (error) {
        console.error('[AI] Text-to-table error:', error);
        showToast('Nepodařilo se spojit s AI', 'error');
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
}

/**
 * Check if AI is available
 */
async function checkAIStatus() {
    try {
        const response = await fetch(`${API_URL}/ai/status`);
        const data = await response.json();
        return data.enabled;
    } catch {
        return false;
    }
}

// ================================
// TABLE MANAGEMENT
// ================================

/**
 * Style the currently selected or closest table with premium design
 */
function styleSelectedTable() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === 3 ? container.parentNode : container;
    const table = element.closest('table');

    if (table) {
        // Clean existing styles and attributes
        table.removeAttribute('style');
        table.removeAttribute('border');
        table.removeAttribute('width');
        table.removeAttribute('cellspacing');
        table.removeAttribute('cellpadding');

        // Clean children
        table.querySelectorAll('tr, td, th, thead, tbody, tfoot').forEach(el => {
            el.removeAttribute('style');
            el.removeAttribute('width');
            el.removeAttribute('height');
            el.removeAttribute('bgcolor');
            el.removeAttribute('align');
            el.removeAttribute('valign');
        });

        // Add class
        table.classList.add('results-table');

        // Ensure responsive wrapper
        if (!table.parentElement.classList.contains('table-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            // Important: this wrapper must allow x-scroll
            wrapper.style.overflowX = 'auto';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }

        showToast('🎨 Tabulka nastylována a vyčištěna', 'success');
    } else {
        showToast('Klikněte do tabulky, kterou chcete stylovat', 'info');
    }
}

/**
 * Add a new row to the table
 */
function tableAddRow() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const element = selection.getRangeAt(0).commonAncestorContainer;
    const cell = (element.nodeType === 3 ? element.parentNode : element).closest('td, th');

    if (!cell) {
        showToast('Klikněte do tabulky', 'error');
        return;
    }

    const row = cell.parentElement;
    const table = row.closest('table');
    const newRow = row.cloneNode(true);

    // Clear content of new cells
    Array.from(newRow.children).forEach(c => c.innerHTML = '&nbsp;');

    row.parentNode.insertBefore(newRow, row.nextSibling);
}

/**
 * Delete current row
 */
function tableDeleteRow() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const element = selection.getRangeAt(0).commonAncestorContainer;
    const cell = (element.nodeType === 3 ? element.parentNode : element).closest('td, th');

    if (!cell) return;

    const row = cell.parentElement;
    row.remove();
}

/**
 * Add a new column
 */
function tableAddCol() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const element = selection.getRangeAt(0).commonAncestorContainer;
    const cell = (element.nodeType === 3 ? element.parentNode : element).closest('td, th');

    if (!cell) return;

    const table = cell.closest('table');
    const colIndex = Array.from(cell.parentElement.children).indexOf(cell);

    // Add cell to every row at this index
    Array.from(table.rows).forEach(row => {
        const newCell = row.children[colIndex].cloneNode(true);
        newCell.innerHTML = '&nbsp;';
        row.insertBefore(newCell, row.children[colIndex].nextSibling);
    });
}

/**
 * Delete current column
 */
function tableDeleteCol() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const element = selection.getRangeAt(0).commonAncestorContainer;
    const cell = (element.nodeType === 3 ? element.parentNode : element).closest('td, th');

    if (!cell) return;

    const table = cell.closest('table');
    const colIndex = Array.from(cell.parentElement.children).indexOf(cell);

    Array.from(table.rows).forEach(row => {
        if (row.children[colIndex]) {
            row.children[colIndex].remove();
        }
    });
}

/**
 * Toggle highlight-last class on table (green last column for scores)
 */
function tableToggleHighlightLast() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const element = selection.getRangeAt(0).commonAncestorContainer;
    const table = (element.nodeType === 3 ? element.parentNode : element).closest('table');

    if (!table) {
        showToast('Klikněte do tabulky', 'error');
        return;
    }

    const isHighlighted = table.classList.contains('highlight-last');
    table.classList.toggle('highlight-last');

    // Update button state
    const btn = document.getElementById('btnHighlightLast');
    if (btn) {
        btn.style.opacity = table.classList.contains('highlight-last') ? '1' : '0.5';
    }

    showToast(isHighlighted ? 'Zvýraznění odebráno' : '✨ Poslední sloupec zvýrazněn', 'success');
    updatePreview();
}

/**
 * Toggle hide-mobile class on current column
 */
function tableToggleHideMobile() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const element = selection.getRangeAt(0).commonAncestorContainer;
    const cell = (element.nodeType === 3 ? element.parentNode : element).closest('td, th');

    if (!cell) {
        showToast('Klikněte do buňky tabulky', 'error');
        return;
    }

    const table = cell.closest('table');
    const colIndex = Array.from(cell.parentElement.children).indexOf(cell);

    // Toggle hide-mobile on all cells in this column
    const isHidden = cell.classList.contains('hide-mobile');
    Array.from(table.rows).forEach(row => {
        if (row.children[colIndex]) {
            row.children[colIndex].classList.toggle('hide-mobile', !isHidden);
        }
    });

    // Update button state
    const btn = document.getElementById('btnHideMobile');
    if (btn) {
        btn.style.opacity = !isHidden ? '1' : '0.5';
    }

    showToast(isHidden ? 'Sloupec viditelný na mobilu' : '📱 Sloupec skryt na mobilu', 'success');
    updatePreview();
}

/**
 * Cycle column width: normal → narrow → wide → normal
 */
function tableCycleColumnWidth() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const element = selection.getRangeAt(0).commonAncestorContainer;
    const cell = (element.nodeType === 3 ? element.parentNode : element).closest('td, th');

    if (!cell) {
        showToast('Klikněte do buňky tabulky', 'error');
        return;
    }

    const table = cell.closest('table');
    const colIndex = Array.from(cell.parentElement.children).indexOf(cell);

    // Determine current state and cycle
    const hasNarrow = cell.classList.contains('col-narrow');
    const hasWide = cell.classList.contains('col-wide');

    let newClass = '';
    let message = '';

    if (!hasNarrow && !hasWide) {
        // normal → narrow
        newClass = 'col-narrow';
        message = '↔ Sloupec: úzký';
    } else if (hasNarrow) {
        // narrow → wide
        newClass = 'col-wide';
        message = '↔ Sloupec: široký';
    } else {
        // wide → normal
        newClass = '';
        message = '↔ Sloupec: normální';
    }

    // Apply to all cells in column
    Array.from(table.rows).forEach(row => {
        if (row.children[colIndex]) {
            row.children[colIndex].classList.remove('col-narrow', 'col-wide');
            if (newClass) {
                row.children[colIndex].classList.add(newClass);
            }
        }
    });

    showToast(message, 'success');
    updatePreview();
}

// ================================
// TABLE WIDGET (FLOATING)
// ================================

function initTableTools() {
    // Create widget if not exists
    if (!document.getElementById('tableToolsWidget')) {
        const widget = document.createElement('div');
        widget.id = 'tableToolsWidget';
        widget.innerHTML = `
            <button onclick="styleSelectedTable()" title="🎨 Nastylovat (Premium Gold)" style="color: #f59e0b;"><i class="fa-solid fa-palette"></i></button>
            <button id="btnHighlightLast" onclick="tableToggleHighlightLast()" title="Zvýraznit poslední sloupec (body/výsledek)" style="color: #22c55e;"><i class="fa-solid fa-trophy"></i></button>
            <div class="divider"></div>
            <button onclick="tableAddRow()" title="Přidat řádek dolů" style="color: #94a3b8;"><i class="fa-solid fa-plus"></i><span style="font-size: 0.6em; margin-left:1px">R</span></button>
            <button onclick="tableDeleteRow()" title="Smazat řádek" style="color: #ef4444;"><i class="fa-solid fa-minus"></i><span style="font-size: 0.6em; margin-left:1px">R</span></button>
            <div class="divider"></div>
            <button onclick="tableAddCol()" title="Přidat sloupec vpravo" style="color: #94a3b8;"><i class="fa-solid fa-plus"></i><span style="font-size: 0.6em; margin-left:1px">C</span></button>
            <button onclick="tableDeleteCol()" title="Smazat sloupec" style="color: #ef4444;"><i class="fa-solid fa-minus"></i><span style="font-size: 0.6em; margin-left:1px">C</span></button>
            <div class="divider"></div>
            <button id="btnHideMobile" onclick="tableToggleHideMobile()" title="Skrýt sloupec na mobilu" style="color: #60a5fa;"><i class="fa-solid fa-mobile-screen"></i></button>
            <button onclick="tableCycleColumnWidth()" title="Změnit šířku sloupce (norm → úzký → široký)" style="color: #94a3b8;"><i class="fa-solid fa-arrows-left-right"></i></button>
        `;
        document.body.appendChild(widget);
    }

    // Event listeners for automatic show/hide
    const editor = document.getElementById('articleContent');
    if (editor) {
        editor.addEventListener('click', updateTableToolsPosition);
        editor.addEventListener('keyup', updateTableToolsPosition);

        // Hide when clicking outside editor
        document.addEventListener('click', (e) => {
            const widget = document.getElementById('tableToolsWidget');
            if (widget &&
                !widget.contains(e.target) &&
                !editor.contains(e.target) &&
                widget.style.display !== 'none') {
                widget.style.display = 'none';
            }
        });
    }
}

function updateTableToolsPosition() {
    const widget = document.getElementById('tableToolsWidget');
    if (!widget) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) {
        widget.style.display = 'none';
        return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === 3 ? container.parentNode : container;
    const table = element.closest('table');
    const editor = document.getElementById('articleContent');

    // Check if selection is inside editor AND inside a table
    if (table && editor.contains(table)) {
        const rect = table.getBoundingClientRect();

        // Position above the table
        widget.style.display = 'flex';
        // Add scroll offsets to fix positioning
        widget.style.top = `${window.scrollY + rect.top - 45}px`;
        widget.style.left = `${window.scrollX + rect.left}px`;

        // Update highlight button state
        const btnHighlight = document.getElementById('btnHighlightLast');
        if (btnHighlight) {
            btnHighlight.style.opacity = table.classList.contains('highlight-last') ? '1' : '0.5';
        }

        // Update hide-mobile button state
        const btnHide = document.getElementById('btnHideMobile');
        if (btnHide) {
            // Find current cell/column
            const element = selection.getRangeAt(0).commonAncestorContainer;
            const cell = (element.nodeType === 3 ? element.parentNode : element).closest('td, th');

            if (cell) {
                // Check if this specific cell has the class (columns should be uniform)
                btnHide.style.opacity = cell.classList.contains('hide-mobile') ? '1' : '0.5';
            } else {
                btnHide.style.opacity = '0.5';
            }
        }
    } else {
        widget.style.display = 'none';
    }
}

// Auto-init table tools
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initTableTools, 500);

    // Initialize WYSIWYG Enter key handler for highlight spans
    const editor = document.getElementById('articleContent');
    if (editor) {
        // Ensure paragraphs are used for new lines
        document.execCommand('defaultParagraphSeparator', false, 'p');

        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const sel = window.getSelection();
                if (!sel.rangeCount) return;

                let node = sel.anchorNode;
                if (node.nodeType === 3) node = node.parentNode;

                if (node.classList && (node.classList.contains('highlight-name') || node.classList.contains('highlight-score'))) {
                    e.preventDefault();
                    document.execCommand('insertParagraph');

                    const newSel = window.getSelection();
                    let newNode = newSel.anchorNode;
                    if (newNode.nodeType === 3) newNode = newNode.parentNode;

                    if (newNode.classList && (newNode.classList.contains('highlight-name') || newNode.classList.contains('highlight-score'))) {
                        newNode.className = '';
                        if (newNode.innerHTML.includes('\u200B')) {
                            newNode.innerHTML = newNode.innerHTML.replace(/\u200B/g, '');
                        }
                    }
                    if (typeof checkToolbarState === 'function') checkToolbarState();
                }
            }
        });
    }
});

// ================================
// EXPORTS
// ================================
window.formatText = formatText;
window.removeFormatting = removeFormatting;
window.toggleSource = toggleSource;
window.updateContentFromSource = updateContentFromSource;
window.insertHighlight = insertHighlight;
window.checkToolbarState = checkToolbarState;
window.applyHeading = applyHeading;
window.insertList = insertList;
window.insertLink = insertLink;
window.insertCollapsibleBlock = insertCollapsibleBlock;
window.insertIntroBlock = insertIntroBlock;
window.initFloatingToolbar = initFloatingToolbar;
window.autoFormatSelection = autoFormatSelection;
window.autoFormatEntireContent = autoFormatEntireContent;
window.insertResultTemplate = insertResultTemplate;
window.initAutoSuggest = initAutoSuggest;
window.aiSpellCheck = aiSpellCheck;
window.aiTextToTable = aiTextToTable;
window.styleSelectedTable = styleSelectedTable;
window.tableAddRow = tableAddRow;
window.tableDeleteRow = tableDeleteRow;
window.tableAddCol = tableAddCol;
window.tableDeleteCol = tableDeleteCol;
window.tableToggleHighlightLast = tableToggleHighlightLast;
window.tableToggleHideMobile = tableToggleHideMobile;
window.tableCycleColumnWidth = tableCycleColumnWidth;

// ================================
// DIAGRAM INTERACTIONS (Edit/Delete)
// ================================

let diagramToolbar = null;

function initDiagramToolbar() {
    if (document.getElementById('diagramToolbar')) return;

    diagramToolbar = document.createElement('div');
    diagramToolbar.id = 'diagramToolbar';
    diagramToolbar.className = 'floating-toolbar';
    diagramToolbar.style.zIndex = '10001';
    document.body.appendChild(diagramToolbar);

    // Hide on click outside
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('#diagramToolbar') && !e.target.closest('.diagram-book')) {
            hideDiagramToolbar();
        }
    });

    // Editor listener
    const editor = document.getElementById('articleContent');
    if (editor) {
        editor.addEventListener('click', (e) => {
            const book = e.target.closest('.diagram-book');
            if (book) {
                showDiagramToolbar(book);
            } else {
                // Do not hide here immediately if clicking inside custom toolbar logic?
                // But click inside toolbar is captured by toolbar mousedown prevention (preventDefault) usually.
                // Actually mousedown on document hides it if not clicked inside. 
                // So we rely on document mousedown.
            }
        });

        // Double-click to edit diagrams in the book
        editor.addEventListener('dblclick', (e) => {
            const book = e.target.closest('.diagram-book');
            if (book) {
                e.preventDefault();
                e.stopPropagation();
                openDiagramBookEditor(book);
            }
        });
    }
}

// Open editor for an existing diagram book
function openDiagramBookEditor(bookElement) {
    const diagrams = JSON.parse(bookElement.dataset.diagrams || '[]');

    // Show the uniform diagram selector modal in multi-select mode with current diagrams pre-selected
    // Pass the bookElement as the target to replace
    window.openDiagramSelector(bookElement, diagrams);
}

// Remove old showDiagramBookEditModal function if matched
/* Deprecated old modal */

// Modal to edit diagram book (add/remove/reorder diagrams)
async function showDiagramBookEditModal(bookElement, currentDiagrams) {
    // Fetch all available diagrams from API
    let allDiagrams = [];
    try {
        const token = window.authToken || localStorage.getItem('authToken') || localStorage.getItem('auth_token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`${window.API_URL}/diagrams`, { headers });
        if (!response.ok) throw new Error('Failed to load diagrams');
        allDiagrams = await response.json();
    } catch (e) {
        console.error('Error fetching diagrams:', e);
        alert('Nepodařilo se načíst seznam diagramů.');
        return;
    }

    // Create modal
    const modalEl = document.createElement('div');
    modalEl.id = 'diagramBookEditModal';
    modalEl.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.8); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
    `;

    // Get current diagram IDs
    const currentIds = new Set(currentDiagrams.map(d => d.id));

    modalEl.innerHTML = `
        <div class="modal-content" style="max-width: 700px; width: 90%;">
            <h3 style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
                Upravit knihu diagramů
                <button onclick="document.getElementById('diagramBookEditModal').remove()" style="background:none; border:none; color:#888; cursor:pointer; font-size:1.2rem;">
                    <i class="fa-solid fa-times"></i>
                </button>
            </h3>
            
            <p style="color: #888; font-size: 0.9rem; margin-bottom: 1rem;">
                Klikni pro přidání/odebrání diagramů z knihy. Vybrané diagramy jsou zvýrazněny.
            </p>
            
            <input type="text" class="diagram-search" id="bookEditSearch" placeholder="Hledat..." style="width: 100%; margin-bottom: 1rem;">
            
            <div class="diagram-grid" id="bookEditGrid" style="max-height: 400px; overflow-y: auto;"></div>
            
            <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.85rem; color: #d4af37;">
                    <span id="bookEditCount">${currentIds.size}</span> vybráno
                </span>
                <button id="bookEditSaveBtn" class="btn-primary" style="padding: 0.5rem 1.5rem;">
                    <i class="fa-solid fa-check"></i> Uložit změny
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);

    const grid = modalEl.querySelector('#bookEditGrid');
    const searchInput = modalEl.querySelector('#bookEditSearch');
    const countSpan = modalEl.querySelector('#bookEditCount');
    const saveBtn = modalEl.querySelector('#bookEditSaveBtn');

    let selectedIds = new Set(currentIds);

    const renderList = (filter = '') => {
        grid.innerHTML = '';
        const lowerFilter = filter.toLowerCase();
        const filtered = allDiagrams.filter(d =>
            (d.name || '').toLowerCase().includes(lowerFilter) ||
            (d.title || '').toLowerCase().includes(lowerFilter) ||
            String(d.id).includes(lowerFilter)
        );

        if (filtered.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #888;">Žádné diagramy nenalezeny.</div>';
            return;
        }

        filtered.forEach(d => {
            const el = document.createElement('div');
            el.className = 'diagram-item';
            el.dataset.id = d.id;

            const isSelected = selectedIds.has(d.id);
            if (isSelected) {
                el.style.border = '2px solid #d4af37';
                el.style.background = 'rgba(212, 175, 55, 0.15)';
            }

            const miniPreview = generateMiniBoard(d.fen, 18);
            const displayName = d.name || d.title || `Diagram #${d.id}`;

            el.innerHTML = `
                ${miniPreview}
                <div class="diagram-name" title="${displayName}">${displayName}</div>
                <div class="diagram-meta">${d.toMove === 'w' ? '⬜ Bílý' : '⬛ Černý'}</div>
            `;

            el.onclick = () => {
                if (selectedIds.has(d.id)) {
                    selectedIds.delete(d.id);
                } else {
                    selectedIds.add(d.id);
                }
                countSpan.textContent = selectedIds.size;
                renderList(searchInput.value);
            };
            grid.appendChild(el);
        });
    };

    renderList();
    searchInput.oninput = (e) => renderList(e.target.value);

    // Save changes
    saveBtn.onclick = () => {
        // Get selected diagrams in order
        const newDiagrams = allDiagrams.filter(d => selectedIds.has(d.id));

        if (newDiagrams.length === 0) {
            alert('Vyberte alespoň jeden diagram.');
            return;
        }

        // Update the book element
        const newDiagramsJson = JSON.stringify(newDiagrams.map(d => ({
            id: d.id,
            fen: d.fen,
            title: d.title,
            name: d.name,
            toMove: d.toMove,
            annotations: d.annotations,
            solution: d.solution,
            description: d.description
        })));

        bookElement.dataset.diagrams = newDiagramsJson;
        bookElement.dataset.current = '0';

        // Update board preview
        const boardHtml = window.generateMiniBoardGlobal ? window.generateMiniBoardGlobal(newDiagrams[0].fen, 30) : generateMiniBoard(newDiagrams[0].fen, 30);
        const boardContainer = bookElement.querySelector('.book-board-container');
        if (boardContainer) {
            // Keep the badge if exists
            const badge = boardContainer.querySelector('.diagram-type-badge');
            boardContainer.innerHTML = (badge ? badge.outerHTML : '') + boardHtml;
        }

        // Update navigation dots
        const dotsContainer = bookElement.querySelector('.book-dots');
        if (dotsContainer && newDiagrams.length > 1) {
            dotsContainer.innerHTML = newDiagrams.map((_, i) =>
                `<span class="book-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`
            ).join('');
            bookElement.querySelector('.book-nav').style.display = 'flex';
        } else if (dotsContainer && newDiagrams.length === 1) {
            bookElement.querySelector('.book-nav').style.display = 'none';
        }

        // Update to-move indicator
        const toMoveEl = bookElement.querySelector('.book-to-move');
        if (toMoveEl) {
            toMoveEl.textContent = newDiagrams[0].toMove === 'w' ? 'Bílý na tahu' : 'Černý na tahu';
        }

        // Update counter
        const counterEl = bookElement.querySelector('.book-counter');
        if (counterEl) {
            counterEl.textContent = `1 / ${newDiagrams.length}`;
            counterEl.style.display = newDiagrams.length > 1 ? 'block' : 'none';
        }

        modalEl.remove();
        if (typeof updatePreview === 'function') updatePreview();
    };

    // Close on escape
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            modalEl.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function showDiagramToolbar(bookElement) {
    if (!diagramToolbar) initDiagramToolbar();

    diagramToolbar.innerHTML = '';
    diagramToolbar.classList.add('visible');

    const diagrams = JSON.parse(bookElement.dataset.diagrams || '[]');
    const currentIdx = parseInt(bookElement.dataset.current || '0');
    const currentDiagram = diagrams[currentIdx];

    // 1. Edit Button
    const btnEdit = document.createElement('button');
    btnEdit.className = 'floating-btn';
    btnEdit.innerHTML = '<i class="fa-solid fa-pen"></i>';
    btnEdit.title = 'Upravit diagram (otevře editor v novém okně)';
    btnEdit.onclick = () => {
        if (currentDiagram && currentDiagram.id) {
            window.open('game-recorder.html?diagramId=' + currentDiagram.id, '_blank');
        } else {
            alert('Tento diagram nemá ID (byl vložen jen jako data). Nelze upravit zdroj.');
        }
    };
    diagramToolbar.appendChild(btnEdit);

    // 2. Refresh Button
    const btnRefresh = document.createElement('button');
    btnRefresh.className = 'floating-btn';
    btnRefresh.innerHTML = '<i class="fa-solid fa-rotate"></i>';
    btnRefresh.title = 'Obnovit data (načíst aktuální verzi ze serveru)';
    btnRefresh.onclick = async () => {
        if (currentDiagram && currentDiagram.id) {
            try {
                // Determine icon spin
                const icon = btnRefresh.querySelector('i');
                icon.classList.add('fa-spin');

                // Fetch latest data
                // Get token from window or localStorage (use 'auth_token' as per admin-news.js conventions)
                const token = window.authToken || localStorage.getItem('auth_token');
                const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

                const response = await fetch(`/api/diagrams/${currentDiagram.id}`, {
                    headers: headers
                });
                if (!response.ok) {
                    if (response.status === 401) throw new Error('Neautorizovaný přístup. Přihlaste se prosím znovu.');
                    throw new Error('Failed to fetch diagram (' + response.status + ')');
                }

                const updatedData = await response.json();

                // Construct new diagram object preserving some structure if needed, 
                // but usually we just replace the one entry.
                // NOTE: Multi-diagram books might be tricky if we only refresh one.
                // Optimally we refresh the whole list if multiple IDs, but usually it is one.

                // Update the array
                diagrams[currentIdx] = {
                    ...currentDiagram, // Keep existing props mostly? No, overwrite.
                    ...updatedData // Overwrite with new data
                };

                // Update DOM attribute
                bookElement.dataset.diagrams = JSON.stringify(diagrams);

                // Trigger re-render of this book
                // We can call initDiagramBooks() but it acts on all querySelector('.diagram-book').
                // It should be safe to call again as it acts on existing elements.
                // However, we might want to manually re-trigger specific render if possible.
                // initDiagramBooks() inside diagram-book.js is idempotent-ish?
                if (typeof window.initDiagramBooks === 'function') {
                    window.initDiagramBooks();
                } else {
                    // Fallback check if re-init needed
                }

                // Show feedback
                icon.classList.remove('fa-spin');
                if (typeof showToast === 'function') showToast('Diagram aktualizován', 'success');

                // Update toolbar reference if needed? No need.

            } catch (e) {
                console.error(e);
                btnRefresh.querySelector('i').classList.remove('fa-spin');
                alert('Chyba při aktualizaci: ' + e.message);
            }
        } else {
            alert('Tento diagram nemá ID, nelze obnovit.');
        }
    };
    diagramToolbar.appendChild(btnRefresh);

    // Divider
    const divider1 = document.createElement('div');
    divider1.className = 'floating-divider';
    diagramToolbar.appendChild(divider1);

    // Float alignment buttons
    const floatOptions = [
        { value: 'left', icon: 'fa-align-left', title: 'Plovoucí vlevo' },
        { value: 'none', icon: 'fa-align-center', title: 'Na střed (bez obtékání)' },
        { value: 'right', icon: 'fa-align-right', title: 'Plovoucí vpravo' }
    ];

    floatOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'floating-btn';
        btn.innerHTML = `<i class="fa-solid ${opt.icon}"></i>`;
        btn.title = opt.title;

        // Highlight current float state
        const currentFloat = bookElement.style.float || 'right';
        if (currentFloat === opt.value || (opt.value === 'none' && !bookElement.style.float)) {
            btn.style.background = 'rgba(212, 175, 55, 0.3)';
            btn.style.color = '#d4af37';
        }

        btn.onclick = () => {
            if (opt.value === 'none') {
                bookElement.style.float = 'none';
                bookElement.style.margin = '1.5rem auto';
                bookElement.style.clear = 'both';
            } else if (opt.value === 'left') {
                bookElement.style.float = 'left';
                bookElement.style.margin = '1rem 1.5rem 1rem 0';
                bookElement.style.clear = 'left';
            } else {
                bookElement.style.float = 'right';
                bookElement.style.margin = '1rem 0 1rem 1.5rem';
                bookElement.style.clear = 'right';
            }
            if (typeof updatePreview === 'function') updatePreview();
            showDiagramToolbar(bookElement); // Refresh to update active state
        };
        diagramToolbar.appendChild(btn);
    });

    // Divider
    const divider2 = document.createElement('div');
    divider2.className = 'floating-divider';
    diagramToolbar.appendChild(divider2);

    // 3. Remove Button
    const btnRemove = document.createElement('button');
    btnRemove.className = 'floating-btn';
    btnRemove.innerHTML = '<i class="fa-solid fa-trash"></i>';
    btnRemove.title = 'Odstranit diagram';
    btnRemove.style.color = '#ef4444';
    btnRemove.onclick = () => {
        if (confirm('Opravdu odstranit tento diagram/knihu?')) {
            bookElement.remove();
            hideDiagramToolbar();
            if (typeof updatePreview === 'function') updatePreview();
        }
    };
    diagramToolbar.appendChild(btnRemove);

    // Position
    const rect = bookElement.getBoundingClientRect();
    // Use setTimeout to allow rendering of toolbar to get correct size? No, it's visible.
    // But we just added children.
    const toolbarRect = diagramToolbar.getBoundingClientRect();

    let top = rect.top - 50; // hardcoded approx height + margin
    let left = rect.left + (rect.width / 2) - 40; // approx half width

    // Recalculate properly
    // We need to render it to measure it.
    // It is 'visible' so it exists.

    // Better logic matching existing toolbar:
    const tbRect = diagramToolbar.getBoundingClientRect();
    top = rect.top - tbRect.height - 8;
    left = rect.left + (rect.width / 2) - (tbRect.width / 2);

    if (top < 0) top = rect.bottom + 8;

    diagramToolbar.style.top = top + 'px';
    diagramToolbar.style.left = left + 'px';
}

function hideDiagramToolbar() {
    if (diagramToolbar) {
        diagramToolbar.classList.remove('visible');
    }
}

// Init immediately if loaded
if (document.readyState === 'complete') {
    initDiagramToolbar();
} else {
    window.addEventListener('load', initDiagramToolbar);
}
// ================================
// KEYBOARD SHORTCUTS & HELP
// ================================

function showShortcutsModal() {
    if (document.getElementById('shortcutsModal')) return;

    const modal = document.createElement('div');
    modal.id = 'shortcutsModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.85); z-index: 11000;
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(4px);
    `;

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px; width: 90%; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem;">
                <h3 style="margin: 0; display: flex; align-items: center; gap: 0.75rem;">
                    <i class="fa-regular fa-keyboard" style="color: #d4af37;"></i>
                    Klávesové zkratky
                </h3>
                <button onclick="document.getElementById('shortcutsModal').remove()" 
                        style="background:none; border:none; color:#888; cursor:pointer; font-size: 1.25rem; padding: 0.5rem;">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div>
                    <h4 style="color: #60a5fa; margin-bottom: 1rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">Globální</h4>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Nový článek</span>
                            <kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; border: 1px solid rgba(255,255,255,0.2);">N</kbd>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Nový diagram</span>
                            <kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; border: 1px solid rgba(255,255,255,0.2);">D</kbd>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Nápověda</span>
                            <kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; border: 1px solid rgba(255,255,255,0.2);">?</kbd>
                        </div>
                    </div>
                </div>

                <div>
                    <h4 style="color: #4ade80; margin-bottom: 1rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">Editor</h4>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Tučně</span>
                            <kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; border: 1px solid rgba(255,255,255,0.2);">Ctrl + B</kbd>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Kurzíva</span>
                            <kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; border: 1px solid rgba(255,255,255,0.2);">Ctrl + I</kbd>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Podtržení</span>
                            <kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; border: 1px solid rgba(255,255,255,0.2);">Ctrl + U</kbd>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Zpět / Vpřed</span>
                            <kbd style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; border: 1px solid rgba(255,255,255,0.2);">Ctrl + Z / Y</kbd>
                        </div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; color: #888; font-size: 0.9rem;">
                <p style="margin: 0;">Další funkce najdete v <a href="/docs/ADMIN_MANUAL.md" target="_blank" style="color: #d4af37;">Manuálu pro administrátory</a></p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Close on Escape
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function handleAdminShortcuts(e) {
    // Ignore key combinations if they involve Alt/Ctrl/Meta unless explicitly handled
    // We want N and D to work only when NO modifiers are pressed

    // Check if user is typing in an input text field
    const tag = e.target.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;

    // Help (?) - Shift + /
    // Should work even in inputs? Maybe not if typing '?'
    // Let's allow '?' only when NOT in input to avoid conflict
    if (e.key === '?' && !isInput) {
        showShortcutsModal();
        return;
    }

    // New Article (N)
    if (e.code === 'KeyN' && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        // Check if resetEditor exists (from admin-news.js)
        if (typeof window.resetEditor === 'function') {
            window.resetEditor();
            showToast('Nový článek', 'info');
        } else if (typeof resetEditor === 'function') {
            resetEditor();
            showToast('Nový článek', 'info');
        }
        return;
    }

    // New Diagram (D)
    if (e.code === 'KeyD' && !isInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        window.open('game-recorder.html', '_blank');
        return;
    }

    // Editor formatting shortcuts (only when editor focused)
    if (e.target.id === 'articleContent') {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
            let handled = false;
            switch (e.key.toLowerCase()) {
                case 'b':
                    formatText('bold');
                    handled = true;
                    break;
                case 'i':
                    formatText('italic');
                    handled = true;
                    break;
                case 'u':
                    formatText('underline');
                    handled = true;
                    break;
                // Browser usually handles Z/Y natively for contentEditable, 
                // but we might want to hook formatText('undo') if we have custom stack
                // For now let browser handle undo/redo in contentEditables
            }

            if (handled) e.preventDefault();
        }
    }
}

// Register global shortcuts
document.addEventListener('keydown', handleAdminShortcuts);

// Expose to window
window.showShortcutsModal = showShortcutsModal;

// ================================
// MATCH TABLE INSERTION
// ================================

let mtData = null;

window.showMatchTableModal = async function () {
    if (document.getElementById('matchTableModal')) return;

    const modal = document.createElement('div');
    modal.id = 'matchTableModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.85); z-index: 11050;
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(4px);
    `;

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; width: 90%; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1); padding: 2rem; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
            <h3 style="margin: 0 0 1.5rem 0; color: #d4af37; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-trophy"></i> Vložit tabulku zápasu
            </h3>
            
            <div id="mtLoading" style="text-align: center; color: #888; padding: 1rem;">
                <i class="fa-solid fa-spinner fa-spin"></i> Načítám soutěže...
            </div>

            <div id="mtForm" style="display:none; flex-direction: column; gap: 1rem;">
                <div>
                    <label style="display: block; color: #ccc; margin-bottom: 0.5rem; font-size: 0.9rem;">Soutěž</label>
                    <select id="mtCompetition" style="width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 6px;" onchange="mtLoadTeams()">
                    </select>
                </div>
                <div>
                    <label style="display: block; color: #ccc; margin-bottom: 0.5rem; font-size: 0.9rem;">Tým (Bižuterie)</label>
                    <select id="mtTeam" style="width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 6px;" onchange="mtLoadRounds()">
                    </select>
                </div>
                <div>
                    <label style="display: block; color: #ccc; margin-bottom: 0.5rem; font-size: 0.9rem;">Zápas / Kolo</label>
                    <select id="mtRound" style="width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 6px;">
                    </select>
                </div>
                
                <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 0.5rem;">
                    <button onclick="document.getElementById('matchTableModal').remove()" 
                        style="padding: 0.5rem 1rem; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #ccc; border-radius: 6px; cursor: pointer;">
                        Zrušit
                    </button>
                    <button onclick="insertMatchTable()" 
                        style="padding: 0.5rem 1.5rem; background: #d4af37; border: none; color: #000; font-weight: 600; border-radius: 6px; cursor: pointer;">
                        Vložit
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Initial Load
    try {
        const res = await fetch('/api/standings');
        if (!res.ok) throw new Error('Chyba serveru');
        const data = await res.json();
        mtData = data.standings || data; // Compatibility

        const compSelect = document.getElementById('mtCompetition');
        // Filter only competitions where we have standings
        mtData.forEach((comp, idx) => {
            if (comp.standings && comp.standings.length > 0) {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = comp.name;
                compSelect.appendChild(opt);
            }
        });

        document.getElementById('mtLoading').style.display = 'none';
        document.getElementById('mtForm').style.display = 'flex';
        mtLoadTeams();

    } catch (e) {
        document.getElementById('mtLoading').innerHTML = `<span style="color:#f87171">Chyba: ${e.message}</span>`;
    }
}

window.mtLoadTeams = function () {
    const compIdx = document.getElementById('mtCompetition').value;
    const teamSelect = document.getElementById('mtTeam');
    teamSelect.innerHTML = '';

    if (!mtData || !mtData[compIdx]) return;

    const comp = mtData[compIdx];
    const ourTeams = comp.standings.filter(s => s.team.toLowerCase().includes('bižuterie') || s.team.toLowerCase().includes('bizuterie'));

    ourTeams.forEach(team => {
        const opt = document.createElement('option');
        opt.value = team.team;
        opt.textContent = team.team;
        teamSelect.appendChild(opt);
    });

    mtLoadRounds();
}

window.mtLoadRounds = function () {
    const compIdx = document.getElementById('mtCompetition').value;
    const teamName = document.getElementById('mtTeam').value;
    const roundSelect = document.getElementById('mtRound');
    roundSelect.innerHTML = '';

    if (!mtData || !mtData[compIdx]) return;
    const comp = mtData[compIdx];
    const team = comp.standings.find(s => s.team === teamName);

    if (!team || !team.schedule) {
        roundSelect.innerHTML = '<option>Žádné zápasy</option>';
        return;
    }

    team.schedule.forEach(match => {
        if (match.result && /\d/.test(match.result)) {
            const opt = document.createElement('option');
            const val = JSON.stringify({
                url: team.url || comp.url,
                round: match.round,
                home: (match.isHome !== false) ? team.team : match.opponent,
                away: (match.isHome !== false) ? match.opponent : team.team
            });
            opt.value = val;
            opt.textContent = `${match.round}. kolo: vs ${match.opponent} (${match.result})`;
            roundSelect.appendChild(opt);
        }
    });

    if (roundSelect.children.length === 0) {
        roundSelect.innerHTML = '<option>Žádné odehrané zápasy</option>';
    }
}

window.insertMatchTable = async function () {
    const rawVal = document.getElementById('mtRound').value;
    if (!rawVal || !rawVal.startsWith('{')) return;

    const params = JSON.parse(rawVal);

    const btn = document.querySelector('#matchTableModal button:last-child');
    const oldText = btn.textContent;
    btn.textContent = 'Načítám...';
    btn.disabled = true;

    try {
        const url = `/api/standings/match-details?url=${encodeURIComponent(params.url)}&round=${params.round}&home=${encodeURIComponent(params.home)}&away=${encodeURIComponent(params.away)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Nelze načíst detaily');

        const data = await res.json();
        if (!data.boards || data.boards.length === 0) throw new Error('Žádná data');

        // Generate HTML with inline styles
        let html = `
            <div class="match-result-table" contenteditable="false" style="margin: 1.5rem 0; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; overflow: hidden; font-family: 'Inter', sans-serif;">
                <div style="background: rgba(212, 175, 55, 0.1); padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center;">
                    <div style="color: #d4af37; font-weight: 600; font-size: 0.95rem;">${params.round}. KOLO</div>
                    <div style="color: #ccc; font-size: 0.85rem;">${params.home} vs ${params.away}</div>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem; color: #e2e8f0;">
                    <thead>
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2);">
                            <th style="padding: 0.6rem; text-align: left; width: 2rem; color: #94a3b8;">Š.</th>
                            <th style="padding: 0.6rem; text-align: left;">Domácí</th>
                            <th style="padding: 0.6rem; text-align: center; width: 3rem;">Výs.</th>
                            <th style="padding: 0.6rem; text-align: right;">Hosté</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.boards.forEach((b, idx) => {
            const formatPlayer = (name, elo) => {
                if (!name || name === '-') return '-';
                const eloStr = elo && elo !== '-' ? ` <span style="color: #64748b; font-size: 0.85em;">(${elo})</span>` : '';
                return `<strong>${name}</strong>${eloStr}`;
            };
            const homeName = formatPlayer(b.white || b.homePlayer, b.whiteElo || b.homeElo);
            const guestName = formatPlayer(b.black || b.guestPlayer, b.blackElo || b.guestElo);
            const resultColor = b.result === '1-0' ? '#4ade80' : (b.result === '0-1' ? '#f87171' : '#fbbf24');

            html += `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 0.6rem; color: #64748b; text-align: center;">${idx + 1}</td>
                            <td style="padding: 0.6rem;">${homeName}</td>
                            <td style="padding: 0.6rem; text-align: center; font-weight: 700; color: ${resultColor}; white-space: nowrap;">${b.result || '-'}</td>
                            <td style="padding: 0.6rem; text-align: right;">${guestName}</td>
                        </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
            <p><br></p>`;

        const editor = document.getElementById('articleContent');
        if (editor) {
            editor.focus();
            document.execCommand('insertHTML', false, html);
        }

        if (typeof showToast === 'function') showToast('Tabulka vložena', 'success');
        document.getElementById('matchTableModal').remove();

    } catch (e) {
        alert('Chyba: ' + e.message);
        btn.textContent = oldText;
        btn.disabled = false;
    }
}

// ================================
// MATCH TABLE TOOLBAR (Delete)
// ================================

let mtToolbar = null;

function initMatchTableToolbar() {
    if (document.getElementById('mtToolbar')) return;

    mtToolbar = document.createElement('div');
    mtToolbar.id = 'mtToolbar';
    mtToolbar.className = 'floating-toolbar';
    mtToolbar.style.zIndex = '10002'; // Above others
    document.body.appendChild(mtToolbar);

    // Hide on click outside
    document.addEventListener('mousedown', (e) => {
        if (!e.target.closest('#mtToolbar') && !e.target.closest('.match-result-table')) {
            if (mtToolbar) mtToolbar.classList.remove('visible');
        }
    });

    // Editor listener
    const editor = document.getElementById('articleContent');
    if (editor) {
        editor.addEventListener('click', (e) => {
            const table = e.target.closest('.match-result-table');
            if (table) {
                showMatchTableToolbar(table);
            }
        });
    }
}

function showMatchTableToolbar(tableElement) {
    if (!mtToolbar) initMatchTableToolbar();

    mtToolbar.innerHTML = '';
    mtToolbar.classList.add('visible');

    // Position logic (copied from diagramToolbar)
    const rect = tableElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    // Position centered above
    let top = rect.top + scrollTop - 50;
    let left = rect.left + scrollLeft + (rect.width / 2);

    mtToolbar.style.top = `${top}px`;
    mtToolbar.style.left = `${left}px`;
    mtToolbar.style.transform = 'translateX(-50%)';

    // Delete Button
    const btnDelete = document.createElement('button');
    btnDelete.className = 'floating-btn delete';
    btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i>';
    btnDelete.title = 'Odstranit tabulku';
    btnDelete.style.color = '#ef4444';
    btnDelete.onclick = () => confirmDeleteMatchTable(tableElement);
    mtToolbar.appendChild(btnDelete);
}

function confirmDeleteMatchTable(tableElement) {
    // Custom modal
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.85); z-index: 11100;
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(2px);
    `;

    modal.innerHTML = `
        <div style="background: #1a1a2e; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2rem; border-radius: 12px; max-width: 400px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
            <div style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h3 style="margin-bottom: 0.5rem; color: #f1f5f9;">Smazat tabulku?</h3>
            <p style="color: #94a3b8; margin-bottom: 2rem;">Opravdu chcete odstranit tuto tabulku výsledků? Tuto akci nelze vrátit zpět.</p>
            
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button id="mtDeleteCancel" style="padding: 0.75rem 1.5rem; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 8px; cursor: pointer;">Zrušit</button>
                <button id="mtDeleteConfirm" style="padding: 0.75rem 1.5rem; background: #dc2626; border: none; color: #fff; font-weight: 600; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);">Smazat</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#mtDeleteCancel').onclick = () => modal.remove();
    modal.querySelector('#mtDeleteConfirm').onclick = () => {
        tableElement.remove();
        // Also remove current spacer paragraph if it's empty? Maybe safer to leave it.
        modal.remove();
        if (mtToolbar) mtToolbar.classList.remove('visible');
        if (typeof showToast === 'function') showToast('Tabulka smazána', 'info');
    };

    // Close on click outside
    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Init on load
document.addEventListener('DOMContentLoaded', () => {
    initMatchTableToolbar();
});
