/**
 * Admin Slash Commands Module
 * Notion-style "/" commands for quick content insertion
 * 
 * Usage: Type "/" at the start of a line to open command palette
 */

// ================================
// CONFIGURATION & STYLES
// ================================

const SLASH_MENU_STYLES = `
    .slash-menu {
        position: absolute;
        background: var(--surface-color, #1a1a2e);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        min-width: 250px;
        z-index: 10000;
        display: none;
        flex-direction: column;
        overflow: hidden;
    }
    .slash-menu.visible {
        display: flex;
    }
    .slash-menu-header {
        padding: 10px 15px;
        font-size: 0.8rem;
        text-transform: uppercase;
        color: var(--text-muted, #94a3b8);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        background: rgba(0, 0, 0, 0.2);
    }
    .slash-menu-list {
        max-height: 300px;
        overflow-y: auto;
    }
    .slash-menu-item {
        padding: 10px 15px;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .slash-menu-item:hover, .slash-menu-item.selected {
        background: rgba(96, 165, 250, 0.15);
    }
    .slash-menu-icon {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        color: var(--primary-color, #60a5fa);
    }
    .slash-menu-content {
        display: flex;
        flex-direction: column;
    }
    .slash-menu-label {
        color: #fff;
        font-size: 0.95rem;
        font-weight: 500;
    }
    .slash-menu-desc {
        color: var(--text-muted, #94a3b8);
        font-size: 0.8rem;
    }
`;

function injectSlashStyles() {
    if (document.getElementById('slash-menu-styles')) return;
    const style = document.createElement('style');
    style.id = 'slash-menu-styles';
    style.textContent = SLASH_MENU_STYLES;
    document.head.appendChild(style);
}

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
    },
    {
        id: 'vitezove',
        label: 'Historie vítězů',
        icon: 'fa-trophy',
        description: 'Blok s přehledem vítězů se zlatým okrajem',
        action: () => showWinnersModal()
    },
    {
        id: 'karty',
        label: 'Karty pořadí',
        icon: 'fa-medal',
        description: 'Dvousloupcový blok medailistů',
        action: () => showRankingCardsModal()
    },
    {
        id: 'cta',
        label: 'Tlačítko výsledků (CTA)',
        icon: 'fa-bullhorn',
        description: 'Závěrečný box s odkazem a galerií',
        action: () => showCtaModal()
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

    // Look for "/" pattern, but require it to be at the start or preceded by a space
    const textBeforeCursor = text.substring(0, cursorPos);
    const slashMatch = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]*)$/);

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
    injectSlashStyles();
    
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

// Auto-init on DOM ready or immediate if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initSlashCommands, 500);
    });
} else {
    setTimeout(initSlashCommands, 500);
}

// ================================
// RICH HTML SNIPPETS (Added via Slash commands)
// ================================

function createTemplateModal(title, htmlContent, onConfirm) {
    // Uložíme aktuální pozici kurzoru v editoru před zobrazením modálu
    let savedRange = null;
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        savedRange = selection.getRangeAt(0).cloneRange();
    }

    const modal = document.createElement('div');
    modal.className = 'template-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.85); z-index: 12000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);';
    
    modal.innerHTML = `
        <div class="modal-content" style="width: 400px; max-width: 90%; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1); padding: 20px; border-radius: 8px;">
            <h3 style="margin-top: 0; margin-bottom: 20px; color: #fff;">${title}</h3>
            <div class="modal-body" style="margin-bottom: 20px;">
                ${htmlContent}
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn-cancel" style="padding: 8px 16px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 4px; cursor: pointer;">Zrušit</button>
                <button type="button" class="btn-confirm" style="padding: 8px 16px; background: var(--primary-color, #60a5fa); border: none; color: #000; font-weight: bold; border-radius: 4px; cursor: pointer;">Vložit</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.btn-cancel').onclick = () => {
        if (savedRange) {
            selection.removeAllRanges();
            selection.addRange(savedRange);
        }
        modal.remove();
    };
    modal.querySelector('.btn-confirm').onclick = () => {
        if (savedRange) {
            selection.removeAllRanges();
            selection.addRange(savedRange);
        }
        onConfirm(modal);
        modal.remove();
    };
}

function showWinnersModal() {
    createTemplateModal('Zlatý box vítězů', `
        <label style="display:block; margin-bottom: 5px; color: #a0a0a0; font-size: 0.9em;">Nadpis boxu:</label>
        <input type="text" id="winTitle" value="🏆 Přehled vítězů" style="width: 100%; box-sizing: border-box; margin-bottom: 15px; padding: 8px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px;">
        <label style="display:block; margin-bottom: 5px; color: #a0a0a0; font-size: 0.9em;">Počet řádků (ročníků/skupin):</label>
        <input type="number" id="winCount" value="1" min="1" max="10" style="width: 100%; box-sizing: border-box; padding: 8px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px;">
    `, (modal) => {
        const title = modal.querySelector('#winTitle').value || '🏆 Přehled vítězů';
        const count = parseInt(modal.querySelector('#winCount').value, 10) || 1;
        insertWinnersBox(title, count);
    });
}

function showRankingCardsModal() {
    createTemplateModal('Karty pořadí', `
        <label style="display:block; margin-bottom: 5px; color: #a0a0a0; font-size: 0.9em;">Počet karet (kategorií):</label>
        <input type="number" id="cardCount" min="1" max="12" value="2" style="width: 100%; box-sizing: border-box; padding: 8px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px;">
        <p style="font-size: 0.8em; color: #888; margin-top: 10px;">Karty se automaticky poskládají do responzivní mřížky (vedle sebe nebo pod sebe). Názvy kategorií si poté přepíšete přímo v textu.</p>
    `, (modal) => {
        const count = parseInt(modal.querySelector('#cardCount').value, 10) || 2;
        insertRankingCards(count);
    });
}

function showCtaModal() {
    createTemplateModal('Závěrečné tlačítko (CTA)', `
        <label style="display:block; margin-bottom: 5px; color: #a0a0a0; font-size: 0.9em;">Nadpis boxu:</label>
        <input type="text" id="ctaTitle" value="Zajímají vás detailní kola a body?" style="width: 100%; box-sizing: border-box; margin-bottom: 15px; padding: 8px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px;">
        <label style="display:block; margin-bottom: 5px; color: #a0a0a0; font-size: 0.9em;">Text tlačítka:</label>
        <input type="text" id="ctaBtn" value="Kompletní výsledky" style="width: 100%; box-sizing: border-box; margin-bottom: 15px; padding: 8px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px;">
        <label style="display:block; margin-bottom: 5px; color: #a0a0a0; font-size: 0.9em;">Cílový Odkaz (URL):</label>
        <input type="url" id="ctaUrl" placeholder="https://" value="https://" style="width: 100%; box-sizing: border-box; padding: 8px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px;">
    `, (modal) => {
        const title = modal.querySelector('#ctaTitle').value || 'Zajímají vás detaily?';
        const btnText = modal.querySelector('#ctaBtn').value || 'Kompletní výsledky';
        const url = modal.querySelector('#ctaUrl').value || '#';
        insertCtaButton(title, btnText, url);
    });
}


function insertWinnersBox(titleText, rowCount) {
    const editor = document.getElementById('articleContent');
    const box = document.createElement('div');
    const selection = window.getSelection();
    box.style.cssText = 'background-color: var(--surface-color, #1e1e1e); border: 1px solid rgba(255, 255, 255, 0.05); border-left: 4px solid var(--primary-color, #d4af37); padding: 20px; border-radius: 4px 8px 8px 4px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);';
    
    const pHolder = (txt) => `<span data-placeholder="1" style="cursor:pointer; opacity:0.7;" title="Klikněte a začněte psát">[${txt}]</span>`;
    
    let rows = '';
    for(let i = 0; i < rowCount; i++) {
        rows += '<li style="margin-bottom: ' + (i === rowCount - 1 ? '0' : '10px') + '; color: #cbd5e1;"><strong>' + pHolder('Rok/Skupina') + ':</strong> 🥇 ' + pHolder('Jméno') + ' &nbsp;|&nbsp; 🥈 ' + pHolder('Jméno') + ' &nbsp;|&nbsp; 🥉 ' + pHolder('Jméno') + '</li>';
    }

    box.innerHTML = '<h3 style="margin-top: 0; color: var(--primary-color, #d4af37); font-size: 1.2em; display: flex; align-items: center; gap: 8px;">🏆 ' + titleText + '</h3>' +
                    '<ul style="list-style: none; padding-left: 0; margin-bottom: 0;">' + rows + '</ul>';

    if (selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.insertNode(box);
    }
    
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    if (box.parentNode) {
        box.parentNode.insertBefore(p, box.nextSibling);
    }
    
    // Move cursor to new paragraph
    const newRange = document.createRange();
    newRange.setStart(p, 0);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    editor.focus();
}

function insertRankingCards(count) {
    const editor = document.getElementById('articleContent');
    const selection = window.getSelection();

    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px;';
    
    let html = '';
    const pHolder = (txt) => `<span data-placeholder="1" style="cursor:pointer; opacity:0.7;" title="Klikněte a začněte psát">[${txt}]</span>`;

    for (let i = 0; i < count; i++) {
        const titlePlaceholder = count === 1 ? 'Kategorie' : 'Kategorie ' + (i + 1);
        html += '<div style="flex: 1; min-width: 250px; background: var(--surface-color, #1e1e1e); border: 1px solid rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);">' +
            '<h4 style="margin-top: 0; color: var(--text-muted, #a0a0a0); font-size: 1.1em; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 10px;">🏆 ' + pHolder(titlePlaceholder) + '</h4>' +
            '<p style="margin: 0; line-height: 2;">🥇 <strong style="color: #ffffff;">' + pHolder('Výherce') + '</strong><br>🥈 ' + pHolder('Stříbro') + '<br>🥉 ' + pHolder('Bronz') + '</p>' +
        '</div>';
    }
    container.innerHTML = html;

    if (selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.insertNode(container);
    }
    
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    if (container.parentNode) {
        container.parentNode.insertBefore(p, container.nextSibling);
    }

    const newRange = document.createRange();
    newRange.setStart(p, 0);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    editor.focus();
}

function insertCtaButton(titleText, btnText, urlTarget) {
    const editor = document.getElementById('articleContent');
    const selection = window.getSelection();

    const container = document.createElement('div');
    container.style.cssText = 'text-align: center; margin-top: 50px; margin-bottom: 20px; padding: 30px 20px; background: var(--surface-color, #1e1e1e); border-radius: 12px; border: 1px solid rgba(212, 175, 55, 0.2);';
    container.innerHTML = '<h3 style="margin-top: 0; color: #ffffff; font-size: 1.3em;">' + titleText + '</h3>' +
        '<a href="' + urlTarget + '" class="cta-button" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: var(--primary-color, #d4af37); color: var(--secondary-color, #1a1a1a); padding: 12px 30px; text-decoration: none; border-radius: 50px; font-size: 1.1em; font-weight: 600; margin: 20px 0; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3); border: none;">🔗 ' + btnText + '</a>' +
        '<p style="margin-bottom: 0; color: var(--text-muted, #a0a0a0); font-size: 0.95em;">[Doplňující text, např. odkaz na fotogalerii níže, nebo smažte]</p>';

    if (selection.rangeCount) {
        const range = selection.getRangeAt(0);
        range.insertNode(container);
    }
    
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    if (container.parentNode) {
        container.parentNode.insertBefore(p, container.nextSibling);
    }

    const newRange = document.createRange();
    newRange.setStart(p, 0);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    editor.focus();
}

// ================================
// EXPORTS
// ================================
window.initSlashCommands = initSlashCommands;
window.hideSlashMenu = hideSlashMenu;
window.insertWinnersBox = insertWinnersBox;
window.insertRankingCards = insertRankingCards;
window.insertCtaButton = insertCtaButton;
window.showWinnersModal = showWinnersModal;
window.showRankingCardsModal = showRankingCardsModal;
window.showCtaModal = showCtaModal;
