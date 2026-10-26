/**
 * ui/haptics.js — the app's haptic vocabulary (components/Haptics.kt) on the
 * Vibration API.
 *
 * Only some browsers vibrate (Chrome on Android does; desktop browsers and iOS
 * Safari do not), so this degrades to silence. Settings → Motion & Haptics says
 * so rather than offering a control that seems broken.
 */

import { prefs } from "../core/prefs.js";

export const STRENGTHS = [
  { id: "OFF", label: "Off", description: "No vibration anywhere, including confirmations.", ms: 0 },
  { id: "LIGHT", label: "Light", description: "A short, soft tick. Barely there on a loud phone.", ms: 8 },
  { id: "MEDIUM", label: "Medium", description: "A clear tick. Noticeable, still easy to tap through.", ms: 15 },
  { id: "STRONG", label: "Strong", description: "A firm buzz. The most some people tolerate day to day.", ms: 28 },
];

export const canVibrate = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

const base = (level) => (STRENGTHS.find((s) => s.id === (level || prefs.get("hapticStrength"))) || STRENGTHS[2]).ms;
const buzz = (pattern) => { if (canVibrate()) { try { navigator.vibrate(pattern); } catch {} } };

export const haptics = {
  /** A tap on a button or tile — only when "Haptic feedback on tap" is on. */
  tap() { if (prefs.get("hapticOnTap")) { const b = base(); if (b) buzz(b); } },
  select() { const b = base(); if (b) buzz(Math.round(b * 0.8)); },
  confirm() { const b = base(); if (b) buzz([b, 40, b]); },
  reject() { const b = base(); if (b) buzz([b * 2]); },
  preview(level) { const b = base(level); if (b) buzz(b); },
};
