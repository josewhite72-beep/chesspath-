import { celebrate } from "../ui/celebrate.js";
import { StepChapter } from "./StepChapter.js";
import { legalMoves, applyMove, inCheck, attacked } from "../game/Engine.js";
import { aiBestMove, aiRivalMove, insufficientMaterial, positionKey, PIECE_VALUE } from "../game/GameAI.js";
import { t } from "../utils/i18n.js";

/*
 * CAPÍTULO 7 – EL GRAN REINO  (tablero 8×8, partidas completas)
 * - Formar el ejército tocando las casillas
 * - Coordenadas a–h / 1–8
 * - Captura al paso (práctica + predicción)
 * - Tablas: ahogado, material insuficiente, repetición, acuerdo
 * - Tres principios de apertura (mini-partida guiada)
 * - Partidas completas: Escudo completo → Escudo medio → La Gran Partida (sin escudo)
 * Rival: GameAI (alfa-beta + capturas). Simulado: jugador que sigue pistas gana 100 %;
 * el rival comete errores ("ruido") y se vuelve más suave tras cada derrota.
 */

const L = { legal: true };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const S = 8;
const sq = (r, c) => r * S + c;
const ALL_CASTLE = () => ({ castle: { wK: true, wQ: true, bK: true, bQ: true }, ep: null });
const BACK = ["r", "n", "b", "q", "k", "b", "n", "r"];

const START = [
  ...BACK.map((tp, c) => ["b" + tp, 0, c]),
  ...BACK.map((_, c) => ["bp", 1, c]),
  ...BACK.map((_, c) => ["wp", 6, c]),
  ...BACK.map((tp, c) => ["w" + tp, 7, c])
];

// Formar el ejército: qué pieza y en qué casillas
const ARMY = [
  { type: "r", squares: [[7, 0], [7, 7]], msg: "ch7.p1.rooks" },
  { type: "n", squares: [[7, 1], [7, 6]], msg: "ch7.p1.knights" },
  { type: "b", squares: [[7, 2], [7, 5]], msg: "ch7.p1.bishops" },
  { type: "q", squares: [[7, 3]], msg: "ch7.p1.queen" },
  { type: "k", squares: [[7, 4]], msg: "ch7.p1.king" }
];

// Captura al paso: el peón negro salta dos casillas y el blanco lo captura
const EP = [
  { pieces: [["wk", 7, 6], ["bk", 0, 6], ["wp", 3, 4], ["bp", 1, 3]], black: [sq(1, 3), sq(3, 3)], msg: "ch7.p3.ex1" },
  { pieces: [["wk", 7, 1], ["bk", 0, 1], ["wp", 3, 2], ["bp", 1, 1], ["bp", 1, 6]], black: [sq(1, 1), sq(3, 1)], msg: "ch7.p3.ex2" }
];

// Apertura guiada
const OPENING = [
  { msg: "ch7.p5.center", ok: i => i.piece.type === "p" && i.from.col === 4 && i.to.row === 4,
    hint: [sq(6, 4), sq(4, 4)], reply: [sq(1, 4), sq(3, 4)], good: "ch7.p5.centerGood" },
  { msg: "ch7.p5.knight", ok: i => i.piece.type === "n" && i.from.row === 7 && i.from.col === 6,
    hint: [sq(7, 6), sq(5, 5)], reply: [sq(0, 1), sq(2, 2)], good: "ch7.p5.knightGood" },
  { msg: "ch7.p5.bishop", ok: i => i.piece.type === "b" && i.from.row === 7 && i.from.col === 5,
    hint: [sq(7, 5), sq(4, 2)], reply: [sq(0, 6), sq(2, 5)], good: "ch7.p5.bishopGood" },
  { msg: "ch7.p5.castle", ok: i => !!i.castle,
    hint: [sq(7, 4), sq(7, 6)], reply: null, good: "ch7.p5.castleGood" }
];

// Niveles de partida: escudo y fuerza del rival (ruido en centipeones)
const LEVELS = {
  1: { shield: "full", noise: 260, intro: "ch7.g1.intro", goal: "ch7.g1.goal", won: "ch7.g1.won" },
  2: { shield: "half", noise: 200, intro: "ch7.g2.intro", goal: "ch7.g2.goal", won: "ch7.g2.won" },
  3: { shield: "none", noise: 150, intro: "ch7.g3.intro", goal: "ch7.g3.goal", won: "ch7.g3.won" }
};
const MAX_PLIES = 300;

export class Chapter7 extends StepChapter {
  constructor(opts) {
    const game = (n, star) => ({ type: "custom", star, size: 8, coords: true,
      run() { this.level = n; this.gameLosses = 0; return this.startGame(true); },
      onMove(info) { return this.gameMove(info); } });

    super({ ...opts, id: "chapter7" }, [
      { type: "intro", text: "ch7.intro", btn: "ch7.enter" },

      { type: "custom", star: "armyDone", size: 8, coords: true, run() { this.setupArmy(); } },

      { type: "quiz", star: "coordsDone", size: 8, coords: true, done: "ch7.p2.done", questions: [
        { taps: [[4, 4]], prompt: "ch7.p2.q1", explain: "ch7.p2.a1", wrong: "ch7.p2.wrong" },
        { taps: [[0, 7]], prompt: "ch7.p2.q2", explain: "ch7.p2.a2", wrong: "ch7.p2.wrong" },
        { taps: [[7, 3]], prompt: "ch7.p2.q3", explain: "ch7.p2.a3", wrong: "ch7.p2.wrong",
          pieces: [["wq", 7, 3]] }
      ] },

      { type: "custom", star: "enPassantDone", size: 8, coords: true,
        run() { this.epIndex = 0; this.setupEp(true); },
        onMove(info) { return this.epMove(info); } },

      { type: "quiz", star: "epQuizDone", size: 8, coords: true, rules: L, done: "ch7.p3q.done", questions: [
        { pieces: [["wk", 7, 6], ["bk", 0, 6], ["wp", 3, 4], ["bp", 3, 3]], marks: [[3, 3]],
          prompt: "ch7.p3q.q1",
          choices: [{ key: "ch6.yes", correct: true }, { key: "ch6.no" }], explain: "ch7.p3q.a1" },
        { pieces: [["wk", 7, 6], ["bk", 0, 6], ["wp", 3, 4], ["bp", 3, 3], ["bn", 0, 1]], marks: [[3, 3]],
          prompt: "ch7.p3q.q2",
          choices: [{ key: "ch6.yes" }, { key: "ch6.no", correct: true }], explain: "ch7.p3q.a2" }
      ] },

      { type: "quiz", star: "drawsDone", size: 8, coords: true, done: "ch7.p4.done", questions: [
        { pieces: [["bk", 0, 0], ["wq", 2, 1], ["wk", 5, 4]], prompt: "ch7.p4.q1",
          choices: [{ key: "ch7.p4.whiteWins" }, { key: "ch7.p4.drawStalemate", correct: true }], explain: "ch7.p4.a1" },
        { pieces: [["wk", 4, 4], ["bk", 2, 4]], prompt: "ch7.p4.q2",
          choices: [{ key: "ch7.p4.yesBetter" }, { key: "ch7.p4.drawMaterial", correct: true }], explain: "ch7.p4.a2" },
        { pieces: [["wk", 7, 6], ["wr", 6, 0], ["bk", 0, 6], ["br", 1, 7]], prompt: "ch7.p4.q3",
          choices: [{ key: "ch7.p4.firstWins" }, { key: "ch7.p4.drawRepeat", correct: true }], explain: "ch7.p4.a3" },
        { pieces: START, prompt: "ch7.p4.q4",
          choices: [{ key: "ch7.p4.agreeYes", correct: true }, { key: "ch7.p4.agreeNo" }], explain: "ch7.p4.a4" }
      ] },

      { type: "custom", star: "openingDone", size: 8, coords: true,
        run() { this.openIndex = 0; this.openSnap = null; this.setupOpening(true); },
        onMove(info) { return this.openingMove(info); } },

      game(1, "game1Done"),
      game(2, "game2Done"),
      game(3, "grandDone"),

      { type: "closing", mastered: "ch7.mastered", complete: "ch7.complete" }
    ]);
  }

  /* ───────────── utilidades ───────────── */

  /** Carga un estado del motor en el tablero (para deshacer) */
  loadState(st) {
    const pieces = [];
    st.cells.forEach((c, i) => { if (c) pieces.push([c, Math.floor(i / S), i % S]); });
    this.setup(pieces, L, { castle: st.castle ? { ...st.castle } : null, ep: st.ep ?? null });
    this.board.markCheck(inCheck(st, "w") ? "w" : null);
  }

  engineMove(from, to) {
    return legalMoves(this.missionState(), this.board.grid[Math.floor(from / S)][from % S]?.color || "w")
      .find(m => m.from === from && m.to === to) || null;
  }

  pulseIdx([from, to], ms = 3000) {
    this.pulseMove({ from, to }, ms);
  }

  /* ───────────── Fase 1: formar el ejército ───────────── */
  setupArmy() {
    this.board.clear();
    this.armyIndex = 0;
    this.armyLeft = null;
    this.ui.hideAllUI();
    this.ui.showHintButton(() => this.armyHint(), "ui.hint");
    this.currentObjective = "army";
    this.board.onSquareTap = (r, c) => { this.armyTap(r, c); return true; };
    this.nextArmyItem(true);
  }

  nextArmyItem(first) {
    const item = ARMY[this.armyIndex];
    this.armyLeft = item.squares.map(s => [...s]);
    this.ui.showMessage(first ? "ch7.p1.intro" : item.msg);
    if (first) this.transitionTimer = setTimeout(() => {
      if (this.currentObjective === "army" && this.armyIndex === 0) this.ui.showMessage(item.msg);
    }, 4200);
    this.ui.showProgress("ch7.p1.progress", { i: this.armyIndex + 1, total: ARMY.length });
  }

  armyHint() {
    if (!this.armyLeft) return;
    this.board.pulse(this.armyLeft.map(([row, col]) => ({ row, col })), 2600);
    this.hintMsg();
  }

  armyTap(r, c) {
    if (this.currentObjective !== "army") return;
    const item = ARMY[this.armyIndex];
    const k = this.armyLeft.findIndex(([a, b]) => a === r && b === c);
    if (k < 0) {
      this.sound.playMove();
      this.ui.showMessage("ch7.p1.wrong", { piece: t(`ch7.piece.${item.type}`) });
      this.board.pulse(this.armyLeft.map(([row, col]) => ({ row, col })), 1600);
      return;
    }
    this.armyLeft.splice(k, 1);
    this.board.placePiece(item.type, "w", r, c);
    this.sound.playMove();
    if (this.armyLeft.length) return;
    this.armyIndex++;
    if (this.armyIndex < ARMY.length) {
      this.sound.playSuccess();
      if (item.type === "q") this.ui.showMessage("ch7.p1.queenGood");
      this.transitionTimer = setTimeout(() => this.nextArmyItem(false), item.type === "q" ? 2600 : 500);
      return;
    }
    // Peones y ejército negro en espejo
    this.board.onSquareTap = null;
    this.board.lock();
    this.currentObjective = "army-fill";
    this.ui.hideHintButton();
    this.fillArmy();
  }

  async fillArmy() {
    this.ui.showMessage("ch7.p1.pawns");
    for (let c = 0; c < S; c++) { this.board.placePiece("p", "w", 6, c); await sleep(90); }
    await sleep(700);
    this.ui.showMessage("ch7.p1.mirror");
    for (let c = 0; c < S; c++) { this.board.placePiece(BACK[c], "b", 0, c); this.board.placePiece("p", "b", 1, c); await sleep(90); }
    if (this.currentObjective !== "army-fill") return;
    this.finishStep("ch7.p1.done", 4200);
  }

  /* ───────────── Fase 3: captura al paso ───────────── */
  async setupEp(announce) {
    const ex = EP[this.epIndex];
    this.setup(ex.pieces, L, { castle: null, ep: null });
    this.board.lock();
    this.ui.hideAllUI();
    this.ui.showProgress("ch7.p3.progress", { i: this.epIndex + 1, total: EP.length });
    this.currentObjective = "ep-demo";
    const token = Symbol("ep");
    this.epToken = token;
    if (announce) this.ui.showMessage(this.epIndex === 0 ? "ch7.p3.intro" : ex.msg);
    await sleep(announce && this.epIndex === 0 ? 4200 : 1600);
    if (this.epToken !== token) return;
    const m = this.engineMove(ex.black[0], ex.black[1]);
    this.pulseIdx(ex.black, 1200);
    await sleep(700);
    if (this.epToken !== token) return;
    this.moveByIndex(m);
    await sleep(600);
    if (this.epToken !== token) return;
    this.ui.showMessage(this.epIndex === 0 ? "ch7.p3.ex1" : "ch7.p3.now");
    this.ui.showHintButton(() => this.epHint(), "ui.hint");
    this.ui.showResetButton(() => this.setupEp(true));
    this.board.locked = false;
    this.currentObjective = "ep";
    this.startIdleTimer();
  }

  epHint() {
    if (this.board.locked) return;
    const m = legalMoves(this.missionState(), "w").find(x => x.ep != null);
    if (m) { this.pulseMove(m); this.hintMsg(); }
  }

  epMove({ piece, ep }) {
    if (this.currentObjective === "ep-demo") return true;
    if (this.currentObjective !== "ep") return false;
    if (piece.color !== "w") return true;
    this.board.lock();
    this.stopIdleTimer();
    if (ep != null) {
      this.sound.playSuccess();
      this.ui.showMessage("ch7.p3.good");
      const last = this.epIndex >= EP.length - 1;
      this.goTo(() => {
        if (last) this.finishStep("ch7.p3.done", 2600);
        else { this.epIndex++; this.setupEp(true); }
      }, 2600);
    } else {
      this.ui.showMessage("ch7.p3.notEp");
      this.transitionTimer = setTimeout(() => this.setupEp(false), 2600);
    }
    return true;
  }

  /* ───────────── Fase 5: apertura guiada ───────────── */
  setupOpening(announce) {
    if (this.openIndex === 0 || !this.openSnap) {
      this.openIndex = 0;
      this.setup(START, L, ALL_CASTLE());
    } else {
      this.loadState(this.openSnap);
    }
    this.openSnap = this.missionState();
    const task = OPENING[this.openIndex];
    this.ui.hideAllUI();
    if (announce) this.ui.showMessage(task.msg);
    this.ui.showProgress("ch7.p5.progress", { i: this.openIndex + 1, total: OPENING.length });
    this.ui.showHintButton(() => { if (!this.board.locked) { this.pulseIdx(task.hint); this.hintMsg(); } }, "ui.hint");
    this.ui.showResetButton(() => { this.openIndex = 0; this.openSnap = null; this.setupOpening(true); });
    this.currentObjective = "opening";
    this.startIdleTimer();
  }

  openingMove(info) {
    if (this.currentObjective === "opening-reply") return true;
    if (this.currentObjective !== "opening") return false;
    if (info.piece.color !== "w") return true;
    this.board.lock();
    this.stopIdleTimer();
    const task = OPENING[this.openIndex];
    if (!task.ok(info)) {
      this.ui.showMessage("ch7.p5.wrong");
      this.transitionTimer = setTimeout(() => this.setupOpening(true), 2800);
      return true;
    }
    this.sound.playSuccess();
    this.ui.showMessage(task.good);
    const last = this.openIndex >= OPENING.length - 1;
    if (last) {
      this.finishStep(null, 3600);
      return true;
    }
    this.currentObjective = "opening-reply";
    this.transitionTimer = setTimeout(() => {
      if (this.currentObjective !== "opening-reply") return;
      const [f, to] = task.reply;
      const m = this.engineMove(f, to) ||
        aiRivalMove(this.missionState(), "b", { depth: 1, noise: 30 });
      if (m) this.moveByIndex(m);
      this.transitionTimer = setTimeout(() => {
        if (this.currentObjective !== "opening-reply") return;
        this.openIndex++;
        this.openSnap = this.missionState();
        this.setupOpening(true);
      }, 900);
    }, 2600);
    return true;
  }

  /* ───────────── Fases 6–8: partidas completas ───────────── */
  async startGame(announce) {
    clearTimeout(this.transitionTimer);
    const lv = LEVELS[this.level];
    this.board.clear();
    this.board.lock();
    this.ui.hideAllUI();
    if (announce) await this.ui.showOverlay(lv.intro, "ui.play");
    this.setup(START, L, ALL_CASTLE());
    this.history = new Map();
    this.plies = 0;
    this.remember("w");
    this.snap = this.missionState();
    this.ui.showMessage(lv.goal);
    this.showGameProgress(true);
    this.ui.showHintButton(() => this.gameHint(), "ui.hint");
    this.ui.showResetButton(() => this.startGame(false));
    if (lv.shield === "full") this.enableFullShield();
    this.currentObjective = "game";
  }

  showGameProgress(myTurn) {
    const shield = t(`ch7.shield.${LEVELS[this.level].shield}`);
    this.ui.showProgress(myTurn ? "ch7.game.yourTurn" : "ch7.game.rivalTurn", { shield });
  }

  remember(toMove) {
    const k = positionKey(this.missionState(), toMove);
    const n = (this.history.get(k) || 0) + 1;
    this.history.set(k, n);
    return n;
  }

  gameHint() {
    if (this.board.locked || this.currentObjective !== "game") return;
    const m = aiBestMove(this.missionState(), "w", 3);
    if (m) { this.pulseMove(m); this.hintMsg(); }
  }

  /** Escudo completo: casillas rojas donde la pieza quedaría colgando */
  enableFullShield() {
    this.board.dangerCheck = (piece, m) => {
      if (piece.color !== "w" || piece.type === "k") return false;
      const st = this.missionState();
      const mv = legalMoves(st, "w").find(x => x.from === piece.row * S + piece.col && x.to === m.row * S + m.col);
      if (!mv) return false;
      const after = applyMove(st, mv);
      return this.hanging(after, mv.to);
    };
  }

  /** ¿La pieza blanca de `i` se puede perder? (atacada y sin defensa, o atacada por una pieza menor) */
  hanging(st, i) {
    const code = st.cells[i];
    if (!code || code[0] !== "w" || code[1] === "k") return false;
    if (!attacked(st, i, "b")) return false;
    const attackers = legalMoves(st, "b", { capturesOnly: true }).filter(m => m.to === i);
    if (!attackers.length) return false;
    const cheapest = Math.min(...attackers.map(m => PIECE_VALUE[st.cells[m.from][1]]));
    if (cheapest < PIECE_VALUE[code[1]]) return true;
    // ¿defendida? (se quita la pieza para ver si otra blanca cubre la casilla)
    const cells = st.cells.slice(); cells[i] = "b" + code[1];
    return !attacked({ ...st, cells }, i, "w");
  }

  /** Peligro después de mover: pieza colgando o mate en 1 del rival */
  shieldWarning(st, info) {
    const lv = LEVELS[this.level];
    if (lv.shield === "none") return null;
    // ¿Mate en 1 del rival?
    for (const m of legalMoves(st, "b")) {
      const after = applyMove(st, m);
      if (inCheck(after, "w") && !legalMoves(after, "w").length) return { key: "ch7.shield.mate" };
    }
    const moved = info.to.row * S + info.to.col;
    const tradeValue = info.capturedType ? PIECE_VALUE[info.capturedType] : 0;
    const minValue = lv.shield === "full" ? 300 : 900;
    for (let i = 0; i < st.cells.length; i++) {
      const c = st.cells[i];
      if (!c || c[0] !== "w" || PIECE_VALUE[c[1]] < minValue) continue;
      // Un cambio justo no es un error
      if (i === moved && tradeValue >= PIECE_VALUE[c[1]]) continue;
      if (this.hanging(st, i)) return { key: "ch7.shield.hanging", piece: t(`ch7.piece.${c[1]}`), row: Math.floor(i / S), col: i % S };
    }
    return null;
  }

  gameMove(info) {
    if (this.currentObjective === "shield") return true;
    if (this.currentObjective !== "game") return false;
    const st = this.missionState();
    this.plies++;
    if (info.piece.color === "w") {
      this.board.lock();
      if (info.captured) this.ui.showMessage("ch7.game.captured");
      const end = this.gameOver(st, "b");
      if (end) return this.endGame(end), true;
      const warn = this.shieldWarning(st, { ...info, capturedType: this.lastCapturedType(info) });
      if (warn) {
        this.currentObjective = "shield";
        if (warn.row != null) this.board.pulse([{ row: warn.row, col: warn.col }], 4000);
        this.ui.showMessage(warn.key, { piece: warn.piece });
        this.ui.showChoices([
          { key: "ch7.shield.undo", onClick: () => { this.ui.hideChoices(); this.undo(); } },
          { key: "ch7.shield.keep", onClick: () => { this.ui.hideChoices(); this.currentObjective = "game"; this.gameRival(); } }
        ]);
        return true;
      }
      this.gameRival();
    } else {
      if (info.captured) this.ui.showMessage("ch7.game.lost");
      const end = this.gameOver(st, "w");
      if (end) return this.endGame(end), true;
      this.snap = st;
      this.board.locked = false;
      this.showGameProgress(true);
      if (inCheck(st, "w")) this.ui.showMessage("ch7.game.check");
    }
    return true;
  }

  lastCapturedType() {
    // Valor de lo capturado: diferencia de material entre el estado guardado y el actual
    const before = this.snap.cells.filter(c => c && c[0] === "b").map(c => c[1]);
    const now = this.missionState().cells.filter(c => c && c[0] === "b").map(c => c[1]);
    for (const tp of now) { const k = before.indexOf(tp); if (k >= 0) before.splice(k, 1); }
    return before[0] || null;
  }

  undo() {
    if (this.lastKey && this.history.get(this.lastKey)) this.history.set(this.lastKey, this.history.get(this.lastKey) - 1);
    this.loadState(this.snap);
    this.plies = Math.max(0, this.plies - 1);
    this.currentObjective = "game";
    this.showGameProgress(true);
    this.ui.showMessage("ch7.shield.undone");
    if (LEVELS[this.level].shield === "full") this.enableFullShield();
  }

  gameRival() {
    this.showGameProgress(false);
    this.transitionTimer = setTimeout(() => {
      if (this.currentObjective !== "game") return;
      const noise = LEVELS[this.level].noise + 80 * Math.min(this.gameLosses, 3);
      const m = aiRivalMove(this.missionState(), "b", { depth: 2, noise });
      if (!m) return this.endGame("draw");
      this.moveByIndex(m);
    }, 650);
  }

  /** Fin de partida para el bando que debe mover: "w" | "b" | "draw-*" | null */
  gameOver(st, toMove) {
    if (!legalMoves(st, toMove).length) {
      if (inCheck(st, toMove)) return toMove === "w" ? "b" : "w";
      return "draw-stalemate";
    }
    if (insufficientMaterial(st)) return "draw-material";
    this.lastKey = positionKey(st, toMove);
    if (this.remember(toMove) >= 3) return "draw-repeat";
    if (this.plies >= MAX_PLIES) return "draw-long";
    return null;
  }

  endGame(result) {
    this.board.lock();
    this.board.dangerCheck = null;
    this.ui.hideHintButton();
    this.ui.hideChoices();
    this.currentObjective = "mission-over";
    if (result === "w") {
      this.ui.showProgress("ch1.race.wonShort");
      celebrate(this.board);
      return this.finishStep(LEVELS[this.level].won, 3400);
    }
    this.gameLosses++;
    this.ui.showProgress(result === "b" ? "ch1.race.lostShort" : "ch1.race.drawShort");
    this.ui.showMessage(result === "b" ? "ch7.game.lostGame" : `ch7.game.${result}`);
    this.ui.showResetButton(() => this.startGame(false));
    this.ui.drawAttention("reset");
  }
}
