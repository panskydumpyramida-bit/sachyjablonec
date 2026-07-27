import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { shareNewsToFacebook } from '../services/facebookService.js';
import { shareNewsToInstagramStories } from '../services/instagramService.js';
import { createSlug } from '../utils/slug.js';

const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_URL = 'https://www.sachyjablonec.cz';
const SITE_NAME = 'Šachový oddíl TJ Bižuterie Jablonec';

// Unikátní slug (volitelně s vyloučením vlastního id při update)
const ensureUniqueSlug = async (base, excludeId = null) => {
    let candidate = base;
    let counter = 1;
    while (await prisma.news.findFirst({
        where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { id: true }
    })) {
        candidate = `${base}-${counter++}`;
    }
    return candidate;
};

export const getAllNews = async (req, res) => {
    try {
        const { published, category, page, limit } = req.query;

        const where = {};
        if (published !== undefined) {
            where.isPublished = published === 'true';
            // If requesting published articles, also filter out future-dated (scheduled) articles
            if (published === 'true') {
                where.publishedDate = {
                    lte: new Date()
                };
            }
        }
        if (category) {
            where.category = category;
        }

        // Pagination calculations
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const isPaginated = !isNaN(pageNum) && !isNaN(limitNum) && pageNum > 0 && limitNum > 0;

        const findOptions = {
            where: Object.keys(where).length > 0 ? where : undefined,
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        realName: true
                    }
                },
                coAuthor: {
                    select: {
                        id: true,
                        username: true,
                        realName: true
                    }
                },
                _count: {
                    select: {
                        comments: {
                            where: {
                                isHidden: false,
                                isDeleted: false
                            }
                        }
                    }
                },
                comments: {
                    where: {
                        isHidden: false,
                        isDeleted: false
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        author: {
                            select: {
                                id: true,
                                username: true,
                                realName: true,
                                useRealName: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { publishedDate: 'desc' },
                { id: 'desc' }
            ]
        };

        if (isPaginated) {
            findOptions.skip = (pageNum - 1) * limitNum;
            findOptions.take = limitNum;

            const [news, total] = await prisma.$transaction([
                prisma.news.findMany(findOptions),
                prisma.news.count({ where: findOptions.where })
            ]);

            res.json({
                data: news,
                meta: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    lastPage: Math.ceil(total / limitNum)
                }
            });
        } else {
            const news = await prisma.news.findMany(findOptions);
            res.json(news);
        }

    } catch (error) {
        console.error('Get news error:', error);
        res.status(500).json({ error: 'Failed to get news' });
    }
};


export const getNewsById = async (req, res) => {
    try {
        const { id } = req.params;
        const currentId = parseInt(id);

        const news = await prisma.news.findUnique({
            where: { id: currentId },
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        realName: true
                    }
                },
                coAuthor: {
                    select: {
                        id: true,
                        username: true,
                        realName: true
                    }
                },
                matchReport: {
                    include: {
                        games: {
                            orderBy: {
                                positionOrder: 'asc'
                            }
                        }
                    }
                }
            }
        });

        if (!news) {
            return res.status(404).json({ error: 'News not found' });
        }

        // Fetch Next Article (Newer)
        const nextArticle = await prisma.news.findFirst({
            where: {
                category: news.category,
                isPublished: true,
                publishedDate: {
                    gt: news.publishedDate
                }
            },
            orderBy: {
                publishedDate: 'asc'
            },
            select: { id: true, title: true, slug: true }
        });

        // Fetch Previous Article (Older)
        const prevArticle = await prisma.news.findFirst({
            where: {
                category: news.category,
                isPublished: true,
                publishedDate: {
                    lt: news.publishedDate
                }
            },
            orderBy: {
                publishedDate: 'desc'
            },
            select: { id: true, title: true, slug: true }
        });

        res.json({ ...news, nextArticle, prevArticle });
    } catch (error) {
        console.error('Get news by ID error:', error);
        res.status(500).json({ error: 'Failed to get news' });
    }
};


// Helper to sync games to global Game table
const syncGamesData = async (newsId, gamesJson, teamName) => {
    // 1. Delete existing games linked to this news
    await prisma.game.deleteMany({
        where: { newsId: newsId }
    });

    if (!gamesJson) return;

    let games = [];
    try {
        games = JSON.parse(gamesJson);
    } catch (e) {
        console.error('Failed to parse gamesJson during sync:', e);
        return;
    }

    if (!Array.isArray(games) || games.length === 0) return;

    // 2. Prepare new game records
    const gameRecords = games.map((g, index) => {
        // Skip headers
        if (g.type === 'header') return null;

        // Try to parse players from title "White - Black"
        let white = null;
        let black = null;
        if (g.title && g.title.includes('-')) {
            const parts = g.title.split('-');
            if (parts.length === 2) {
                white = parts[0].trim();
                black = parts[1].trim();
            }
        }

        return {
            gameTitle: String(g.title || 'Untitled'),
            chessComId: String(g.gameId || ''), // Map gameId to chessComId
            whitePlayer: g.white || white || null, // Prefer explicit property if available
            blackPlayer: g.black || black || null,
            team: teamName || g.team || null, // Use article's category/team or game's team
            positionOrder: index,
            isCommented: !!(g.isCommented || g.commented),
            newsId: newsId,
            pgn: g.pgn || null // Map PGN content
        };
    }).filter(g => g !== null);

    // 3. Insert new records
    if (gameRecords.length > 0) {
        await prisma.game.createMany({
            data: gameRecords
        });
    }
};

// Helper to sync gallery images to Image table
const syncGalleryImages = async (galleryJson, category, newsId) => {
    if (!galleryJson) return;

    let images = [];
    try {
        images = JSON.parse(galleryJson);
    } catch (e) {
        console.error('Failed to parse galleryJson during sync:', e);
        return;
    }

    if (!Array.isArray(images) || images.length === 0) return;

    // Iterate and sync each image
    for (const img of images) {
        // Ensure we have at least a URL
        const url = typeof img === 'string' ? img : img.url;
        if (!url) continue;

        const filename = url.split('/').pop();
        const altText = typeof img === 'string' ? '' : (img.caption || img.altText || '');

        try {
            // Upsert image to global table
            // Upsert image to global table (Manual override for non-unique URL)
            const existing = await prisma.image.findFirst({ where: { url: url } });
            if (existing) {
                await prisma.image.update({
                    where: { id: existing.id },
                    data: {
                        altText: altText || undefined,
                        category: category || undefined,
                        newsId: newsId || undefined
                    }
                });
            } else {
                await prisma.image.create({
                    data: {
                        url: url,
                        filename: filename,
                        altText: altText,
                        category: category || 'news',
                        newsId: newsId,
                        isPublic: true
                    }
                });
            }
        } catch (e) {
            console.error(`Failed to sync image ${url}:`, e);
        }
    }
    console.log(`Synced ${images.length} images for news category: ${category}, ID: ${newsId}`);
};

export const createNews = async (req, res) => {
    try {
        const { title, category, excerpt, content, thumbnailUrl, linkUrl, publishedDate, isPublished, gamesJson, teamsJson, galleryJson, introJson, authorName, coAuthorId, coAuthorName, facebookMessage } = req.body;

        // Only title is required
        if (!title) {
            return res.status(400).json({ error: 'Nadpis je povinný' });
        }

        // Kdo smí psát: AUTHOR a výš. AUTHOR smí zakládat POUZE koncepty
        // (publikuje až admin) — proto se isPublished pro něj ignoruje.
        const role = req.user?.role;
        const isEditor = role === 'ADMIN' || role === 'SUPERADMIN';
        if (!isEditor && role !== 'AUTHOR') {
            return res.status(403).json({ error: 'Nemáte oprávnění vytvářet články.' });
        }

        // Smart defaults for optional fields
        const finalCategory = category || 'Novinky';
        const finalExcerpt = excerpt || '';
        const finalPublishedDate = publishedDate ? new Date(publishedDate) : new Date();

        // Slug: ruční z adminu (req.body.slug), jinak automaticky z titulku
        const requestedSlug = req.body.slug && createSlug(req.body.slug) ? createSlug(req.body.slug) : createSlug(title);
        const uniqueSlug = await ensureUniqueSlug(requestedSlug);

        const news = await prisma.news.create({
            data: {
                title,
                slug: uniqueSlug,
                category: finalCategory,
                excerpt: finalExcerpt,
                content,
                thumbnailUrl,
                linkUrl,
                gamesJson,
                teamsJson,
                galleryJson,
                introJson,
                publishedDate: finalPublishedDate,
                isPublished: isEditor ? (isPublished || false) : false,
                authorId: req.user ? req.user.id : null,
                authorName: authorName || null,
                coAuthorId: coAuthorId ? parseInt(coAuthorId) : null,
                coAuthorName: coAuthorName || null,
                facebookMessage: facebookMessage || null
            }
        });

        // Sync games
        if (gamesJson) {
            await syncGamesData(news.id, gamesJson, category); // Use category as broad team identifier
        }

        // Sync gallery
        if (galleryJson) {
            await syncGalleryImages(galleryJson, category, news.id);
        }

        res.status(201).json(news);
    } catch (error) {
        console.error('Error creating news:', error);
        res.status(500).json({ error: 'Failed to create news article: ' + error.message });
    }
};

export const updateNews = async (req, res) => {
    try {
        {
            // AUTHOR smí upravovat jen vlastní dosud nepublikovaný článek;
            // publikovat / měnit cizí může jen admin.
            const role = req.user?.role;
            const isEditor = role === 'ADMIN' || role === 'SUPERADMIN';
            if (!isEditor) {
                if (role !== 'AUTHOR') return res.status(403).json({ error: 'Nemáte oprávnění upravovat články.' });
                const existing = await prisma.news.findUnique({
                    where: { id: parseInt(req.params.id) },
                    select: { authorId: true, isPublished: true },
                });
                if (!existing) return res.status(404).json({ error: 'Článek nenalezen' });
                if (existing.authorId !== req.user.id) return res.status(403).json({ error: 'Můžete upravovat jen své články.' });
                if (existing.isPublished) return res.status(403).json({ error: 'Publikovaný článek už upravuje jen admin.' });
                delete req.body.isPublished;
                delete req.body.authorId;
            }
        }
        const { id } = req.params;
        const { title, category, excerpt, content, thumbnailUrl, linkUrl, publishedDate, isPublished, gamesJson, teamsJson, galleryJson, introJson, authorId, authorName, coAuthorId, coAuthorName, facebookMessage } = req.body;

        const updateData = {};
        if (title) updateData.title = title;
        // Slug se při změně titulku NEMĚNÍ (stabilní URL); přegenerovat jde jen explicitně přes req.body.slug
        if (req.body.slug && createSlug(req.body.slug)) {
            updateData.slug = await ensureUniqueSlug(createSlug(req.body.slug), parseInt(id));
        }
        if (category) updateData.category = category;
        if (excerpt) updateData.excerpt = excerpt;
        if (content !== undefined) updateData.content = content;
        if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
        if (linkUrl !== undefined) updateData.linkUrl = linkUrl;
        if (publishedDate) updateData.publishedDate = new Date(publishedDate);
        if (isPublished !== undefined) updateData.isPublished = isPublished;
        if (gamesJson !== undefined) updateData.gamesJson = gamesJson;
        if (teamsJson !== undefined) updateData.teamsJson = teamsJson;
        if (galleryJson !== undefined) updateData.galleryJson = galleryJson;
        if (introJson !== undefined) updateData.introJson = introJson;
        if (authorId !== undefined) updateData.authorId = authorId ? parseInt(authorId) : null;
        if (authorName !== undefined) updateData.authorName = authorName || null;
        if (coAuthorId !== undefined) updateData.coAuthorId = coAuthorId ? parseInt(coAuthorId) : null;
        if (coAuthorName !== undefined) updateData.coAuthorName = coAuthorName || null;
        if (facebookMessage !== undefined) updateData.facebookMessage = facebookMessage || null;

        const news = await prisma.news.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        // Sync games if gamesJson or category changed
        // For simplicity, we sync on every update if gamesJson is present (it usually is sent)
        // If gamesJson is not sent, we shouldn't wipe games unless intent is clear. 
        // Admin usually sends full object.
        if (gamesJson !== undefined) {
            await syncGamesData(news.id, gamesJson, category || news.category);
        }

        // Sync gallery
        if (galleryJson !== undefined) {
            await syncGalleryImages(galleryJson, category || news.category, news.id);
        }

        res.json(news);
    } catch (error) {
        console.error('Error updating news:', error);
        res.status(500).json({ error: 'Failed to update news article: ' + error.message });
    }
};

export const deleteNews = async (req, res) => {
    try {
        const { id } = req.params;

        // Restriction: Only admin/superadmin can delete
        if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Nemáte oprávnění mazat články.' });
        }

        await prisma.news.delete({
            where: { id: parseInt(id) }
        });

        // Games are cascade deleted by DB foreign key constraints

        res.json({ message: 'News deleted successfully' });
    } catch (error) {
        console.error('Delete news error:', error);
        res.status(500).json({ error: 'Failed to delete news' });
    }
};

export const togglePublish = async (req, res) => {
    try {
        const { id } = req.params;

        const news = await prisma.news.findUnique({
            where: { id: parseInt(id) }
        });

        if (!news) {
            return res.status(404).json({ error: 'News not found' });
        }

        const updated = await prisma.news.update({
            where: { id: parseInt(id) },
            data: { isPublished: !news.isPublished }
        });

        res.json(updated);
    } catch (error) {
        console.error('Toggle publish error:', error);
        res.status(500).json({ error: 'Failed to toggle publish status' });
    }
};

export const shareToFacebook = async (req, res) => {
    try {
        const { id } = req.params;
        const force = req.query.force === 'true' || req.body?.force === true;

        const news = await prisma.news.findUnique({
            where: { id: parseInt(id) }
        });

        if (!news) {
            return res.status(404).json({ error: 'News not found' });
        }

        if (!news.isPublished) {
            return res.status(400).json({ error: 'Article must be published before sharing to Facebook' });
        }

        if (news.facebookPostId && !force) {
            return res.status(409).json({
                error: 'Article already shared to Facebook',
                facebookPostId: news.facebookPostId,
                facebookSharedAt: news.facebookSharedAt
            });
        }

        const { postId, photoCount } = await shareNewsToFacebook(news);

        const updated = await prisma.news.update({
            where: { id: news.id },
            data: {
                facebookPostId: postId,
                facebookSharedAt: new Date()
            },
            select: {
                id: true,
                facebookPostId: true,
                facebookSharedAt: true
            }
        });

        res.json({ ...updated, photoCount });
    } catch (error) {
        console.error('[shareToFacebook] Error:', error);
        const status = error.status >= 400 && error.status < 600 ? 502 : 500;
        res.status(status).json({
            error: 'Failed to share to Facebook',
            detail: error.message,
            fbError: error.fbError || null
        });
    }
};

export const shareToInstagramStories = async (req, res) => {
    try {
        const { id } = req.params;
        const force = req.query.force === 'true' || req.body?.force === true;

        const news = await prisma.news.findUnique({
            where: { id: parseInt(id) }
        });

        if (!news) {
            return res.status(404).json({ error: 'News not found' });
        }

        if (!news.isPublished) {
            return res.status(400).json({ error: 'Article must be published before sharing to Instagram' });
        }

        if (news.instagramStoryIds && !force) {
            return res.status(409).json({
                error: 'Article already shared to Instagram Stories',
                instagramStoryIds: news.instagramStoryIds,
                instagramSharedAt: news.instagramSharedAt
            });
        }

        const { mediaIds } = await shareNewsToInstagramStories(news);

        const updated = await prisma.news.update({
            where: { id: news.id },
            data: {
                instagramStoryIds: JSON.stringify(mediaIds),
                instagramSharedAt: new Date()
            },
            select: { id: true, instagramStoryIds: true, instagramSharedAt: true }
        });

        res.json({ ...updated, storyCount: mediaIds.length });
    } catch (error) {
        console.error('[shareToInstagramStories] Error:', error);
        const status = error.status >= 400 && error.status < 600 ? 502 : 500;
        res.status(status).json({
            error: 'Failed to share to Instagram Stories',
            detail: error.message,
            igError: error.igError || null,
            partialMediaIds: error.partialMediaIds || null
        });
    }
};

// Increment view count for an article
export const incrementViewCount = async (req, res) => {
    try {
        const { id } = req.params;

        const news = await prisma.news.update({
            where: { id: parseInt(id) },
            data: {
                viewCount: { increment: 1 }
            },
            select: { viewCount: true }
        });

        res.json({ viewCount: news.viewCount });
    } catch (error) {
        console.error('Increment view error:', error);
        res.status(500).json({ error: 'Failed to increment view count' });
    }
};


// ===== SEO: server-side render článku na /novinky/:slug =====

let articleTemplateCache = null;
const getArticleTemplate = () => {
    if (!articleTemplateCache) {
        articleTemplateCache = readFileSync(path.join(__dirname, '../../article.html'), 'utf8');
    }
    return articleTemplateCache;
};

const escapeHtml = (s = '') => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const stripHtml = (s = '') => String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const absoluteUrl = (u) => {
    if (!u) return null;
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    return `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
};

// Starší články mohou mít kořenové assety uložené jako images/foo.jpg.
// Na SEO URL /novinky/:slug by se jinak chybně hledaly pod /novinky/images/.
const normalizeArticleContent = (content = '') => String(content).replace(
    /\b(src|poster)=(["'])(?!(?:https?:|data:|blob:|\/))((?:images|uploads|documents)\/)/gi,
    '$1=$2/$3'
);

// JSON bezpečný pro inline <script> (zabrání </script> breakoutu)
const inlineJson = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

export const renderArticlePage = async (req, res) => {
    try {
        const { slug } = req.params;
        const news = await prisma.news.findUnique({
            where: { slug },
            include: {
                author: { select: { id: true, username: true, realName: true } },
                coAuthor: { select: { id: true, username: true, realName: true } },
                matchReport: { include: { games: { orderBy: { positionOrder: 'asc' } } } }
            }
        });

        if (!news) {
            return res.status(404).sendFile(path.join(__dirname, '../../404.html'));
        }

        let html = getArticleTemplate();

        // Nepublikovaný/naplánovaný článek: bez prerenderu, noindex, klient si ho stáhne přes API (admin preview)
        if (!news.isPublished || news.publishedDate > new Date()) {
            html = html.replace('</head>',
                `    <meta name="robots" content="noindex">\n    <script>window.__ARTICLE_META__ = { id: ${news.id} };</script>\n</head>`);
            return res.send(html);
        }

        const [nextArticle, prevArticle] = await Promise.all([
            prisma.news.findFirst({
                where: { category: news.category, isPublished: true, publishedDate: { gt: news.publishedDate } },
                orderBy: { publishedDate: 'asc' },
                select: { id: true, title: true, slug: true }
            }),
            prisma.news.findFirst({
                where: { category: news.category, isPublished: true, publishedDate: { lt: news.publishedDate } },
                orderBy: { publishedDate: 'desc' },
                select: { id: true, title: true, slug: true }
            })
        ]);

        const normalizedContent = normalizeArticleContent(news.content);
        const article = { ...news, content: normalizedContent, nextArticle, prevArticle };
        const description = stripHtml(news.excerpt || news.title).slice(0, 160);
        const canonicalUrl = `${SITE_URL}/novinky/${news.slug}`;
        const image = absoluteUrl(news.thumbnailUrl) || `${SITE_URL}/images/og-default.png`;
        const authorName = news.authorName || news.author?.realName || news.author?.username || SITE_NAME;

        const jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: news.title,
            description,
            image: [image],
            datePublished: news.publishedDate.toISOString(),
            dateModified: news.updatedAt.toISOString(),
            author: [{ '@type': 'Person', name: authorName }],
            publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
            mainEntityOfPage: canonicalUrl
        };

        const headExtras = [
            `<meta name="description" content="${escapeHtml(description)}">`,
            `<link rel="canonical" href="${canonicalUrl}">`,
            `<meta property="og:title" content="${escapeHtml(news.title)}">`,
            `<meta property="og:description" content="${escapeHtml(description)}">`,
            `<meta property="og:url" content="${canonicalUrl}">`,
            `<meta property="article:published_time" content="${news.publishedDate.toISOString()}">`,
            `<script type="application/ld+json">${inlineJson(jsonLd)}</script>`,
            `<script>window.__ARTICLE__ = ${inlineJson(article)};</script>`
        ].join('\n    ');

        const dateCz = news.publishedDate.toLocaleDateString('cs-CZ');

        html = html
            .replace('<title>Článek - Šachový oddíl TJ Bižuterie Jablonec</title>',
                `<title>${escapeHtml(news.title)} — ${SITE_NAME}</title>`)
            .replace('content="https://sachyjablonec.cz/images/og-default.png"', `content="${image}"`)
            .replace('</head>', `    ${headExtras}\n</head>`)
            // Prerender pro crawlery bez JS; klientský renderArticle() pak tytéž uzly přepíše identickým obsahem
            .replace('<div id="loading" style="text-align: center; padding: 4rem;">', '<div id="loading" style="display: none;">')
            .replace('<article id="article" class="hidden">', '<article id="article">')
            .replace('<span id="articleDate"><i class="fa-regular fa-calendar"></i> </span>',
                `<span id="articleDate"><i class="fa-regular fa-calendar"></i> ${dateCz}</span>`)
            .replace('<span id="articleCategory"><i class="fa-solid fa-tag"></i> </span>',
                `<span id="articleCategory"><i class="fa-solid fa-tag"></i> ${escapeHtml(news.category)}</span>`)
            .replace('<h1 id="articleTitle" style="font-size: 2.25rem; margin-bottom: 1.5rem;"></h1>',
                `<h1 id="articleTitle" style="font-size: 2.25rem; margin-bottom: 1.5rem;">${escapeHtml(news.title)}</h1>`)
            .replace('<div class="article-content" id="articleBody"></div>',
                `<div class="article-content" id="articleBody">${normalizedContent}</div>`);

        res.send(html);
    } catch (error) {
        console.error('Render article page error:', error);
        res.status(500).send('Internal server error');
    }
};

// 301 ze starých /article(.html)?id=X na /novinky/<slug>; defaultId pro pevné aliasy (bleskovy_report)
export const redirectLegacyArticle = (defaultId = null) => async (req, res) => {
    const id = parseInt(req.query.id || defaultId);
    if (!id) return res.redirect(301, '/');
    try {
        const news = await prisma.news.findUnique({ where: { id }, select: { slug: true } });
        if (!news || !news.slug) return res.redirect(301, '/');
        return res.redirect(301, `/novinky/${news.slug}`);
    } catch (error) {
        console.error('Legacy article redirect error:', error);
        return res.redirect(301, '/');
    }
};

// Dynamická sitemap: statické stránky + publikované články
const STATIC_PAGES = ['', '/about', '/teams', '/tournaments', '/youth', '/blicak', '/rapidy',
    '/calendar', '/gallery', '/training', '/partie', '/individual-competitions',
    '/club-tournaments', '/chess-database', '/puzzle-racer', '/privacy'];

export const serveSitemap = async (req, res) => {
    try {
        const articles = await prisma.news.findMany({
            where: { isPublished: true, publishedDate: { lte: new Date() } },
            select: { slug: true, updatedAt: true },
            orderBy: { publishedDate: 'desc' }
        });
        const urls = [
            ...STATIC_PAGES.map(p => `    <url><loc>${SITE_URL}${p || '/'}</loc></url>`),
            ...articles.map(a => `    <url><loc>${SITE_URL}/novinky/${a.slug}</loc><lastmod>${a.updatedAt.toISOString().slice(0, 10)}</lastmod></url>`)
        ];
        res.type('application/xml').send(
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
    } catch (error) {
        console.error('Sitemap error:', error);
        res.status(500).send('Internal server error');
    }
};
