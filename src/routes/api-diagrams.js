import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { fetchPagePostsWithInsights } from '../services/facebookService.js';

const prisma = new PrismaClient();
const router = express.Router();

// --- Facebook dashboard helpers ---
function fbReadInsight(post, name) {
    const arr = post.insights && post.insights.data;
    if (!arr) return null;
    const m = arr.find(x => x.name === name);
    if (!m || !m.values || !m.values.length) return null;
    const v = m.values[0].value;
    if (v && typeof v === 'object') return Object.values(v).reduce((a, b) => a + (Number(b) || 0), 0);
    return Number(v) || 0;
}
function fbMedian(nums) {
    if (!nums.length) return null;
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

// --- Diagram API ---
router.get('/diagrams', authMiddleware, async (req, res) => {
    try {
        const where = {};
        if (req.query.mine === 'true' && req.user) {
            where.userId = req.user.id;
        }
        const diagrams = await prisma.diagram.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { user: { select: { username: true } } }
        });
        res.json(diagrams);
    } catch (error) {
        console.error('Error fetching diagrams:', error);
        res.status(500).json({ error: 'Failed to fetch diagrams' });
    }
});

router.get('/diagrams/:id', authMiddleware, async (req, res) => {
    try {
        const diagram = await prisma.diagram.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { user: { select: { username: true } } }
        });
        if (!diagram) return res.status(404).json({ error: 'Diagram not found' });
        res.json(diagram);
    } catch (error) {
        console.error('Error fetching diagram:', error);
        res.status(500).json({ error: 'Failed to fetch diagram' });
    }
});

router.post('/diagrams', authMiddleware, async (req, res) => {
    try {
        const { fen, annotations, solution, name, description } = req.body;

        if (!fen) return res.status(400).json({ error: 'FEN string is required' });

        const diagram = await prisma.diagram.create({
            data: {
                fen,
                annotations: annotations || {},
                solution: solution || {}, 
                name: name || `Diagram ${new Date().toLocaleString('cs-CZ')}`,
                description,
                userId: req.user.id
            }
        });
        res.json(diagram);
    } catch (error) {
        console.error('Error creating diagram:', error);
        res.status(500).json({ error: 'Failed to create diagram' });
    }
});

router.put('/diagrams/:id', authMiddleware, async (req, res) => {
    try {
        const { fen, annotations, solution, name, description } = req.body;
        const id = parseInt(req.params.id);

        const existing = await prisma.diagram.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Diagram not found' });

        const diagram = await prisma.diagram.update({
            where: { id },
            data: {
                fen,
                annotations: annotations || {},
                solution: solution || {},
                name,
                description
            }
        });
        res.json(diagram);
    } catch (error) {
        console.error('Error updating diagram:', error);
        res.status(500).json({ error: 'Failed to update diagram' });
    }
});

router.delete('/diagrams/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.diagram.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting diagram:', error);
        res.status(500).json({ error: 'Failed to delete diagram' });
    }
});

// --- Fragment API ---
router.get('/fragments', async (req, res) => {
    try {
        const where = {};
        if (req.query.mine === 'true') {
            try {
                const authHeader = req.headers.authorization;
                if (authHeader) {
                    const token = authHeader.replace('Bearer ', '');
                    const jwt = await import('jsonwebtoken');
                    const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
                    where.userId = decoded.id;
                }
            } catch (e) { /* ignore auth errors for filtering */ }
        }
        const fragments = await prisma.fragment.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: { user: { select: { username: true } } }
        });
        res.json(fragments);
    } catch (error) {
        console.error('Error fetching fragments:', error);
        res.status(500).json({ error: 'Failed to fetch fragments' });
    }
});

router.get('/fragments/:id', async (req, res) => {
    try {
        const fragment = await prisma.fragment.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { user: { select: { username: true } } }
        });
        if (!fragment) return res.status(404).json({ error: 'Fragment not found' });
        res.json(fragment);
    } catch (error) {
        console.error('Error fetching fragment:', error);
        res.status(500).json({ error: 'Failed to fetch fragment' });
    }
});

router.post('/fragments', authMiddleware, async (req, res) => {
    try {
        const { title, pgn, startFen, fromMove, toMove, sourceGameId, white, black } = req.body;

        if (!pgn || !startFen) return res.status(400).json({ error: 'PGN and startFen are required' });

        const fragment = await prisma.fragment.create({
            data: {
                title: title || `Fragment ${new Date().toLocaleString('cs-CZ')}`,
                pgn,
                startFen,
                fromMove: fromMove || 1,
                toMove: toMove || 99,
                sourceGameId: sourceGameId || null,
                white: white || null,
                black: black || null,
                userId: req.user.id
            }
        });
        res.json(fragment);
    } catch (error) {
        console.error('Error creating fragment:', error);
        res.status(500).json({ error: 'Failed to create fragment' });
    }
});

router.put('/fragments/:id', authMiddleware, async (req, res) => {
    try {
        const { title, pgn, startFen, fromMove, toMove, white, black } = req.body;
        const data = {};
        if (title !== undefined) data.title = title;
        if (pgn !== undefined) data.pgn = pgn;
        if (startFen !== undefined) data.startFen = startFen;
        if (fromMove !== undefined) data.fromMove = fromMove;
        if (toMove !== undefined) data.toMove = toMove;
        if (white !== undefined) data.white = white;
        if (black !== undefined) data.black = black;
        const fragment = await prisma.fragment.update({
            where: { id: parseInt(req.params.id) },
            data
        });
        res.json(fragment);
    } catch (error) {
        console.error('Error updating fragment:', error);
        res.status(500).json({ error: 'Failed to update fragment' });
    }
});

router.delete('/fragments/:id', authMiddleware, async (req, res) => {
    try {
        await prisma.fragment.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting fragment:', error);
        res.status(500).json({ error: 'Failed to delete fragment' });
    }
});

// --- Facebook dashboard: posty stránky + dosah, naše vs nativní ---
router.get('/admin/facebook/posts', authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { posts, insightsAvailable, appId } = await fetchPagePostsWithInsights(50);

        // Naše post id z DB (deterministické rozlišení náš vs nativní)
        const newsRows = await prisma.news.findMany({
            where: { facebookPostId: { not: null } },
            select: { id: true, title: true, facebookPostId: true },
        });
        const ourMap = new Map(newsRows.map(n => [n.facebookPostId, n]));

        const out = posts.map(p => {
            const reach = fbReadInsight(p, 'post_total_media_view_unique');
            const impressions = fbReadInsight(p, 'post_media_view');
            const clicks = fbReadInsight(p, 'post_clicks');
            const reactions = fbReadInsight(p, 'post_reactions_by_type_total');
            const engaged = (clicks == null && reactions == null) ? null : (clicks || 0) + (reactions || 0);
            const news = ourMap.get(p.id);
            const isOurs = !!news || (appId && p.application && String(p.application.id) === String(appId));
            return {
                id: p.id,
                date: p.created_time || null,
                text: (p.message || '').slice(0, 140),
                permalink: p.permalink_url || null,
                image: p.full_picture || null,
                reach, impressions, engaged,
                source: isOurs ? 'ours' : 'native',
                articleId: news ? news.id : null,
            };
        });

        const agg = (src) => {
            const grp = out.filter(p => p.source === src);
            const reaches = grp.map(p => p.reach).filter(r => r != null);
            const engs = grp.map(p => p.engaged).filter(e => e != null);
            const avg = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
            return { count: grp.length, reachAvg: avg(reaches), reachMedian: fbMedian(reaches), engagedAvg: avg(engs) };
        };
        const ours = agg('ours'), native = agg('native');
        const reachAvgDeltaPct = (ours.reachAvg != null && native.reachAvg)
            ? Math.round((ours.reachAvg - native.reachAvg) / native.reachAvg * 100) : null;

        res.json({
            posts: out,
            aggregate: { ours, native, reachAvgDeltaPct },
            meta: {
                insightsAvailable,
                appIdConfigured: !!appId,
                postsWithoutReach: out.filter(p => p.reach == null).length,
            },
        });
    } catch (e) {
        console.error('[FB dashboard] error:', e);
        res.status(500).json({ error: e.message || 'Failed to load Facebook posts' });
    }
});

export default router;
