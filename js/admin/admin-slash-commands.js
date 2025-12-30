/**
 * Admin Slash Commands Module
 * Notion-style "/" commands for quick content insertion
 * 
 * Usage: Type "/" at the start of a line to open command palette
 */

// ================================
// SLASH COMMANDS CONFIGURATION
// ================================

const SLASH_COMMANDS = [
    {
        id: 'h2',
        label: 'Nadpis',
        icon: 'fa-heading',
        description: 'Velký nadpis sekce',
        action: () => applyHeading('H2')
    },
    {
        id: 'h3',
        label: 'Podnadpis',
        icon: 'fa-heading',
        description: 'Menší nadpis',
        action: () => applyHeading('H3')
    },
    {
        id: 'bold',
        label: 'Tučný text',
        icon: 'fa-bold',
        description: 'Zvýrazněný text',
        action: () => formatText('bold')
    },
    {
        id: 'quote',
        label: 'Citace',
        icon: 'fa-quote-left',
        description: 'Blok citace',
        action: insertBlockquote
    },
    {
        id: 'divider',
        label: 'Oddělovač',
        icon: 'fa-minus',
        description: 'Horizontální čára',
        action: insertDivider
    },
    {
        id: 'ul',
        label: 'Seznam',
        icon: 'fa-list-ul',
        description: 'Odrážkový seznam',
        action: () => insertList('ul')
    },
    {
        id: 'ol',
        label: 'Číslovaný seznam',
        icon: 'fa-list-ol',
        description: 'Číslovaný seznam',
        action: () => insertList('ol')
    },
    {
        id: 'image',
        label: 'Obrázek',
        icon: 'fa-image',
        description: 'Vložit obrázek z galerie',
        action: () => {
            if (window.openGalleryPicker) window.openGalleryPicker();
        }
    },
    {
        id: 'partie',
        label: 'Partie',
        icon: 'fa-chess',
        description: 'Přidat šachovou partii',
        action: () => {
            if (window.openAddGameModal) window.openAddGameModal();
        }
    },
    {
        id: 'vysledek',
        label: 'Výsledek',
        icon: 'fa-trophy',
        description: 'Šablona výsledku partie',
        action: insertResultTemplate
    },
    {
        id: 'hrac',
        label: 'Jméno hráče',
        icon: 'fa-user',
        description: 'Zvýrazněné jméno',
        action: () => insertHighlight('name')
    },
    {
        id: 'skore',
        label: 'Skóre',
        icon: 'fa-star',
        description: 'Zvýrazněné skóre',
        action: () => insertHighlight('score')
    },
    {
        id: 'rozbalit',
        label: 'Rozbalovací blok',
        icon: 'fa-caret-down',
        description: 'Skrytý obsah který se rozbalí',
        action: () => {
            if (window.insertCollapsibleBlock) window.insertCollapsibleBlock();
        }
    },
    {
        id: 'link',
        label: 'Odkaz',
        icon: 'fa-link',
        description: 'Vložit hypertextový odkaz',
        action: () => {
            if (window.insertLink) window.insertLink();
        }
    }
];

// ================================
// STATE
// ================================

let slashMenuVisible = false;
let slashMenuElement = null;
let selectedCommandIndex = 0;
let slashTriggerRange = null;
let filteredCommands = [...SLASH_COMMANDS];

// ================================
// MENU CREATION
// ================================

function createSlashMenu() {
    if (slashMenuElement) return slashMenuElement;

    const menu = document.createElement('div');
    menu.id = 'slashCommandMenu';
    menu.className = 'slash-menu';
    menu.innerHTML = `
        <div class="slash-menu-header">Příkazy</div>
        <div class="slash-menu-list"></div>
    `;
    document.body.appendChild(menu);
    slashMenuElement = menu;

    // Click handler for menu items
    menu.addEventListener('click', (e) => {
        const item = e.target.closest('.slash-menu-item');
        if (item) {
            const cmdId = item.dataset.cmdId;
            executeSlashCommand(cmdId);
        }
    });

    return menu;
}

function renderSlashMenu(filter = '') {
    const menu = createSlashMenu();
    const list = menu.querySelector('.slash-menu-list');

    // Filter commands
    const filterLower = filter.toLowerCase();
    filteredCommands = SLASH_COMMANDS.filter(cmd =>
        cmd.id.includes(filterLower) ||
        cmd.label.toLowerCase().includes(filterLower) ||
        cmd.description.toLowerCase().includes(filterLower)
    );

    if (filteredCommands.length === 0) {
        list.innerHTML = '<div class="slash-menu-empty">Žádné příkazy</div>';
        return;
    }

    // Reset selection if out of bounds
    if (selectedCommandIndex >= filteredCommands.length) {
        selectedCommandIndex = 0;
    }

    list.innerHTML = filteredCommands.map((cmd, i) => `
        <div class="slash-menu-item ${i === selectedCommandIndex ? 'selected' : ''}" data-cmd-id="${cmd.id}">
            <div class="slash-menu-icon"><i class="fa-solid ${cmd.icon}"></i></div>
            <div class="slash-menu-content">
                <div class="slash-menu-label">${cmd.label}</div>
                <div class="slash-menu-desc">${cmd.description}</div>
            </div>
        </div>
    `).join('');
}

function showSlashMenu(range) {
    slashTriggerRange = range;
    slashMenuVisible = true;
    selectedCommandIndex = 0;

    renderSlashMenu('');

    const menu = slashMenuElement;
    menu.classList.add('visible');

    // Position near the cursor
    const rect = range.getBoundingClientRect();
    let top = rect.bottom + 8;
    let left = rect.left;

    // Bounds checking
    if (top + 300 > window.innerHeight) {
        top = rect.top - 300;
    }
    if (left + 280 > window.innerWidth) {
        left = window.innerWidth - 290;
    }

    menu.style.top = `${top + window.scrollY}px`;
    menu.style.left = `${left + window.scrollX}px`;
}

function hideSlashMenu() {
    slashMenuVisible = false;
    slashTriggerRange = null;
    if (slashMenuElement) {
        slashMenuElement.classList.remove('visible');
    }
}

// ================================
// COMMAND EXECUTION
// ================================

function executeSlashCommand(cmdId) {
    const cmd = SLASH_COMMANDS.find(c => c.id === cmdId);
    if (!cmd) return;

    // Remove the slash trigger text
    if (slashTriggerRange) {
        const selection = window.getSelection();

        // Find and remove the "/" and any filter text
        const editor = document.getElementById('articleContent');
        const currentNode = slashTriggerRange.startContainer;

        if (currentNode.nodeType === Node.TEXT_NODE) {
            const text = currentNode.textContent;
            const slashIndex = text.lastIndexOf('/');
            if (slashIndex !== -1) {
                // Remove from "/" to cursor
                const newText = text.substring(0, slashIndex);
                currentNode.textContent = newText;

                // Set cursor at end
                const newRange = document.createRange();
                newRange.setStart(currentNode, newText.length);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
    }

    hideSlashMenu();

    // Execute the command action
    setTimeout(() => {
        cmd.action();
        updatePreview();
    }, 10);
}

// ================================
// EVENT HANDLERS
// ================================

function handleSlashInput(e) {
    const editor = document.getElementById('articleContent');
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;

    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent;
    const cursorPos = range.startOffset;

    // Look for "/" pattern
    const textBeforeCursor = text.substring(0, cursorPos);
    const slashMatch = textBeforeCursor.match(/\/([a-zA-Z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]*)$/);

    if (slashMatch) {
        const filter = slashMatch[1] || '';

        if (!slashMenuVisible) {
            // Create range at "/" position
            const triggerRange = document.createRange();
            triggerRange.setStart(node, cursorPos - filter.length - 1);
            triggerRange.setEnd(node, cursorPos);
            showSlashMenu(triggerRange);
        }

        renderSlashMenu(filter);
    } else if (slashMenuVisible) {
        hideSlashMenu();
    }
}

function handleSlashKeydown(e) {
    if (!slashMenuVisible) return;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            selectedCommandIndex = (selectedCommandIndex + 1) % filteredCommands.length;
            renderSlashMenu();
            break;

        case 'ArrowUp':
            e.preventDefault();
            selectedCommandIndex = (selectedCommandIndex - 1 + filteredCommands.length) % filteredCommands.length;
            renderSlashMenu();
            break;

        case 'Enter':
            e.preventDefault();
            if (filteredCommands[selectedCommandIndex]) {
                executeSlashCommand(filteredCommands[selectedCommandIndex].id);
            }
            break;

        case 'Escape':
            e.preventDefault();
            hideSlashMenu();
            break;

        case 'Tab':
            e.preventDefault();
            if (filteredCommands[selectedCommandIndex]) {
                executeSlashCommand(filteredCommands[selectedCommandIndex].id);
            }
            break;
    }
}

// ================================
// HELPER COMMANDS
// ================================

function insertBlockquote() {
    const editor = document.getElementById('articleContent');
    const selection = window.getSelection();

    const blockquote = document.createElement('blockquote');
    blockquote.innerHTML = 'Citace...';
    blockquote.style.cssText = 'border-left: 4px solid #d4af37; padding-left: 1rem; margin: 1rem 0; font-style: italic; color: #94a3b8;';

    if (selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.insertNode(blockquote);

        // Move cursor into blockquote
        const newRange = document.createRange();
        newRange.selectNodeContents(blockquote);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    editor.focus();
}

function insertDivider() {
    const editor = document.getElementById('articleContent');
    const selection = window.getSelection();

    const hr = document.createElement('hr');
    hr.style.cssText = 'border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 2rem 0;';

    // Add paragraph after for continued typing
    const p = document.createElement('p');
    p.innerHTML = '<br>';

    if (selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.insertNode(hr);
        hr.parentNode.insertBefore(p, hr.nextSibling);

        // Move cursor to new paragraph
        const newRange = document.createRange();
        newRange.setStart(p, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    editor.focus();
}

function insertResultTemplate() {
    const editor = document.getElementById('articleContent');
    const selection = window.getSelection();

    const template = document.createElement('span');
    template.innerHTML = `
        <span class="highlight-name">[Bílý]</span> - 
        <span class="highlight-name">[Černý]</span> 
        <span class="highlight-score">[1-0]</span>
    `;

    if (selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.insertNode(template);
    }

    editor.focus();
}

// ================================
// INITIALIZATION
// ================================

function initSlashCommands() {
    const editor = document.getElementById('articleContent');
    if (!editor) {
        console.warn('[slash-commands] Editor not found');
        return;
    }

    // Input event for detecting "/"
    editor.addEventListener('input', handleSlashInput);

    // Keydown for navigation
    editor.addEventListener('keydown', handleSlashKeydown);

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (slashMenuVisible && !e.target.closest('#slashCommandMenu') && !e.target.closest('#articleContent')) {
            hideSlashMenu();
        }
    });

    console.log('[slash-commands] Initialized with', SLASH_COMMANDS.length, 'commands');
}

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Delay to ensure editor exists
    setTimeout(initSlashCommands, 500);
});

// ================================
// EXPORTS
// ================================
window.initSlashCommands = initSlashCommands;
window.hideSlashMenu = hideSlashMenu;
