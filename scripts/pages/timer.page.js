/**
 * pages/timer.page.js — Timer (ui/timer/TimerScreen.kt).
 *
 * One countdown with an optional label. The end instant is stored, so the
 * timer keeps running across reloads and navigation. The ring and readout
 * tick only while this screen is open. A timer that finishes while the tab is
 * open pops a notification (ALARM_NOTE applies).
 */

import { prefs } from "../core/prefs.js";
import { on, esc } from "../ui/dom.js";
import { screen, topBar, chip, textField, button, icon, emptyState } from "../ui/components.js";
import { confirm } from "../ui/overlay.js";
import { timer as T, formatRemaining, TIMER_MAX_MINUTES } from "../productivity/logic.js";
import { alarmBlock, bindAlarm, numOr } from "../productivity/shared.js";

const PRESETS = [[1, "1m"], [2, "2m"], [3, "3m"], [5, "5m"], [10, "10m"], [15, "15m"], [30, "30m"], [60, "1h"]];
const RING_R = 92;
const RING_C = 2 * Math.PI * RING_R;

function ring(progressLeft, readout, caption) {
  const off = RING_C * (1 - Math.max(0, Math.min(1, progressLeft)));
  return `<div class="timer-ring">
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <circle class="timer-ring__track" cx="100" cy="100" r="${RING_R}"/>
      <circle class="timer-ring__value" cx="100" cy="100" r="${RING_R}" stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" data-ring/>
    </svg>
    <div class="timer-ring__center">
      <span class="timer-ring__readout" data-readout>${esc(readout)}</span>
      <span class="timer-ring__caption">${esc(caption)}</span>
    </div>
  </div>`;
}

export async function render(el) {
  let sel = null;          // preset minutes
  let custom = "";
  let label = "";
  let msg = "";
  let tick = null;

  // An abandoned timer (finished more than an hour ago) is dropped, as the app does.
  const s0 = prefs.get("timerState");
  if (s0 && T.isStale(s0)) prefs.set("timerState", null);

  const stopTick = () => { if (tick) { clearInterval(tick); tick = null; } };

  const body = () => {
    const s = prefs.get("timerState");
    const now = Date.now();
    if (!s) return idlePane();
    if (T.isFinished(s, now)) return finishedPane(s);
    return activePane(s, now);
  };

  function idlePane() {
    return `
      <div class="stack">
        <div>${alarmBlock({ note: true })}</div>
        ${msg ? `<div class="prod-banner" role="status"><p>${esc(msg)}</p></div>` : ""}
        <div class="timer-idle">
          <h2 class="t-title-m">How long?</h2>
          <div class="chips" data-presets>${PRESETS.map(([m, l]) => chip(l, { selected: sel === m, a: { "data-min": m } })).join("")}</div>
          ${textField({ id: "timer-custom", label: "Or a custom number of minutes", type: "number", value: custom, a: { "data-f": "custom", min: 1, max: TIMER_MAX_MINUTES, inputmode: "numeric" } })}
          ${textField({ id: "timer-label", label: "Label (optional)", value: label, a: { "data-f": "label" } })}
          <div class="timer-start">${button("Start", { variant: "filled", icon: "play_arrow", block: true, attrs: { "data-act": "start" } })}</div>
        </div>
      </div>`;
  }

  function activePane(s, now) {
    const paused = !T.running(s);
    const left = T.progress(s, now);
    return `
      <div class="stack">
        <div>${alarmBlock({ note: true })}</div>
        <div class="timer-active">
          ${ring(1 - left, formatRemaining(T.remaining(s, now)), paused ? "Paused" : (s.label || ""))}
          <div class="timer-actions">
            ${paused
              ? button("Resume", { variant: "filled", icon: "play_arrow", attrs: { "data-act": "resume" } })
              : button("Pause", { variant: "tonal", icon: "pause", attrs: { "data-act": "pause" } })}
            ${button("Cancel", { variant: "text", attrs: { "data-act": "cancel" } })}
          </div>
        </div>
      </div>`;
  }

  function finishedPane(s) {
    return `
      <div class="stack">
        <div>${alarmBlock({ note: true })}</div>
        <div class="timer-finished">
          <span class="timer-finished__icon">${icon("alarm", { size: 48 })}</span>
          <h2 class="t-title-l">Time's up</h2>
          ${s.label ? `<p class="t-body-l">${esc(s.label)}</p>` : ""}
          ${button("Done", { variant: "filled", attrs: { "data-act": "done" } })}
        </div>
      </div>`;
  }

  const paint = () => {
    const target = el.querySelector(".screen__body");
    if (!target) return;
    target.innerHTML = body();
    syncTicking();
  };

  function syncTicking() {
    stopTick();
    const s = prefs.get("timerState");
    if (!s || !T.running(s)) { update(); return; }
    tick = setInterval(update, 250);
    update();
  }

  /** Move the readout and ring along; switch panes when the timer ends. */
  function update() {
    const s = prefs.get("timerState");
    if (!s) return;
    if (T.isFinished(s)) { stopTick(); paint(); return; }
    const r = el.querySelector("[data-readout]");
    if (r) r.textContent = formatRemaining(T.remaining(s));
    const arc = el.querySelector("[data-ring]");
    if (arc) arc.setAttribute("stroke-dashoffset", (RING_C * (T.progress(s))).toFixed(2));
  }

  el.innerHTML = screen({ bar: topBar({ title: "Timer" }), body: body() });
  bindAlarm(el);

  on(el, "click", "[data-min]", (e, btn) => {
    sel = +btn.dataset.min;
    custom = "";
    const inp = el.querySelector("[data-f=custom]");
    if (inp) inp.value = "";
    el.querySelectorAll("[data-min]").forEach((b) => {
      const on = +b.dataset.min === sel;
      b.classList.toggle("chip--selected", on);
      b.setAttribute("aria-pressed", String(on));
    });
  });
  el.addEventListener("input", (e) => {
    if (e.target.matches("[data-f=custom]")) { custom = e.target.value; if (custom !== "") { sel = null; el.querySelectorAll("[data-min]").forEach((b) => { b.classList.remove("chip--selected"); b.setAttribute("aria-pressed", "false"); }); } }
    if (e.target.matches("[data-f=label]")) label = e.target.value;
  });
  on(el, "click", "[data-act=start]", () => {
    const mins = sel ?? numOr(custom, null);
    if (mins == null || mins < 1) { msg = "Pick a length, or type a number of minutes."; paint(); return; }
    const clamped = Math.min(TIMER_MAX_MINUTES, Math.max(1, Math.round(mins)));
    msg = "";
    prefs.set("timerState", T.start(clamped * 60000, label.trim()));
    paint();
  });
  on(el, "click", "[data-act=pause]", () => { prefs.set("timerState", T.pause(prefs.get("timerState"))); paint(); });
  on(el, "click", "[data-act=resume]", () => { prefs.set("timerState", T.resume(prefs.get("timerState"))); paint(); });
  on(el, "click", "[data-act=cancel]", async () => {
    const ok = await confirm({ title: "Cancel timer?", text: "The timer stops and its alarm is cancelled.", confirmLabel: "Cancel timer", danger: true });
    if (ok) { prefs.set("timerState", null); label = ""; paint(); }
  });
  on(el, "click", "[data-act=done]", () => { prefs.set("timerState", null); label = ""; paint(); });

  const unsub = prefs.on("timerState", () => paint());
  syncTicking();

  return () => { stopTick(); unsub(); };
}
