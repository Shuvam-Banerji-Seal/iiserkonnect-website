/**
 * pages/schedule.page.js — Class Schedule (ui/schedule/ClassScheduleScreen.kt).
 *
 * The Android app shows the official timetable PDF. A browser cannot read it
 * from the campus site, so this shows a made-up weekly timetable with the same
 * week navigation, today highlighted, and a link to the official page.
 */

import { esc, on, addDays, isoDay, MONTH_NAMES } from "../ui/dom.js";
import { icon, topBar, screen, browserNote, sampleBanner, extLink, errorCard, loading } from "../ui/components.js";
import { loadTimetable, hm } from "../data/schedule.data.js";
import { weekStart } from "../data/academic.data.js";

const OFFICIAL = "https://www.iiserkol.ac.in/web/en/student-activities/time-table";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export async function render(el) {
  let offset = 0;
  const today = new Date();

  el.innerHTML = screen({
    bar: topBar({
      title: "Class Schedule",
      actions: [
        `<a class="icon-btn" href="${esc(OFFICIAL)}" target="_blank" rel="noopener noreferrer" aria-label="Open in browser" title="Open in browser">${icon("open_in_browser")}</a>`,
        `<button class="icon-btn" type="button" data-act="refresh" aria-label="Refresh" title="Refresh">${icon("refresh")}</button>`,
      ].join(""),
    }),
    body: `<div id="tt-body">${loading("Loading timetable...")}</div>`,
  });
  const body = el.querySelector("#tt-body");

  let r;
  try { r = await loadTimetable(); }
  catch (e) { body.innerHTML = errorCard(e.message || "Failed to load timetable"); return; }
  const slots = r.data.slots || [];

  const paint = () => {
    const mon = addDays(weekStart(new Date(today.getFullYear(), today.getMonth(), today.getDate())), offset * 7);
    const fri = addDays(mon, 4);
    const todayKey = isoDay(today);
    const label = `${mon.getDate()} ${MONTH_NAMES[mon.getMonth()].slice(0, 3)} – ${fri.getDate()} ${MONTH_NAMES[fri.getMonth()].slice(0, 3)} ${fri.getFullYear()}`;
    body.innerHTML = `
      ${r.sample ? sampleBanner("the official timetable") : ""}
      ${browserNote({
        icon: "info", tone: "info", title: "Official timetable",
        body: "On the Android app this downloads the official timetable PDF and shows it page by page. A browser cannot read that PDF from the campus site, so the week below is a made-up example.",
        extra: `<p>${extLink("Open the official timetable", OFFICIAL)}</p>`,
      })}
      <div class="card card--variant tt-week">
        <button class="icon-btn" type="button" data-act="prev" aria-label="Previous week">${icon("chevron_left")}</button>
        <span class="tt-week__label">${esc(label)}</span>
        <button class="icon-btn" type="button" data-act="next" aria-label="Next week">${icon("chevron_right")}</button>
      </div>
      ${offset !== 0 ? `<div class="row-between tt-jump"><span class="t-label-m c-muted">Showing another week</span><button class="btn btn--text btn--sm" type="button" data-act="today">Back to this week</button></div>` : ""}
      <div class="tt-days">${[1, 2, 3, 4, 5].map((day) => {
        const date = addDays(mon, day - 1);
        const isToday = isoDay(date) === todayKey;
        const items = slots.filter((s) => s.day === day).sort((a, b) => hm(a.start) - hm(b.start));
        return `<section class="tt-day${isToday ? " tt-day--today" : ""}" aria-label="${DAYS[day - 1]}">
          <header class="tt-day__head">
            <span class="tt-day__name">${SHORT[day - 1]}</span>
            <span class="tt-day__date">${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}</span>
            ${isToday ? `<span class="pill pill--primary">Today</span>` : ""}
          </header>
          ${items.length ? items.map((s) => `
            <article class="tt-slot tt-slot--${(s.type || "lecture").toLowerCase()}">
              <span class="tt-slot__time">${esc(s.start)} – ${esc(s.end)}</span>
              <span class="tt-slot__code">${esc(s.code)}</span>
              <span class="tt-slot__title">${esc(s.title)}</span>
              <span class="tt-slot__room">${icon("place", { size: 14 })}${esc(s.room)}</span>
            </article>`).join("") : `<p class="t-body-s c-muted tt-free">No classes</p>`}
        </section>`;
      }).join("")}</div>`;
  };

  on(el, "click", "[data-act=prev]", () => { offset -= 1; paint(); });
  on(el, "click", "[data-act=next]", () => { offset += 1; paint(); });
  on(el, "click", "[data-act=today]", () => { offset = 0; paint(); });
  on(el, "click", "[data-act=refresh]", () => paint());
  paint();
}
