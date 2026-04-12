/**
 * AI Routes - OpenAI Integration
 * Endpoints for AI-powered features like spell checking, text-to-table, etc.
 */

import express from 'express';

const router = express.Router();

// Check if OpenAI is configured
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ENABLED = !!OPENAI_API_KEY;

/**
 * POST /api/ai/spellcheck
 * Correct spelling and grammar in Czech text
 */
router.post('/spellcheck', async (req, res) => {
    if (!OPENAI_ENABLED) {
        return res.status(503).json({
            error: 'AI není nakonfigurováno. Přidejte OPENAI_API_KEY do .env'
        });
    }

    try {
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Text je povinný' });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Jsi korektor českých textů. Oprav překlepy, gramatické chyby a interpunkci. 
Zachovej HTML formátování (tagy jako <b>, <i>, <span>, <h1>, atd.).
Neměň význam textu, jen oprav chyby.
Odpověz POUZE opraveným textem, bez vysvětlení.`
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                temperature: 0.3,
                max_tokens: 4096
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[AI] OpenAI error:', error);
            return res.status(500).json({ error: 'Chyba při volání AI' });
        }

        const data = await response.json();
        const correctedText = data.choices[0]?.message?.content || text;

        res.json({
            original: text,
            corrected: correctedText,
            changed: text !== correctedText
        });

    } catch (error) {
        console.error('[AI] Spellcheck error:', error);
        res.status(500).json({ error: 'Interní chyba serveru' });
    }
});

/**
 * POST /api/ai/text-to-table
 * Convert text with results/data into HTML table
 */
router.post('/text-to-table', async (req, res) => {
    if (!OPENAI_ENABLED) {
        return res.status(503).json({
            error: 'AI není nakonfigurováno. Přidejte OPENAI_API_KEY do .env'
        });
    }

    try {
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Text je povinný' });
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Převeď text s výsledky/daty na HTML tabulku.
Rozpoznej strukturu dat (např. jména hráčů, výsledky, body, pořadí).
Použij třídu "results-table" pro tabulku.
VŽDY použij <thead> pro záhlaví a <tbody> pro data.
Pokud text neobsahuje tabulková data, vrať původní text.
Odpověz POUZE HTML kódem tabulky, bez vysvětlení.`
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                temperature: 0.3,
                max_tokens: 4096
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[AI] OpenAI error:', error);
            return res.status(500).json({ error: 'Chyba při volání AI' });
        }

        const data = await response.json();
        const tableHtml = data.choices[0]?.message?.content || text;

        res.json({
            original: text,
            table: tableHtml,
            isTable: tableHtml.includes('<table')
        });

    } catch (error) {
        console.error('[AI] Text-to-table error:', error);
        res.status(500).json({ error: 'Interní chyba serveru' });
    }
});

/**
 * POST /api/ai/annotate
 * Generate Czech verbal annotation for a chess position/move
 * Translates engine evaluation into child-friendly explanation
 */
router.post('/annotate', async (req, res) => {
    if (!OPENAI_ENABLED) {
        return res.status(503).json({ error: 'AI není nakonfigurováno' });
    }

    try {
        const { fen, movePlayed, bestMove, evalBefore, evalAfter, moveNumber, color } = req.body;

        if (!fen) {
            return res.status(400).json({ error: 'FEN je povinný' });
        }

        const evalDiff = evalAfter !== undefined && evalBefore !== undefined
            ? Math.abs(evalAfter - evalBefore)
            : null;

        const prompt = `Jsi šachový trenér dětí (8-15 let) v českém šachovém klubu. Popiš stručně česky co se stalo v této pozici.

Pozice (FEN): ${fen}
Tah č. ${moveNumber || '?'} (${color === 'w' ? 'bílý' : 'černý'}): ${movePlayed || '?'}
${bestMove ? `Nejlepší tah podle enginu: ${bestMove}` : ''}
${evalBefore !== undefined ? `Hodnocení před tahem: ${evalBefore > 0 ? '+' : ''}${evalBefore}` : ''}
${evalAfter !== undefined ? `Hodnocení po tahu: ${evalAfter > 0 ? '+' : ''}${evalAfter}` : ''}
${evalDiff !== null && evalDiff > 0.5 ? `Ztráta: ${evalDiff.toFixed(1)} pěšce` : ''}

Pravidla:
- Piš 1-2 věty česky, srozumitelně pro děti
- Pokud je tah chybný, vysvětli PROČ je špatný a co bylo lepší (ale nepiš notaci, piš slovně: "lépe bylo vyvinout jezdce" apod.)
- Pokud je tah dobrý, pochval ho stručně
- Pokud je tah neutrální, popiš strategickou myšlenku
- Nepoužívej hodnocení v centipěšcích — piš lidsky
- Odpověz POUZE komentářem, bez uvozovek a bez prefixu`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Jsi stručný šachový komentátor pro děti. Odpovídáš vždy 1-2 větami česky.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('[AI] Annotate error:', error);
            return res.status(500).json({ error: 'Chyba při volání AI' });
        }

        const data = await response.json();
        const annotation = data.choices[0]?.message?.content?.trim() || '';

        res.json({ annotation });

    } catch (error) {
        console.error('[AI] Annotate error:', error);
        res.status(500).json({ error: 'Interní chyba serveru' });
    }
});

/**
 * GET /api/ai/status
 * Check if AI is configured
 */
router.get('/status', (req, res) => {
    res.json({
        enabled: OPENAI_ENABLED,
        model: 'gpt-4o-mini'
    });
});

export default router;
