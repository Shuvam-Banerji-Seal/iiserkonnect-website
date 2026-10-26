/**
 * pages/deadlines.page.js — Deadlines (ui/deadlines/DeadlinesScreen.kt).
 *
 * Assignments grouped by how close they are (overdue, due today, due within
 * 48 hours, upcoming, no date, submitted), then the teaching-assistant grading
 * cards. Live where WeLearn can be reached, otherwise labelled sample data.
 */

import { esc, on, ago } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, sampleBanner, errorCard, emptyState, loading, linearProgress, pill } from "../ui/components.js";
import { dialog } from "../ui/overlay.js";
import { loadDeadlines, statusAt, countdownText, dueFormat, STATUS } from "../data/deadlines.data.js";

const GROUPS = [
  { status: STATUS.OVERDUE, label: "Overdue", tone: "error" },
  { status: STATUS.DUE_TODAY, label: "Due today", tone: "error" },
  { status: STATUS.DUE_SOON, label: "Due soon (48h)", tone: "tertiary" },
  { status: STATUS.UPCOMING, label: "Upcoming", tone: "muted" },
  { status: STATUS.UNKNOWN, label: "No due date", tone: "muted" },
  { status: STATUS.SUBMITTED, label: "Submitted", tone: "secondary" },
];

const BADGE = {
  [STATUS.OVERDUE]: "error", [STATUS.DUE_TODAY]: "error", [STATUS.DUE_SOON]: "tertiary",
  [STATUS.UPCOMING]: "secondary", [STATUS.UNKNOWN]: "variant", [STATUS.SUBMITTED]: "secondary",
};

const rowBadge = (d, now) => {
  const st = statusAt(d, now), cd = countdownText(d, now);
  switch (st) {
    case STATUS.OVERDUE: return [cd || "Overdue", BADGE[st]];
    case STATUS.DUE_TODAY: return [`Due today${cd ? " · " + cd : ""}`, BADGE[st]];
    case STATUS.DUE_SOON: return [cd || "Due soon", BADGE[st]];
    case STATUS.UPCOMING: return [cd || "Upcoming", BADGE[st]];
    case STATUS.UNKNOWN: return ["No date", BADGE[st]];
    default: return ["Submitted", BADGE[st]];
  }
};

const courseLabel = (d) => d.course;

function row(d, now, i) {
  const [text, tone] = rowBadge(d, now);
  return `<button class="card card--low dl-row" type="button" data-act="detail" data-i="${i}">
    <span class="dl-row__top">
      <span class="dl-tag">${esc(courseLabel(d))}</span>
      <span class="t-label-m c-muted ellipsis dl-row__full">${esc(d.courseName || "")}</span>
    </span>
    <span class="t-body-m w-semi dl-row__title">${esc(d.title)}</span>
    <span class="t-label-m c-muted">${d.due == null ? "No due date" : "Due " + esc(dueFormat(d.due))}</span>
    <span class="dl-badge dl-badge--${tone}">${esc(text)}</span>
  </button>`;
}

function gradingCard(g, i) {
  const total = g.total || 0, sub = g.submitted || 0;
  const frac = total ? Math.min(1, sub / total) : 0;
  const pending = g.notSubmitted || [];
  return `<button class="card card--low dl-grade" type="button" data-act="grade" data-i="${i}" aria-expanded="false">
    <span class="row-between"><span class="t-body-m w-semi">${esc(g.title)}</span><span class="dl-tag dl-tag--sec">TA</span></span>
    <span class="t-label-m c-muted">${esc(g.course)} · due ${esc(dueFormat(g.due))}</span>
    ${linearProgress(frac)}
    <span class="row dl-grade__counts"><span class="t-label-m c-primary">${sub}/${total} submitted</span>
      <span class="t-label-m ${g.toGrade > 0 ? "c-error" : "c-muted"}">${g.toGrade > 0 ? `${g.toGrade} to grade` : "all graded"}</span></span>
    <span class="dl-grade__more" hidden>${pending.length === 0
      ? `<span class="t-body-s c-muted">Everyone has submitted 🎉</span>`
      : `<span class="t-label-m w-semi c-error">Not yet submitted (${pending.length}):</span>${pending.map((n) => `<span class="t-body-s c-muted">• ${esc(n)}</span>`).join("")}`}</span>
  </button>`;
}

function detailBody(d, now) {
  const st = statusAt(d, now), cd = countdownText(d, now);
  const msg = d.submitted ? "Submitted — nothing left to do."
    : st === STATUS.OVERDUE ? `Overdue by ${esc((cd || "a while").replace(" late", ""))}. Late submission may still be accepted — check the assignment page.`
    : st === STATUS.DUE_TODAY ? `Due TODAY (${esc(cd || "today")}). Submit before the deadline.`
    : st === STATUS.DUE_SOON ? `Due soon — ${esc(cd || "within 48 hours")}.`
    : st === STATUS.UPCOMING ? `Upcoming — ${esc(cd || "not due yet")}.`
    : "No due date published for this assignment.";
  const hot = !d.submitted && (st === STATUS.OVERDUE || st === STATUS.DUE_TODAY);
  return `<div class="stack-sm">
    <p class="t-label-m c-muted">${esc(d.courseName ? `${d.course} — ${d.courseName}` : d.course)}</p>
    <p class="t-label-s c-muted">${d.due == null ? "No due date" : "Due: " + esc(dueFormat(d.due))}</p>
    <p class="t-body-s w-semi ${d.submitted ? "c-primary" : hot ? "c-error" : ""}">${msg}</p>
    <p class="t-body-s c-muted">Open in WeLearn for the full assignment brief, attachments and submissions.</p>
  </div>`;
}

export async function render(el) {
  let state = null;
  el.innerHTML = screen({
    bar: topBar({
      title: "Deadlines", subtitle: "",
      actions: [
        `<a class="icon-btn" href="#/welearn/notifications" aria-label="Notifications" title="Notifications">${icon("notifications")}</a>`,
        iconBtn("refresh", "Refresh", { "data-act": "refresh" }),
      ].join(""),
    }),
    body: `<div id="dl-body">${linearProgress()}${loading("Scanning deadlines...")}</div>`,
  });
  const body = el.querySelector("#dl-body");
  const bar = el.querySelector(".topbar__titles");

  const paint = () => {
    const { r } = state;
    const d = r.data;
    const now = Date.now();
    if (r.cachedAt && !r.sample && bar) {
      bar.querySelector(".topbar__subtitle")?.remove();
      bar.insertAdjacentHTML("beforeend", `<div class="topbar__subtitle">Updated ${esc(new Date(r.cachedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))}</div>`);
    }
    const list = d.assignments || [];
    const grading = d.grading || [];
    const stale = r.stale ? `<div class="note note--info" role="note">${icon("cloud_off")}<div class="note__text"><strong>Showing saved deadlines</strong><p>${esc(r.error ? r.error.message || "Could not reach WeLearn." : "Could not reach WeLearn.")}</p><button class="btn btn--text btn--sm" type="button" data-act="refresh">Retry</button></div></div>` : "";
    const sections = GROUPS.map((g) => ({ ...g, items: list.map((x, i) => ({ x, i })).filter(({ x }) => statusAt(x, now) === g.status) })).filter((g) => g.items.length);
    const gradingHtml = grading.length ? `<h2 class="dl-section-title">Grading — as Teaching Assistant</h2>${grading.map((g, i) => gradingCard(g, i)).join("")}` : "";
    body.innerHTML = `
      ${r.sample ? sampleBanner("WeLearn") : ""}
      ${stale}
      ${gradingHtml}
      ${sections.map((g) => `
        <div class="dl-section-head"><span class="dl-dot dl-dot--${g.tone}"></span><h2 class="dl-section-title">${esc(g.label)}</h2><span class="pill pill--secondary">${g.items.length}</span></div>
        ${g.items.map(({ x, i }) => row(x, now, list.indexOf(x))).join("")}`).join("")}
      ${!list.length && !grading.length ? `<div class="card card--high"><p class="t-title-s w-semi">No assignments found</p><p class="t-body-s c-muted">Nothing is due right now on any of your WeLearn courses.</p></div>` : ""}`;
    state.list = list; state.grading = grading;
  };

  const load = async (force) => {
    body.innerHTML = `${linearProgress()}${loading("Scanning deadlines...")}`;
    try {
      const r = await loadDeadlines({ force });
      state = { r };
      paint();
    } catch (e) {
      body.innerHTML = errorCard(e.message || "Could not load deadlines.", { retry: true });
    }
  };

  on(el, "click", "[data-act=refresh],[data-act=retry]", () => load(true));
  on(el, "click", "[data-act=detail]", async (e, b) => {
    const d = state.list[+b.dataset.i];
    await dialog({
      title: d.title,
      body: detailBody(d, Date.now()),
      actions: [{ label: "Close", value: null, variant: "text" }],
    });
  });
  on(el, "click", "[data-act=grade]", (e, b) => {
    const more = b.querySelector(".dl-grade__more");
    const open = more.hidden;
    more.hidden = !open;
    b.setAttribute("aria-expanded", String(open));
  });
  await load(false);
}
