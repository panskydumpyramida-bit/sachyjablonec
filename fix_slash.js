const fs = require('fs');
const file = 'js/admin/admin-slash-commands.js';
let content = fs.readFileSync(file, 'utf8');

const newEnd = `
function insertWinnersBox(titleText, rowCount) {
    const editor = document.getElementById('articleContent');
    const box = document.createElement('div');
    const selection = window.getSelection();
    box.style.cssText = 'background-color: var(--surface-color, #1e1e1e); border: 1px solid rgba(255, 255, 255, 0.05); border-left: 4px solid var(--primary-color, #d4af37); padding: 20px; border-radius: 4px 8px 8px 4px; margin-bottom: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);';
    
    let rows = '';
    for(let i = 0; i < rowCount; i++) {
        rows += '<li style="margin-bottom: ' + (i === rowCount - 1 ? '0' : '10px') + '; color: #cbd5e1;"><strong>[Rok/Skupina]:</strong> 🥇 [Jméno] &nbsp;|&nbsp; 🥈 [Jméno] &nbsp;|&nbsp; 🥉 [Jméno]</li>';
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

function insertRankingCards(catA, catB) {
    const editor = document.getElementById('articleContent');
    const selection = window.getSelection();

    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px;';
    container.innerHTML = '<div style="flex: 1; min-width: 250px; background: var(--surface-color, #1e1e1e); border: 1px solid rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);">' +
            '<h4 style="margin-top: 0; color: var(--text-muted, #a0a0a0); font-size: 1.1em; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 10px;">🏆 ' + catA + '</h4>' +
            '<p style="margin: 0; line-height: 2;">🥇 <strong style="color: #ffffff;">[Výherce]</strong><br>🥈 [Stříbro]<br>🥉 [Bronz]</p>' +
        '</div>' +
        '<div style="flex: 1; min-width: 250px; background: var(--surface-color, #1e1e1e); border: 1px solid rgba(255, 255, 255, 0.05); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);">' +
            '<h4 style="margin-top: 0; color: var(--text-muted, #a0a0a0); font-size: 1.1em; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 10px;">🏆 ' + catB + '</h4>' +
            '<p style="margin: 0; line-height: 2;">🥇 <strong style="color: #ffffff;">[Výherce]</strong><br>🥈 [Stříbro]<br>🥉 [Bronz]</p>' +
        '</div>';

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
`;
content = content.substring(0, content.indexOf('function insertWinnersBox(titleText, rowCount) {'));
fs.writeFileSync(file, content + newEnd);
