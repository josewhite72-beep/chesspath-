import { StepChapter, stateFromBoard, solvePuzzle } from "./StepChapter.js";
import { pawnRace } from "./missions.js";

/*
 * CAPÍTULO 3 – SANTUARIO DE LOS ALFILES
 * Posiciones verificadas con el solucionador:
 *  - rutas: mínimos 2, 3 y 3 (el alfil necesita 3 movimientos para rodear un obstáculo)
 *  - cadena: sin callejones sin salida
 *  - acertijos: mínimos 3 y 3
 *  - misión: siguiendo pistas 100 %; principiante ~74 %
 */

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Tras acertar, el alfil viaja solo hasta la bandera correcta */
async function travelToFlag(q) {
  const [tr, tc] = q.taps[0];
  const t = tr * this.board.size + tc;
  const goal = st => st.cells[t] === "wb";
  for (let i = 0; i < 4; i++) {
    const res = solvePuzzle(stateFromBoard(this.board), goal);
    if (!res.move) break;
    this.pulseMove(res.move, 900);
    await sleep(600);
    if (this.currentObjective !== "quiz") return;
    this.moveByIndex(res.move);
    await sleep(900);
    if (this.board.grid[tr][tc]) break;
  }
  await sleep(700);
  if (this.currentObjective === "quiz") this.nextQuestion();
}

const colorQ = (bishop, same, other) => ({
  pieces: [["wb", ...bishop]],
  marks: [same, other],
  prompt: "ch3.p2.prompt",
  taps: [same],
  explain: "ch3.p2.right",
  wrong: "ch3.p2.wrong",
  explainDelay: 2200,
  then: travelToFlag
});

export class Chapter3 extends StepChapter {
  constructor(opts) {
    super({ ...opts, id: "chapter3" }, [
      { type: "intro", text: "ch3.intro", btn: "ch3.enter" },

      { type: "free", star: "movementDone", pieces: [["wb", 3, 2]], count: 4,
        msg: "ch3.p1.tap", good: "ch3.p1.good", done: "ch3.p1.done",
        track(info, s) {
          s.dirs = s.dirs || new Set();
          s.dirs.add(`${Math.sign(info.to.row - info.from.row)},${Math.sign(info.to.col - info.from.col)}`);
        },
        need: s => (s.dirs && s.dirs.size >= 2 ? null : "ch3.p1.tryOther") },

      { type: "quiz", star: "colorDone", done: "ch3.p2.done", questions: [
        colorQ([5, 0], [0, 5], [0, 4]),
        colorQ([4, 1], [1, 2], [1, 3]),
        colorQ([3, 3], [0, 0], [5, 0])
      ] },

      { type: "reach", star: "pathDone", exercises: [
        { pieces: [["wb", 5, 1]], target: [1, 3], msg: "ch3.p3.ex1" },
        { pieces: [["wb", 5, 1], ["nx", 3, 3]], target: [1, 5], msg: "ch3.p3.ex2" },
        { pieces: [["wb", 5, 4], ["nx", 3, 2], ["nx", 2, 5]], target: [1, 0], msg: "ch3.p3.ex3" }
      ] },

      { type: "chain", star: "capturesDone",
        pieces: [["wb", 5, 0], ["bp", 1, 2], ["bp", 2, 3], ["bp", 0, 3], ["bp", 2, 1]],
        msg: "ch3.p4.intro", good: "ch3.p4.good", done: "ch3.p4.done", pulse: [2, 3] },

      { type: "clear", star: "coordinationDone", done: "ch3.p5.done", exercises: [
        { pieces: [["wr", 5, 0], ["wb", 5, 5], ["bp", 2, 2], ["bp", 0, 4], ["bp", 2, 0]], msg: "ch3.p5.ex1" },
        { pieces: [["wb", 5, 0], ["wp", 4, 1], ["wr", 5, 5], ["bp", 1, 4], ["bp", 0, 5]], msg: "ch3.p5.ex2" }
      ] },

      { type: "mission", star: "missionDone",
        pieces: [["wb", 5, 2], ["wr", 5, 5], ["wp", 4, 1], ["bp", 1, 0], ["bp", 1, 2], ["bp", 1, 3], ["bp", 1, 5]],
        intro: "ch3.mission.intro", goal: "ch3.mission.goal",
        won: "ch3.mission.won", lost: "ch3.mission.lost",
        ...pawnRace(3, 4) },

      { type: "closing", mastered: "ch3.mastered", complete: "ch3.complete" }
    ]);
  }
}
