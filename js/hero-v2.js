(function () {
  'use strict';

  const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  function sqToCoord(sq) {
    return {
      file: FILES.indexOf(sq[0]),
      rank: 8 - parseInt(sq[1], 10),
    };
  }

  function coordToPct(file, rank) {
    return { left: (file * 12.5) + '%', top: (rank * 12.5) + '%' };
  }

  const INITIAL_PIECES = [
    { id: 'Ra', icon: 'fa-chess-rook',   side: 'white', sq: 'a1' },
    { id: 'Nb', icon: 'fa-chess-knight', side: 'white', sq: 'b1' },
    { id: 'Bc', icon: 'fa-chess-bishop', side: 'white', sq: 'c1' },
    { id: 'Qd', icon: 'fa-chess-queen',  side: 'white', sq: 'd1' },
    { id: 'Ke', icon: 'fa-chess-king',   side: 'white', sq: 'e1' },
    { id: 'Bf', icon: 'fa-chess-bishop', side: 'white', sq: 'f1' },
    { id: 'Ng', icon: 'fa-chess-knight', side: 'white', sq: 'g1' },
    { id: 'Rh', icon: 'fa-chess-rook',   side: 'white', sq: 'h1' },
    { id: 'Pa', icon: 'fa-chess-pawn',   side: 'white', sq: 'a2' },
    { id: 'Pb', icon: 'fa-chess-pawn',   side: 'white', sq: 'b2' },
    { id: 'Pc', icon: 'fa-chess-pawn',   side: 'white', sq: 'c2' },
    { id: 'Pd', icon: 'fa-chess-pawn',   side: 'white', sq: 'd2' },
    { id: 'Pe', icon: 'fa-chess-pawn',   side: 'white', sq: 'e2' },
    { id: 'Pf', icon: 'fa-chess-pawn',   side: 'white', sq: 'f2' },
    { id: 'Pg', icon: 'fa-chess-pawn',   side: 'white', sq: 'g2' },
    { id: 'Ph', icon: 'fa-chess-pawn',   side: 'white', sq: 'h2' },
    { id: 'ra', icon: 'fa-chess-rook',   side: 'black', sq: 'a8' },
    { id: 'nb', icon: 'fa-chess-knight', side: 'black', sq: 'b8' },
    { id: 'bc', icon: 'fa-chess-bishop', side: 'black', sq: 'c8' },
    { id: 'qd', icon: 'fa-chess-queen',  side: 'black', sq: 'd8' },
    { id: 'ke', icon: 'fa-chess-king',   side: 'black', sq: 'e8' },
    { id: 'bf', icon: 'fa-chess-bishop', side: 'black', sq: 'f8' },
    { id: 'ng', icon: 'fa-chess-knight', side: 'black', sq: 'g8' },
    { id: 'rh', icon: 'fa-chess-rook',   side: 'black', sq: 'h8' },
    { id: 'pa', icon: 'fa-chess-pawn',   side: 'black', sq: 'a7' },
    { id: 'pb', icon: 'fa-chess-pawn',   side: 'black', sq: 'b7' },
    { id: 'pc', icon: 'fa-chess-pawn',   side: 'black', sq: 'c7' },
    { id: 'pd', icon: 'fa-chess-pawn',   side: 'black', sq: 'd7' },
    { id: 'pe', icon: 'fa-chess-pawn',   side: 'black', sq: 'e7' },
    { id: 'pf', icon: 'fa-chess-pawn',   side: 'black', sq: 'f7' },
    { id: 'pg', icon: 'fa-chess-pawn',   side: 'black', sq: 'g7' },
    { id: 'ph', icon: 'fa-chess-pawn',   side: 'black', sq: 'h7' },
  ];

  const FALLBACK_BOARD_SEQ = [
    { type: 'move', piece: 'Pe', from: 'e2', to: 'e4' },
    { type: 'move', piece: 'pc', from: 'c7', to: 'c6' },
    { type: 'move', piece: 'Pd', from: 'd2', to: 'd4' },
    { type: 'move', piece: 'pd', from: 'd7', to: 'd5' },
    { type: 'move', piece: 'Nb', from: 'b1', to: 'c3', knight: true },
    { type: 'move', piece: 'pd', from: 'd5', to: 'e4', capture: 'Pe' },
    { type: 'move', piece: 'Nb', from: 'c3', to: 'e4', knight: true, capture: 'pd' },
    { type: 'move', piece: 'nb', from: 'b8', to: 'd7', knight: true },
    { type: 'move', piece: 'Qd', from: 'd1', to: 'e2' },
    { type: 'move', piece: 'ng', from: 'g8', to: 'f6', knight: true },
    { type: 'move', piece: 'Nb', from: 'e4', to: 'd6', knight: true, mate: true, mateSquare: 'e8' },
    { type: 'reset' },
  ];

  function findKing(sqMap, kingChar) {
    for (const [sq, id] of Object.entries(sqMap)) {
      if (id === 'Ke' && kingChar === 'K') return sq;
      if (id === 'ke' && kingChar === 'k') return sq;
    }
    return kingChar === 'K' ? 'e1' : 'e8';
  }

  function pgnToBoardSeq(pgn) {
    if (!window.Chess || !pgn) return FALLBACK_BOARD_SEQ;
    
    const chess = new window.Chess();
    if (!chess.load_pgn(pgn)) {
        console.warn("Invalid PGN for hero animation, falling back.");
        return FALLBACK_BOARD_SEQ;
    }
    
    const history = chess.history({ verbose: true });
    if (history.length === 0) return FALLBACK_BOARD_SEQ;

    const sqMap = {};
    INITIAL_PIECES.forEach(p => {
      sqMap[p.sq] = p.id;
    });
    
    const seq = [];
    
    history.forEach(move => {
      const pieceId = sqMap[move.from];
      if (!pieceId) return; // Should not happen in valid chess

      const isKnight = pieceId.toLowerCase().startsWith('n');
      
      const action = {
        type: 'move',
        piece: pieceId,
        from: move.from,
        to: move.to,
        knight: isKnight
      };
      
      if (move.flags.includes('c') || move.flags.includes('e')) {
         if (sqMap[move.to]) {
            action.capture = sqMap[move.to];
         } else if (move.flags.includes('e')) {
            const epSq = move.to[0] + move.from[1];
            action.capture = sqMap[epSq];
            delete sqMap[epSq];
         }
      }
      
      sqMap[move.to] = pieceId;
      delete sqMap[move.from];
      
      if (move.san.includes('#')) {
         action.mate = true;
         action.mateSquare = move.color === 'w' ? findKing(sqMap, 'k') : findKing(sqMap, 'K');
      }
      
      seq.push(action);
      
      if (move.flags.includes('k') || move.flags.includes('q')) {
        let rookFrom, rookTo;
        if (move.color === 'w') {
           if (move.flags.includes('k')) { rookFrom = 'h1'; rookTo = 'f1'; }
           else { rookFrom = 'a1'; rookTo = 'd1'; }
        } else {
           if (move.flags.includes('k')) { rookFrom = 'h8'; rookTo = 'f8'; }
           else { rookFrom = 'a8'; rookTo = 'd8'; }
        }
        
        const rId = sqMap[rookFrom];
        if (rId) {
            seq.push({
               type: 'move',
               piece: rId,
               from: rookFrom,
               to: rookTo,
               knight: false,
               isCastleRookMove: true
            });
            sqMap[rookTo] = rId;
            delete sqMap[rookFrom];
        }
      }
    });
    
    seq.push({ type: 'reset' });
    return seq;
  }

  function buildBoard(board) {
    board.innerHTML = '';
    const squares = {};
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = FILES[f] + (8 - r);
        const dark = (r + f) % 2 === 1;
        const el = document.createElement('div');
        el.className = 'sq ' + (dark ? 'sq--d' : 'sq--l');
        el.dataset.sq = sq;
        if (f === 0) {
          const rk = document.createElement('span');
          rk.className = 'coord coord--rank';
          rk.textContent = String(8 - r);
          el.appendChild(rk);
        }
        if (r === 7) {
          const fl = document.createElement('span');
          fl.className = 'coord coord--file';
          fl.textContent = FILES[f];
          el.appendChild(fl);
        }
        board.appendChild(el);
        squares[sq] = el;
      }
    }
    return squares;
  }

  function renderPieces(stage, pieces) {
    const existing = stage.querySelectorAll('.piece');
    existing.forEach(p => p.remove());
    const byId = {};
    pieces.forEach(p => {
      const { file, rank } = sqToCoord(p.sq);
      const { left, top } = coordToPct(file, rank);
      const el = document.createElement('div');
      el.className = 'piece piece--' + p.side;
      el.dataset.id = p.id;
      el.style.left = left;
      el.style.top = top;
      const icon = document.createElement('i');
      icon.className = 'fa-solid ' + p.icon;
      el.appendChild(icon);
      stage.appendChild(el);
      byId[p.id] = { el, sq: p.sq };
    });
    return byId;
  }

  function addSparks(stage) {
    const sparks = [
      { left: '8%', top: '20%', delay: '0s' },
      { left: '92%', top: '30%', delay: '1.2s' },
      { left: '80%', top: '85%', delay: '2.5s' },
      { left: '15%', top: '90%', delay: '3.1s' },
    ];
    sparks.forEach(s => {
      const el = document.createElement('div');
      el.className = 'spark';
      el.style.left = s.left;
      el.style.top = s.top;
      el.style.animationDelay = s.delay;
      stage.appendChild(el);
    });
  }

  function clearHighlights(squares) {
    Object.values(squares).forEach(sq => {
      sq.classList.remove('from', 'to', 'mate');
    });
  }

  function setHighlight(squares, from, to) {
    clearHighlights(squares);
    if (from && squares[from]) squares[from].classList.add('from');
    if (to && squares[to]) squares[to].classList.add('to');
  }

  async function fetchSettings() {
    try {
      const [pgnRes, hdrRes] = await Promise.all([
        fetch('/api/settings/public/hero_animation_pgn'),
        fetch('/api/settings/public/hero_animation_header')
      ]);
      const pgnData = pgnRes.ok ? await pgnRes.json() : { value: null };
      const hdrData = hdrRes.ok ? await hdrRes.json() : { value: null };
      return { pgn: pgnData.value, header: hdrData.value };
    } catch (e) {
      console.error('Failed to fetch hero settings', e);
      return { pgn: null, header: null };
    }
  }

  function renderHeader(scene, headerText) {
    if (!headerText) return;
    
    const existing = scene.querySelector('.hero-game-header');
    if (existing) existing.remove();
    
    const header = document.createElement('div');
    header.className = 'hero-game-header';
    header.style.position = 'absolute';
    header.style.top = '-40px';
    header.style.left = '0';
    header.style.width = '100%';
    header.style.textAlign = 'center';
    header.style.color = '#cbd5e1';
    header.style.fontSize = '0.9rem';
    header.style.fontWeight = '600';
    header.style.letterSpacing = '0.5px';
    header.style.textShadow = '0 2px 4px rgba(0,0,0,0.8)';
    header.style.background = 'linear-gradient(90deg, transparent, rgba(15, 23, 42, 0.7), transparent)';
    header.style.padding = '4px 0';
    header.style.borderRadius = '4px';
    header.style.zIndex = '10';
    
    header.innerHTML = `<i class="fa-solid fa-chess-board" style="margin-right: 6px; color: #fbbf24;"></i> ${headerText}`;
    scene.appendChild(header);
  }

  async function init() {
    const board = document.getElementById('hero-board');
    if (!board) return;
    const scene = board.parentElement; // .board-scene
    if (!scene) return;

    // Load settings from server
    const settings = await fetchSettings();
    const BOARD_SEQ = pgnToBoardSeq(settings.pgn);
    renderHeader(scene, settings.header);

    const squares = buildBoard(board);
    let pieces = INITIAL_PIECES.slice();
    let pieceMap = renderPieces(scene, pieces);
    addSparks(scene);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      const finalPieces = [];
      const captured = new Set();
      const moves = BOARD_SEQ.filter(a => a.type === 'move');
      const positions = {};
      let mateSquare = null;
      
      INITIAL_PIECES.forEach(p => { positions[p.id] = p.sq; });
      moves.forEach(m => {
        if (m.capture) captured.add(m.capture);
        positions[m.piece] = m.to;
        if (m.mate) mateSquare = m.mateSquare;
      });
      INITIAL_PIECES.forEach(p => {
        if (!captured.has(p.id)) {
          finalPieces.push({ ...p, sq: positions[p.id] });
        }
      });
      pieceMap = renderPieces(scene, finalPieces);
      if (mateSquare && squares[mateSquare]) {
        squares[mateSquare].classList.add('mate');
      }
      return;
    }

    let alive = true;
    let stepIndex = 0;
    const timers = [];
    const addTimer = (fn, ms) => {
      const t = setTimeout(fn, ms);
      timers.push(t);
      return t;
    };

    function step() {
      if (!alive) return;
      const action = BOARD_SEQ[stepIndex % BOARD_SEQ.length];
      stepIndex++;

      if (action.type === 'reset') {
        clearHighlights(squares);
        addTimer(() => {
          if (!alive) return;
          pieces = INITIAL_PIECES.slice();
          pieceMap = renderPieces(scene, pieces);
          addTimer(step, 1200);
        }, 700);
        return;
      }

      // If it's a rook move for castling, don't clear highlights of the king move
      if (!action.isCastleRookMove) {
        setHighlight(squares, action.from, action.to);
      } else {
        // Just add the to square highlight for the rook
        if (action.to && squares[action.to]) squares[action.to].classList.add('to');
      }

      // Delay execution of piece movement slightly
      let delay = action.isCastleRookMove ? 0 : 350;
      
      addTimer(() => {
        if (!alive) return;
        
        if (action.capture && pieceMap[action.capture]) {
          pieceMap[action.capture].el.remove();
          delete pieceMap[action.capture];
        }
        
        const moving = pieceMap[action.piece];
        if (moving) {
          const { file, rank } = sqToCoord(action.to);
          const { left, top } = coordToPct(file, rank);
          moving.el.classList.add('moving');
          if (action.knight) moving.el.classList.add('knight-hop');
          moving.el.style.left = left;
          moving.el.style.top = top;
          moving.sq = action.to;
        }

        if (action.mate) {
          addTimer(() => {
            if (!alive) return;
            if (action.mateSquare && squares[action.mateSquare]) {
              squares[action.mateSquare].classList.add('mate');
            }
          }, 700);
        }

        addTimer(() => {
          if (!alive) return;
          if (moving) {
            moving.el.classList.remove('moving', 'knight-hop');
          }
          // If this is the king move of a castle, don't wait, immediately do the next step (rook move)
          // Peek next step
          const nextAction = BOARD_SEQ[stepIndex % BOARD_SEQ.length];
          const waitTime = (nextAction && nextAction.isCastleRookMove) ? 0 : (action.mate ? 2400 : 1100);
          
          addTimer(step, waitTime);
        }, action.isCastleRookMove ? 200 : 1300);
      }, delay);
    }

    addTimer(step, 1400);

    window.addEventListener('beforeunload', () => {
      alive = false;
      timers.forEach(clearTimeout);
    }, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
