/**
 * pages/grades.page.js — Grade Card (ui/grades/GradeScreen.kt).
 *
 * The campus grade card sits behind a sign-in with a security code, which a
 * browser cannot complete from another website. The screen therefore shows
 * the made-up sample with a note and a link to open the real page. The
 * summary, semester tabs and SGPA/CGPA figures work on that sample.
 */

import { esc, on } from "../ui/dom.js";
import { icon, topBar, screen, tabs, browserNote, sampleBanner, errorCard, loading, extLink } from "../ui/components.js";
import { C } from "../core/net.js";
import { loadGrades, gradeSummary, gradeTone } from "../data/grades.data.js";

const GRADE_CARD = C.WELEARN_MYPROFILE_GRADES;

export async function render(el) {
  el.innerHTML = screen({
    bar: topBar({
      title: "Grade Card",
      actions: `<a class="icon-btn" href="${esc(GRADE_CARD)}" target="_blank" rel="noopener noreferrer" aria-label="Open grade card in WeLearn" title="Open grade card in WeLearn">${icon("open_in_new")}</a>`,
    }),
    body: `<div id="gr-body">${loading("Loading grade card...")}</div>`,
  });
  const body = el.querySelector("#gr-body");

  let semesters = [], active = "summary";
  const drawContent = () => {
    const sum = gradeSummary(semesters);
    const tabList = [{ id: "summary", label: "Summary" }, ...semesters.map((s) => ({ id: String(s.semesterNumber), label: `Sem ${s.semesterNumber}` }))];
    const panel = active === "summary" ? summaryHtml(semesters, sum) : semesterHtml(semesters.find((s) => String(s.semesterNumber) === active));
    body.querySelector("#gr-tabs").innerHTML = tabs(tabList, active, { scroll: true, a: { "aria-label": "Semesters" } });
    body.querySelector("#gr-panel").innerHTML = panel;
  };

  const r = await loadGrades();
  if (!r.data || !(r.data.semesters || []).length) {
    body.innerHTML = errorCard("No grade data available.");
    return;
  }
  semesters = r.data.semesters;
  body.innerHTML = `
    ${r.sample ? sampleBanner("the campus grade card") : ""}
    ${browserNote({
      icon: "lock", tone: "info", title: "Why there is no sign-in here",
      body: "The grade card needs your campus sign-in and a security code. A web page on another site cannot complete that, so the figures below are made up. Open the real grade card in WeLearn to see yours.",
      extra: `<p>${extLink("Open grade card in WeLearn", GRADE_CARD)}</p>`,
    })}
    <div id="gr-tabs" class="gr-tabs"></div>
    <div id="gr-panel" class="gr-panel stack"></div>`;
  drawContent();
  on(el, "click", "[data-tab]", (e, b) => { active = b.dataset.tab; drawContent(); });
}

function summaryHtml(semesters, sum) {
  return `
    <div class="card gr-hero">
      <span class="t-title-m c-muted">Cumulative GPA</span>
      <span class="gr-hero__value">${esc(sum.latestCgpa)}</span>
      <span class="t-body-s c-muted">Latest SGPA: ${esc(sum.latestSgpa)}  •  ${sum.totalCourses} courses</span>
    </div>
    <h2 class="t-title-m c-primary">Semester-wise SGPA</h2>
    <div class="stack-xs">${sum.withCourses.map((s) => {
      const v = parseFloat(s.sgpa) || 0;
      return `<div class="card card--variant gr-sem">
        <span class="t-title-s w-semi gr-sem__label">Sem ${s.semesterNumber}</span>
        <span class="gr-bar"><span style="width:${Math.max(0, Math.min(100, (v / 10) * 100))}%"></span></span>
        <span class="t-title-s w-bold c-primary gr-sem__value">${esc(s.sgpa)}</span>
      </div>`;
    }).join("")}</div>
    <h2 class="t-title-m c-primary">All Courses</h2>
    ${sum.withCourses.map((s) => `
      <h3 class="t-title-s w-semi gr-semhead">Semester ${s.semesterNumber} (SGPA: ${esc(s.sgpa)})</h3>
      <div class="gr-courses">${s.courses.map(courseRow).join("")}</div>`).join("")}`;
}

function semesterHtml(s) {
  if (!s) return "";
  return `
    <div class="card gr-hero gr-hero--row">
      <div class="gr-stat"><span class="t-label-m c-muted">SGPA</span><span class="t-headline-s w-bold c-primary">${esc(s.sgpa)}</span></div>
      <div class="gr-stat"><span class="t-label-m c-muted">CGPA</span><span class="t-headline-s w-bold c-primary">${esc(s.cgpa)}</span></div>
      <div class="gr-stat"><span class="t-label-m c-muted">Courses</span><span class="t-headline-s w-bold c-primary">${s.courses.length}</span></div>
    </div>
    ${s.courses.length ? `
      <div class="gr-courses gr-courses--head"><span class="t-label-m w-bold gr-c-code">Code</span><span class="t-label-m w-bold gr-c-name">Course</span><span class="t-label-m w-bold gr-c-grade">Grade</span></div>
      <div class="gr-courses">${s.courses.map(courseRow).join("")}</div>`
      : `<p class="t-body-m c-muted gr-empty">No courses for this semester</p>`}`;
}

function courseRow(c) {
  return `<div class="gr-course">
    <span class="t-body-s w-semi gr-c-code">${esc(c.courseCode)}</span>
    <span class="t-body-s gr-c-name">${esc(c.courseName)}</span>
    <span class="gr-c-grade"><span class="gr-chip gr-chip--${gradeTone(c.grade)}">${esc(c.grade)}</span></span>
  </div>`;
}
