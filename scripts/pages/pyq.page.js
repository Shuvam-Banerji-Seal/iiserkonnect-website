/**
 * pages/pyq.page.js — Previous Year Questions (ui/pyq/PYQScreen.kt).
 *
 * Years, then the exam sections of one year with a chip per department paper.
 * Papers live on the campus intranet: the sample has no links, and live
 * links are opened only when the user taps one (a new tab). Opened papers are
 * remembered in the browser's Downloads list.
 */

import { esc, on } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, sampleBanner, errorCard, loading, linearProgress } from "../ui/components.js";
import { snackbar } from "../ui/overlay.js";
import { loadPyqYears, loadPyqYear } from "../data/pyq.data.js";
import { rememberDownload } from "../data/welearn.data.js";

const INTRO = "Browse and download old question papers from IISER Kolkata exams, organized by year, exam type, semester, and department.";
const SAMPLE_PAPER = "This is a sample entry. The demo has no paper to open, so nothing was downloaded.";

export async function render(el) {
  let years = [], sample = false, current = null;

  const frame = (bar, body) => {
    el.innerHTML = screen({ bar, body });
  };

  const showYears = async (force) => {
    current = null;
    frame(topBar({
      title: "Previous Year Questions",
      actions: [iconBtn("refresh", "Refresh", { "data-act": "refresh" })].join(""),
    }), `<div id="pyq-body">${linearProgress()}${loading("Loading question papers...")}</div>`);
    const body = el.querySelector("#pyq-body");
    try {
      const r = await loadPyqYears({ force });
      years = r.data.years || []; sample = r.sample;
      body.innerHTML = `
        ${sample ? sampleBanner("the campus intranet") : ""}
        <div class="card card--primary pyq-hero">
          <span class="pyq-hero__top">${icon("school", { size: 36, cls: "c-primary" })}
            <span><span class="t-title-l w-semi pyq-hero__title">Previous Year Questions</span>
            <span class="t-body-m pyq-hero__sub">${years.length} years available</span></span></span>
          <p class="t-body-s pyq-hero__intro">${esc(INTRO)}</p>
        </div>
        <div class="stack-sm mt-sm">${years.map((y, i) => `
          <button class="card card--low pyq-year" type="button" data-act="year" data-i="${i}">
            <span class="pyq-year__badge">${esc(y.year)}</span>
            <span class="grow"><span class="t-title-m w-semi">Question Papers ${esc(y.year)}</span>
              <span class="t-body-s c-muted">Mid &amp; End Semester exams</span></span>
            ${icon("calendar_month", { cls: "c-muted" })}
          </button>`).join("")}</div>`;
    } catch (e) {
      body.innerHTML = errorCard(`Requires campus network / VPN.\n${e.message || ""}`.trim(), { retry: true });
    }
  };

  const showYear = async (y) => {
    current = y;
    frame(topBar({ title: `PYQ ${y.year}`, back: true, actions: `<a class="icon-btn" href="#/welearn/downloads" aria-label="View Downloads" title="View Downloads">${icon("folder_open")}</a>` }).replace('data-back=""', 'data-up=""'),
      `<div id="pyq-body">${linearProgress()}${loading("Loading question papers...")}</div>`);
    const body = el.querySelector("#pyq-body");
    try {
      const d = await loadPyqYear(y, sample);
      body.innerHTML = d.sections.length ? `${sample ? sampleBanner("the campus intranet") : ""}
        <div class="stack-sm">${d.sections.map(sectionCard(d.year, sample)).join("")}</div>`
        : `<div class="pyq-empty">${icon("error", { size: 48, cls: "c-muted" })}
            <p class="t-title-s w-semi">No question papers found for ${esc(d.year)}</p>
            <p class="t-body-s c-muted">This page may have a different format or be empty.</p></div>`;
    } catch (e) {
      body.innerHTML = errorCard(e.message || "Could not load question papers.", { retry: true });
    }
  };

  on(el, "click", "[data-act=refresh]", () => showYears(true));
  on(el, "click", "[data-act=retry]", () => (current ? showYear(current) : showYears(true)));
  on(el, "click", "[data-act=year]", (e, b) => showYear(years[+b.dataset.i]));
  on(el, "click", "[data-up]", (e) => { e.preventDefault(); showYears(false); });
  on(el, "click", "[data-sample-paper]", () => snackbar(SAMPLE_PAPER));
  on(el, "click", "[data-paper]", (e, a) => {
    const [name, url] = [a.dataset.paper, a.href];
    rememberDownload({ name, course: `PYQ ${current ? current.year : ""}`.trim(), url });
  });

  await showYears(false);
}

function sectionCard(year, sample) {
  return (s) => {
    const mid = /mid/i.test(s.exam);
    const spring = s.semester === "Spring";
    return `<div class="card pyq-section pyq-section--${mid ? "mid" : "end"}">
      <div class="row pyq-section__tags">
        <span class="pyq-tag pyq-tag--${mid ? "mid" : "end"}">${esc(s.exam)}</span>
        <span class="pyq-tag pyq-tag--${spring ? "spring" : "autumn"}">${esc(s.semester)}</span>
        <span class="grow"></span>
        <span class="t-label-s c-muted">${s.depts.length} depts</span>
      </div>
      <div class="pyq-depts">${s.depts.map((d) => {
        const label = `${esc(d.name)}`;
        const inner = `${icon("picture_as_pdf", { size: 16, cls: "pyq-dept__pdf" })}<span class="pyq-dept__name">${label}</span>${icon("download", { size: 14 })}`;
        if (sample || !d.url) return `<button class="chip chip--assist pyq-dept" type="button" data-sample-paper aria-label="${esc(d.name)} (sample)">${inner}</button>`;
        return `<a class="chip chip--assist pyq-dept" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer" data-paper="${esc(`${d.name} · ${s.exam} · ${s.semester} ${year}`)}" aria-label="Open ${esc(d.name)} paper in a new tab">${inner}</a>`;
      }).join("")}</div>
    </div>`;
  };
}
