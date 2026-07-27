import express from 'express';
import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';
import { clean, isChessResultsUrl } from '../utils/helpers.js';
import { scrapeStandings } from '../services/scrapingService.js';
import { getTournamentIndex, scanTournament, extractTnr } from '../services/chessResultsService.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireMember } from '../middleware/rbac.js';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * POST /api/scraping/standings
 * Generic tournament table scraper — returns headers + rows as plain text,
 * letting the admin UI render the final HTML with club highlight.
 * Body: { url: string }
 */
router.post('/standings', authMiddleware, async (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL je povinný' });

    try {
        const result = await scrapeStandings(url);
        res.json(result);
    } catch (e) {
        console.error('[scrape standings] error:', e.message);
        res.status(502).json({ error: e.message });
    }
});

/* ================================================================== *
 * Dvoufázový import výsledků z chess-results.com
 *  fáze 1: GET  /chess-results/tournaments — rozpozná festival a nabídne turnaje
 *  fáze 2: POST /chess-results/scan        — najde naše hráče a vrátí tabulku
 * ================================================================== */

const MAX_TNRS_PER_SCAN = 30;
const VIEWS = new Set(['standings', 'rankAfterRound', 'crosstable', 'round']);

/** Číslo turnaje z čísla nebo z URL (URL musí projít SSRF guardem). */
function safeTnr(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    if (/^\d{1,10}$/.test(raw)) return raw;
    if (!isChessResultsUrl(raw)) return null;
    return extractTnr(raw);
}

/**
 * GET /api/scraping/chess-results/tournaments?url=…&lan=5
 * Fáze 1 — vrátí seznam dílčích turnajů festivalu (nebo jediný turnaj).
 */
router.get('/chess-results/tournaments', authMiddleware, requireMember, async (req, res) => {
    const { url, lan } = req.query;
    if (!url) return res.status(400).json({ error: 'URL parameter is required' });
    if (!isChessResultsUrl(url)) {
        return res.status(400).json({ error: 'URL musí být z chess-results.com' });
    }

    try {
        const index = await getTournamentIndex(url, { lan: /^[0-9]$/.test(String(lan)) ? lan : 5 });
        res.json(index);
    } catch (error) {
        console.error('[chess-results tournaments]', error.message);
        res.status(502).json({ error: error.message });
    }
});

/**
 * POST /api/scraping/chess-results/scan
 * Body: { tnrs:string[], view, round?, clubQuery?, fedFilter?, useWatchlist?, lan? }
 * Fáze 2 — pro každý turnaj najde naše hráče (klub ∪ karta ∪ watchlist).
 * Chyba jednoho turnaje nesmí shodit celý request.
 */
router.post('/chess-results/scan', authMiddleware, requireMember, async (req, res) => {
    const body = req.body || {};

    const tnrs = [...new Set((Array.isArray(body.tnrs) ? body.tnrs : []).map(safeTnr).filter(Boolean))];
    if (!tnrs.length) return res.status(400).json({ error: 'Zadejte alespoň jeden turnaj (tnrs).' });
    if (tnrs.length > MAX_TNRS_PER_SCAN) {
        return res.status(400).json({ error: `Najednou lze skenovat nejvýše ${MAX_TNRS_PER_SCAN} turnajů.` });
    }

    const view = VIEWS.has(body.view) ? body.view : 'standings';
    const round = Number.isInteger(Number(body.round)) && Number(body.round) > 0 ? Number(body.round) : null;
    if (view !== 'standings' && !round) {
        return res.status(400).json({ error: 'Pro pohled po kole je nutné zadat číslo kola.' });
    }

    const clubQuery = String(body.clubQuery ?? 'Bižuterie').trim().slice(0, 60) || 'Bižuterie';
    const fedFilter = Array.isArray(body.fedFilter)
        ? body.fedFilter.map((f) => String(f).toUpperCase().slice(0, 3)).filter((f) => /^[A-Z]{3}$/.test(f))
        : ['CZE'];
    const lan = /^[0-9]$/.test(String(body.lan)) ? Number(body.lan) : 5;

    let watchlist = [];
    if (body.useWatchlist !== false) {
        try {
            watchlist = await prisma.trackedPlayer.findMany({ where: { active: true } });
        } catch (error) {
            console.error('[chess-results scan] watchlist:', error.message);
        }
    }

    const started = Date.now();
    const results = new Array(tnrs.length);
    let cursor = 0;
    // Turnaje po dvou — každý sken si uvnitř bere až 6 karet paralelně.
    const runners = Array.from({ length: Math.min(2, tnrs.length) }, async () => {
        for (;;) {
            const index = cursor++;
            if (index >= tnrs.length) return;
            const tnr = tnrs[index];
            try {
                results[index] = await scanTournament(tnr, {
                    view, round, lan, clubQuery, fedFilter, watchlist, concurrency: 6,
                    forceCards: body.forceCards === true
                });
            } catch (error) {
                console.error(`[chess-results scan] tnr${tnr}:`, error.message);
                results[index] = { tnr, name: '', players: [], table: null, stats: null, warnings: [], error: error.message };
            }
        }
    });
    await Promise.all(runners);

    res.json({
        tournaments: results,
        view,
        round,
        clubQuery,
        watchlistCount: watchlist.length,
        durationMs: Date.now() - started
    });
});

router.get('/chess-results', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    // SSRF guard — this endpoint is public (blicak.html), so the URL must be
    // restricted to chess-results.com; never let it fetch arbitrary hosts.
    if (!isChessResultsUrl(url)) {
        return res.status(400).json({ error: 'URL musí být z chess-results.com' });
    }

    try {
        console.log(`Scraping URL: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const html = await response.text();
        // Determine type based on URL params or content
        // art=1 is standings, art=0 or no art is startlist usually
        let isResults = url.includes('art=1') || url.includes('art=4');

        const players = [];

        // Parsing logic - More Robust Approach
        // 1. Find the main table (often has class 'CRs1' or 'CRs2' or just big table)
        // We will iterate all rows and look for data-like patterns.

        // Using imported clean helper from utils/helpers.js

        const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let match;

        while ((match = rowRegex.exec(html)) !== null) {
            const rowContent = match[1];
            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
            const cells = [];
            let cellMatch;
            while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
                cells.push(cellMatch[1]); // Keep HTML for now to find links
            }

            if (cells.length < 3) continue; // Too short to be a data row

            const cleanedCells = cells.map(c => clean(c));

            // Check if this is a header row (contains "Startovní" or "Pořadí" or "Jméno")
            // If so, skip (or use to map columns, but let's try heuristic first)
            if (cleanedCells.some(c => /Poř\.|Jméno|Body|Rtg|Fed/i.test(c))) continue;

            // Heuristic for Data Row:
            // 1. First column is a number (Rank or SNo)
            const firstColIsNum = /^\d+$/.test(cleanedCells[0]);
            if (!firstColIsNum) continue;

            // Data Extraction
            let rank = cleanedCells[0];
            let name = '';
            let elo = '';
            let club = '';
            let points = '';
            let fed = '';

            // Find Name: Look for cell with <a> tag or just text that isn't a number
            // Usually Name is in col 2 or 3 (0-indexed)
            // Let's look for the cell that contains the link to player details
            let nameIndex = -1;
            for (let i = 1; i < Math.min(cells.length, 5); i++) {
                if (cells[i].includes('<a ') && cells[i].includes('tnr')) {
                    nameIndex = i;
                    break;
                }
            }

            // Fallback: search for long text if no link found (e.g. finished tournament without links?)
            if (nameIndex === -1) {
                // Usually col 2 or 3. Let's guess 3 if 2 is short (Fed/Title)
                // Actually, let's look for a non-numeric cell that isn't too short.
                for (let i = 1; i < Math.min(cells.length, 5); i++) {
                    if (cleanedCells[i].length > 5 && !/^\d+$/.test(cleanedCells[i])) {
                        nameIndex = i;
                        break;
                    }
                }
            }

            if (nameIndex !== -1) {
                name = clean(cells[nameIndex]);

                // Club: usually after Elo/Fed?
                // Providing specific indices is risky. 
                // Let's try to identify standard columns relative to Name.
                // Standard: Rank, SNo, Name, Fed, Rtg, Club, Pts...
                // Or: Rank, Name, Rtg, Club...

                // Let's assume Club is the cell that looks like a city/club (text) after Name
                // But often there is Fed and Rtg between.

                // Let's try to find Elo (3-4 digits)
                for (let i = 0; i < cells.length; i++) {
                    if (i === nameIndex) continue;
                    // Rtg is usually 0, 1000-3000.
                    if (/^[12]\d{3}$/.test(cleanedCells[i]) || cleanedCells[i] === '0') {
                        if (!elo) elo = cleanedCells[i]; // Take first match as Rtg
                    }
                }

                // Points: usually near the end, looks like "5,5" or "5.5" or "6"
                // And it is distinct from other tiebreaks (TB1, TB2 often have .0 or .5 too)
                // Points is usually the Main Score.
                // In Chess-Results regex for points: `^(\d+([,.]5)?)$`
                // Let's search from the END backwards.
                for (let i = cells.length - 1; i > nameIndex; i--) {
                    const txt = cleanedCells[i].replace(',', '.');
                    if (/^\d+(\.5)?$/.test(txt)) {
                        // Candidate for points.
                        // Usually Pts is before TBs. 
                        // If we have multiple numbers at the end, the first one (from left) is usually Pts?
                        // Or the one labeled 'Pts'? We don't have labels here.
                        // Chess-results: Pts is usually column index 6 or so.
                        // TB1, TB2, TB3 follow.
                        // So Pts is the FIRST number after Club?

                        // Let's grab the value at a fixed offset if possible? No.
                        // Strategy: Store all numbers after name.
                        // If valid startlist (no points), this will be empty or Rtg.
                    }
                }
            }

            // --- Specific Parsing for Standard Chess-Results Layouts ---

            // Layout A (Startlist art=0): Pos, SNo, Name, Rtg, Fed, Club, Sex
            // Layout B (Standings art=1): Rank, SNo, Name, Rtg, Fed, Club, Pts, TB1, TB2...

            // Let's rely on relative positions found above or defaulting

            // Improved logic for standard Chess-Results tables (Layout B - Standings)
            // Typical columns: Rank, SNo, Name, Rtg, Fed, Club, Pts, TB1...

            // 1. Name is anchor.
            // 2. Rtg (ELO) is usually the first 4-digit number (1000-2999) or "0" BEFORE or AFTER name.
            //    In "Standings", Rtg is often column 3 or 4 (Name is 2 or 3).

            // Let's reset and search relative to nameIndex.

            // Search for ELO (Rtg)
            // Usually within 2 columns distance of Name
            let foundElo = false;
            for (let i = Math.max(0, nameIndex - 2); i <= Math.min(cells.length - 1, nameIndex + 3); i++) {
                if (i === nameIndex) continue;
                const val = cleanedCells[i];
                // Strict ELO check: 4 digits starting with 1 or 2, or exactly 0
                if ((/^[12]\d{3}$/.test(val) || val === '0') && !foundElo) {
                    elo = val;
                    foundElo = true;
                }
            }

            // Search for Points
            // Points is usually further effectively the last main column before tiebreaks.
            // It looks like a number (e.g. 5, 5.5, 6.0).
            // It is rarely a 4 digit integer unless it's a huge tournament, so it's distinct from ELO.

            // Search from the end backwards, but be careful of Tiebreaks which also look like points.
            // Actually, often Pts is the FIRST number after Club/Fed.

            // Let's try finding the column that looks like Club (text)
            // Club is often after Rtg/Fed

            // Fallback approach:
            // Find all numbers in the row.
            // Exclude the one used for Rank (first column usually).
            // Exclude the one used for SNo (integer, usually sequential).
            // Exclude ELO (1000+).
            // What remains? Points and TBs.
            // Points is usually the largest value? Or simply the first one after Club.

            // Let's try to specifically identify "Points" by pattern relative to end of row?
            // No, let's look for the first float/int after name+2 that isn't ELO.

            if (isResults) {
                for (let i = nameIndex + 1; i < cells.length; i++) {
                    const val = cleanedCells[i].replace(',', '.');

                    // heuristic: Points is usually < 100 (for normal tournaments)
                    // Tiebreaks can be larger.
                    // But Points is usually the PRIMARY score.

                    if (/^\d+(\.5)?$/.test(val)) {
                        // verify it's not ELO
                        if (/^[12]\d{3}$/.test(cleanedCells[i])) continue; // Likely ELO
                        if (cleanedCells[i] === '0' && i < nameIndex + 3) continue; // Likely ELO 0 near name

                        // Found a number that looks like points. 
                        // If we haven't assigned points yet, take it.
                        if (!points) {
                            points = cleanedCells[i];
                            // Don't break immediately, might be SNo if before name? 
                            // But loop starts after name.
                            break;
                        }
                    }
                }
            }

            // Post-processing: If ELO ended up in Points (common error if logic is loose), swap if needed?
            // Actually, ELO is usually > 20 points (unless 100 rounds).
            if (points && parseInt(points) > 100 && !elo) {
                // If "points" is 2000, it's actually ELO.
                elo = points;
                points = '';
            }

            // Fallback for Club: If we didn't search explicitly, try generic text after name
            if (!club) {
                for (let i = nameIndex + 1; i < cells.length; i++) {
                    const c = cleanedCells[i];
                    // Club is usually text, not number, not Fed (3 chars)
                    if (/[a-zA-Z]{4,}/.test(c) && !/^\d/.test(c)) {
                        club = c;
                        break;
                    }
                }
            }

            if (name) {
                players.push({
                    rank,
                    name,
                    elo: elo || '',
                    club: club || '',
                    fed,
                    points: points || '',
                    isResult: isResults && !!points
                });
            }
        }

        // Auto-detect type if not clear
        if (players.some(p => p.points)) {
            isResults = true;
        }

        res.json({ players, count: players.length, type: isResults ? 'results' : 'startlist' });

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ error: 'Failed to scrape data', details: error.message });
    }
});
// Rosada Profile Scraping
router.get('/rosada/:id', async (req, res) => {
    const { id } = req.params;
    if (!id || !/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'Invalid Rosada ID' });
    }

    const url = `https://elo.rosada.cz/lide/id.php?id=${id}`;

    try {
        console.log(`Scraping Rosada Profile: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch Rosada: ${response.statusText}`);
        }

        const html = await response.text();

        // Helper regex extraction
        // Structure: <td>Elo ČR</td><td>2097</td>
        const eloCrMatch = html.match(/Elo ČR<\/td><td>\s*(\d+)/i);
        const eloFideMatch = html.match(/Elo FIDE<\/td><td>[\s\S]*?>(\d+)<\/a>/i);

        const eloCr = eloCrMatch ? eloCrMatch[1] : 'N/A';
        const eloFide = eloFideMatch ? eloFideMatch[1] : 'N/A';

        res.json({
            id,
            eloCr,
            eloFide,
            url
        });

    } catch (error) {
        console.error('Rosada Scraping error:', error);
        res.status(500).json({ error: 'Failed to scrape Rosada', eloCr: 'N/A', eloFide: 'N/A' });
    }
});

export default router;
