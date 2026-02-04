import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create slug from title
const createSlug = (title) => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
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
            orderBy: {
                publishedDate: 'desc'
            }
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
            select: { id: true, title: true }
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
            select: { id: true, title: true }
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
        const { title, category, excerpt, content, thumbnailUrl, linkUrl, publishedDate, isPublished, gamesJson, teamsJson, galleryJson, introJson, authorName, coAuthorId, coAuthorName } = req.body;

        // Only title is required
        if (!title) {
            return res.status(400).json({ error: 'Nadpis je povinný' });
        }

        // Smart defaults for optional fields
        const finalCategory = category || 'Novinky';
        const finalExcerpt = excerpt || '';
        const finalPublishedDate = publishedDate ? new Date(publishedDate) : new Date();

        let slug = createSlug(title); // Using existing createSlug

        // Ensure unique slug
        let uniqueSlug = slug;
        let counter = 1;
        while (await prisma.news.findUnique({ where: { slug: uniqueSlug } })) {
            uniqueSlug = `${slug}-${counter}`;
            counter++;
        }

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
                isPublished: isPublished || false,
                authorId: req.user ? req.user.id : null,
                authorName: authorName || null,
                coAuthorId: coAuthorId ? parseInt(coAuthorId) : null,
                coAuthorName: coAuthorName || null
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
        const { id } = req.params;
        const { title, category, excerpt, content, thumbnailUrl, linkUrl, publishedDate, isPublished, gamesJson, teamsJson, galleryJson, introJson, authorId, authorName, coAuthorId, coAuthorName } = req.body;

        const updateData = {};
        if (title) {
            updateData.title = title;
            let slug = createSlug(title);

            // Ensure unique slug (exclude current news id)
            let uniqueSlug = slug;
            let counter = 1;
            while (await prisma.news.findFirst({ where: { slug: uniqueSlug, NOT: { id: parseInt(id) } } })) {
                uniqueSlug = `${slug}-${counter}`;
                counter++;
            }
            updateData.slug = uniqueSlug;
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
