/**
 * pages/attendance.page.js — Attendance (ui/attendance/AttendanceScreen.kt).
 *
 * Overall card, then one expandable card per course with its sessions, newest
 * first. Live where WeLearn can be reached (the Moodle attendance modules),
 * otherwise labelled sample data.
 */

import { esc, on } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, sampleBanner, errorCard, loading, linearProgress } from "../ui/components.js";
import { loadAttendance, overall, STATUS } from "../data/attendance.data.js";

const tone = (pct) => (pct >= 75 ? "good" : pct >= 50 ? "warn" : "bad");
const fmt1 = (n) => String(Math.floor(n));

const ring = (pct) => {
  const c = 2 * Math.PI * 20;
  return `<span class="att-ring att-tone--${tone(pct)}" aria-hidden="true"><svg viewBox="0 0 48 48">
    <circle class="att-ring__track" cx="24" cy="24" r="20" fill="none" stroke-width="4"/>
    <circle class="att-ring__fill" cx="24" cy="24" r="20" fill="none" stroke-width="4" stroke-linecap="round"
      stroke-dasharray="${((pct / 100) * c).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 24 24)"/></svg>
    <span class="att-ring__label">${fmt1(pct)}%</span></span>`;
};

const statusChip = (st) => {
  const s = STATUS[st] || STATUS.Unknown;
  return `<span class="att-st att-st--${s.tone}" title="${esc(s.label)}">${esc(s.short)}</span>`;
};

function summaryCard(o, lastFetched) {
  return `<div class="card card--high att-overall att-tone--${tone(o.percentage)}-bg">
    <div class="row">
      <span class="att-overall__icon">${icon("check_circle", { size: 28 })}</span>
      <div class="grow">
        <div class="t-title-m w-semi">Overall Attendance</div>
        <div class="t-body-s c-muted">${o.totalCourses} courses · ${o.totalSessions} sessions</div>
      </div>
      <span class="t-headline-m w-bold att-tone--${tone(o.percentage)}">${Math.floor(o.percentage)}%</span>
    </div>
    ${linearProgress(o.totalSessions ? o.percentage / 100 : 0)}
    <div class="att-legend">
      <span class="att-st--good-txt">Present: ${o.totalPresent}</span>
      <span class="att-st--bad-txt">Absent: ${o.totalAbsent}</span>
      <span class="att-st--warn-txt">Late: ${o.totalLate}</span>
    </div>
  </div>
  ${lastFetched ? `<p class="t-label-s c-muted">Last updated: ${esc(new Date(lastFetched).toLocaleString([], { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" }))}</p>` : ""}`;
}

function courseCard(c, i) {
  const s = c.summary;
  return `<div class="card card--high att-course" data-i="${i}">
    <button class="att-course__head" type="button" data-act="toggle" aria-expanded="false">
      ${ring(s.percentage)}
      <span class="grow att-course__text">
        <span class="t-title-s w-semi att-course__name">${esc(c.courseName)}</span>
        <span class="t-body-s c-muted">${s.totalSessions} sessions · ${s.presentCount}P ${s.absentCount}A ${s.lateCount}L</span>
      </span>
      ${icon("expand_more", { cls: "att-course__chev" })}
    </button>
    ${s.totalSessions ? `<div class="att-course__bar">${linearProgress(s.percentage / 100)}</div>` : ""}
    <div class="att-course__body" hidden>
      ${c.records.length ? [...c.records].reverse().map((r) => `
        <div class="att-rec">
          <span class="att-st-icon att-st--${(STATUS[r.status] || STATUS.Unknown).tone}">${icon((STATUS[r.status] || STATUS.Unknown).icon, { size: 20 })}</span>
          <span class="grow att-rec__text">
            <span class="t-body-s w-semi">${esc(r.date)}</span>
            ${r.time ? `<span class="t-label-s c-muted">${esc(r.time)}</span>` : ""}
            ${r.description ? `<span class="t-label-s c-muted ellipsis">${esc(r.description)}</span>` : ""}
          </span>
          ${statusChip(r.status)}
          ${r.points ? `<span class="t-label-s c-muted">${esc(r.points)}</span>` : ""}
        </div>`).join("")
        : `<div class="att-rec"><span class="t-body-s c-muted">${icon("info", { size: 16 })} No sessions recorded yet</span></div>`}
    </div>
  </div>`;
}

export async function render(el) {
  el.innerHTML = screen({
    bar: topBar({ title: "Attendance", actions: iconBtn("refresh", "Refresh", { "data-act": "refresh" }) }),
    body: `<div id="att-body">${loading("Scanning courses for attendance...")}<p class="t-label-m c-muted att-wait">This may take a moment</p></div>`,
  });
  const body = el.querySelector("#att-body");

  const load = async (force) => {
    body.innerHTML = `${linearProgress()}${loading("Scanning courses for attendance...")}`;
    let r;
    try { r = await loadAttendance({ force }); }
    catch (e) { body.innerHTML = errorCard(e.message || "Failed to fetch attendance", { retry: true }); return; }
    const courses = r.data.courses || [];
    if (!courses.length) {
      body.innerHTML = errorCard("No attendance modules found in your enrolled courses.", { retry: true });
      return;
    }
    body.innerHTML = `
      ${r.sample ? sampleBanner("WeLearn") : ""}
      ${summaryCard(overall(courses), r.sample ? null : r.cachedAt)}
      <div class="stack-sm att-list">${courses.map(courseCard).join("")}</div>
      <div class="att-end"></div>`;
  };

  on(el, "click", "[data-act=refresh],[data-act=retry]", () => load(true));
  on(el, "click", "[data-act=toggle]", (e, b) => {
    const bodyEl = b.parentElement.querySelector(".att-course__body");
    const open = bodyEl.hidden;
    bodyEl.hidden = !open;
    b.setAttribute("aria-expanded", String(open));
    b.querySelector(".att-course__chev").classList.toggle("is-open", open);
  });
  await load(false);
}
