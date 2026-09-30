import { CHAPTERS, MAP_SIZE, chapterStates, chapterStars } from "../chapters/registry.js";
import { loadProgress } from "../utils/storage.js";
import { t, onLangChange } from "../utils/i18n.js";
import { pieceIcon, lockIcon } from "./icons.js";

/**
 * MapScreen – mapa del reino.
 * La imagen se escala para cubrir la pantalla y se desplaza con el dedo.
 * Etiquetas, estrellas, niebla y candados se dibujan encima con HTML/CSS
 * (así se traducen y cambian con el progreso).
 */
export class MapScreen {
  constructor({ onPlay, speak }) {
    this.onPlay = onPlay;
    this.speak = speak;
    this.root = document.getElementById("map-screen");
    this.scroller = document.getElementById("map-scroller");
    this.world = document.getElementById("map-world");
    this.layer = document.getElementById("map-layer");
    this.toast = document.getElementById("map-toast");
    this.progressText = document.getElementById("map-progress-text");
    this.dots = document.getElementById("map-dots");
    this.swipeHint = document.getElementById("map-swipe");
    this.scale = 1;
    this.focused = 0;

    // Al cambiar el tamaño (p. ej. se oculta la barra del navegador) se
    // mantiene centrada la misma isla, en vez de conservar píxeles.
    window.addEventListener("resize", () => {
      if (!this.visible) return;
      this.layout(false);
      this.focusIsland(this.focused, { smooth: false, announce: false });
    });
    // Recentrar cuando la imagen termine de cargar
    this.world.querySelector("img").addEventListener("load", () => {
      if (this.visible && !this.userMoved) this.focusIsland(this.focused, { smooth: false, announce: false });
    });
    onLangChange(() => { if (this.visible) this.render(); });

    this.scroller.addEventListener("scroll", () => {
      this.swipeHint.classList.add("gone");
      if (!this.autoScrolling) this.userMoved = true;
      // Si el usuario arrastra el mapa y la isla actual sale de la vista,
      // la isla "actual" pasa a ser la más cercana horizontalmente.
      clearTimeout(this.scrollTimer);
      this.scrollTimer = setTimeout(() => {
        if (this.autoScrolling) return;
        const ch = CHAPTERS[this.focused ?? 0];
        const x = ch.island.cx * this.scale - this.scroller.scrollLeft;
        if (x < 0 || x > this.scroller.clientWidth) this.focused = this.nearestIndex();
        this.updateNav();
      }, 150);
    }, { passive: true });
  }

  show() {
    this.visible = true;
    this.userMoved = false;
    this.root.classList.remove("hidden");
    this.render();
    this.layout(true);
    // Segundo intento tras el primer pintado (algunos Android calculan tarde el tamaño)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!this.userMoved) {
        this.layout(false);
        this.focusIsland(this.focused, { smooth: false, announce: false });
      }
    }));
  }

  hide() {
    this.visible = false;
    this.root.classList.add("hidden");
    this.hideToast();
  }

  /** Escala la imagen para cubrir la pantalla; opcionalmente centra en una isla */
  layout(center) {
    const vw = this.scroller.clientWidth;
    const vh = this.scroller.clientHeight;
    this.scale = Math.max(vw / MAP_SIZE.w, vh / MAP_SIZE.h);
    this.world.style.width = `${MAP_SIZE.w * this.scale}px`;
    this.world.style.height = `${MAP_SIZE.h * this.scale}px`;

    if (center) {
      // Centrar en una isla que se pueda JUGAR: la disponible; si no hay,
      // la última completada; si no, la Aldea
      const states = chapterStates(loadProgress());
      const done = states.filter(s => s.state === "done");
      const target = states.find(s => s.state === "available") || done[done.length - 1] || states[0];
      this.focused = CHAPTERS.findIndex(c => c.n === target.n);
      const x = target.island.cx * this.scale - vw / 2;
      const y = target.island.cy * this.scale - vh / 2;
      this.scroller.scrollTo({ left: Math.max(0, x), top: Math.max(0, y), behavior: "instant" });
    }
    this.updateNav();
  }

  /** Isla más cercana (en horizontal) al centro de la pantalla */
  nearestIndex() {
    const cx = (this.scroller.scrollLeft + this.scroller.clientWidth / 2) / this.scale;
    let best = 0, bestD = Infinity;
    CHAPTERS.forEach((ch, i) => {
      const d = Math.abs(ch.island.cx - cx);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  focusIsland(i, { smooth = true, announce = true } = {}) {
    const ch = CHAPTERS[i];
    const x = ch.island.cx * this.scale - this.scroller.clientWidth / 2;
    const y = ch.island.cy * this.scale - this.scroller.clientHeight / 2;
    this.focused = i;
    this.autoScrolling = true;
    clearTimeout(this.autoTimer);
    this.autoTimer = setTimeout(() => { this.autoScrolling = false; }, 900);
    this.scroller.scrollTo({ left: Math.max(0, x), top: Math.max(0, y), behavior: smooth ? "smooth" : "instant" });
    if (announce) {
      const label = this.layer.querySelector(`.map-label[data-ch="${ch.n}"]`);
      if (label) {
        label.classList.remove("focus-flash");
        void label.offsetWidth;
        label.classList.add("focus-flash");
      }
      this.speak?.(`${t("map.chapter")} ${ch.n}. ${t(`ch.${ch.n}`)}`);
    }
    this.updateNav(i);
  }

  /** Marca el botón numerado de la isla actual */
  updateNav(i = this.focused ?? 0) {
    this.dots.querySelectorAll(".dot").forEach((d, k) => d.classList.toggle("current", k === i));
  }

  render() {
    const progress = loadProgress();
    const states = chapterStates(progress);
    const pct = (x, total) => `${(100 * x) / total}%`;

    this.layer.innerHTML = states.map(ch => {
      const { cx, cy, rx, ry } = ch.island;
      const fog = ch.state === "locked"
        ? `<div class="map-fog" style="left:${pct(cx - rx, MAP_SIZE.w)};top:${pct(cy - ry, MAP_SIZE.h)};width:${pct(2 * rx, MAP_SIZE.w)};height:${pct(2 * ry, MAP_SIZE.h)}"></div>`
        : "";
      const hit = `<button class="map-hit" data-ch="${ch.n}" aria-label="${t(`ch.${ch.n}`)}"
        style="left:${pct(cx - rx, MAP_SIZE.w)};top:${pct(cy - ry, MAP_SIZE.h)};width:${pct(2 * rx, MAP_SIZE.w)};height:${pct(2 * ry, MAP_SIZE.h)}"></button>`;

      let status;
      if (ch.state === "locked") status = `<span class="st st-lock">${lockIcon()} ${t("map.locked")}</span>`;
      else if (ch.state === "soon") status = `<span class="st st-soon">${t("map.soon")}</span>`;
      else {
        const stars = chapterStars(progress, ch.n);
        status = stars
          ? `<span class="st st-stars">★ ${stars.got}/${stars.total}${ch.state === "done" ? " ✓" : ""}</span>`
          : `<span class="st">${t("map.play")}</span>`;
      }

      const icon = ch.crown ? pieceIcon("k", "piece-icon crown") : pieceIcon(ch.piece);
      const label = `<button class="map-label state-${ch.state}" data-ch="${ch.n}"
          style="left:${pct(ch.label[0], MAP_SIZE.w)};top:${pct(ch.label[1], MAP_SIZE.h)}">
          <span class="num">${ch.n}</span>
          <span class="icon">${icon}</span>
          <span class="txt">
            <span class="cap">${t("map.chapter")} ${ch.n}</span>
            <span class="name">${t(`ch.${ch.n}`)}</span>
            ${status}
          </span>
        </button>`;
      return fog + hit + label;
    }).join("");

    this.layer.querySelectorAll("[data-ch]").forEach(el => {
      el.addEventListener("click", () => this.select(Number(el.dataset.ch)));
    });

    // Progreso general + botones numerados (1–7) para viajar a cada isla
    const done = states.filter(s => s.state === "done").length;
    this.progressText.textContent = t("map.progress", { n: done, total: CHAPTERS.length });
    this.dots.innerHTML = states.map((ch, i) =>
      `<button class="dot state-${ch.state}" data-i="${i}" type="button"
         aria-label="${t("map.chapter")} ${ch.n}: ${t(`ch.${ch.n}`)}">${ch.state === "done" ? "✓" : ch.n}</button>`
    ).join("");
    this.dots.querySelectorAll(".dot").forEach(d =>
      d.addEventListener("click", () => this.focusIsland(Number(d.dataset.i)))
    );
    this.updateNav();
  }

  select(n) {
    const ch = chapterStates(loadProgress()).find(c => c.n === n);
    const name = t(`ch.${n}`);
    if (ch.state === "available" || ch.state === "done") {
      if (ch.built) return this.onPlay(n);
    }
    const msg = ch.state === "locked"
      ? t("map.lockedMsg", { name, prev: t(`ch.${n - 1}`) })
      : t("map.soonMsg", { name });
    this.showToast(msg);
    this.speak(msg);
  }

  showToast(text) {
    this.toast.textContent = text;
    this.toast.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.hideToast(), 3800);
  }

  hideToast() {
    this.toast.classList.remove("show");
  }
}
