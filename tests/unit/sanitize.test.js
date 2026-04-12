import { describe, it, expect } from 'vitest';
import { sanitizeUserContent, sanitizeArticleContent } from '../../src/utils/sanitize.js';

describe('sanitizeUserContent', () => {
    it('returns empty string for falsy input', () => {
        expect(sanitizeUserContent('')).toBe('');
        expect(sanitizeUserContent(null)).toBe('');
        expect(sanitizeUserContent(undefined)).toBe('');
    });

    it('preserves plain text', () => {
        expect(sanitizeUserContent('Hello world')).toBe('Hello world');
    });

    it('allows basic formatting tags', () => {
        expect(sanitizeUserContent('<b>bold</b>')).toBe('<b>bold</b>');
        expect(sanitizeUserContent('<em>italic</em>')).toBe('<em>italic</em>');
        expect(sanitizeUserContent('<strong>strong</strong>')).toBe('<strong>strong</strong>');
    });

    it('strips script tags', () => {
        expect(sanitizeUserContent('<script>alert("xss")</script>')).toBe('');
    });

    it('strips img tags from user content', () => {
        expect(sanitizeUserContent('<img src="x" onerror="alert(1)">')).toBe('');
    });

    it('strips links from user content', () => {
        const result = sanitizeUserContent('<a href="http://evil.com">click</a>');
        expect(result).not.toContain('<a');
        expect(result).toContain('click');
    });

    it('strips event handlers', () => {
        expect(sanitizeUserContent('<b onmouseover="alert(1)">text</b>')).toBe('<b>text</b>');
    });

    it('strips div and other block elements', () => {
        const result = sanitizeUserContent('<div>text</div>');
        expect(result).not.toContain('<div');
        expect(result).toContain('text');
    });
});

describe('sanitizeArticleContent', () => {
    it('returns empty string for falsy input', () => {
        expect(sanitizeArticleContent('')).toBe('');
        expect(sanitizeArticleContent(null)).toBe('');
    });

    it('allows rich HTML tags for articles', () => {
        const html = '<h2>Title</h2><p>Text with <strong>bold</strong></p><img src="/uploads/photo.jpg" alt="photo">';
        const result = sanitizeArticleContent(html);
        expect(result).toContain('<h2>');
        expect(result).toContain('<strong>');
        expect(result).toContain('<img');
    });

    it('strips script tags', () => {
        const result = sanitizeArticleContent('<p>text</p><script>alert("xss")</script>');
        expect(result).not.toContain('<script');
        expect(result).toContain('<p>text</p>');
    });

    it('strips event handlers from allowed tags', () => {
        const result = sanitizeArticleContent('<img src="photo.jpg" onerror="alert(1)">');
        expect(result).not.toContain('onerror');
        expect(result).toContain('src="photo.jpg"');
    });

    it('allows lichess iframes', () => {
        const html = '<iframe src="https://lichess.org/embed/game/abc123"></iframe>';
        const result = sanitizeArticleContent(html);
        expect(result).toContain('<iframe');
        expect(result).toContain('lichess.org');
    });

    it('strips iframes from disallowed hosts', () => {
        const html = '<iframe src="https://evil.com/steal"></iframe>';
        const result = sanitizeArticleContent(html);
        expect(result).not.toContain('evil.com');
    });

    it('strips javascript: URIs', () => {
        const result = sanitizeArticleContent('<a href="javascript:alert(1)">click</a>');
        expect(result).not.toContain('javascript:');
    });
});
