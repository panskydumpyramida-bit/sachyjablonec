import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get games filtered by news category
// This endpoint reads from News.gamesJson field (legacy storage)
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;

        console.log('Fetching games with category:', category);

        if (!category) {
            return res.status(400).json({ error: 'Category parameter is required' });
        }

        // Fetch news articles with gamesJson in this category
        const newsWithGames = await prisma.news.findMany({
            where: {
                category: category,
                isPublished: true,
                gamesJson: {
                    not: null
                }
            },
            select: {
                id: true,
                title: true,
                publishedDate: true,
                gamesJson: true
            },
            orderBy: {
                publishedDate: 'desc'
            },
            take: 50
        });

        // Extract and flatten games from gamesJson
        const allGames = [];

        for (const news of newsWithGames) {
            if (!news.gamesJson) continue;

            try {
                let gamesData = news.gamesJson;

                // Handle double-encoded JSON
                if (typeof gamesData === 'string') {
                    gamesData = JSON.parse(gamesData);
                }

                // Skip if empty or not array
                if (!Array.isArray(gamesData) || gamesData.length === 0) continue;

                // Map each game with news context
                for (const game of gamesData) {
                    // Parse player names from title like "1. Sýkora - Fraňa"
                    let white = 'Bílý';
                    let black = 'Černý';

                    if (game.title) {
                        const titleMatch = game.title.match(/^\d*\.?\s*(.+?)\s*[-–]\s*(.+)$/);
                        if (titleMatch) {
                            white = titleMatch[1].trim();
                            black = titleMatch[2].trim();
                        }
                    }

                    allGames.push({
                        title: game.title || `${white} - ${black}`,
                        white: game.white || white,
                        black: game.black || black,
                        chessComId: game.gameId || game.chessComId,
                        gameId: game.gameId || game.chessComId,
                        result: game.result || '*',
                        date: news.publishedDate,
                        newsId: news.id,
                        newsTitle: news.title,
                        team: game.team,
                        pgn: game.pgn,
                        src: game.src // Chess.com embed URL
                    });
                }
            } catch (parseError) {
                console.error(`Error parsing gamesJson for news ${news.id}:`, parseError);
            }
        }

        console.log(`Found ${allGames.length} games in ${newsWithGames.length} news articles`);
        res.json(allGames);
    } catch (error) {
        console.error('Error fetching viewer games:', error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});

export default router;
