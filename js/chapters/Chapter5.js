import { StepChapter, stateFromBoard, genMoves, applyMove } from "./StepChapter.js";
import { VALUE } from "./missions.js";
import { t } from "../utils/i18n.js";

/*
 * CAPÍTULO 5 – PALACIO DE LA DAMA
 * Posiciones verificadas:
 *  - alcance en un movimiento: exactamente una bandera alcanzable por pregunta
 *  - cadena: primera captura única, sin callejones sin salida
 *  - captura segura: de 3 capturas posibles, SOLO UNA no puede ser recapturada
 *  - misión (Dama + Torre + Peón contra 2 caballos y 3 peones que se mueven),
 *    objetivo: capturar 4 piezas sin perder la Dama, con escudo
 *    → siguiendo pistas 100 %; principiante con escudo ~77 %
 */

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function travelTo(q) {
  const [tr, tc] = q.taps[0];
  const st = stateFromBoard(this.board);
  const m = genMoves(st, "w").find(x => x.to === tr * st.size + tc);
  if (m) { this.pulseMove(m, 900); await sleep(600); this.moveByIndex(m); }
  await sleep(1300);
  if (this.currentObjective === "quiz") this.nextQuestion();
}

const reachQ = (pieces, flags, correct) => ({
  pieces, marks: flags, taps: [flags[correct]],
  prompt: "ch5.p2.prompt", explain: "ch5.p2.right", wrong: "ch5.p2.wrong",
  explainDelay: 1500, then: travelTo
});

const SAFE = [
  { pieces: [["wq", 4, 1], ["bn", 0, 4], ["bb", 3, 2], ["br", 3, 1], ["bp", 3, 0], ["bp", 2, 3], ["bp", 3, 4]], shields: true },
  { pieces: [["wq", 4, 2], ["bn", 3, 1], ["bb", 3, 3], ["br", 1, 1], ["bp", 2, 3], ["bp", 0, 3], ["bp", 1, 2]], shields: true },
  { pieces: [["wq", 4, 1], ["bn", 3, 0], ["bb", 1, 0], ["br", 1, 1], ["bp", 0, 5], ["bp", 3, 2], ["bp", 1, 5]], shields: false }
];

const PROMO = [
  { pieces: [["wp", 1, 3], ["bp", 3, 0]], msg: "ch5.p6.ex1", best: null },
  { pieces: [["wp", 1, 2], ["br", 1, 4], ["br", 2, 1]], msg: "ch5.p6.ex2", best: "n" }
];

const MISSION = [["wq", 5, 3], ["wr", 5, 0], ["wp", 4, 4],
  ["bn", 0, 1], ["bn", 0, 4], ["bp", 1, 0], ["bp", 1, 2], ["bp", 1, 5]];
const MISSION_GOAL = 4;

export class Chapter5 extends StepChapter {
  constructor(opts) {
    super({ ...opts, id: "chapter5" }, [
      { type: "intro", text: "ch5.intro", btn: "ch5.enter" },

      { type: "free", star: "movementDone", pieces: [["wq", 3, 2]], count: 4,
        msg: "ch5.p1.tap", good: "ch5.p1.good", done: "ch5.p1.done",
        track(info, s) {
          if (info.from.row === info.to.row || info.from.col === info.to.col) s.line = true; else s.diag = true;
        },
        need: s => (!s.line ? "ch5.p1.tryLine" : !s.diag ? "ch5.p1.tryDiag" : null) },

      { type: "quiz", star: "reachDone", done: "ch5.p2.done", questions: [
        reachQ([["wq", 4, 1]], [[1, 4], [0, 2], [2, 4]], 0),
        reachQ([["wq", 3, 3], ["nx", 3, 1], ["nx", 1, 1]], [[3, 0], [0, 0], [5, 5]], 2),
        reachQ([["wq", 5, 2], ["nx", 3, 4], ["nx", 2, 2]], [[1, 2], [0, 5], [5, 5]], 2)
      ] },

      { type: "chain", star: "capturesDone",
        pieces: [["wq", 5, 0], ["bp", 0, 2], ["bp", 3, 1], ["bp", 3, 2], ["bp", 1, 3]],
        msg: "ch5.p3.intro", good: "ch5.p3.good", done: "ch5.p3.done" },

      { type: "quiz", star: "valuesDone", done: "ch5.p4.done", questions: [
        { pieces: [["wq", 2, 2]], prompt: "ch5.p4.q1",
          choices: [{ key: "ch5.p4.n3" }, { key: "ch5.p4.n5" }, { key: "ch5.p4.n9", correct: true }], explain: "ch5.p4.a1" },
        { pieces: [["wr", 2, 1], ["wb", 2, 3], ["wp", 3, 4]], prompt: "ch5.p4.q2",
          choices: [{ key: "ch5.p4.rook", correct: true }, { key: "ch5.p4.bishopPawn" }], explain: "ch5.p4.a2" },
        { pieces: [["wn", 2, 1], ["wn", 2, 2], ["wq", 2, 4]], prompt: "ch5.p4.q3",
          choices: [{ key: "ch5.p4.twoKnights" }, { key: "ch5.p4.queen", correct: true }], explain: "ch5.p4.a3" }
      ] },

      { type: "custom", star: "safeDone", run() { this.safeIndex = 0; this.setupSafe(true); },
        onMove(info) { return this.safeMove(info); } },

      { type: "custom", star: "promotionDone", run() { this.promoIndex = 0; this.setupPromo(true); },
        onMove(info) { return this.promoMove(info); } },

      { type: "mission", star: "missionDone", pieces: MISSION, shield: ["q"], hintDepth: 3,
        intro: "ch5.mission.intro", goal: "ch5.mission.goal",
        won: "ch5.mission.won", lost: "ch5.mission.lost", lostPiece: "ch5.mission.lostPiece",
        terminal(st) {
          if (!st.cells.includes("wq")) return "b";
          const blacks = st.cells.filter(c => c && c[0] === "b").length;
          if (blacks <= MISSION.filter(p => p[0][0] === "b").length - MISSION_GOAL) return "w";
          return null;
        },
        evaluate(st) {
          let s = 0;
          st.cells.forEach((c, i) => {
            if (!c || c[0] === "n") return;
            const r = Math.floor(i / st.size);
            if (c[0] === "w") s += VALUE[c[1]] * 3 + (c[1] === "q" ? 300 : 0);
            else s -= VALUE[c[1]] * 3 + (c[1] === "p" ? r * r * 3 : 0);
          });
          return s;
        },
        progress: info => t("step.captured", { n: info.captures, goal: MISSION_GOAL }) },

      { type: "closing", mastered: "ch5.mastered", complete: "ch5.complete" }
    ]);
  }

  // ───────────── Captura segura ─────────────
  setupSafe(announce) {
    const ex = SAFE[this.safeIndex];
    this.setup(ex.pieces, { capturesOnly: true, onlyTypes: ["q"] });
    if (ex.shields) this.markDefended();
    this.ui.hideAllUI();
    if (announce) this.ui.showMessage(ex.shields ? "ch5.p5.intro" : "ch5.p5.noShields");
    this.ui.showProgress("ch5.p5.progress", { i: this.safeIndex + 1, total: SAFE.length });
    this.ui.showResetButton(() => this.setupSafe(true));
    this.currentObjective = "safe";
  }

  /** Escuditos sobre las piezas negras que están defendidas */
  markDefended() {
    const st = stateFromBoard(this.board);
    const size = st.size;
    genMoves(st, "w", { capturesOnly: true }).forEach(m => {
      const after = applyMove(st, m);
      if (genMoves(after, "b").some(b => b.to === m.to)) {
        this.board.getSquareElement(Math.floor(m.to / size), m.to % size)?.classList.add("defended");
      }
    });
  }

  safeMove({ piece, to, captured }) {
    if (this.currentObjective !== "safe") return false;
    if (piece.color !== "w") return true;
    this.board.element.querySelectorAll(".defended").forEach(el => el.classList.remove("defended"));
    this.board.lock();
    const st = stateFromBoard(this.board);
    const size = st.size;
    const recapture = genMoves(st, "b").find(b => b.to === to.row * size + to.col);
    if (recapture) {
      this.ui.showMessage("ch5.p5.defended");
      this.transitionTimer = setTimeout(() => {
        this.moveByIndex(recapture);
        this.ui.showMessage("ch5.p5.lostQueen");
        this.transitionTimer = setTimeout(() => this.setupSafe(false), 2600);
      }, 1100);
    } else {
      this.sound.playSuccess();
      this.ui.showMessage("ch5.p5.safe");
      const last = this.safeIndex >= SAFE.length - 1;
      this.goTo(() => {
        if (last) this.finishStep("ch5.p5.done", 2200);
        else { this.safeIndex++; this.setupSafe(true); }
      }, 2200);
    }
    return true;
  }

  // ───────────── Promoción con elección ─────────────
  setupPromo(announce) {
    const ex = PROMO[this.promoIndex];
    this.setup(ex.pieces, { onlyTypes: ["p"] });
    this.manualPromotion = true;
    this.ui.hideAllUI();
    if (announce) this.ui.showMessage(ex.msg);
    this.ui.showProgress("ch5.p6.progress", { i: this.promoIndex + 1, total: PROMO.length });
    this.ui.showResetButton(() => this.setupPromo(true));
    this.currentObjective = "promo";
    this.startIdleTimer();
  }

  promoMove({ piece, reachedEnd }) {
    if (this.currentObjective !== "promo") return false;
    if (!reachedEnd) return true;
    this.board.lock();
    this.stopIdleTimer();
    const ex = PROMO[this.promoIndex];
    this.ui.showMessage(ex.best ? "ch5.p6.askFork" : "ch5.p6.ask");
    const choose = type => {
      if (ex.best && type !== ex.best) {
        this.ui.showMessage("ch5.p6.notFork");
        return;
      }
      this.ui.hideChoices();
      piece.promote(type);
      this.sound.playSuccess();
      if (ex.best) {
        this.board.pulse(this.board.pieces("b").map(p => ({ row: p.row, col: p.col })), 2400);
        this.ui.showMessage("ch5.p6.forkRight");
      } else {
        this.ui.showMessage(type === "q" ? "ch5.p6.queen" : "ch5.p6.other");
      }
      const last = this.promoIndex >= PROMO.length - 1;
      this.goTo(() => {
        if (last) this.finishStep("ch5.p6.done", 2200);
        else { this.promoIndex++; this.setupPromo(true); }
      }, 3200);
    };
    this.ui.showChoices(["q", "r", "b", "n"].map(tp => ({ key: `ch5.piece.${tp}`, onClick: () => choose(tp) })));
    return true;
  }
}
