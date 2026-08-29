/** pages/library.page.js — catalogue search + item detail. */

import { search, itemDetail } from "../services/library.service.js";
import { pageHead, esc, errorState } from "../ui/helpers.js";

export async function render(el) {
  el.innerHTML = pageHead("Library", "Catalogue", "Search the VTLS Chamo catalogue with live availability.");

  el.insertAdjacentHTML("beforeend", `
    <form class="searchbar" id="lib-form">
      <input class="input" id="lib-q" placeholder="Search title, author…" autocomplete="off">
      <button class="btn btn--primary btn--sm">Search</button>
    </form>
    <div id="lib-body"><p class="body-muted">Search to see results.</p></div>`);

  const body = el.querySelector("#lib-body");
  el.querySelector("#lib-form").onsubmit = async (e) => {
    e.preventDefault();
    const qy = el.querySelector("#lib-q").value.trim();
    if (!qy) return;
    body.innerHTML = `<div class="page-loading"><span class="spinner"></span> Searching catalogue…</div>`;
    try {
      const results = await search(qy);
      body.innerHTML = results.length ? `
        <div class="result-list">
          ${results.map((r, i) => `
            <div class="app-card result-card" data-i="${i}">
              <div><strong>${esc(r.title)}</strong>${r.author ? `<span class="body-muted small"> — ${esc(r.author)}</span>` : ""}</div>
              <div class="tiny body-muted mono">${esc(r.callNumber)}</div>
            </div>`).join("")}
        </div>` : `<p class="body-muted">No results for “${esc(qy)}”.</p>`;

      body.querySelectorAll(".result-card").forEach((c) => {
        c.onclick = async () => {
          const r = results[+c.dataset.i];
          c.insertAdjacentHTML("afterend",
            `<div id="lib-detail" class="app-card" style="margin-top:12px"><div class="page-loading"><span class="spinner"></span> Loading item…</div></div>`);
          const det = document.getElementById("lib-detail");
          try {
            const d = await itemDetail(r.url);
            det.innerHTML = `
              <h3 class="h3">${esc(d.title)}</h3>
              <p class="small body-muted">${esc(d.author || "")}${d.publication ? " · " + esc(d.publication) : ""}${d.physical ? " · " + esc(d.physical) : ""}</p>
              ${d.notes ? `<p class="small">${esc(d.notes)}</p>` : ""}
              ${d.availability?.length ? `
                <table class="datatable" style="margin-top:10px">
                  <thead><tr><th>Location</th><th>Barcode</th><th>Status</th></tr></thead>
                  <tbody>${d.availability.map((a) => `
                    <tr><td>${esc(a.location)}</td><td class="mono">${esc(a.barcode)}</td>
                    <td><span class="chip ${/available/i.test(a.status) ? "chip--accent" : ""}">${esc(a.status)}</span></td></tr>`).join("")}
                  </tbody></table>` : `<p class="body-muted small">No copy information available.</p>`}`;
          } catch (err) {
            det.innerHTML = errorState(err.message);
          }
        };
      });
    } catch (e) {
      body.innerHTML = errorState(e.message);
    }
  };
}
