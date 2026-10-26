/**
 * data/deadlines.data.js — WeLearn assignment deadlines.
 *
 * Model: { assignments: [{ id, course, courseName, title, due (ms|null), submitted, url }] }
 * Samples carry dueInHours so they stay in the future.
 */

import { load } from "../services/source.js";
import { fetchCourses, fetchDeadlines } from "../services/welearn.service.js";

function fromSample(s) {
  const now = Date.now();
  return { assignments: s.assignments.map((a) => ({ ...a, due: a.dueInHours == null ? null : now + a.dueInHours * 3600_000, url: "" })) };
}

export async function loadDeadlines() {
  const r = await load("deadlines", async () => {
    const courses = await fetchCourses();
    const rows = await fetchDeadlines(courses);
    return { assignments: rows.map((d, i) => ({ id: "d" + i, course: d.course, courseName: d.course, title: d.name, due: Date.parse(d.due) || null, submitted: false, url: "" })) };
  });
  if (r.sample) r.data = fromSample(r.data);
  return r;
}

/** HomeViewModel.resolveDeadlineSummary: submitted work is never pressure. */
export function deadlineSummary(list, now = Date.now()) {
  const outstanding = list.filter((d) => !d.submitted);
  const pending = outstanding.filter((d) => d.due != null && d.due >= now);
  const overdue = outstanding.filter((d) => d.due != null && d.due < now).length;
  const soon = pending.filter((d) => d.due - now <= 48 * 3600_000).length;
  if (overdue > 0 && soon > 0) return { text: `${overdue} overdue · ${soon} due within 48h`, urgent: true };
  if (overdue > 0) return { text: `${overdue} assignment${overdue === 1 ? "" : "s"} overdue`, urgent: true };
  if (soon > 0) return { text: `${soon} due within 48h`, urgent: true };
  if (pending.length) return { text: `${pending.length} upcoming, nothing urgent`, urgent: false };
  return { text: "No assignments due", urgent: false };
}
