/**
 * GameAI – rival de partida completa (8×8) para el Capítulo 7.
 * Negamax con poda alfa-beta + búsqueda de capturas (quiescencia) y una
 * evaluación sencilla: material + posición (tablas por pieza) + seguridad del Rey.
 * La fuerza se regula con profundidad y "ruido" (en centipeones).
 */
import { legalMoves, applyMove, inCheck } from "./Engine.js";

export const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0, x: 0 };
const MATE = 100000;

// Tablas de posición (vista de las blancas, fila 0 = fila 8 del tablero)
const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    12, 12, 20, 30, 30, 20, 12, 12,
     6,  6, 10, 25, 25, 10,  6,  6,
     0,  0,  0, 22, 22,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0],
  n: [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50],
  b: [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0],
  q: [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20],
  k: [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20],
  kEnd: [
   -50,-40,-30,-20,-20,-30,-40,-50,
   -30,-20,-10,  0,  0,-10,-20,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-30,  0,  0,  0,  0,-30,-30,
   -50,-30,-30,-30,-30,-30,-30,-50]
};

/** Evaluación estática (positivo = ventaja blanca) */
export function evaluate(st) {
  const { cells, size } = st;
  let score = 0, heavy = 0;
  for (const c of cells) if (c && c[1] !== "p" && c[1] !== "k") heavy += PIECE_VALUE[c[1]];
  const endgame = heavy <= 1600;
  const wk = cells.indexOf("wk"), bk = cells.indexOf("bk");
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c || c[0] === "n") continue;
    const type = c[1];
    const table = type === "k" && endgame ? PST.kEnd : PST[type];
    // Para las negras se refleja la fila
    const r = Math.floor(i / size), col = i % size;
    const pi = size === 8 ? (c[0] === "w" ? i : (7 - r) * 8 + col) : -1;
    const v = PIECE_VALUE[type] + (pi >= 0 && table ? table[pi] : 0);
    score += c[0] === "w" ? v : -v;
  }
  // Final: acercar el propio rey al rival cuando se va ganando (ayuda a dar mate)
  if (endgame && wk >= 0 && bk >= 0) {
    const d = Math.abs(Math.floor(wk / size) - Math.floor(bk / size)) + Math.abs(wk % size - bk % size);
    if (score > 300) score += (14 - d) * 6;
    else if (score < -300) score -= (14 - d) * 6;
  }
  return score;
}

const victimValue = (st, m) => {
  if (m.ep != null) return 100;
  const t = st.cells[m.to];
  return t ? PIECE_VALUE[t[1]] : 0;
};

function orderMoves(st, moves) {
  return moves
    .map(m => {
      const attacker = PIECE_VALUE[st.cells[m.from][1]] || 0;
      let s = 0;
      if (m.capture) s += 10 * victimValue(st, m) - attacker / 10 + 1000;
      if (m.promo === "q" || (st.cells[m.from][1] === "p" && (Math.floor(m.to / st.size) === 0 || Math.floor(m.to / st.size) === st.size - 1))) s += 900;
      if (m.castle) s += 50;
      return { m, s };
    })
    .sort((a, b) => b.s - a.s)
    .map(x => x.m);
}

const other = c => (c === "w" ? "b" : "w");

function quiesce(st, color, alpha, beta, qd, stats) {
  stats.nodes++;
  const sign = color === "w" ? 1 : -1;
  const stand = sign * evaluate(st);
  if (qd <= 0) return stand;
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const caps = orderMoves(st, legalMoves(st, color, { capturesOnly: true }));
  for (const m of caps) {
    const v = -quiesce(applyMove(st, m), other(color), -beta, -alpha, qd - 1, stats);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function search(st, color, depth, alpha, beta, ply, stats) {
  stats.nodes++;
  const moves = legalMoves(st, color);
  if (!moves.length) return inCheck(st, color) ? -(MATE - ply) : 0;
  if (depth <= 0) return quiesce(st, color, alpha, beta, 4, stats);
  let best = -Infinity;
  for (const m of orderMoves(st, moves)) {
    const v = -search(applyMove(st, m), other(color), depth - 1, -beta, -alpha, ply + 1, stats);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Puntúa todas las jugadas de la raíz (sin poda entre ellas, para poder añadir ruido)
 * → [{ move, score }] ordenado de mejor a peor
 */
export function scoreMoves(st, color, depth = 2) {
  const stats = { nodes: 0 };
  const moves = orderMoves(st, legalMoves(st, color));
  const out = [];
  let alpha = -Infinity;
  for (const m of moves) {
    // Ventana: buscamos exacto hasta margen de 400 bajo el mejor, para que el ruido tenga sentido
    const v = -search(applyMove(st, m), other(color), depth - 1, -Infinity, -(alpha - 400), 1, stats);
    out.push({ move: m, score: v });
    if (v > alpha) alpha = v;
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

/** Mejor jugada (para pistas) */
export function aiBestMove(st, color, depth = 3) {
  const list = scoreMoves(st, color, depth);
  return list[0]?.move || null;
}

/**
 * Jugada del rival con fuerza regulable.
 * noise: centipeones de azar (más = más errores). Nunca deja pasar un mate en 1.
 */
export function aiRivalMove(st, color, { depth = 2, noise = 100, rand = Math.random } = {}) {
  const list = scoreMoves(st, color, depth);
  if (!list.length) return null;
  if (list[0].score > MATE - 10) return list[0].move;
  let best = null, bestV = -Infinity;
  for (const { move, score } of list) {
    const v = score + (rand() - 0.5) * 2 * noise;
    if (v > bestV) { bestV = v; best = move; }
  }
  return best;
}

/* ─────────── Tablas ─────────── */

/** Material insuficiente: solo reyes, o rey + una pieza menor contra rey */
export function insufficientMaterial(st) {
  const rest = st.cells.filter(c => c && c[1] !== "k" && c[0] !== "n");
  if (!rest.length) return true;
  if (rest.length === 1 && (rest[0][1] === "n" || rest[0][1] === "b")) return true;
  return false;
}

/** Clave de posición para la repetición (piezas + turno + enroques + al paso) */
export function positionKey(st, toMove) {
  const c = st.castle || {};
  return st.cells.map(x => x || ".").join("") + toMove +
    (c.wK ? "K" : "") + (c.wQ ? "Q" : "") + (c.bK ? "k" : "") + (c.bQ ? "q" : "") + (st.ep ?? "-");
}

export const MATE_SCORE = MATE;
