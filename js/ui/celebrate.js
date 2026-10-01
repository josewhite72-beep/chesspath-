/**
 * Celebración de victoria: las piezas blancas saltan y cae confeti.
 * Sin dependencias; se limpia sola.
 */
const COLORS = ["#f4c542", "#e85d75", "#4fb3e8", "#6cc56a", "#b07ce8", "#ff9f43"];

export function celebrate(board) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  // Piezas blancas: saltitos escalonados
  board?.pieces("w").forEach((p, i) => {
    const el = p.element;
    if (!el) return;
    el.style.setProperty("--cd", `${(i % 6) * 0.08}s`);
    el.classList.remove("cheer");
    void el.offsetWidth;
    el.classList.add("cheer");
    setTimeout(() => el.classList.remove("cheer"), 2200);
  });

  // Confeti
  const box = document.createElement("div");
  box.className = "confetti";
  for (let i = 0; i < 70; i++) {
    const c = document.createElement("i");
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = COLORS[i % COLORS.length];
    c.style.setProperty("--d", `${(Math.random() * 0.6).toFixed(2)}s`);
    c.style.setProperty("--t", `${(2 + Math.random() * 1.2).toFixed(2)}s`);
    c.style.setProperty("--x", `${Math.round((Math.random() - 0.5) * 120)}px`);
    c.style.setProperty("--r", `${Math.round(360 + Math.random() * 540)}deg`);
    if (i % 3 === 0) { c.style.width = "7px"; c.style.height = "7px"; c.style.borderRadius = "50%"; }
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4000);
}
