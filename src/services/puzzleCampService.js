export const CAMP_CODE = 'pardubice-2026';
export const CAMP_NAME = 'Pardubice 2026';
export const CAMP_DIFFICULTIES = ['easiest', 'easier', 'normal', 'harder', 'hardest'];
export const CAMP_LEVELS = [
    { min: 0, name: 'Pěšec výpravy', icon: '♟' },
    { min: 3000, name: 'Jezdec výpravy', icon: '♞' },
    { min: 7000, name: 'Střelec výpravy', icon: '♝' },
    { min: 12000, name: 'Věž výpravy', icon: '♜' },
    { min: 20000, name: 'Dáma výpravy', icon: '♛' },
    { min: 30000, name: 'Velmistr soustředění', icon: '♚' }
];

const clampInt = (value, fallback, min, max) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export function normalizeCampConfig(input = {}) {
    const title = String(input.title || 'Denní rozcvička').trim().slice(0, 80) || 'Denní rozcvička';
    const theme = /^[a-zA-Z]+$/.test(input.puzzleTheme || '') ? input.puzzleTheme : 'mix';

    return {
        campCode: CAMP_CODE,
        campName: CAMP_NAME,
        title,
        startDelaySeconds: clampInt(input.startDelaySeconds, 180, 10, 3600),
        durationSeconds: clampInt(input.durationSeconds, 240, 60, 900),
        puzzleCount: clampInt(input.puzzleCount, 40, 5, 100),
        puzzleTheme: theme,
        livesEnabled: input.livesEnabled === true,
        maxLives: clampInt(input.maxLives, 5, 1, 20),
        penaltyEnabled: input.penaltyEnabled !== false,
        penaltySeconds: clampInt(input.penaltySeconds, 3, 1, 60),
        skipOnMistake: input.skipOnMistake !== false
    };
}

export function buildDifficultyPlan(count) {
    const total = clampInt(count, 40, 5, 100);
    const base = Math.floor(total / CAMP_DIFFICULTIES.length);
    const remainder = total % CAMP_DIFFICULTIES.length;

    return CAMP_DIFFICULTIES.map((difficulty, index) => ({
        difficulty,
        count: base + (index < remainder ? 1 : 0)
    }));
}

export function getCampSessionStatus(session, now = new Date()) {
    if (!session) return 'none';
    if (session.status === 'cancelled') return 'cancelled';
    if (session.status === 'finished') return 'finished';

    const startsAt = new Date(session.startsAt);
    const endsAt = new Date(startsAt.getTime() + session.durationSeconds * 1000);
    if (now < startsAt) return 'scheduled';
    if (now < endsAt) return 'live';
    return 'finished';
}

export function getCampLevel(score = 0) {
    const safeScore = Math.max(0, Number.parseInt(score, 10) || 0);
    let index = 0;
    for (let i = 0; i < CAMP_LEVELS.length; i++) {
        if (safeScore >= CAMP_LEVELS[i].min) index = i;
    }
    const level = CAMP_LEVELS[index];
    const next = CAMP_LEVELS[index + 1] || null;
    const span = next ? next.min - level.min : 1;
    return {
        ...level,
        nextAt: next?.min || null,
        progress: next ? Math.round(((safeScore - level.min) / span) * 100) : 100
    };
}

export function getCampAchievements(attempt = {}) {
    const achievements = [];
    const correct = attempt.correctCount || 0;
    const wrong = attempt.wrongCount || 0;
    const maxStreak = attempt.maxStreak || 0;
    const durationMs = attempt.durationMs || 0;
    const averageMs = correct > 0 ? durationMs / correct : Infinity;

    if (correct > 0 && wrong === 0) achievements.push({ code: 'clean', icon: '🎯', name: 'Čistá šachovnice', description: 'Bez jediného chybného tahu' });
    if (maxStreak >= 10) achievements.push({ code: 'combo10', icon: '🔥', name: 'Desítkové kombo', description: '10 správných úloh v řadě' });
    if (correct >= 20) achievements.push({ code: 'engine', icon: '⚙️', name: 'Taktický motor', description: 'Alespoň 20 vyřešených úloh' });
    if (correct >= 5 && averageMs <= 5000) achievements.push({ code: 'flash', icon: '⚡', name: 'Pardubický blesk', description: 'Průměr pod 5 sekund' });
    if (attempt.puzzleCount >= 40) achievements.push({ code: 'finisher', icon: '🏁', name: 'Do poslední úlohy', description: 'Dokončena celá čtyřicítka' });
    return achievements;
}

export function calculatePuzzlePoints({ correct, skipped, responseMs, wrongAttempts }) {
    if (!correct || skipped) return 0;
    const safeResponse = clampInt(responseMs, 0, 0, 900000);
    const safeWrong = clampInt(wrongAttempts, 0, 0, 50);
    const speedBonus = Math.max(0, 100 - Math.floor(safeResponse / 100));
    return Math.max(25, 100 + speedBonus - safeWrong * 15);
}

export function normalizeCampMove(value) {
    const move = String(value || '').trim().toLowerCase();
    return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) ? move : null;
}

export function calculateAttemptSummary(results = []) {
    const ordered = [...results].sort((a, b) => a.puzzleIndex - b.puzzleIndex);
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    let durationMs = 0;

    const scoredResults = ordered.map(result => {
        const correct = result.correct === true && result.skipped !== true;
        const wrongAttempts = clampInt(result.wrongAttempts, 0, 0, 50);
        const responseMs = clampInt(result.responseMs, 0, 0, 900000);
        const basePoints = calculatePuzzlePoints({ ...result, correct, wrongAttempts, responseMs });

        if (correct) {
            correctCount++;
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            currentStreak = 0;
        }

        if (result.skipped) skippedCount++;
        wrongCount += wrongAttempts;
        durationMs += responseMs;

        const streakBonus = correct ? Math.min(50, Math.max(0, currentStreak - 1) * 5) : 0;
        const points = basePoints + streakBonus;
        score += points;

        return { ...result, correct, wrongAttempts, responseMs, points };
    });

    return {
        score,
        correctCount,
        wrongCount,
        skippedCount,
        maxStreak,
        puzzleCount: ordered.length,
        durationMs,
        scoredResults
    };
}
