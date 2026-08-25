/**
 * modules/theme-manager.js
 * Applies one of the app's palettes to <html data-theme>, persists the
 * choice, resolves "system" against prefers-color-scheme, and broadcasts
 * a "themechange" CustomEvent so components stay in sync.
 */

import { DEFAULT_THEME, STORAGE_KEY } from "../data/site-themes.js";

const VALID = new Set([
  "liquid-glass", "dark", "light", "catppuccin-mocha", "catppuccin-latte",
  "tokyo-night", "coffee-green", "neon", "system",
]);

class ThemeManager extends EventTarget {
  #pref = DEFAULT_THEME;
  #media = window.matchMedia("(prefers-color-scheme: light)");

  constructor() {
    super();
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID.has(stored)) this.#pref = stored;

    this.#media.addEventListener("change", () => {
      if (this.#pref === "system") this.#apply();
    });

    this.#apply();
  }

  /** Currently selected preference id ("system" stays "system"). */
  get current() { return this.#pref; }

  /** The theme id actually painted on <html> (system → dark|light). */
  get resolved() {
    return this.#pref === "system"
      ? (this.#media.matches ? "light" : "dark")
      : this.#pref;
  }

  set(id) {
    if (!VALID.has(id) || id === this.#pref) return;
    this.#pref = id;
    localStorage.setItem(STORAGE_KEY, id);
    this.#apply();
  }

  #apply() {
    document.documentElement.dataset.theme = this.resolved;
    this.dispatchEvent(new CustomEvent("themechange", {
      detail: { pref: this.#pref, resolved: this.resolved },
    }));
  }
}

export const themeManager = new ThemeManager();
