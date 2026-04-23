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
    { id: 'Ra', glyph: '♖', side: 'white', sq: 'a1' },
    { id: 'Nb', glyph: '♘', side: 'white', sq: 'b1' },
    { id: 'Bc', glyph: '♗', side: 'white', sq: 'c1' },
    { id: 'Qd', glyph: '♕', side: 'white', sq: 'd1' },
    { id: 'Ke', glyph: '♔', side: 'white', sq: 'e1' },
    { id: 'Bf', glyph: '♗', side: 'white', sq: 'f1' },
    { id: 'Ng', glyph: '♘', side: 'white', sq: 'g1' },
    { id: 'Rh', glyph: '♖', side: 'white', sq: 'h1' },
    { id: 'Pa', glyph: '♙', side: 'white', sq: 'a2' },
    { id: 'Pb', glyph: '♙', side: 'white', sq: 'b2' },
    { id: 'Pc', glyph: '♙', side: 'white', sq: 'c2' },
    { id: 'Pd', glyph: '♙', side: 'white', sq: 'd2' },
    { id: 'Pe', glyph: '♙', side: 'white', sq: 'e2' },
    { id: 'Pf', glyph: '♙', side: 'white', sq: 'f2' },
    { id: 'Pg', glyph: '♙', side: 'white', sq: 'g2' },
    { id: 'Ph', glyph: '♙', side: 'white', sq: 'h2' },
    { id: 'ra', glyph: '♜', side: 'black', sq: 'a8' },
    { id: 'nb', glyph: '♞', side: 'black', sq: 'b8' },
    { id: 'bc', glyph: '♝', side: 'black', sq: 'c8' },
    { id: 'qd', glyph: '♛', side: 'black', sq: 'd8' },
    { id: 'ke', glyph: '♚', side: 'black', sq: 'e8' },
    { id: 'bf', glyph: '♝', side: 'black', sq: 'f8' },
    { id: 'ng', glyph: '♞', side: 'black', sq: 'g8' },
    { id: 'rh', glyph: '♜', side: 'black', sq: 'h8' },
    { id: 'pa', glyph: '♟', side: 'black', sq: 'a7' },
    { id: 'pb', glyph: '♟', side: 'black', sq: 'b7' },
    { id: 'pc', glyph: '♟', side: 'black', sq: 'c7' },
    { id: 'pd', glyph: '♟', side: 'black', sq: 'd7' },
    { id: 'pe', glyph: '♟', side: 'black', sq: 'e7' },
    { id: 'pf', glyph: '♟', side: 'black', sq: 'f7' },
    { id: 'pg', glyph: '♟', side: 'black', sq: 'g7' },
    { id: 'ph', glyph: '♟', side: 'black', sq: 'h7' },
  ];

  // Caro-Kann miniature: 1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nd7 5.Qe2 Ngf6?? 6.Nd6#
  const BOARD_SEQ = [
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
    { type: 'move', piece: 'Nb', from: 'e4', to: 'd6', knight: true, mate: true },
    { type: 'reset' },
  ];

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
      el.textContent = p.glyph;
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

  function init() {
    const board = document.getElementById('hero-board');
    if (!board) return;
    const scene = board.parentElement; // .board-scene
    if (!scene) return;

    const squares = buildBoard(board);
    let pieces = INITIAL_PIECES.slice();
    let pieceMap = renderPieces(scene, pieces);
    addSparks(scene);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // Show static mate position
      const finalPieces = [];
      const captured = new Set();
      const moves = BOARD_SEQ.filter(a => a.type === 'move');
      const positions = {};
      INITIAL_PIECES.forEach(p => { positions[p.id] = p.sq; });
      moves.forEach(m => {
        if (m.capture) captured.add(m.capture);
        positions[m.piece] = m.to;
      });
      INITIAL_PIECES.forEach(p => {
        if (!captured.has(p.id)) {
          finalPieces.push({ ...p, sq: positions[p.id] });
        }
      });
      pieceMap = renderPieces(scene, finalPieces);
      squares['e8'] && squares['e8'].classList.add('mate');
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

      setHighlight(squares, action.from, action.to);

      addTimer(() => {
        if (!alive) return;
        // Remove captured piece
        if (action.capture && pieceMap[action.capture]) {
          pieceMap[action.capture].el.remove();
          delete pieceMap[action.capture];
        }
        // Move the piece
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
            squares['e8'] && squares['e8'].classList.add('mate');
          }, 700);
        }

        addTimer(() => {
          if (!alive) return;
          if (moving) {
            moving.el.classList.remove('moving', 'knight-hop');
          }
          addTimer(step, action.mate ? 2400 : 1100);
        }, 1300);
      }, 350);
    }

    addTimer(step, 1400);

    // Cleanup if section is removed (unlikely but defensive)
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
