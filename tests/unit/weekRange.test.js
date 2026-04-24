import { describe, it, expect } from 'vitest';
import { getPragueWeekRange } from '../../src/utils/weekRange.js';

// Helper: formátuje UTC Date jako Prague local string pro snazší assertion
function pragueStr(d) {
    return d.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' });
}

describe('getPragueWeekRange', () => {
    it('Pondělí 00:30 Praha (letní čas) — skóre patří do tohoto týdne, ne do předchozího', () => {
        const d = new Date('2026-04-27T00:30:00+02:00'); // Po 27.4. 00:30 CEST
        const w = getPragueWeekRange(d);
        expect(w.weekNum).toBe(18);
        expect(pragueStr(w.start)).toBe('27. 4. 2026 0:00:00');
        expect(pragueStr(w.end)).toBe('3. 5. 2026 23:59:59');
        // Start musí být ≤ input a end ≥ input
        expect(w.start.getTime()).toBeLessThanOrEqual(d.getTime());
        expect(w.end.getTime()).toBeGreaterThanOrEqual(d.getTime());
    });

    it('Neděle 23:59 Praha — stále končí týden', () => {
        const d = new Date('2026-04-26T23:59:00+02:00'); // Ne 26.4. 23:59 CEST
        const w = getPragueWeekRange(d);
        expect(w.weekNum).toBe(17);
        expect(pragueStr(w.start)).toBe('20. 4. 2026 0:00:00');
        expect(pragueStr(w.end)).toBe('26. 4. 2026 23:59:59');
    });

    it('DST start — Po po přechodu (29.3. 2026 02:00→03:00 CEST)', () => {
        // 30.3. 2026 je pondělí po DST startu
        const d = new Date('2026-03-30T00:30:00+02:00'); // 00:30 CEST
        const w = getPragueWeekRange(d);
        expect(w.weekNum).toBe(14);
        expect(pragueStr(w.start)).toBe('30. 3. 2026 0:00:00');
        expect(pragueStr(w.end)).toBe('5. 4. 2026 23:59:59');
    });

    it('DST end den — Ne 25.10. 2026 po přechodu CEST→CET', () => {
        // Po 02:30 CEST, DST končí 25.10. 03:00→02:00 CET
        const d = new Date('2026-10-25T12:00:00+01:00'); // 12:00 CET
        const w = getPragueWeekRange(d);
        expect(w.weekNum).toBe(43);
        expect(pragueStr(w.start)).toBe('19. 10. 2026 0:00:00');
        expect(pragueStr(w.end)).toBe('25. 10. 2026 23:59:59');
    });

    it('Týden na přelomu roku — ISO week 53 / 01', () => {
        // Čt 31.12. 2026 by měl být ve week 53 (ISO — protože 2027 začíná v pátek)
        const d = new Date('2026-12-31T10:00:00+01:00');
        const w = getPragueWeekRange(d);
        expect(w.weekNum).toBe(53);
        expect(pragueStr(w.start)).toBe('28. 12. 2026 0:00:00');
    });

    it('Start týdne vždy pondělí 00:00, end neděle 23:59:59', () => {
        // Test na 7 různých dnů téhož týdne → všechny vrátí stejný start/end
        const monday = new Date('2026-04-27T05:00:00+02:00');
        const baseRange = getPragueWeekRange(monday);
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday.getTime() + i * 86400000);
            const r = getPragueWeekRange(d);
            expect(r.start.getTime()).toBe(baseRange.start.getTime());
            expect(r.end.getTime()).toBe(baseRange.end.getTime());
        }
    });
});
