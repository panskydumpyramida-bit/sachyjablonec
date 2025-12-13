import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get games filtered by news category
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;

        console.log('Fetching games with category:', category);

        if (!category) {
            return res.status(400).json({ error: 'Category parameter is required' });
        }

        // Find all news in this category that have games
        const limit = 50; // Safety limit

        // We need to fetch games that belong to news in this category
        // The relation is Game -> News
        const games = await prisma.game.findMany({
            where: {
                news: {
                    category: category,
                    isPublished: true // Only published news
                }
            },
            include: {
                news: {
                    select: {
                        id: true,
                        title: true,
                        publishedDate: true
                    }
                }
            },
            orderBy: {
                news: {
                    publishedDate: 'desc'
                }
            },
            take: 200 // Reasonable limit for all games in a section
        });

        // Also fetch legacy games stored in JSON if needed? 
        // No, we migrated them. But existing logic suggests we migrated "gamesJson" to "Game" table.
        // If migration is complete, we rely solely on Game table.

        // Map to viewer format
        const formattedGames = games.map(g => ({
            title: g.gameTitle,
            white: g.whitePlayer,
            black: g.blackPlayer,
            // Use chessComId or PGN if we had it, currently utilizing chessComId
            chessComId: g.chessComId,
            gameId: g.chessComId, // Backwards compat
            result: '*', // We don't store result in Game model yet, maybe parse from title? 
            // Title is usually "1. Duda - Vacek" or "0-1 Duda - Vacek"
            date: g.news?.publishedDate,
            newsId: g.newsId,
            newsTitle: g.news?.title,
            // Add team if we have it stored or derived? Schema has 'team' column
            team: g.team
        }));

        res.json(formattedGames);
    } catch (error) {
        console.error('Error fetching viewer games:', error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});

export default router;
