/**
 * Facebook Service - Graph API wrapper for sharing news articles to FB Page.
 *
 * Flow for multi-photo post:
 *   1. Upload each image via POST /{page-id}/photos with published=false → media_fbid
 *   2. Create one feed post via POST /{page-id}/feed with message + attached_media[]
 *
 * Env vars required (see .env):
 *   FB_PAGE_ID               - target FB Page numeric ID
 *   FB_PAGE_ACCESS_TOKEN     - long-lived Page Access Token
 *   FB_API_VERSION           - Graph API version, defaults to v21.0
 *   FRONTEND_URL             - public site URL used in the post message
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const MAX_PHOTOS_PER_POST = 10;

function getConfig() {
    const pageId = process.env.FB_PAGE_ID;
    const pageToken = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!pageId || !pageToken) {
        throw new Error('Facebook integration is not configured (missing FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN).');
    }
    return {
        pageId,
        pageToken,
        apiVersion: process.env.FB_API_VERSION || 'v21.0',
        appId: process.env.FB_APP_ID || null,
        frontendUrl: (process.env.FRONTEND_URL || 'https://sachyjablonec.cz').replace(/\/$/, '')
    };
}

/**
 * Resolve any image URL that points to our own /uploads directory into an
 * absolute file path on disk. Accepts:
 *   /uploads/foo.webp
 *   /uploads/foo.webp?t=123
 *   /uploads/foo.webp#crop=50%
 *   https://sachyjablonec.cz/uploads/foo.webp?t=123
 *   https://www.sachyjablonec.cz/uploads/foo.webp
 * Returns null for unrelated URLs, thumbnails or missing files.
 */
async function resolveLocalUpload(imageUrl) {
    if (typeof imageUrl !== 'string' || !imageUrl) return null;

    // Strip fragment (#crop=...) and query string (?t=...)
    let clean = imageUrl.split('#')[0].split('?')[0];

    // Normalize absolute URLs pointing to the site's own uploads directory
    const match = clean.match(/\/uploads\/[^/?#]+$/);
    if (!match) return null;
    clean = match[0];

    const filename = path.basename(clean);
    // Reject thumbnail variants – we want full-size photos on FB
    if (filename.includes('-thumb.')) return null;

    const filePath = path.join(PROJECT_ROOT, 'uploads', filename);
    try {
        await fs.access(filePath);
        return { filePath, filename };
    } catch {
        return null;
    }
}

/**
 * Build the ordered list of photos for the post: thumbnail first, then gallery
 * entries (deduped, non-thumb, file exists on disk). Capped at MAX_PHOTOS_PER_POST.
 */
async function collectPhotoPaths(news) {
    const urls = [];
    if (news.thumbnailUrl) urls.push(news.thumbnailUrl);

    if (news.galleryJson) {
        try {
            const gallery = JSON.parse(news.galleryJson);
            if (Array.isArray(gallery)) {
                for (const entry of gallery) {
                    const u = typeof entry === 'string' ? entry : entry?.url;
                    if (u) urls.push(u);
                }
            }
        } catch (e) {
            console.error('[FacebookService] Failed to parse galleryJson:', e);
        }
    }

    const seen = new Set();
    const resolved = [];
    for (const url of urls) {
        if (seen.has(url)) continue;
        seen.add(url);
        const local = await resolveLocalUpload(url);
        if (local) resolved.push(local);
        if (resolved.length >= MAX_PHOTOS_PER_POST) break;
    }
    return resolved;
}

function buildMessage(news, frontendUrl) {
    const articleUrl = news.slug ? `${frontendUrl}/novinky/${news.slug}` : `${frontendUrl}/article.html?id=${news.id}`;

    // Always append the article URL unless this exact URL is already present
    // in the admin-provided text. We deliberately don't treat arbitrary http://
    // mentions (lichess, chess.com, etc.) as "link to article already here".
    const custom = news.facebookMessage && news.facebookMessage.trim();
    if (custom) {
        return custom.includes(articleUrl) ? custom : `${custom}\n\n${articleUrl}`;
    }

    // Default fallback: title + excerpt + link
    const parts = [news.title];
    if (news.excerpt) parts.push(news.excerpt);
    parts.push(`👉 Celý článek: ${articleUrl}`);
    return parts.join('\n\n');
}

async function fbFetch(url, body) {
    const res = await fetch(url, { method: 'POST', body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
        const msg = json.error?.message || `HTTP ${res.status}`;
        const type = json.error?.type || 'FacebookApiError';
        const err = new Error(`[Facebook] ${type}: ${msg}`);
        err.fbError = json.error;
        err.status = res.status;
        throw err;
    }
    return json;
}

/**
 * Upload a single photo as unpublished, return the media_fbid.
 */
async function uploadUnpublishedPhoto({ filePath, filename }, { pageId, pageToken, apiVersion }) {
    const buffer = await fs.readFile(filePath);
    const blob = new Blob([buffer], { type: 'image/webp' });

    const form = new FormData();
    form.append('published', 'false');
    form.append('access_token', pageToken);
    form.append('source', blob, filename);

    const result = await fbFetch(
        `https://graph.facebook.com/${apiVersion}/${pageId}/photos`,
        form
    );
    if (!result.id) throw new Error('[Facebook] Photo upload returned no id');
    return result.id;
}

/**
 * Main entrypoint: share a published News article as a FB Page post.
 * - With photos → multi-photo feed post
 * - Without photos → text-only feed post
 * Returns { postId } on success; throws on failure.
 */
export async function shareNewsToFacebook(news) {
    const cfg = getConfig();
    const photos = await collectPhotoPaths(news);
    const message = buildMessage(news, cfg.frontendUrl);

    const feedForm = new FormData();
    feedForm.append('access_token', cfg.pageToken);
    feedForm.append('message', message);

    if (photos.length > 0) {
        const mediaIds = [];
        for (const photo of photos) {
            const id = await uploadUnpublishedPhoto(photo, cfg);
            mediaIds.push(id);
        }
        mediaIds.forEach((id, idx) => {
            feedForm.append(`attached_media[${idx}]`, JSON.stringify({ media_fbid: id }));
        });
    } else {
        // Text-only post: include link explicitly so FB renders a preview card
        feedForm.append('link', news.slug ? `${cfg.frontendUrl}/novinky/${news.slug}` : `${cfg.frontendUrl}/article.html?id=${news.id}`);
    }

    const post = await fbFetch(
        `https://graph.facebook.com/${cfg.apiVersion}/${cfg.pageId}/feed`,
        feedForm
    );
    if (!post.id) throw new Error('[Facebook] Feed post returned no id');
    return { postId: post.id, photoCount: photos.length };
}

// ---- Dashboard: čtení postů stránky + insights (dosah) ----

async function fbGet(url) {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
        const msg = data.error ? `${data.error.message} (code ${data.error.code})` : `HTTP ${res.status}`;
        const err = new Error(`[Facebook] ${msg}`);
        err.fbError = data.error || null;
        throw err;
    }
    return data;
}

const FB_POST_FIELDS = 'id,message,created_time,permalink_url,full_picture,application{id,name}';
// Nové metriky (staré post_impressions* Meta vypíná 2025/2026). post_total_media_view_unique≈reach, post_media_view≈impressions.
const FB_POST_INSIGHTS = 'insights.metric(post_total_media_view_unique,post_media_view,post_clicks,post_reactions_by_type_total).period(lifetime)';

/**
 * Načte poslední posty stránky + (pokud jdou) insights dosahu. Když insights selžou
 * (chybí read_insights / neplatná metrika ve staré verzi), vrátí posty bez nich.
 */
export async function fetchPagePostsWithInsights(limit = 50) {
    const cfg = getConfig();
    const base = `https://graph.facebook.com/${cfg.apiVersion}/${cfg.pageId}/posts`;
    const tokenQ = `access_token=${encodeURIComponent(cfg.pageToken)}`;
    let insightsAvailable = true;
    let data;
    try {
        const fields = `${FB_POST_FIELDS},${FB_POST_INSIGHTS}`;
        data = await fbGet(`${base}?fields=${encodeURIComponent(fields)}&limit=${limit}&${tokenQ}`);
    } catch (e) {
        insightsAvailable = false;
        data = await fbGet(`${base}?fields=${encodeURIComponent(FB_POST_FIELDS)}&limit=${limit}&${tokenQ}`);
    }
    return { posts: data.data || [], paging: data.paging || null, insightsAvailable, appId: cfg.appId };
}
