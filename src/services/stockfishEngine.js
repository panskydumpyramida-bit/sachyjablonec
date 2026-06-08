/**
 * Stockfish UCI wrapper — perzistentní lokální engine (self-host).
 *
 * 1 dlouhožijící proces, požadavky serializované (UCI engine = 1 pozice naráz).
 * Vrací MultiPV varianty se score Z POHLEDU STRANY NA TAHU (UCI konvence),
 * což je přímo pohled řešitele — žádná negace jako u Lichess (white-pov).
 *
 * Fail-soft: když binárka chybí (lokál bez SF / build bez apt stockfish),
 * isEngineAvailable() vrátí false a volající degraduje na Lichess.
 */

import { spawn } from 'child_process';
import fs from 'fs';

const CANDIDATE_PATHS = [
    process.env.STOCKFISH_PATH,
    '/usr/games/stockfish',       // Debian apt (Railway)
    '/usr/bin/stockfish',
    '/usr/local/bin/stockfish',
    '/opt/homebrew/bin/stockfish', // macOS brew (dev)
].filter(Boolean);

const DEFAULT_HASH_MB = 32;
const ANALYZE_TIMEOUT_MS = 8000;

let engine = null;
let ready = false;
let initPromise = null;
let buffer = '';
let listener = null;       // aktuální (line) => void
let chain = Promise.resolve(); // serializace analýz

function resolvePath() {
    for (const p of CANDIDATE_PATHS) {
        try {
            if (p && (p === 'stockfish' || fs.existsSync(p))) return p;
        } catch { /* ignore */ }
    }
    return null;
}

function send(cmd) {
    if (engine && engine.stdin.writable) engine.stdin.write(cmd + '\n');
}

function initEngine() {
    if (ready) return Promise.resolve(true);
    if (initPromise) return initPromise;

    initPromise = new Promise((resolve) => {
        const path = resolvePath();
        if (!path) { ready = false; resolve(false); return; }

        try {
            engine = spawn(path, [], { stdio: ['pipe', 'pipe', 'ignore'] });
        } catch {
            ready = false; resolve(false); return;
        }

        engine.on('error', () => { ready = false; engine = null; });
        engine.on('exit', () => { ready = false; engine = null; });

        engine.stdout.setEncoding('utf8');
        engine.stdout.on('data', (data) => {
            buffer += data;
            let idx;
            while ((idx = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 1);
                if (listener) listener(line);
            }
        });

        // UCI handshake
        let resolved = false;
        const onLine = (line) => {
            if (line === 'uciok') {
                send(`setoption name Hash value ${DEFAULT_HASH_MB}`);
                send('isready');
            } else if (line === 'readyok' && !resolved) {
                resolved = true;
                listener = null;
                ready = true;
                resolve(true);
            }
        };
        listener = onLine;
        send('uci');

        setTimeout(() => {
            if (!resolved) { resolved = true; listener = null; ready = false; resolve(false); }
        }, 5000);
    });

    return initPromise;
}

export async function isEngineAvailable() {
    try { return await initEngine(); } catch { return false; }
}

/**
 * Analyzuj pozici. Vrátí pole variant seřazené dle multipv (1 = nejlepší),
 * score z pohledu strany na tahu (řešitele):
 *   [{ multipv, cp|null, mate|null, firstMove }]
 */
export async function analyzePosition(fen, { depth = 15, multiPv = 2 } = {}) {
    const ok = await initEngine();
    if (!ok) return null;

    const run = chain.then(() => doAnalyze(fen, depth, multiPv));
    chain = run.then(() => { }, () => { }); // udrž řetěz živý i po chybě
    return run;
}

function doAnalyze(fen, depth, multiPv) {
    return new Promise((resolve) => {
        if (!ready || !engine) { resolve(null); return; }

        const pvs = {}; // multipv index -> { depth, cp, mate, firstMove }
        let done = false;

        const finish = (val) => {
            if (done) return;
            done = true;
            listener = null;
            clearTimeout(timer);
            resolve(val);
        };

        const timer = setTimeout(() => {
            send('stop');
            finish(collect());
        }, ANALYZE_TIMEOUT_MS);

        function collect() {
            const arr = Object.values(pvs).sort((a, b) => a.multipv - b.multipv);
            return arr.length ? arr.map(p => ({ multipv: p.multipv, cp: p.cp, mate: p.mate, firstMove: p.firstMove, pv: p.pv || [] })) : null;
        }

        listener = (line) => {
            if (line.startsWith('info ') && line.includes(' pv ')) {
                const m = line.match(/ multipv (\d+) /);
                const mp = m ? parseInt(m[1]) : 1;
                const cpM = line.match(/ score cp (-?\d+)/);
                const mateM = line.match(/ score mate (-?\d+)/);
                const pvFullM = line.match(/ pv (.+?)\s*$/);
                const pvMoves = pvFullM ? pvFullM[1].trim().split(/\s+/) : [];
                const dM = line.match(/ depth (\d+)/);
                const d = dM ? parseInt(dM[1]) : 0;
                // ber nejhlubší info pro daný multipv
                if (!pvs[mp] || d >= pvs[mp].depth) {
                    pvs[mp] = {
                        multipv: mp,
                        depth: d,
                        cp: cpM ? parseInt(cpM[1]) : null,
                        mate: mateM ? parseInt(mateM[1]) : null,
                        firstMove: pvMoves[0] || null,
                        pv: pvMoves,
                    };
                }
            } else if (line.startsWith('bestmove')) {
                finish(collect());
            }
        };

        send(`setoption name MultiPV value ${multiPv}`);
        send('ucinewgame');
        send(`position fen ${fen}`);
        send(`go depth ${depth}`);
    });
}

export function shutdownEngine() {
    if (engine) { try { send('quit'); engine.kill(); } catch { /* ignore */ } engine = null; ready = false; initPromise = null; }
}
