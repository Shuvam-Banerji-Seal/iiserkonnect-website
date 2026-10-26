/**
 * ui/dom.js — small DOM and formatting helpers shared by every page.
 */

/** Escape text for HTML (attributes too). */
export const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export const $ = (root, sel) => root.querySelector(sel);
export const $$ = (root, sel) => [...root.querySelectorAll(sel)];

/**
 * Delegated listener: on(root, "click", "[data-act=del]", (e, el) => …).
 * Returns an unsubscribe function.
 */
export function on(root, type, selector, fn, opts) {
  const h = (e) => {
    const el = e.target.closest ? e.target.closest(selector) : null;
    if (el && root.contains(el)) fn(e, el);
  };
  root.addEventListener(type, h, opts);
  return () => root.removeEventListener(type, h, opts);
}

export function debounce(fn, ms = 200) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/** Parse an HTML string into a single element. */
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* ── formatting (the app formats in English, Indian rupees) ── */
const nf = new Intl.NumberFormat("en-IN");
export const rupees = (n, digits = 0) => "₹" + nf.format(Number((+n || 0).toFixed(digits)));
export const pad2 = (n) => String(n).padStart(2, "0");

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Monday, 8 September" — HomeViewModel's "EEEE, d MMMM". */
export const longDate = (d = new Date()) => `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
/** "8 Sep 2026" */
export const shortDate = (d) => `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
/** "5:00 PM" or "17:00" following the browser's 12/24h habit. */
export const use24h = () => {
  try { return !new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12; } catch { return false; }
};
export function timeOf(d, h24 = use24h()) {
  const h = d.getHours(), m = d.getMinutes();
  if (h24) return `${pad2(h)}:${pad2(m)}`;
  return `${((h + 11) % 12) + 1}:${pad2(m)} ${h < 12 ? "AM" : "PM"}`;
}
/** Local "YYYY-MM-DD" (not UTC). */
export const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const fromIsoDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Today", "Tomorrow", "Yesterday", or "Mon, 8 Sep". */
export function relativeDay(d, now = new Date()) {
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return `${DAY_NAMES[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}

/** "3 min ago", "just now". */
export function ago(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** "01:02:03" or "02:03" from milliseconds. */
export function clock(ms, { tenths = false, forceHours = false } = {}) {
  const neg = ms < 0; ms = Math.abs(ms);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  let out = (h > 0 || forceHours ? `${pad2(h)}:` : "") + `${pad2(m)}:${pad2(s)}`;
  if (tenths) out += "." + Math.floor((ms % 1000) / 100);
  return (neg ? "-" : "") + out;
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return i === 0 ? `${Math.round(v)} ${units[i]}` : `${v.toFixed(2)} ${units[i]}`;
}

/** Wait for the next frame (lets a freshly inserted node lay out). */
export const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
