import { describe, expect, it } from 'vitest';
import {
    buildDifficultyPlan,
    calculateAttemptSummary,
    calculatePuzzlePoints,
    getCampAchievements,
    getCampLevel,
    getCampSessionStatus,
    normalizeCampConfig
} from '../../src/services/puzzleCampService.js';

describe('Pardubice 2026 puzzle camp service', () => {
    it('normalizes trainer settings into safe limits', () => {
        const config = normalizeCampConfig({
            title: '  Úterní rozcvička  ',
            startDelaySeconds: 2,
            durationSeconds: 4000,
            puzzleCount: 200,
            puzzleTheme: '../bad',
            livesEnabled: true,
            maxLives: 0
        });

        expect(config).toMatchObject({
            title: 'Úterní rozcvička',
            startDelaySeconds: 10,
            durationSeconds: 900,
            puzzleCount: 100,
            puzzleTheme: 'mix',
            livesEnabled: true,
            maxLives: 1
        });
    });

    it('spreads forty shared puzzles evenly across difficulty levels', () => {
        const plan = buildDifficultyPlan(40);
        expect(plan.map(item => item.count)).toEqual([8, 8, 8, 8, 8]);
        expect(plan.reduce((sum, item) => sum + item.count, 0)).toBe(40);
    });

    it('derives scheduled, live and finished state from the server clock', () => {
        const session = { startsAt: '2026-07-18T08:00:00.000Z', durationSeconds: 240, status: 'scheduled' };
        expect(getCampSessionStatus(session, new Date('2026-07-18T07:59:59.000Z'))).toBe('scheduled');
        expect(getCampSessionStatus(session, new Date('2026-07-18T08:02:00.000Z'))).toBe('live');
        expect(getCampSessionStatus(session, new Date('2026-07-18T08:04:00.000Z'))).toBe('finished');
    });

    it('rewards speed and penalizes wrong attempts without negative solved points', () => {
        expect(calculatePuzzlePoints({ correct: true, skipped: false, responseMs: 2000, wrongAttempts: 0 })).toBe(180);
        expect(calculatePuzzlePoints({ correct: true, skipped: false, responseMs: 15000, wrongAttempts: 10 })).toBe(25);
        expect(calculatePuzzlePoints({ correct: false, skipped: false, responseMs: 1000, wrongAttempts: 0 })).toBe(0);
    });

    it('calculates streak bonuses and complete attempt statistics', () => {
        const summary = calculateAttemptSummary([
            { puzzleIndex: 0, correct: true, skipped: false, responseMs: 2000, wrongAttempts: 0 },
            { puzzleIndex: 1, correct: true, skipped: false, responseMs: 5000, wrongAttempts: 1 },
            { puzzleIndex: 2, correct: false, skipped: true, responseMs: 1000, wrongAttempts: 1 }
        ]);

        expect(summary).toMatchObject({
            score: 320,
            correctCount: 2,
            wrongCount: 2,
            skippedCount: 1,
            maxStreak: 2,
            puzzleCount: 3,
            durationMs: 8000
        });
        expect(summary.scoredResults.map(result => result.points)).toEqual([180, 140, 0]);
    });

    it('awards camp levels and playful achievements from verified stats', () => {
        expect(getCampLevel(7500)).toMatchObject({ name: 'Střelec výpravy', progress: 10, nextAt: 12000 });
        expect(getCampAchievements({
            correctCount: 25,
            wrongCount: 0,
            maxStreak: 12,
            durationMs: 100000,
            puzzleCount: 40
        }).map(item => item.code)).toEqual(['clean', 'combo10', 'engine', 'flash', 'finisher']);
    });
});
