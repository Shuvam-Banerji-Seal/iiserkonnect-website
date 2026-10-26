/**
 * productivity/logic.js — the productivity suite's pure rules, ported from
 * the app's productivity/ package (RepeatRule, RemindersPresentation,
 * NotesPresentation, PlannerPresentation, TimerState, StopwatchState,
 * FocusPlan, EventTimes, EventsPresentation, MonthGrid, Agenda).
 *
 * No DOM here, so every rule can be checked in isolation. Times are epoch
 * milliseconds; days are local "YYYY-MM-DD" strings (the app's epoch days).
 */

import { isoDay, fromIsoDay, startOfDay, timeOf, sameDay, DAY_NAMES, MONTH_NAMES } from "../ui/dom.js";

/* ── RepeatRule ─────────────────────────────────────────────────── */
export const REPEAT_RULES = ["NONE", "DAILY", "WEEKLY", "MONTHLY"];
export const REPEAT_LABELS = { NONE: "Does not repeat", DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" };
export const parseRule = (s) => (REPEAT_RULES.includes(String(s || "").toUpperCase()) ? String(s).toUpperCase() : "NONE");

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

/** Next occurrence after `from` (local wall-clock arithmetic, keeps time across DST). */
export function nextTrigger(fromMs, rule, anchorDay = null) {
  const d = new Date(fromMs);
  switch (parseRule(rule)) {
    case "DAILY": return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, d.getHours(), d.getMinutes(), d.getSeconds()).getTime();
    case "WEEKLY": return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7, d.getHours(), d.getMinutes(), d.getSeconds()).getTime();
    case "MONTHLY": {
      const y = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
      const m = (d.getMonth() + 1) % 12;
      const day = Math.min(anchorDay || d.getDate(), daysInMonth(y, m));
      return new Date(y, m, day, d.getHours(), d.getMinutes(), d.getSeconds()).getTime();
    }
    default: return null;
  }
}

/** Walk forward from the SCHEDULED time until strictly after `after`; null for NONE or after 20 000 steps. */
export function nextTriggerAfter(fromMs, afterMs, rule, anchorDay = null) {
  if (parseRule(rule) === "NONE") return null;
  let t = fromMs;
  for (let i = 0; i < 20000; i++) {
    if (t > afterMs) return t;
    t = nextTrigger(t, rule, anchorDay);
    if (t == null) return null;
  }
  return null;
}

/** ReminderAnchor.resolve: the monthly anchor day, kept unless the date changed. */
export function resolveAnchor(rule, triggerMs, previous = null) {
  if (parseRule(rule) !== "MONTHLY") return null;
  if (previous && previous.anchorDayOfMonth && previous.triggerAtMillis && isoDay(new Date(previous.triggerAtMillis)) === isoDay(new Date(triggerMs))) {
    return previous.anchorDayOfMonth;
  }
  return new Date(triggerMs).getDate();
}

/* ── Reminders ─────────────────────────────────────────────────── */
export function reminderRows(list, now = Date.now()) {
  const up = list.filter((r) => r.triggerAtMillis > now).sort((a, b) => a.triggerAtMillis - b.triggerAtMillis);
  const past = list.filter((r) => r.triggerAtMillis <= now).sort((a, b) => b.triggerAtMillis - a.triggerAtMillis);
  return { upcoming: up, past };
}
export const isPastOneShot = (r, now = Date.now()) => r.enabled && parseRule(r.repeatRule) === "NONE" && r.triggerAtMillis <= now;

/** ReminderReconcile.advance: move a missed repeating reminder to its next slot. */
export function reconcileReminder(r, now = Date.now()) {
  if (parseRule(r.repeatRule) === "NONE" || r.triggerAtMillis > now) return null;
  const next = nextTriggerAfter(r.triggerAtMillis, now, r.repeatRule, r.anchorDayOfMonth);
  if (next == null) return null;
  let last = r.triggerAtMillis, t = r.triggerAtMillis;
  for (let i = 0; i < 5000 && t <= now; i++) { last = t; t = nextTrigger(t, r.repeatRule, r.anchorDayOfMonth); }
  return { ...r, triggerAtMillis: next, lastFiredAtMillis: last };
}

/* ── Notes ─────────────────────────────────────────────────────── */
export const noteRows = (notes) => notes.slice().sort((a, b) => (b.pinned - a.pinned) || (b.updatedAtMillis - a.updatedAtMillis));
export function noteMatches(note, query) {
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${note.title || ""}\n${note.body || ""}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}
export function noteShareText(note) {
  const t = (note.title || "").trim(), b = (note.body || "").trim();
  return t && b ? `${t}\n\n${b}` : t || b;
}

/* ── Planner ───────────────────────────────────────────────────── */
export function plannerRows(tasks) {
  return tasks.slice().sort((a, b) =>
    (a.done - b.done) ||
    ((a.dueDay ? 0 : 1) - (b.dueDay ? 0 : 1)) ||
    String(a.dueDay || "").localeCompare(String(b.dueDay || "")) ||
    ((a.startMinute != null ? 0 : 1) - (b.startMinute != null ? 0 : 1)) ||
    ((a.startMinute ?? 0) - (b.startMinute ?? 0)) ||
    String(a.id).localeCompare(String(b.id)));
}
export const isOverdue = (t, today = isoDay(new Date())) => !t.done && !!t.dueDay && t.dueDay < today;
export const isDueToday = (t, today = isoDay(new Date())) => !t.done && t.dueDay === today;
export function blockError(start, end) {
  if (end != null && start == null) return "Pick a start time for this block.";
  if (start != null && end != null && end <= start) return "The block has to end after it starts.";
  return null;
}

/* ── Timer (TimerState) ────────────────────────────────────────── */
export const TIMER_MAX_MINUTES = 1440;
export const timer = {
  start(totalMs, label = "", now = Date.now()) { return { endAtMillis: now + totalMs, remainingMillis: null, totalMillis: totalMs, label }; },
  pause(s, now = Date.now()) { return s && s.endAtMillis ? { ...s, endAtMillis: null, remainingMillis: Math.max(0, s.endAtMillis - now) } : s; },
  resume(s, now = Date.now()) { return s && s.remainingMillis != null ? { ...s, endAtMillis: now + s.remainingMillis, remainingMillis: null } : s; },
  running: (s) => !!(s && s.endAtMillis),
  remaining(s, now = Date.now()) { if (!s) return 0; return s.endAtMillis ? Math.max(0, s.endAtMillis - now) : s.remainingMillis || 0; },
  isFinished: (s, now = Date.now()) => !!(s && s.endAtMillis && now >= s.endAtMillis),
  isStale: (s, now = Date.now()) => !!(s && s.endAtMillis && now - s.endAtMillis > 3600_000),
  progress(s, now = Date.now()) { if (!s || !s.totalMillis) return 0; return Math.max(0, Math.min(1, 1 - timer.remaining(s, now) / s.totalMillis)); },
};
/** "mm:ss", or "h:mm:ss" at an hour or more. */
export function formatRemaining(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/* ── Stopwatch (StopwatchState) ────────────────────────────────── */
export const MAX_LAPS = 99;
export const stopwatch = {
  empty: () => ({ startedAt: null, banked: 0, marks: [] }),
  elapsed: (s, now = Date.now()) => s.banked + (s.startedAt ? now - s.startedAt : 0),
  start: (s, now = Date.now()) => (s.startedAt ? s : { ...s, startedAt: now }),
  pause: (s, now = Date.now()) => (s.startedAt ? { ...s, banked: s.banked + (now - s.startedAt), startedAt: null } : s),
  lap(s, now = Date.now()) {
    if (!s.startedAt || s.marks.length >= MAX_LAPS) return s;
    return { ...s, marks: [...s.marks, stopwatch.elapsed(s, now)] };
  },
  lapDurations: (marks) => marks.map((m, i) => m - (i ? marks[i - 1] : 0)),
  fastestAndSlowest(marks) {
    const d = stopwatch.lapDurations(marks);
    if (d.length < 2) return null;
    let f = 0, sl = 0;
    d.forEach((v, i) => { if (v < d[f]) f = i; if (v > d[sl]) sl = i; });
    return { fastest: f, slowest: sl };
  },
};
/** Centiseconds below one minute; h:mm:ss from one hour (StopwatchState.format). */
export function formatStopwatch(ms) {
  ms = Math.max(0, ms);
  const p = (n) => String(n).padStart(2, "0");
  const cs = Math.floor((ms % 1000) / 10);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  if (h > 0) return `${h}:${p(m)}:${p(s)}`;
  return `${p(m)}:${p(s)}.${p(cs)}`;
}

/* ── Focus (FocusPlan) ─────────────────────────────────────────── */
export const FOCUS_BOUNDS = { focus: [5, 120], short: [1, 30], long: [5, 60], sessions: [2, 8] };
export const FOCUS_DEFAULTS = { focus: 25, short: 5, long: 15, sessions: 4 };
export const PHASE_LABEL = { FOCUS: "Focus", SHORT_BREAK: "Short break", LONG_BREAK: "Long break" };
export function clampFocusSettings(s) {
  const c = (v, [lo, hi], d) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? Math.round(+v) : d));
  return { focus: c(s.focus, FOCUS_BOUNDS.focus, 25), short: c(s.short, FOCUS_BOUNDS.short, 5), long: c(s.long, FOCUS_BOUNDS.long, 15), sessions: c(s.sessions, FOCUS_BOUNDS.sessions, 4) };
}
export const phaseMinutes = (phase, s) => (phase === "FOCUS" ? s.focus : phase === "SHORT_BREAK" ? s.short : s.long);
export const focus = {
  fresh: (settings = FOCUS_DEFAULTS) => ({ settings: clampFocusSettings(settings), phase: "FOCUS", completed: 0, endAtMillis: null, remainingMillis: null }),
  nextPhaseAfter(s) {
    if (s.phase !== "FOCUS") return "FOCUS";
    return (s.completed + 1) % s.settings.sessions === 0 ? "LONG_BREAK" : "SHORT_BREAK";
  },
  running: (s) => !!s.endAtMillis,
  remaining(s, now = Date.now()) {
    if (s.endAtMillis) return Math.max(0, s.endAtMillis - now);
    if (s.remainingMillis != null) return s.remainingMillis;
    return phaseMinutes(s.phase, s.settings) * 60000;
  },
  start(s, now = Date.now()) { return s.endAtMillis ? s : { ...s, endAtMillis: now + focus.remaining(s, now), remainingMillis: null }; },
  pause(s, now = Date.now()) { return s.endAtMillis ? { ...s, remainingMillis: Math.max(0, s.endAtMillis - now), endAtMillis: null } : s; },
  complete(s) {
    const next = focus.nextPhaseAfter(s);
    return { ...s, completed: s.phase === "FOCUS" ? s.completed + 1 : s.completed, phase: next, endAtMillis: null, remainingMillis: null };
  },
  skip(s) {
    const next = s.phase === "FOCUS" ? ((s.completed + 1) % s.settings.sessions === 0 ? "LONG_BREAK" : "SHORT_BREAK") : "FOCUS";
    return { ...s, phase: next, endAtMillis: null, remainingMillis: null };
  },
  reset: (s) => focus.fresh(s.settings),
};

/* ── Personal events (EventTimes / EventsPresentation) ─────────── */
/** Build start/end instants from the editor's picks, or { error }. */
export function buildEventTimes({ startDay, endDay, startMinute, endMinute, allDay }) {
  const sd = fromIsoDay(startDay), ed = fromIsoDay(endDay || startDay);
  if (allDay) {
    const start = sd.getTime();
    const end = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate() + 1).getTime();
    if (end <= start) return { error: "The event has to end after it starts." };
    return { startMillis: start, endMillis: end };
  }
  const start = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate(), 0, startMinute ?? 540).getTime();
  const end = endMinute == null ? null : new Date(ed.getFullYear(), ed.getMonth(), ed.getDate(), 0, endMinute).getTime();
  if (end != null && end <= start) return { error: "The event has to end after it starts." };
  return { startMillis: start, endMillis: end };
}

/** Jump a repeating series close to `fromMs` (without walking every step), always a little before it. */
function jumpNear(ev, fromMs, rule, anchor) {
  const s = new Date(ev.startMillis), f = new Date(fromMs);
  if (rule === "DAILY" || rule === "WEEKLY") {
    const step = rule === "DAILY" ? 1 : 7;
    const n = Math.floor((startOfDay(f) - startOfDay(s)) / 86400000 / step) - 1;
    if (n > 0) return new Date(s.getFullYear(), s.getMonth(), s.getDate() + n * step, s.getHours(), s.getMinutes(), s.getSeconds()).getTime();
  } else if (rule === "MONTHLY") {
    const months = (f.getFullYear() - s.getFullYear()) * 12 + (f.getMonth() - s.getMonth()) - 1;
    if (months > 0) {
      const tot = s.getMonth() + months, y = s.getFullYear() + Math.floor(tot / 12), m = tot % 12;
      const day = Math.min(anchor || s.getDate(), daysInMonth(y, m));
      return new Date(y, m, day, s.getHours(), s.getMinutes(), s.getSeconds()).getTime();
    }
  }
  return ev.startMillis;
}

/** Expand an event into occurrences overlapping [fromMs, toMs). */
export function occurrences(ev, fromMs, toMs) {
  const dur = (ev.endMillis ?? ev.startMillis + 3600_000) - ev.startMillis;
  const rule = parseRule(ev.repeatRule);
  const anchor = new Date(ev.startMillis).getDate();
  const out = [];
  let t = rule === "NONE" ? ev.startMillis : jumpNear(ev, fromMs - dur, rule, anchor);
  for (let i = 0; i < 5000 && t < toMs; i++) {
    if (t + dur > fromMs) out.push({ ...ev, occStart: t, occEnd: t + dur });
    if (rule === "NONE") break;
    t = nextTrigger(t, rule, anchor);
    if (t == null) break;
  }
  return out;
}
/** Local day keys ("YYYY-MM-DD") that any occurrence of any event covers in a month (for the grid dots). */
export function markedDaysInMonth(events, year, month) {
  const from = new Date(year, month, 1).getTime(), to = new Date(year, month + 1, 1).getTime();
  const days = new Set();
  for (const e of events) for (const o of occurrences(e, from, to)) {
    let d = startOfDay(new Date(Math.max(o.occStart, from)));
    const end = Math.min(o.occEnd, to);
    for (let i = 0; i < 40 && d.getTime() < end; i++) {
      days.add(isoDay(d));
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
  }
  return days;
}
export function occurrencesOnDay(events, day) {
  const d = fromIsoDay(day);
  const from = d.getTime(), to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  return events.flatMap((e) => occurrences(e, from, to)).sort((a, b) => (b.allDay - a.allDay) || (a.occStart - b.occStart));
}
/** Next reminder instant strictly after now (start − remindMinutesBefore), or null. */
export function nextEventReminderAt(ev, now = Date.now()) {
  if (ev.remindMinutesBefore == null) return null;
  const lead = ev.remindMinutesBefore * 60000;
  const occ = occurrences(ev, now - 366 * 86400000, now + 400 * 86400000);
  const hit = occ.find((o) => o.occStart - lead > now);
  return hit ? hit.occStart - lead : null;
}

/** MonthGrid.weeks: rows of 7 local days (null = padding). */
export function monthWeeks(year, month, sundayFirst = false) {
  const first = new Date(year, month, 1);
  const lead = sundayFirst ? first.getDay() : (first.getDay() + 6) % 7;
  const n = daysInMonth(year, month);
  const cells = [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => isoDay(new Date(year, month, i + 1)))];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
export const weekdayLabels = (sundayFirst = false) => (sundayFirst ? ["S", "M", "T", "W", "T", "F", "S"] : ["M", "T", "W", "T", "F", "S", "S"]);

/* ── Agenda (My Calendar + campus events) ──────────────────────── */
export function agenda(personal, campus, fromMs, toMs) {
  const mine = personal.flatMap((e) => occurrences(e, fromMs, toMs)).map((o) => ({
    key: `my:${o.id}:${o.occStart}`, source: "MY_CALENDAR", title: o.title, start: o.occStart, end: o.occEnd,
    allDay: !!o.allDay, location: o.location || "", details: o.notes || "",
  }));
  const seen = new Set();
  return [...mine, ...campus.filter((c) => c.start < toMs && (c.end ?? c.start + 3600_000) > fromMs)]
    .sort((a, b) => (startOfDay(new Date(a.start)) - startOfDay(new Date(b.start))) || (b.allDay - a.allDay) || (a.start - b.start) || a.title.localeCompare(b.title))
    .filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true)));
}
/** Agenda.reminderAt: 15 min before a timed entry, 08:00 on an all-day one; its start if that passed; null once started. */
export function agendaReminderAt(entry, now = Date.now()) {
  if (now >= entry.start) return null;
  let t;
  if (entry.allDay) { const d = new Date(entry.start); t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0).getTime(); }
  else t = entry.start - 15 * 60000;
  return t <= now ? entry.start : t;
}

/* ── Labels (TimeLabels / ReminderTimeText) ────────────────────── */
const MON3 = (d) => MONTH_NAMES[d.getMonth()].slice(0, 3);
/** Today, Tomorrow, Yesterday, a short weekday within the week, else "d Mon" (+ year when it differs). */
export function dayWord(d, now = new Date()) {
  const diff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff >= 2 && diff <= 6) return DAY_NAMES[d.getDay()].slice(0, 3);
  return d.getFullYear() === now.getFullYear() ? `${d.getDate()} ${MON3(d)}` : `${d.getDate()} ${MON3(d)} ${d.getFullYear()}`;
}
/** "Tomorrow 9:00 AM" (ReminderTimeText.format). */
export const reminderTimeText = (ms, now = Date.now(), h24 = undefined) => {
  const d = new Date(ms);
  return `${dayWord(d, new Date(now))} ${timeOf(d, h24)}`;
};
/** A planner day, from its "YYYY-MM-DD" key. */
export const dayKeyWord = (iso, now = new Date()) => dayWord(fromIsoDay(iso), now);
/** "All day", or "9:00 AM–10:00 AM" (TimeLabels.eventRange). */
export function eventRangeText(startMs, endMs, allDay, h24 = undefined) {
  if (allDay) return "All day";
  const a = timeOf(new Date(startMs), h24);
  return endMs == null ? a : `${a}\u2013${timeOf(new Date(endMs), h24)}`;
}
/** Planner time block: "9:00–10:30", "9:00", or "" (TimeLabels.taskBlock). */
export function taskBlockText(start, end, h24 = undefined) {
  if (start == null) return "";
  const base = (m) => timeOf(new Date(2000, 0, 1, Math.floor(m / 60), m % 60), h24);
  return end == null ? base(start) : `${base(start)}\u2013${base(end)}`;
}
/** The reminder time a "Remind me about…" pick gets when the entry has no reminder time (defaultTriggerMillis). */
export function defaultTriggerMillis(now = Date.now()) {
  const plusHour = new Date(now + 3600_000);
  const roundedMinutes = (Math.floor(plusHour.getMinutes() / 5) + 1) * 5;
  const base = new Date(plusHour.getFullYear(), plusHour.getMonth(), plusHour.getDate(), plusHour.getHours(), 0, 0, 0);
  return base.getTime() + roundedMinutes * 60000;
}
/** Alarm label for a note: "Alarm passed · 9:00 AM", "Alarm · …", "Alarm off · …" (NotesScreen.alarmLabel). */
export function noteAlarmLabel(note, now = Date.now(), h24 = undefined) {
  const when = reminderTimeText(note.alarmAtMillis, now, h24);
  if (note.alarmAtMillis <= now) return `Alarm passed  \u00b7  ${when}`;
  return note.alarmEnabled ? `Alarm  \u00b7  ${when}` : `Alarm off  \u00b7  ${when}`;
}

/* ── Calendar entries → reminders, notes, tasks (Agenda) ────────── */
/** Agenda.summaryLine: "Thu 3 Sep  ·  11:00 AM–12:00 PM  ·  LHC 101". */
export function entrySummary(entry, h24 = undefined) {
  const d = new Date(entry.start);
  const day = `${DAY_NAMES[d.getDay()].slice(0, 3)} ${d.getDate()} ${MON3(d)}`;
  const time = eventRangeText(entry.start, entry.end, entry.allDay, h24);
  return [day, time, (entry.location || "").trim()].filter(Boolean).join("  \u00b7  ");
}
/** Agenda.noteBody: the summary, then the details, each after a blank line. */
export function entryNoteBody(entry, h24 = undefined) {
  const summary = entrySummary(entry, h24);
  const details = (entry.details || "").trim();
  return details ? `${summary}\n\n${details}\n\n` : `${summary}\n\n`;
}
/** Agenda.taskFields: the day, and a time block only for a timed entry that starts and ends the same day. */
export function entryTaskFields(entry) {
  const d = new Date(entry.start);
  const dueDay = isoDay(d);
  if (entry.allDay) return { dueDay, startMinute: null, endMinute: null };
  const startMinute = d.getHours() * 60 + d.getMinutes();
  let endMinute = null;
  if (entry.end != null) {
    const e = new Date(entry.end);
    const m = e.getHours() * 60 + e.getMinutes();
    if (sameDay(e, d) && m > startMinute) endMinute = m;
  }
  return { dueDay, startMinute, endMinute };
}
/** Entries of both calendars that fall on one local day ("YYYY-MM-DD"), all-day first. */
export function entriesOnDay(entries, iso) {
  const from = fromIsoDay(iso).getTime();
  const to = new Date(fromIsoDay(iso).getFullYear(), fromIsoDay(iso).getMonth(), fromIsoDay(iso).getDate() + 1).getTime();
  return entries.filter((e) => e.start < to && (e.end ?? e.start + 3600_000) > from).sort((a, b) => (b.allDay - a.allDay) || (a.start - b.start));
}
