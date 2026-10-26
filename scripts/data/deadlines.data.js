/**
 * data/deadlines.data.js — WeLearn assignment deadlines.
 *
 * Model: { assignments: [{ id, course, courseName, title, due (ms|null), submitted, url }],
 *          grading: [{ id, course, courseName, title, due, total, submitted, toGrade, notSubmitted }] }
 * Samples carry dueInHours so they stay in the future.
 */

import { load } from "../services/source.js";
import { fetchCourses, fetchDeadlines } from "../services/welearn.service.js";

const HOUR = 3600_000;

function fromSample(s) {
  const now = Date.now();
  return {
    assignments: s.assignments.map((a) => ({
      id: a.id, course: a.course, courseName: a.courseName, title: a.title,
      due: a.dueInHours == null ? null : now + a.dueInHours * HOUR,
      submitted: !!a.submitted, url: "",
    })),
    grading: (s.grading || []).map((g) => ({ ...g, due: now + g.dueInHours * HOUR, notSubmitted: g.notSubmitted || [] })),
  };
}

export async function loadDeadlines({ force = false } = {}) {
  const r = await load("deadlines", async () => {
    const courses = await fetchCourses();
    const rows = await fetchDeadlines(courses);
    return {
      assignments: rows.map((d, i) => ({ id: "d" + i, course: d.course, courseName: d.course, title: d.name, due: Date.parse(d.due) || null, submitted: false, url: "" })),
      grading: [],
    };
  }, force ? { maxAgeMs: 0 } : undefined);
  if (r.sample) r.data = fromSample(r.data);
  return r;
}

/** HomeViewModel.resolveDeadlineSummary: submitted work is never pressure. */
export function deadlineSummary(list, now = Date.now()) {
  const outstanding = list.filter((d) => !d.submitted);
  const pending = outstanding.filter((d) => d.due != null && d.due >= now);
  const overdue = outstanding.filter((d) => d.due != null && d.due < now).length;
  const soon = pending.filter((d) => d.due - now <= 48 * HOUR).length;
  if (overdue > 0 && soon > 0) return { text: `${overdue} overdue · ${soon} due within 48h`, urgent: true };
  if (overdue > 0) return { text: `${overdue} assignment${overdue === 1 ? "" : "s"} overdue`, urgent: true };
  if (soon > 0) return { text: `${soon} due within 48h`, urgent: true };
  if (pending.length) return { text: `${pending.length} upcoming, nothing urgent`, urgent: false };
  return { text: "No assignments due", urgent: false };
}

/* ── DeadlineUi rules (DeadlinesViewModel.kt) ── */
export const STATUS = {
  OVERDUE: "OVERDUE", DUE_TODAY: "DUE_TODAY", DUE_SOON: "DUE_SOON", UPCOMING: "UPCOMING", SUBMITTED: "SUBMITTED", UNKNOWN: "UNKNOWN",
};

const dayKey = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(ms));

export function statusAt(d, now = Date.now()) {
  if (d.submitted) return STATUS.SUBMITTED;
  if (d.due == null) return STATUS.UNKNOWN;
  if (d.due < now) return STATUS.OVERDUE;
  if (dayKey(d.due) === dayKey(now)) return STATUS.DUE_TODAY;
  if (d.due - now <= 48 * HOUR) return STATUS.DUE_SOON;
  return STATUS.UPCOMING;
}

/** "in 3h 5m", "2 days late", … (null when there is no date or it is submitted). */
export function countdownText(d, now = Date.now()) {
  if (d.due == null || d.submitted) return null;
  const diff = d.due - now;
  const absMin = Math.floor(Math.abs(diff) / 60000);
  const days = Math.floor(absMin / 1440), hours = Math.floor((absMin % 1440) / 60), mins = absMin % 60;
  const plural = (n) => `${n} day${n === 1 ? "" : "s"}`;
  if (diff < 0) {
    if (days >= 1) return `${plural(days)} late`;
    if (hours >= 1) return `${hours}h ${mins}m late`;
    return `${mins}m late`;
  }
  if (days >= 1) return `in ${plural(days)}`;
  if (hours >= 1) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Tue, 27 Oct · 6:00 PM" — the app's dueFormat pattern. */
export function dueFormat(ms) {
  const d = new Date(ms);
  const h = d.getHours() % 12 || 12;
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} · ${h}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
}
