/**
 * Registro de capítulos: datos para el mapa del reino.
 * Coordenadas en píxeles de la imagen assets/reino.webp (1536×1024):
 *  - label: dónde va la etiqueta
 *  - island: elipse que cubre la isla (zona tocable y niebla si está bloqueada)
 * built: el capítulo ya está programado y se puede jugar.
 */
export const MAP_SIZE = { w: 1536, h: 1024 };

export const CHAPTERS = [
  { n: 1, piece: "p", built: true,  label: [762, 575],  island: { cx: 765, cy: 520, rx: 245, ry: 290 } },
  { n: 2, piece: "r", built: true,  label: [420, 335],  island: { cx: 400, cy: 270, rx: 180, ry: 215 } },
  { n: 3, piece: "b", built: true,  label: [762, 272],  island: { cx: 762, cy: 205, rx: 165, ry: 160 } },
  { n: 4, piece: "n", built: true,  label: [1160, 305], island: { cx: 1160, cy: 235, rx: 210, ry: 170 } },
  { n: 5, piece: "q", built: true,  label: [1310, 560], island: { cx: 1310, cy: 470, rx: 200, ry: 200 } },
  { n: 6, piece: "k", built: true,  label: [1135, 865], island: { cx: 1130, cy: 780, rx: 200, ry: 225 } },
  { n: 7, piece: "k", built: true,  label: [310, 770],  island: { cx: 310, cy: 700, rx: 255, ry: 280 }, crown: true }
];

/** Estado de cada capítulo a partir del progreso guardado */
export function chapterStates(progress) {
  const done = n => !!(progress[`chapter${n}`] && progress[`chapter${n}`].completed);
  return CHAPTERS.map(ch => {
    const unlocked = ch.n === 1 || done(ch.n - 1);
    let state = "locked";
    if (done(ch.n)) state = "done";
    else if (unlocked && ch.built) state = "available";
    else if (unlocked) state = "soon";
    return { ...ch, state };
  });
}

/** Misiones (estrellas) de cada capítulo construido */
const STAR_KEYS = {
  1: m => [m.doubleStepDone, m.capturesCompleted >= 3, m.promoted, m.blockingDone, m.puzzleCompleted, m.raceCompleted],
  2: m => [m.movementDone, m.pathDone, m.capturesDone, m.coordinationDone, m.missionDone],
  3: m => [m.movementDone, m.colorDone, m.pathDone, m.capturesDone, m.coordinationDone, m.missionDone],
  4: m => [m.movementDone, m.jumpDone, m.colorDone, m.routesDone, m.capturesDone, m.forkDone, m.missionDone],
  5: m => [m.movementDone, m.reachDone, m.capturesDone, m.valuesDone, m.safeDone, m.promotionDone, m.missionDone],
  6: m => [m.movementDone, m.dangerDone, m.escapeDone, m.mateQuizDone, m.mateDone, m.ladderDone, m.castleQuizDone, m.castleDone, m.missionDone],
  7: m => [m.armyDone, m.coordsDone, m.enPassantDone, m.epQuizDone, m.drawsDone, m.openingDone, m.game1Done, m.game2Done, m.grandDone]
};

/** Estrellas de un capítulo: { got, total } */
export function chapterStars(progress, n) {
  const fn = STAR_KEYS[n];
  if (!fn) return null;
  const total = fn({}).length;
  const c = progress[`chapter${n}`];
  if (!c) return { got: 0, total };
  if (c.completed) return { got: total, total };
  return { got: fn(c.missions || {}).filter(Boolean).length, total };
}

/** Compatibilidad: estrellas del Capítulo 1 */
export function chapter1Stars(progress) {
  return chapterStars(progress, 1).got;
}
