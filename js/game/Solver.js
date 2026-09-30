/**
 * Solver – busca si las blancas aún pueden capturar TODAS las piezas negras
 * (peones blancos contra piezas negras inmóviles, Capítulo 1).
 *
 * Se usa para:
 *  - la PISTA de la misión libre (devuelve una jugada que lleva a ganar)
 *  - detectar cuando la misión ya no se puede ganar (ofrecer reiniciar)
 *
 * Búsqueda en profundidad con memoria; el espacio es pequeño porque los
 * peones solo avanzan. Tiene un límite de nodos por seguridad.
 */
export function solveCaptureAll(board, { doubleStep = true, maxNodes = 200000 } = {}) {
  const size = board.size;
  const startRow = size - 2;
  const whites = [];
  const blacks = new Set();

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const p = board.grid[r][c];
      if (!p) continue;
      if (p.color === "w" && p.type === "p") whites.push(r * size + c);
      else if (p.color === "w") whites.push(-1 - (r * size + c)); // piezas inmóviles (dama)
      else blacks.add(r * size + c);
    }
  }

  const memo = new Map();
  let nodes = 0;
  let aborted = false;

  const key = (w, b) => [...w].sort((x, y) => x - y).join(",") + "|" + [...b].sort((x, y) => x - y).join(",");

  function movesOf(w, b) {
    const occ = new Set([...w.map(v => (v < 0 ? -1 - v : v)), ...b]);
    const caps = [], quiet = [];
    w.forEach((v, i) => {
      if (v < 0) return; // pieza inmóvil
      const r = Math.floor(v / size), c = v % size;
      if (r === 0) return;
      for (const dc of [-1, 1]) {
        const nc = c + dc;
        if (nc < 0 || nc >= size) continue;
        const t = (r - 1) * size + nc;
        if (b.has(t)) caps.push([i, t, true]);
      }
      const one = (r - 1) * size + c;
      if (!occ.has(one)) {
        quiet.push([i, one, false]);
        const two = (r - 2) * size + c;
        if (doubleStep && r === startRow && !occ.has(two)) quiet.push([i, two, false]);
      }
    });
    // Capturas primero: las pistas siguen el camino más directo
    return caps.concat(quiet);
  }

  function solve(w, b) {
    if (b.size === 0) return true;
    if (++nodes > maxNodes) { aborted = true; return true; } // ante la duda, no molestar
    const k = key(w, b);
    if (memo.has(k)) return memo.get(k);
    let ok = false;
    for (const [i, t, cap] of movesOf(w, b)) {
      const nw = w.slice(); nw[i] = t;
      let nb = b;
      if (cap) { nb = new Set(b); nb.delete(t); }
      if (solve(nw, nb)) { ok = true; break; }
    }
    memo.set(k, ok);
    return ok;
  }

  const solvable = solve(whites, blacks);

  // Pista = primera jugada del camino MÁS CORTO (búsqueda en anchura),
  // así nunca sugiere avances inútiles.
  let hint = null;
  if (solvable && blacks.size > 0 && !aborted) {
    const seen = new Set([key(whites, blacks)]);
    let frontier = [{ w: whites, b: blacks, first: null }];
    let steps = 0;
    search:
    while (frontier.length && steps < maxNodes) {
      const next = [];
      for (const node of frontier) {
        for (const [i, t, cap] of movesOf(node.w, node.b)) {
          steps++;
          const nw = node.w.slice(); nw[i] = t;
          let nb = node.b;
          if (cap) { nb = new Set(node.b); nb.delete(t); }
          const first = node.first || { from: node.w[i], to: t };
          if (nb.size === 0) { hint = first; break search; }
          const k = key(nw, nb);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push({ w: nw, b: nb, first });
        }
      }
      frontier = next;
    }
    if (hint) {
      hint = {
        from: { row: Math.floor(hint.from / size), col: hint.from % size },
        to: { row: Math.floor(hint.to / size), col: hint.to % size }
      };
    }
  }

  return { solvable, hint, aborted };
}
