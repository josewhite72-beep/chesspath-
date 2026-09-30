/**
 * Engine – motor genérico y puro (sin DOM) para los capítulos 2 en adelante.
 *
 * Estado: { cells: Array(size*size), size }
 *   cada celda: null o un código de 2 letras: color + tipo
 *   color: "w" blancas · "b" negras · "n" neutral (roca: bloquea, no se captura)
 *   tipo:  p peón · r torre · b alfil · n caballo · q dama · k rey · x roca
 *
 * No aplica reglas de jaque (llegan en el Capítulo 6).
 */

const DIRS = {
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
};
const KNIGHT = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KING = DIRS.q;

export function stateFromBoard(board) {
  const cells = [];
  for (let r = 0; r < board.size; r++) {
    for (let c = 0; c < board.size; c++) {
      const p = board.grid[r][c];
      cells.push(p ? p.color + p.type : null);
    }
  }
  return { cells, size: board.size };
}

export const idx = (st, r, c) => r * st.size + c;
export const rc = (st, i) => ({ row: Math.floor(i / st.size), col: i % st.size });

/**
 * Jugadas de un color.
 * rules: { doubleStep=true, capturesOnly=false, onlyTypes=null }
 */
export function genMoves(st, color, rules = {}) {
  return rules.legal ? legalMoves(st, color, rules) : pseudoMoves(st, color, rules);
}

function pseudoMoves(st, color, rules = {}) {
  const { doubleStep = true, capturesOnly = false, onlyTypes = null } = rules;
  const { cells, size } = st;
  const enemy = color === "w" ? "b" : "w";
  const inside = (r, c) => r >= 0 && r < size && c >= 0 && c < size;
  const caps = [], quiet = [];

  for (let i = 0; i < cells.length; i++) {
    const code = cells[i];
    if (!code || code[0] !== color) continue;
    const type = code[1];
    if (onlyTypes && !onlyTypes.includes(type)) continue;
    const r = Math.floor(i / size), c = i % size;

    const tryStep = (r2, c2) => {
      if (!inside(r2, c2)) return "out";
      const t = cells[r2 * size + c2];
      if (!t) { if (!capturesOnly) quiet.push({ from: i, to: r2 * size + c2, capture: false }); return "empty"; }
      if (t[0] === enemy) caps.push({ from: i, to: r2 * size + c2, capture: true });
      return "blocked";
    };

    if (type === "p") {
      const dir = color === "w" ? -1 : 1;
      const start = color === "w" ? size - 2 : 1;
      const r1 = r + dir;
      if (inside(r1, c) && !cells[r1 * size + c] && !capturesOnly) {
        quiet.push({ from: i, to: r1 * size + c, capture: false });
        const r2 = r + 2 * dir;
        if (doubleStep && r === start && inside(r2, c) && !cells[r2 * size + c]) {
          quiet.push({ from: i, to: r2 * size + c, capture: false, double: true });
        }
      }
      for (const dc of [-1, 1]) {
        const c1 = c + dc;
        if (inside(r1, c1)) {
          const t = cells[r1 * size + c1];
          if (t && t[0] === enemy) caps.push({ from: i, to: r1 * size + c1, capture: true });
          // Captura al paso
          else if (!t && st.ep != null && st.ep === r1 * size + c1 && rules.ep !== false) {
            caps.push({ from: i, to: st.ep, capture: true, ep: r * size + c1 });
          }
        }
      }
    } else if (type === "r" || type === "b" || type === "q") {
      for (const [dr, dc] of DIRS[type]) {
        let r2 = r + dr, c2 = c + dc;
        while (tryStep(r2, c2) === "empty") { r2 += dr; c2 += dc; }
      }
    } else if (type === "n") {
      for (const [dr, dc] of KNIGHT) tryStep(r + dr, c + dc);
    } else if (type === "k") {
      for (const [dr, dc] of KING) tryStep(r + dr, c + dc);
    }
  }
  return caps.concat(quiet);
}

/** Aplica una jugada (enroque, al paso y promoción incluidos) */
export function applyMove(st, m) {
  const size = st.size;
  const cells = st.cells.slice();
  let code = cells[m.from];
  const toRow = Math.floor(m.to / size);
  if (code[1] === "p" && ((code[0] === "w" && toRow === 0) || (code[0] === "b" && toRow === size - 1))) {
    code = code[0] + (m.promo || "q");
  }
  cells[m.to] = code;
  cells[m.from] = null;
  if (m.ep != null) cells[m.ep] = null;
  if (m.castle) {
    cells[m.castle.rookTo] = cells[m.castle.rookFrom];
    cells[m.castle.rookFrom] = null;
  }
  const next = { cells, size };
  // Derechos de enroque
  if (st.castle) {
    const c = { ...st.castle };
    const home = { w: size - 1, b: 0 };
    for (const sq of [m.from, m.to]) {
      for (const col of ["w", "b"]) {
        const r = home[col];
        if (sq === r * size + KING_COL(size)) { c[col + "K"] = false; c[col + "Q"] = false; }
        if (sq === r * size + size - 1) c[col + "K"] = false;
        if (sq === r * size) c[col + "Q"] = false;
      }
    }
    next.castle = c;
  }
  // Casilla de captura al paso
  next.ep = null;
  if (st.cells[m.from] && st.cells[m.from][1] === "p" && Math.abs(Math.floor(m.from / size) - toRow) === 2) {
    next.ep = (m.from + m.to) / 2;
  }
  return next;
}

/* ─────────── Reglas completas: jaque, legalidad, enroque ─────────── */

const KING_COL = size => (size === 8 ? 4 : Math.floor(size / 2));

/** ¿El bando `by` ataca la casilla `sq`? */
export function attacked(st, sq, by) {
  const { cells, size } = st;
  const r = Math.floor(sq / size), c = sq % size;
  const inside = (a, b) => a >= 0 && a < size && b >= 0 && b < size;
  const at = (a, b) => cells[a * size + b];
  // Peones
  const pr = by === "w" ? r + 1 : r - 1;
  for (const dc of [-1, 1]) if (inside(pr, c + dc) && at(pr, c + dc) === by + "p") return true;
  // Caballos
  for (const [dr, dc] of KNIGHT) if (inside(r + dr, c + dc) && at(r + dr, c + dc) === by + "n") return true;
  // Rey
  for (const [dr, dc] of KING) if (inside(r + dr, c + dc) && at(r + dr, c + dc) === by + "k") return true;
  // Deslizadores
  for (const [dr, dc] of DIRS.q) {
    const diag = dr !== 0 && dc !== 0;
    let a = r + dr, b = c + dc;
    while (inside(a, b)) {
      const t = at(a, b);
      if (t) {
        if (t[0] === by && (t[1] === "q" || (diag ? t[1] === "b" : t[1] === "r"))) return true;
        break;
      }
      a += dr; b += dc;
    }
  }
  return false;
}

export function kingIndex(st, color) {
  return st.cells.indexOf(color + "k");
}

export function inCheck(st, color) {
  const k = kingIndex(st, color);
  return k >= 0 && attacked(st, k, color === "w" ? "b" : "w");
}

/** Jugadas legales: no dejan al propio rey en jaque; incluye enroque */
export function legalMoves(st, color, rules = {}) {
  const enemy = color === "w" ? "b" : "w";
  const moves = pseudoMoves(st, color, rules);
  // Enroque
  if (st.castle && !rules.capturesOnly && (!rules.onlyTypes || rules.onlyTypes.includes("k"))) {
    const size = st.size;
    const row = color === "w" ? size - 1 : 0;
    const kc = KING_COL(size);
    const kIdx = row * size + kc;
    if (st.cells[kIdx] === color + "k" && !attacked(st, kIdx, enemy)) {
      const tryCastle = (side, rookCol, kingTo, rookTo, between, pass) => {
        if (!st.castle[color + side]) return;
        if (st.cells[row * size + rookCol] !== color + "r") return;
        if (between.some(cc => st.cells[row * size + cc])) return;
        if (pass.some(cc => attacked(st, row * size + cc, enemy))) return;
        moves.push({ from: kIdx, to: row * size + kingTo, capture: false,
          castle: { rookFrom: row * size + rookCol, rookTo: row * size + rookTo, side } });
      };
      const cols = n => Array.from({ length: n }, (_, i) => i);
      // Corto: rey +2, torre al lado del rey
      tryCastle("K", size - 1, kc + 2, kc + 1,
        cols(size - 1 - kc - 1).map(i => kc + 1 + i), [kc + 1, kc + 2]);
      // Largo: rey -2
      tryCastle("Q", 0, kc - 2, kc - 1,
        cols(kc - 1).map(i => 1 + i), [kc - 1, kc - 2]);
    }
  }
  if (kingIndex(st, color) < 0) return moves;
  return moves.filter(m => !inCheck(applyMove(st, m), color));
}

/** "mate" | "stalemate" | null para el bando que debe mover */
export function gameState(st, toMove, rules = {}) {
  if (legalMoves(st, toMove, rules).length) return null;
  return inCheck(st, toMove) ? "mate" : "stalemate";
}

export const count = (st, pred) => st.cells.filter(c => c && pred(c)).length;

/**
 * Solucionador de acertijos (solo mueve el bando `color`; el otro está quieto).
 * Devuelve la primera jugada del camino MÁS CORTO hacia `goal`, y su longitud.
 */
export function solvePuzzle(st, goal, { color = "w", rules = {}, maxNodes = 60000 } = {}) {
  if (goal(st)) return { solvable: true, move: null, length: 0 };
  const key = s => s.cells.map(c => c || ".").join("");
  const seen = new Set([key(st)]);
  let frontier = [{ s: st, first: null }];
  let depth = 0, nodes = 0;
  while (frontier.length && nodes < maxNodes) {
    depth++;
    const next = [];
    for (const node of frontier) {
      for (const m of genMoves(node.s, color, rules)) {
        nodes++;
        const s2 = applyMove(node.s, m);
        const first = node.first || m;
        if (goal(s2)) return { solvable: true, move: first, length: depth };
        const k = key(s2);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ s: s2, first });
      }
    }
    frontier = next;
  }
  return { solvable: nodes >= maxNodes, move: null, length: Infinity, aborted: nodes >= maxNodes };
}

/* ─────────── Búsqueda para partidas contra el rival ─────────── */

const WIN = 100000;

/**
 * game = {
 *   terminal(st, justMoved) → "w" | "b" | "draw" | null
 *   evaluate(st) → número (positivo favorece a blancas)
 *   rules: reglas de movimiento
 * }
 */
function negamax(st, color, depth, alpha, beta, ply, game, justMoved) {
  const t = game.terminal(st, justMoved);
  if (t === "draw") return 0;
  if (t) return (t === color ? 1 : -1) * (WIN - ply);
  const sign = color === "w" ? 1 : -1;
  if (depth === 0) return sign * game.evaluate(st);
  const moves = genMoves(st, color, game.rules);
  if (!moves.length) return 0;
  const other = color === "w" ? "b" : "w";
  let best = -Infinity;
  for (const m of moves) {
    const v = -negamax(applyMove(st, m), other, depth - 1, -beta, -alpha, ply + 1, game, color);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

export function bestMove(st, color, game, depth = 4) {
  const moves = genMoves(st, color, game.rules);
  if (!moves.length) return null;
  const other = color === "w" ? "b" : "w";
  let best = null, bestV = -Infinity;
  for (const m of moves) {
    const v = -negamax(applyMove(st, m), other, depth - 1, -Infinity, Infinity, 1, game, color);
    if (v > bestV) { bestV = v; best = m; }
  }
  return { move: best, score: bestV };
}

/** Rival de nivel principiante: poca profundidad + ruido; nunca deja pasar una victoria inmediata */
export function rivalMove(st, color, game, { depth = 2, noise = 60, rand = Math.random } = {}) {
  const moves = genMoves(st, color, game.rules);
  if (!moves.length) return null;
  const other = color === "w" ? "b" : "w";
  let best = null, bestV = -Infinity;
  for (const m of moves) {
    const next = applyMove(st, m);
    if (game.terminal(next, color) === color) return m;
    const v = -negamax(next, other, depth - 1, -Infinity, Infinity, 1, game, color) + (rand() - 0.5) * noise;
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}
