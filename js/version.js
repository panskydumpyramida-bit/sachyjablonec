// Global Version Control for Assets
const APP_VERSION = '15';

// Helper to inject CSS with version
function loadVersionedCSS(path) {
    document.write(`<link rel="stylesheet" href="${path}?v=${APP_VERSION}">`);
}

// Helper to inject JS with version
function loadVersionedJS(path, defer = false) {
    document.write(`<script src="${path}?v=${APP_VERSION}"${defer ? ' defer' : ''}><\/script>`);
}
