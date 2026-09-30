/**
 * Kingdom – dibuja la isla flotante (SVG) y coloca el tablero 3D encima.
 *
 * Proyección ortográfica: el tablero se inclina con CSS rotateX(TILT).
 * Un punto (x, y) del plano del tablero se ve en pantalla en (x, y·cos TILT).
 * La isla se dibuja en SVG con esa misma proyección, así el tablero
 * encaja exactamente sobre el césped.
 */
export const TILT = 52; // inclinación del tablero en la isla dibujada (SVG)

const BOARD_SQUARES = 6;

// Generador pseudoaleatorio determinista (la isla siempre sale igual)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pt = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`;
const poly = pts => pts.map(p => pt(p[0], p[1])).join(" ");

/*
 * MODO ILUSTRACIÓN (opcional): si el capítulo trae una imagen de isla
 * (`art`), se usa como escenario y el tablero se asienta sobre su plaza.
 *   art = { src, w, h, plaza: {cx, cy}, boardImg, tilt }
 *   - w, h:     tamaño de la imagen en píxeles (o `size` si es cuadrada)
 *   - plaza:    centro de la plaza en píxeles de la imagen
 *   - boardImg: lado del tablero (con marco) medido en píxeles de la imagen
 *   - tilt:     inclinación con la que está pintada la plaza
 * Si la imagen no carga, se vuelve a la isla dibujada en SVG.
 */
export class Kingdom {
  constructor({ art = null } = {}) {
    this.scene = document.getElementById("scene");
    this.svg = document.getElementById("island");
    this.anchor = document.getElementById("board-anchor");
    this.kingdom = document.getElementById("kingdom");
    this.art = art;

    this.setArt(art, false);
    this._initRest();
  }

  /** Cambia la ilustración de la isla (al pasar de un capítulo a otro) */
  setArt(art, relayout = true) {
    if (this.artImg && art && this.artImg.dataset.src === art.src) { this.art = art; if (relayout) this.layout(); return; }
    this.artImg?.remove();
    this.artImg = null;
    this.art = art;
    if (art) {
      this.artImg = document.createElement("img");
      this.artImg.dataset.src = art.src;
      this.artImg.className = "island-art";
      this.artImg.alt = "";
      this.artImg.decoding = "async";
      this.artImg.addEventListener("error", () => {
        console.warn("No se pudo cargar la isla ilustrada; se usa la isla dibujada");
        this.art = null;
        this.artImg.remove();
        this.layout();
      });
      this.artImg.src = art.src;
      this.scene.prepend(this.artImg);
    }
    if (relayout) this.layout();
  }

  _initRest() {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this.layout());
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    this.layout();
  }

  layout() {
    if (this.art) return this.layoutArt();
    this.scene.classList.remove("art-mode");
    this.kingdom.classList.remove("art-sky");
    this.svg.style.display = "";
    document.documentElement.style.setProperty("--tilt", `${TILT}deg`);
    const rad = (TILT * Math.PI) / 180;
    const c = Math.cos(rad);

    // Espacio disponible (descontando la UI inferior y la barra superior)
    const cs = getComputedStyle(this.kingdom);
    const availW = this.kingdom.clientWidth - 24;
    const availH =
      this.kingdom.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);

    // Proporción aproximada alto/ancho de la escena ≈ 1.02
    const S = Math.max(240, Math.min(availW, 460, availH / 1.02));

    const W = S * 0.96;                 // ancho del hexágono (plano)
    const hexH = W * 0.866;             // alto del hexágono (plano)
    const hp = (hexH / 2) * c;          // medio alto proyectado
    const A = W * 0.58;                 // lado del tablero con marco (plano)
    const frame = W * 0.024;
    const sq = (A - 2 * frame) / BOARD_SQUARES;

    // Cuánto sobresalen las piezas de la fila del fondo
    const backBase = (-A / 2 + frame + sq * 0.72) * c;
    const pieceTop = backBase - sq * 1.3;
    const cy = Math.max(hp, -pieceTop) + 8; // centro de la cara superior (pantalla)
    const cx = S / 2;

    const rim = W * 0.05;   // grosor de la franja de tierra
    const depth = W * 0.46; // profundidad de la roca colgante
    const H = Math.ceil(cy + hp + rim + depth + 14);

    this.scene.style.width = `${S}px`;
    this.scene.style.height = `${H}px`;

    // Tablero: centrado en la cara superior, gira sobre su centro
    Object.assign(this.anchor.style, {
      width: `${A}px`,
      height: `${A}px`,
      left: `${cx - A / 2}px`,
      top: `${cy - A / 2}px`,
      padding: `${frame}px`
    });
    this.anchor.style.setProperty("--sq", `${sq}px`);

    this.drawIsland({ S, H, W, cx, cy, hp, rim, depth, A, c });
  }

  /** Escenario con ilustración: el tablero se coloca sobre la plaza pintada */
  get artW() { return this.art.w || this.art.size; }
  get artH() { return this.art.h || this.art.size; }

  layoutArt() {
    const art = this.art;
    const rad = (art.tilt * Math.PI) / 180;
    const c = Math.cos(rad);
    document.documentElement.style.setProperty("--tilt", `${art.tilt}deg`);
    this.scene.classList.add("art-mode");
    this.kingdom.classList.add("art-sky");
    this.svg.style.display = "none";
    this.scene.style.width = "";
    this.scene.style.height = "";

    const cs = getComputedStyle(this.kingdom);
    const W = this.kingdom.clientWidth;
    const H = this.kingdom.clientHeight;
    const padTop = parseFloat(cs.paddingTop);
    const padBottom = parseFloat(cs.paddingBottom);
    const availH = H - padTop - padBottom;

    // Tamaño del tablero en pantalla (con marco)
    const A = Math.max(220, Math.min(W * 0.8, 360, availH / 0.95));
    const frame = A * 0.04;
    const sq = (A - 2 * frame) / BOARD_SQUARES;
    const k = A / art.boardImg;                 // escala de la imagen

    // Centro del tablero en pantalla (un poco bajo para dejar sitio a las piezas del fondo)
    const bx = W / 2;
    const by = padTop + availH / 2 + A * c * 0.12;
    this.center = { bx, by, k, W, H };

    Object.assign(this.artImg.style, {
      width: `${this.artW * k}px`,
      height: `${this.artH * k}px`,
      left: `${bx - art.plaza.cx * k}px`,
      top: `${by - art.plaza.cy * k}px`
    });

    Object.assign(this.anchor.style, {
      width: `${A}px`,
      height: `${A}px`,
      left: `${bx - A / 2}px`,
      top: `${by - A / 2}px`,
      padding: `${frame}px`
    });
    this.anchor.style.setProperty("--sq", `${sq}px`);
    this.scene.style.transformOrigin = `${bx}px ${by}px`;
  }

  /**
   * Efecto de cámara: muestra la isla completa y baja volando hasta la plaza.
   * Devuelve una promesa que se resuelve al terminar.
   */
  zoomIn({ hold = 450, duration = 1600 } = {}) {
    if (!this.art || !this.center) return Promise.resolve();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return Promise.resolve();

    const { bx, by, k, W, H } = this.center;
    const iw = this.artW * k, ih = this.artH * k;
    const s0 = Math.min(W / iw, H / ih) * 0.98;
    // Centro de la imagen (coordenadas de la escena)
    const icx = bx - this.art.plaza.cx * k + iw / 2;
    const icy = by - this.art.plaza.cy * k + ih / 2;
    const tx = W / 2 - bx - s0 * (icx - bx);
    const ty = H / 2 - by - s0 * (icy - by);

    const sc = this.scene;
    sc.classList.remove("zooming");
    sc.classList.add("arriving");        // el tablero aparece al llegar la cámara
    sc.style.scale = String(s0);
    sc.style.translate = `${tx}px ${ty}px`;
    void sc.offsetWidth;

    return new Promise(resolve => {
      setTimeout(() => {
        sc.classList.add("zooming");
        sc.style.scale = "1";
        sc.style.translate = "0px 0px";
        setTimeout(() => {
          sc.classList.remove("zooming", "arriving");
          resolve();
        }, duration + 50);
      }, hold);
    });
  }

  drawIsland({ S, H, W, cx, cy, hp, rim, depth, A, c }) {
    const rand = rng(7);

    // Vértices del hexágono (flat-top) proyectado
    const L = [cx - W / 2, cy];
    const TL = [cx - W / 4, cy - hp];
    const TR = [cx + W / 4, cy - hp];
    const R = [cx + W / 2, cy];
    const BR = [cx + W / 4, cy + hp];
    const BL = [cx - W / 4, cy + hp];
    const down = (p, d = rim) => [p[0], p[1] + d];

    // ── Roca colgante: contorno irregular hacia una punta ──
    const tip = [cx + W * 0.03, cy + hp + rim + depth];
    const edge = (from, to, n, side) => {
      const pts = [];
      for (let i = 1; i < n; i++) {
        const u = i / n;
        const x = from[0] + (to[0] - from[0]) * Math.pow(u, 1.7);
        const y = from[1] + (to[1] - from[1]) * u;
        const jag = (i % 2 ? 1 : -0.4) * W * (0.012 + rand() * 0.02);
        pts.push([x + side * jag, y]);
      }
      return pts;
    };
    const Lb = down(L), BLb = down(BL), BRb = down(BR), Rb = down(R);
    const leftEdge = edge(Lb, tip, 9, -1);
    const rightEdge = edge(Rb, tip, 9, 1);

    // Facetas (luz desde la izquierda)
    const midL = [BLb[0] + W * 0.02, BLb[1] + depth * 0.55];
    const midR = [BRb[0] - W * 0.03, BRb[1] + depth * 0.5];
    const facetLeft = [Lb, ...leftEdge, tip, midL, BLb];
    const facetMid = [BLb, midL, tip, midR, BRb];
    const facetRight = [BRb, midR, tip, ...rightEdge.slice().reverse(), Rb];
    const underside = [Lb, ...leftEdge, tip, ...rightEdge.slice().reverse(), Rb, BRb, BLb];

    // Estratos de roca
    let strata = "";
    for (let i = 1; i <= 5; i++) {
      const y = BLb[1] + depth * (i / 6.5);
      const wobble = () => (rand() - 0.5) * W * 0.03;
      strata += `<path d="M${pt(cx - W * 0.6, y + wobble())} Q${pt(cx - W * 0.2, y + wobble() + 6)} ${pt(cx, y + wobble())} T${pt(cx + W * 0.6, y + wobble())}" />`;
    }

    // Raíces / enredaderas colgando
    let roots = "";
    for (let i = 0; i < 7; i++) {
      const edgePts = [[Lb, BLb], [BLb, BRb], [BRb, Rb]][i % 3];
      const u = 0.15 + rand() * 0.7;
      const x0 = edgePts[0][0] + (edgePts[1][0] - edgePts[0][0]) * u;
      const y0 = edgePts[0][1] + (edgePts[1][1] - edgePts[0][1]) * u - 1;
      const len = W * (0.06 + rand() * 0.12);
      const sway = (rand() - 0.5) * W * 0.05;
      roots += `<path d="M${pt(x0, y0)} q${(sway).toFixed(1)},${(len * 0.5).toFixed(1)} ${(sway * 0.3).toFixed(1)},${len.toFixed(1)}" />`;
    }

    // ── Decoración del césped (fuera del área del tablero) ──
    const boardHalfX = A / 2 + W * 0.015;
    const boardHalfY = (A / 2 + W * 0.015) * c;
    const insideHex = (x, y) => {
      const dx = Math.abs(x - cx) / (W / 2);
      const dy = Math.abs(y - cy) / hp;
      return dy < 0.9 && dx + dy * 0.5 < 0.92;
    };
    const onBoard = (x, y) => Math.abs(x - cx) < boardHalfX && Math.abs(y - cy) < boardHalfY;

    let tufts = "", flowers = "";
    for (let i = 0; i < 90; i++) {
      const x = cx + (rand() - 0.5) * W;
      const y = cy + (rand() - 0.5) * 2 * hp;
      if (!insideHex(x, y) || onBoard(x, y)) continue;
      if (i % 5 === 0) {
        const col = ["#fff6d6", "#ffd84d", "#f7a8c4", "#c9b8ff"][i % 4];
        flowers += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(W * 0.006).toFixed(1)}" fill="${col}"/>`;
      } else {
        const s = W * 0.012;
        tufts += `<path d="M${pt(x - s, y)} l${(s * 0.5).toFixed(1)},${(-s * 1.2).toFixed(1)} l${(s * 0.5).toFixed(1)},${(s * 1.2).toFixed(1)} l${(s * 0.5).toFixed(1)},${(-s).toFixed(1)} l${(s * 0.5).toFixed(1)},${s.toFixed(1)}"/>`;
      }
    }

    // Árboles y arbustos (detrás y a los lados del tablero)
    const tree = (x, y, k) => {
      const h = W * 0.11 * k, w = W * 0.05 * k;
      return `
        <ellipse cx="${x}" cy="${y}" rx="${w * 0.8}" ry="${w * 0.28}" fill="rgba(0,0,0,.22)"/>
        <rect x="${x - w * 0.1}" y="${y - h * 0.3}" width="${w * 0.2}" height="${h * 0.3}" fill="#5b3d26"/>
        <path d="M${pt(x, y - h * 1.15)} L${pt(x + w * 0.62, y - h * 0.5)} L${pt(x - w * 0.62, y - h * 0.5)} Z" fill="#2f6b44"/>
        <path d="M${pt(x, y - h * 0.9)} L${pt(x + w * 0.8, y - h * 0.22)} L${pt(x - w * 0.8, y - h * 0.22)} Z" fill="#275c3a"/>
        <path d="M${pt(x, y - h * 1.15)} L${pt(x - w * 0.62, y - h * 0.5)} L${pt(x - w * 0.1, y - h * 0.55)} Z" fill="#3f8a58"/>`;
    };
    const bush = (x, y, k) => {
      const r = W * 0.028 * k;
      return `
        <ellipse cx="${x}" cy="${y + r * 0.5}" rx="${r * 1.8}" ry="${r * 0.5}" fill="rgba(0,0,0,.2)"/>
        <circle cx="${x - r * 0.9}" cy="${y}" r="${r * 0.85}" fill="#2e6a43"/>
        <circle cx="${x + r * 0.9}" cy="${y}" r="${r * 0.8}" fill="#2a603d"/>
        <circle cx="${x}" cy="${y - r * 0.45}" r="${r}" fill="#3b8252"/>
        <circle cx="${x - r * 0.3}" cy="${y - r * 0.75}" r="${r * 0.35}" fill="#57a36d"/>`;
    };
    const decor =
      tree(cx - W * 0.29, cy - hp * 0.55, 1) +
      tree(cx - W * 0.2, cy - hp * 0.78, 0.8) +
      tree(cx + W * 0.3, cy - hp * 0.5, 0.9) +
      bush(cx + W * 0.19, cy - hp * 0.8, 0.9) +
      bush(cx - W * 0.4, cy + hp * 0.08, 0.8) +
      bush(cx + W * 0.4, cy + hp * 0.15, 1) +
      bush(cx - W * 0.27, cy + hp * 0.72, 0.7);

    // Cascada en el lado derecho
    const wfX = BRb[0] + (Rb[0] - BRb[0]) * 0.45;
    const wfY = BRb[1] + (Rb[1] - BRb[1]) * 0.45 - rim;
    const wfW = W * 0.035, wfH = depth * 0.9;

    const top = [L, TL, TR, R, BR, BL];

    this.svg.setAttribute("viewBox", `0 0 ${S.toFixed(1)} ${H}`);
    this.svg.setAttribute("width", S);
    this.svg.setAttribute("height", H);
    this.svg.innerHTML = `
      <defs>
        <linearGradient id="grass" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stop-color="#8fd18a"/>
          <stop offset=".5" stop-color="#5fae67"/>
          <stop offset="1" stop-color="#3f8a52"/>
        </linearGradient>
        <radialGradient id="grassLight" cx=".35" cy=".25" r=".8">
          <stop offset="0" stop-color="rgba(255,250,210,.35)"/>
          <stop offset="1" stop-color="rgba(255,250,210,0)"/>
        </radialGradient>
        <linearGradient id="dirtL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8a6a45"/><stop offset="1" stop-color="#6d5236"/>
        </linearGradient>
        <linearGradient id="dirtM" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#735638"/><stop offset="1" stop-color="#5a432c"/>
        </linearGradient>
        <linearGradient id="dirtR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#5a432c"/><stop offset="1" stop-color="#433222"/>
        </linearGradient>
        <linearGradient id="rockFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(0,0,0,0)"/>
          <stop offset="1" stop-color="rgba(20,24,40,.45)"/>
        </linearGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(220,240,255,.95)"/>
          <stop offset=".7" stop-color="rgba(170,210,245,.55)"/>
          <stop offset="1" stop-color="rgba(170,210,245,0)"/>
        </linearGradient>
        <clipPath id="underClip"><polygon points="${poly(underside)}"/></clipPath>
      </defs>

      <!-- Roca colgante -->
      <g class="rock">
        <polygon points="${poly(facetLeft)}" fill="#8b7b6a"/>
        <polygon points="${poly(facetMid)}" fill="#6c5e52"/>
        <polygon points="${poly(facetRight)}" fill="#4a4039"/>
        <g clip-path="url(#underClip)">
          <g fill="none" stroke="rgba(30,22,16,.35)" stroke-width="1.6">${strata}</g>
          <polygon points="${poly(underside)}" fill="url(#rockFade)"/>
        </g>
        <polygon points="${poly(underside)}" fill="none" stroke="rgba(30,22,16,.45)" stroke-width="1.2" stroke-linejoin="round"/>
      </g>

      <!-- Cascada -->
      <g class="waterfall">
        <rect x="${(wfX - wfW / 2).toFixed(1)}" y="${wfY.toFixed(1)}" width="${wfW.toFixed(1)}" height="${wfH.toFixed(1)}" rx="${(wfW / 2).toFixed(1)}" fill="url(#water)"/>
        <g stroke="rgba(255,255,255,.9)" stroke-width="1.4" stroke-linecap="round" class="wf-lines">
          <line x1="${(wfX - wfW * 0.2).toFixed(1)}" y1="${wfY.toFixed(1)}" x2="${(wfX - wfW * 0.2).toFixed(1)}" y2="${(wfY + wfH * 0.8).toFixed(1)}"/>
          <line x1="${(wfX + wfW * 0.22).toFixed(1)}" y1="${wfY.toFixed(1)}" x2="${(wfX + wfW * 0.22).toFixed(1)}" y2="${(wfY + wfH * 0.7).toFixed(1)}"/>
        </g>
      </g>

      <!-- Franja de tierra (grosor de la isla) -->
      <polygon points="${poly([L, BL, BLb, Lb])}" fill="url(#dirtL)"/>
      <polygon points="${poly([BL, BR, BRb, BLb])}" fill="url(#dirtM)"/>
      <polygon points="${poly([BR, R, Rb, BRb])}" fill="url(#dirtR)"/>
      <g fill="none" stroke="#3e8a4f" stroke-width="${(W * 0.006).toFixed(1)}" class="roots">${roots}</g>

      <!-- Cara superior de césped -->
      <polygon points="${poly(top)}" fill="url(#grass)" stroke="#2f6f40" stroke-width="2" stroke-linejoin="round"/>
      <polygon points="${poly(top)}" fill="url(#grassLight)"/>
      <!-- Borde de césped que cae sobre la tierra -->
      <polyline points="${poly([L, BL, BR, R])}" fill="none" stroke="#4f9a5c" stroke-width="${(W * 0.014).toFixed(1)}" stroke-linejoin="round" stroke-linecap="round"/>
      <polyline points="${poly([L, TL, TR, R])}" fill="none" stroke="rgba(210,255,190,.55)" stroke-width="1.5" stroke-linejoin="round"/>

      <!-- Sombra del tablero sobre el césped -->
      <ellipse cx="${cx}" cy="${(cy + boardHalfY * 0.25).toFixed(1)}" rx="${(boardHalfX * 1.05).toFixed(1)}" ry="${(boardHalfY * 1.1).toFixed(1)}" fill="rgba(15,40,20,.28)"/>

      <g fill="none" stroke="rgba(40,100,55,.55)" stroke-width="1.1" stroke-linejoin="round">${tufts}</g>
      ${flowers}
      ${decor}
    `;
  }
}
