import { Piece } from "./Piece.js";
import { MoveValidator, DEFAULT_RULES } from "./MoveValidator.js";
import { applyMove } from "./Engine.js";

/** La pieza capturada sale volando, girando, hacia un lado */
function knockOut(el) {
  el.style.setProperty("--dir", Math.random() < 0.5 ? -1 : 1);
  el.classList.add("captured");
  setTimeout(() => el.remove(), 620);
}

export class Board {
  constructor(size = 6) {
    this.size = size;
    this.grid = Array.from({ length: size }, () => Array(size).fill(null));
    this.element = document.getElementById("board");
    this.validator = new MoveValidator(size);
    this.selected = null;
    this.legalMoves = [];
    this.onMoveCallback = null;
    this.onInteract = null;       // cualquier toque (para el temporizador de pistas)
    this.onSelect = null;         // (pieza, jugadas) al seleccionar una pieza
    this.onSquareTap = null;      // (fila, col) → true si el capítulo consumió el toque
    this.dangerCheck = null;      // (pieza, jugada) → true si esa casilla es peligrosa (escudo)
    this.rules = { ...DEFAULT_RULES };
    this.locked = false;          // bloquea toques durante transiciones
    this.meta = null;             // { castle, ep } cuando se juega con reglas completas
    this.coords = false;          // mostrar coordenadas a–h / 1–8
    this.showRoutes = false;      // fases de enseñanza: el caballo muestra sus rutas en L
  }

  setRules(rules = {}) {
    this.rules = { ...DEFAULT_RULES, ...rules };
  }

  createBoard() {
    this.element.innerHTML = "";
    this.element.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
    this.element.style.gridTemplateRows = `repeat(${this.size}, 1fr)`;
    this.element.dataset.size = this.size;

    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const square = document.createElement("div");
        square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
        square.dataset.row = row;
        square.dataset.col = col;
        square.addEventListener("click", () => this.handleSquareClick(row, col));
        if (this.coords) {
          // Coordenadas: letras a–h abajo, números 1–8 a la izquierda
          if (row === this.size - 1) square.insertAdjacentHTML("beforeend", `<span class="coord file">${"abcdefgh"[col]}</span>`);
          if (col === 0) square.insertAdjacentHTML("beforeend", `<span class="coord rank">${this.size - row}</span>`);
        }
        this.element.appendChild(square);
      }
    }
  }

  placePiece(type, color, row, col) {
    if (!this.isInside(row, col)) return null;
    const piece = new Piece(type, color, row, col);
    this.grid[row][col] = piece;

    const square = this.getSquareElement(row, col);
    const el = piece.createElement();
    square.appendChild(el);
    return piece;
  }

  clear() {
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(null));
    this.selected = null;
    this.legalMoves = [];
    this.locked = false;
    this.meta = null;
    this.createBoard();
  }

  /** Marca en rojo al rey que está en jaque (o quita la marca) */
  markCheck(color) {
    this.element.querySelectorAll(".in-check").forEach(el => el.classList.remove("in-check"));
    if (!color) return;
    const k = this.pieces(color).find(p => p.type === "k");
    if (k) this.getSquareElement(k.row, k.col)?.classList.add("in-check");
  }

  /** Estado del tablero para el motor */
  engineState() {
    const cells = [];
    for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) {
      const p = this.grid[r][c];
      cells.push(p ? p.color + p.type : null);
    }
    return { cells, size: this.size, ...(this.meta ? JSON.parse(JSON.stringify(this.meta)) : {}) };
  }

  /** Marca una casilla objetivo (bandera) */
  markTarget(row, col) {
    this.clearTargets();
    this.getSquareElement(row, col)?.classList.add("target");
  }

  clearTargets() {
    this.element.querySelectorAll(".target").forEach(el => el.classList.remove("target"));
  }

  clearPulses() {
    this.element.querySelectorAll(".hint-pulse").forEach(el => el.classList.remove("hint-pulse"));
  }

  lock() {
    this.locked = true;
    this.deselect();
  }

  /** Todas las piezas de un color */
  pieces(color) {
    return this.grid.flat().filter(p => p && p.color === color);
  }

  /** Todos los movimientos legales de un color: [{piece, row, col, capture}] */
  allLegalMoves(color = "w") {
    return this.pieces(color).flatMap(piece =>
      this.validator.getLegalMoves(piece, this.grid, this.rules, this.meta).map(m => ({ piece, ...m }))
    );
  }

  /** Hace brillar casillas unos segundos (pistas) */
  pulse(squares, ms = 2600) {
    this.clearPulses();
    squares.forEach(({ row, col }) => {
      const el = this.getSquareElement(row, col);
      if (!el) return;
      el.classList.remove("hint-pulse");
      void el.offsetWidth;
      el.classList.add("hint-pulse");
      setTimeout(() => el.classList.remove("hint-pulse"), ms);
    });
  }

  getSquareElement(row, col) {
    return this.element.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  }

  handleSquareClick(row, col) {
    if (this.locked) return;
    this.onInteract?.();
    // Modo "tocar casilla" (preguntas): el capítulo puede consumir el toque
    if (this.onSquareTap && this.onSquareTap(row, col)) return;
    const piece = this.grid[row][col];

    // Si hay una pieza seleccionada y se hace clic en un movimiento legal → mover
    if (this.selected) {
      const legal = this.legalMoves.find(m => m.row === row && m.col === col);
      if (legal) {
        this.movePiece(this.selected, row, col, legal);
        return;
      }
      // Si se hace clic en otra pieza propia, se cambia la selección
      if (piece && piece.color === this.selected.color) {
        this.selectPiece(piece);
        return;
      }
      // Clic en casilla vacía o rival → deseleccionar
      this.deselect();
      return;
    }

    // No hay selección: seleccionar pieza propia
    if (piece && piece.color === "w") {
      this.selectPiece(piece);
    }
  }

  selectPiece(piece) {
    this.deselect();
    this.selected = piece;
    this.legalMoves = this.validator.getLegalMoves(piece, this.grid, this.rules, this.meta);

    const square = this.getSquareElement(piece.row, piece.col);
    square.classList.add("selected");

    this.legalMoves.forEach(m => {
      const el = this.getSquareElement(m.row, m.col);
      el.classList.add("highlight");
      // La dama muestra en otro color sus diagonales (el "alfil" que lleva dentro)
      if (piece.type === "q" && m.row !== piece.row && m.col !== piece.col) el.classList.add("diag");
      // Escudo: casillas donde la pieza quedaría en peligro
      if (this.dangerCheck?.(piece, m)) el.classList.add("danger");
    });

    this.onSelect?.(piece, this.legalMoves);
    if (this.showRoutes && piece.type === "n" && this.legalMoves.length) this.previewRoutes(piece);
  }

  deselect() {
    this.stopPreview();
    if (this.selected) {
      const square = this.getSquareElement(this.selected.row, this.selected.col);
      square?.classList.remove("selected");
    }
    this.legalMoves.forEach(m => {
      this.getSquareElement(m.row, m.col)?.classList.remove("highlight", "diag", "danger");
    });
    this.element.querySelectorAll(".forbidden").forEach(el => el.classList.remove("forbidden"));
    this.selected = null;
    this.legalMoves = [];
  }

  /* ─────────── Rutas: cómo llega cada pieza ─────────── */

  /** Casillas que recorre una pieza (sin la de salida); el caballo hace su L: 2 rectas + 1 de lado */
  routeOf(type, r0, c0, r1, c1) {
    const dr = r1 - r0, dc = c1 - c0;
    const sr = Math.sign(dr), sc = Math.sign(dc);
    const path = [];
    if (type === "n") {
      if (Math.abs(dr) === 2) path.push([r0 + sr, c0], [r0 + dr, c0]);
      else path.push([r0, c0 + sc], [r0, c0 + dc]);
      path.push([r1, c1]);
      return path;
    }
    // Deslizamiento en línea recta o diagonal (torre, alfil, dama, peón doble)
    if (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) {
      let r = r0 + sr, c = c0 + sc;
      while (r !== r1 || c !== c1) { path.push([r, c]); r += sr; c += sc; }
    }
    path.push([r1, c1]);
    return path;
  }

  /** Dibuja el recorrido casilla por casilla; con números 1-2-3 para el caballo */
  showTrail(type, r0, c0, r1, c1, { step = 110, hold = 650, cls = "trail" } = {}) {
    const path = this.routeOf(type, r0, c0, r1, c1);
    if (path.length < 2 && type !== "n") return 0;
    const numbered = type === "n";
    path.forEach(([r, c], i) => {
      setTimeout(() => {
        const el = this.getSquareElement(r, c);
        if (!el) return;
        el.classList.add(cls);
        if (numbered) el.dataset.step = i + 1;
        setTimeout(() => {
          el.classList.remove(cls);
          if (numbered) delete el.dataset.step;
        }, hold + (path.length - i) * step);
      }, i * step);
    });
    return path.length * step + hold;
  }

  /** Caballo seleccionado: muestra sus rutas en L una por una, en bucle */
  previewRoutes(piece) {
    this.stopPreview();
    const moves = this.legalMoves.slice();
    let i = 0;
    const next = () => {
      if (this.selected !== piece) return;
      const m = moves[i++ % moves.length];
      const ms = this.showTrail("n", piece.row, piece.col, m.row, m.col, { step: 160, hold: 380, cls: "route" });
      this.previewTimer = setTimeout(next, ms + 120);
    };
    this.previewTimer = setTimeout(next, 250);
  }

  stopPreview() {
    clearTimeout(this.previewTimer);
    this.element?.querySelectorAll(".route").forEach(el => { el.classList.remove("route"); delete el.dataset.step; });
  }

  movePiece(piece, toRow, toCol, move = null) {
    const fromRow = piece.row;
    const fromCol = piece.col;

    // Reglas completas: actualizar enroque / al paso
    if (this.meta) {
      const st = this.engineState();
      const next = applyMove(st, { from: fromRow * this.size + fromCol, to: toRow * this.size + toCol,
        castle: move?.castle || null, ep: move?.ep ?? null, promo: move?.promo });
      this.meta = { castle: next.castle || this.meta.castle, ep: next.ep };
    }

    // Quitar selección ANTES de cambiar la posición de la pieza
    // (si no, el recuadro amarillo se queda en la casilla de origen)
    this.deselect();

    // Captura al paso: el peón capturado no está en la casilla de destino
    let captured = this.grid[toRow][toCol];
    if (move?.ep != null) {
      const er = Math.floor(move.ep / this.size), ec = move.ep % this.size;
      captured = this.grid[er][ec];
      this.grid[er][ec] = null;
      if (captured?.element) {
        const ghost = captured.element;
        knockOut(ghost);
      }
      captured = captured ? { ...captured, element: null } : captured;
    }
    if (captured && captured.element) {
      // La pieza capturada se hunde y desaparece
      const ghost = captured.element;
      knockOut(ghost);
    }

    // Rastro del recorrido (todas las piezas, también las del rival)
    this.showTrail(piece.type, fromRow, fromCol, toRow, toCol);

    // Actualizar grid
    this.grid[fromRow][fromCol] = null;
    this.grid[toRow][toCol] = piece;
    piece.row = toRow;
    piece.col = toCol;

    // Mover DOM
    const fromSquare = this.getSquareElement(fromRow, fromCol);
    const toSquare = this.getSquareElement(toRow, toCol);
    fromSquare.querySelectorAll(".piece").forEach(el => el.remove());
    toSquare.appendChild(piece.element);
    piece.element.classList.remove("arrive");
    void piece.element.offsetWidth;
    piece.element.classList.add("arrive");

    // Enroque: la torre salta al otro lado del rey
    if (move?.castle) {
      const size = this.size;
      const rf = move.castle.rookFrom, rt = move.castle.rookTo;
      const rook = this.grid[Math.floor(rf / size)][rf % size];
      if (rook) {
        this.grid[Math.floor(rf / size)][rf % size] = null;
        this.grid[Math.floor(rt / size)][rt % size] = rook;
        rook.row = Math.floor(rt / size); rook.col = rt % size;
        this.getSquareElement(rook.row, rook.col).appendChild(rook.element);
        rook.element.classList.remove("arrive"); void rook.element.offsetWidth; rook.element.classList.add("arrive");
      }
    }

    // Callback para el capítulo
    if (this.onMoveCallback) {
      this.onMoveCallback({
        piece,
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        captured: !!captured,
        double: Math.abs(toRow - fromRow) === 2,
        castle: move?.castle || null,
        ep: move?.ep ?? null
      });
    }
  }

  isInside(row, col) {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }

  // Coloca varios peones de una vez (útil para fases)
  setupPieces(positions) {
    // positions = [{type, color, row, col}, ...]
    positions.forEach(p => this.placePiece(p.type, p.color, p.row, p.col));
  }
}
