import { Board } from "../game/Board.js";
import { inCheck } from "../game/Engine.js";
import { saveChapterProgress, getChapterProgress } from "../utils/storage.js";

const IDLE_HINT_MS = 12000;

/**
 * ChapterBase – lo que comparten todos los capítulos a partir del 2:
 * fases, transiciones, pistas por inactividad, salida al mapa y guardado.
 *
 * Cada capítulo define:
 *   this.id          "chapter2"
 *   this.phases      [fn0, fn1, …]  (la última es el cierre)
 *   freshData()      datos iniciales de misiones
 *   onMove(info)     lógica al mover
 */
export class ChapterBase {
  constructor({ sound, ui, onExit, id }) {
    this.sound = sound;
    this.ui = ui;
    this.onExit = onExit || null;
    this.id = id;
    this.board = new Board(6);
    this.boards = { 6: this.board };
    this.phase = 0;
    this.data = this.freshData();
    this.everCompleted = false;
    this.currentObjective = null;
    this.transitionTimer = null;
    this.idleTimer = null;
    this.idleEnabled = false;
  }

  freshData() { return {}; }

  /** Cambia el tamaño del tablero (6×6 por defecto; 8×8 para enroque y partidas) */
  useBoard(size) {
    if (this.board.size === size) return;
    const old = this.board;
    this.board = this.boards[size] || (this.boards[size] = new Board(size));
    this.board.onMoveCallback = old.onMoveCallback;
    this.board.onInteract = old.onInteract;
    this.board.clear();
  }

  async start() {
    this.phase = 0;
    this.data = this.freshData();
    const saved = getChapterProgress(this.id);
    if (saved) {
      this.everCompleted = !!saved.completed;
      const ph = saved.currentPhase || 0;
      if (ph >= 1 && ph < this.phases.length - 1) {
        this.phase = ph;
        this.data = { ...this.freshData(), ...saved.missions, completed: false };
      }
    }
    this.board.clear();
    this.board.onMoveCallback = info => this.handleMove(info);
    this.board.onInteract = () => this.restartIdleTimer();
    this.board.onSelect = null;
    await this.runPhase(this.phase);
  }

  stop() {
    this.board.dangerCheck = null;
    this.manualPromotion = false;
    clearTimeout(this.transitionTimer);
    this.goToken = null;
    this.stopIdleTimer();
    this.currentObjective = null;
    this.board.lock();
    this.board.clearTargets();
    this.ui.cancelOverlay();
    this.ui.hideAllUI();
    this.sound.stopSpeaking();
  }

  async runPhase(phase) {
    clearTimeout(this.transitionTimer);
    this.goToken = null;
    this.stopIdleTimer();
    this.board.clearTargets();
    this.phase = phase;
    this.save();
    const fn = this.phases[phase];
    if (fn) await fn.call(this);
  }

  goTo(phaseOrFn, delay = 900) {
    this.board.lock();
    this.stopIdleTimer();
    clearTimeout(this.transitionTimer);
    // Espera la pausa y, además, a que la voz termine la indicación en curso
    const token = {};
    this.goToken = token;
    this.transitionTimer = setTimeout(async () => {
      await this.sound.whenIdle();
      if (this.goToken !== token) return;
      this.goToken = null;
      if (typeof phaseOrFn === "function") phaseOrFn();
      else this.runPhase(phaseOrFn);
    }, delay);
  }

  /** Coloca piezas: [["wr", fila, col], ["nx", 2, 2], …] */
  place(list) {
    list.forEach(([code, r, c]) => this.board.placePiece(code[1], code[0], r, c));
  }

  handleMove(info) {
    const { piece, captured } = info;
    if (captured) this.sound.playCapture();
    else this.sound.playMove();
    // Un peón que llega al final se transforma en dama
    const last = piece.color === "w" ? 0 : this.board.size - 1;
    info.reachedEnd = piece.type === "p" && info.to.row === last;
    if (info.reachedEnd && !(this.manualPromotion && piece.color === "w")) piece.promote("q");
    // Reglas completas: marcar jaque al bando que debe mover
    if (this.board.rules.legal) {
      const other = piece.color === "w" ? "b" : "w";
      this.board.markCheck(inCheck(this.board.engineState(), other) ? other : null);
    }
    this.onMove(info);
    this.save();
  }

  onMove() {}

  // ─── Pistas por inactividad ───
  startIdleTimer() {
    this.idleEnabled = true;
    this.restartIdleTimer();
  }

  stopIdleTimer() {
    this.idleEnabled = false;
    clearTimeout(this.idleTimer);
  }

  restartIdleTimer() {
    clearTimeout(this.idleTimer);
    if (!this.idleEnabled) return;
    this.idleTimer = setTimeout(() => {
      this.showIdleHint();
      this.restartIdleTimer();
    }, IDLE_HINT_MS);
  }

  showIdleHint() {
    if (this.board.locked) return;
    if (this.board.selected) {
      this.board.pulse(this.board.legalMoves);
    } else {
      const movable = this.board.allLegalMoves("w").map(m => ({ row: m.piece.row, col: m.piece.col }));
      this.board.pulse(movable);
    }
  }

  /** Muestra una jugada sugerida (from/to en índices de celda) */
  pulseMove(move, ms = 3200) {
    const size = this.board.size;
    this.board.deselect();
    this.board.pulse([
      { row: Math.floor(move.from / size), col: move.from % size },
      { row: Math.floor(move.to / size), col: move.to % size }
    ], ms);
  }

  save() {
    saveChapterProgress(this.id, {
      currentPhase: this.phase,
      missions: { ...this.data },
      completed: !!this.data.completed || this.everCompleted
    });
  }

  /** Cierre común: dos pantallas y vuelta al mapa */
  async closing(masteredKey, completeKey) {
    this.ui.hideAllUI();
    this.board.clear();
    this.board.lock();
    this.sound.playSuccess();
    await this.ui.showOverlay(masteredKey, "ui.continue");
    this.data.completed = true;
    this.everCompleted = true;
    this.save();
    await this.ui.showOverlay(completeKey, "ui.backToMap");
    this.data = this.freshData();
    this.phase = 0;
    this.save();
    this.onExit?.();
  }
}
