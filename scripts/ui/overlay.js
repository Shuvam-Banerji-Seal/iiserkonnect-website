/**
 * ui/overlay.js — AlertDialog, ModalBottomSheet, DropdownMenu and Snackbar.
 *
 * Dialogs and sheets use the native <dialog> element, so focus is trapped,
 * Escape closes them and the rest of the page is inert — the browser does the
 * accessibility work Compose's Dialog does on Android.
 */

import { esc } from "./dom.js";
import { icon } from "./icons.js";
import * as motion from "../core/motion.js";
import { haptics } from "./haptics.js";

function mountDialog(cls, inner) {
  const d = document.createElement("dialog");
  d.className = cls;
  d.innerHTML = inner;
  document.body.appendChild(d);
  return d;
}

function closeAnimated(d, kind) {
  const s = motion.spec();
  const frames = kind === "sheet"
    ? [{ transform: "none" }, { transform: "translateY(100%)" }]
    : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: `scale(${s.pop})` }];
  return motion.animate(d, frames, { duration: Math.round(s.dur * 0.7) }).then(() => { d.close(); d.remove(); });
}

function openAnimated(d, kind) {
  d.showModal();
  const s = motion.spec();
  if (kind === "sheet") motion.animate(d, [{ transform: "translateY(100%)" }, { transform: "none" }]);
  else motion.animate(d, [{ opacity: 0, transform: `scale(${s.pop})` }, { opacity: 1, transform: "none" }]);
}

/**
 * Show a dialog. `body` is trusted HTML. Resolves with the clicked action's
 * `value`, or null when dismissed. `onMount(dialogEl, close)` can wire extra
 * controls; `validate(value, dialogEl)` may return false to keep it open.
 */
export function dialog({ title = "", body = "", icon: ic = "", actions = [{ label: "OK", value: true }], dismissible = true, onMount, validate, wide = false } = {}) {
  return new Promise((resolve) => {
    const acts = actions.map((a, i) =>
      `<button type="button" class="btn btn--${a.variant || "text"}" data-dlg="${i}"${a.disabled ? " disabled" : ""}>${esc(a.label)}</button>`).join("");
    const d = mountDialog(`dlg${wide ? " dlg--wide" : ""}`, `
      <form method="dialog" class="dlg__inner">
        ${ic ? `<div class="dlg__icon">${icon(ic)}</div>` : ""}
        ${title ? `<h2 class="dlg__title${ic ? " dlg__title--center" : ""}">${esc(title)}</h2>` : ""}
        <div class="dlg__body">${body}</div>
        ${acts ? `<div class="dlg__actions">${acts}</div>` : ""}
      </form>`);
    let done = false;
    const close = (value) => {
      if (done) return; done = true;
      closeAnimated(d, "dialog").then(() => resolve(value));
    };
    d.addEventListener("click", (e) => {
      const b = e.target.closest("[data-dlg]");
      if (b) {
        e.preventDefault();
        const a = actions[+b.dataset.dlg];
        if (validate && a.value && validate(a.value, d) === false) return;
        close(a.value === undefined ? a.label : a.value);
        return;
      }
      if (e.target === d && dismissible) close(null);   // scrim tap
    });
    d.addEventListener("cancel", (e) => { e.preventDefault(); if (dismissible) close(null); });
    d.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const primary = actions.findIndex((a) => a.primary) >= 0 ? actions.findIndex((a) => a.primary) : actions.length - 1;
      d.querySelector(`[data-dlg="${primary}"]`)?.click();
    });
    if (onMount) onMount(d, close);
    openAnimated(d, "dialog");
    const first = d.querySelector("input, textarea, select");
    if (first) setTimeout(() => first.focus(), 30);
  });
}

/** Confirm dialog; danger=true colours the confirm action like the app's red "Delete". */
export function confirm({ title, text, confirmLabel = "OK", cancelLabel = "Cancel", danger = false }) {
  return dialog({
    title,
    body: `<p>${esc(text)}</p>`,
    actions: [
      { label: cancelLabel, value: false },
      { label: confirmLabel, value: true, variant: danger ? "danger-text" : "text", primary: true },
    ],
  }).then((v) => {
    if (v) haptics.confirm(); return !!v;
  });
}

/** ModalBottomSheet. Returns { el, close, closed: Promise }. */
export function sheet({ title = "", body = "", onMount } = {}) {
  let resolveClosed;
  const closed = new Promise((r) => { resolveClosed = r; });
  const d = mountDialog("sheet", `
    <div class="sheet__handle" aria-hidden="true"></div>
    ${title ? `<h2 class="sheet__title">${esc(title)}</h2>` : ""}
    <div class="sheet__body">${body}</div>`);
  let done = false;
  const close = (v = null) => { if (done) return; done = true; closeAnimated(d, "sheet").then(() => resolveClosed(v)); };
  d.addEventListener("click", (e) => { if (e.target === d) close(); });
  d.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  if (onMount) onMount(d, close);
  openAnimated(d, "sheet");
  return { el: d, close, closed };
}

/**
 * DropdownMenu anchored to an element. items: [{label, value, icon, danger,
 * disabled, divider}] Resolves with the chosen value or null.
 */
export function menu(anchor, items) {
  return new Promise((resolve) => {
    document.querySelectorAll(".menu-pop").forEach((m) => m.remove());
    const m = document.createElement("div");
    m.className = "menu-pop";
    m.setAttribute("role", "menu");
    m.innerHTML = items.map((it, i) => it.divider ? `<div class="menu-pop__div" role="separator"></div>` :
      `<button type="button" role="menuitem" class="menu-pop__item${it.danger ? " is-danger" : ""}" data-i="${i}"${it.disabled ? " disabled" : ""}>${it.icon ? icon(it.icon, { size: 20 }) : ""}<span>${esc(it.label)}</span>${it.checked ? icon("check", { size: 20, cls: "menu-pop__check" }) : ""}</button>`).join("");
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let left = Math.min(r.right - mw, innerWidth - mw - 8); left = Math.max(8, left);
    let top = r.bottom + 4; if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 4);
    m.style.left = left + "px"; m.style.top = top + "px";
    motion.animate(m, [{ opacity: 0, transform: "scale(.92)" }, { opacity: 1, transform: "none" }], { duration: 120 });
    const finish = (v) => { cleanup(); m.remove(); resolve(v); anchor.focus?.({ preventScroll: true }); };
    const onDoc = (e) => { if (!m.contains(e.target)) finish(null); };
    const onKey = (e) => {
      if (e.key === "Escape") finish(null);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const btns = [...m.querySelectorAll(".menu-pop__item:not([disabled])")];
        const i = btns.indexOf(document.activeElement);
        btns[(i + (e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length]?.focus();
      }
    };
    const cleanup = () => { document.removeEventListener("pointerdown", onDoc, true); document.removeEventListener("keydown", onKey, true); };
    m.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) finish(items[+b.dataset.i].value); });
    setTimeout(() => { document.addEventListener("pointerdown", onDoc, true); document.addEventListener("keydown", onKey, true); }, 0);
    m.querySelector(".menu-pop__item:not([disabled])")?.focus({ preventScroll: true });
  });
}

/* ── Snackbar ─────────────────────────────────────────────────── */
let snackHost = null;
let snackTimer = null;
/** snackbar("Note deleted", { action: "Undo", onAction }) */
export function snackbar(message, { action = "", onAction = null, duration = 4000 } = {}) {
  if (!snackHost) {
    snackHost = document.createElement("div");
    snackHost.className = "snack-host";
    snackHost.setAttribute("aria-live", "polite");
    document.body.appendChild(snackHost);
  }
  clearTimeout(snackTimer);
  snackHost.innerHTML = `<div class="snack"><span>${esc(message)}</span>${action ? `<button type="button" class="snack__action">${esc(action)}</button>` : ""}</div>`;
  const s = snackHost.firstElementChild;
  motion.animate(s, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }]);
  const dismiss = () => { clearTimeout(snackTimer); motion.animate(s, [{ opacity: 1 }, { opacity: 0 }], { duration: 120 }).then(() => s.remove()); };
  if (action) s.querySelector(".snack__action").onclick = () => { dismiss(); onAction && onAction(); };
  snackTimer = setTimeout(dismiss, duration);
  return dismiss;
}
export const toast = (msg) => snackbar(msg, { duration: 2600 });
