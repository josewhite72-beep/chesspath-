/**
 * Service Worker – Chesspath
 * Estrategia: "stale-while-revalidate" → responde al instante desde la caché
 * (funciona sin internet) y actualiza la copia en segundo plano.
 * Al publicar cambios grandes, sube CACHE_VERSION.
 */
const CACHE_VERSION = "chesspath-v18";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/main.css",
  "./css/kingdom.css",
  "./css/board.css",
  "./css/map.css",
  "./assets/reino.webp",
  "./assets/islands/isla1-aldea.webp",
  "./assets/islands/isla2-torres.webp",
  "./assets/islands/isla3-alfiles.webp",
  "./assets/islands/isla4-caballo.webp",
  "./assets/islands/isla5-dama.webp",
  "./assets/islands/isla6-rey.webp",
  "./assets/islands/isla7-reino.webp",
  "./js/main.js",
  "./js/chapters/Chapter1.js",
  "./js/chapters/ChapterBase.js",
  "./js/chapters/Chapter2.js",
  "./js/chapters/StepChapter.js",
  "./js/chapters/missions.js",
  "./js/chapters/Chapter3.js",
  "./js/chapters/Chapter4.js",
  "./js/chapters/Chapter5.js",
  "./js/chapters/Chapter6.js",
  "./js/chapters/Chapter7.js",
  "./js/game/Board.js",
  "./js/game/Piece.js",
  "./js/game/MoveValidator.js",
  "./js/game/Solver.js",
  "./js/game/Race.js",
  "./js/game/Engine.js",
  "./js/game/GameAI.js",
  "./js/ui/UIManager.js",
  "./js/ui/Kingdom.js",
  "./js/ui/MapScreen.js",
  "./js/ui/icons.js",
  "./js/chapters/registry.js",
  "./js/utils/i18n.js",
  "./js/utils/SoundManager.js",
  "./js/utils/storage.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_VERSION).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
