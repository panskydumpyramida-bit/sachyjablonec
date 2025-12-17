/**
 * Shared helper functions for scraping and text processing
 */

/**
 * Clean HTML text - remove tags, decode entities
 * @param {string} s - Raw HTML string
 * @returns {string} Cleaned text
 */
export const clean = (s) => {
    if (!s) return '';
    // Replace tags with space to prevent merging text
    let txt = s.replace(/<[^>]*>/g, ' ').trim();
    txt = txt.replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&frac12;/g, '½')
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
    // Collapse multiple spaces
    return txt.replace(/\s+/g, ' ').trim();
};

/**
 * Check if string looks like an Elo rating
 * @param {string} s - String to check
 * @returns {boolean}
 */
export const isElo = (s) => {
    if (!s) return false;
    return /^\d{3,4}$/.test(s) || s === '-';
};

/**
 * Simplify team name for fuzzy matching
 * @param {string} str - Team name
 * @returns {string} Simplified name
 */
export const simplify = (str) => {
    return str.toLowerCase()
        .replace(/n\.n\./g, '')
        .replace(/["']/g, '')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Check if team matches row text (fuzzy match)
 * @param {string} team - Team name to find
 * @param {string} rowText - Row text to search in
 * @returns {boolean}
 */
export const isMatch = (team, rowText) => {
    const simpleTeam = simplify(team);
    const rowLower = rowText.toLowerCase();

    // 1. Direct weak match
    if (rowLower.includes(simpleTeam)) return true;

    const words = simpleTeam.split(' ');

    // Critical Fix: Detect short identifiers (like "A", "B", "C", "D", "E") that differentiate teams
    const teamParts = team.replace(/["']/g, '').trim().split(/\s+/);
    const lastPart = teamParts[teamParts.length - 1];

    // If team ends with a single letter identifier (e.g. "A"), ensure the row contains it strictly
    if (lastPart && (lastPart.length === 1 || lastPart.match(/^(A|B|C|D|E|F|G|L|JR\d+)$/i))) {
        const identifier = lastPart.toLowerCase();
        const idRegex = new RegExp(`(^|\\s|["'])${identifier}($|\\s|["'])`, 'i');
        if (!idRegex.test(rowLower)) {
            return false;
        }
    }

    // 2. Keyword match (if > 60% of LONG keywords match)
    const longWords = words.filter(w => w.length > 2);

    // Also enforce digit-containing words (like JR2)
    const digitWord = longWords.find(w => /\d/.test(w));
    if (digitWord && !rowLower.includes(digitWord)) return false;

    // If no long words, fall back to strict inclusion
    if (longWords.length === 0) return rowLower.includes(simpleTeam);

    const matches = longWords.filter(w => rowLower.includes(w));
    return matches.length >= (longWords.length * 0.6);
};

/**
 * Fetch URL with browser-like headers and timeout
 * @param {string} url - URL to fetch
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns {Promise<Response>}
 */
export const fetchWithHeaders = (url, timeoutMs = 30000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
};

export default { clean, isElo, simplify, isMatch, fetchWithHeaders };
