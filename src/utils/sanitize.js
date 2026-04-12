import sanitizeHtmlLib from 'sanitize-html';

// Strict sanitization for user-generated content (comments, messages, forum posts)
// Only allows plain text formatting, no images/links/iframes
export function sanitizeUserContent(html) {
    if (!html) return '';
    return sanitizeHtmlLib(html, {
        allowedTags: ['b', 'i', 'em', 'strong', 'br'],
        allowedAttributes: {},
        allowedSchemes: [],
    });
}

// Relaxed sanitization for admin-created article content (WYSIWYG editor output)
export function sanitizeArticleContent(html) {
    if (!html) return '';
    return sanitizeHtmlLib(html, {
        allowedTags: sanitizeHtmlLib.defaults.allowedTags.concat([
            'img', 'figure', 'figcaption', 'iframe', 'video', 'source',
            'picture', 'details', 'summary', 'mark', 'del', 'ins',
            'sup', 'sub', 'hr', 'span', 'div', 'section',
        ]),
        allowedAttributes: {
            ...sanitizeHtmlLib.defaults.allowedAttributes,
            img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding', 'class', 'style'],
            iframe: ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow'],
            div: ['class', 'style', 'id', 'data-*'],
            span: ['class', 'style'],
            a: ['href', 'title', 'target', 'rel', 'class'],
            '*': ['class'],
        },
        allowedIframeHostnames: ['lichess.org', 'www.youtube.com', 'youtube.com'],
        allowedSchemes: ['http', 'https', 'mailto'],
    });
}
