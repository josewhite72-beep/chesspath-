import { StepChapter, stateFromBoard, genMoves, applyMove, bestMove } from "./StepChapter.js";
import { legalMoves, gameState, inCheck, attacked } from "../game/Engine.js";
import { VALUE } from "./missions.js";

/*
 * CAPÍTULO 6 – CORTE DEL REY  (reglas completas: jaque, mate, ahogado, enroque)
 * El motor fue verificado con pruebas "perft" contra cifras oficiales.
 * Posiciones verificadas:
 *  - ¿es mate?: Q1 mate · Q2 no · Q3 mate
 *  - mate en 1: una torre da mate; dos trampas donde una jugada da MATE y otra AHOGA
 *  - escalera (2 torres): mate en ~6 jugadas con la mejor jugada
 *  - enroque en 8×8: sí / pieza en medio / pasa por casilla atacada / en jaque
 */

const L = { legal: true };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CASTLE_ALL = { castle: { wK: true, wQ: true, bK: false, bQ: false }, ep: null };

/** Rey seleccionado: marca con ✕ las casillas vecinas prohibidas (atacadas) */
function markForbidden(piece) {
  if (piece.type !== "k" || piece.color !== "w") return;
  const st = this.board.engineState();
  const size = st.size;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const r = piece.row + dr, c = piece.col + dc;
    if (r < 0 || c < 0 || r >= size || c >= size) continue;
    const occ = this.board.grid[r][c];
    if (occ && occ.color === "w") continue;
    const cells = st.cells.slice();
    cells[piece.row * size + piece.col] = null;
    if (attacked({ cells, size }, r * size + c, "b")) this.board.getSquareElement(r, c)?.classList.add("forbidden");
  }
}

// Salir del jaque
const ESCAPES = [
  { pieces: [["wk", 5, 2], ["br", 0, 2]], msg: "ch6.p3.ex1" },
  { pieces: [["wk", 5, 0], ["wr", 2, 5], ["br", 0, 0]], msg: "ch6.p3.ex2" },
  { pieces: [["wk", 5, 5], ["wb", 5, 1], ["bq", 3, 3]], msg: "ch6.p3.ex3" },
  { pieces: [["wk", 5, 3], ["wn", 3, 1], ["wr", 5, 0], ["br", 1, 3]], msg: "ch6.p3.ex4" }
];

// Mate en 1 (y trampas de ahogado)
const MATE1 = [
  { pieces: [["bk", 0, 4], ["wk", 2, 4], ["wr", 5, 0]], msg: "ch6.p5.ex1" },
  { pieces: [["bk", 0, 4], ["wk", 2, 4], ["wq", 2, 1]], msg: "ch6.p5.ex2" },
  { pieces: [["bk", 0, 0], ["wk", 2, 2], ["wq", 1, 4]], msg: "ch6.p5.ex3" }
];

/** Juego de mate: gana quien da jaque mate; ahogado = tablas */
function mateGame(extraLose) {
  return {
    rules: L,
    terminal(st, just) {
      if (extraLose && extraLose(st)) return "b";
      const other = just === "w" ? "b" : "w";
      const g = gameState(st, other, L);
      if (g === "mate") return just;
      if (g === "stalemate") return "draw";
      return null;
    },
    evaluate(st) {
      const size = st.size;
      const bk = st.cells.indexOf("bk"), wk = st.cells.indexOf("wk");
      let s = 0;
      st.cells.forEach(c => { if (c && c[0] !== "n") s += (c[0] === "w" ? 1 : -1) * VALUE[c[1]] * 3; });
      if (bk >= 0) {
        const r = Math.floor(bk / size), c = bk % size, mid = (size - 1) / 2;
        s += (Math.abs(r - mid) + Math.abs(c - mid)) * 12;               // rey negro al borde
        if (wk >= 0) s -= (Math.abs(r - Math.floor(wk / size)) + Math.abs(c - wk % size)) * 3;
        s -= legalMoves(st, "b", L).length * 4;                             // menos casillas para huir
      }
      return s;
    }
  };
}

export class Chapter6 extends StepChapter {
  constructor(opts) {
    super({ ...opts, id: "chapter6" }, [
      { type: "intro", text: "ch6.intro", btn: "ch6.enter" },

      { type: "free", star: "movementDone", rules: L, pieces: [["wk", 3, 2]], count: 4,
        msg: "ch6.p1.tap", good: "ch6.p1.good", done: "ch6.p1.done",
        track(info, s) { if (info.from.row !== info.to.row && info.from.col !== info.to.col) s.diag = true; else s.line = true; },
        need: s => (!s.line ? "ch6.p1.tryLine" : !s.diag ? "ch6.p1.tryDiag" : null) },

      { type: "reach", star: "dangerDone", rules: L, onSelect: markForbidden, exercises: [
        { pieces: [["wk", 5, 2], ["bb", 3, 3]], target: [2, 1], msg: "ch6.p2.ex1" },
        { pieces: [["wk", 5, 4], ["bn", 3, 2]], target: [2, 3], msg: "ch6.p2.ex2" },
        { pieces: [["wk", 5, 1], ["bk", 1, 2]], target: [3, 2], msg: "ch6.p2.ex3" }
      ] },

      { type: "custom", star: "escapeDone", run() { this.escIndex = 0; this.setupEscape(true); },
        onMove(info) { return this.escapeMove(info); } },

      { type: "quiz", star: "mateQuizDone", rules: L, done: "ch6.p4.done", questions: [
        { pieces: [["bk", 0, 0], ["wq", 1, 1], ["wk", 2, 2]], check: "b", prompt: "ch6.p4.prompt",
          choices: [{ key: "ch6.yes", correct: true }, { key: "ch6.no" }], explain: "ch6.p4.a1", wrong: "ch6.p4.w1" },
        { pieces: [["bk", 0, 0], ["wr", 0, 5], ["wk", 5, 5]], check: "b", prompt: "ch6.p4.prompt",
          choices: [{ key: "ch6.yes" }, { key: "ch6.no", correct: true }], explain: "ch6.p4.a2", wrong: "ch6.p4.w2" },
        { pieces: [["bk", 0, 3], ["wr", 0, 0], ["wr", 1, 5], ["wk", 5, 5]], check: "b", prompt: "ch6.p4.prompt",
          choices: [{ key: "ch6.yes", correct: true }, { key: "ch6.no" }], explain: "ch6.p4.a3", wrong: "ch6.p4.w1" }
      ] },

      { type: "custom", star: "mateDone", run() { this.m1Index = 0; this.setupMate1(true); },
        onMove(info) { return this.mate1Move(info); } },

      { type: "mission", star: "ladderDone", rules: L, hintDepth: 3, noise: 40,
        pieces: [["wk", 5, 5], ["wr", 5, 1], ["wr", 4, 4], ["bk", 1, 2]],
        intro: "ch6.p6.intro", goal: "ch6.p6.goal", won: "ch6.p6.won", lost: "ch6.p6.lost",
        drawMsg: "ch6.stalemate", lostPiece: "ch6.lostRook",
        ...mateGame(st => !st.cells.includes("wr")) },

      { type: "quiz", star: "castleQuizDone", size: 8, rules: L, done: "ch6.p7.done", questions: [
        { pieces: [["wk", 7, 4], ["wr", 7, 7], ["bk", 0, 4]], meta: CASTLE_ALL, prompt: "ch6.p7.prompt",
          choices: [{ key: "ch6.yes", correct: true }, { key: "ch6.no" }], explain: "ch6.p7.a1" },
        { pieces: [["wk", 7, 4], ["wr", 7, 7], ["wb", 7, 5], ["bk", 0, 4]], meta: CASTLE_ALL, prompt: "ch6.p7.prompt",
          choices: [{ key: "ch6.yes" }, { key: "ch6.no", correct: true }], explain: "ch6.p7.a2" },
        { pieces: [["wk", 7, 4], ["wr", 7, 7], ["br", 0, 5], ["bk", 0, 0]], meta: CASTLE_ALL, prompt: "ch6.p7.prompt",
          choices: [{ key: "ch6.yes" }, { key: "ch6.no", correct: true }], explain: "ch6.p7.a3" },
        { pieces: [["wk", 7, 4], ["wr", 7, 7], ["br", 0, 4], ["bk", 0, 0]], meta: CASTLE_ALL, prompt: "ch6.p7.prompt", check: "w",
          choices: [{ key: "ch6.yes" }, { key: "ch6.no", correct: true }], explain: "ch6.p7.a4" }
      ] },

      { type: "custom", star: "castleDone", size: 8, run() { this.setupCastle(true); },
        onMove(info) { return this.castleMove(info); } },

      { type: "mission", star: "missionDone", rules: L, hintDepth: 3, noise: 40,
        pieces: [["wk", 5, 4], ["wq", 5, 1], ["wr", 5, 0], ["bk", 1, 3], ["bp", 2, 0], ["bp", 2, 5]],
        intro: "ch6.mission.intro", goal: "ch6.mission.goal", won: "ch6.mission.won", lost: "ch6.mission.lost",
        drawMsg: "ch6.stalemate", lostPiece: "ch6.lostPiece",
        ...mateGame(st => !st.cells.includes("wq") && !st.cells.includes("wr")) },

      { type: "closing", mastered: "ch6.mastered", complete: "ch6.complete" }
    ]);
  }

  // ───────────── Salir del jaque: Mover · Tapar · Capturar ─────────────
  setupEscape(announce) {
    const ex = ESCAPES[this.escIndex];
    this.setup(ex.pieces, L);
    this.board.markCheck("w");
    this.board.onSelect = markForbidden.bind(this);
    this.ui.hideAllUI();
    if (announce) this.ui.showMessage(ex.msg);
    this.ui.showProgress("ch6.p3.progress", { i: this.escIndex + 1, total: ESCAPES.length });
    this.ui.showResetButton(() => this.setupEscape(true));
    this.currentObjective = "escape";
    this.startIdleTimer();
  }

  escapeMove({ piece, captured }) {
    if (this.currentObjective !== "escape") return false;
    if (piece.color !== "w") return true;
    const how = piece.type === "k" ? (captured ? "capture" : "move") : captured ? "capture" : "block";
    this.board.lock();
    this.board.markCheck(null);
    this.sound.playSuccess();
    this.ui.showMessage(`ch6.p3.${how}`);
    const last = this.escIndex >= ESCAPES.length - 1;
    this.goTo(() => {
      if (last) this.finishStep("ch6.p3.done", 2400);
      else { this.escIndex++; this.setupEscape(true); }
    }, 2400);
    return true;
  }

  // ───────────── Mate en 1 (sin ahogar) ─────────────
  setupMate1(announce) {
    const ex = MATE1[this.m1Index];
    this.setup(ex.pieces, L);
    this.ui.hideAllUI();
    if (announce) this.ui.showMessage(ex.msg);
    this.ui.showProgress("ch6.p5.progress", { i: this.m1Index + 1, total: MATE1.length });
    this.ui.showHintButton(() => this.mate1Hint(), "ui.hint");
    this.ui.showResetButton(() => this.setupMate1(true));
    this.currentObjective = "mate1";
  }

  mate1Hint() {
    if (this.board.locked) return;
    const st = this.board.engineState();
    const m = legalMoves(st, "w", L).find(x => gameState(applyMove(st, x), "b", L) === "mate");
    if (m) { this.pulseMove(m); this.hintMsg(); }
  }

  mate1Move({ piece }) {
    if (this.currentObjective !== "mate1") return false;
    if (piece.color !== "w") return true;
    this.board.lock();
    const g = gameState(this.board.engineState(), "b", L);
    if (g === "mate") {
      this.sound.playSuccess();
      this.ui.showMessage("ch6.p5.mate");
      const last = this.m1Index >= MATE1.length - 1;
      this.goTo(() => {
        if (last) this.finishStep("ch6.p5.done", 2400);
        else { this.m1Index++; this.setupMate1(true); }
      }, 2400);
    } else {
      this.ui.showMessage(g === "stalemate" ? "ch6.stalemate" : "ch6.p5.notMate");
      this.transitionTimer = setTimeout(() => this.setupMate1(false), g === "stalemate" ? 3600 : 2200);
    }
    return true;
  }

  // ───────────── Enroque ─────────────
  setupCastle(announce) {
    this.setup([["wk", 7, 4], ["wr", 7, 7], ["wr", 7, 0], ["wp", 6, 5], ["wp", 6, 6], ["wp", 6, 7], ["bk", 0, 4]], L,
      JSON.parse(JSON.stringify(CASTLE_ALL)));
    this.ui.hideAllUI();
    if (announce) this.ui.showMessage("ch6.p8.intro");
    this.ui.showHintButton(() => {
      this.board.pulse([{ row: 7, col: 4 }, { row: 7, col: 6 }], 3000);
      this.hintMsg();
    }, "ui.hint");
    this.ui.showResetButton(() => this.setupCastle(true));
    this.currentObjective = "castle";
    this.startIdleTimer();
  }

  castleMove({ piece, castle }) {
    if (this.currentObjective !== "castle") return false;
    if (piece.color !== "w") return true;
    this.board.lock();
    if (castle) {
      this.sound.playSuccess();
      this.ui.showMessage(castle.side === "K" ? "ch6.p8.short" : "ch6.p8.long");
      this.finishStep(null, 3200);
    } else {
      this.ui.showMessage("ch6.p8.notCastle");
      this.transitionTimer = setTimeout(() => this.setupCastle(false), 2200);
    }
    return true;
  }
}
