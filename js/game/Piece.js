/**
 * Piece – pieza con dibujo SVG propio (se ve igual en todos los dispositivos,
 * sin el problema de los emoji ♟ en Android).
 * El SVG "se pone de pie" sobre el tablero inclinado gracias a board.css.
 */
let uid = 0;

const SHAPES = {
  // Peón: base, cuerpo acampanado, collar y cabeza
  p: `
    <path class="fill" d="M24 120 Q24 108 34 106 L66 106 Q76 108 76 120 Z"/>
    <path class="fill" d="M34 106 C38 92 42 80 42 66 L58 66 C58 80 62 92 66 106 Z"/>
    <ellipse class="fill" cx="50" cy="65" rx="17" ry="5"/>
    <circle class="fill" cx="50" cy="44" r="17"/>
    <ellipse class="shine" cx="44" cy="38" rx="6" ry="8"/>`,
  // Torre: base, cuerpo y almenas
  r: `
    <path class="fill" d="M20 120 Q20 107 31 105 L69 105 Q80 107 80 120 Z"/>
    <path class="fill" d="M30 105 L34 58 L66 58 L70 105 Z"/>
    <rect class="fill" x="28" y="52" width="44" height="8" rx="2"/>
    <path class="fill" d="M26 52 L26 30 L36 30 L36 38 L45 38 L45 30 L55 30 L55 38 L64 38 L64 30 L74 30 L74 52 Z"/>
    <ellipse class="shine" cx="42" cy="82" rx="4" ry="16"/>`,
  // Roca (obstáculo neutral)
  x: `
    <path class="fill" d="M14 118 C10 100 18 86 30 80 C34 64 50 58 62 64 C76 64 88 78 86 94 C92 104 88 116 80 120 Z"/>
    <path class="crack" d="M42 70 L48 86 L40 98 M66 76 L60 92 L70 104" fill="none"/>
    <ellipse class="shine" cx="44" cy="80" rx="10" ry="6"/>`,
  // Alfil: mitra con ranura y bolita
  b: `
    <path class="fill" d="M22 120 Q22 107 32 105 L68 105 Q78 107 78 120 Z"/>
    <path class="fill" d="M34 105 C38 94 42 86 42 78 L58 78 C58 86 62 94 66 105 Z"/>
    <ellipse class="fill" cx="50" cy="77" rx="16" ry="4.5"/>
    <path class="fill" d="M50 22 C36 34 32 48 34 60 C36 70 42 74 50 74 C58 74 64 70 66 60 C68 48 64 34 50 22 Z"/>
    <path class="cut" d="M56 38 L46 54" fill="none"/>
    <circle class="fill" cx="50" cy="16" r="6"/>
    <ellipse class="shine" cx="43" cy="52" rx="4" ry="10"/>`,
  // Caballo: cabeza de caballo estilizada
  n: `
    <path class="fill" d="M20 120 Q20 107 31 105 L71 105 Q82 107 82 120 Z"/>
    <path class="fill" d="M28 105 C28 86 36 74 48 64 L32 66 C24 67 20 60 24 54 L44 28 C48 22 54 18 60 18 L62 10 L68 18 C82 24 88 44 86 66 C85 82 80 94 76 105 Z"/>
    <circle class="eye" cx="56" cy="32" r="3"/>
    <path class="cut" d="M66 22 C74 34 76 52 72 70" fill="none"/>
    <ellipse class="shine" cx="46" cy="40" rx="4" ry="9" transform="rotate(35 46 40)"/>`,
  // Rey: corona con cruz
  k: `
    <path class="fill" d="M20 120 Q20 107 31 105 L69 105 Q80 107 80 120 Z"/>
    <path class="fill" d="M31 105 C35 90 39 78 40 66 L60 66 C61 78 65 90 69 105 Z"/>
    <ellipse class="fill" cx="50" cy="65" rx="20" ry="5"/>
    <path class="fill" d="M30 60 C22 50 22 38 32 34 C40 31 46 36 50 44 C54 36 60 31 68 34 C78 38 78 50 70 60 Z"/>
    <path class="fill" d="M46 8 L54 8 L54 16 L62 16 L62 23 L54 23 L54 36 L46 36 L46 23 L38 23 L38 16 L46 16 Z"/>
    <ellipse class="shine" cx="44" cy="84" rx="4" ry="12"/>`,
  // Dama: corona de 5 puntas con perlas
  q: `
    <path class="fill" d="M20 120 Q20 107 31 105 L69 105 Q80 107 80 120 Z"/>
    <path class="fill" d="M31 105 C35 90 39 78 40 64 L60 64 C61 78 65 90 69 105 Z"/>
    <ellipse class="fill" cx="50" cy="63" rx="20" ry="5"/>
    <path class="fill" d="M32 59 L24 30 L38 46 L42 24 L50 42 L58 24 L62 46 L76 30 L68 59 Z"/>
    <circle class="fill" cx="24" cy="28" r="4.5"/>
    <circle class="fill" cx="42" cy="21" r="4.5"/>
    <circle class="fill" cx="58" cy="21" r="4.5"/>
    <circle class="fill" cx="76" cy="28" r="4.5"/>
    <circle class="fill" cx="50" cy="13" r="5.5"/>
    <ellipse class="shine" cx="44" cy="84" rx="4" ry="12"/>`
};

export class Piece {
  constructor(type, color, row, col) {
    this.type = type;   // 'p' = peón, 'q' = dama
    this.color = color; // 'w' | 'b'
    this.row = row;
    this.col = col;
    this.element = null;
  }

  svg() {
    const id = `g${++uid}`;
    const white = this.color === "w";
    const neutral = this.color === "n";
    const stops = neutral
      ? `<stop offset="0" stop-color="#c9c3b8"/><stop offset=".55" stop-color="#9a9184"/><stop offset="1" stop-color="#6b6358"/>`
      : white
      ? `<stop offset="0" stop-color="#fffdf6"/><stop offset=".55" stop-color="#efe3c8"/><stop offset="1" stop-color="#b9a47e"/>`
      : `<stop offset="0" stop-color="#6b6470"/><stop offset=".5" stop-color="#2f2b33"/><stop offset="1" stop-color="#121014"/>`;
    return `
      <svg viewBox="0 0 100 130" aria-hidden="true">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0.35">${stops}</linearGradient></defs>
        <g fill="url(#${id})" stroke="${neutral ? "#4a443c" : white ? "#6b5638" : "#050406"}" stroke-width="2.2" stroke-linejoin="round">
          ${SHAPES[this.type] || SHAPES.p}
        </g>
      </svg>`;
  }

  createElement() {
    const el = document.createElement("div");
    el.className = `piece ${this.color === "w" ? "white" : this.color === "n" ? "neutral" : "black"}`;
    el.dataset.type = this.type;
    el.dataset.color = this.color;
    el.innerHTML = this.svg();
    this.element = el;
    return el;
  }

  /** Cambia el tipo (promoción) y redibuja con destello */
  promote(type = "q") {
    this.type = type;
    if (!this.element) return;
    this.element.dataset.type = type;
    this.element.innerHTML = this.svg();
    this.element.classList.remove("promoting");
    void this.element.offsetWidth; // reiniciar animación
    this.element.classList.add("promoting");
  }
}
