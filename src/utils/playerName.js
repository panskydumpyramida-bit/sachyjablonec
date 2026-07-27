/**
 * Jména hráčů z chess-results → tvar použitelný pro zobrazení i pro hledání
 * v naší databázi partií.
 */

// Co v párovací tabulce stojí místo jména. Nikdy to není hráč, nikdy na to
// nesmí vzniknout odkaz. Jazykové mutace: cs / en / de.
const PSEUDO_RE = /^(spielfrei|bye|volno|nenasazen\w*|not paired|-+)[,\s]*$/i;

/**
 * Očistí jméno soupeře. Vrací null, když to jméno není.
 *
 * Odstraňuje se jen to, co chess-results skutečně přidává:
 *  - " *)" na konci = hráč je přiřazený ke stálé šachovnici (legenda pod tabulkou).
 *    Pro nás bezcenná informace, která navíc rozbije hledání v databázi.
 *  - nezlomitelné a zdvojené mezery z HTML buněk.
 *
 * Ročníky ("Lin, Leo 2009") ani tituly ("Jangle, Nihar, Dr.") se NEODSTRAŇUJÍ —
 * v naší databázi jsou taky, takže by je odstranění rozpojilo.
 */
export function cleanOpponentName(raw) {
    if (!raw) return null;
    const n = String(raw)
        .replace(/ /g, ' ')
        .replace(/\s*\*\)\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!n || PSEUDO_RE.test(n)) return null;
    return n;
}

/**
 * Klíč pro porovnání dvou zápisů téhož jména. Srovnává diakritiku, velikost
 * písmen a interpunkci — databáze obsahuje tutéž osobu jednou s diakritikou
 * a jednou bez, což by jinak zůstalo jako dva různí hráči.
 */
export function normalizePlayerName(name) {
    return String(name || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[,`'.]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
