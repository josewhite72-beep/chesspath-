import { genMoves } from "./Engine.js";

/**
 * Validador de movimientos del tablero visual.
 * Delega en Engine.js para que el tablero, las pistas y el rival
 * usen EXACTAMENTE las mismas reglas.
 *
 * Reglas por fase (rules):
 *  - doubleStep:   el peón puede avanzar 2 casillas desde su fila inicial
 *  - capturesOnly: solo se permiten capturas
 *  - onlyTypes:    tipos de pieza que se pueden mover (p. ej. ["p"])
 */
export const DEFAULT_RULES = { doubleStep: true, capturesOnly: false, onlyTypes: null };

export class MoveValidator {
  constructor(boardSize = 6) {
    this.size = boardSize;
  }

  // Devuelve [{row, col, capture, double}]
  getLegalMoves(piece, board, rules = DEFAULT_RULES, meta = null) {
    const size = this.size;
    const cells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const p = board[r][c];
        cells.push(p ? p.color + p.type : null);
      }
    }
    const from = piece.row * size + piece.col;
    const st = { cells, size, ...(meta || {}) };
    return genMoves(st, piece.color, rules)
      .filter(m => m.from === from)
      .map(m => ({
        row: Math.floor(m.to / size),
        col: m.to % size,
        capture: m.capture,
        double: !!m.double,
        from: m.from,
        to: m.to,
        castle: m.castle || null,
        ep: m.ep ?? null
      }));
  }

  isInside(row, col) {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }
}
