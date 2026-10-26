/**
 * pages/noticeboard.page.js — Notice Board (ui/noticeboard/NoticeBoardScreen.kt).
 *
 * Two tabs (Student Notices, Admin Notices), grouped by year, newest first.
 * Each notice with a link opens in a new tab when the reader clicks it.
 */

import { esc, on } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, tabs, sampleBanner, loading, errorCard } from "../ui/components.js";
import * as N from "../data/notices.data.js";

const TAB_LABELS = { student: "Student Notices", admin: "Admin Notices" };

function noticeCard(n) {
  const iconName = n.type === "PDF" ? "picture_as_pdf" : "insert_drive_file";
  const tone = n.type === "PDF" ? "error" : n.type === "DOC" ? "primary" : "muted";
  const inner = `
    <span class="notice-card__icon notice-card__icon--${tone}">${icon(iconName, { size: 20 })}</span>
    <span class="notice-card__text">
      <span class="notice-card__title">${esc(n.title)}</span>
      ${n.type ? `<span class="notice-card__type">${esc(n.type)}</span>` : ""}
    </span>
    ${n.link ? icon("open_in_new", { size: 16, cls: "notice-card__open" }) : ""}`;
  return n.link
    ? `<a class="notice-card" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
    : `<div class="notice-card notice-card--static">${inner}</div>`;
}

function groupsHtml(list) {
  if (!list.length) return `<p class="notice-empty">No notices available</p>`;
  const map = new Map();
  for (const n of list) {
    const y = n.year || "Unknown";
    if (!map.has(y)) map.set(y, []);
    map.get(y).push(n);
  }
  return [...map.entries()]
    .sort((a, b) => (b[0] > a[0] ? 1 : b[0] < a[0] ? -1 : 0))
    .map(([year, items]) => `<h2 class="notice-year">${esc(year)}</h2><div class="notice-list">${items.map(noticeCard).join("")}</div>`)
    .join("");
}

export async function render(el) {
  let tab = "student";
  let data = null;
  let sample = false;
  let error = "";

  const paint = () => {
    const bar = topBar({ title: "Notice Board", actions: iconBtn("refresh", "Refresh", { "data-act": "refresh" }) });
    let inner;
    if (error) {
      inner = `<p class="notice-error" role="alert">${esc(error)}</p>`;
    } else if (!data) {
      inner = loading("Loading notices...");
    } else {
      inner = tabs([{ id: "student", label: TAB_LABELS.student }, { id: "admin", label: TAB_LABELS.admin }], tab, { scroll: true })
        + groupsHtml(data[tab] || []);
    }
    el.innerHTML = screen({ bar, body: (sample && data ? sampleBanner("the campus notice board") : "") + inner });
  };

  const load = async () => {
    error = "";
    data = null;
    paint();
    try {
      const r = await N.loadNotices();
      data = r.data;
      sample = r.sample;
    } catch (e) {
      error = e.message || "Could not reach the notice board. Check campus network/VPN.";
    }
    paint();
  };

  on(el, "click", "[data-tab]", (e, b) => { tab = b.dataset.tab; paint(); });
  on(el, "click", "[data-act=refresh]", () => load());

  await load();
  return () => {};
}
