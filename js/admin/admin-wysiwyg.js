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
            <div class="divider"></div>
            <button onclick="tableAddRow()" title="Přidat řádek dolů" style="color: #94a3b8;"><i class="fa-solid fa-plus"></i><span style="font-size: 0.6em; margin-left:1px">R</span></button>
            <button onclick="tableDeleteRow()" title="Smazat řádek" style="color: #ef4444;"><i class="fa-solid fa-minus"></i><span style="font-size: 0.6em; margin-left:1px">R</span></button>
            <div class="divider"></div>
            <button onclick="tableAddCol()" title="Přidat sloupec vpravo" style="color: #94a3b8;"><i class="fa-solid fa-plus"></i><span style="font-size: 0.6em; margin-left:1px">C</span></button>
            <button onclick="tableDeleteCol()" title="Smazat sloupec" style="color: #ef4444;"><i class="fa-solid fa-minus"></i><span style="font-size: 0.6em; margin-left:1px">C</span></button>
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
