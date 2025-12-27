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
// EXPORTS
// ================================
window.formatText = formatText;
window.toggleSource = toggleSource;
window.updateContentFromSource = updateContentFromSource;
window.insertHighlight = insertHighlight;
window.checkToolbarState = checkToolbarState;
window.applyHeading = applyHeading;
window.insertList = insertList;
window.insertLink = insertLink;
window.insertCollapsibleBlock = insertCollapsibleBlock;
window.insertIntroBlock = insertIntroBlock;
