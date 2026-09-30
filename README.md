# Chesspath (Vanilla JS + PWA)

Prototipo funcional del **Capítulo 1 – Aldea de los Peones** desarrollado íntegramente en Vanilla JavaScript + HTML + CSS (sin frameworks).

## Cómo probarlo

1. Sirve la carpeta con cualquier servidor estático (por ejemplo):
   ```bash
   npx serve .
   ```
   o con Python:
   ```bash
   python -m http.server 8000
   ```

2. Abre `http://localhost:8000` (o el puerto que uses) en el navegador.

3. El progreso se guarda automáticamente en `localStorage`.

## Estructura

```
chesspath-prototype/
├── index.html
├── manifest.json
├── css/
│   ├── main.css
│   ├── kingdom.css
│   └── board.css
├── js/
│   ├── main.js
│   ├── chapters/Chapter1.js
│   ├── game/
│   │   ├── Board.js
│   │   ├── Piece.js
│   │   └── MoveValidator.js
│   ├── ui/UIManager.js
│   └── utils/storage.js
└── README.md
```

## Pantalla del mapa del reino

La app abre en el **mapa del reino** (`assets/reino.webp`, se desplaza con el dedo).
Las etiquetas, estrellas, niebla y candados se dibujan en código (`js/ui/MapScreen.js`)
a partir de `js/chapters/registry.js`, que guarda la posición de cada isla en la imagen
(1536×1024) y qué capítulos ya están construidos (`built: true`).
Al completar un capítulo se desbloquea el siguiente.

## Capítulos construidos

- Capítulo 1 – Aldea de los Peones (`js/chapters/Chapter1.js`)
- Capítulo 2 – Fortaleza de las Torres (`js/chapters/Chapter2.js`, sobre `ChapterBase.js` y `js/game/Engine.js`)

## Fases del Capítulo 1

- Fase 0: Introducción
- Fase 1: Movimiento del peón (3 pasos de una casilla + paso doble inicial)
- Fase 2: Captura en diagonal (solo capturas, 3 en zigzag)
- Fase 3: Promoción (recorrido de 3 casillas)
- Fase 4: Peón bloqueado (choque de frente → liberarse capturando en diagonal)
- Fase 5: Acertijo 3 vs 3 (negros quietos, pistas ilimitadas, "Ver solución" tras 2 intentos)
- Fase 6: Carrera contra un rival que responde (gana quien corone primero)
- Fase 7: Cierre del capítulo

## Notas técnicas

- 100% Vanilla JS (módulos ES6)
- Tablero 6×6 inclinado en 3D (CSS `rotateX`) sobre una isla flotante SVG (`js/ui/Kingdom.js`)
- Piezas SVG propias (se ven igual en todos los dispositivos)
- Reglas por fase en `MoveValidator` (`doubleStep`, `capturesOnly`)
- `Solver.js`: pistas del acertijo (camino más corto) y detección de atasco
- `Race.js`: motor de la carrera (IA del rival nivel principiante + pistas con búsqueda)
- Idiomas ES/EN (`js/utils/i18n.js`), voz TTS según el idioma
- Sistema de progreso con `localStorage`
- PWA: `sw.js` (funciona sin internet) + íconos en `icons/`. Al publicar cambios, sube `CACHE_VERSION` en `sw.js`
