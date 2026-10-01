import { getLang } from "./i18n.js";

// Preferencia de voces por idioma (primero la más cercana a Panamá)
const VOICE_PREFS = {
  es: ["es-US", "es-MX", "es-419", "es-PA", "es-CO", "es-ES", "es"],
  en: ["en-US", "en-GB", "en"]
};

/**
 * SoundManager – Text-to-Speech + efectos de movimiento/captura
 * Versión más robusta para móviles
 */
export class SoundManager {
  constructor() {
    this.muted = localStorage.getItem("chesspath_muted") === "true";
    this.synth = window.speechSynthesis;
    this.audioCtx = null;
    this.unlocked = false;

    // Desbloquear AudioContext en el primer toque del usuario
    const unlock = () => {
      this._ensureCtx();
      if (this.audioCtx && this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      this.unlocked = true;
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("touchstart", unlock, { once: true });
    document.addEventListener("click", unlock, { once: true });
  }

  _ensureCtx() {
    if (!this.audioCtx) {
      try {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn("Web Audio no disponible", e);
      }
    }
    return this.audioCtx;
  }

  // ─── Text to Speech ───────────────────────────────
  _pickVoice(lang) {
    const voices = this.synth.getVoices();
    if (!voices.length) return null;
    const norm = v => v.lang.replace("_", "-");
    for (const pref of VOICE_PREFS[lang] || [lang]) {
      const v = voices.find(v => norm(v).toLowerCase().startsWith(pref.toLowerCase()));
      if (v) return v;
    }
    return null;
  }

  /**
   * Lee un texto en voz alta SIN cortar la indicación que se está leyendo:
   * si hay una en curso, la nueva espera su turno (solo se guarda la más reciente).
   * interrupt: true → corta lo que suena (acción del usuario: cambiar idioma, continuar).
   */
  speak(text, { interrupt = false } = {}) {
    if (this.muted || !this.synth) return;
    if (!interrupt && this.isSpeaking()) {
      this.pendingText = text;
      return;
    }
    this.pendingText = null;
    try {
      this.synth.cancel();
      this._say(text);
    } catch (e) {
      // La voz nunca debe bloquear el juego
      console.warn("Voz no disponible:", e);
      this.speechUntil = 0;
    }
  }

  isSpeaking() {
    return !!this.synth && (this.synth.speaking || this.synth.pending) && Date.now() < (this.speechUntil || 0);
  }

  /** Promesa que se cumple cuando termina de leer (con tope de espera) */
  whenIdle(maxMs = 9000) {
    const start = Date.now();
    return new Promise(resolve => {
      const check = () => {
        if ((!this.isSpeaking() && !this.pendingText) || this.muted || Date.now() - start > maxMs) resolve();
        else setTimeout(check, 150);
      };
      check();
    });
  }

  _next() {
    const text = this.pendingText;
    this.pendingText = null;
    if (text && !this.muted) { try { this._say(text); } catch (e) { this.speechUntil = 0; } }
  }

  _say(text) {
    const lang = getLang();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this._pickVoice(lang);
    utterance.lang = voice ? voice.lang : (lang === "en" ? "en-US" : "es-US");
    if (voice) utterance.voice = voice;
    utterance.rate = lang === "en" ? 0.9 : 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    // Tope de seguridad: algunos Android no avisan cuándo termina la voz
    this.speechUntil = Date.now() + 1500 + text.length * 95;
    const done = () => {
      if (this.current !== utterance) return;
      this.current = null;
      this.speechUntil = 0;
      clearTimeout(this.safetyTimer);
      setTimeout(() => this._next(), 250);
    };
    utterance.onend = done;
    utterance.onerror = done;
    this.current = utterance;
    clearTimeout(this.safetyTimer);
    this.safetyTimer = setTimeout(done, this.speechUntil - Date.now());
    this.synth.speak(utterance);
  }

  stopSpeaking() {
    this.pendingText = null;
    this.current = null;
    this.speechUntil = 0;
    clearTimeout(this.safetyTimer);
    this.synth?.cancel();
  }

  // ─── Efectos de sonido ────────────────────────────
  playMove() {
    if (this.muted) return;
    this._tone(420, 0.09, 0.25, "triangle");
  }

  playCapture() {
    if (this.muted) return;
    this._tone(280, 0.08, 0.3, "square");
    setTimeout(() => this._tone(180, 0.12, 0.25, "square"), 80);
  }

  playSuccess() {
    if (this.muted) return;
    this._tone(520, 0.1, 0.2, "sine");
    setTimeout(() => this._tone(680, 0.14, 0.22, "sine"), 110);
    setTimeout(() => this._tone(840, 0.16, 0.18, "sine"), 220);
  }

  _tone(freq, duration, volume = 0.2, type = "sine") {
    const ctx = this._ensureCtx();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().then(() => this._playTone(ctx, freq, duration, volume, type));
    } else {
      this._playTone(ctx, freq, duration, volume, type);
    }
  }

  _playTone(ctx, freq, duration, volume, type) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.01);
    } catch (e) {
      console.warn("Error al reproducir tono", e);
    }
  }

  // ─── Silencio ─────────────────────────────────────
  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem("chesspath_muted", this.muted);
    if (this.muted) this.synth?.cancel();
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }
}
