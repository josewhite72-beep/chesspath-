import { celebrate } from "../ui/celebrate.js";
import { ChapterBase } from "./ChapterBase.js";
import { stateFromBoard, genMoves, applyMove, solvePuzzle, bestMove, rivalMove } from "../game/Engine.js";

const RIVAL_DELAY_MS = 750;
const DEMO_STEP_MS = 1100;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const noBlacks = st => !st.cells.some(c => c && c[0] === "b");

/**
 * StepChapter – capítulo armado con PASOS DECLARATIVOS.
 * Cada fase es un objeto { type, star, ... }:
 *   intro    { text, btn }
 *   free     { pieces, rules, count, msg, good, done, need(state)→msgKey|null, track(info, state) }
 *   reach    { rules, exercises:[{ pieces, target:[f,c], msg }] }         llegar a la bandera
 *   chain    { pieces, rules, msg, good, done, pulse:[f,c] }              capturar todo en cadena
 *   clear    { rules, exercises:[{ pieces, msg }] }                       capturar todo (acertijo)
 *   quiz     { questions:[{ pieces, marks, prompt, choices:[{key, correct}], explain, taps }] }
 *   mission  { pieces, rules, intro, goal, won, lost, terminal, evaluate, progress, hintDepth }
 *   custom   { run(step) }                                                fase especial del capítulo
 *   closing  { mastered, complete }
 * Al completar una fase se marca data[star] = true.
 */
export class StepChapter extends ChapterBase {
  constructor(opts, steps) {
    super(opts);
    this.steps = steps;
    this.phases = steps.map(step => function () { return this.runStep(step); });
    this.fails = 0;
    this.losses = 0;
  }

  freshData() {
    const d = {};
    (this.steps || []).forEach(s => { if (s.star) d[s.star] = false; });
    return d;
  }

  stop() {
    this.demoToken = null;
    this.board.onSquareTap = null;
    super.stop();
  }

  async runStep(step) {
    this.useBoard(step.size || 6);
    this.board.coords = !!step.coords;
    // Rutas del caballo: solo mientras se aprende (no en misiones ni partidas)
    this.board.showRoutes = step.type !== "mission" && step.routes !== false;
    this.step = step;
    this.demoToken = null;
    this.board.onSquareTap = null;
    this.board.dangerCheck = null;
    this.board.onSelect = step.onSelect ? step.onSelect.bind(this) : null;
    this.manualPromotion = false;
    this.ui.hideAllUI();
    const fn = this[`step_${step.type}`];
    if (fn) await fn.call(this, step);
  }

  /** Completa la fase actual y pasa a la siguiente */
  finishStep(msgKey, delay = 2200, params) {
    if (this.step.star) this.data[this.step.star] = true;
    this.sound.playSuccess();
    if (msgKey) this.ui.showMessage(msgKey, params);
    this.goTo(this.phase + 1, delay);
  }

  setup(pieces, rules = {}, meta = null) {
    this.board.clear();
    this.board.setRules(rules);
    this.place(pieces);
    if (rules.legal) this.board.meta = meta || { castle: null, ep: null };
  }

  hintMsg() { this.ui.showMessage("ch2.hintShown"); }

  // ───────────── intro ─────────────
  async step_intro(step) {
    this.board.clear();
    this.board.lock();
    await this.ui.showOverlay(step.text, step.btn || "ui.continue");
    await this.runPhase(this.phase + 1);
  }

  // ───────────── closing ─────────────
  async step_closing(step) {
    await this.closing(step.mastered, step.complete);
  }

  // ───────────── free: moverse N veces ─────────────
  step_free(step) {
    this.setup(step.pieces, step.rules);
    this.freeState = { moves: 0 };
    this.ui.showMessage(step.msg);
    this.ui.showProgress("step.moves", { n: 0, total: step.count });
    this.currentObjective = "free";
    this.startIdleTimer();
  }

  // ───────────── reach: llegar a la bandera ─────────────
  step_reach(step) {
    this.exIndex = 0;
    this.setupReach(true);
  }

  setupReach(announce) {
    const step = this.step;
    const ex = step.exercises[this.exIndex];
    this.setup(ex.pieces, step.rules);
    this.board.markTarget(ex.target[0], ex.target[1]);
    this.reachMoves = 0;
    this.reachMin = solvePuzzle(stateFromBoard(this.board), this.reachGoal(), { rules: step.rules }).length;
    if (announce) this.ui.showMessage(ex.msg, { min: this.reachMin });
    this.ui.showProgress("step.reach.progress", { i: this.exIndex + 1, total: step.exercises.length, n: 0, min: this.reachMin });
    this.ui.showHintButton(() => this.reachHint(), "ui.hint");
    this.ui.showResetButton(() => this.setupReach(true));
    this.currentObjective = "reach";
    this.startIdleTimer();
  }

  reachGoal() {
    const ex = this.step.exercises[this.exIndex];
    const t = ex.target[0] * this.board.size + ex.target[1];
    return st => !!st.cells[t] && st.cells[t][0] === "w";
  }

  reachHint() {
    if (this.board.locked) return;
    const res = solvePuzzle(stateFromBoard(this.board), this.reachGoal(), { rules: this.step.rules });
    if (res.move) { this.pulseMove(res.move); this.hintMsg(); }
  }

  // ───────────── chain: capturar todo, captura a captura ─────────────
  step_chain(step) {
    this.setup(step.pieces, step.rules || { capturesOnly: true });
    this.chainTotal = this.board.pieces("b").length;
    this.chainN = 0;
    this.ui.showMessage(step.msg);
    this.ui.showProgress("step.captures", { n: 0, total: this.chainTotal });
    this.ui.showResetButton(() => this.runPhase(this.phase));
    this.currentObjective = "chain";
    if (step.pulse) setTimeout(() => this.board.pulse([{ row: step.pulse[0], col: step.pulse[1] }]), 1200);
    this.startIdleTimer();
  }

  // ───────────── clear: acertijo de capturar todo ─────────────
  step_clear(step) {
    this.exIndex = 0;
    this.fails = 0;
    this.setupClear(true);
  }

  setupClear(announce) {
    const ex = this.step.exercises[this.exIndex];
    this.demoToken = null;
    this.setup(ex.pieces, this.step.rules);
    this.ui.hideAllUI();
    if (announce) this.ui.showMessage(ex.msg);
    this.ui.showProgress("step.clear.progress", { i: this.exIndex + 1, total: this.step.exercises.length, n: this.board.pieces("b").length });
    this.ui.showHintButton(() => this.clearHint(), "ui.hint");
    this.ui.showResetButton(() => this.setupClear(true));
    if (this.fails >= 2) this.ui.showSolutionButton(() => this.clearDemo());
    this.currentObjective = "clear";
  }

  clearSolve() {
    return solvePuzzle(stateFromBoard(this.board), noBlacks, { rules: this.step.rules });
  }

  clearHint() {
    if (this.board.locked) return;
    const res = this.clearSolve();
    if (res.move) { this.pulseMove(res.move); this.hintMsg(); }
    else this.clearStuck();
  }

  clearStuck() {
    this.fails++;
    this.board.lock();
    this.ui.hideHintButton();
    if (this.fails >= 2) {
      this.ui.showMessage("ch1.puzzle.stuckSolution");
      this.ui.showSolutionButton(() => this.clearDemo());
      this.ui.drawAttention("solution");
    } else {
      this.ui.showMessage("ch2.stuck");
      this.ui.drawAttention("reset");
    }
  }

  async clearDemo() {
    const token = Symbol("demo");
    this.demoToken = token;
    const ex = this.step.exercises[this.exIndex];
    this.setup(ex.pieces, this.step.rules);
    this.board.lock();
    this.ui.hideAllUI();
    this.ui.showMessage("ch1.puzzle.demo");
    this.currentObjective = "demo";
    await sleep(1600);
    while (this.demoToken === token && this.board.pieces("b").length) {
      const res = this.clearSolve();
      if (!res.move) break;
      this.pulseMove(res.move, DEMO_STEP_MS);
      await sleep(DEMO_STEP_MS * 0.6);
      if (this.demoToken !== token) return;
      this.moveByIndex(res.move);
      await sleep(DEMO_STEP_MS);
    }
    if (this.demoToken !== token) return;
    this.ui.showMessage("ch1.puzzle.demoDone");
    await sleep(2800);
    if (this.demoToken !== token) return;
    this.setupClear(false);
    this.ui.showMessage("ch1.puzzle.yourTurn");
  }

  moveByIndex(m) {
    const size = this.board.size;
    const piece = this.board.grid[Math.floor(m.from / size)][m.from % size];
    if (!piece) return;
    this.board.movePiece(piece, Math.floor(m.to / size), m.to % size, m);
  }

  // ───────────── quiz: preguntas con opciones o tocando casillas ─────────────
  step_quiz(step) {
    this.qIndex = 0;
    this.setupQuestion();
  }

  setupQuestion() {
    const q = this.step.questions[this.qIndex];
    this.setup(q.pieces || [], this.step.rules, q.meta);
    this.board.lock();
    this.board.clearTargets();
    (q.marks || []).forEach(([r, c]) => this.board.getSquareElement(r, c)?.classList.add("target"));
    if (q.check) this.board.markCheck(q.check);
    this.ui.hideAllUI();
    this.ui.showMessage(q.prompt, q.params);
    this.ui.showProgress("step.quiz.progress", { i: this.qIndex + 1, total: this.step.questions.length });
    this.currentObjective = "quiz";

    if (q.choices) {
      this.ui.showChoices(q.choices.map(ch => ({
        key: ch.key, params: ch.params,
        onClick: btn => this.answer(!!ch.correct, btn, q)
      })));
    }
    if (q.taps) {
      this.board.locked = false;
      this.board.onSquareTap = (r, c) => {
        const ok = q.taps.some(([tr, tc]) => tr === r && tc === c);
        this.answer(ok, null, q, { r, c });
        return true;
      };
    }
  }

  answer(ok, btn, q, sq) {
    if (this.answering) return;
    if (ok) {
      this.answering = true;
      btn?.classList.add("right");
      // Sin segundas respuestas: se ocultan las opciones tras un momento
      setTimeout(() => this.ui.hideChoices(), 500);
      if (sq) this.board.pulse([{ row: sq.r, col: sq.c }], 1500);
      this.sound.playSuccess();
      this.ui.showMessage(q.explain || "step.quiz.right", q.params);
      this.board.onSquareTap = null;
      setTimeout(() => {
        this.answering = false;
        if (this.currentObjective !== "quiz") return;
        if (q.then) return q.then.call(this, q);   // continuación especial (p. ej. mover la pieza)
        this.nextQuestion();
      }, q.explainDelay || 2600);
    } else {
      btn?.classList.add("wrong");
      this.sound.playMove();
      this.ui.showMessage(q.wrong || "step.quiz.wrong", q.params);
      if (sq) this.board.pulse([{ row: sq.r, col: sq.c }], 800);
    }
  }

  nextQuestion() {
    if (this.qIndex >= this.step.questions.length - 1) return this.finishStep(this.step.done, 2000);
    this.qIndex++;
    this.setupQuestion();
  }

  // ───────────── mission: partida corta contra el rival ─────────────
  get game() {
    const m = this.step;
    return { rules: m.rules || {}, terminal: m.terminal.bind(this), evaluate: m.evaluate.bind(this) };
  }

  async step_mission(step, announce = true) {
    clearTimeout(this.transitionTimer);
    this.board.clear();
    this.board.lock();
    this.ui.hideAllUI();
    if (announce) await this.ui.showOverlay(step.intro, "ui.play");
    this.setup(step.pieces, step.rules);
    this.missionInfo = { captures: 0, lostPieces: 0 };
    this.ui.showMessage(step.goal);
    this.showMissionProgress(true);
    this.ui.showHintButton(() => this.missionHint(), "ui.hint");
    this.ui.showResetButton(() => this.step_mission(step, false));
    if (this.losses >= 2) this.ui.drawAttention("hint");
    this.currentObjective = "mission";
    if (step.shield) this.enableShield(step.shield);
    step.onStart?.call(this);
  }

  showMissionProgress(myTurn) {
    const p = this.step.progress ? this.step.progress.call(this, this.missionInfo) : null;
    if (p) this.ui.showProgress(myTurn ? "step.mission.turn" : "step.mission.rival", { text: p });
    else this.ui.showProgress(myTurn ? "ch1.race.yourTurn" : "ch1.race.rivalTurn");
  }

  missionHint() {
    if (this.board.locked) return;
    const res = bestMove(this.missionState(), "w", this.game, this.step.hintDepth || 4);
    if (res?.move) { this.pulseMove(res.move); this.hintMsg(); }
  }

  missionState() {
    const st = stateFromBoard(this.board);
    if (this.board.meta) Object.assign(st, JSON.parse(JSON.stringify(this.board.meta)));
    return st;
  }

  rivalTurn() {
    this.board.lock();
    this.showMissionProgress(false);
    this.transitionTimer = setTimeout(() => {
      if (this.currentObjective !== "mission") return;
      const st = this.missionState();
      const noise = (this.step.noise ?? 60) + 45 * Math.min(this.losses, 3);
      const m = rivalMove(st, "b", this.game, { depth: this.step.rivalDepth || 2, noise });
      if (!m) return this.missionEnd("draw");
      this.moveByIndex(m);
    }, RIVAL_DELAY_MS);
  }

  missionEnd(result) {
    this.board.lock();
    this.ui.hideHintButton();
    if (result === "w") {
      this.ui.showProgress("ch1.race.wonShort");
      celebrate(this.board);
      this.currentObjective = "mission-over";
      return this.finishStep(this.step.won, 2600);
    }
    this.losses++;
    this.ui.showProgress(result === "draw" ? "ch1.race.drawShort" : "ch1.race.lostShort");
    this.ui.showMessage(result === "draw" ? (this.step.drawMsg || "ch1.race.draw") : this.step.lost);
    this.ui.drawAttention("reset");
    this.currentObjective = "mission-over";
  }

  /** Escudo: marca en rojo las casillas donde esas piezas quedarían atacadas */
  enableShield(types) {
    this.board.dangerCheck = (piece, m) => {
      if (piece.color !== "w" || !types.includes(piece.type)) return false;
      const st = stateFromBoard(this.board);
      const size = st.size;
      const mv = genMoves(st, "w", this.board.rules).find(x => x.from === piece.row * size + piece.col && x.to === m.row * size + m.col);
      if (!mv) return false;
      const after = applyMove(st, mv);
      return genMoves(after, "b", {}).some(b => b.to === mv.to);
    };
  }

  // ───────────── custom ─────────────
  step_custom(step) {
    return step.run.call(this, step);
  }

  // ───────────── Movimientos ─────────────
  onMove(info) {
    const { piece, captured } = info;
    const step = this.step;
    if (step.onMove && step.onMove.call(this, info) === true) return; // la fase lo manejó

    switch (this.currentObjective) {
      case "free": {
        const s = this.freeState;
        s.moves++;
        step.track?.call(this, info, s);
        this.ui.showProgress("step.moves", { n: Math.min(s.moves, step.count), total: step.count });
        const missing = step.need ? step.need.call(this, s) : null;
        if (s.moves >= step.count && !missing) this.finishStep(step.done, 2600);
        else if (s.moves >= step.count - 1 && missing) this.ui.showMessage(missing);
        else if (s.moves === 1 && step.good) this.ui.showMessage(step.good);
        break;
      }
      case "reach": {
        this.reachMoves++;
        const ex = step.exercises[this.exIndex];
        this.ui.showProgress("step.reach.progress", { i: this.exIndex + 1, total: step.exercises.length, n: this.reachMoves, min: this.reachMin });
        if (info.to.row === ex.target[0] && info.to.col === ex.target[1] && piece.color === "w") {
          this.sound.playSuccess();
          this.board.clearTargets();
          this.ui.showMessage(this.reachMoves <= this.reachMin ? "ch2.p2.perfect" : "ch2.p2.more",
            { n: this.reachMoves, min: this.reachMin });
          const last = this.exIndex >= step.exercises.length - 1;
          this.goTo(() => {
            if (last) this.finishStep(null, 10);
            else { this.exIndex++; this.setupReach(true); }
          }, 2400);
        }
        break;
      }
      case "chain": {
        if (!captured) break;
        this.chainN++;
        this.ui.showProgress("step.captures", { n: this.chainN, total: this.chainTotal });
        if (this.chainN >= this.chainTotal) this.finishStep(step.done, 2200);
        else this.ui.showMessage(this.chainN === 1 ? step.good : "ch1.p2.again");
        break;
      }
      case "clear": {
        const left = this.board.pieces("b").length;
        this.ui.showProgress("step.clear.progress", { i: this.exIndex + 1, total: step.exercises.length, n: left });
        if (left === 0) {
          this.sound.playSuccess();
          this.ui.hideAllUI();
          this.ui.showMessage("ch1.puzzle.done");
          const last = this.exIndex >= step.exercises.length - 1;
          this.goTo(() => {
            if (last) this.finishStep(step.done, 10);
            else { this.exIndex++; this.fails = 0; this.setupClear(true); }
          }, 1800);
        } else if (!this.clearSolve().move) {
          this.clearStuck();
        } else if (captured) {
          this.ui.showMessage("ch1.p2.again");
        }
        break;
      }
      case "mission": {
        const st = this.missionState();
        const result = this.game.terminal(st, piece.color);
        if (piece.color === "w") {
          if (captured) { this.missionInfo.captures++; this.ui.showMessage("ch1.race.captured"); }
          if (result) return this.missionEnd(result);
          if (!genMoves(st, "b", this.game.rules).length) return this.missionEnd(step.noMovesResult?.("b") || "draw");
          this.rivalTurn();
        } else {
          if (captured) { this.missionInfo.lostPieces++; this.ui.showMessage(step.lostPiece || "ch1.race.lostPawn"); }
          if (result) return this.missionEnd(result);
          if (!genMoves(st, "w", this.game.rules).length) return this.missionEnd(step.noMovesResult?.("w") || "draw");
          this.board.locked = false;
          this.showMissionProgress(true);
        }
        break;
      }
    }
  }
}

export { stateFromBoard, genMoves, applyMove, solvePuzzle, bestMove, rivalMove };
