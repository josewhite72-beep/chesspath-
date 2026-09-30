import { StepChapter, stateFromBoard, genMoves, solvePuzzle } from "./StepChapter.js";
import { pawnRace } from "./missions.js";

/*
 * CAPÍTULO 4 – ISLAS DEL CABALLO
 * Posiciones verificadas:
 *  - salto sobre peones: mínimos 1 y 2
 *  - rutas: mínimos 2, 2 y 3 (la casilla de al lado ¡necesita 3 saltos!)
 *  - cadena: sin callejones sin salida
 *  - horquillas: exactamente UN salto ataca a las dos torres, y ese salto es seguro
 *  - misión (caballo + torre + peón): pistas 100 %; principiante ~70 %
 */

const sleep = ms => new Promise(r => setTimeout(r, ms));
const JUMPS = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const knightTargets = (r, c, size = 6) =>
  JUMPS.map(([a, b]) => [r + a, c + b]).filter(([x, y]) => x >= 0 && y >= 0 && x < size && y < size);

/** Pregunta de color: ¿dónde caerá el caballo? */
const colorQ = (r, c) => {
  const light = (r + c) % 2 === 0;           // casilla actual
  return {
    pieces: [["wn", r, c]],
    prompt: light ? "ch4.p3.promptLight" : "ch4.p3.promptDark",
    choices: [
      { key: "ch4.p3.light", correct: !light },
      { key: "ch4.p3.dark", correct: light }
    ],
    explain: "ch4.p3.right",
    wrong: "ch4.p3.wrong",
    explainDelay: 1400,
    async then() {
      // El caballo salta para comprobarlo
      const m = genMoves(stateFromBoard(this.board), "w")[0];
      if (m) { this.pulseMove(m, 900); await sleep(600); this.moveByIndex(m); }
      await sleep(1500);
      if (this.currentObjective === "quiz") this.nextQuestion();
    }
  };
};

const FORKS = [
  { n: [2, 4], r: [[3, 5], [5, 5]], to: [4, 3] },
  { n: [3, 1], r: [[1, 5], [1, 1]], to: [2, 3] },
  { n: [4, 2], r: [[0, 2], [3, 1]], to: [2, 3] }
];

export class Chapter4 extends StepChapter {
  constructor(opts) {
    super({ ...opts, id: "chapter4" }, [
      { type: "intro", text: "ch4.intro", btn: "ch4.enter" },

      { type: "free", star: "movementDone", pieces: [["wn", 3, 2]], count: 4,
        msg: "ch4.p1.tap", good: "ch4.p1.good", done: "ch4.p1.done" },

      { type: "reach", star: "jumpDone", rules: { onlyTypes: ["n"] }, exercises: [
        { pieces: [["wn", 5, 1], ["wp", 4, 0], ["wp", 4, 1], ["wp", 4, 2], ["wp", 5, 0], ["wp", 5, 2]], target: [3, 2], msg: "ch4.p2.ex1" },
        { pieces: [["wn", 4, 3], ["wp", 3, 2], ["wp", 3, 3], ["wp", 3, 4], ["wp", 4, 2], ["wp", 4, 4], ["wp", 5, 2], ["wp", 5, 3], ["wp", 5, 4]], target: [1, 2], msg: "ch4.p2.ex2" }
      ] },

      { type: "quiz", star: "colorDone", done: "ch4.p3.done", questions: [colorQ(3, 2), colorQ(4, 4), colorQ(0, 1)] },

      { type: "reach", star: "routesDone", exercises: [
        { pieces: [["wn", 5, 2]], target: [1, 2], msg: "ch4.p4.ex1" },
        { pieces: [["wn", 5, 0]], target: [1, 0], msg: "ch4.p4.ex2" },
        { pieces: [["wn", 3, 2]], target: [2, 2], msg: "ch4.p4.ex3" }
      ] },

      { type: "chain", star: "capturesDone",
        pieces: [["wn", 5, 1], ["bp", 2, 3], ["bp", 1, 1], ["bp", 4, 2], ["bp", 3, 0]],
        msg: "ch4.p5.intro", good: "ch4.p5.good", done: "ch4.p5.done" },

      { type: "custom", star: "forkDone", run() { this.forkIndex = 0; this.setupFork(true); },
        onMove(info) { return this.forkMove(info); } },

      { type: "mission", star: "missionDone",
        pieces: [["wn", 5, 2], ["wr", 5, 5], ["wp", 4, 1], ["bp", 1, 0], ["bp", 1, 2], ["bp", 1, 3], ["bp", 1, 5]],
        intro: "ch4.mission.intro", goal: "ch4.mission.goal",
        won: "ch4.mission.won", lost: "ch4.mission.lost",
        ...pawnRace(3, 4) },

      { type: "closing", mastered: "ch4.mastered", complete: "ch4.complete" }
    ]);
  }

  // ───────────── Horquilla ─────────────
  setupFork(announce) {
    const f = FORKS[this.forkIndex];
    this.setup([["wn", ...f.n], ["br", ...f.r[0]], ["br", ...f.r[1]]]);
    this.forkStage = 0;
    this.ui.hideAllUI();
    if (announce) this.ui.showMessage(this.forkIndex === 0 ? "ch4.p6.intro" : "ch4.p6.next");
    this.ui.showProgress("ch4.p6.progress", { i: this.forkIndex + 1, total: FORKS.length });
    this.ui.showHintButton(() => this.forkHint(), "ui.hint");
    this.ui.showResetButton(() => this.setupFork(true));
    this.currentObjective = "fork";
  }

  forkHint() {
    if (this.board.locked) return;
    const f = FORKS[this.forkIndex];
    if (this.forkStage === 0) {
      this.board.pulse([{ row: f.n[0], col: f.n[1] }, { row: f.to[0], col: f.to[1] }], 3200);
      this.hintMsg();
    } else {
      const cap = genMoves(stateFromBoard(this.board), "w").find(m => m.capture);
      if (cap) { this.pulseMove(cap); this.hintMsg(); }
    }
  }

  forkMove({ piece, to, captured }) {
    if (this.currentObjective !== "fork") return false;
    if (piece.color !== "w") return true;               // jugada del rival: nada que evaluar
    const rooks = () => this.board.pieces("b").map(p => [p.row, p.col]);

    if (this.forkStage === 0) {
      const attacked = knightTargets(to.row, to.col).filter(([r, c]) => this.board.grid[r][c]?.color === "b");
      if (attacked.length >= 2) {
        this.forkStage = 1;
        this.board.lock();
        this.sound.playSuccess();
        this.ui.showMessage("ch4.p6.fork");
        this.board.pulse(attacked.map(([row, col]) => ({ row, col })), 1600);
        // El rival salva una de las torres
        this.transitionTimer = setTimeout(() => this.rivalSavesRook(to), 1900);
      } else {
        this.board.lock();
        this.ui.showMessage("ch4.p6.notFork");
        this.transitionTimer = setTimeout(() => this.setupFork(false), 1900);
      }
      return true;
    }

    if (this.forkStage === 2) {
      if (captured) {
        const last = this.forkIndex >= FORKS.length - 1;
        this.board.lock();
        this.sound.playSuccess();
        this.ui.showMessage("ch4.p6.won");
        this.goTo(() => {
          if (last) this.finishStep("ch4.p6.done", 2200);
          else { this.forkIndex++; this.setupFork(true); }
        }, 2000);
      } else {
        this.board.lock();
        this.ui.showMessage("ch4.p6.missed");
        this.transitionTimer = setTimeout(() => this.setupFork(false), 2000);
      }
      return true;
    }
    return true;
  }

  rivalSavesRook(knightAt) {
    if (this.currentObjective !== "fork") return;
    const st = stateFromBoard(this.board);
    const size = st.size;
    const attackedIdx = knightTargets(knightAt.row, knightAt.col).map(([r, c]) => r * size + c);
    const safe = genMoves(st, "b").filter(m =>
      !m.capture && attackedIdx.includes(m.from) &&
      !knightTargets(knightAt.row, knightAt.col).some(([r, c]) => r * size + c === m.to));
    const m = safe[Math.floor(Math.random() * safe.length)];
    if (m) this.moveByIndex(m);
    this.forkStage = 2;
    this.board.locked = false;
    this.ui.showMessage("ch4.p6.capture");
  }
}
