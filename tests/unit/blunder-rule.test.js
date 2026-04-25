import { describe, it, expect } from 'vitest';
import { matchesBlunderRule } from '../../src/services/blunderService.js';

describe('matchesBlunderRule — Position-based blunder klasifikace', () => {
    describe('Vypuštěná výhra (gave-up-win branch)', () => {
        it('+5 → +1 = blunder (vypustil výhru do gray zone)', () => {
            expect(matchesBlunderRule(5, 1)).toBe(true);
        });

        it('+5 → +2 = NE (pořád jasná výhra)', () => {
            expect(matchesBlunderRule(5, 2)).toBe(false);
        });

        it('+5 → 0 = blunder', () => {
            expect(matchesBlunderRule(5, 0)).toBe(true);
        });

        it('+5 → -3 = blunder (drtivá otočka)', () => {
            expect(matchesBlunderRule(5, -3)).toBe(true);
        });

        it('+3 → +1.5 = NE (stále výhra)', () => {
            expect(matchesBlunderRule(3, 1.5)).toBe(false);
        });

        it('+2 → +1 = NE (malý rozdíl, drop < 2.5)', () => {
            expect(matchesBlunderRule(2, 1)).toBe(false);
        });

        it('+4 → +1 = blunder (drop 3 ≥ 2.5)', () => {
            expect(matchesBlunderRule(4, 1)).toBe(true);
        });
    });

    describe('Změna výsledku (now-losing branch)', () => {
        it('0 → -3 = blunder (z remízy do prohry)', () => {
            expect(matchesBlunderRule(0, -3)).toBe(true);
        });

        it('+1 → -2 = blunder', () => {
            expect(matchesBlunderRule(1, -2)).toBe(true);
        });

        it('-1 → -4 = blunder (drop 3 z lehce horší do drtivé)', () => {
            expect(matchesBlunderRule(-1, -4)).toBe(true);
        });

        it('-1 → -3 = NE (drop 2 < 2.5, hraniční)', () => {
            expect(matchesBlunderRule(-1, -3)).toBe(false);
        });

        it('+0.5 → -1.2 = NE (drop 1.7 < 2.5, gray zone)', () => {
            expect(matchesBlunderRule(0.5, -1.2)).toBe(false);
        });

        it('0 → -0.8 = NE (mírné kolísání, drop < 2.5 a evalAfter > -1)', () => {
            expect(matchesBlunderRule(0, -0.8)).toBe(false);
        });

        it('0 → -2.5 = blunder (přesně na hranici drop)', () => {
            expect(matchesBlunderRule(0, -2.5)).toBe(true);
        });
    });

    describe('Hraniční případy / nesplňuje předpoklady', () => {
        it('-2 → -5 = NE (už předtím v prohře, evalBefore < -1)', () => {
            expect(matchesBlunderRule(-2, -5)).toBe(false);
        });

        it('-1.5 → -4 = NE (evalBefore -1.5 < -1)', () => {
            expect(matchesBlunderRule(-1.5, -4)).toBe(false);
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

        it('Z prohraného matu (-999) → ještě prohraný (-5) = NE', () => {
            expect(matchesBlunderRule(-999, -5)).toBe(false);
        });
    });
});
