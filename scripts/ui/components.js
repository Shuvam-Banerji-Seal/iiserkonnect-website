/**
 * ui/components.js — the app's Material 3 building blocks as HTML builders.
 *
 * Every builder returns a string; pages compose them and wire behaviour with
 * delegated listeners (ui/dom.js `on`). Names follow the Compose components
 * they stand in for (AppTopBar, SettingsGroup, SettingsNavRow, ErrorCard…),
 * so a page reads like the screen it ports.
 *
 * Text arguments are escaped here. Arguments named `html`, `body`, `actions`,
 * `leading`, `trailing` or `extra` are trusted markup built by other builders.
 */

import { esc } from "./dom.js";
import { icon } from "./icons.js";
import { prefs } from "../core/prefs.js";

export { icon, esc };

const attrs = (o = {}) => Object.entries(o)
  .filter(([, v]) => v !== false && v != null)
  .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`)).join("");

/* ── AppTopBar (44dp, primaryContainer @30%) ───────────────────── */
export function topBar({ title, subtitle = "", back = true, actions = "", backHref = "" } = {}) {
  const backBtn = back
    ? `<button class="icon-btn topbar__nav" type="button" data-back="${esc(backHref)}" aria-label="Back">${icon("arrow_back")}</button>`
    : "";
  return `<header class="topbar${back ? "" : " topbar--root"}">
    ${backBtn}
    <div class="topbar__titles">
      <h1 class="topbar__title">${esc(title)}</h1>
      ${subtitle ? `<div class="topbar__subtitle">${esc(subtitle)}</div>` : ""}
    </div>
    ${actions ? `<div class="topbar__actions">${actions}</div>` : ""}
  </header>`;
}

/**
 * A whole screen: top bar + scrolling body (+ optional FAB / bottom area).
 * `wide` lets data-heavy screens use more of a desktop window.
 */
export function screen({ bar, body, fab = "", bottom = "", wide = false, flush = false, cls = "" }) {
  return `${bar || ""}
  <div class="screen__scroll">
    <div class="screen__body${wide ? " screen__body--wide" : ""}${flush ? " screen__body--flush" : ""}${cls ? " " + cls : ""}">${body}</div>
  </div>
  ${bottom}
  ${fab ? `<div class="fab-slot">${fab}</div>` : ""}`;
}

export const iconBtn = (name, label, extra = {}) =>
  `<button class="icon-btn" type="button" aria-label="${esc(label)}" title="${esc(label)}"${attrs(extra)}>${icon(name)}</button>`;

/** variant: filled | tonal | outlined | text | elevated | danger | danger-text */
export function button(label, { variant = "filled", icon: ic = "", attrs: a = {}, small = false, block = false, disabled = false, type = "button" } = {}) {
  const cls = `btn btn--${variant}${small ? " btn--sm" : ""}${block ? " btn--block" : ""}`;
  return `<button class="${cls}" type="${type}"${disabled ? " disabled" : ""}${attrs(a)}>${ic ? icon(ic, { size: 18 }) : ""}<span>${esc(label)}</span></button>`;
}
export const linkButton = (label, href, { variant = "filled", icon: ic = "", external = false, block = false } = {}) =>
  `<a class="btn btn--${variant}${block ? " btn--block" : ""}" href="${esc(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${ic ? icon(ic, { size: 18 }) : ""}<span>${esc(label)}</span></a>`;

export const fab = (ic, label, a = {}, { extended = false } = {}) =>
  `<button class="fab${extended ? " fab--extended" : ""}" type="button" aria-label="${esc(label)}"${attrs(a)}>${icon(ic)}${extended ? `<span>${esc(label)}</span>` : ""}</button>`;

/* ── surfaces ──────────────────────────────────────────────────── */
/** tone: variant (surfaceVariant @50%, the app's default card) | high | highest | low | primary | secondary | tertiary | error | outline */
export function card(html, { tone = "variant", prism = true, cls = "", pad = true, tag = "div", a = {} } = {}) {
  return `<${tag} class="card card--${tone}${prism ? " card--prism" : ""}${pad ? "" : " card--flush"}${cls ? " " + cls : ""}"${attrs(a)}>${html}</${tag}>`;
}

/** Settings SectionHeader: 32dp icon tile + titleMedium. */
export const sectionHeader = (ic, title, accent = "primary") =>
  `<div class="section-header">${iconTile(ic, accent, 32)}<h2 class="t-title-m">${esc(title)}</h2></div>`;

/** A labelled list heading ("People on the network (3)"). */
export const listHeading = (text, extra = "") => `<h2 class="list-heading">${esc(text)}${extra}</h2>`;

/* ── settings (SettingsComponents.kt) ──────────────────────────── */
export const iconTile = (ic, accent = "primary", size = 40) =>
  `<span class="icon-tile icon-tile--${accent}" style="--tile:${size}px">${icon(ic, { size: Math.round(size * 0.55) })}</span>`;

export function settingsGroup(title, rows, { a = {} } = {}) {
  return `<section class="settings-group"${attrs(a)}>
    ${title ? `<h2 class="settings-group__title">${esc(title)}</h2>` : ""}
    <div class="settings-group__card neko-ears glass-med">${rows}</div>
  </section>`;
}
export const groupDivider = (inset = true) => `<div class="group-divider${inset ? " group-divider--inset" : ""}" role="separator"></div>`;

export function navRow({ icon: ic, accent = "primary", title, subtitle = "", href = "", badge = "", a = {} }) {
  const tag = href ? "a" : "button";
  const extra = href ? { href, ...a } : { type: "button", ...a };
  return `<${tag} class="nav-row"${attrs(extra)}>
    ${iconTile(ic, accent)}
    <span class="nav-row__text"><span class="nav-row__title">${esc(title)}</span>${subtitle ? `<span class="nav-row__sub">${esc(subtitle)}</span>` : ""}</span>
    ${badge ? `<span class="pill-badge">${esc(badge)}</span>` : ""}
    <span class="nav-row__chev">${icon("keyboard_arrow_right")}</span>
  </${tag}>`;
}

/**
 * SettingsSwitchRow: the WHOLE ROW is the switch (role=switch), so the label
 * and description are one big target, as in the app.
 */
export function switchRow({ icon: ic = "", accent = "primary", title, desc = "", checked = false, disabled = false, a = {} }) {
  return `<button type="button" class="switch-row" role="switch" aria-checked="${checked}"${disabled ? " disabled" : ""}${attrs(a)}>
    ${ic ? iconTile(ic, accent) : ""}
    <span class="switch-row__text"><span class="switch-row__title">${esc(title)}</span>${desc ? `<span class="switch-row__desc">${esc(desc)}</span>` : ""}</span>
    <span class="switch" aria-hidden="true"><span class="switch__thumb">${icon("check", { size: 16 })}</span></span>
  </button>`;
}

/** A bare M3 switch (for rows that are not whole-row toggles). */
export const switchEl = (checked, label, a = {}) =>
  `<button type="button" class="switch switch--bare" role="switch" aria-checked="${checked}" aria-label="${esc(label)}"${attrs(a)}><span class="switch__thumb">${icon("check", { size: 16 })}</span></button>`;

export const checkbox = (checked, label, a = {}) =>
  `<button type="button" class="checkbox" role="checkbox" aria-checked="${checked}" aria-label="${esc(label)}"${attrs(a)}>${icon("check", { size: 16 })}</button>`;

export const radio = (checked) => `<span class="radio${checked ? " radio--on" : ""}" aria-hidden="true"></span>`;

/** A radio choice row: radio + label + optional description. */
export function radioRow({ checked, title, desc = "", a = {} }) {
  return `<button type="button" class="radio-row" role="radio" aria-checked="${checked}"${attrs(a)}>
    ${radio(checked)}
    <span class="radio-row__text"><span class="radio-row__title">${esc(title)}</span>${desc ? `<span class="radio-row__desc">${esc(desc)}</span>` : ""}</span>
  </button>`;
}

/* ── inputs ────────────────────────────────────────────────────── */
/** Outlined text field with a floating label (OutlinedTextField). */
export function textField({ id = "", label = "", value = "", type = "text", placeholder = "", multiline = false, rows = 3,
  leading = "", trailing = "", supporting = "", error = "", a = {}, cls = "" } = {}) {
  const fid = id || "f" + Math.random().toString(36).slice(2, 8);
  const input = multiline
    ? `<textarea id="${esc(fid)}" class="field__input" rows="${rows}" placeholder="${esc(placeholder || " ")}"${attrs(a)}>${esc(value)}</textarea>`
    : `<input id="${esc(fid)}" class="field__input" type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder || " ")}"${attrs(a)}>`;
  return `<div class="field${leading ? " field--lead" : ""}${trailing ? " field--trail" : ""}${error ? " field--error" : ""}${cls ? " " + cls : ""}">
    ${leading ? `<span class="field__leading">${icon(leading)}</span>` : ""}
    ${input}
    ${label ? `<label class="field__label" for="${esc(fid)}">${esc(label)}</label>` : ""}
    ${trailing ? `<span class="field__trailing">${trailing}</span>` : ""}
    ${error || supporting ? `<div class="field__support">${esc(error || supporting)}</div>` : ""}
  </div>`;
}

/** The pill search field used by Settings, Notes, Chat. */
export function searchField({ id, placeholder = "Search", value = "", pill = true, a = {} }) {
  return `<div class="search${pill ? " search--pill" : ""}${value ? " has-value" : ""}">
    ${icon("search")}
    <input id="${esc(id)}" type="search" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off" aria-label="${esc(placeholder)}"${attrs(a)}>
    <button type="button" class="icon-btn search__clear" data-clear-search aria-label="Clear search">${icon("close")}</button>
  </div>`;
}

export function chip(label, { selected = false, icon: ic = "", a = {}, kind = "filter" } = {}) {
  const lead = selected && kind === "filter" ? icon("check", { size: 18 }) : ic ? icon(ic, { size: 18 }) : "";
  return `<button type="button" class="chip chip--${kind}${selected ? " chip--selected" : ""}" aria-pressed="${selected}"${attrs(a)}>${lead}<span>${esc(label)}</span></button>`;
}

/** Primary tabs (TabRow). tabs: [{id, label, badge}] */
export function tabs(list, active, { a = {}, scroll = false } = {}) {
  return `<div class="tabs${scroll ? " tabs--scroll" : ""}" role="tablist"${attrs(a)}>${list.map((t) =>
    `<button type="button" role="tab" class="tab${t.id === active ? " tab--active" : ""}" aria-selected="${t.id === active}" data-tab="${esc(t.id)}">
      <span class="tab__label">${esc(t.label)}${t.badge ? `<span class="badge">${esc(t.badge)}</span>` : ""}</span></button>`).join("")}</div>`;
}

/** Segmented button. options: [{value, label, icon}] */
export function segmented(options, value, { name = "seg", a = {} } = {}) {
  return `<div class="segmented" role="radiogroup"${attrs(a)}>${options.map((o) =>
    `<button type="button" role="radio" class="segmented__btn${o.value === value ? " is-on" : ""}" aria-checked="${o.value === value}" data-seg="${esc(name)}" data-value="${esc(o.value)}">${o.value === value ? icon("check", { size: 18 }) : o.icon ? icon(o.icon, { size: 18 }) : ""}<span>${esc(o.label)}</span></button>`).join("")}</div>`;
}

export const slider = ({ id, min = 0, max = 100, step = 1, value = 0, label = "", a = {} }) =>
  `<input type="range" class="slider" id="${esc(id)}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${esc(label)}" style="--val:${((value - min) / (max - min)) * 100}%"${attrs(a)}>`;

/* ── feedback & states ─────────────────────────────────────────── */
export const linearProgress = (value = null) => value == null
  ? `<div class="lprog lprog--indeterminate" role="progressbar" aria-label="Loading"><span></span></div>`
  : `<div class="lprog" role="progressbar" aria-valuenow="${Math.round(value * 100)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.max(0, Math.min(100, value * 100))}%"></span></div>`;

/** LoadingIndicator: the thinking orb + message. */
export const loading = (message = "Loading...") =>
  `<div class="loading" role="status"><span class="orb" aria-hidden="true"><i></i><i></i><i></i></span><p>${esc(message)}</p></div>`;

/** ErrorCard: errorContainer card, error icon, message, optional Retry. */
export function errorCard(message, { retry = false, retryAttrs = { "data-act": "retry" }, extra = "" } = {}) {
  return `<div class="error-card" role="alert">
    ${icon("error")}
    <p>${esc(message)}</p>
    ${extra}
    ${retry ? button("Retry", { attrs: retryAttrs }) : ""}
  </div>`;
}

/** The app's centred empty state: big tinted icon, title, hint, action. */
export function emptyState({ icon: ic = "info", title, body = "", action = "" }) {
  return `<div class="empty">
    <span class="empty__icon">${icon(ic, { size: 48 })}</span>
    <h2 class="empty__title">${esc(title)}</h2>
    ${body ? `<p class="empty__body">${esc(body)}</p>` : ""}
    ${action}
  </div>`;
}

/**
 * Honest note about what a browser cannot do — styled as the app's own
 * warning card (QR Billing's "Campus network needed"), never hidden.
 */
export function browserNote({ title, body, icon: ic = "info", tone = "info", extra = "" }) {
  return `<div class="note note--${tone}" role="note">
    <span class="note__icon">${icon(ic)}</span>
    <div class="note__text"><strong>${esc(title)}</strong><p>${esc(body)}</p>${extra}</div>
  </div>`;
}

/** Banner shown whenever a campus screen is drawing from sample data. */
export const sampleBanner = (what = "campus data") => {
  const why = prefs.get("dataSource") === "sample"
    ? `"Sample data only" is on (Settings → Advanced), so these are made-up examples — not your records.`
    : `${esc(what.charAt(0).toUpperCase() + what.slice(1))} can't be reached from this browser (campus servers don't answer other websites), so these are made-up examples — not your records.`;
  return `<div class="sample-banner" role="note">${icon("cloud_off", { size: 18 })}<p><strong>Sample data.</strong> ${why}</p></div>`;
};

export const badge = (n) => (n ? `<span class="badge">${n > 99 ? "99+" : esc(n)}</span>` : "");
export const pill = (text, tone = "secondary") => `<span class="pill pill--${tone}">${esc(text)}</span>`;

/* ── lists ─────────────────────────────────────────────────────── */
export function listItem({ leading = "", headline, supporting = "", trailing = "", href = "", a = {}, cls = "" }) {
  const tag = href ? "a" : a["data-act"] || a.role === "button" ? "button" : "div";
  const extra = href ? { href, ...a } : tag === "button" ? { type: "button", ...a } : a;
  return `<${tag} class="list-item${cls ? " " + cls : ""}"${attrs(extra)}>
    ${leading ? `<span class="list-item__lead">${leading}</span>` : ""}
    <span class="list-item__text"><span class="list-item__headline">${esc(headline)}</span>${supporting ? `<span class="list-item__supporting">${esc(supporting)}</span>` : ""}</span>
    ${trailing ? `<span class="list-item__trail">${trailing}</span>` : ""}
  </${tag}>`;
}

/** Letter avatar, tinted from the name (ChatAvatarColors-style). */
const AVATAR_TONES = ["primary", "secondary", "tertiary", "variant"];
export function avatar(name, { size = 44, tone = null, online = false, img = "" } = {}) {
  const letter = (String(name || "?").trim()[0] || "?").toUpperCase();
  let h = 0; for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) | 0;
  const t = tone || AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length];
  return `<span class="avatar avatar--${t}" style="--size:${size}px">${img ? `<img src="${esc(img)}" alt="">` : esc(letter)}${online ? '<span class="avatar__online"></span>' : ""}</span>`;
}

/** Stat block (label over value). */
export const stat = (label, value, { tone = "", sub = "" } = {}) =>
  `<div class="stat${tone ? " stat--" + tone : ""}"><span class="stat__label">${esc(label)}</span><span class="stat__value">${esc(value)}</span>${sub ? `<span class="stat__sub">${esc(sub)}</span>` : ""}</div>`;

/** External link that always opens a new tab. */
export const extLink = (label, url, cls = "") =>
  `<a class="ext-link${cls ? " " + cls : ""}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}${icon("open_in_new", { size: 16 })}</a>`;
