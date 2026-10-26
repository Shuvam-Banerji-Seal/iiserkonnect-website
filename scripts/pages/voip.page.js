/**
 * pages/voip.page.js — VoIP Directory (ui/voip/VoipDirectoryScreen.kt).
 *
 * Pilot number card (tap to call), search by name, extension or location,
 * one card per department section. Extension calls use the pilot number with
 * the extension after a comma (dialled through the IVR), as the app does.
 */

import { esc, on, debounce, sameDay } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, searchField, emptyState, loading, errorCard, sampleBanner } from "../ui/components.js";
import { toast } from "../ui/overlay.js";
import { loadVoip, filterVoip, pilotTel, extTel } from "../data/voip.data.js";

const contactCard = (c, pilot) => `
  <article class="voip-contact">
    <div class="voip-contact__text">
      <span class="voip-contact__name">${esc(c.name)}</span>
      ${c.location ? `<span class="voip-contact__loc">${icon("location_on", { size: 16 })}<span>${esc(c.location)}</span></span>` : ""}
      ${c.extension ? `<span class="voip-chip">Ext. ${esc(c.extension)}</span>` : ""}
    </div>
    <div class="voip-contact__actions">
      ${c.extension ? `<button class="icon-btn" type="button" data-copy="${esc(c.extension)}" aria-label="Copy extension ${esc(c.extension)}" title="Copy extension">${icon("content_copy", { size: 20 })}</button>` : ""}
      <a class="icon-btn voip-call" href="${esc(extTel(pilot, c.extension))}" aria-label="Call ${esc(c.name)}" title="Call ${esc(c.name)}">${icon("call", { size: 20 })}</a>
    </div>
  </article>`;

export async function render(el) {
  let data = null;
  let query = "";

  el.innerHTML = screen({
    bar: topBar({
      title: "VoIP Directory",
      actions: `<a class="icon-btn" href="#/emergency-contacts" aria-label="Emergency contacts" title="Emergency contacts">${icon("medical_services")}</a>`
        + iconBtn("refresh", "Refresh", { "data-act": "refresh" }),
    }),
    body: loading("Loading telephone directory..."),
  });
  const body = el.querySelector(".screen__body");

  const paintList = () => {
    const sections = filterVoip(data.sections, query);
    const total = sections.reduce((n, s) => n + s.contacts.length, 0);
    const q = query.trim();
    body.querySelector("#voip-list").innerHTML = sections.length
      ? `<p class="voip-count">${sections.length} sections, ${total} contacts${q ? ` matching "${esc(q)}"` : ""}</p>`
        + sections.map((s) => `<section class="voip-section">
            <h2 class="voip-section__title">${esc(s.title)}</h2>
            ${s.contacts.map((c) => contactCard(c, data.pilotNumber)).join("")}
          </section>`).join("")
      : emptyState({ icon: "search_off", title: "No matches", body: "Try a different name, extension or location." });
  };

  const paint = () => {
    body.innerHTML = `
      ${data.sample ? sampleBanner("the institute website") : ""}
      <a class="voip-pilot" href="${esc(pilotTel(data.pilotNumber))}">
        ${icon("phone", { size: 28 })}
        <span class="voip-pilot__text">
          <span class="voip-pilot__label">Pilot Number</span>
          <span class="voip-pilot__num">${esc(data.pilotNumber)}</span>
          <span class="voip-pilot__sub">Tap to call, then dial extension via IVR</span>
        </span>
      </a>
      ${searchField({ id: "voip-q", placeholder: "Search by name, extension, or location", value: query })}
      <div id="voip-list"></div>`;
    paintList();
  };

  const load = async () => {
    body.innerHTML = loading("Loading telephone directory...");
    try {
      const r = await loadVoip();
      data = { ...r.data, sample: r.sample };
      paint();
    } catch (err) {
      body.innerHTML = errorCard(err.message || "Could not load the directory.", { retry: true });
    }
  };

  on(el, "input", "#voip-q", debounce(() => {
    query = el.querySelector("#voip-q").value;
    el.querySelector(".search")?.classList.toggle("has-value", !!query);
    if (data) paintList();
  }, 120));
  on(el, "click", "[data-act=refresh]", () => load());
  on(el, "click", "[data-act=retry]", () => load());
  on(el, "click", "[data-copy]", (e, btn) => {
    const v = btn.dataset.copy;
    navigator.clipboard?.writeText(v).then(() => toast("Copied extension " + v), () => toast("Could not copy."));
  });
  on(el, "click", ".search__clear", () => {
    query = "";
    el.querySelector("#voip-q").value = "";
    el.querySelector(".search")?.classList.remove("has-value");
    if (data) paintList();
  });

  await load();
  return () => {};
}
