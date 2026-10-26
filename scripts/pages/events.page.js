/**
 * pages/events.page.js — Event Calendar (ui/events/CampusEventsScreen.kt).
 *
 * One week at a time: a day-by-hour grid (08:00–20:00 rows, Monday first, an
 * all-day row when needed), week navigation, and a detail sheet with
 * "Add to My Calendar". Events outside the grid hours are still listed below
 * the grid, so nothing is hidden on the web.
 *
 * Campus data comes from data/events.data.js (live calendar, else samples).
 */

import { collection, newId } from "../core/db.js";
import { esc, on, timeOf, isoDay, DAY_NAMES, MONTH_NAMES, sameDay } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, button, listItem, loading, errorCard, emptyState, sampleBanner } from "../ui/components.js";
import { sheet, toast } from "../ui/overlay.js";
import { loadCampusEvents } from "../data/events.data.js";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);   // 8..20
const CATEGORY_COLOURS = {
  seminar: "#1976D2", meeting: "#388E3C", class_test: "#E64A19",
  holiday: "#00897B", exam: "#C62828", workshop: "#6A1B9A",
};
const colourOf = (c) => CATEGORY_COLOURS[c] || "#7B1FA2";
const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, "_") : "");

const monday = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
const dayAt = (mon, n) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + n);
const shortMonthDay = (d) => `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;

function weekInfo(offset) {
  const mon = dayAt(monday(new Date()), offset * 7);
  const sun = dayAt(mon, 6);
  const days = Array.from({ length: 7 }, (_, i) => dayAt(mon, i));
  const label = mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()} – ${sun.getDate()} ${MONTH_NAMES[mon.getMonth()]} ${sun.getFullYear()}`
    : `${shortMonthDay(mon)} – ${shortMonthDay(sun)}, ${sun.getFullYear()}`;
  return {
    mon, label,
    headers: days.map((d, i) => ({ dayName: DAY_NAMES[d.getDay()].slice(0, 3), dateLabel: shortMonthDay(d), isToday: sameDay(d, new Date()), date: d, idx: i })),
    end: dayAt(mon, 7).getTime(),
  };
}

const dayIndex = (ms, mon) => Math.floor((new Date(ms).setHours(0, 0, 0, 0) - mon.getTime()) / 86400000 + 1e-6);
const timeRange = (e) => (e.end ? `${timeOf(new Date(e.start))}–${timeOf(new Date(e.end))}` : timeOf(new Date(e.start)));

function chipHtml(e, i) {
  return `<button type="button" class="cal-chip" style="--c:${colourOf(e.category)}" data-act="open" data-i="${i}">
    <span class="cal-chip__time">${esc(timeOf(new Date(e.start)))}</span>
    <span class="cal-chip__title">${esc(e.title)}</span>
    ${e.venue ? `<span class="cal-chip__venue">📍 ${esc(e.venue)}</span>` : ""}
  </button>`;
}

function gridHtml(week, events) {
  const inWeek = events.map((e, i) => ({ e, i })).filter(({ e }) => e.start >= week.mon.getTime() && e.start < week.end);
  const allDay = inWeek.filter(({ e }) => e.allDay);
  const timed = inWeek.filter(({ e }) => !e.allDay);
  const cell = (list) => list.map(({ e, i }) => chipHtml(e, i)).join("");
  const at = (day, hour) => timed.filter(({ e }) => dayIndex(e.start, week.mon) === day && new Date(e.start).getHours() === hour);
  const rowHeight = (hour) => {
    const max = Math.max(1, ...Array.from({ length: 7 }, (_, d) => at(d, hour).length));
    return Math.max(80, max * 52 + 12);
  };
  const head = `<div class="cal-gutter"></div>` + week.headers.map((h) =>
    `<div class="cal-day${h.isToday ? " cal-day--today" : ""}"><span class="cal-day__name">${esc(h.dayName)}</span><span class="cal-day__date">${esc(h.dateLabel)}</span></div>`).join("");
  const allRow = allDay.length
    ? `<div class="cal-gutter cal-gutter--label">All Day</div>` + Array.from({ length: 7 }, (_, d) =>
        `<div class="cal-cell">${cell(allDay.filter(({ e }) => dayIndex(e.start, week.mon) === d))}</div>`).join("")
    : "";
  const rows = HOURS.map((h) => `<div class="cal-gutter cal-gutter--hour">${h}:00</div>` +
    Array.from({ length: 7 }, (_, d) => `<div class="cal-cell" style="min-height:${rowHeight(h)}px">${cell(at(d, h))}</div>`).join("")).join("");
  return `<div class="cal-scroll"><div class="cal-grid">${head}${allRow}${rows}</div></div>`;
}

function listHtml(week, events) {
  const inWeek = events.map((e, i) => ({ e, i })).filter(({ e }) => e.start >= week.mon.getTime() && e.start < week.end)
    .sort((a, b) => a.e.start - b.e.start);
  if (!inWeek.length) return "";
  return `<h2 class="list-heading">All events this week</h2><div class="list cal-list">${inWeek.map(({ e, i }) => listItem({
    headline: e.title,
    supporting: `${DAY_NAMES[new Date(e.start).getDay()]} · ${e.allDay ? "All day" : timeRange(e)}${e.venue ? " · " + e.venue : ""}`,
    leading: `<span class="cal-dot" style="--c:${colourOf(e.category)}"></span>`,
    a: { "data-act": "open", "data-i": i },
  })).join("")}</div>`;
}

function icsText(e) {
  const fmt = (ms, allDay) => {
    const d = new Date(ms);
    const p = (n) => String(n).padStart(2, "0");
    return allDay ? `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
      : `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
  };
  const txt = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const end = e.end || e.start + 3600000;
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//IISERKonnect web//EN", "BEGIN:VEVENT",
    `UID:${e.id}@iiserkonnect-web`, `DTSTAMP:${fmt(Date.now())}`,
    e.allDay ? `DTSTART;VALUE=DATE:${fmt(e.start, true)}` : `DTSTART:${fmt(e.start)}`,
    e.allDay ? `DTEND;VALUE=DATE:${fmt(end, true)}` : `DTEND:${fmt(end)}`,
    `SUMMARY:${txt(e.title)}`, e.venue ? `LOCATION:${txt(e.venue)}` : "", e.description ? `DESCRIPTION:${txt(e.description)}` : "",
    "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
}

function saveIcs(e) {
  const url = URL.createObjectURL(new Blob([icsText(e)], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${(e.title || "event").replace(/[^\w-]+/g, "_")}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function addToMyCalendar(e) {
  const mine = await collection("events").all();
  if (mine.some((r) => r.title === e.title && r.startMillis === e.start)) return toast("It is already in My Calendar.");
  try {
    await collection("events").put({
      id: newId(), title: e.title, location: e.venue || "", notes: e.description || "",
      startMillis: e.start, endMillis: e.end || e.start + 3600000, allDay: !!e.allDay,
      repeatRule: "NONE", remindMinutesBefore: 15, createdAtMillis: Date.now(),
    });
    toast("Added to My Calendar.");
  } catch {
    toast("It could not be added to My Calendar.");
  }
}

function detailBody(e) {
  return `
    ${e.category ? `<p class="cal-sheet__cat" style="color:${colourOf(e.category)}">${esc(capitalise(e.category))}</p>` : ""}
    <h3 class="cal-sheet__title">${esc(e.title)}</h3>
    <div class="cal-sheet__rows">
      <p>⏰ ${esc(e.allDay ? "All day" : timeRange(e))}</p>
      ${e.venue ? `<p>📍 ${esc(e.venue)}</p>` : ""}
      ${e.description ? `<p class="c-muted">📝 ${esc(e.description)}</p>` : ""}
    </div>
    <div class="cal-sheet__actions">
      ${button("Add to My Calendar", { variant: "tonal", icon: "event_available", attrs: { "data-act": "add" } })}
      ${button("Save .ics file", { variant: "outlined", icon: "download", attrs: { "data-act": "ics" } })}
    </div>
    <p class="fineprint">Reminders and the phone calendar app are not available in this browser. The .ics file opens in most calendar apps.</p>`;
}

export async function render(el) {
  let week = weekInfo(0);
  let offset = 0;
  let data = null;

  const paint = () => {
    const weekEvents = offset === 0 ? data.events : [];
    const body = `
      ${data.sample ? sampleBanner("the campus calendar") : ""}
      ${data.stale ? `<p class="fineprint">Last updated from the campus calendar.</p>` : ""}
      <p class="cal-hint">Tap event to open</p>
      <div class="cal-weeknav">
        ${iconBtn("chevron_left", "Previous week", { "data-act": "prev" })}
        <span class="cal-weeknav__label">${esc(week.label)}</span>
        ${iconBtn("chevron_right", "Next week", { "data-act": "next" })}
      </div>
      ${offset !== 0 ? `<p class="fineprint">Only the current week is available in this browser.</p>` : ""}
      ${weekEvents.length || offset !== 0 ? gridHtml(week, weekEvents) : `<p class="cal-empty">No events this week</p>`}
      ${listHtml(week, weekEvents)}`;
    el.querySelector(".screen__body").innerHTML = body;
  };

  const bar = topBar({ title: "Event Calendar", actions: iconBtn("refresh", "Refresh", { "data-act": "refresh" }) });
  el.innerHTML = screen({ bar, body: loading("Loading events..."), wide: true });

  const load = async () => {
    el.querySelector(".screen__body").innerHTML = loading("Loading events...");
    try {
      const r = await loadCampusEvents();
      data = { events: r.data.events, sample: r.sample, stale: r.stale };
      paint();
    } catch (err) {
      el.querySelector(".screen__body").innerHTML = errorCard(err.message || "Network error", { retry: true });
    }
  };

  on(el, "click", "[data-act=prev]", () => { offset -= 1; week = weekInfo(offset); paint(); });
  on(el, "click", "[data-act=next]", () => { offset += 1; week = weekInfo(offset); paint(); });
  on(el, "click", "[data-act=refresh]", () => { week = weekInfo(offset); load(); });
  on(el, "click", "[data-act=retry]", () => load());

  on(el, "click", "[data-act=open]", (ev, btn) => {
    const e = data.events[+btn.dataset.i];
    if (!e) return;
    const s = sheet({
      title: "",
      body: detailBody(e),
      onMount: (d) => {
        d.querySelector("[data-act=add]").addEventListener("click", () => addToMyCalendar(e));
        d.querySelector("[data-act=ics]").addEventListener("click", () => saveIcs(e));
      },
    });
    // ensure a Close button closes the sheet
    const close = document.createElement("button");
    close.type = "button"; close.className = "btn btn--text sheet__close"; close.textContent = "Close";
    close.addEventListener("click", () => s.close());
    s.el.querySelector(".sheet__body").appendChild(close);
  });

  await load();
  return () => {};
}
