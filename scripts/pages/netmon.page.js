/** pages/netmon.page.js — service health + Skipole monitors + MRTG graphs. */

import { ENDPOINTS, MONITORS, MRTG_SOURCES, fetchMonitor, fetchMrtg } from "../services/netmon.service.js";
import { get } from "../core/net.js";
import { pageHead, card, esc, errorState, requireProxy } from "../ui/helpers.js";

export async function render(el) {
  el.innerHTML = pageHead("Network", "Status dashboard", "Service health, campus monitors and MRTG traffic — needs campus network/VPN on the proxy host.");
  const proxy = await requireProxy();
  if (!proxy.ok) return el.insertAdjacentHTML("beforeend", proxy.html);

  el.insertAdjacentHTML("beforeend", `
    <div class="statrow" id="nm-endpoints"></div>
    <div class="tabbar" style="margin-top:20px">
      <button class="tab active" data-tab="monitors">Monitors</button>
      <button class="tab" data-tab="mrtg">MRTG</button>
    </div>
    <div id="nm-body"></div>`);

  const body = el.querySelector("#nm-body");
  const endpointsEl = el.querySelector("#nm-endpoints");

  // endpoint health (parallel HEAD-ish via proxy GET of tiny pages)
  endpointsEl.innerHTML = ENDPOINTS.map((e) =>
    card(`<div class="stat"><span class="stat__value" data-e="${esc(e.url)}">…</span><span class="stat__label">${esc(e.name)}</span></div>`)).join("");

  Promise.allSettled(ENDPOINTS.map(async (e) => {
    const t0 = performance.now();
    try { await get(e.url); return { e, up: true, ms: Math.round(performance.now() - t0) }; }
    catch { return { e, up: false, ms: null }; }
  })).then((rs) => {
    for (const r of rs) {
      if (r.status !== "fulfilled") continue;
      const { e, up, ms } = r.value;
      const slot = endpointsEl.querySelector(`[data-e="${CSS.escape(e.url)}"]`);
      if (slot) {
        slot.textContent = up ? `${ms}ms` : "down";
        slot.style.color = up ? "var(--success)" : "var(--error, #f38ba8)";
      }
    }
  });

  const show = async (tab) => {
    body.innerHTML = `<div class="page-loading"><span class="spinner"></span> Loading ${tab}…</div>`;
    try {
      if (tab === "monitors") {
        const results = await Promise.all(MONITORS.map(fetchMonitor));
        body.innerHTML = results.map(monitorCard).join("");
      } else {
        const results = await Promise.all(MRTG_SOURCES.map(fetchMrtg));
        body.innerHTML = results.map(mrtgCard).join("");
      }
    } catch (e) { body.innerHTML = errorState(e.message); }
  };

  el.querySelectorAll(".tab").forEach((b) => b.onclick = () => {
    el.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    b.classList.add("active"); show(b.dataset.tab);
  });
  show("monitors");
}

function monitorCard(r) {
  const badge = r.error
    ? `<span class="err-text small">${esc(r.error)}</span>`
    : `<span class="chip chip--accent">${r.up} up</span> <span class="chip">${r.down} down</span>` +
      (r.alerts ? ` <span class="chip">⚠ ${r.alerts} alerts</span>` : "");
  const groups = r.groups.map((g) => {
    const hosts = g.hosts.map((h) =>
      `<div class="monhost"><span class="dot ${h.up ? "up" : "down"}"></span>` +
      `<span class="filelist__name">${esc(h.name)}</span></div>`).join("");
    return `<div class="mongroup">
      <div class="tiny body-muted" style="margin:10px 0 4px">${esc(g.name)}${g.alerts ? " ⚠" : ""}</div>${hosts}</div>`;
  }).join("");
  return card(`<div class="row-between"><strong>${esc(r.source.name)}</strong><span>${badge}</span></div>${groups}`);
}

function mrtgCard(r) {
  if (r.error) return card(`<strong>${esc(r.source.name)}</strong><p class="err-text small">${esc(r.error)}</p>`);
  const figs = r.targets.map((t) =>
    `<figure class="mrtg-card"><figcaption class="tiny body-muted">${esc(t.title)}</figcaption>` +
    `<img src="${esc(t.day)}" alt="${esc(t.title)} day graph" loading="lazy"></figure>`).join("");
  return card(`<strong>${esc(r.source.name)}</strong><div class="mrtg-grid">${figs || "<p>none</p>"}</div>`);
}
