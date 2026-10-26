/**
 * core/motion.js — the app's motion levels (ui/motion/UiMotion.kt), as CSS.
 *
 *   Off    — screens change instantly. Nothing moves.
 *   Subtle — shorter, gentler transitions. Still shows direction.
 *   Full   — the app's full motion: screens slide and elements pop in.
 *
 * Two things force Off whatever is chosen, as on the phone:
 *   - the system asking for less motion (prefers-reduced-motion — the
 *     browser's equivalent of Android's "Remove animations"), and
 *   - either E-Ink theme, because an e-paper panel cannot animate.
 * The user's own choice is kept and comes back when neither applies.
 */

import { prefs } from "./prefs.js";

export const OFF = 0, SUBTLE = 1, FULL = 2;
export const LEVELS = [OFF, SUBTLE, FULL];

export const label = (l) => ["Off", "Subtle", "Full"][clamp(l)];
export const description = (l) => [
  "Screens change instantly. Nothing moves.",
  "Shorter, gentler transitions. Still shows direction.",
  "The app's full motion: screens slide and elements pop in.",
][clamp(l)];

const clamp = (l) => Math.max(OFF, Math.min(FULL, Number.isFinite(+l) ? +l : FULL));

const SPEC = {
  [OFF]: { dur: 0, slide: 1, pop: 1, recede: 1, press: 1, stagger: 0, reveal: 0, ease: "linear" },
  // UiMotion: SUBTLE springs are critically damped (ratio 1) → a plain ease-out.
  [SUBTLE]: { dur: 150, slide: 6, pop: 0.97, recede: 0.99, press: 0.985, stagger: 20, reveal: 8, ease: "cubic-bezier(.2,0,0,1)" },
  // FULL springs have a 0.9 damping ratio → a hint of overshoot.
  [FULL]: { dur: 260, slide: 4, pop: 0.92, recede: 0.96, press: 0.96, stagger: 35, reveal: 20, ease: "cubic-bezier(.2,.9,.25,1.04)" },
};
export const STAGGER_CAP = 6;

const reduceQuery = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
export const systemWantsNoMotion = () => !!(reduceQuery && reduceQuery.matches);

let effective = FULL;

/** The level actually in force after the system setting and E-Ink. */
export const level = () => effective;
export const enabled = () => effective !== OFF;
export const spec = () => SPEC[effective];
export const staggerDelay = (i) => Math.min(Math.max(i, 0), STAGGER_CAP) * SPEC[effective].stagger;

export function applyMotion() {
  const chosen = clamp(prefs.get("motionLevel"));
  const mode = prefs.get("themeMode");
  const eink = mode === 10 || mode === 11;
  effective = systemWantsNoMotion() || eink ? OFF : chosen;
  const s = SPEC[effective];
  const root = document.documentElement;
  root.dataset.motion = String(effective);
  root.style.setProperty("--motion-dur", s.dur + "ms");
  root.style.setProperty("--motion-ease", s.ease);
  root.style.setProperty("--motion-press", String(s.press));
  root.style.setProperty("--motion-pop", String(s.pop));
  root.style.setProperty("--motion-reveal", s.reveal + "px");
  root.style.setProperty("--motion-slide", s.slide > 1 ? (100 / s.slide).toFixed(2) + "%" : "0%");
  return effective;
}

/** Why motion is off when the user did not pick Off, or null. */
export function overrideReason() {
  const mode = prefs.get("themeMode");
  if (mode === 10 || mode === 11) return "The E-Ink theme turns animation off — an e-paper panel cannot animate. Your choice below comes back with any other theme.";
  if (systemWantsNoMotion()) return "Your device asks for reduced motion, which overrides this whatever is chosen here.";
  return null;
}

if (reduceQuery && reduceQuery.addEventListener) reduceQuery.addEventListener("change", applyMotion);
prefs.on("motionLevel", applyMotion);
prefs.on("themeMode", applyMotion);

/**
 * Run a Web Animations keyframe set at the current level; resolves at once
 * when motion is off. Keeps call sites free of level checks.
 */
export function animate(el, keyframes, opts = {}) {
  if (!el || !enabled() || !el.animate) return Promise.resolve();
  const s = spec();
  const a = el.animate(keyframes, { duration: opts.duration ?? s.dur, easing: opts.easing ?? s.ease, delay: opts.delay ?? 0, fill: opts.fill ?? "none" });
  return a.finished.catch(() => {});
}

/** Fade + rise in, staggered by index (Reveal.kt revealOnEnter). */
export function reveal(el, index = 0) {
  if (!enabled() || !el) return;
  const s = spec();
  el.animate(
    [{ opacity: 0, transform: `translateY(${s.reveal}px)` }, { opacity: 1, transform: "none" }],
    { duration: s.dur, easing: s.ease, delay: staggerDelay(index), fill: "backwards" },
  );
}
