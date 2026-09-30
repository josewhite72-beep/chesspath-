import { Chapter1 } from "./chapters/Chapter1.js";
import { Chapter2 } from "./chapters/Chapter2.js";
import { Chapter3 } from "./chapters/Chapter3.js";
import { Chapter4 } from "./chapters/Chapter4.js";
import { Chapter5 } from "./chapters/Chapter5.js";
import { Chapter6 } from "./chapters/Chapter6.js";
import { Chapter7 } from "./chapters/Chapter7.js";
import { Kingdom } from "./ui/Kingdom.js";
import { MapScreen } from "./ui/MapScreen.js";
import { UIManager } from "./ui/UIManager.js";
import { SoundManager } from "./utils/SoundManager.js";
import { mapIcon } from "./ui/icons.js";

// Ilustraciones de cada isla (medidas en píxeles de la imagen)
// (La isla del castillo sirve para la Aldea y la Fortaleza hasta tener una ilustración propia)
/*
 * Ilustración de cada isla (1376×768). plaza = centro de la plaza pintada;
 * boardImg = ancho del tablero medido en píxeles de la imagen;
 * tilt = inclinación del tablero (la de la plaza, con tope de 58° para que las piezas no se amontonen).
 */
const isle = (file, cx, cy, boardImg, tilt) =>
  ({ src: `assets/islands/${file}.webp`, w: 1376, h: 768, plaza: { cx, cy }, boardImg, tilt });
const ISLAND_ART = {
  1: isle("isla1-aldea", 689, 326, 372, 58),
  2: isle("isla2-torres", 690, 378, 330, 56),
  3: isle("isla3-alfiles", 690, 347, 280, 58),
  4: isle("isla4-caballo", 688, 328, 285, 58),
  5: isle("isla5-dama", 688, 370, 335, 58),
  6: isle("isla6-rey", 686, 390, 270, 58),
  7: isle("isla7-reino", 692, 360, 285, 58)
};

// Capítulos ya programados
const CHAPTER_CLASSES = { 1: Chapter1, 2: Chapter2, 3: Chapter3, 4: Chapter4, 5: Chapter5, 6: Chapter6, 7: Chapter7 };

window.addEventListener("DOMContentLoaded", () => {
  const sound = new SoundManager();
  const ui = new UIManager(sound);          // idioma + silencio (compartidos)
  const gameScreen = document.getElementById("game-screen");
  const mapBtn = document.getElementById("map-btn");
  mapBtn.innerHTML = mapIcon();

  let kingdom = null;
  let chapter = null;
  const chapters = {};   // instancias creadas (una por capítulo)

  const map = new MapScreen({
    onPlay: n => openChapter(n),
    speak: text => sound.speak(text)
  });

  function openChapter(n) {
    const Cls = CHAPTER_CLASSES[n];
    if (!Cls) return;
    sound.stopSpeaking();
    chapter?.stop();
    map.hide();
    gameScreen.classList.remove("hidden");
    mapBtn.classList.remove("hidden");

    if (!kingdom) kingdom = new Kingdom({ art: ISLAND_ART[n] });
    else kingdom.setArt(ISLAND_ART[n] || null, false);
    kingdom.layout();

    if (!chapters[n]) chapters[n] = new Cls({ sound, ui, onExit: () => openMap() });
    chapter = chapters[n];
    chapter.board.clear();   // tablero vacío mientras llega la cámara
    chapter.board.lock();
    // Primero la cámara baja a la isla; luego empieza el capítulo
    const token = (openChapter.token = Symbol());
    kingdom.zoomIn().then(() => {
      if (openChapter.token === token && !gameScreen.classList.contains("hidden")) chapter.start();
    });
  }

  function openMap() {
    openChapter.token = null;
    chapter?.stop();
    sound.stopSpeaking();
    gameScreen.classList.add("hidden");
    mapBtn.classList.add("hidden");
    map.show();
  }

  mapBtn.addEventListener("click", openMap);

  // Acceso de diagnóstico (pruebas automáticas)
  window.__chesspath = { get chapter() { return chapter; }, openChapter, openMap };

  openMap();
  window.__chesspathReady = true; // la app arrancó (desactiva el aviso de error)
});

// PWA: registrar el Service Worker (funciona offline e instalable)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(err =>
      console.warn("No se pudo registrar el Service Worker", err)
    );
  });
}
