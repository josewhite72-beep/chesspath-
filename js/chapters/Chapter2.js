import { ChapterBase } from "./ChapterBase.js";
import { stateFromBoard, genMoves, solvePuzzle, bestMove, rivalMove } from "../game/Engine.js";

const RIVAL_DELAY_MS = 750;

/*
 * CAPÍTULO 2 – FORTALEZA DE LAS TORRES
 *  0 Introducción
 *  1 Movimiento en línea recta (4 movimientos, horizontal y vertical)
 *  2 El camino libre: llegar a la bandera esquivando rocas (mínimos 2, 2, 3)
 *  3 Captura en cadena (4 capturas, solo capturas)
 *  4 Peón + Torre: abrir la línea moviendo tu propio peón
 *  5 Misión: capturar 3 de 4 peones que avanzan antes de que uno corone
 *  6 Cierre
 * Todas las posiciones están verificadas con el solucionador (Engine.solvePuzzle)
 * y la misión fue calibrada con partidas simuladas.
 */

// Fase 2 – camino libre
const PATHS = [
  { pieces: [["wr", 5, 0]],               target: [0, 5], min: 2, msg: "ch2.p2.ex1" },
  { pieces: [["wr", 5, 0], ["nx", 5, 3]], target: [0, 5], min: 2, msg: "ch2.p2.ex2" },
  { pieces: [["wr", 5, 2], ["nx", 2, 2]], target: [0, 2], min: 3, msg: "ch2.p2.ex3" }
];

// Fase 3 – cadena de capturas (una sola captura posible en cada paso)
const CHAIN = [["wr", 5, 1], ["bp", 1, 1], ["bp", 1, 4], ["bp", 4, 4], ["bp", 4, 0]];

// Fase 4 – abrir la línea
const COORD = [
  { pieces: [["wr", 4, 0], ["wp", 4, 2], ["bp", 4, 5]], msg: "ch2.p4.ex1" },
  { pieces: [["wr", 3, 0], ["wp", 3, 3], ["bp", 2, 4], ["bp", 3, 5]], msg: "ch2.p4.ex2" }
];

// Fase 5 – misión (simulada: siguiendo pistas 100 % de victorias; principiante ~60 %)
const MISSION = [
  ["wr", 5, 2], ["wp", 4, 1], ["wp", 4, 4],
  ["bp", 1, 0], ["bp", 1, 2], ["bp", 1, 3], ["bp", 1, 5]
];
const MISSION_GOAL = 3;

const VALUE = { p: 10, r: 50, q: 90, b: 30, n: 30, k: 0 };

export class Chapter2 extends ChapterBase {
  constructor(opts) {
    super({ ...opts, id: "chapter2" });
    this.phases = [
      this.phase0_Intro,
      this.phase1_Movement,
      this.phase2_Path,
      this.phase3_Capture,
      this.phase4_Coordination,
      this.phase5_Mission,
      this.phase6_Closing
    ];
    this.missionLosses = 0;
  }

  freshData() {
    return {
      movementDone: false,
      pathDone: false,
      capturesDone: false,
      coordinationDone: false,
      missionDone: false
    };
  }

  // ─────────── FASE 0 ───────────
  async phase0_Intro() {
    this.ui.hideAllUI();
    this.board.clear();
    this.board.lock();
    await this.ui.showOverlay("ch2.intro", "ch2.enter");
    await this.runPhase(1);
  }

  // ─────────── FASE 1 – movimiento ───────────
  async phase1_Movement() {
    this.board.clear();
    this.board.setRules({});
    this.place([["wr", 3, 2]]);
    this.moves = 0;
    this.axes = { h: false, v: false };

    this.ui.hideAllUI();
    this.ui.showMessage("ch2.p1.tap");
    this.ui.showProgress("ch2.p1.progress", { n: 0 });
    this.currentObjective = "movement";
    this.startIdleTimer();
  }

  // ─────────── FASE 2 – camino libre ───────────
  async phase2_Path() {
    this.pathIndex = 0;
    this.setupPath(true);
  }

  setupPath(announce) {
    const ex = PATHS[this.pathIndex];
    this.board.clear();
    this.board.setRules({});
    this.place(ex.pieces);
    this.board.markTarget(ex.target[0], ex.target[1]);
    this.pathMoves = 0;

    this.ui.hideAllUI();
    if (announce) this.ui.showMessage(ex.msg);
    this.ui.showProgress("ch2.p2.progress", { i: this.pathIndex + 1, n: 0, min: ex.min });
    this.ui.showHintButton(() => this.pathHint(), "ui.hint");
    this.ui.showResetButton(() => this.setupPath(true));
    this.currentObjective = "path";
    this.startIdleTimer();
  }

  pathHint() {
    if (this.board.locked) return;
    const [tr, tc] = PATHS[this.pathIndex].target;
    const st = stateFromBoard(this.board);
    const t = tr * st.size + tc;
    const res = solvePuzzle(st, s => s.cells[t] === "wr");
    if (res.move) {
      this.pulseMove(res.move);
      this.ui.showMessage("ch2.hintShown");
    }
  }

  // ─────────── FASE 3 – captura en cadena ───────────
  async phase3_Capture() {
    this.board.clear();
    this.board.setRules({ capturesOnly: true });
    this.place(CHAIN);
    this.captures = 0;

    this.ui.hideAllUI();
    this.ui.showMessage("ch2.p3.intro");
    this.ui.showProgress("ch2.p3.progress", { n: 0 });
    this.ui.showResetButton(() => this.runPhase(3));
    this.currentObjective = "capture";
    setTimeout(() => this.board.pulse([{ row: 1, col: 1 }]), 1200);
    this.startIdleTimer();
  }

  // ─────────── FASE 4 – peón + torre ───────────
  async phase4_Coordination() {
    this.coordIndex = 0;
    this.setupCoord(true);
  }

  setupCoord(announce) {
    const ex = COORD[this.coordIndex];
    this.board.clear();
    this.board.setRules({});
    this.place(ex.pieces);

    this.ui.hideAllUI();
    if (announce) this.ui.showMessage(ex.msg);
    this.ui.showProgress("ch2.p4.progress", { i: this.coordIndex + 1 });
    this.ui.showHintButton(() => this.coordHint(), "ui.hint");
    this.ui.showResetButton(() => this.setupCoord(true));
    this.currentObjective = "coord";
    this.startIdleTimer();
  }

  coordSolve() {
    return solvePuzzle(stateFromBoard(this.board), s => !s.cells.some(c => c && c[0] === "b"));
  }

  coordHint() {
    if (this.board.locked) return;
    const res = this.coordSolve();
    if (res.move) {
      this.pulseMove(res.move);
      this.ui.showMessage("ch2.hintShown");
    } else this.coordStuck();
  }

  coordStuck() {
    this.board.lock();
    this.ui.hideHintButton();
    this.ui.showMessage("ch2.stuck");
    this.ui.drawAttention("reset");
  }

  // ─────────── FASE 5 – misión con rival ───────────
  get game() {
    const size = this.board.size;
    return {
      rules: {},
      terminal: st => {
        for (let c = 0; c < size; c++) if (st.cells[(size - 1) * size + c] === "bp") return "b";
        if (st.cells.includes("bq")) return "b";
        const blacks = st.cells.filter(c => c && c[0] === "b").length;
        if (blacks <= MISSION.filter(p => p[0][0] === "b").length - MISSION_GOAL) return "w";
        return null;
      },
      evaluate: st => {
        let s = 0;
        st.cells.forEach((c, i) => {
          if (!c || c[0] === "n") return;
          const r = Math.floor(i / size);
          if (c[0] === "w") s += VALUE[c[1]] * 3;
          else s -= VALUE[c[1]] * 3 + r * r * 4;
        });
        return s;
      }
    };
  }

  async phase5_Mission(announce = true) {
    clearTimeout(this.transitionTimer);
    this.board.clear();
    this.board.setRules({});
    this.board.lock();
    this.ui.hideAllUI();
    if (announce) await this.ui.showOverlay("ch2.mission.intro", "ui.play");

    this.board.clear();
    this.board.setRules({});
    this.place(MISSION);
    this.missionCaptures = 0;

    this.ui.showMessage("ch2.mission.goal");
    this.ui.showProgress("ch2.mission.progress", { n: 0, goal: MISSION_GOAL });
    this.ui.showHintButton(() => this.missionHint(), "ui.hint");
    this.ui.showResetButton(() => this.phase5_Mission(false));
    if (this.missionLosses >= 2) this.ui.drawAttention("hint");
    this.currentObjective = "mission";
  }

  missionHint() {
    if (this.board.locked) return;
    const res = bestMove(stateFromBoard(this.board), "w", this.game, 4);
    if (res?.move) {
      this.pulseMove(res.move);
      this.ui.showMessage("ch2.hintShown");
    }
  }

  rivalTurn() {
    this.board.lock();
    this.ui.showProgress("ch1.race.rivalTurn");
    this.transitionTimer = setTimeout(() => {
      if (this.currentObjective !== "mission") return;
      const st = stateFromBoard(this.board);
      const noise = 60 + 45 * Math.min(this.missionLosses, 3);
      const m = rivalMove(st, "b", this.game, { depth: 2, noise });
      if (!m) return this.missionEnd("draw");
      const size = this.board.size;
      const piece = this.board.grid[Math.floor(m.from / size)][m.from % size];
      this.board.movePiece(piece, Math.floor(m.to / size), m.to % size);
    }, RIVAL_DELAY_MS);
  }

  missionEnd(result) {
    this.board.lock();
    this.ui.hideHintButton();
    if (result === "won") {
      this.data.missionDone = true;
      this.sound.playSuccess();
      this.ui.showProgress("ch1.race.wonShort");
      this.ui.showMessage("ch2.mission.won");
      this.goTo(6, 2600);
      return;
    }
    this.missionLosses++;
    this.ui.showProgress(result === "draw" ? "ch1.race.drawShort" : "ch1.race.lostShort");
    this.ui.showMessage(result === "draw" ? "ch1.race.draw" : "ch2.mission.lost");
    this.ui.drawAttention("reset");
    this.currentObjective = "mission-over";
  }

  // ─────────── FASE 6 – cierre ───────────
  async phase6_Closing() {
    await this.closing("ch2.mastered", "ch2.complete");
  }

  // ─────────── Lógica de cada movimiento ───────────
  onMove({ piece, from, to, captured }) {
    switch (this.currentObjective) {
      case "movement": {
        this.moves++;
        if (from.row === to.row) this.axes.h = true;
        else this.axes.v = true;
        this.ui.showProgress("ch2.p1.progress", { n: Math.min(this.moves, 4) });
        if (this.moves >= 4 && this.axes.h && this.axes.v) {
          this.data.movementDone = true;
          this.sound.playSuccess();
          this.ui.showMessage("ch2.p1.done");
          this.goTo(2, 2600);
        } else if (this.moves >= 3 && !(this.axes.h && this.axes.v)) {
          this.ui.showMessage(this.axes.h ? "ch2.p1.tryV" : "ch2.p1.tryH");
        } else if (this.moves === 1) {
          this.ui.showMessage("ch2.p1.good");
        }
        break;
      }

      case "path": {
        this.pathMoves++;
        const ex = PATHS[this.pathIndex];
        this.ui.showProgress("ch2.p2.progress", { i: this.pathIndex + 1, n: this.pathMoves, min: ex.min });
        if (to.row === ex.target[0] && to.col === ex.target[1]) {
          this.sound.playSuccess();
          this.board.clearTargets();
          this.ui.showMessage(this.pathMoves <= ex.min ? "ch2.p2.perfect" : "ch2.p2.more",
            { n: this.pathMoves, min: ex.min });
          const last = this.pathIndex >= PATHS.length - 1;
          this.goTo(() => {
            if (last) { this.data.pathDone = true; this.runPhase(3); }
            else { this.pathIndex++; this.setupPath(true); }
          }, 2400);
        }
        break;
      }

      case "capture": {
        if (!captured) break;
        this.captures++;
        this.ui.showProgress("ch2.p3.progress", { n: this.captures });
        if (this.captures >= 4) {
          this.data.capturesDone = true;
          this.sound.playSuccess();
          this.ui.showMessage("ch2.p3.done");
          this.goTo(4, 2200);
        } else {
          this.ui.showMessage(this.captures === 1 ? "ch2.p3.good" : "ch1.p2.again");
        }
        break;
      }

      case "coord": {
        const blacks = this.board.pieces("b").length;
        if (blacks === 0) {
          this.sound.playSuccess();
          this.ui.showMessage("ch2.p4.done");
          const last = this.coordIndex >= COORD.length - 1;
          this.goTo(() => {
            if (last) { this.data.coordinationDone = true; this.runPhase(5); }
            else { this.coordIndex++; this.setupCoord(true); }
          }, 2400);
        } else if (piece.type === "p" && !captured) {
          this.ui.showMessage("ch2.p4.opened");
        } else if (!this.coordSolve().move) {
          this.coordStuck();
        }
        break;
      }

      case "mission": {
        const st = stateFromBoard(this.board);
        const result = this.game.terminal(st);
        if (piece.color === "w") {
          if (captured) {
            this.missionCaptures++;
            this.ui.showMessage("ch1.race.captured");
          }
          if (result === "w") return this.missionEnd("won");
          if (!genMoves(st, "b").length) return this.missionEnd("draw");
          this.ui.showProgress("ch2.mission.progress", { n: this.missionCaptures, goal: MISSION_GOAL });
          this.rivalTurn();
        } else {
          if (result === "b") return this.missionEnd("lost");
          if (captured) this.ui.showMessage("ch1.race.lostPawn");
          if (!genMoves(st, "w").length) return this.missionEnd("draw");
          this.board.locked = false;
          this.ui.showProgress("ch2.mission.progressTurn", { n: this.missionCaptures, goal: MISSION_GOAL });
        }
        break;
      }
    }
  }
}
