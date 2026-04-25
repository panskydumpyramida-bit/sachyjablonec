import { describe, it, expect } from 'vitest';
import { matchesBlunderRule } from '../../src/services/blunderService.js';

describe('matchesBlunderRule — Position-based blunder klasifikace', () => {
    describe('(a) Vypuštěná výhra (eval ≥ +2.5 → < -1)', () => {
        it('Jasná výhra (+3) → ztráta (-1.5) = blunder', () => {
            expect(matchesBlunderRule(3.0, -1.5)).toBe(true);
        });

        it('Drtivá výhra (+5) → mírná ztráta (-1.1) = blunder', () => {
            expect(matchesBlunderRule(5.0, -1.1)).toBe(true);
        });

        it('Hraniční výhra (+2.5) → -1.5 = blunder', () => {
            expect(matchesBlunderRule(2.5, -1.5)).toBe(true);
        });

        it('Téměř výhra (+2.4) → -1.5 = NE blunder (nedosáhl prahu výhry)', () => {
            // Spadne pod (a) ale splní (b) protože evalBefore ≥ 1
            expect(matchesBlunderRule(2.4, -1.5)).toBe(true); // splňuje (b)
        });

        it('Výhra (+3) → -0.9 = NE (nedostal se pod -1)', () => {
            expect(matchesBlunderRule(3.0, -0.9)).toBe(false);
        });
    });

    describe('(b) Obrácení partie (eval ≥ +1 → ≤ -1)', () => {
        it('Lehčí převaha (+1.2) → ztráta (-1.5) = blunder', () => {
            expect(matchesBlunderRule(1.2, -1.5)).toBe(true);
        });

        it('Hraniční převaha (+1.0) → -1.0 = blunder', () => {
            expect(matchesBlunderRule(1.0, -1.0)).toBe(true);
        });

        it('Slabá výhoda (+0.5) → ztráta (-2) = NE (nepřekročil práh +1)', () => {
            expect(matchesBlunderRule(0.5, -2.0)).toBe(false);
        });
    });

    describe('Hraniční / nesprávné případy', () => {
        it('Equal (0) → -3 = NE (nebylo co vypustit)', () => {
            expect(matchesBlunderRule(0, -3)).toBe(false);
        });

        it('Z prohrané pozice (-2) → -5 = NE', () => {
            expect(matchesBlunderRule(-2, -5)).toBe(false);
        });

        it('Z výhry (+3) → větší výhra (+5) = NE (zlepšení)', () => {
            expect(matchesBlunderRule(3, 5)).toBe(false);
        });

        it('Mírný drop ve výhře (+3 → +1) = NE', () => {
            expect(matchesBlunderRule(3, 1)).toBe(false);
        });

        it('null hodnoty = NE', () => {
            expect(matchesBlunderRule(null, -1)).toBe(false);
            expect(matchesBlunderRule(2, null)).toBe(false);
            expect(matchesBlunderRule(null, null)).toBe(false);
        });
    });

    describe('Mate hodnoty (jako extrémní pawny)', () => {
        it('Mat v ruce (999) → ztráta (-1.5) = blunder', () => {
            expect(matchesBlunderRule(999, -1.5)).toBe(true);
        });

        it('Mat v ruce (999) → drtivá ztráta (-999) = blunder', () => {
            expect(matchesBlunderRule(999, -999)).toBe(true);
        });

        it('Z prohraného matu (-999) → výhra (+5) = NE (nebyla to chyba)', () => {
            expect(matchesBlunderRule(-999, 5)).toBe(false);
        });
    });
});
