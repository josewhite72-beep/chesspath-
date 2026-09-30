import { t, getLang, setLang, onLangChange, applyStatic } from "../utils/i18n.js";

/**
 * UIManager – mensajes, overlay, contadores y botones.
 * Todos los textos se pasan como CLAVES de i18n para poder
 * re-traducirlos al vuelo cuando se cambia el idioma.
 */
export class UIManager {
  constructor(soundManager) {
    this.sound = soundManager;

    this.overlay = document.getElementById("overlay");
    this.overlayText = document.getElementById("overlay-text");
    this.overlayBtn = document.getElementById("overlay-btn");
    this.messageBox = document.getElementById("message-box");
    this.messageText = document.getElementById("message-text");
    this.progressBox = document.getElementById("progress-box");
    this.progressText = document.getElementById("progress-text");
    this.hintBtn = document.getElementById("hint-btn");
    this.resetBtn = document.getElementById("reset-btn");
    this.solutionBtn = document.getElementById("solution-btn");
    this.muteBtn = document.getElementById("mute-btn");
    this.langBtns = document.querySelectorAll("[data-lang]");

    // Estado actual (claves) para re-traducir
    this.state = { overlay: null, message: null, progress: null, hint: null, choices: null };
    this.choicesBox = document.getElementById("choices");

    // Silencio
    this.updateMuteButton();
    this.muteBtn.addEventListener("click", () => {
      this.sound.toggleMute();
      this.updateMuteButton();
    });

    // Idioma
    this.langBtns.forEach(btn => {
      btn.addEventListener("click", () => setLang(btn.dataset.lang));
    });
    onLangChange(() => this.refreshLanguage());
    applyStatic();
    this.updateLangButtons();
  }

  // ─── Idioma ────────────────────────────────────────
  updateLangButtons() {
    const lang = getLang();
    this.langBtns.forEach(btn => {
      const active = btn.dataset.lang === lang;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active);
    });
  }

  refreshLanguage() {
    this.updateLangButtons();
    this.updateMuteButton();

    const { overlay, message, progress } = this.state;
    if (overlay) {
      this.overlayText.textContent = t(overlay.key, overlay.params);
      this.overlayBtn.textContent = t(overlay.btnKey);
    }
    if (message) this.messageText.textContent = t(message.key, message.params);
    if (progress) this.progressText.textContent = t(progress.key, progress.params);
    if (this.state.hint) this.hintBtn.textContent = t(this.state.hint.key, this.state.hint.params);
    this.resetBtn.textContent = t("ui.reset");
    this.solutionBtn.textContent = t("ui.solution");
    if (this.state.choices) this.renderChoices(this.state.choices);

    // Volver a leer en voz alta en el nuevo idioma
    if (overlay) this.speak(overlay.key, overlay.params);
    else if (message) this.speak(message.key, message.params);
  }

  speak(key, params) {
    this.sound.speak(t(key, params).replace(/\n+/g, ". "));
  }

  // ─── Silencio ──────────────────────────────────────
  updateMuteButton() {
    const muted = this.sound.isMuted();
    this.muteBtn.textContent = muted ? "🔇" : "🔊";
    this.muteBtn.classList.toggle("muted", muted);
    this.muteBtn.title = t(muted ? "ui.unmute" : "ui.mute");
    this.muteBtn.setAttribute("aria-label", this.muteBtn.title);
  }

  // ─── Overlay ───────────────────────────────────────
  showOverlay(key, btnKey = "ui.continue", params = {}) {
    return new Promise(resolve => {
      this.state.overlay = { key, btnKey, params };
      this.overlayText.textContent = t(key, params);
      this.overlayBtn.textContent = t(btnKey);
      this.overlay.classList.remove("hidden");
      this.speak(key, params);

      // Solo un overlay activo a la vez
      if (this.overlayHandler) this.overlayBtn.removeEventListener("click", this.overlayHandler);
      const handler = () => {
        this.overlay.classList.add("hidden");
        this.overlayBtn.removeEventListener("click", handler);
        this.overlayHandler = null;
        this.state.overlay = null;
        this.sound.stopSpeaking();
        resolve();
      };
      this.overlayHandler = handler;
      this.overlayBtn.addEventListener("click", handler);
    });
  }

  /** Cierra el overlay sin continuar (al salir al mapa) */
  cancelOverlay() {
    if (this.overlayHandler) this.overlayBtn.removeEventListener("click", this.overlayHandler);
    this.overlayHandler = null;
    this.state.overlay = null;
    this.overlay.classList.add("hidden");
  }

  // ─── Mensajes ──────────────────────────────────────
  showMessage(key, params = {}) {
    this.state.message = { key, params };
    this.messageText.textContent = t(key, params);
    this.messageBox.classList.remove("hidden");
    this.speak(key, params);
  }

  hideMessage() {
    this.state.message = null;
    this.messageBox.classList.add("hidden");
  }

  showProgress(key, params = {}) {
    this.state.progress = { key, params };
    this.progressText.textContent = t(key, params);
    this.progressBox.classList.remove("hidden");
  }

  hideProgress() {
    this.state.progress = null;
    this.progressBox.classList.add("hidden");
  }

  // ─── Botones ───────────────────────────────────────
  showHintButton(callback, key = "ui.hint", params = {}) {
    this.state.hint = { key, params };
    this.hintBtn.textContent = t(key, params);
    this.hintBtn.classList.remove("hidden");
    this.hintBtn.onclick = callback;
  }

  hideHintButton() {
    this.state.hint = null;
    this.hintBtn.classList.add("hidden");
    this.hintBtn.onclick = null;
  }

  showSolutionButton(callback) {
    this.solutionBtn.textContent = t("ui.solution");
    this.solutionBtn.classList.remove("hidden");
    this.solutionBtn.onclick = callback;
  }

  hideSolutionButton() {
    this.solutionBtn.classList.add("hidden");
    this.solutionBtn.onclick = null;
  }

  /** Botones de opción (preguntas): items = [{ key, params, onClick }] */
  showChoices(items) {
    this.state.choices = items;
    this.renderChoices(items);
    this.choicesBox.classList.remove("hidden");
  }

  renderChoices(items) {
    this.choicesBox.innerHTML = "";
    items.forEach(it => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn choice";
      b.textContent = t(it.key, it.params || {});
      b.addEventListener("click", () => it.onClick(b));
      this.choicesBox.appendChild(b);
    });
  }

  hideChoices() {
    this.state.choices = null;
    this.choicesBox.classList.add("hidden");
    this.choicesBox.innerHTML = "";
  }

  /** Hace latir un botón para llamar la atención ("reset" | "hint" | "solution") */
  drawAttention(which) {
    const btn = { hint: this.hintBtn, solution: this.solutionBtn }[which] || this.resetBtn;
    btn.classList.add("attention");
  }

  clearAttention() {
    [this.hintBtn, this.resetBtn, this.solutionBtn].forEach(b => b.classList.remove("attention"));
  }

  showResetButton(callback) {
    this.resetBtn.classList.remove("hidden");
    this.resetBtn.onclick = callback;
  }

  hideResetButton() {
    this.resetBtn.classList.add("hidden");
    this.resetBtn.onclick = null;
  }

  hideAllUI() {
    this.clearAttention();
    this.hideChoices();
    this.hideMessage();
    this.hideProgress();
    this.hideHintButton();
    this.hideSolutionButton();
    this.hideResetButton();
  }
}
