import { Board } from "../game/Board.js";
import { solveCaptureAll } from "../game/Solver.js";
import { stateFromBoard, genMoves, bestMove, rivalMove } from "../game/Race.js";
import { UIManager } from "../ui/UIManager.js";
import { SoundManager } from "../utils/SoundManager.js";
import { saveChapterProgress, getChapterProgress } from "../utils/storage.js";

const IDLE_HINT_MS = 12000;   // pista visual si no hay interacción (fases tutorial)
const RIVAL_DELAY_MS = 750;   // pausa antes de que el rival responda
const DEMO_STEP_MS = 1100;    // ritmo de la demostración "Ver solución"

/*
 * FASES DEL CAPÍTULO 1
 *  0 Introducción
 *  1 Movimiento (3 pasos simples + paso doble)
 *  2 Captura en diagonal
 *  3 Promoción
 *  4 Peón bloqueado (nuevo)
 *  5 Acertijo 3 vs 3 — negros quietos, pistas ilimitadas, "Ver solución"
 *  6 Carrera — el rival SÍ se mueve; gana quien corone primero
 *  7 Cierre
 */

// Acertijo (verificado: 1 sola primera jugada pierde; solución de 4 capturas).
// El peón negro de (3,2) bloquea de frente al blanco de (4,2).
const PUZZLE_WHITES = [[4, 1], [4, 2], [4, 4]];
const PUZZLE_BLACKS = [[2, 1], [2, 3], [3, 2]];

// Carrera (simulada: siguiendo las pistas se gana el 100 %;
// un principiante razonable ~70 %; jugando al azar ~35 %)
const RACE_WHITES = [[4, 0], [4, 1], [4, 2], [4, 3]];
const RACE_BLACKS = [[1, 2], [1, 3], [1, 4], [1, 5]];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function freshData() {
  return {
    movesCompleted: 0,
    doubleStepDone: false,
    capturesCompleted: 0,
    promoted: false,
    blockingDone: false,
    puzzleCompleted: false,
    raceCompleted: false
  };
}

export class Chapter1 {
  constructor({ sound, ui, onExit } = {}) {
    this.sound = sound || new SoundManager();
    this.board = new Board(6);
    this.ui = ui || new UIManager(this.sound);
    this.onExit = onExit || null;
    this.phase = 0;
    this.data = freshData();
    this.everCompleted = false;
    this.currentObjective = null;
    this.idleTimer = null;
    this.transitionTimer = null;
    this.puzzleFails = 0;
    this.raceLosses = 0;
    this.demoRunning = false;
  }

  async start() {
    this.phase = 0;
    this.data = freshData();
    const saved = getChapterProgress("chapter1");
    if (saved) {
      this.everCompleted = !!saved.completed;
      // Se retoma solo si quedó a mitad de una fase jugable (1–6)
      const ph = saved.currentPhase || 0;
      if (ph >= 1 && ph <= 6) {
        this.phase = ph;
        this.data = { ...freshData(), ...saved.missions, completed: false };
      }
    }

    this.board.clear();
    this.board.onMoveCallback = info => this.onMove(info);
    this.board.onInteract = () => this.restartIdleTimer();
    this.board.onSelect = (piece, moves) => this.onSelect(piece, moves);

    await this.runPhase(this.phase);
  }

  /** Detiene todo al salir al mapa (temporizadores, demo, voz, overlay) */
  stop() {
    clearTimeout(this.transitionTimer);
    this.stopIdleTimer();
    this.demoToken = null;
    this.demoRunning = false;
    this.currentObjective = null;
    this.board.lock();
    this.ui.cancelOverlay();
    this.ui.hideAllUI();
    this.sound.stopSpeaking();
  }

  // ─────────────────────────────────────
  // Control de fases
  // ─────────────────────────────────────
  async runPhase(phase) {
    clearTimeout(this.transitionTimer);
    this.stopIdleTimer();
    this.demoRunning = false;
    this.demoToken = null;
    this.phase = phase;
    this.save();

    switch (phase) {
      case 0: await this.phase0_Intro(); break;
      case 1: await this.phase1_Movement(); break;
      case 2: await this.phase2_Capture(); break;
      case 3: await this.phase3_Promotion(); break;
      case 4: await this.phase4_Blocking(); break;
      case 5: await this.phase5_Puzzle(); break;
      case 6: await this.phase6_Race(); break;
      case 7: await this.phase7_Closing(); break;
      default:
        await this.ui.showOverlay("ch1.done");
    }
  }

  /** Bloquea el tablero y pasa a otra fase tras una pausa (evita dobles toques) */
  goTo(phaseOrFn, delay = 900) {
    this.board.lock();
    this.stopIdleTimer();
    clearTimeout(this.transitionTimer);
    this.transitionTimer = setTimeout(() => {
      if (typeof phaseOrFn === "function") phaseOrFn();
      else this.runPhase(phaseOrFn);
    }, delay);
  }

  // ─── Pista por inactividad (fases tutorial) ───
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
    // En "bloqueado" el peón no tiene jugadas: brilla el peón para que lo toquen
    if (this.currentObjective === "block2") {
      const p = this.board.pieces("w")[0];
      if (p) this.board.pulse([{ row: p.row, col: p.col }]);
      return;
    }
    if (this.board.selected) {
      this.board.pulse(this.board.legalMoves);
    } else {
      const movable = this.board.allLegalMoves("w").map(m => ({ row: m.piece.row, col: m.piece.col }));
      this.board.pulse(movable);
    }
  }

  // ─────────────────────────────────────
  // FASE 0 – Introducción
  // ─────────────────────────────────────
  async phase0_Intro() {
    this.ui.hideAllUI();
    this.board.clear();
    this.board.lock();

    await this.ui.showOverlay("ch1.intro", "ui.start");
    await this.runPhase(1);
  }

  // ─────────────────────────────────────
  // FASE 1 – Movimiento: 3 pasos simples + paso doble
  // ─────────────────────────────────────
  async phase1_Movement() {
    if (this.data.movesCompleted >= 3) return this.phase1_DoubleStep();

    this.board.clear();
    this.board.setRules({ onlyTypes: ["p"], doubleStep: false });
    this.data.movesCompleted = 0;

    this.board.placePiece("p", "w", 4, 2);

    this.ui.hideAllUI();
    this.ui.showMessage("ch1.p1.tap");
    this.ui.showProgress("ch1.p1.progress", { n: 0 });

    this.currentObjective = "movement";
    this.startIdleTimer();
  }

  phase1_DoubleStep(announce = true) {
    this.board.clear();
    this.board.setRules({ onlyTypes: ["p"], doubleStep: true });
    this.board.placePiece("p", "w", 4, 3);

    this.ui.hideProgress();
    if (announce) this.ui.showMessage("ch1.p1.double");

    this.currentObjective = "double";
    this.startIdleTimer();
  }

  // ─────────────────────────────────────
  // FASE 2 – Captura (solo capturas; zigzag de 3 capturas)
  // ─────────────────────────────────────
  async phase2_Capture() {
    this.board.clear();
    this.board.setRules({ onlyTypes: ["p"], capturesOnly: true });
    this.data.capturesCompleted = 0;

    this.board.placePiece("p", "w", 4, 2);
    this.board.placePiece("p", "b", 3, 1);
    this.board.placePiece("p", "b", 2, 2);
    this.board.placePiece("p", "b", 1, 1);

    this.ui.hideAllUI();
    this.ui.showMessage("ch1.p2.intro");
    this.ui.showProgress("ch1.p2.progress", { n: 0 });
    this.ui.showResetButton(() => this.runPhase(2));

    this.currentObjective = "capture";
    setTimeout(() => this.board.pulse([{ row: 3, col: 1 }]), 1200);
    this.startIdleTimer();
  }

  // ─────────────────────────────────────
  // FASE 3 – Promoción (recorrido de 3 casillas)
  // ─────────────────────────────────────
  async phase3_Promotion() {
    this.board.clear();
    this.board.setRules({ onlyTypes: ["p"], doubleStep: false });
    this.data.promoted = false;

    this.board.placePiece("p", "w", 3, 3);

    this.ui.hideAllUI();
    this.ui.showMessage("ch1.p3.intro");
    this.ui.showProgress("ch1.p3.progress", { n: 3 });
    this.ui.showResetButton(() => this.runPhase(3));

    this.currentObjective = "promotion";
    this.startIdleTimer();
  }

  // ─────────────────────────────────────
  // FASE 4 – Peón bloqueado
  //   a) avanza y choca de frente   b) comprueba que no tiene jugadas
  //   c) aparece un rival en diagonal y lo captura para liberarse
  // ─────────────────────────────────────
  async phase4_Blocking() {
    this.board.clear();
    this.board.setRules({ onlyTypes: ["p"], doubleStep: false });
    this.data.blockingDone = false;

    this.board.placePiece("p", "w", 4, 2);
    this.board.placePiece("p", "b", 2, 2);

    this.ui.hideAllUI();
    this.ui.showMessage("ch1.block.intro");
    this.ui.showResetButton(() => this.runPhase(4));

    this.currentObjective = "block1";
    this.startIdleTimer();
  }

  onSelect(piece, moves) {
    if (this.currentObjective === "block2" && piece.color === "w" && moves.length === 0) {
      this.currentObjective = "block-wait";
      this.board.lock();
      this.ui.showMessage("ch1.block.noMoves");
      this.goTo(() => {
        this.board.locked = false;
        const rival = this.board.placePiece("p", "b", 2, 3);
        rival?.element?.classList.add("arrive");
        this.board.pulse([{ row: 2, col: 3 }]);
        this.ui.showMessage("ch1.block.escape");
        this.currentObjective = "block3";
        this.startIdleTimer();
      }, 4200);
    }
  }

  // ─────────────────────────────────────
  // FASE 5 – Acertijo 3 vs 3 (negros quietos)
  // ─────────────────────────────────────
  async phase5_Puzzle(announce = true) {
    clearTimeout(this.transitionTimer);
    this.demoToken = null;
    this.demoRunning = false;
    this.setupPuzzleBoard();
    this.data.puzzleCompleted = false;

    this.ui.hideAllUI();
    if (announce) this.ui.showMessage("ch1.puzzle.goal");
    this.ui.showProgress("ch1.puzzle.progress", { n: PUZZLE_BLACKS.length });
    this.ui.showResetButton(() => this.phase5_Puzzle());
    this.ui.showHintButton(() => this.usePuzzleHint(), "ui.hint");
    if (this.puzzleFails >= 2) this.ui.showSolutionButton(() => this.runSolutionDemo());

    this.currentObjective = "puzzle";
  }

  setupPuzzleBoard() {
    this.board.clear();
    this.board.setRules({ onlyTypes: ["p"], doubleStep: true });
    PUZZLE_WHITES.forEach(([r, c]) => this.board.placePiece("p", "w", r, c));
    PUZZLE_BLACKS.forEach(([r, c]) => this.board.placePiece("p", "b", r, c));
  }

  usePuzzleHint() {
    if (this.board.locked) return;
    const { solvable, hint } = solveCaptureAll(this.board);
    if (!solvable) return this.puzzleStuck();
    if (!hint) return;
    this.board.deselect();
    this.board.pulse([hint.from, hint.to], 3200);
    this.ui.showMessage("ch1.puzzle.hintShown");
  }

  puzzleStuck() {
    this.puzzleFails++;
    this.board.lock();
    this.ui.hideHintButton();
    if (this.puzzleFails >= 2) {
      this.ui.showMessage("ch1.puzzle.stuckSolution");
      this.ui.showSolutionButton(() => this.runSolutionDemo());
      this.ui.drawAttention("solution");
    } else {
      this.ui.showMessage("ch1.puzzle.stuck");
      this.ui.drawAttention("reset");
    }
  }

  /** Demostración animada: el propio juego resuelve el acertijo */
  async runSolutionDemo() {
    if (this.demoRunning) return;
    this.demoRunning = true;
    const token = Symbol("demo");
    this.demoToken = token;

    this.setupPuzzleBoard();
    this.board.lock();
    this.ui.hideAllUI();
    this.ui.showMessage("ch1.puzzle.demo");
    this.ui.showProgress("ch1.puzzle.progress", { n: PUZZLE_BLACKS.length });
    this.currentObjective = "demo";

    await sleep(1800);
    while (this.demoToken === token && this.board.pieces("b").length > 0) {
      const { hint } = solveCaptureAll(this.board);
      if (!hint) break;
      this.board.pulse([hint.from, hint.to], DEMO_STEP_MS);
      await sleep(DEMO_STEP_MS * 0.6);
      if (this.demoToken !== token) return;
      const piece = this.board.grid[hint.from.row][hint.from.col];
      this.board.movePiece(piece, hint.to.row, hint.to.col);
      this.ui.showProgress("ch1.puzzle.progress", { n: this.board.pieces("b").length });
      await sleep(DEMO_STEP_MS);
    }
    if (this.demoToken !== token) return;

    this.ui.showMessage("ch1.puzzle.demoDone");
    await sleep(3000);
    if (this.demoToken !== token) return;
    this.demoRunning = false;
    this.phase5_Puzzle(false);
    this.ui.showMessage("ch1.puzzle.yourTurn");
  }

  // ─────────────────────────────────────
  // FASE 6 – Carrera contra un rival que responde
  // ─────────────────────────────────────
  async phase6_Race(announce = true) {
    clearTimeout(this.transitionTimer);
    this.demoToken = null;
    this.board.clear();
    this.board.setRules({ onlyTypes: ["p"], doubleStep: true });
    this.data.raceCompleted = false;
    this.ui.hideAllUI();
    this.board.lock();

    if (announce) await this.ui.showOverlay("ch1.race.intro", "ui.play");

    this.board.clear();
    RACE_WHITES.forEach(([r, c]) => this.board.placePiece("p", "w", r, c));
    RACE_BLACKS.forEach(([r, c]) => this.board.placePiece("p", "b", r, c));

    this.ui.showMessage("ch1.race.goal");
    this.ui.showProgress("ch1.race.yourTurn");
    this.ui.showResetButton(() => this.phase6_Race(false));
    this.ui.showHintButton(() => this.useRaceHint(), "ui.hint");
    if (this.raceLosses >= 2) this.ui.drawAttention("hint");

    this.currentObjective = "race";
  }

  useRaceHint() {
    if (this.board.locked) return;
    const res = bestMove(stateFromBoard(this.board), "w", 6);
    if (!res) return;
    const size = this.board.size;
    const from = { row: Math.floor(res.move.from / size), col: res.move.from % size };
    const to = { row: Math.floor(res.move.to / size), col: res.move.to % size };
    this.board.deselect();
    this.board.pulse([from, to], 3200);
    this.ui.showMessage("ch1.puzzle.hintShown");
  }

  rivalTurn() {
    this.board.lock();
    this.ui.showProgress("ch1.race.rivalTurn");
    this.transitionTimer = setTimeout(() => {
      if (this.currentObjective !== "race") return;
      const st = stateFromBoard(this.board);
      // El rival se vuelve más "distraído" con cada derrota del jugador
      const noise = 60 + 45 * Math.min(this.raceLosses, 3);
      const m = rivalMove(st, "b", { depth: 2, noise });
      if (!m) return this.raceEnd("draw");
      const size = this.board.size;
      const piece = this.board.grid[Math.floor(m.from / size)][m.from % size];
      this.board.movePiece(piece, Math.floor(m.to / size), m.to % size);
    }, RIVAL_DELAY_MS);
  }

  raceEnd(result) {
    this.board.lock();
    this.ui.hideHintButton();
    if (result === "won") {
      this.data.raceCompleted = true;
      this.sound.playSuccess();
      this.ui.showProgress("ch1.race.wonShort");
      this.ui.showMessage("ch1.race.won");
      this.goTo(7, 2600);
      return;
    }
    this.raceLosses++;
    this.ui.showProgress(result === "draw" ? "ch1.race.drawShort" : "ch1.race.lostShort");
    this.ui.showMessage(result === "draw" ? "ch1.race.draw" : "ch1.race.lost");
    this.ui.drawAttention("reset");
    this.currentObjective = "race-over";
  }

  // ─────────────────────────────────────
  // FASE 7 – Cierre
  // ─────────────────────────────────────
  async phase7_Closing() {
    this.ui.hideAllUI();
    this.board.clear();
    this.board.lock();

    this.sound.playSuccess();
    await this.ui.showOverlay("ch1.p5.mastered", "ui.continue");

    this.data.completed = true;
    this.everCompleted = true;
    this.save();

    await this.ui.showOverlay("ch1.p5.complete", this.onExit ? "ui.backToMap" : "ui.replay");

    // Al volver a entrar, el capítulo empieza de nuevo (el "completado" se conserva)
    this.data = freshData();
    this.puzzleFails = 0;
    this.raceLosses = 0;
    this.phase = 0;
    this.save();
    if (this.onExit) this.onExit();
    else await this.runPhase(1);
  }

  // ─────────────────────────────────────
  // Lógica de cada movimiento (jugador y rival)
  // ─────────────────────────────────────
  onMove({ piece, to, captured, double }) {
    if (captured) this.sound.playCapture();
    else this.sound.playMove();

    // Regla general: un peón que llega a la última fila se transforma
    const lastRow = piece.color === "w" ? 0 : this.board.size - 1;
    const reachedEnd = piece.type === "p" && to.row === lastRow;
    if (reachedEnd) piece.promote("q");

    switch (this.currentObjective) {
      case "movement": {
        this.data.movesCompleted++;
        this.ui.showProgress("ch1.p1.progress", { n: this.data.movesCompleted });
        if (this.data.movesCompleted >= 3) {
          this.sound.playSuccess();
          this.ui.showMessage("ch1.p1.good");
          this.goTo(() => this.phase1_DoubleStep(), 1800);
        } else if (this.data.movesCompleted === 1) {
          this.ui.showMessage("ch1.p1.good");
        }
        break;
      }

      case "double": {
        if (double) {
          this.data.doubleStepDone = true;
          this.sound.playSuccess();
          this.ui.showMessage("ch1.p1.doubleDone");
          this.goTo(2, 3200);
        } else {
          this.ui.showMessage("ch1.p1.doubleRetry");
          this.goTo(() => this.phase1_DoubleStep(false), 1400);
        }
        break;
      }

      case "capture": {
        if (!captured) break;
        this.data.capturesCompleted++;
        this.ui.showProgress("ch1.p2.progress", { n: this.data.capturesCompleted });
        if (this.data.capturesCompleted >= 3) {
          this.sound.playSuccess();
          this.ui.showMessage("ch1.p2.done");
          this.goTo(3, 1600);
        } else {
          this.ui.showMessage(this.data.capturesCompleted === 1 ? "ch1.p2.good" : "ch1.p2.again");
        }
        break;
      }

      case "promotion": {
        this.ui.showProgress("ch1.p3.progress", { n: to.row });
        if (reachedEnd) {
          this.data.promoted = true;
          this.sound.playSuccess();
          this.ui.showMessage("ch1.p3.crowned");
          this.goTo(async () => {
            await this.ui.showOverlay("ch1.p3.promoted", "ui.continue");
            this.runPhase(4);
          }, 1300);
        }
        break;
      }

      case "block1": {
        // El peón quedó justo frente al rival
        this.currentObjective = "block2";
        this.ui.showMessage("ch1.block.blocked");
        this.restartIdleTimer();
        break;
      }

      case "block3": {
        if (!captured) break;
        this.data.blockingDone = true;
        this.sound.playSuccess();
        this.ui.showMessage("ch1.block.done");
        this.goTo(5, 3600);
        break;
      }

      case "puzzle": {
        const left = this.board.pieces("b").length;
        this.ui.showProgress("ch1.puzzle.progress", { n: left });
        if (left === 0) {
          this.data.puzzleCompleted = true;
          this.sound.playSuccess();
          this.ui.hideAllUI();
          this.ui.showMessage("ch1.puzzle.done");
          this.goTo(6, 1800);
        } else if (!solveCaptureAll(this.board).solvable) {
          this.puzzleStuck();
        } else if (captured) {
          this.ui.showMessage("ch1.p2.again");
        }
        break;
      }

      case "race": {
        if (piece.color === "w") {
          if (reachedEnd) return this.raceEnd("won");
          if (captured) this.ui.showMessage("ch1.race.captured");
          // ¿El rival puede mover? Si no, tablas
          if (!genMoves(stateFromBoard(this.board), "b").length) return this.raceEnd("draw");
          this.rivalTurn();
        } else {
          if (reachedEnd) return this.raceEnd("lost");
          if (captured) this.ui.showMessage("ch1.race.lostPawn");
          if (!genMoves(stateFromBoard(this.board), "w").length) return this.raceEnd("draw");
          this.board.locked = false;
          this.ui.showProgress("ch1.race.yourTurn");
        }
        break;
      }
    }

    this.save();
  }

  save() {
    saveChapterProgress("chapter1", {
      currentPhase: this.phase,
      missions: { ...this.data },
      completed: !!this.data.completed || this.everCompleted
    });
  }
}
