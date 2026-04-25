import { describe, it, expect } from 'vitest';
import { matchesBlunderRule } from '../../src/services/blunderService.js';

describe('matchesBlunderRule — Position-based blunder klasifikace', () => {
    describe('(A) Vypuštěná výhra (eval ≥ +2 → ≤ +1 gray zone)', () => {
        it('+5 → +1 = blunder (vypustil výhru do gray zone)', () => {
            expect(matchesBlunderRule(5, 1)).toBe(true);
        });

        it('+5 → +2 = NE (pořád jasná výhra)', () => {
            expect(matchesBlunderRule(5, 2)).toBe(false);
        });

        it('+5 → 0 = blunder', () => {
            expect(matchesBlunderRule(5, 0)).toBe(true);
        });

        it('+5 → -3 = blunder', () => {
            expect(matchesBlunderRule(5, -3)).toBe(true);
        });

        it('+3 → +1.5 = NE (stále výhra, jen menší)', () => {
            expect(matchesBlunderRule(3, 1.5)).toBe(false);
        });

        it('+2 → +1 = blunder (hraniční vypuštěná výhra)', () => {
            expect(matchesBlunderRule(2, 1)).toBe(true);
        });

        it('+1.9 → +0.5 = NE (nebyla to ještě jasná výhra ≥ +2)', () => {
            // První rule: 1.9 < 2 → ne. Druhá rule: 1.9 ≥ -0.5 ✓, 0.5 > -1 → ne. → NE
            expect(matchesBlunderRule(1.9, 0.5)).toBe(false);
        });
    });

    describe('(B) Obrácený výsledek (≥ -0.5 → ≤ -1)', () => {
        it('0 → -3 = blunder (z remízy do prohry)', () => {
            expect(matchesBlunderRule(0, -3)).toBe(true);
        });

        it('+0.5 → -1.2 = blunder (drobná převaha do ztráty)', () => {
            expect(matchesBlunderRule(0.5, -1.2)).toBe(true);
        });

        it('+1 → -1 = blunder (převaha do prohry)', () => {
            expect(matchesBlunderRule(1, -1)).toBe(true);
        });

        it('-0.5 → -2 = blunder (lehce horší, ale ještě remíza, do ztráty)', () => {
            expect(matchesBlunderRule(-0.5, -2)).toBe(true);
        });

        it('0 → -0.8 = NE (jen mírné kolísání kolem rovnováhy)', () => {
            expect(matchesBlunderRule(0, -0.8)).toBe(false);
        });

        it('-1 → -3 = NE (už byl v prohře, nezhoršuje výsledek)', () => {
            expect(matchesBlunderRule(-1, -3)).toBe(false);
        });
    });

    describe('Hraniční / nesprávné případy', () => {
        it('-2 → -5 = NE (už předtím ztracené)', () => {
            expect(matchesBlunderRule(-2, -5)).toBe(false);
        });

        it('+3 → +5 = NE (zlepšení)', () => {
            expect(matchesBlunderRule(3, 5)).toBe(false);
        });

        it('null hodnoty = NE', () => {
            expect(matchesBlunderRule(null, -1)).toBe(false);
            expect(matchesBlunderRule(2, null)).toBe(false);
            expect(matchesBlunderRule(null, null)).toBe(false);
        });
    });

    describe('Mate hodnoty (jako extrémní pawny ±999)', () => {
        it('Mat v ruce (999) → ztráta (-1.5) = blunder', () => {
            expect(matchesBlunderRule(999, -1.5)).toBe(true);
        });

        it('Mat v ruce (999) → drtivá ztráta (-999) = blunder', () => {
            expect(matchesBlunderRule(999, -999)).toBe(true);
        });

        it('Z prohraného matu (-999) → ještě prohraný (-5) = NE', () => {
            expect(matchesBlunderRule(-999, -5)).toBe(false);
        });
    });
});
