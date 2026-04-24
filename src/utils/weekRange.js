/**
 * Prague-timezone-aware ISO week boundaries.
 *
 * Dva důvody pro tento modul:
 * 1. Railway PostgreSQL i Node server běží v UTC, ale uživatelé jsou v Europe/Prague.
 *    Bez explicitní TZ konverze hráč v Po 00:30 Praha (= Ne 22:30 UTC) skóruje do
 *    předchozího týdne.
 * 2. Tři místa v racer.js měla každé svůj vlastní výpočet týdne — jedno místo pravdy.
 *
 * Implementace: použije Intl.DateTimeFormat pro detekci Prague TZ offsetu
 * a postaví UTC Date odpovídající pondělku 00:00 / neděli 23:59:59.999 v Praze.
 */

const TZ = 'Europe/Prague';

// Získá { year, month, day, hour, minute, second } dané UTC-timestamp v Prague TZ.
function getPragueParts(date) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        weekday: 'short',
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
    return {
        year: parseInt(parts.year, 10),
        month: parseInt(parts.month, 10),
        day: parseInt(parts.day, 10),
        hour: parseInt(parts.hour === '24' ? '0' : parts.hour, 10), // Intl může vrátit '24'
        minute: parseInt(parts.minute, 10),
        second: parseInt(parts.second, 10),
        weekday: parts.weekday, // Mon, Tue, ...
    };
}

// DOW v Praze (Mon=1, Tue=2, ..., Sun=7) — ISO 8601.
function pragueIsoDow(date) {
    const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    return map[getPragueParts(date).weekday] || 1;
}

// Odečte `days` dní ze stringu "YYYY-MM-DD" a vrátí nový "YYYY-MM-DD" (v Praze).
function subtractDays(ymd, days) {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - days);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

// Vrátí UTC timestamp odpovídající dané "YYYY-MM-DD HH:MM:SS.sss" lokálnímu času v Praze.
// Používá dva kroky (iterace) pro správnou handling DST.
function pragueLocalToUtc(ymd, hms = '00:00:00.000') {
    const [y, mo, d] = ymd.split('-').map(Number);
    const [hpart, mpart, ssPart] = hms.split(':');
    const [sPart, msPart = '000'] = ssPart.split('.');
    const h = parseInt(hpart, 10);
    const mi = parseInt(mpart, 10);
    const s = parseInt(sPart, 10);
    const ms = parseInt(msPart, 10);

    // Počáteční odhad: naivní UTC Date
    let guessUtc = Date.UTC(y, mo - 1, d, h, mi, s, ms);
    // Kontrola: jaký lokální čas to reprezentuje v Praze?
    for (let i = 0; i < 3; i++) { // max 3 iterace stačí pro DST
        const parts = getPragueParts(new Date(guessUtc));
        const actualY = parts.year, actualMo = parts.month, actualD = parts.day;
        const actualH = parts.hour, actualMi = parts.minute, actualS = parts.second;
        if (actualY === y && actualMo === mo && actualD === d && actualH === h && actualMi === mi && actualS === s) {
            return new Date(guessUtc);
        }
        const desiredUtc = Date.UTC(y, mo - 1, d, h, mi, s, ms);
        const actualUtc = Date.UTC(actualY, actualMo - 1, actualD, actualH, actualMi, actualS, 0);
        guessUtc += (desiredUtc - actualUtc);
    }
    return new Date(guessUtc);
}

// ISO week number algoritmus (Mon=1, Thu-based).
function isoWeekInfo(y, m, d) {
    // m: 1-12, d: 1-31
    const dt = new Date(Date.UTC(y, m - 1, d));
    const dayNum = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - dayNum); // posun na čtvrtek téhož ISO týdne
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
    return { weekNum, year: dt.getUTCFullYear() };
}

/**
 * Hranice aktuálního ISO týdne v Prague TZ.
 * @param {Date} [date] referenční čas (default: now)
 * @returns {{ start: Date, end: Date, year: number, weekNum: number }}
 *   start = pondělí 00:00:00.000 Europe/Prague (jako UTC Date)
 *   end   = neděle 23:59:59.999 Europe/Prague (jako UTC Date)
 */
export function getPragueWeekRange(date = new Date()) {
    const pragueToday = getPragueParts(date);
    const ymdToday = `${pragueToday.year}-${String(pragueToday.month).padStart(2, '0')}-${String(pragueToday.day).padStart(2, '0')}`;

    const dow = pragueIsoDow(date); // 1..7
    const ymdMon = subtractDays(ymdToday, dow - 1);
    const ymdNextMon = subtractDays(ymdToday, dow - 8); // Mon next week

    const start = pragueLocalToUtc(ymdMon, '00:00:00.000');
    // end = beginning of next Monday minus 1ms — DST-safe (avoids iterating at 23:59:59.999)
    const nextMonStart = pragueLocalToUtc(ymdNextMon, '00:00:00.000');
    const end = new Date(nextMonStart.getTime() - 1);

    const [my, mm, md] = ymdMon.split('-').map(Number);
    const { weekNum, year } = isoWeekInfo(my, mm, md);

    return { start, end, year, weekNum };
}
