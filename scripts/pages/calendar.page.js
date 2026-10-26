/**
 * pages/calendar.page.js — Calendar (ui/calendar/CalendarScreen.kt): the
 * academic week, one card per day with its events, week navigation, course
 * codes and an .ics export.
 *
 * The campus calendar cannot be read from another website, so the week comes
 * from the made-up sample. The course codes filter that sample, and the .ics
 * file is built in the browser from the week on screen.
 */

import { prefs } from "../core/prefs.js";
import { esc, on, addDays, isoDay, MONTH_NAMES, DAY_NAMES } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, browserNote, sampleBanner, extLink, errorCard, loading, textField } from "../ui/components.js";
import { dialog, snackbar } from "../ui/overlay.js";
import { loadAcademic, weekStart, eventsForWeek } from "../data/academic.data.js";

const CALENDAR_PAGE = "https://www.iiserkol.ac.in/web/academic/academic-calendar";
const COURSES_HELP = "Enter course codes separated by commas (e.g. CH4202, CS4201, LS4211).";
const MON = MONTH_NAMES.map((m) => m.slice(0, 3));

const parseCodes = (s) => String(s || "").split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);

export async function render(el) {
  let offset = 0;
  let data = null;
  el.innerHTML = screen({
    bar: topBar({
      title: "Calendar",
      actions: [
        iconBtn("edit", "Edit courses", { "data-act": "courses" }),
        iconBtn("event", "Export .ics", { "data-act": "ics" }),
        iconBtn("refresh", "Refresh", { "data-act": "refresh" }),
      ].join(""),
    }),
    body: `<div id="cal-body">${loading("Loading calendar...")}</div>`,
  });
  const body = el.querySelector("#cal-body");
  try { data = (await loadAcademic()).data; }
  catch (e) { body.innerHTML = errorCard(e.message || "No calendar data available.", { retry: true }); return; }

  const courses = () => {
    const saved = parseCodes(prefs.get("calendar.courses"));
    return saved.length ? saved : null;
  };
  const weekDays = () => {
    const mon = addDays(weekStart(new Date()), offset * 7);
    return { mon, days: Array.from({ length: 7 }, (_, i) => addDays(mon, i)) };
  };

  const paint = () => {
    const { mon, days } = weekDays();
    const sun = days[6];
    const label = `${mon.getDate()} ${MON[mon.getMonth()]} – ${sun.getDate()} ${MON[sun.getMonth()]} ${sun.getFullYear()}`;
    const events = eventsForWeek(data, mon, { today: new Date(), courses: courses() });
    const codeIndex = new Map();
    for (const e of events) if (e.code && !codeIndex.has(e.code)) codeIndex.set(e.code, codeIndex.size % 8);
    const todayKey = isoDay(new Date());
    body.innerHTML = `
      ${sampleBanner("the campus calendar")}
      ${browserNote({
        icon: "info", tone: "info", title: "Sample week",
        body: "On the Android app this reads the campus academic calendar for the course codes you enter. Here the week is a made-up sample, filtered to those codes.",
        extra: `<p>${extLink("Open the academic calendar", CALENDAR_PAGE)}</p>`,
      })}
      <div class="card card--variant cal-nav">
        <button class="icon-btn" type="button" data-act="prev" aria-label="Previous week">${icon("chevron_left")}</button>
        <span class="cal-nav__label">${esc(label)}</span>
        <button class="icon-btn" type="button" data-act="next" aria-label="Next week">${icon("chevron_right")}</button>
      </div>
      ${offset !== 0 ? `<div class="row-between"><span class="t-label-m c-muted">Showing another week</span><button class="btn btn--text btn--sm" type="button" data-act="today">Back to this week</button></div>` : ""}
      <div class="cal-days">${days.map((d) => {
        const key = isoDay(d);
        const today = key === todayKey;
        const evs = events.filter((e) => isoDay(e.date) === key);
        return `<section class="cal-day${today ? " cal-day--today" : ""}">
          <h2 class="cal-day__title">${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}</h2>
          ${evs.length ? `<div class="stack-xs">${evs.map((e) => {
            const c = e.code ? codeIndex.get(e.code) : null;
            return `<div class="cal-event cal-event--${c == null ? "none" : "c" + c}${e.category === "holiday" ? " cal-event--holiday" : ""}">
              <span class="cal-event__bar"></span>
              <span class="cal-event__text">
                <span class="t-title-s w-bold">${esc(e.code || e.title)}</span>
                ${e.code ? `<span class="t-label-m c-muted">${esc(e.title)}${e.tutorial ? " (Tut)" : ""}</span>` : ""}
                ${e.venue ? `<span class="t-label-m c-muted">${icon("place", { size: 14 })}${esc(e.venue)}</span>` : ""}
              </span>
              <span class="cal-event__time">${e.start ? esc(e.start) : "All day"}</span>
            </div>`;
          }).join("")}</div>` : `<p class="t-body-m c-muted cal-none">No events scheduled</p>`}
        </section>`;
      }).join("")}</div>`;
  };

  on(el, "click", "[data-act=prev]", () => { offset -= 1; paint(); });
  on(el, "click", "[data-act=next]", () => { offset += 1; paint(); });
  on(el, "click", "[data-act=today]", () => { offset = 0; paint(); });
  on(el, "click", "[data-act=refresh]", () => paint());

  on(el, "click", "[data-act=courses]", async () => {
    let field = null;
    const v = await dialog({
      title: "Course Calendars",
      body: `<p class="t-body-s">${esc(COURSES_HELP)}</p>${textField({ id: "cal-courses", label: "Course codes", value: (prefs.get("calendar.courses") || ""), multiline: true, rows: 2, cls: "mt-sm" })}`,
      onMount: (d) => { field = d.querySelector("#cal-courses"); },
      actions: [
        { label: "Cancel", value: null, variant: "text" },
        { label: "Apply", value: "apply", variant: "text", primary: true },
      ],
    });
    if (v !== "apply" || !field) return;
    const codes = parseCodes(field.value).join(", ");
    prefs.set("calendar.courses", codes);
    paint();
    snackbar(codes ? `Showing ${codes} on the sample week.` : "Showing every sample event.");
  });

  on(el, "click", "[data-act=ics]", () => {
    const { mon } = weekDays();
    const events = eventsForWeek(data, mon, { today: new Date(), courses: courses() });
    const stamp = (d, t) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${t ? "T" + t.replace(":", "") + "00" : ""}`;
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//IISERKonnect Web//Sample Calendar//EN", "CALSCALE:GREGORIAN"];
    events.forEach((e, i) => {
      const startT = e.start ? e.start.padStart(5, "0") : null;
      const endT = e.end ? e.end.padStart(5, "0") : null;
      lines.push("BEGIN:VEVENT", `UID:sample-${stamp(e.date)}-${i}@iiserkonnect.web`, `DTSTAMP:${stamp(new Date())}T000000Z`);
      if (startT) { lines.push(`DTSTART:${stamp(e.date, startT)}`, `DTEND:${stamp(e.date, endT || startT)}`); }
      else lines.push(`DTSTART;VALUE=DATE:${stamp(e.date)}`);
      lines.push(`SUMMARY:${(e.code ? e.code + " " : "") + e.title}`.replace(/[,;]/g, " "));
      if (e.venue) lines.push(`LOCATION:${e.venue.replace(/[,;]/g, " ")}`);
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "calendar.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    snackbar(`Exported ${events.length} sample events as calendar.ics.`);
  });

  paint();
}
