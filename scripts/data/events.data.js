/**
 * data/events.data.js — the institute's Event Calendar (campus events), one
 * week at a time, as agenda-ready entries.
 *
 * Model: { weekLabel, events: [{ id, title, start (ms), end (ms|null), venue,
 *          category, description, allDay }] }
 * Sample events carry dayOffset (0 = today) and "HH:MM" times so they always
 * fall in the current week.
 */

import { load } from "../services/source.js";
import { fetchEventsWeek } from "../services/calendar.service.js";

const at = (dayOffset, hhmm) => {
  const n = new Date();
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() + dayOffset, h, m).getTime();
};

function fromSample(s) {
  return {
    weekLabel: weekLabel(new Date()),
    events: s.events.map((e) => ({
      id: e.id, title: e.title, start: at(e.dayOffset, e.start), end: e.end ? at(e.dayOffset, e.end) : null,
      venue: e.venue || "", category: e.category || "", description: e.description || "", allDay: !!e.allDay, organiser: e.organiser || "",
    })).sort((a, b) => a.start - b.start),
  };
}

function weekLabel(d) {
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const M = (x) => x.toLocaleString("en-GB", { month: "long" });
  return `${M(mon)} ${mon.getDate()} – ${mon.getMonth() === sun.getMonth() ? "" : M(sun) + " "}${sun.getDate()}, ${sun.getFullYear()}`;
}

function fromLive(w) {
  const now = new Date();
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return {
    weekLabel: w.monthLabel || weekLabel(now),
    events: (w.events || []).map((e) => {
      const day = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + (e.day >= 0 ? e.day : 0));
      const [h, m] = (e.time || `${e.hour >= 0 ? e.hour : 0}:00`).split(":").map(Number);
      const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).getTime();
      return { id: e.id, title: e.title, start, end: null, venue: e.venue || "", category: e.category || "", description: e.description || "", allDay: false };
    }).sort((a, b) => a.start - b.start),
  };
}

export async function loadCampusEvents() {
  const r = await load("events", async () => fromLive(await fetchEventsWeek()));
  if (r.sample) r.data = fromSample(r.data);
  return r;
}

/** As agenda entries (productivity/logic.js `agenda`). */
export const toAgenda = (events) => events.map((e) => ({
  key: `campus:${e.id}:${e.start}`, source: "CAMPUS", title: e.title, start: e.start, end: e.end, allDay: e.allDay, location: e.venue, details: e.description,
}));
