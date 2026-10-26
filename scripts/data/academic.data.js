/**
 * data/academic.data.js — academic calendar week (sample only, see
 * schedule.data.js for why). Events are placed on real dates: the weekly
 * template repeats every week, one-off entries are relative to today.
 */

import { load } from "../services/source.js";
import { addDays, startOfDay, isoDay } from "../ui/dom.js";

export const loadAcademic = () => load("academic");

/** Monday of the week containing d. */
export function weekStart(d = new Date()) {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() + 6) % 7));
}

/**
 * Events for the week that starts on `monday` (a Date), optionally only for
 * the course codes in `courses` (codes-less entries such as holidays always
 * stay). Returns [{ date, start, end, code, title, venue, tutorial, category }]
 * sorted by date and start time.
 */
export function eventsForWeek(data, monday, { today = new Date(), courses = null } = {}) {
  const out = [];
  const t0 = startOfDay(today);
  for (const ev of data.weekly) {
    out.push({ ...ev, category: "class", date: addDays(monday, ev.weekday) });
  }
  for (const ev of data.oneOff) {
    const date = addDays(t0, ev.dayOffset);
    if (isoDay(date) >= isoDay(monday) && isoDay(date) <= isoDay(addDays(monday, 6))) out.push({ ...ev, date });
  }
  const want = courses && courses.length ? new Set(courses) : null;
  return out
    .filter((e) => !want || !e.code || want.has(e.code))
    .sort((a, b) => (isoDay(a.date) + a.start).localeCompare(isoDay(b.date) + b.start));
}

/** Course selection: sample only (the choices are saved through the campus sign-in). */
export const loadCourseSelection = () => load("courseselection");

/** { slotIndex: selectedCourseId } from a course selection page. */
export const choiceSelections = (page) => Object.fromEntries(page.choices.map((c) => [c.index, c.selectedCourseId]));
