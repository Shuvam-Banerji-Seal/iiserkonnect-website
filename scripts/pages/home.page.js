/**
 * pages/home.page.js — Home (ui/home/HomeScreen.kt) and Customize Home
 * (ui/home/HomeCustomizeScreen.kt).
 *
 * Home: the greeting header, the "Today at a glance" box, then the user's
 * sections (grid / list / compact / carousel, four accents, collapsible),
 * revealed one after another. Everything is driven by the stored layout.
 */

import { prefs } from "../core/prefs.js";
import { collection, newId } from "../core/db.js";
import * as motion from "../core/motion.js";
import { nav } from "../core/router.js";
import { esc, on, longDate, rupees, ago, relativeDay, timeOf } from "../ui/dom.js";
import { icon, topBar, screen, button, chip, switchEl, textField, segmented, linearProgress, iconBtn } from "../ui/components.js";
import { dialog, menu, snackbar, confirm, sheet } from "../ui/overlay.js";
import {
  loadLayout, editLayout, ops, TILE_BY_ID, TILES, PRESETS, availableTileIds, renderGroups, compactColumns,
  columnsClamped, isExpandedOnHome, sectionSummary, accentLabel, unplacedTileIds, STYLES, ACCENTS, WIDGET_TODAY,
} from "../home/layout.js";
import { greetingTitle, contextCodeFor } from "../home/greeting.js";
import { loadTransactions, loadMenu, menuDayFor, currentOrNextMeal, mealMatches, itemName } from "../data/mess.data.js";
import { loadCampusEvents } from "../data/events.data.js";
import { loadDeadlines, deadlineSummary } from "../data/deadlines.data.js";
import { timer as timerLogic, formatRemaining, reminderRows, noteRows, plannerRows, occurrencesOnDay, nextTriggerAfter, parseRule } from "../productivity/logic.js";
import { isoDay } from "../ui/dom.js";

/* Where each tile goes (HomeScreen tileClick). External ones open a new tab. */
export const TILE_TARGETS = {
  mess_menu: "foodmenu", mess_transactions: "mess-transactions", event_calendar: "campus-events", qr_billing: "mess/qr-billing",
  calendar: "calendar", my_budget: "budget", library: "library", helpdesk: "helpdesk", voip: "voip-directory", chat: "chat",
  research: "research", welearn: "welearn/login", teaching_plans: "teaching-plan", course_selection: "course-selection",
  timetable: "schedule", grade_card: "grades", pyq: "pyq", attendance: "attendance", website: "website", vpn: "vpn",
  tcp_count: "tcpcount", network_status: "network-dashboard", sftp: "sftp", profile: "profile", downloads: "welearn/downloads",
  reminders: "reminders", notes: "notes", timer: "timer", stopwatch: "stopwatch", focus: "focus", planner: "planner",
  my_calendar: "my-calendar", home_customize: "home-customize", widget_agenda: "planner", widget_reminders: "reminders",
  widget_timer: "timer", widget_notes: "notes",
  academic_calendar: "pdf?title=Academic%20Calendar&url=" + encodeURIComponent("https://www.iiserkol.ac.in/web/academic/academic-calendar"),
  course_material: "website/vpnview?title=Course%20Material&url=" + encodeURIComponent("https://drive.google.com/drive/folders/1ddxItH9bU8zvQxof3hM8h4fMNNu8UTmw?usp=drive_link"),
};
export const TILE_EXTERNAL = {
  mess_recharge: "https://docs.google.com/forms/d/e/1FAIpQLSfRkplSmeklsEd8QWFpTFY3DTeuVpwUu-42SVYJtPsAgGmVvQ/viewform",
  reset_password: "https://www.iiserkol.ac.in/account/",
};
const tileHref = (id) => (TILE_EXTERNAL[id] ? TILE_EXTERNAL[id] : "#/" + (TILE_TARGETS[id] || "home"));
const extAttrs = (id) => (TILE_EXTERNAL[id] ? ' target="_blank" rel="noopener noreferrer"' : "");

const PAW = `<svg class="paw" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><ellipse cx="12" cy="16.4" rx="5.6" ry="4.4"/><ellipse cx="5.6" cy="10.8" rx="2.1" ry="2.6"/><ellipse cx="9.4" cy="6.9" rx="2" ry="2.6"/><ellipse cx="14.6" cy="6.9" rx="2" ry="2.6"/><ellipse cx="18.4" cy="10.8" rx="2.1" ry="2.6"/></svg>`;

/* ── tile renderers (HomeTileCard / HomeTileRow / HomeTileChip) ── */
const accentCls = (a) => (a && a !== "DEFAULT" ? ` acc--${a.toLowerCase()}` : "");

export function tileCard(t, accent, extra = "") {
  return `<a class="tile neko-ears glass-low${accentCls(accent)}" href="${esc(tileHref(t.id))}"${extAttrs(t.id)} ${extra}>
    <span class="tile__icon">${icon(t.icon)}</span>
    <span class="tile__label">${esc(t.label)}</span>${PAW}</a>`;
}
export function tileRow(t, accent) {
  return `<a class="tile-row${accentCls(accent)}" href="${esc(tileHref(t.id))}"${extAttrs(t.id)}>
    ${icon(t.icon, { size: 16 })}<span class="tile-row__label">${esc(t.label)}</span>${icon("keyboard_arrow_right", { size: 16, cls: "tile-row__chev" })}</a>`;
}
export function tileChip(t, accent) {
  return `<a class="tile-chip${accentCls(accent)}" href="${esc(tileHref(t.id))}"${extAttrs(t.id)}>
    ${icon(t.icon, { size: 16 })}<span class="tile-chip__label">${esc(t.label)}</span></a>`;
}

/** HomeSectionBody */
export function sectionBody(section, items, renderWidget, widthPx = 358) {
  const groups = renderGroups(items, section.style === "GRID");
  return groups.map((g) => {
    if (g.kind === "widget") return renderWidget(g.tile);
    if (g.kind === "wide") return `<div class="tile-grid" style="--cols:${g.tiles.length === 1 ? 2 : 2}">${g.tiles.map((t) => tileCard(t, section.accent)).join("")}</div>`;
    switch (section.style) {
      case "LIST": return `<div class="tile-list">${g.tiles.map((t) => tileRow(t, section.accent)).join("")}</div>`;
      case "COMPACT": return `<div class="tile-grid tile-grid--compact" style="--cols:${compactColumns(widthPx)}">${g.tiles.map((t) => tileChip(t, section.accent)).join("")}</div>`;
      case "CAROUSEL": return `<div class="tile-carousel">${g.tiles.map((t) => tileCard(t, section.accent)).join("")}</div>`;
      default: return `<div class="tile-grid" style="--cols:${columnsClamped(section)}">${g.tiles.map((t) => tileCard(t, section.accent)).join("")}</div>`;
    }
  }).join("");
}

/* ── the Today box (TodayDashboardCard) ── */
function dashRow({ icon: ic, label, value, detail = "", href, emphasise = false }) {
  return `<a class="dash-row${emphasise ? " dash-row--urgent" : ""}" href="${esc(href)}">
    ${icon(ic, { size: 20, cls: "dash-row__icon" })}
    <span class="dash-row__text"><span class="dash-row__label">${esc(label)}</span><span class="dash-row__value">${esc(value)}</span>${detail ? `<span class="dash-row__detail">${esc(detail)}</span>` : ""}</span>
    ${icon("keyboard_arrow_right", { size: 18, cls: "dash-row__chev" })}</a>`;
}
function todayCard(d) {
  const rows = [];
  if (d.balance || d.balanceHint) rows.push(dashRow({ icon: "account_balance_wallet", label: "Mess balance", value: d.balance || "—", detail: d.balanceHint, href: "#/mess-transactions" }));
  if (d.nextMeal) rows.push(dashRow({ icon: "restaurant", label: "Next meal", value: d.nextMeal.title, detail: d.nextMeal.items, href: "#/foodmenu" + (d.nextMeal.meal ? "?meal=" + encodeURIComponent(d.nextMeal.meal) : "") }));
  if (d.event) rows.push(dashRow({ icon: "event", label: "Campus events", value: d.event.title, detail: d.event.detail, href: "#/campus-events" }));
  if (d.deadlines) rows.push(dashRow({ icon: "event_note", label: "Deadlines", value: d.deadlines.text, href: "#/deadlines", emphasise: d.deadlines.urgent }));
  const nothing = !rows.length && !d.loading;
  return `<section class="dash-card neko-ears glass-high" aria-label="Today at a glance">
    ${rows.join("")}
    ${nothing ? `<p class="t-body-s c-muted">Nothing to show yet — your balance, next meal and events appear here once they have loaded.</p>` : ""}
    ${d.loading ? linearProgress() : ""}
    ${d.sample && rows.length ? `<p class="dash-card__sample">${icon("cloud_off", { size: 14 })} Sample data — campus is not reachable from this browser</p>` : ""}
  </section>`;
}

async function resolveDashboard() {
  const out = { loading: false, sample: false };
  const now = new Date();
  const [mess, menuR, ev, dl] = await Promise.allSettled([loadTransactions(), loadMenu(), loadCampusEvents(), loadDeadlines()]);
  if (mess.status === "fulfilled") {
    const tx = mess.value.data.transactions;
    out.sample ||= mess.value.sample;
    if (tx.length) {
      out.balance = rupees(tx[0].balance);
      out.balanceHint = mess.value.sample ? `Updated ${ago(tx[0].at)} · sample` : `${tx.length} transactions synced`;
    } else out.balanceHint = "No transactions yet";
  }
  if (menuR.status === "fulfilled") {
    const m = menuR.value.data;
    out.sample ||= menuR.value.sample;
    const today = menuDayFor(m, now), tomorrow = menuDayFor(m, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    if (today) {
      const labels = today.meals.map((x) => x.type);
      const c = currentOrNextMeal(now, labels, tomorrow ? tomorrow.meals.map((x) => x.type) : labels);
      if (c) {
        const day = c.tomorrow && tomorrow ? tomorrow : today;
        const meal = day.meals.find((x) => mealMatches(x.type, c.meal));
        if (meal) out.nextMeal = { title: c.tomorrow ? `Tomorrow · ${meal.type}` : meal.type, items: meal.items.slice(0, 5).map(itemName).join(", "), meal: c.meal };
      }
    }
  }
  if (ev.status === "fulfilled") {
    out.sample ||= ev.value.sample;
    const events = ev.value.data.events;
    const lookTomorrow = now.getHours() >= 20;
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (lookTomorrow ? 1 : 0));
    const sameDay = events.filter((e) => isoDay(new Date(e.start)) === isoDay(target));
    const e = sameDay[0] || events.find((x) => x.start >= target.getTime());
    if (e) {
      const label = isoDay(new Date(e.start)) !== isoDay(target) ? "Upcoming" : lookTomorrow ? "Tomorrow" : "Today";
      const left = events.filter((x) => x.start >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()).length;
      out.event = { title: `${label}: ${e.title}`, detail: `${timeOf(new Date(e.start))} at ${e.venue || "Campus"}${left > 1 ? ` · ${left} left this week` : ""}` };
    }
  }
  if (dl.status === "fulfilled") {
    out.sample ||= dl.value.sample;
    out.deadlines = deadlineSummary(dl.value.data.assignments);
  }
  return out;
}

/* ── live cards (HomeWidgets.kt) ── */
function widgetCard(tile, inner, trailing = "") {
  return `<a class="widget" href="#/${TILE_TARGETS[tile.id]}">
    <span class="widget__head">${icon(tile.icon, { size: 16 })}<span class="widget__title">${esc(tile.label)}</span>${trailing ? `<span class="widget__trail">${esc(trailing)}</span>` : ""}</span>
    <span class="widget__lines">${inner}</span></a>`;
}
const lines = (arr, empty) => (arr.length ? arr.map((l) => `<span class="widget__line">${esc(l)}</span>`).join("") : `<span class="widget__empty">${esc(empty)}</span>`);

async function widgetData() {
  const [reminders, notes, tasks, events] = await Promise.all(["reminders", "notes", "tasks", "events"].map((c) => collection(c).all().catch(() => [])));
  return { reminders, notes, tasks, events };
}
function renderWidget(tile, w, campus) {
  const now = Date.now();
  if (tile.id === "widget_reminders") {
    const up = w.reminders.filter((r) => r.enabled).map((r) => ({ r, at: parseRule(r.repeatRule) === "NONE" ? (r.triggerAtMillis > now ? r.triggerAtMillis : null) : nextTriggerAfter(r.triggerAtMillis, now, r.repeatRule, r.anchorDayOfMonth) }))
      .filter((x) => x.at).sort((a, b) => a.at - b.at);
    const shown = up.slice(0, 3);
    return widgetCard(tile, lines(shown.map(({ r, at }) => `${relativeDay(new Date(at))}, ${timeOf(new Date(at))}  ·  ${r.title || "Reminder"}${parseRule(r.repeatRule) !== "NONE" ? "  ·  " + r.repeatRule.toLowerCase() : ""}`), "No upcoming reminders."),
      up.length > 3 ? "3+" : shown.length ? String(shown.length) : "");
  }
  if (tile.id === "widget_notes") {
    const recent = noteRows(w.notes).slice(0, 3);
    return widgetCard(tile, lines(recent.map((n) => { const b = (n.body || "").split("\n").find((x) => x.trim()) || ""; const t = n.title || "(no title)"; return b ? `${t}  ·  ${b}` : t; }), "No notes yet."), recent.length ? String(recent.length) : "");
  }
  if (tile.id === "widget_timer") {
    const t = prefs.get("timerState");
    let line = "No timer running.";
    const label = t && t.label ? `  ·  ${t.label}` : "";
    if (t && t.endAtMillis && timerLogic.isFinished(t, now)) line = "Time's up" + label;
    else if (t && t.endAtMillis) line = formatRemaining(timerLogic.remaining(t, now)) + label;
    else if (t && t.remainingMillis != null) line = "Paused · " + formatRemaining(t.remainingMillis);
    return widgetCard(tile, `<span class="widget__line" data-live-timer>${esc(line)}</span>`, t ? "" : "idle");
  }
  if (tile.id === "widget_agenda") {
    const today = isoDay(new Date());
    const tasks = plannerRows(w.tasks).filter((t) => !t.done && t.dueDay === today).slice(0, 3);
    const occ = occurrencesOnDay(w.events, today).map((o) => `${o.allDay ? "All day" : timeOf(new Date(o.occStart))}  ·  ${o.title}`);
    const camp = campus.filter((e) => isoDay(new Date(e.start)) === today).map((e) => `${timeOf(new Date(e.start))}  ·  ${e.title}  ·  Campus`);
    const all = [...occ, ...camp, ...tasks.map((t) => t.title)];
    return widgetCard(tile, lines(all.slice(0, 4), "Nothing planned for today."), all.length ? `${all.length} today` : "");
  }
  return widgetCard(tile, "");
}

/* ── Home ── */
export async function render(el) {
  const layout = loadLayout();
  const profile = prefs.get("profile");
  const creds = (await import("../core/session.js")).creds.get();
  const display = (profile.name || "").trim().split(/\s+/)[0] || (creds && creds.u ? "" : "");
  const now = new Date();
  const code = contextCodeFor(now);

  const avatar = profile.avatar
    ? `<img src="${esc(profile.avatar)}" alt="">`
    : `<span>${esc(((profile.name || "").trim()[0] || "?").toUpperCase())}</span>`;

  el.innerHTML = `
    <header class="greeting">
      <div class="greeting__row">
        <button class="greeting__avatar" type="button" data-act="avatar" aria-label="Edit profile photo">${avatar}</button>
        <div class="greeting__text">
          <h1 class="greeting__title">${esc(greetingTitle(now.getHours(), display))}</h1>
          <p class="greeting__date">${esc(longDate(now))}</p>
        </div>
        <a class="vpn-pill" href="#/vpn" aria-label="VPN status: VPN Off">${icon("vpn_key_off", { size: 16 })}<span>VPN Off</span></a>
      </div>
      <p class="greeting__context">${esc(code.line)}</p>
    </header>
    <div class="screen__scroll">
      <div class="screen__body home-body" id="home-sections"></div>
    </div>`;

  const host = el.querySelector("#home-sections");
  const sftp = !!prefs.get("sftpEnabled");
  const avail = availableTileIds(sftp);
  const visible = layout.sections.filter((s) => !s.hidden).map((s) => {
    const items = s.items.map((i) => ({ tile: TILE_BY_ID[i.id], wide: !!i.wide })).filter((x) => x.tile && avail.has(x.tile.id));
    return items.length ? { s, items } : null;
  }).filter(Boolean);

  let dash = { loading: true };
  let widgets = { reminders: [], notes: [], tasks: [], events: [] };
  let campus = [];

  const renderW = (tile) => (tile.id === WIDGET_TODAY ? `<div data-today>${todayCard(dash)}</div>` : `<div data-widget="${tile.id}">${renderWidget(tile, widgets, campus)}</div>`);

  if (!visible.length) {
    host.innerHTML = `<div class="home-empty card card--high">
      <h2 class="t-title-m w-bold">Your home is empty</h2>
      <p class="t-body-m c-muted">Every section is hidden or has no tiles. Add some back, or start again from a template.</p>
      <a class="btn btn--filled" href="#/home-customize">${icon("tune", { size: 18 })}<span>Customize Home</span></a></div>`;
  } else {
    const width = Math.min(host.clientWidth || 358, 760) - 32;
    host.innerHTML = visible.map(({ s, items }, i) => `
      <section class="home-section" data-section="${esc(s.id)}">
        ${i > 0 ? `<div class="home-divider"></div>` : ""}
        ${s.showTitle ? `<button class="home-section__head" type="button" data-act="toggle" data-id="${esc(s.id)}" aria-expanded="${!s.collapsed}" aria-label="${esc((s.collapsed ? "Expand " : "Collapse ") + s.title)}">
          <h2>${esc(s.title)}</h2>${icon("expand_less", { size: 16, cls: "home-section__chev" })}</button>` : ""}
        <div class="home-section__body"${isExpandedOnHome(s) ? "" : " hidden"}>${sectionBody(s, items, renderW, width)}</div>
      </section>`).join("");
    // sections appear one after another (HomeScreen sectionsRevealed: 80ms, then 100ms apart)
    if (motion.enabled()) {
      const s = motion.spec();
      host.querySelectorAll(".home-section").forEach((sec, i) => sec.animate(
        [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }],
        { duration: s.dur, easing: s.ease, delay: 80 + i * 100, fill: "backwards" }));
    }
  }

  // collapse / expand (and long-press → Customize, like the app)
  on(host, "click", "[data-act=toggle]", (e, b) => {
    const id = b.dataset.id;
    const next = editLayout((l) => ops.setCollapsed(l, id, !l.sections.find((x) => x.id === id).collapsed));
    const s = next.sections.find((x) => x.id === id);
    const body = b.parentElement.querySelector(".home-section__body");
    b.setAttribute("aria-expanded", String(!s.collapsed));
    b.setAttribute("aria-label", (s.collapsed ? "Expand " : "Collapse ") + s.title);
    if (s.collapsed) {
      motion.animate(body, [{ opacity: 1, maxHeight: body.scrollHeight + "px" }, { opacity: 0, maxHeight: "0px" }]).then(() => { body.hidden = true; });
    } else {
      body.hidden = false;
      motion.animate(body, [{ opacity: 0, maxHeight: "0px" }, { opacity: 1, maxHeight: body.scrollHeight + "px" }]);
    }
  });
  let press;
  on(host, "pointerdown", "[data-act=toggle]", () => { press = setTimeout(() => { press = "long"; nav.go("home-customize"); }, 550); });
  on(host, "pointerup", "[data-act=toggle]", () => { if (press !== "long") clearTimeout(press); });
  on(host, "pointerleave", "[data-act=toggle]", () => clearTimeout(press));

  el.querySelector("[data-act=avatar]").addEventListener("click", () => editAvatar(() => nav.reload()));

  // live data: dashboard + widgets
  let alive = true;
  const needs = new Set(visible.flatMap((v) => v.items.map((i) => i.tile.id)));
  if (needs.has(WIDGET_TODAY)) resolveDashboard().then((d) => { if (!alive) return; dash = d; const t = host.querySelector("[data-today]"); if (t) t.innerHTML = todayCard(d); });
  const widgetIds = [...needs].filter((id) => id.startsWith("widget_") && id !== WIDGET_TODAY);
  const refreshWidgets = async () => {
    widgets = await widgetData();
    if (needs.has("widget_agenda")) { try { campus = (await loadCampusEvents()).data.events; } catch { campus = []; } }
    if (!alive) return;
    for (const id of widgetIds) { const n = host.querySelector(`[data-widget="${id}"]`); if (n) n.innerHTML = renderWidget(TILE_BY_ID[id], widgets, campus); }
  };
  if (widgetIds.length) refreshWidgets();
  const tick = widgetIds.includes("widget_timer") ? setInterval(() => {
    const n = host.querySelector('[data-widget="widget_timer"]'); if (n) n.innerHTML = renderWidget(TILE_BY_ID.widget_timer, widgets, campus);
  }, 1000) : null;
  return () => { alive = false; if (tick) clearInterval(tick); };
}

/* EditAvatarDialog: change photo (cropped square, kept in this browser) or reset. */
export async function editAvatar(after) {
  const has = !!prefs.get("profile").avatar;
  const v = await dialog({
    title: "Profile photo",
    body: `<p>Your photo stays in this browser only. It is shown on Home and in Settings.</p>`,
    actions: [
      ...(has ? [{ label: "Remove photo", value: "reset" }] : []),
      { label: "Cancel", value: null },
      { label: "Change photo", value: "change", primary: true },
    ],
  });
  if (v === "reset") { prefs.patch("profile", { avatar: null }); after && after(); return; }
  if (v !== "change") return;
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*";
  input.onchange = async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    try {
      const url = await squareThumb(f, 256);
      prefs.patch("profile", { avatar: url });
      after && after();
    } catch { snackbar("That image could not be read."); }
  };
  input.click();
}
function squareThumb(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const u = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement("canvas"); c.width = c.height = size;
      c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(u);
      resolve(c.toDataURL("image/jpeg", 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(u); reject(new Error("bad image")); };
    img.src = u;
  });
}

/* ═══════════════════ Customize Home ═══════════════════ */
export async function renderCustomize(el) {
  const draw = (scrollTo = null) => {
    const l = loadLayout();
    const body = `
      <div class="card card--container templates">
        <h2 class="t-title-s">Start from a template</h2>
        <p class="t-body-s c-muted">Classic is the layout the app ships with.</p>
        <div class="chips mt-sm">${PRESETS.map((p) => chip(p.name, { kind: "assist", a: { "data-preset": p.id } })).join("")}</div>
      </div>
      <p class="t-body-s c-muted customize-hint">Sections appear on Home top to bottom. Each tile lives in one section — use a tile's ⋮ menu to move it.</p>
      ${l.sections.map((s, i) => sectionEditor(s, i === 0, i === l.sections.length - 1)).join("")}
      <div style="height:88px"></div>`;
    const scroller = el.querySelector(".screen__scroll");
    const keep = scroller ? scroller.scrollTop : 0;
    el.innerHTML = screen({
      bar: topBar({ title: "Customize Home" }),
      body,
      fab: `<button class="fab fab--extended" type="button" data-act="add-section">${icon("add")}<span>Add section</span></button>`,
    });
    const sc = el.querySelector(".screen__scroll");
    if (scrollTo) el.querySelector(`[data-sec="${CSS.escape(scrollTo)}"]`)?.scrollIntoView({ block: "center", behavior: motion.enabled() ? "smooth" : "auto" });
    else sc.scrollTop = keep;
  };

  function sectionEditor(s, first, last) {
    const rows = s.items.map((it, idx) => {
      const t = TILE_BY_ID[it.id]; if (!t) return "";
      const note = t.isWidget ? "Live card" : it.wide && s.style === "GRID" ? "Full width" : "";
      return `<div class="tile-editor">
        ${icon(t.icon, { cls: "c-primary" })}
        <div class="grow"><div class="t-body-m ellipsis">${esc(t.label)}</div>${note ? `<div class="t-label-s c-muted">${note}</div>` : ""}</div>
        ${iconBtn("arrow_upward", `Move ${t.label} up`, { "data-act": "tile-up", "data-sec": s.id, "data-tile": t.id, disabled: idx === 0 })}
        ${iconBtn("arrow_downward", `Move ${t.label} down`, { "data-act": "tile-down", "data-sec": s.id, "data-tile": t.id, disabled: idx === s.items.length - 1 })}
        ${iconBtn("more_vert", `More options for ${t.label}`, { "data-act": "tile-menu", "data-sec": s.id, "data-tile": t.id, "data-idx": idx, "data-n": s.items.length })}
      </div>`;
    }).join("");
    return `<div class="card card--high section-editor" data-sec="${esc(s.id)}">
      <div class="row section-editor__head">
        <div class="grow${s.hidden ? " is-hidden" : ""}">
          <div class="t-title-s w-semi ellipsis">${esc(s.title)}</div>
          <div class="t-label-s c-muted">${esc((s.hidden ? "Hidden on Home  ·  " : "") + sectionSummary(s))}</div>
        </div>
        ${iconBtn("arrow_upward", `Move section ${s.title} up`, { "data-act": "sec-up", "data-sec": s.id, disabled: first })}
        ${iconBtn("arrow_downward", `Move section ${s.title} down`, { "data-act": "sec-down", "data-sec": s.id, disabled: last })}
        ${iconBtn("more_vert", `More options for section ${s.title}`, { "data-act": "sec-menu", "data-sec": s.id, "data-first": first, "data-last": last })}
      </div>
      ${s.items.length ? "" : `<p class="t-body-s c-muted" style="padding:4px 0 0">No tiles yet — an empty section is not shown on Home.</p>`}
      ${rows}
      <div class="row">
        <button class="btn btn--text" type="button" data-act="add-tile" data-sec="${esc(s.id)}">${icon("add", { size: 18 })}<span>Add tile</span></button>
        <button class="btn btn--text" type="button" data-act="design" data-sec="${esc(s.id)}">${icon("palette", { size: 18 })}<span>Design</span></button>
      </div>
    </div>`;
  }

  const edit = (fn, scrollTo) => { editLayout(fn); draw(scrollTo); };

  el.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act], [data-preset]");
    if (!b || b.disabled) return;
    const sec = b.dataset.sec, tile = b.dataset.tile;
    const l = loadLayout();
    const s = l.sections.find((x) => x.id === sec);
    if (b.dataset.preset) {
      const p = PRESETS.find((x) => x.id === b.dataset.preset);
      const ok = await confirm({ title: `Use the ${p.name} template?`, text: `${p.description}\n\nThis replaces your current sections and tiles. It cannot be undone, but you can switch templates again at any time.`, confirmLabel: "Replace" });
      if (ok) { prefs.set("homeLayout", p.build()); draw(); }
      return;
    }
    switch (b.dataset.act) {
      case "sec-up": return edit((x) => ops.moveSection(x, sec, -1));
      case "sec-down": return edit((x) => ops.moveSection(x, sec, 1));
      case "tile-up": return edit((x) => ops.moveTile(x, sec, tile, -1));
      case "tile-down": return edit((x) => ops.moveTile(x, sec, tile, 1));
      case "sec-menu": {
        const items = [{ label: "Rename…", value: "rename" }, { label: "Design…", value: "design" }];
        if (b.dataset.first !== "true") items.push({ label: "Move to top", value: "top" });
        if (b.dataset.last !== "true") items.push({ label: "Move to bottom", value: "bottom" });
        items.push({ label: s.hidden ? "Show on Home" : "Hide on Home", value: "hide" }, { divider: true }, { label: "Delete…", value: "delete", danger: true });
        const v = await menu(b, items);
        if (v === "rename") { const name = await nameDialog("Rename section", s.title, "Save"); if (name) edit((x) => ops.rename(x, sec, name)); }
        if (v === "design") designDialog(sec, () => draw());
        if (v === "top") edit((x) => ops.moveSectionToEdge(x, sec, true));
        if (v === "bottom") edit((x) => ops.moveSectionToEdge(x, sec, false));
        if (v === "hide") edit((x) => ops.setHidden(x, sec, !s.hidden));
        if (v === "delete") {
          const n = s.items.length;
          const ok = await confirm({ title: `Delete section “${s.title}”?`, text: (n === 0 ? "It has no tiles." : n === 1 ? "Its 1 tile goes back to the Add-tile list." : `Its ${n} tiles go back to the Add-tile list.`) + " Templates can bring back any layout.", confirmLabel: "Delete" });
          if (ok) edit((x) => ops.deleteSection(x, sec));
        }
        return;
      }
      case "tile-menu": {
        const idx = +b.dataset.idx, n = +b.dataset.n;
        const t = TILE_BY_ID[tile];
        const it = s.items.find((x) => x.id === tile);
        const items = [];
        if (idx > 0) items.push({ label: "Move to top", value: "top" });
        if (idx < n - 1) items.push({ label: "Move to bottom", value: "bottom" });
        items.push({ label: "Move to section…", value: "move" });
        if (!t.isWidget && s.style === "GRID") items.push({ label: "Full width", value: "wide", checked: !!it.wide });
        items.push({ divider: true }, { label: "Remove from Home", value: "remove", danger: true });
        const v = await menu(b, items);
        if (v === "top") edit((x) => ops.moveTileToEdge(x, sec, tile, true));
        if (v === "bottom") edit((x) => ops.moveTileToEdge(x, sec, tile, false));
        if (v === "wide") edit((x) => ops.setTileWide(x, sec, tile, !it.wide));
        if (v === "remove") edit((x) => ops.removeTile(x, sec, tile));
        if (v === "move") {
          const targets = l.sections.filter((x) => x.id !== sec);
          const to = await dialog({
            title: `Move ${t.label} to…`,
            body: targets.length ? `<div class="list">${targets.map((x) => `<button type="button" class="list-item" data-to="${esc(x.id)}"><span class="list-item__text"><span class="list-item__headline">${esc(x.title)}</span>${x.hidden ? '<span class="list-item__supporting">Hidden</span>' : ""}</span></button>`).join("")}</div>`
              : `<p>There is no other section to move it to. Add a section first.</p>`,
            actions: [{ label: "Cancel", value: null }],
            onMount: (d, close) => d.addEventListener("click", (ev) => { const r = ev.target.closest("[data-to]"); if (r) close(r.dataset.to); }),
          });
          if (to) edit((x) => ops.moveTileToSection(x, sec, tile, to), to);
        }
        return;
      }
      case "add-tile": {
        const ids = unplacedTileIds(l, !!prefs.get("sftpEnabled"));
        const plain = ids.filter((id) => !TILE_BY_ID[id].isWidget), cards = ids.filter((id) => TILE_BY_ID[id].isWidget);
        const group = (h, list) => list.length ? `<h3 class="t-label-l c-primary" style="margin:8px 0 4px">${h}</h3>${list.map((id) => `<button type="button" class="list-item" data-pick="${id}">${icon(TILE_BY_ID[id].icon, { cls: "c-primary" })}<span class="list-item__text"><span class="list-item__headline">${esc(TILE_BY_ID[id].label)}</span></span></button>`).join("")}` : "";
        const pick = await dialog({
          title: s.title ? `Add to ${s.title}` : "Add a tile",
          body: ids.length ? group("Tiles", plain) + group("Live cards", cards) : `<p>Every tile is already on your Home. Remove one from a section first — a tile can only be in one place at a time.</p>`,
          actions: [{ label: "Close", value: null }],
          onMount: (d, close) => d.addEventListener("click", (ev) => { const r = ev.target.closest("[data-pick]"); if (r) close(r.dataset.pick); }),
        });
        if (pick) edit((x) => ops.addTile(x, sec, pick));
        return;
      }
      case "design": return designDialog(sec, () => draw());
      case "add-section": {
        const name = await nameDialog("New section", "", "Add");
        if (name != null) { const id = "custom_" + newId().slice(0, 8); edit((x) => ops.addSection(x, id, name), id); }
        return;
      }
    }
  });
  draw();
}

function nameDialog(title, initial, confirmLabel) {
  return dialog({
    title,
    body: textField({ id: "section-name", label: "Section name", value: initial }),
    actions: [{ label: "Cancel", value: null }, { label: confirmLabel, value: "ok", primary: true }],
  }).then((v) => (v === "ok" ? (document.getElementById("section-name")?.value ?? initial) : null));
}

/** Design dialog: layout, columns, accent, title / collapsed / hidden, live preview. */
function designDialog(sectionId, after) {
  const body = () => {
    const s = loadLayout().sections.find((x) => x.id === sectionId);
    const tiles = s.items.map((i) => ({ tile: TILE_BY_ID[i.id], wide: i.wide })).filter((x) => x.tile);
    const preview = tiles.length ? `<div class="design-preview">${sectionBody(s, tiles.slice(0, 6), (t) => `<div class="design-preview__widget">${esc(t.label)}</div>`, 320)}</div>`
      : `<p class="t-body-s c-muted">Add tiles to see a preview.</p>`;
    return `
      ${preview}
      <h3 class="t-label-l">Layout</h3>
      <div class="chips">${STYLES.map((st) => chip({ GRID: "Grid", LIST: "List", COMPACT: "Compact", CAROUSEL: "Carousel" }[st], { selected: s.style === st, a: { "data-style": st } })).join("")}</div>
      ${s.style === "GRID" ? `<h3 class="t-label-l">Columns</h3><div class="chips">${[2, 3, 4].map((c) => chip(String(c), { selected: columnsClamped(s) === c, a: { "data-cols": c } })).join("")}</div>` : ""}
      <h3 class="t-label-l">Accent</h3>
      <div class="accent-row">${ACCENTS.map((a) => `<button type="button" class="accent-dot acc--${a.toLowerCase()}${s.accent === a ? " is-on" : ""}" data-accent="${a}" aria-label="${accentLabel(a)} accent${s.accent === a ? ", selected" : ""}" aria-pressed="${s.accent === a}">${s.accent === a ? icon("check", { size: 18 }) : ""}</button>`).join("")}</div>
      <div class="design-switches">
        ${dsw("Show title", "showTitle", s.showTitle)}
        ${s.showTitle ? dsw("Collapsed on Home", "collapsed", s.collapsed) : ""}
        ${dsw("Hidden on Home", "hidden", s.hidden)}
      </div>`;
  };
  const dsw = (label, key, on) => `<button type="button" class="design-switch" role="switch" aria-checked="${on}" data-sw="${key}"><span>${label}</span><span class="switch" aria-hidden="true"><span class="switch__thumb"></span></span></button>`;
  const title = loadLayout().sections.find((x) => x.id === sectionId).title;
  return dialog({
    title: `Design: ${title}`,
    body: `<div class="design" id="design-body">${body()}</div>`,
    actions: [{ label: "Done", value: true }],
    onMount: (d) => {
      d.addEventListener("click", (e) => {
        const t = e.target.closest("[data-style],[data-cols],[data-accent],[data-sw]");
        if (!t) return;
        if (t.dataset.style) editLayout((x) => ops.setStyle(x, sectionId, t.dataset.style));
        if (t.dataset.cols) editLayout((x) => ops.setColumns(x, sectionId, +t.dataset.cols));
        if (t.dataset.accent) editLayout((x) => ops.setAccent(x, sectionId, t.dataset.accent));
        if (t.dataset.sw) {
          const s = loadLayout().sections.find((x) => x.id === sectionId);
          const k = t.dataset.sw;
          editLayout((x) => (k === "showTitle" ? ops.setShowTitle(x, sectionId, !s.showTitle) : k === "collapsed" ? ops.setCollapsed(x, sectionId, !s.collapsed) : ops.setHidden(x, sectionId, !s.hidden)));
        }
        d.querySelector("#design-body").innerHTML = body();
      });
    },
  }).then(() => after && after());
}
