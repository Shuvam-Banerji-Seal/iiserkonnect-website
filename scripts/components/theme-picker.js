/**
 * components/theme-picker.js — <theme-picker>
 * Renders one swatch button per theme from data/site-themes.js and
 * delegates selection to modules/theme-manager.js. Stays in sync via
 * the global "themechange" event.
 */

import { siteThemes, SYSTEM_THEME } from "../data/site-themes.js";
import { themeManager } from "../modules/theme-manager.js";

export class ThemePicker extends HTMLElement {
  connectedCallback() {
    const all = [...siteThemes, SYSTEM_THEME];
    this.classList.add("theme-picker");
    this.setAttribute("role", "group");
    this.setAttribute("aria-label", "Preview a app theme");

    this.innerHTML = all.map((t) => `
      <button class="swatch" type="button"
              data-theme-id="${t.id}"
              aria-pressed="false"
              title="${t.label} theme">
        <span class="swatch__dot"
              style="--sw-a:${t.swatch[0]};--sw-b:${t.swatch[1]};--sw-c:${t.swatch[2]}"></span>
        <span class="swatch__label">${t.label}</span>
      </button>
    `).join("");

    this.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-theme-id]");
      if (btn) themeManager.set(btn.dataset.themeId);
    });

    // themeManager IS the event target (extends EventTarget) — listen there.
    themeManager.addEventListener("themechange", () => this.#sync());
    this.#sync();
  }

  #sync() {
    const current = themeManager.current;
    this.querySelectorAll("[data-theme-id]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.themeId === current));
    });
  }
}

customElements.define("theme-picker", ThemePicker);
