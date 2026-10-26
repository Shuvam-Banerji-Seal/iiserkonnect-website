/**
 * pages/research.page.js — Research Papers (ui/research/ResearchScreen.kt)
 * and the paper detail screen (ResearchDetailScreen).
 *
 * "Latest" lists the newest deposits. "Browse" walks Divisions → Years →
 * Papers. Papers open the detail screen. The PDF is only ever opened by the
 * reader clicking a link; "Show here" embeds it on click and only for
 * non-campus https addresses.
 */

import { href, seg } from "../core/router.js";
import { esc, on } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, tabs, sampleBanner, loading, errorCard, emptyState, extLink } from "../ui/components.js";
import * as R from "../data/research.data.js";

const splitAuthors = (s) => String(s || "").split(";").map((a) => a.trim()).filter(Boolean);

function paperCard(p) {
  const authors = (p.authors || []).join("; ");
  const link = href("research/detail/" + seg(p.eprintId), { title: p.title, authors });
  return `<a class="res-card" href="${esc(link)}">
    <span class="res-card__top">${icon("description", { size: 18, cls: "res-card__icon" })}<span class="res-card__year">${esc(p.year || "")}</span></span>
    <span class="res-card__title">${esc(p.title)}</span>
    ${authors ? `<span class="res-card__authors">${esc(authors)}</span>` : ""}
    ${p.typeLine ? `<span class="res-card__type">${esc(p.typeLine)}</span>` : ""}
  </a>`;
}

const listCard = (label, sub = "") => `<button type="button" class="res-list-item" data-act="pick" data-value="${esc(label.value)}">
  <span class="res-list-item__title">${esc(label.text)}</span>${sub ? `<span class="res-list-item__sub">${esc(sub)}</span>` : ""}
  ${icon("keyboard_arrow_right", { size: 20 })}</button>`;

export async function render(el) {
  let tab = "latest";
  let level = { kind: "divisions" };   // divisions | years | papers
  let sample = false;
  let divs = [];
  const frame = () => {
    el.innerHTML = screen({
      bar: topBar({ title: "Research Papers", actions: iconBtn("refresh", "Refresh", { "data-act": "refresh" }) }),
      body: tabs([{ id: "latest", label: "Latest" }, { id: "browse", label: "Browse" }], tab) + `<div class="res-body"></div>`,
    });
  };
  const slot = () => el.querySelector(".res-body");
  const show = (html) => { slot().innerHTML = (sample ? sampleBanner("the ePrints repository") : "") + html; };

  const showLatest = async () => {
    slot().innerHTML = loading("Fetching feed...");
    try {
      const r = await R.loadLatest();
      sample = r.sample;
      show(r.data.length ? `<div class="res-list">${r.data.map(paperCard).join("")}</div>` : "");
    } catch (e) {
      show(errorCard(e.message || "Something went wrong. Check your network and try again."));
    }
  };

  const showBrowse = async () => {
    slot().innerHTML = loading("Loading divisions...");
    try {
      if (level.kind === "divisions") {
        const r = await R.loadDivisions();
        sample = r.sample;
        divs = r.data;
        show(`<div class="res-stack">${r.data.map((d) => listCard({ value: `div:${d.id}`, text: d.name })).join("")}</div>`);
      } else if (level.kind === "years") {
        const r = await R.loadYears(level.div.id);
        sample = r.sample;
        show(`${up()}<div class="res-head">${esc(level.div.name)}</div><div class="res-stack">${r.data.map((y) => listCard({ value: `year:${y}`, text: y })).join("")}</div>`);
      } else {
        const r = await R.loadPapers(level.div.id, level.year);
        sample = r.sample;
        show(`${up()}<div class="res-head">${esc(level.div.name)} · ${esc(level.year)}</div><div class="res-list">${r.data.map(paperCard).join("")}</div>`);
      }
    } catch (e) {
      show(errorCard(e.message || "Something went wrong. Check your network and try again."));
    }
  };

  const up = () => `<button type="button" class="btn btn--text btn--sm res-up" data-act="browse-up">${icon("arrow_back", { size: 18 })}<span>Back</span></button>`;

  const load = () => (tab === "latest" ? showLatest() : showBrowse());

  frame();
  await load();

  on(el, "click", "[data-tab]", (e, b) => {
    tab = b.dataset.tab;
    el.querySelectorAll("[data-tab]").forEach((t) => {
      t.classList.toggle("tab--active", t.dataset.tab === tab);
      t.setAttribute("aria-selected", String(t.dataset.tab === tab));
    });
    if (tab === "browse") level = { kind: "divisions" };
    load();
  });
  on(el, "click", "[data-act=refresh]", () => load());
  on(el, "click", "[data-act=pick]", async (e, b) => {
    const [kind, value] = b.dataset.value.split(/:(.*)/s);
    if (kind === "div") {
      const div = divs.find((d) => d.id === value) || { id: value, name: value };
      level = { kind: "years", div };
    } else if (kind === "year") {
      level = { ...level, kind: "papers", year: value };
    }
    showBrowse();
  });
  // Back inside Browse: one step up, as the Android back arrow does.
  on(el, "click", "[data-act=browse-up]", () => {
    if (level.kind === "papers") level = { kind: "years", div: level.div };
    else level = { kind: "divisions" };
    showBrowse();
  });

  return () => {};
}

/* ── paper detail ─────────────────────────────────────────────── */
export async function renderDetail(el, ctx) {
  const id = ctx.params.eprintId;
  const fallback = { title: ctx.query.title || "", authors: splitAuthors(ctx.query.authors) };
  const bar = topBar({ title: `Paper · ${id}` });
  el.innerHTML = screen({ bar, body: loading("Loading paper...") });
  const bodyEl = () => el.querySelector(".screen__body");

  const pdfBlock = (url) => {
    if (!url) return "";
    const canEmbed = /^https:\/\//i.test(url) && !R.isCampusHost(url);
    return `<div class="res-pdf">
      <a class="res-pdf__open" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon("picture_as_pdf", { size: 22 })}<span>Open PDF</span>${icon("open_in_new", { size: 16 })}</a>
      ${canEmbed ? `<button type="button" class="btn btn--text btn--sm" data-act="show-pdf" data-url="${esc(url)}">${icon("visibility", { size: 18 })}<span>Show here</span></button>
      <div class="res-pdf__frame"></div>` : `<p class="fineprint">The PDF is on the campus repository, which this browser cannot display. Use “Open PDF”.</p>`}
    </div>`;
  };

  const show = (d, sample) => {
    const meta = [d.year, d.typeLine].filter(Boolean).join(" · ");
    bodyEl().innerHTML = `
      ${sample ? sampleBanner("the ePrints repository") : ""}
      <div class="res-detail">
        <h1 class="res-detail__title">${esc(d.title)}</h1>
        ${d.authors && d.authors.length ? `<p class="res-detail__authors">${esc(d.authors.join("; "))}</p>` : ""}
        ${meta ? `<p class="res-detail__meta">${esc(meta)}</p>` : ""}
        ${pdfBlock(d.pdfUrl)}
        ${d.abstractText ? `<h2 class="res-h">Abstract</h2><p class="res-abstract">${esc(d.abstractText)}</p>` : ""}
        <p class="fineprint">Record: ${extLink("Open the repository page", `http://eprints.iiserkol.ac.in/${encodeURIComponent(id)}/`)}</p>
      </div>`;
  };

  const run = async () => {
    bodyEl().innerHTML = loading("Loading paper...");
    try {
      const r = await R.loadDetail(id, fallback);
      if (!r.data) {
        bodyEl().innerHTML = errorCard("Could not load paper.", { retry: true }) + emptyState({ icon: "description", title: "No record", body: "" });
        return;
      }
      show(r.data, r.sample);
    } catch (e) {
      bodyEl().innerHTML = errorCard(e.message || "Could not load paper.", { retry: true });
    }
  };
  on(el, "click", "[data-act=retry]", () => run());
  on(el, "click", "[data-act=show-pdf]", (e, b) => {
    const frameEl = el.querySelector(".res-pdf__frame");
    if (!frameEl || frameEl.childElementCount) return;
    const url = b.dataset.url;
    if (!/^https:\/\//i.test(url) || R.isCampusHost(url)) return;
    frameEl.innerHTML = `<iframe class="res-pdf__iframe" src="${esc(url)}" title="PDF preview" loading="lazy" referrerpolicy="no-referrer"></iframe>`;
  });

  await run();
  return () => {};
}
