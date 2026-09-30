/**
 * Íconos de piezas (siluetas simples) para el mapa y la interfaz.
 * Usan currentColor, así toman el color del texto.
 */
const BASE = `<path d="M9 35h22v-3.5H9z"/>`;

const PATHS = {
  p: `${BASE}
      <path d="M13 31.5c0-5 2.5-9 5-11h4c2.5 2 5 6 5 11z"/>
      <ellipse cx="20" cy="20.5" rx="5.5" ry="1.8"/>
      <circle cx="20" cy="13.5" r="5.5"/>`,
  r: `${BASE}
      <path d="M12 31.5l1.5-14h13l1.5 14z"/>
      <path d="M11 17.5h18V9h-4v3.5h-3V9h-4v3.5h-3V9h-4z"/>`,
  b: `${BASE}
      <path d="M13 31.5c0-4 2-6.5 3.5-8h7c1.5 1.5 3.5 4 3.5 8z"/>
      <path d="M20 7.5c-4.5 3.5-6.5 7.5-6.5 11 0 2.5 2.5 4.5 6.5 4.5s6.5-2 6.5-4.5c0-3.5-2-7.5-6.5-11z"/>
      <circle cx="20" cy="5.5" r="2.2"/>
      <path d="M21.5 12.5l-4 5" stroke="var(--icon-cut, #1b2a4a)" stroke-width="1.6" stroke-linecap="round"/>`,
  n: `${BASE}
      <path d="M12 31.5c0-6 3.5-9.5 7-12.5l-5 .5c-2 0-3.3-1.8-2.3-3.3L19 8c1.2-1.6 3-2.6 5-2.6L25 3l1.8 2.7C31 7.5 33 12.5 33 18.5v13z"/>
      <circle cx="22.5" cy="10.5" r="1.2" fill="var(--icon-cut, #1b2a4a)"/>`,
  q: `${BASE}
      <path d="M12.5 31.5c1-5 2.5-8 3.5-10h8c1 2 2.5 5 3.5 10z"/>
      <path d="M11 21.5L8.5 10l6 6 2.5-9 3 8.5 3-8.5 2.5 9 6-6-2.5 11.5z"/>
      <circle cx="8.5" cy="9" r="2"/><circle cx="17" cy="6" r="2"/><circle cx="23" cy="6" r="2"/><circle cx="31.5" cy="9" r="2"/>`,
  k: `${BASE}
      <path d="M12.5 31.5c1-5 2.5-8 3.5-10h8c1 2 2.5 5 3.5 10z"/>
      <path d="M11.5 21.5c-2-3-2-7 1-8.5 3-1.5 5.5.5 7.5 3.5 2-3 4.5-5 7.5-3.5 3 1.5 3 5.5 1 8.5z"/>
      <path d="M18.6 2.5h2.8v3h3v2.8h-3v4h-2.8v-4h-3V5.5h3z"/>`
};

export function pieceIcon(type, cls = "piece-icon") {
  return `<svg class="${cls}" viewBox="0 0 40 40" aria-hidden="true" fill="currentColor">${PATHS[type] || PATHS.p}</svg>`;
}

export function lockIcon(cls = "lock-icon") {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M7 10V7a5 5 0 0 1 10 0v3h1.5A1.5 1.5 0 0 1 20 11.5v9A1.5 1.5 0 0 1 18.5 22h-13A1.5 1.5 0 0 1 4 20.5v-9A1.5 1.5 0 0 1 5.5 10zm2.5 0h5V7a2.5 2.5 0 0 0-5 0z"/></svg>`;
}

export function mapIcon(cls = "map-icon") {
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
    <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>`;
}
