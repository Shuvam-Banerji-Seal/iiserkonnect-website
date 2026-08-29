/** pages/research.page.js — ePrints browse (latest + division/year). */

import * as eprints from "../services/eprints.service.js";
import { downloadUrl } from "../services/welearn.service.js";
import { pageHead, esc, errorState } from "../ui/helpers.js";

export async function render(el) {
  el.innerHTML = pageHead("Research", "ePrints repository", "Latest deposits and division-wise browse — public, no login.");

  el.insertAdjacentHTML("beforeend", `
    <div class="tabbar">
      <button class="tab active" data-tab="latest">Latest</button>
      <button class="tab" data-tab="browse">Browse</button>
    </div>
    <div id="res-body"></div>`);

  const body = el.querySelector("#res-body");
  const show = (t) => t === "latest" ? showLatest(body) : showBrowse(body);
  el.querySelectorAll(".tab").forEach((b) => b.onclick = () => {
    el.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    b.classList.add("active"); show(b.dataset.tab);
  });
  show("latest");
}

async function showLatest(body) {
  body.innerHTML = `<div class="page-loading"><span class="spinner"></span> Fetching feed…</div>`;
  try {
    const papers = await eprints.latest();
    body.innerHTML = papers.length ? paperList(papers) : `<p class="body-muted">Feed returned nothing.</p>`;
    wirePapers(body, papers);
  } catch (e) { body.innerHTML = errorState(e.message); }
}

const paperList = (papers) => `
  <div class="result-list">${papers.map((p, i) => `
    <div class="app-card result-card" data-i="${i}">
      <strong>${esc(p.title)}</strong>
      <div class="tiny body-muted">${esc((p.authors || []).join(", ") || p.typeLine || "")}${p.year ? " · " + esc(p.year) : ""}</div>
    </div>`).join("")}</div>`;

function wirePapers(body, papers) {
  body.querySelectorAll(".result-card").forEach((c) => {
    c.onclick = async () => {
      const p = papers[+c.dataset.i];
      c.insertAdjacentHTML("afterend", `<div id="res-detail" class="app-card" style="margin-top:12px">
        <div class="page-loading"><span class="spinner"></span> Loading paper…</div></div>`);
      const det = document.getElementById("res-detail");
      try {
        const d = await eprints.detail(p.id);
        det.innerHTML = `
          <h3 class="h3">${esc(d.title)}</h3>
          <p class="small body-muted">${esc(d.authors.join(", "))}${d.year ? " · " + esc(d.year) : ""}</p>
          ${d.abstract ? `<p class="small">${esc(d.abstract)}</p>` : ""}
          <div class="row-gap" style="margin-top:10px">
            ${d.pdf ? `<a class="btn btn--primary btn--sm" href="${downloadUrl(d.pdf)}" download>Download PDF</a>` : ""}
            <a class="btn btn--ghost btn--sm" href="${esc(d.url)}" target="_blank" rel="noopener">Open page</a>
          </div>`;
      } catch (e) { det.innerHTML = errorState(e.message); }
    };
  });
}

async function showBrowse(body) {
  body.innerHTML = `<div class="page-loading"><span class="spinner"></span> Loading divisions…</div>`;
  try {
    const divs = await eprints.divisions();
    body.innerHTML = `<div class="chipcloud">${divs.map((d) =>
      `<button class="chip chip--accent" data-div="${esc(d.id)}">${esc(d.name)}</button>`).join("")}</div><div id="res-years"></div>`;
    const yearsEl = body.querySelector("#res-years");
    body.querySelectorAll("[data-div]").forEach((b) => {
      b.onclick = async () => {
        yearsEl.innerHTML = `<div class="page-loading"><span class="spinner"></span> Loading years…</div>`;
        try {
          const ys = await eprints.years(b.dataset.div);
          yearsEl.innerHTML = `<div class="chipcloud" style="margin-top:10px">${ys.map((y) =>
            `<button class="chip" data-year="${esc(y)}">${esc(y)}</button>`).join("")}</div><div id="res-papers"></div>`;
          const papersEl = yearsEl.querySelector("#res-papers");
          yearsEl.querySelectorAll("[data-year]").forEach((yb) => {
            yb.onclick = async () => {
              papersEl.innerHTML = `<div class="page-loading"><span class="spinner"></span> Loading papers…</div>`;
              try {
                const papers = await eprints.divisionYearPapers(b.dataset.div, yb.dataset.year);
                papersEl.innerHTML = papers.length ? paperList(papers) : `<p class="body-muted">Nothing listed.</p>`;
                wirePapers(papersEl, papers);
              } catch (e) { papersEl.innerHTML = errorState(e.message); }
            };
          });
        } catch (e) { yearsEl.innerHTML = errorState(e.message); }
      };
    });
  } catch (e) { body.innerHTML = errorState(e.message); }
}
