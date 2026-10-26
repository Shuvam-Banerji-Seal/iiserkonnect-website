/**
 * productivity/calendarpicker.js — "Remind me about…" / "Note for a calendar
 * event" / "Plan a calendar event": the upcoming 14 days of My Calendar and
 * the institute's Event Calendar, filtered All / Campus / Mine, grouped by day.
 * Resolves with the picked agenda entry, or null.
 */

import { collection } from "../core/db.js";
import { esc, startOfDay, isoDay, fromIsoDay } from "../ui/dom.js";
import { icon, chip, button, loading, sampleBanner, emptyState, errorCard } from "../ui/components.js";
import { dialog } from "../ui/overlay.js";
import { loadCampusEvents, toAgenda } from "../data/events.data.js";
import { agenda, eventRangeText, dayWord } from "./logic.js";

export const WINDOW_DAYS = 14;

/** Upcoming entries of both calendars, starting today. */
export async function upcomingEntries(now = new Date()) {
  const from = startOfDay(now).getTime();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + WINDOW_DAYS).getTime();
  const [personal, campus] = await Promise.all([collection("events").all(), loadCampusEvents()]);
  const campusEvents = toAgenda(campus?.data?.events || []);
  return { entries: agenda(personal, campusEvents, from, to), sample: !!campus?.sample, stale: !!campus?.stale };
}

const SOURCE = (e) => (e.source === "CAMPUS" ? "Campus" : "My Calendar");

const EMPTY = {
  CAMPUS: "No campus events in the next two weeks. The Event Calendar needs a connection the first time; try Refresh.",
  MY_CALENDAR: "Nothing in My Calendar for the next two weeks.",
  all: "Nothing on your calendars for the next two weeks.",
};

/**
 * Open the picker. `title` is the dialog title ("Remind me about…").
 * Resolves with the chosen entry ({ key, source, title, start, end, allDay, location, details }) or null.
 */
export function pickCalendarEntry({ title = "Remind me about…" } = {}) {
  let entries = [];
  let filter = null;
  let state = "loading";   // loading | ready | error
  let sample = false;
  let host = null;

  const draw = () => {
    if (!host) return;
    if (state === "loading") { host.innerHTML = loading("Loading calendars…"); return; }
    if (state === "error") { host.innerHTML = errorCard("Your calendars could not be read.", { retry: true }); return; }
    const shown = entries.filter((e) => !filter || e.source === filter);
    if (!shown.length) {
      host.innerHTML = emptyState({ icon: "event_busy", title: "Nothing here", body: EMPTY[filter || "all"] });
      return;
    }
    const now = new Date();
    const groups = new Map();
    for (const e of shown) {
      const k = isoDay(new Date(e.start));
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(e);
    }
    host.innerHTML = [...groups.entries()].map(([k, list]) => `
      <h3 class="pick__day">${esc(dayWord(fromIsoDay(k), now))}</h3>
      ${list.map((e) => {
        const idx = entries.indexOf(e);
        const time = eventRangeText(e.start, e.end, e.allDay);
        const sub = [time, SOURCE(e), (e.location || "").trim()].filter(Boolean).join("  ·  ");
        return `<button type="button" class="pick__item" data-pick="${idx}">
          <span class="pick__icon pick__icon--${e.source === "CAMPUS" ? "campus" : "mine"}">${icon("calendar_month", { size: 22 })}</span>
          <span class="pick__text"><span class="pick__title">${esc(e.title)}</span><span class="pick__sub">${esc(sub)}</span></span>
        </button>`;
      }).join("")}`).join("");
  };

  return dialog({
    title,
    icon: "calendar_month",
    wide: true,
    actions: [],
    body: `
      <div class="pick">
        <div class="chips pick__filters" role="group" aria-label="Show">
          ${chip("All", { selected: true, a: { "data-filter": "all" } })}
          ${chip("Campus", { a: { "data-filter": "CAMPUS" } })}
          ${chip("Mine", { a: { "data-filter": "MY_CALENDAR" } })}
        </div>
        <div class="pick__sample" data-sample hidden></div>
        <div class="pick__list" data-host></div>
        <div class="pick__footer">
          ${button("Refresh", { variant: "text", attrs: { "data-act": "refresh" } })}
          ${button("Close", { variant: "text", attrs: { "data-act": "close" } })}
        </div>
      </div>`,
    onMount(d, close) {
      host = d.querySelector("[data-host]");
      const sampleBox = d.querySelector("[data-sample]");
      const setFilterChips = () => {
        d.querySelectorAll("[data-filter]").forEach((b) => {
          const on = (b.dataset.filter === "all" ? null : b.dataset.filter) === filter;
          b.classList.toggle("chip--selected", on);
          b.setAttribute("aria-pressed", String(on));
        });
      };
      const load = async () => {
        state = "loading"; draw();
        try {
          const r = await upcomingEntries();
          entries = r.entries; sample = r.sample;
          state = "ready";
        } catch {
          state = "error";
        }
        sampleBox.hidden = !sample;
        sampleBox.innerHTML = sample ? sampleBanner("the Event Calendar") : "";
        draw();
      };
      d.addEventListener("click", (e) => {
        const f = e.target.closest("[data-filter]");
        if (f) { filter = f.dataset.filter === "all" ? null : f.dataset.filter; setFilterChips(); draw(); return; }
        const p = e.target.closest("[data-pick]");
        if (p) { close(entries[+p.dataset.pick] || null); return; }
        if (e.target.closest("[data-act=refresh]")) { load(); return; }
        if (e.target.closest("[data-act=close]")) close(null);
        if (e.target.closest("[data-act=retry]")) load();
      });
      load();
    },
  }).then((v) => (v && typeof v === "object" ? v : null));
}
