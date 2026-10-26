/**
 * productivity/shared.js — pieces the productivity screens share: editor
 * drafts that survive a reload, the alarm notice and notification prompt,
 * and the info banner used for messages.
 */

import { esc } from "../ui/dom.js";
import { icon, browserNote, button, card } from "../ui/components.js";
import { ALARM_NOTE, permission, requestPermission, notificationsSupported } from "../core/notify.js";
import { snackbar } from "../ui/overlay.js";

/* ── Editor drafts (kept in sessionStorage, so a reload re-opens the editor) ── */
const dkey = (kind) => "iiserk.draft." + kind;
export const draft = {
  get(kind) {
    try { const s = sessionStorage.getItem(dkey(kind)); return s ? JSON.parse(s) : null; } catch { return null; }
  },
  set(kind, value) {
    try { sessionStorage.setItem(dkey(kind), JSON.stringify(value)); } catch { /* private window: no draft, editor still works */ }
  },
  clear(kind) {
    try { sessionStorage.removeItem(dkey(kind)); } catch { /* nothing to clear */ }
  },
};

/* ── Alarm notice + notification permission ─────────────────────── */
/**
 * The honest note about browser alarms, and — when notifications are not
 * granted — the "Allow notifications" card. Wrapped in [data-alarm-block] so
 * bindAlarm() can redraw it after the permission changes.
 */
export function alarmBlock({ note = true } = {}) {
  const perm = permission();
  // One compact card: the honest alarm note, plus what notifications can do here.
  let status = "";
  if (!notificationsSupported()) status = "This browser has no notifications, so alarms show only as a message inside the open page.";
  else if (perm === "denied") status = "Notifications are blocked for this site, so alarms cannot pop up on your screen. Allow them in the browser's site settings (the icon left of the address).";
  else if (perm !== "granted") status = "Notifications are off, so alarms cannot pop up on your screen yet.";
  if (!note && !status) return `<div class="alarm-block" data-alarm-block data-note="0"></div>`;
  const extra = status
    ? `<p class="prod-alarm__status">${esc(status)}</p>${perm === "default" ? button("Allow notifications", { variant: "text", icon: "notifications", small: true, attrs: { "data-act": "allow-notify" } }) : ""}`
    : "";
  const body = note ? ALARM_NOTE : "";
  return `<div class="alarm-block" data-alarm-block data-note="${note ? 1 : 0}">${browserNote({ title: note ? "About alarms in a browser" : "Notifications", body, icon: "alarm", tone: "info", extra })}</div>`;
}

/** Wire the "Allow notifications" button under `root`; redraws every alarm block below it. */
export function bindAlarm(root) {
  const h = async (e, btn) => {
    e.preventDefault();
    const result = await requestPermission();
    snackbar(result === "granted" ? "Notifications are on." : result === "unsupported" ? "This browser cannot show notifications." : "Notifications stay off.");
    root.querySelectorAll("[data-alarm-block]").forEach((n) => {
      n.outerHTML = alarmBlock({ note: n.dataset.note !== "0" });
    });
  };
  const onClick = (e) => {
    const b = e.target.closest && e.target.closest("[data-act=allow-notify]");
    if (b && root.contains(b)) h(e, b);
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}

/** A card-style message with an optional action (the app's InfoBanner). */
export function infoBanner(text, { action = "", act = "" } = {}) {
  return `<div class="prod-banner" role="status">
    <p>${esc(text)}</p>
    ${action ? `<button type="button" class="btn btn--text btn--sm" data-act="${esc(act)}">${esc(action)}</button>` : ""}
  </div>`;
}

/** Read a number from a text/number field, or null. */
export const numOr = (v, d = null) => (v === "" || v == null || !Number.isFinite(+v) ? d : +v);

/** A pluralised "1 task" / "3 tasks". */
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Turn an outlined field's data-f attribute into a plain value. */
export const fieldValue = (root, name) => {
  const f = root.querySelector(`[data-f="${name}"]`);
  return f ? f.value : "";
};

/** Build a Date from a date input ("YYYY-MM-DD") and a time input ("HH:MM"), or NaN. */
export function localInstant(dateStr, timeStr) {
  if (!dateStr) return NaN;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "00:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}
/** The date/time input values for an instant. */
export function splitInstant(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
}

export { card, icon, esc };
