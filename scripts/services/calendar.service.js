/**
 * services/calendar.service.js — ports of CalendarScraper (academic) and
 * EventCalendarScraper (campus events).
 */

import { get, C } from "../core/net.js";
import { parse, q, qa, text, attr } from "../core/html.js";

/* ── academic calendar ─────────────────────────────────────────── */
export function buildCalendarUrl(courses) {
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const cal = ["academic.calendar", "holiday", ...courses].map((c) => `calendar=${encodeURIComponent(c)}`).join("&");
  return `${C.CALENDAR}/calendar_view/${dateStr}/?view_mode=week&${cal}`;
}

export async function fetchAcademicWeek(url) {
  const page = await get(url);
  const pt = page.text.trim();
  if (pt.startsWith("{")) {
    try {
      const j = JSON.parse(pt);
      if (j.academic) return j.academic;
      const r = await fetch("data/calendar.json", { cache: "no-store" });
      const jd = await r.json();
      if (jd.academic) return jd.academic;
    } catch {}
  }
  const doc = parse(page.text, url);
  const popups = new Map();
  for (const dl of qa(doc, "dl.popup")) {
    const id = dl.id.replace(/^eventinfo-/, "");
    let time = "", venue = "";
    const dts = qa(dl, "dt"), dds = qa(dl, "dd");
    for (let i = 0; i < dts.length; i++) {
      const label = text(dts[i]).toLowerCase();
      const val = dds[i] ? text(dds[i]) : "";
      if (label.startsWith("time")) {
        const [a, b] = val.split(" - ");
        time = { start: (a || "").trim(), end: (b || "").trim() };
      } else if (label.startsWith("venue")) venue = val;
    }
    popups.set(id, { time, venue });
  }
  const days = [];
  for (const th of qa(q(doc, "table.main tr"), "th")) {
    const cls = [...th.classList];
    if (cls.includes("empty")) continue;
    const a = q(th, "a");
    const raw = (a ? a.innerHTML : th.innerHTML).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").trim();
    const [dayName, ...rest] = raw.split(/\s+/);
    days.push({ day: dayName, date: rest.join(" "), today: cls.some((c) => c.includes("today")) });
  }
  const events = [];
  const rows = qa(doc, "table.main tr").slice(2);
  rows.forEach((row) => {
    const hourTh = q(row, "th.row");
    const hour = hourTh ? parseInt(text(hourTh).replace(":00hr", "").replace("hr", "")) : null;
    qa(row, "td").forEach((td, dayIndex) => {
      for (const a of qa(td, "a.entry")) {
        const raw = text(a);
        const [timeStr, ...rest] = raw.split(/\s+/);
        const title = rest.join(" ");
        const tut = title.includes("(Tut)");
        const p = popups.get(a.id);
        events.push({
          id: a.id, title: title.replace("(Tut)", "").trim(), raw: title,
          start: p?.time?.start || timeStr, end: p?.time?.end || "",
          venue: p?.venue || "", day: dayIndex, hour, tutorial: tut,
        });
      }
    });
  });
  return {
    monthLabel: text(q(doc, "div.topnav span.date")),
    days, events,
    prev: attr(q(doc, "a.prev"), "href") ? new URL(attr(q(doc, "a.prev"), "href"), url).href : null,
    next: attr(q(doc, "a.next"), "href") ? new URL(attr(q(doc, "a.next"), "href"), url).href : null,
  };
}

/* ── campus events ─────────────────────────────────────────────── */
export async function fetchEventsWeek(url = C.EVENTS_CAL) {
  const page = await get(url);
  const pt2 = page.text.trim();
  if (pt2.startsWith("{")) {
    try {
      const j = JSON.parse(pt2);
      if (j.events) return j.events;
      const r = await fetch("data/calendar.json", { cache: "no-store" });
      const jd = await r.json();
      if (jd.events) return jd.events;
    } catch {}
  }
  const doc = parse(page.text, url);
  const popups = new Map();
  for (const dl of qa(doc, "dl.popup")) {
    const id = dl.id.replace(/^eventinfo-/, "");
    let time = "", venue = "", desc = "";
    const dts = qa(dl, "dt"), dds = qa(dl, "dd");
    for (let i = 0; i < dts.length; i++) {
      const label = text(dts[i]).replace(/:$/, "").toLowerCase();
      const val = dds[i] ? text(dds[i]) : "";
      if (label.includes("time")) time = val;
      else if (label.includes("venue") || label.includes("location")) venue = val;
      else if (label.includes("desc")) desc = val;
    }
    popups.set(id, { time, venue, desc });
  }
  const dayNames = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const days = [];
  for (const th of qa(q(doc, "table.main tr"), "th")) {
    const cls = [...th.classList];
    if (cls.includes("empty") || cls.includes("row")) continue;
    const a = q(th, "a");
    const raw = (a ? a.innerHTML : th.innerHTML).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").trim();
    const parts = raw.split(/\s+/);
    days.push({ day: parts[0], date: parts.slice(1).join(" "), today: cls.some((c) => c.includes("today")) });
  }
  const events = [];
  for (const row of qa(doc, "table.main tr").slice(1)) {
    const hourTh = q(row, "th.row");
    const hour = hourTh ? parseInt(text(hourTh).replace(":00hr", "").replace("hr", "")) : -1;
    for (const td of qa(row, "td")) {
      const cls = [...td.classList];
      const day = dayNames.findIndex((d) => cls.includes(d));
      if (day < 0) continue;
      const category = cls.find((c) => !dayNames.includes(c) && c !== "today") || "";
      for (const a of qa(td, "a.entry")) {
        const clean = text(a).replace(/\u00a0/g, " ");
        const m = /^(\d{1,2}:\d{2})\s+(.*)$/.exec(clean);
        const p = popups.get(a.id);
        events.push({
          id: a.id, title: m ? m[2] : clean, time: m ? m[1] : "",
          url: attr(a, "href") ? new URL(attr(a, "href"), url).href : "",
          category, day, hour, venue: p?.venue || "", description: p?.desc || "", timeRange: p?.time || "",
        });
      }
    }
  }
  return {
    monthLabel: text(q(doc, "span.date")),
    days, events,
    prev: attr(q(doc, "a.prev"), "href") ? new URL(attr(q(doc, "a.prev"), "href"), url).href : null,
    next: attr(q(doc, "a.next"), "href") ? new URL(attr(q(doc, "a.next"), "href"), url).href : null,
  };
}
