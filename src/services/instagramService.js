/**
 * Instagram Service - Publishes photos from a News article as sequential
 * Instagram Stories via the Graph API.
 *
 * Flow per photo:
 *   1. Convert source image to 1080×1920 JPEG (blurred bg + fitted foreground)
 *   2. Save to /uploads/{filename}-ig.jpg so IG can fetch it publicly
 *   3. POST /{ig-user-id}/media?media_type=STORIES&image_url=... → creation_id
 *   4. Poll GET /{creation-id}?fields=status_code until FINISHED
 *   5. POST /{ig-user-id}/media_publish?creation_id=... → media_id
 *
 * Env vars:
 *   FB_PAGE_ACCESS_TOKEN   - Page Access Token with instagram_content_publish + basic
 *   IG_USER_ID             - Instagram Business account id (connected to the FB Page)
 *   FB_API_VERSION         - Graph API version (default v21.0)
 *   FRONTEND_URL           - Public origin serving /uploads/* (where IG fetches images)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads');

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
const MAX_STORIES = 5;
const CONTAINER_POLL_MS = 3000;
const CONTAINER_TIMEOUT_MS = 60000;

function getConfig() {
    const token = process.env.FB_PAGE_ACCESS_TOKEN;
    const igUserId = process.env.IG_USER_ID;
    if (!token || !igUserId) {
        throw new Error('Instagram integration is not configured (missing FB_PAGE_ACCESS_TOKEN or IG_USER_ID).');
    }
    return {
        token,
        igUserId,
        apiVersion: process.env.FB_API_VERSION || 'v21.0',
        frontendUrl: (process.env.FRONTEND_URL || 'https://www.sachyjablonec.cz').replace(/\/$/, '')
    };
}

/**
 * Resolve any image URL (relative or same-origin absolute) to an upload filename
 * on disk. Mirrors the logic in facebookService so the same galleryJson works.
 */
async function resolveLocalUpload(imageUrl) {
    if (typeof imageUrl !== 'string' || !imageUrl) return null;
    let clean = imageUrl.split('#')[0].split('?')[0];
    const match = clean.match(/\/uploads\/[^/?#]+$/);
    if (!match) return null;
    clean = match[0];
    const filename = path.basename(clean);
    if (filename.includes('-thumb.')) return null;
    const filePath = path.join(UPLOADS_DIR, filename);
    try {
        await fs.access(filePath);
        return { filePath, filename };
    } catch {
        return null;
    }
}

/**
 * Produce a 1080×1920 JPEG with the original image centered over a blurred
 * cover of itself. Saves alongside the original with "-ig.jpg" suffix; skips
 * regeneration when the file already exists.
 */
async function ensureVerticalVersion({ filePath, filename }) {
    const baseName = filename.replace(/\.[^.]+$/, '');
    const outFilename = `${baseName}-ig.jpg`;
    const outPath = path.join(UPLOADS_DIR, outFilename);

    try {
        await fs.access(outPath);
        return outFilename;
    } catch { /* need to generate */ }

    const input = await fs.readFile(filePath);

    const bg = await sharp(input)
        .resize(STORY_WIDTH, STORY_HEIGHT, { fit: 'cover', position: 'center' })
        .blur(40)
        .modulate({ brightness: 0.75 })
        .toBuffer();

    const fg = await sharp(input)
        .resize(STORY_WIDTH, STORY_HEIGHT, { fit: 'inside', withoutEnlargement: false })
        .toBuffer();

    await sharp(bg)
        .composite([{ input: fg, gravity: 'center' }])
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(outPath);

    return outFilename;
}

async function igFetch(url, body) {
    const init = body ? { method: 'POST', body } : { method: 'POST' };
    const res = await fetch(url, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
        const msg = json.error?.message || `HTTP ${res.status}`;
        const err = new Error(`[Instagram] ${msg}`);
        err.igError = json.error;
        err.status = res.status;
        throw err;
    }
    return json;
}

async function createStoryContainer(imageUrl, cfg) {
    const form = new FormData();
    form.append('media_type', 'STORIES');
    form.append('image_url', imageUrl);
    form.append('access_token', cfg.token);
    const result = await igFetch(`https://graph.facebook.com/${cfg.apiVersion}/${cfg.igUserId}/media`, form);
    if (!result.id) throw new Error('[Instagram] Container creation returned no id');
    return result.id;
}

async function waitForContainer(creationId, cfg) {
    const started = Date.now();
    while (Date.now() - started < CONTAINER_TIMEOUT_MS) {
        const res = await fetch(
            `https://graph.facebook.com/${cfg.apiVersion}/${creationId}?fields=status_code,status&access_token=${cfg.token}`
        );
        const json = await res.json().catch(() => ({}));
        const status = json.status_code;
        if (status === 'FINISHED') return;
        if (status === 'ERROR' || status === 'EXPIRED') {
            throw new Error(`[Instagram] Container ${creationId} status=${status} (${json.status || ''})`);
        }
        await new Promise(r => setTimeout(r, CONTAINER_POLL_MS));
    }
    throw new Error(`[Instagram] Container ${creationId} did not reach FINISHED within ${CONTAINER_TIMEOUT_MS}ms`);
}

async function publishContainer(creationId, cfg) {
    const form = new FormData();
    form.append('creation_id', creationId);
    form.append('access_token', cfg.token);
    const result = await igFetch(`https://graph.facebook.com/${cfg.apiVersion}/${cfg.igUserId}/media_publish`, form);
    if (!result.id) throw new Error('[Instagram] Publish returned no id');
    return result.id;
}

/**
 * Collect up to MAX_STORIES photos (thumbnail first, then gallery), generate
 * 9:16 versions and post them sequentially as IG Stories.
 * Returns { mediaIds: string[] } on success; throws on the first failure
 * after the first Story is posted (later failures are reported with any
 * already-published ids on the error).
 */
export async function shareNewsToInstagramStories(news) {
    const cfg = getConfig();

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
            console.error('[InstagramService] Failed to parse galleryJson:', e);
        }
    }

    const seen = new Set();
    const sources = [];
    for (const url of urls) {
        if (seen.has(url)) continue;
        seen.add(url);
        const local = await resolveLocalUpload(url);
        if (local) sources.push(local);
        if (sources.length >= MAX_STORIES) break;
    }

    if (sources.length === 0) {
        throw new Error('[Instagram] No usable photos for Stories (galleryJson empty or files missing on disk).');
    }

    const mediaIds = [];
    for (const [idx, src] of sources.entries()) {
        try {
            const verticalFilename = await ensureVerticalVersion(src);
            const publicUrl = `${cfg.frontendUrl}/uploads/${verticalFilename}`;
            const creationId = await createStoryContainer(publicUrl, cfg);
            await waitForContainer(creationId, cfg);
            const mediaId = await publishContainer(creationId, cfg);
            mediaIds.push(mediaId);
            console.log(`[InstagramService] Story ${idx + 1}/${sources.length} posted: ${mediaId}`);
        } catch (e) {
            e.partialMediaIds = mediaIds;
            throw e;
        }
    }

    return { mediaIds };
}
