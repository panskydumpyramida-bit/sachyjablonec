import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createReport = async (req, res) => {
    try {
        const { newsId, matchDate, teamAName, teamBName, scoreA, scoreB, reportText, games } = req.body;

        if (!newsId || !matchDate || !teamAName || !teamBName) {
            return res.status(400).json({ error: 'Required fields missing' });
        }

        const report = await prisma.matchReport.create({
            data: {
                newsId,
                matchDate: new Date(matchDate),
                teamAName,
                teamBName,
                scoreA,
                scoreB,
                reportText,
                games: games ? {
                    create: games.map((game, index) => ({
                        gameTitle: game.gameTitle,
                        chessComId: game.chessComId,
                        team: game.team,
                        positionOrder: game.positionOrder || index,
                        isCommented: game.isCommented || false
                    }))
                } : undefined
            },
            include: {
                games: true
            }
        });

        res.status(201).json(report);
    } catch (error) {
        console.error('Create report error:', error);
        res.status(500).json({ error: 'Failed to create report' });
    }
};

export const getReport = async (req, res) => {
    try {
        const { id } = req.params;

        const report = await prisma.matchReport.findUnique({
            where: { id: parseInt(id) },
            include: {
                games: {
                    orderBy: {
                        positionOrder: 'asc'
                    }
                },
                news: true
            }
        });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json(report);
    } catch (error) {
        console.error('Get report error:', error);
        res.status(500).json({ error: 'Failed to get report' });
    }
};

export const updateReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { matchDate, teamAName, teamBName, scoreA, scoreB, reportText } = req.body;

        const updateData = {};
        if (matchDate) updateData.matchDate = new Date(matchDate);
        if (teamAName) updateData.teamAName = teamAName;
        if (teamBName) updateData.teamBName = teamBName;
        if (scoreA !== undefined) updateData.scoreA = scoreA;
        if (scoreB !== undefined) updateData.scoreB = scoreB;
        if (reportText !== undefined) updateData.reportText = reportText;

        const report = await prisma.matchReport.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                games: true
            }
        });

        res.json(report);
    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({ error: 'Failed to update report' });
    }
};

export const addGameToReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { gameTitle, chessComId, team, positionOrder, isCommented } = req.body;

        if (!gameTitle || !chessComId || !team) {
            return res.status(400).json({ error: 'Required fields missing' });
        }

        const game = await prisma.game.create({
            data: {
                reportId: parseInt(reportId),
                gameTitle,
                chessComId,
                team,
                positionOrder: positionOrder || 0,
                isCommented: isCommented || false
            }
        });

        res.status(201).json(game);
    } catch (error) {
        console.error('Add game error:', error);
        res.status(500).json({ error: 'Failed to add game' });
    }
};

export const deleteGame = async (req, res) => {
    try {
        const { gameId } = req.params;

        await prisma.game.delete({
            where: { id: parseInt(gameId) }
        });

        res.json({ message: 'Game deleted successfully' });
    } catch (error) {
        console.error('Delete game error:', error);
        res.status(500).json({ error: 'Failed to delete game' });
    }
};
