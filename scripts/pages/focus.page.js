/**
 * pages/focus.page.js — Focus (ui/focus/FocusScreen.kt).
 *
 * Focus blocks alternate with short breaks, with a long break after a set
 * number of focus blocks. Times are kept as instants, so the session keeps
 * running across reloads. When a phase ends the next one is handed over idle,
 * waiting for Start (a notification fires too, see ALARM_NOTE).
 */

import { prefs } from "../core/prefs.js";
import { on, esc } from "../ui/dom.js";
import { screen, topBar, button, icon, card, sectionHeader } from "../ui/components.js";
import {
  focus as F, FOCUS_BOUNDS, PHASE_LABEL, clampFocusSettings, phaseMinutes, formatRemaining,
} from "../productivity/logic.js";
import { alarmBlock, bindAlarm } from "../productivity/shared.js";

const LIMIT_LABEL = {
  focus: { label: "Focus", unit: "min", less: "Shorter focus session", more: "Longer focus session" },
  short: { label: "Short break", unit: "min", less: "Shorter short break", more: "Longer short break" },
  long: { label: "Long break", unit: "min", less: "Shorter long break", more: "Longer long break" },
  sessions: { label: "Sessions before a long break", unit: "", less: "Fewer sessions before a long break", more: "More sessions before a long break" },
};
const KEY_OF = { focus: "focus", short: "short", long: "long", sessions: "sessions" };

/** The saved session, or a fresh one with the saved settings. */
function currentState() {
  const s = prefs.get("focusState");
  if (s && s.settings) return s;
  return F.fresh(clampFocusSettings(prefs.get("focusSettings") || {}));
}

/** "Session 2 of 4" for the phase in progress (FocusPlan.sessionLabel). */
function sessionLabel(s) {
  const n = s.settings.sessions;
  const current = s.phase === "FOCUS" ? (s.completed % n) + 1 : Math.max(1, ((s.completed - 1) % n) + 1);
  return `Session ${current} of ${n}`;
}

export async function render(el) {
  let tick = null;
  let justFinished = null;   // name of the phase that just ended, until the user acts
  let shown = currentState();

  const stop = () => { if (tick) { clearInterval(tick); tick = null; } };

  const finished = (s, now) => !!(s.endAtMillis && now >= s.endAtMillis);

  /** Hand over a phase whose time is up, so the next one waits, idle, for Start. */
  function settleIfDone() {
    const s = currentState();
    if (s.endAtMillis && finished(s, Date.now())) {
      justFinished = s.phase;
      prefs.set("focusState", F.complete(s));
      return true;
    }
    return false;
  }

  const statusLine = (s, now) => {
    if (justFinished) return `${PHASE_LABEL[justFinished]} finished`;
    if (F.running(s)) return `${PHASE_LABEL[s.phase]} in progress`;
    if (s.remainingMillis != null) return "Paused";
    return PHASE_LABEL[s.phase];
  };

  const controls = (s) => {
    const running = F.running(s);
    const paused = !running && s.remainingMillis != null;
    const main = running
      ? button("Pause", { variant: "tonal", icon: "pause", attrs: { "data-act": "pause" } })
      : button(paused ? "Resume" : "Start", { variant: "filled", icon: "play_arrow", attrs: { "data-act": "start" } });
    const skip = `<button type="button" class="btn btn--outlined" data-act="skip"><span>Skip</span></button>`;
    const reset = `<button type="button" class="btn btn--text" data-act="reset"><span>Reset</span></button>`;
    return `<div class="focus-controls">${main}${skip}${reset}</div>`;
  };

  const stepper = (key, value, locked) => {
    const meta = LIMIT_LABEL[key];
    const [lo, hi] = FOCUS_BOUNDS[key];
    const unit = meta.unit ? ` ${meta.unit}` : "";
    return `<div class="focus-step">
      <span class="focus-step__label">${esc(meta.label)}</span>
      <div class="focus-step__ctl">
        <button type="button" class="icon-btn" data-step="${key}" data-dir="-1" aria-label="${esc(meta.less)}"${locked || value <= lo ? " disabled" : ""}>${icon("remove")}</button>
        <span class="focus-step__value">${esc(value)}${esc(unit)}</span>
        <button type="button" class="icon-btn" data-step="${key}" data-dir="1" aria-label="${esc(meta.more)}"${locked || value >= hi ? " disabled" : ""}>${icon("add")}</button>
      </div>
    </div>`;
  };

  const body = (s, now) => {
    const running = F.running(s);
    const locked = running || s.remainingMillis != null;
    const remaining = F.remaining(s, now);
    const readout = formatRemaining(remaining);
    const next = F.nextPhaseAfter(s);
    const minutes = phaseMinutes(s.phase, s.settings);
    const sub = justFinished
      ? `Next: ${PHASE_LABEL[next]} · ${phaseMinutes(next, s.settings)} min`
      : `${PHASE_LABEL[s.phase]} · ${minutes} min`;
    const durations = ["focus", "short", "long", "sessions"].map((k) => stepper(k, s.settings[KEY_OF[k]], locked)).join("");
    return `
      <div class="stack">
        <div>${alarmBlock({ note: true })}</div>
        <div class="focus-face">
          <p class="focus-session">${esc(sessionLabel(s))}</p>
          <p class="focus-phase">${esc(PHASE_LABEL[s.phase])}</p>
          <span class="focus-readout" data-readout>${esc(readout)}</span>
          <p class="focus-status">${esc(statusLine(s, now))}</p>
          <p class="focus-sub">${esc(sub)}</p>
          ${controls(s)}
        </div>
        <div class="focus-durations">
          ${sectionHeader("timer", "Durations")}
          ${card(`${durations}${locked ? `<p class="focus-hint">Pause or finish the current phase to change these.</p>` : ""}`, { tone: "high", cls: "focus-durations__card" })}
        </div>
      </div>`;
  };

  const draw = () => {
    const now = Date.now();
    shown = currentState();
    const target = el.querySelector(".screen__body");
    if (!target) return;
    target.innerHTML = body(shown, now);
    stop();
    if (F.running(shown)) tick = setInterval(update, 250);
  };

  const update = () => {
    if (settleIfDone()) { draw(); return; }
    const s = currentState();
    const r = el.querySelector("[data-readout]");
    if (r) r.textContent = formatRemaining(F.remaining(s, Date.now()));
    if (!F.running(s)) { stop(); draw(); }
  };

  const save = (s) => { prefs.set("focusState", s); };

  el.innerHTML = screen({ bar: topBar({ title: "Focus" }), body: "" });
  settleIfDone();
  draw();
  bindAlarm(el);

  on(el, "click", "[data-act=start]", () => {
    justFinished = null;
    save(F.start(currentState()));
    draw();
  });
  on(el, "click", "[data-act=pause]", () => { save(F.pause(currentState())); draw(); });
  on(el, "click", "[data-act=skip]", () => { justFinished = null; save(F.skip(currentState())); draw(); });
  on(el, "click", "[data-act=reset]", () => { justFinished = null; save(F.reset(currentState())); draw(); });
  on(el, "click", "[data-step]", (e, btn) => {
    const s = currentState();
    if (F.running(s) || s.remainingMillis != null) return;
    const key = btn.dataset.step;
    const [lo, hi] = FOCUS_BOUNDS[key];
    const field = KEY_OF[key];
    const next = Math.min(hi, Math.max(lo, s.settings[field] + (+btn.dataset.dir)));
    const settings = clampFocusSettings({ ...s.settings, [field]: next });
    prefs.set("focusSettings", settings);
    const fresh = { ...s, settings };
    // An idle phase takes the new length straight away.
    save(fresh);
    draw();
  });

  // A phase that ran out (in this tab or the alarm side) hands over idle; a Skip does not count as finishing.
  const unsub = prefs.on("focusState", (v) => {
    if (v && shown && shown.endAtMillis && !v.endAtMillis && v.phase !== shown.phase && Date.now() >= shown.endAtMillis) justFinished = shown.phase;
    draw();
  });

  return () => { stop(); unsub(); };
}
