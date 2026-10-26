/**
 * pages/stopwatch.page.js — Stopwatch (ui/stopwatch/StopwatchScreen.kt).
 *
 * Start, pause, resume and reset, and up to 99 laps. The elapsed time is
 * derived from the stored start instant, so it keeps counting across reloads
 * and navigation. There are no alarms here.
 */

import { prefs } from "../core/prefs.js";
import { on, esc } from "../ui/dom.js";
import { screen, topBar, button } from "../ui/components.js";
import { stopwatch as W, formatStopwatch, MAX_LAPS } from "../productivity/logic.js";

const current = () => {
  const s = prefs.get("stopwatchState");
  return s ? { startedAt: s.startedAt ?? null, banked: s.banked || 0, marks: s.marks || [] } : W.empty();
};
const isIdle = (s) => !s.startedAt && !s.banked && !s.marks.length;

export async function render(el) {
  let tick = null;

  const lapsHtml = (s) => {
    if (!s.marks.length) return "";
    const durations = W.lapDurations(s.marks);
    const extreme = W.fastestAndSlowest(s.marks);
    const rows = s.marks.map((total, i) => {
      const cls = extreme && i === extreme.fastest ? " is-fastest" : extreme && i === extreme.slowest ? " is-slowest" : "";
      return `<li class="lap-row${cls}">
        <span class="lap-row__n">Lap ${i + 1}</span>
        <span class="lap-row__times"><span class="lap-row__lap">${esc(formatStopwatch(durations[i]))}</span><span class="lap-row__total">${esc(formatStopwatch(total))}</span></span>
      </li>`;
    }).join("");
    return `<h2 class="t-title-m stopwatch-laps__head">Laps</h2><ol class="stopwatch-laps">${rows}</ol>`;
  };

  const controls = (s) => {
    const running = !!s.startedAt;
    const idle = isIdle(s);
    const main = running
      ? button("Pause", { variant: "tonal", icon: "pause", attrs: { "data-act": "pause" } })
      : button(idle ? "Start" : "Resume", { variant: "filled", icon: "play_arrow", attrs: { "data-act": "start" } });
    const lap = `<button type="button" class="btn btn--outlined" data-act="lap"${running && s.marks.length < MAX_LAPS ? "" : " disabled"}><span>Lap</span></button>`;
    const reset = `<button type="button" class="btn btn--text" data-act="reset"${idle ? " disabled" : ""}><span>Reset</span></button>`;
    return `<div class="stopwatch-controls">${main}${lap}${reset}</div>`;
  };

  const draw = () => {
    const s = current();
    const now = Date.now();
    const body = el.querySelector(".screen__body");
    if (!body) return;
    body.innerHTML = `
      <div class="stack">
        <div class="stopwatch-face">
          <span class="stopwatch-readout" data-readout>${esc(formatStopwatch(W.elapsed(s, now)))}</span>
        </div>
        ${controls(s)}
        ${lapsHtml(s)}
      </div>`;
    stop();
    if (s.startedAt) tick = setInterval(update, 50);
  };

  const update = () => {
    const s = current();
    const r = el.querySelector("[data-readout]");
    if (r) r.textContent = formatStopwatch(W.elapsed(s, Date.now()));
    if (!s.startedAt) { stop(); draw(); }
  };

  const stop = () => { if (tick) { clearInterval(tick); tick = null; } };

  const save = (s) => { prefs.set("stopwatchState", s); draw(); };

  el.innerHTML = screen({ bar: topBar({ title: "Stopwatch" }), body: "" });
  draw();

  on(el, "click", "[data-act=start]", () => save(W.start(current())));
  on(el, "click", "[data-act=pause]", () => save(W.pause(current())));
  on(el, "click", "[data-act=lap]", () => {
    const s = current();
    if (!s.startedAt) return;
    save(W.lap(s));
  });
  on(el, "click", "[data-act=reset]", () => save(W.empty()));

  const unsub = prefs.on("stopwatchState", () => draw());
  return () => { stop(); unsub(); };
}
