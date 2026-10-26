/**
 * core/notify.js — the alarm side of the productivity suite, for a browser.
 *
 * On the phone, AlarmManager wakes the app at the exact minute even when it is
 * closed. A web page cannot do that: there is no browser API that fires a
 * notification at a set time with the page closed (that would need a push
 * server, and this site has no backend by design). So:
 *
 *   - while any IISERKonnect tab is open (even in the background), this
 *     checks every 15 seconds and shows a system notification through the
 *     Notifications API, plus a snackbar in the page;
 *   - when every tab is closed, nothing fires. Missed reminders are shown as
 *     past on the Reminders screen, and repeating ones move to their next
 *     time, exactly as the app reconciles after a reboot.
 *
 * Screens that set alarms say this in plain words (see ALARM_NOTE).
 */

import { collection } from "./db.js";
import { prefs } from "./prefs.js";
import { nextTriggerAfter, parseRule, nextEventReminderAt, timer, focus, PHASE_LABEL } from "../productivity/logic.js";

export const ALARM_NOTE = "Alarms ring only while IISERKonnect is open in a browser tab — a web page cannot wake itself once every tab is closed. Keep a tab open (it can be in the background), or use the Android app for alarms that always fire.";

export const notificationsSupported = () => typeof Notification === "function";
export const permission = () => (notificationsSupported() ? Notification.permission : "unsupported");
export async function requestPermission() {
  if (!notificationsSupported()) return "unsupported";
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

const fired = new Set();
let snackFn = null;

async function show(title, body, route, tag) {
  if (fired.has(tag)) return;
  fired.add(tag);
  let shown = false;
  if (permission() === "granted") {
    try {
      const n = new Notification(title, { body, tag, icon: "./assets/favicon.svg" });
      n.onclick = () => { window.focus(); location.hash = "#/" + route; n.close(); };
      shown = true;
    } catch { /* some mobile browsers only allow notifications from a service worker */ }
  }
  if (!snackFn) snackFn = (await import("../ui/overlay.js")).snackbar;
  snackFn(`${title}${body ? " — " + body : ""}`, { action: "Open", onAction: () => { location.hash = "#/" + route; }, duration: shown ? 5000 : 10000 });
}

async function tick() {
  const now = Date.now();
  try {
    const reminders = collection("reminders");
    for (const r of await reminders.all()) {
      if (!r.enabled || r.triggerAtMillis > now) continue;
      if (now - r.triggerAtMillis > 6 * 3600_000 && parseRule(r.repeatRule) === "NONE") continue; // long gone
      const tag = `rem:${r.id}:${r.triggerAtMillis}`;
      if (r.notifiedAt === r.triggerAtMillis) continue;
      await show(r.title || "Reminder", r.details || "", "reminders", tag);
      const next = nextTriggerAfter(r.triggerAtMillis, now, r.repeatRule, r.anchorDayOfMonth);
      await reminders.put({ ...r, notifiedAt: r.triggerAtMillis, lastFiredAtMillis: r.triggerAtMillis, ...(next ? { triggerAtMillis: next } : {}) });
    }
    const notes = collection("notes");
    for (const n of await notes.all()) {
      if (!n.alarmEnabled || !n.alarmAtMillis || n.alarmAtMillis > now) continue;
      await show(n.title || "Note", (n.body || "").slice(0, 120), "notes", `note:${n.id}:${n.alarmAtMillis}`);
      await notes.put({ ...n, alarmEnabled: false });
    }
    const tasks = collection("tasks");
    for (const t of await tasks.all()) {
      if (t.done || !t.remindAtMillis || t.remindAtMillis > now || t.notifiedAt === t.remindAtMillis) continue;
      await show(t.title || "Task", t.details || "", "planner", `task:${t.id}:${t.remindAtMillis}`);
      await tasks.put({ ...t, notifiedAt: t.remindAtMillis });
    }
    const events = collection("events");
    for (const e of await events.all()) {
      const lead = (e.remindMinutesBefore ?? null);
      if (lead == null) continue;
      const due = e.nextReminderAt;
      if (due && due <= now && e.notifiedAt !== due) {
        await show(e.title || "Event", lead ? `Starts in ${lead} min${e.location ? " · " + e.location : ""}` : "Starting now", "my-calendar", `ev:${e.id}:${due}`);
        await events.put({ ...e, notifiedAt: due, nextReminderAt: nextEventReminderAt(e, now) });
      } else if (!due || (due < now && e.notifiedAt === due)) {
        const nx = nextEventReminderAt(e, now);
        if (nx !== e.nextReminderAt) await events.put({ ...e, nextReminderAt: nx });
      }
    }
  } catch (err) { console.warn("notify", err); }

  const t = prefs.get("timerState");
  if (t && timer.isFinished(t, now) && t.notifiedAt !== t.endAtMillis && !timer.isStale(t, now)) {
    prefs.set("timerState", { ...t, notifiedAt: t.endAtMillis });
    show(`${t.label || "Timer"} finished`, "", "timer", `timer:${t.endAtMillis}`);
  }
  const f = prefs.get("focusState");
  if (f && f.endAtMillis && now >= f.endAtMillis && f.notifiedAt !== f.endAtMillis) {
    const next = focus.nextPhaseAfter(f);
    prefs.set("focusState", { ...focus.complete(f), notifiedAt: f.endAtMillis });
    show(`${PHASE_LABEL[f.phase]} finished`, `Next: ${PHASE_LABEL[next]}`, "focus", `focus:${f.endAtMillis}`);
  }
  const cal = prefs.get("calorieReminder");
  if (cal.enabled) {
    const d = new Date(now);
    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), cal.hour, cal.minute).getTime();
    if (now >= at && now - at < 15 * 60000 && cal.lastFired !== at) {
      prefs.patch("calorieReminder", { lastFired: at });
      show("Track today's calories", "Log what you ate in My Budget.", "budget", `cal:${at}`);
    }
  }
}

let started = false;
export function startNotifier() {
  if (started) return;
  started = true;
  setTimeout(tick, 1500);
  setInterval(tick, 15000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
}
/** Ask for an immediate check (after saving something due soon). */
export const checkNow = () => tick();
