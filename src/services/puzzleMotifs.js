/**
 * Detekce taktických motivů + anti-trivial filtr.
 * Věrný port lichess-puzzler tagger/util.py + cook.py do chess.js.
 * (Lichess NEpoužívá plné SEE — jen lehké is_hanging / is_in_bad_spot primitivy.)
 *
 * Vstup = řešící linie (Stockfish PV) od pozice fenBefore; pov = strana na tahu = řešitel.
 */

import { Chess } from 'chess.js';

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const KVAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
const RAY = new Set(['q', 'r', 'b']);
const FILES = 'abcdefgh';

function allSquares() {
    const out = [];
    for (const f of FILES) for (let r = 1; r <= 8; r++) out.push(f + r);
    return out;
}
const SQUARES = allSquares();
const opp = (c) => (c === 'w' ? 'b' : 'w');

export function materialDiff(chess, color) {
    let me = 0, them = 0;
    for (const sq of SQUARES) {
        const p = chess.get(sq);
        if (!p) continue;
        const v = VAL[p.type] || 0;
        if (p.color === color) me += v; else them += v;
    }
    return me - them;
}

function kingSquare(chess, color) {
    for (const sq of SQUARES) {
        const p = chess.get(sq);
        if (p && p.type === 'k' && p.color === color) return sq;
    }
    return null;
}

// kdo barvy `attColor` dává šach králi barvy `kingColor`
function checkers(chess, kingColor) {
    const k = kingSquare(chess, kingColor);
    if (!k) return [];
    return chess.attackers(k, opp(kingColor)); // pole útočníků
}

// is_defended (s ray-defense baterií) — util.py
function isDefended(chess, square, color) {
    if (chess.attackers(square, color).length) return true;
    for (const attSq of chess.attackers(square, opp(color))) {
        const ap = chess.get(attSq);
        if (ap && RAY.has(ap.type)) {
            const bc = new Chess(chess.fen());
            bc.remove(attSq);
            if (bc.attackers(square, color).length) return true;
        }
    }
    return false;
}
function isHanging(chess, square, color) {
    return !isDefended(chess, square, color);
}
function canBeTakenByLower(chess, square, color, type) {
    for (const attSq of chess.attackers(square, opp(color))) {
        const ap = chess.get(attSq);
        if (ap && ap.type !== 'k' && VAL[ap.type] < VAL[type]) return true;
    }
    return false;
}
function isInBadSpot(chess, square) {
    const p = chess.get(square);
    if (!p) return false;
    return chess.attackers(square, opp(p.color)).length > 0 &&
        (isHanging(chess, square, p.color) || canBeTakenByLower(chess, square, p.color, p.type));
}

// soupeřovy figury, které figura na `from` napadá (emulace board.attacks)
function attackedOpponentSquares(chess, from, pov) {
    const res = [];
    for (const sq of SQUARES) {
        const p = chess.get(sq);
        if (!p || p.color === pov) continue;
        if (chess.attackers(sq, pov).includes(from)) res.push({ piece: p, square: sq });
    }
    return res;
}

function neighbors(sq) {
    const fi = sq.charCodeAt(0) - 97, ri = +sq[1] - 1;
    const out = [];
    for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
        if (!df && !dr) continue;
        const f = fi + df, r = ri + dr;
        if (f >= 0 && f < 8 && r >= 0 && r < 8) out.push(FILES[f] + (r + 1));
    }
    return out;
}

/**
 * Přehraje PV a vrátí motivy + anti-trivial signály.
 * @param fenBefore  pozice před prvním tahem řešitele
 * @param opLast     soupeřův předchozí tah (verbose chess.js move {to, captured}) nebo null
 * @param pv         pole UCI tahů (řešící linie, pv[0] = nejlepší tah)
 */
export function detectMotifs(fenBefore, opLast, pv) {
    const boards = [new Chess(fenBefore)];
    const moves = [opLast]; // moves[0] = soupeřův tah do fenBefore
    let cur = boards[0];
    const pov = cur.turn();
    for (const uci of pv) {
        const next = new Chess(cur.fen());
        let mv;
        try { mv = next.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4) || 'q' }); } catch { mv = null; }
        if (!mv) break;
        boards.push(next);
        moves.push(mv);
        cur = next;
        if (next.isCheckmate()) break;
    }
    if (boards.length < 2) return { motifs: [], materialDiffAfter: 0, obviousRecapture: false, hangingGrab: false, mate: false };

    const best = moves[1];                 // 1. tah řešitele
    const motifs = new Set();
    const lastBoard = boards[boards.length - 1];
    const mate = lastBoard.isCheckmate();
    const materialDiffAfter = materialDiff(boards[1], pov);

    // --- obvious recapture: beru zpět tam, kam soupeř právě sebral stejně/víc hodnotnou figuru
    let obviousRecapture = false;
    if (opLast && best.captured && opLast.to === best.to && opLast.captured) {
        if (VAL[opLast.captured] >= VAL[best.captured]) obviousRecapture = true;
    }

    // --- hanging grab: 1. tah bere ne-pěšec figuru, která je hanging (= seber zadarmo)
    let hangingGrab = false;
    if (best.captured && best.captured !== 'p' && !boards[0].isCheck()) {
        // co beru, je v boards[0] hanging?
        if (isHanging(boards[0], best.to, opp(pov))) hangingGrab = true;
    }

    // === MOTIVY ===
    // sacrifice — material klesne o ≥2 pod initial po některém pozdějším pov tahu (bez promoce)
    const diffs = boards.map((b) => materialDiff(b, pov));
    const initial = diffs[0];
    // pov tahy jsou moves[1], moves[3], ... (liché); diffs[1::2][1:] = diffs[3], diffs[5], ...
    for (let k = 3; k < diffs.length; k += 2) {
        if (diffs[k] - initial <= -2) {
            let promo = false;
            for (let j = 1; j < moves.length; j += 2) if (moves[j] && moves[j].promotion) promo = true;
            if (!promo) motifs.add('sacrifice');
            break;
        }
    }

    // fork — pov tah (kromě posledního): non-king, cíl není in_bad_spot, napadá ≥2 cenné/hanging figury
    for (let k = 1; k < boards.length - 1; k += 2) {
        const mv = moves[k], b = boards[k];
        if (!mv || mv.piece === 'k') continue;
        if (isInBadSpot(b, mv.to)) continue;
        let nb = 0;
        for (const { piece, square } of attackedOpponentSquares(b, mv.to, pov)) {
            if (piece.type === 'p') continue;
            const guardsForker = b.attackers(mv.to, opp(pov)).includes(square);
            if (KVAL[piece.type] > KVAL[mv.piece] || (isHanging(b, square, piece.color) && !guardsForker)) nb++;
        }
        if (nb > 1) { motifs.add('fork'); break; }
    }

    // double check / discovered check — na pov pozicích (soupeř po našem tahu v šachu)
    for (let k = 1; k < boards.length; k += 2) {
        const b = boards[k], mv = moves[k];
        const chk = checkers(b, opp(pov)); // pole našich figur dávajících šach soupeřovu králi
        if (chk.length > 1) motifs.add('doubleCheck');
        if (chk.length >= 1 && mv && chk.some((sq) => sq !== mv.to)) motifs.add('discoveredCheck');
    }

    // promotion / advanced pawn
    for (let k = 1; k < moves.length; k += 2) {
        const mv = moves[k];
        if (!mv) continue;
        if (mv.promotion) motifs.add('promotion');
        if (mv.piece === 'p') {
            const r = +mv.to[1];
            if ((pov === 'w' && r >= 7) || (pov === 'b' && r <= 2)) motifs.add('advancedPawn');
        }
    }

    // mate vzory na koncové pozici
    if (mate) {
        motifs.add('mate');
        if (backRankMate(lastBoard, pov)) motifs.add('backRankMate');
        if (smotheredMate(lastBoard, pov)) motifs.add('smotheredMate');
    }

    // trapped piece — soupeřova figura v bad spotu bez úniku (jednoduchá verze na fenBefore)
    if (!mate) {
        for (const sq of SQUARES) {
            const p = boards[0].get(sq);
            if (p && p.color === opp(pov) && (p.type === 'n' || p.type === 'b' || p.type === 'r' || p.type === 'q')) {
                if (isTrapped(boards[0], sq)) { motifs.add('trappedPiece'); break; }
            }
        }
    }

    return { motifs: [...motifs], materialDiffAfter, obviousRecapture, hangingGrab, mate };
}

// back_rank_mate — port cook.py
function backRankMate(board, pov) {
    const kSq = kingSquare(board, opp(pov));
    if (!kSq) return false;
    const backRank = pov === 'w' ? 8 : 1;
    if (!board.isCheckmate() || +kSq[1] !== backRank) return false;
    const fi = kSq.charCodeAt(0) - 97;
    const escRank = pov === 'w' ? backRank - 1 : backRank + 1;
    const esc = [];
    esc.push(FILES[fi] + escRank);
    if (fi < 7) esc.push(FILES[fi + 1] + escRank);
    if (fi > 0) esc.push(FILES[fi - 1] + escRank);
    for (const sq of esc) {
        const p = board.get(sq);
        if (!p || p.color === pov || board.attackers(sq, pov).length) return false;
    }
    return checkers(board, opp(pov)).some((c) => +c[1] === backRank);
}

// smothered_mate — port cook.py
function smotheredMate(board, pov) {
    if (!board.isCheckmate()) return false;
    const kSq = kingSquare(board, opp(pov));
    if (!kSq) return false;
    const chk = checkers(board, opp(pov));
    const byKnight = chk.some((sq) => { const p = board.get(sq); return p && p.type === 'n'; });
    if (!byKnight) return false;
    for (const sq of neighbors(kSq)) {
        const blocker = board.get(sq);
        if (!blocker || blocker.color === pov) return false;
    }
    return true;
}

// is_trapped (zjednodušeno: bez pin/check guardu) — util.py
function isTrapped(chess, square) {
    const p = chess.get(square);
    if (!p || p.type === 'p' || p.type === 'k') return false;
    if (!isInBadSpot(chess, square)) return false;
    // má únik na pole, kde už není in bad spot?
    const legal = chess.moves({ square, verbose: true });
    if (!legal.length) return false; // žádný tah = jiný problém, neřešíme
    for (const m of legal) {
        const cap = chess.get(m.to);
        if (cap && VAL[cap.type] >= VAL[p.type]) return false; // může vzít stejně/víc → ne trapped
        const bc = new Chess(chess.fen());
        try { bc.move({ from: m.from, to: m.to, promotion: 'q' }); } catch { continue; }
        if (!isInBadSpot(bc, m.to)) return false; // uteče do bezpečí
    }
    return true;
}
