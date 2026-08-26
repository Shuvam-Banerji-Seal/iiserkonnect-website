/** pages/calendar.page.js — academic week + campus events (two tabs). */

import { buildCalendarUrl, fetchAcademicWeek, fetchEventsWeek } from "../services/calendar.service.js";
import { store } from "../core/store.js";
import { pageHead, esc, errorState, requireProxy } from "../ui/helpers.js";

export async function render(el) {
  el.innerHTML = pageHead("Calendar", "Week views", "Academic timetable and campus events — navigable week by week.");
  const proxy = await requireProxy();
  if (!proxy.ok) return el.insertAdjacentHTML("beforeend", proxy.html);

  const mount = document.createElement("div");
  el.appendChild(mount);
  mount.innerHTML = `
    <div class="tabbar">
      <button class="tab active" data-tab="academic">Academic</button>
      <button class="tab" data-tab="events">Campus events</button>
    </div>
    <div id="cal-body"></div>`;
  const body = mount.querySelector("#cal-body");
  const show = (tab) => tab === "academic" ? showAcademic(body) : showEvents(body);
  mount.querySelectorAll(".tab").forEach((b) => b.onclick = () => {
    mount.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    b.classList.add("active"); show(b.dataset.tab);
  });
  show("academic");
}

async function showAcademic(body) {
  body.innerHTML = `<div class="page-loading"><span class="spinner"></span> Loading week…</div>`;
  const courses = (store.get("calendarCourses") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const url = store.get("calUrl") || buildCalendarUrl(courses);
  try {
    const week = await fetchAcademicWeek(url);
    store.set("calUrl", url);
    body.innerHTML = weekHtml(week, renderAcademicGrid);
    wireNav(body, week, showAcademic);
  } catch (e) { body.innerHTML = errorState(e.message, "calendar"); }
}

function renderAcademicGrid(week) {
  const hours = [...new Set(week.events.map((e) => e.hour).filter((h) => h != null))].sort((a, b) => a - b);
  if (!hours.length) return `<p class="body-muted">No classes this week.</p>`;
  return `<div class="weekgrid" style="grid-template-columns:56px repeat(${week.days.length},1fr)">
    <div></div>${week.days.map((d) => `<div class="weekgrid__day ${d.today ? "today" : ""}">${esc(d.day)}<span>${esc(d.date)}</span></div>`).join("")}
    ${hours.map((h) => `
      <div class="weekgrid__hour">${h}:00</div>
      ${week.days.map((_, di) => {
        const evs = week.events.filter((e) => e.day === di && e.hour === h);
        return `<div class="weekgrid__cell">${evs.map((e) => `
          <div class="weekevt ${e.tutorial ? "tut" : ""}" title="${esc(e.venue)}">
            <strong>${esc(e.title)}</strong>${e.venue ? `<span>${esc(e.venue)}</span>` : ""}
          </div>`).join("")}</div>`;
      }).join("")}`).join("")}
  </div>`;
}

async function showEvents(body) {
  body.innerHTML = `<div class="page-loading"><span class="spinner"></span> Loading events…</div>`;
  const url = store.get("evtUrl") || "https://calendar.iiserkol.ac.in/calendar_view/";
  try {
    const week = await fetchEventsWeek(url);
    store.set("evtUrl", url);
    body.innerHTML = weekHtml(week, (w) => w.events.length ? `
      <div class="event-list">
        ${w.events.map((e) => `
          <div class="app-card event-card">
            <div class="event-card__when">
              <strong>${esc(w.days[e.day]?.day || "")}</strong>
              <span>${esc(e.time || e.timeRange || "all day")}</span>
            </div>
            <div class="event-card__body">
              <strong>${esc(e.title)}</strong>
              ${e.venue ? `<span class="body-muted small">📍 ${esc(e.venue)}</span>` : ""}
              ${e.description ? `<p class="small body-muted">${esc(e.description)}</p>` : ""}
              ${e.category ? `<span class="chip">${esc(e.category)}</span>` : ""}
            </div>
          </div>`).join("")}
      </div>` : `<p class="body-muted">No events this week.</p>`);
    wireNav(body, week, showEvents);
  } catch (e) { body.innerHTML = errorState(e.message, "calendar"); }
}

function weekHtml(week, gridRenderer) {
  return `
    <div class="row-between" style="margin-bottom:14px">
      <strong>${esc(week.monthLabel)}</strong>
      <span class="row-gap">
        ${week.prev ? `<a class="btn btn--ghost btn--sm" data-nav-url="${esc(week.prev)}" href="#">← Prev</a>` : ""}
        ${week.next ? `<a class="btn btn--ghost btn--sm" data-nav-url="${esc(week.next)}" href="#">Next →</a>` : ""}
      </span>
    </div>
    ${gridRenderer(week)}`;
}

function wireNav(body, week, rerender) {
  body.querySelectorAll("[data-nav-url]").forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      const url = a.dataset.navUrl;
      if (url.includes("view_mode=week") || url.includes("calendar_view/2")) {
        if (store.get("calUrl")) store.set("calUrl", url);
        if (store.get("evtUrl") && !url.includes("view_mode")) store.set("evtUrl", url);
      }
      rerender(body);
    };
  });
}
