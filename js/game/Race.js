/**
 * Race – motor de la "carrera de peones" (misión final del Capítulo 1).
 * Blancas y negras solo tienen peones; gana quien corone primero.
 * Si el bando que mueve no tiene jugadas → tablas.
 *
 * Módulo puro (sin DOM): se usa para la IA del rival y para las pistas.
 * Estado: array de size*size con "w", "b" o null.
 */

export function stateFromBoard(board) {
  const s = [];
  for (let r = 0; r < board.size; r++) {
    for (let c = 0; c < board.size; c++) {
      const p = board.grid[r][c];
      s.push(p && p.type === "p" ? p.color : null);
    }
  }
  return { cells: s, size: board.size };
}

export function genMoves(st, color) {
  const { cells, size } = st;
  const dir = color === "w" ? -1 : 1;
  const start = color === "w" ? size - 2 : 1;
  const enemy = color === "w" ? "b" : "w";
  const caps = [], quiet = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== color) continue;
    const r = Math.floor(i / size), c = i % size;
    const r1 = r + dir;
    if (r1 < 0 || r1 >= size) continue;
    for (const dc of [-1, 1]) {
      const c1 = c + dc;
      if (c1 >= 0 && c1 < size && cells[r1 * size + c1] === enemy) caps.push({ from: i, to: r1 * size + c1, capture: true });
    }
    if (!cells[r1 * size + c]) {
      quiet.push({ from: i, to: r1 * size + c, capture: false });
      const r2 = r + 2 * dir;
      if (r === start && r2 >= 0 && r2 < size && !cells[r2 * size + c]) quiet.push({ from: i, to: r2 * size + c, capture: false });
    }
  }
  return caps.concat(quiet);
}

export function applyMove(st, m) {
  const cells = st.cells.slice();
  cells[m.to] = cells[m.from];
  cells[m.from] = null;
  return { cells, size: st.size };
}

/** "w" | "b" si alguien coronó; null si no */
export function winner(st) {
  const { cells, size } = st;
  for (let c = 0; c < size; c++) {
    if (cells[c] === "w") return "w";
    if (cells[(size - 1) * size + c] === "b") return "b";
  }
  return null;
}

const WIN = 10000;

// Evaluación desde el punto de vista de "w"
function evaluate(st) {
  const { cells, size } = st;
  let score = 0;
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    if (!v) continue;
    const r = Math.floor(i / size), c = i % size;
    if (v === "w") {
      const d = r;                       // distancia a coronar
      score += 30 + (size - d) * (size - d) * 3;
      if (isPassed(st, r, c, "w")) score += 40 + (size - d) * 12;
    } else {
      const d = size - 1 - r;
      score -= 30 + (size - d) * (size - d) * 3;
      if (isPassed(st, r, c, "b")) score -= 40 + (size - d) * 12;
    }
  }
  return score;
}

// Peón pasado: ningún peón rival delante en su columna ni en las vecinas
function isPassed(st, r, c, color) {
  const { cells, size } = st;
  const enemy = color === "w" ? "b" : "w";
  const dir = color === "w" ? -1 : 1;
  for (let rr = r + dir; rr >= 0 && rr < size; rr += dir) {
    for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc;
      if (cc >= 0 && cc < size && cells[rr * size + cc] === enemy) return false;
    }
  }
  return true;
}

function negamax(st, color, depth, alpha, beta, ply) {
  const w = winner(st);
  const sign = color === "w" ? 1 : -1;
  if (w) return (w === color ? 1 : -1) * (WIN - ply);
  if (depth === 0) return sign * evaluate(st);
  const moves = genMoves(st, color);
  if (moves.length === 0) return 0; // tablas
  const other = color === "w" ? "b" : "w";
  let best = -Infinity;
  for (const m of moves) {
    const v = -negamax(applyMove(st, m), other, depth - 1, -beta, -alpha, ply + 1);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** Mejor jugada (para pistas). Devuelve {move, score} */
export function bestMove(st, color, depth = 6) {
  const moves = genMoves(st, color);
  if (!moves.length) return null;
  const other = color === "w" ? "b" : "w";
  let best = null, bestV = -Infinity;
  for (const m of moves) {
    const v = -negamax(applyMove(st, m), other, depth - 1, -Infinity, Infinity, 1);
    if (v > bestV) { bestV = v; best = m; }
  }
  return { move: best, score: bestV };
}

/**
 * Jugada del rival (nivel principiante): busca poco y con algo de "ruido",
 * pero nunca deja pasar una coronación inmediata propia.
 */
export function rivalMove(st, color = "b", { depth = 2, noise = 60, rand = Math.random } = {}) {
  const moves = genMoves(st, color);
  if (!moves.length) return null;
  const other = color === "w" ? "b" : "w";
  let best = null, bestV = -Infinity;
  for (const m of moves) {
    const next = applyMove(st, m);
    if (winner(next) === color) return m; // coronar ya
    const v = -negamax(next, other, depth - 1, -Infinity, Infinity, 1) + (rand() - 0.5) * noise;
    if (v > bestV) { bestV = v; best = m; }
  }
  return best;
}
