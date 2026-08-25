/**
 * main.js — bootstrap.
 * Import order: custom elements must register before render-sections
 * creates them; behavior modules init after the DOM is populated.
 */

// ── 1. Register custom elements (side-effect imports) ──────────
import "./components/site-navbar.js";
import "./components/feature-card.js";
import "./components/section-heading.js";
import "./components/stat-counter.js";
import "./components/theme-picker.js";
import "./components/crypto-pipeline.js";
import "./components/site-footer.js";

// ── 2. Modules ─────────────────────────────────────────────────
import { themeManager } from "./modules/theme-manager.js"; // applies theme ASAP
import { renderSections } from "./modules/render-sections.js";
import { initMobileNav } from "./modules/mobile-nav.js";
import { initScrollSpy } from "./modules/scroll-spy.js";
import { initRevealOnScroll } from "./modules/reveal-on-scroll.js";
import { initCountUp } from "./modules/count-up.js";
import { initChatDemo } from "./modules/chat-demo-loop.js";
import { initBackToTop } from "./modules/back-to-top.js";

// ── 3. Boot (each step isolated so one failure never blanks the page)
const steps = [
  ["render-sections", renderSections],
  ["mobile-nav", initMobileNav],
  ["scroll-spy", initScrollSpy],
  ["reveal-on-scroll", initRevealOnScroll],
  ["count-up", initCountUp],
  ["chat-demo", initChatDemo],
  ["back-to-top", initBackToTop],
];

for (const [name, fn] of steps) {
  try {
    fn();
  } catch (err) {
    console.error(`[iiserk-site] "${name}" failed:`, err);
  }
}

// Expose for console tinkering / debugging
window.__iiserk = { themeManager };
