import { t } from "../utils/i18n.js";

/**
 * Definiciones reutilizables de misiones (reglas de victoria y evaluación).
 */
export const VALUE = { p: 10, r: 50, q: 90, b: 30, n: 30, k: 0 };

/**
 * Carrera defensiva: capturar `goal` de los `start` peones negros
 * antes de que alguno llegue a la última fila.
 */
export function pawnRace(goal, start) {
  return {
    terminal(st) {
      const size = st.size;
      for (let c = 0; c < size; c++) if (st.cells[(size - 1) * size + c] === "bp") return "b";
      if (st.cells.includes("bq")) return "b";
      if (st.cells.filter(c => c && c[0] === "b").length <= start - goal) return "w";
      return null;
    },
    evaluate(st) {
      const size = st.size;
      let s = 0;
      st.cells.forEach((c, i) => {
        if (!c || c[0] === "n") return;
        const r = Math.floor(i / size);
        if (c[0] === "w") s += VALUE[c[1]] * 3;
        else s -= VALUE[c[1]] * 3 + r * r * 4;
      });
      return s;
    },
    progress(info) {
      return t("step.captured", { n: info.captures, goal });
    }
  };
}
