/**
 * Shared Utilities for Šachy Jablonec
 * Common functions used across the application
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * Format date for display in Czech locale
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
function formatDate(date, options = {}) {
    const d = date instanceof Date ? date : new Date(date);
    const defaultOptions = { day: 'numeric', month: 'numeric', year: 'numeric' };
    return d.toLocaleDateString('cs-CZ', { ...defaultOptions, ...options });
}

/**
 * Format datetime for display
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted datetime string
 */
function formatDateTime(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString('cs-CZ');
}

/**
 * Debounce function calls
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay = 300) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Throttle function calls
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Minimum time between calls in ms
 * @returns {Function} Throttled function
 */
function throttle(fn, limit = 100) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} type - 'success', 'error', 'info', 'warning'
 * @param {number} duration - Duration in ms (default 3000)
 */
function showToast(message, type = 'success', duration = 3000) {
    // Create toast container if not exists
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 1rem;
            right: 1rem;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ',
        warning: '⚠'
    };
    const colors = {
        success: '#22c55e',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };

    toast.innerHTML = `<span style="margin-right: 0.5rem;">${icons[type] || icons.info}</span>${escapeHtml(message)}`;
    toast.style.cssText = `
        background: ${colors[type] || colors.info};
        color: white;
        padding: 0.75rem 1.25rem;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 500;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        pointer-events: auto;
        animation: toastSlideIn 0.3s ease;
        display: flex;
        align-items: center;
    `;

    // Add animation keyframes if not present
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            @keyframes toastSlideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes toastSlideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Format a date as a compact relative time in Czech
 * @param {Date|string} date - Date to format
 * @returns {string} Relative time string (e.g. "před 2h", "před 3d")
 */
function formatRelativeTime(date) {
    if (!date) return '-';
    const d = date instanceof Date ? date : new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'právě teď';
    if (diffMin < 60) return `před ${diffMin}m`;
    if (diffHrs < 24) return `před ${diffHrs}h`;
    if (diffDays < 30) return `před ${diffDays}d`;
    return d.toLocaleDateString('cs-CZ');
}

/**
 * Sanitize HTML content — strips dangerous tags/attributes while keeping safe formatting.
 * Use for server-rendered HTML (articles, etc). For user text input, use escapeHtml() instead.
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized HTML
 */
function sanitizeHtml(html) {
    if (!html) return '';

    const ALLOWED_TAGS = new Set([
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'img', 'span', 'div',
        'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'table', 'thead', 'tbody', 'tr', 'td', 'th', 'caption',
        'code', 'pre', 'blockquote', 'figure', 'figcaption',
        'details', 'summary', 'hr', 'sup', 'sub', 'del', 'ins', 'mark',
        'picture', 'source', 'video', 'iframe'
    ]);

    const ALLOWED_ATTRS = new Set([
        'href', 'src', 'alt', 'title', 'class', 'id', 'style',
        'target', 'rel', 'width', 'height', 'loading', 'decoding',
        'colspan', 'rowspan', 'srcset', 'media', 'type',
        'allowfullscreen', 'frameborder', 'allow'
    ]);

    const DANGEROUS_URI_PATTERN = /^\s*(javascript|data\s*:(?!image\/))/i;

    const doc = new DOMParser().parseFromString(html, 'text/html');

    function cleanNode(node) {
        const children = Array.from(node.childNodes);
        for (const child of children) {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const tag = child.tagName.toLowerCase();
                if (!ALLOWED_TAGS.has(tag)) {
                    while (child.firstChild) {
                        node.insertBefore(child.firstChild, child);
                    }
                    node.removeChild(child);
                    continue;
                }
                // Remove disallowed attributes and event handlers
                const attrs = Array.from(child.attributes);
                for (const attr of attrs) {
                    const name = attr.name.toLowerCase();
                    // Allow data-* attributes (used by fragments, diagrams, etc.)
                    if (name.startsWith('on')) {
                        child.removeAttribute(attr.name);
                    } else if (!ALLOWED_ATTRS.has(name) && !name.startsWith('data-')) {
                        child.removeAttribute(attr.name);
                    } else if ((name === 'href' || name === 'src') && DANGEROUS_URI_PATTERN.test(attr.value)) {
                        child.removeAttribute(attr.name);
                    }
                }
                // Force safe link attributes
                if (tag === 'a') {
                    child.setAttribute('rel', 'noopener noreferrer');
                }
                cleanNode(child);
            }
        }
    }

    cleanNode(doc.body);
    return doc.body.innerHTML;
}

// Export to global scope for non-module scripts
window.sanitizeHtml = sanitizeHtml;
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.formatRelativeTime = formatRelativeTime;
window.debounce = debounce;
window.throttle = throttle;
window.showToast = showToast;
