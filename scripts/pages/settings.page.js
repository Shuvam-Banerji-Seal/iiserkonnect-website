/**
 * pages/settings.page.js — Settings hub and its sections
 * (ui/settings/SettingsScreen.kt, SettingsComponents.kt, SettingsSearchIndex.kt).
 *
 * The hub: profile card, search, grouped rows (Personalise, Account & privacy,
 * Features & storage, Mess, Help & info). Each nav row opens settings/<section>.
 * Every switch is a whole-row switch, as in the app.
 */

import { prefs } from "../core/prefs.js";
import { applyTheme, THEME_OPTIONS, themeLabel, NEKO_COATS, NEKO_THEME_MODE, EINK_THEME_MODE, EINK_DARK_THEME_MODE, normalizeHexInput, currentTheme } from "../core/theme.js";
import * as motion from "../core/motion.js";
import { creds } from "../core/session.js";
import { collection, storageBackend, storageEstimate, COLLECTIONS } from "../core/db.js";
import { store } from "../core/store.js";
import { nav } from "../core/router.js";
import { permission, requestPermission, notificationsSupported, ALARM_NOTE } from "../core/notify.js";
import { isAcceptablePin, setPin, checkPin, disableLock, TIMEOUTS, MIN_PIN_LENGTH, MAX_PIN_LENGTH, platformAuthAvailable, enrollFingerprint, cryptoAvailable } from "../core/applock.js";
import { clearCaches } from "../services/source.js";
import { readLog } from "../core/log.js";
import { esc, on, formatBytes, ago } from "../ui/dom.js";
import {
  icon, topBar, screen, button, linkButton, settingsGroup, groupDivider, navRow, switchRow, switchEl, radioRow,
  textField, searchField, chip, sectionHeader, browserNote, slider, pill, iconTile,
} from "../ui/components.js";
import { dialog, confirm, menu, snackbar, toast } from "../ui/overlay.js";
import { haptics, STRENGTHS, canVibrate } from "../ui/haptics.js";
import { editAvatar } from "./home.page.js";

export const APP_VERSION = "0.9.80";
/** The developer contact the About page has always linked to (owner's choice). */
const CONTACT_MAILTO = "mailto:sbs22ms076@iiserkol.ac.in";

/* ── search index (SettingsSearchIndex.kt) ── */
const HUB = "hub", HOME_CUSTOMIZE = "home_customize";
const SECTION_TITLES = {
  appearance: "Appearance", motion: "Motion & Haptics", account: "Account", security: "Security",
  notifications: "Notifications & Features", chat: "Chat & Storage", advanced: "Advanced", about: "About & Support",
  home_customize: "Customize Home",
};
const sectionTitle = (s) => SECTION_TITLES[s] || "Settings";
const SECTION_ICON = { appearance: "palette", motion: "animation", account: "account_circle", security: "lock", notifications: "notifications", chat: "forum", advanced: "build", about: "favorite", home_customize: "tune", hub: "restaurant" };
const SECTION_ACCENT = { appearance: "primary", motion: "secondary", account: "primary", security: "error", notifications: "secondary", chat: "tertiary", advanced: "secondary", about: "tertiary", home_customize: "tertiary", hub: "secondary" };

const ENTRIES = [
  ["Theme", "appearance", ["dark", "light", "system", "mode", "colour", "color", "catppuccin", "tokyo night", "coffee", "neon", "liquid glass", "neko", "cat", "e-ink", "eink", "e-paper"]],
  ["Custom theme colour", "appearance", ["hex", "accent", "primary", "color", "picker"]],
  ["Neko coat", "appearance", ["cat", "fur", "ears", "palette"]],
  ["Animations", "motion", ["motion", "reduce motion", "transitions", "off", "subtle", "full"]],
  ["Haptic feedback", "motion", ["vibration", "vibrate", "touch", "feel"]],
  ["Haptic strength", "motion", ["vibration", "intensity"]],
  ["IISERK credentials", "account", ["login", "sign in", "username", "password", "ldap"]],
  ["Reset password", "account", ["forgot", "ldap", "password"]],
  ["Digital ID card", "account", ["qr", "student id", "card"]],
  ["Saved accounts", "account", ["switch account", "multiple accounts", "add account"]],
  ["App lock", "security", ["lock", "pin", "privacy"]],
  ["Fingerprint unlock", "security", ["biometric", "fingerprint", "face"]],
  ["Change PIN", "security", ["pin", "code", "passcode"]],
  ["Notification access", "notifications", ["notifications", "permission", "alerts", "reminders"]],
  ["Campus Chat button", "notifications", ["floating", "bubble", "fab", "move", "position", "reset position"]],
  ["SFTP file manager", "notifications", ["ssh", "server", "remote", "files"]],
  ["Daily calorie reminder", "notifications", ["calories", "food", "reminder"]],
  ["WeLearn deep cache", "notifications", ["offline", "moodle", "courses", "storage", "purge", "cache"]],
  ["Download folder", "notifications", ["downloads", "files", "storage", "location"]],
  ["Keep chat connected in background", "chat", ["notification", "background", "campus chat"]],
  ["Keep chat history", "chat", ["retention", "months", "old messages", "delete"]],
  ["Chat media folder", "chat", ["images", "files", "photos", "storage"]],
  ["Chat storage usage", "chat", ["size", "space", "database"]],
  ["Logging", "advanced", ["debug", "logs"]],
  ["View logs", "advanced", ["debug", "diagnostics", "logs"]],
  ["Send error report", "advanced", ["bug", "report", "crash", "email"]],
  ["Network debug", "advanced", ["network", "connectivity", "wifi"]],
  ["Data source", "advanced", ["sample", "offline", "campus", "demo", "privacy"]],
  ["Back up or restore this browser's data", "advanced", ["export", "import", "backup", "restore", "json"]],
  ["Version", "about", ["about", "update", "build"]],
  ["Support the developer", "about", ["donate", "donation", "upi"]],
  ["Sign out", "about", ["logout", "log out"]],
  ["Delete all saved accounts", "about", ["clear", "remove accounts"]],
  ["Share mess menu data", HUB, ["mess", "menu", "prices", "pool", "privacy"]],
  ["Open on the mess menu", HUB, ["mess", "start", "launch", "open"]],
  ["Bright screen for QR billing", HUB, ["brightness", "bright", "dim", "screen", "qr", "billing", "scanner", "glare"]],
  ["Customize Home", HOME_CUSTOMIZE, ["home", "dashboard", "sections", "layout", "tiles"]],
].map(([title, section, keywords]) => ({ title, section, keywords }));

export function searchSettings(query, limit = 20) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) return [];
  const tokens = q.split(/\s+/);
  const hay = (e) => [e.title, ...e.keywords, sectionTitle(e.section)].join(" ").toLowerCase();
  const rank = (e) => { const t = e.title.toLowerCase(); return t.startsWith(q) ? 0 : tokens.every((k) => t.includes(k)) ? 1 : 2; };
  return ENTRIES.filter((e) => tokens.every((t) => hay(e).includes(t))).sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}

/* ═══════════════════ hub ═══════════════════ */
export async function renderHub(el) {
  let query = "";
  el.innerHTML = screen({ bar: topBar({ title: "Settings" }), body: `<div class="settings-hub" id="hub"></div>` });
  const hub = el.querySelector("#hub");

  const profileCard = () => {
    const p = prefs.get("profile");
    const c = creds.get();
    const name = p.name || "IISERK Student";
    const letter = ((p.name || "").trim()[0] || "?").toUpperCase();
    return `<div class="profile-card glass-high">
      <button type="button" class="profile-card__avatar" data-act="avatar" aria-label="Change profile photo">${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : `<span>${esc(letter)}</span>`}</button>
      <h2 class="profile-card__name">${esc(name)}</h2>
      ${p.roll || p.stream ? `<div class="profile-card__chips">${[p.roll, p.stream].filter(Boolean).map((x) => `<span class="pill pill--secondary profile-card__chip">${esc(x)}</span>`).join("")}</div>`
        : `<p class="t-body-s c-muted">Tap to add your roll number &amp; stream</p>`}
      ${c && c.u ? `<p class="t-label-s c-muted">${esc(c.u)}</p>` : ""}
      <a class="profile-card__open" href="#/profile">Open my profile${icon("keyboard_arrow_right", { size: 16 })}</a>
      <div class="profile-card__actions">
        <button class="btn btn--text" type="button" data-act="avatar">${icon("photo_camera", { size: 16 })}<span>Change photo</span></button>
        <button class="btn btn--text" type="button" data-act="details">${icon("edit", { size: 16 })}<span>Edit details</span></button>
      </div>
    </div>`;
  };

  const groups = () => `
    ${settingsGroup("Personalise",
      navRow({ icon: "palette", accent: "primary", title: "Appearance", subtitle: "Themes, colours, Liquid Glass, Neko, E-Ink", href: "#/settings/appearance" }) + groupDivider() +
      navRow({ icon: "animation", accent: "secondary", title: "Motion & Haptics", subtitle: "Animations and touch feedback", href: "#/settings/motion" }) + groupDivider() +
      navRow({ icon: "tune", accent: "tertiary", title: "Customize Home", subtitle: "Sections, layout styles, colours and templates", href: "#/home-customize" }))}
    ${settingsGroup("Account & privacy",
      navRow({ icon: "account_circle", accent: "primary", title: "Account", subtitle: "Credentials, saved accounts, ID card", href: "#/settings/account" }) + groupDivider() +
      navRow({ icon: "lock", accent: "error", title: "Security", subtitle: "App lock, fingerprint, PIN", href: "#/settings/security" }))}
    ${settingsGroup("Features & storage",
      navRow({ icon: "notifications", accent: "secondary", title: "Notifications & Features", subtitle: "Reminders, chat button, WeLearn cache, downloads", href: "#/settings/notifications" }) + groupDivider() +
      navRow({ icon: "forum", accent: "tertiary", title: "Chat & Storage", subtitle: "Background chat, history, media folder", href: "#/settings/chat" }))}
    ${settingsGroup("Mess", messRows(), { a: { id: "mess-group" } })}
    ${settingsGroup("Help & info",
      navRow({ icon: "build", accent: "secondary", title: "Advanced", subtitle: "Logs, debugging, error reports", href: "#/settings/advanced" }) + groupDivider() +
      navRow({ icon: "favorite", accent: "tertiary", title: "About & Support", subtitle: "Version, developer, donation", href: "#/settings/about", badge: "v" + APP_VERSION }))}`;

  const results = () => {
    const r = searchSettings(query);
    if (!r.length) return `<p class="settings-nomatch">No settings match "${esc(query.trim())}"</p>`;
    return settingsGroup("Results", r.map((e, i) => (i ? groupDivider() : "") + navRow({
      icon: SECTION_ICON[e.section] || "settings", accent: SECTION_ACCENT[e.section] || "primary", title: e.title, subtitle: sectionTitle(e.section),
      a: { "data-open": e.section },
    })).join(""));
  };

  const draw = () => {
    hub.innerHTML = `${profileCard()}
      ${searchField({ id: "settings-q", placeholder: "Search settings", value: query })}
      <div id="hub-body">${query.trim() ? results() : groups()}</div>
      <p class="settings-version">IISERKonnect ${APP_VERSION} · web</p>`;
    hub.querySelectorAll(".profile-card, .search, .settings-group").forEach((n, i) => motion.reveal(n, i));
  };
  draw();

  hub.addEventListener("input", (e) => {
    if (e.target.id !== "settings-q") return;
    query = e.target.value;
    hub.querySelector("#hub-body").innerHTML = query.trim() ? results() : groups();
  });
  on(hub, "click", "[data-open]", (e, b) => {
    const s = b.dataset.open;
    if (s === HUB) { query = ""; draw(); hub.querySelector("#mess-group")?.scrollIntoView({ block: "center" }); }
    else if (s === HOME_CUSTOMIZE) nav.go("home-customize");
    else nav.go("settings/" + s);
  });
  on(hub, "click", "[data-act=avatar]", (e) => { e.stopPropagation(); editAvatar(draw); });
  on(hub, "click", "[data-act=details]", () => editDetails(draw));
  wireMess(hub);
}

function editDetails(after) {
  const p = prefs.get("profile");
  const c = creds.get();
  const m = c && /^[a-z]{2,5}(\d{2})([a-z]{2})(\d{2,3})$/i.exec(c.u || "");
  const suggested = m ? m[1] + m[2].toUpperCase() + m[3] : "";
  return dialog({
    title: "Your details",
    body: `<p class="t-body-s">Shown only on this device.</p>
      ${textField({ id: "pd-name", label: "Name", value: p.name || "" })}
      ${textField({ id: "pd-roll", label: "Roll number (e.g. 21MS999)", value: p.roll || suggested, supporting: suggested && p.roll !== suggested ? `From your ID: ${suggested}` : "" })}
      ${textField({ id: "pd-stream", label: "Stream (e.g. Physical Sciences)", value: p.stream || "" })}`,
    actions: [{ label: "Cancel", value: null }, { label: "Save", value: "save", primary: true }],
  }).then((v) => {
    if (v !== "save") return;
    prefs.patch("profile", {
      name: document.getElementById("pd-name")?.value.trim() ?? p.name,
      roll: document.getElementById("pd-roll")?.value.trim() ?? p.roll,
      stream: document.getElementById("pd-stream")?.value.trim() ?? p.stream,
    });
    after && after();
  });
}

/* ── Mess group: three whole-row switches + the brightness level ── */
function messRows() {
  const share = prefs.get("shareMessMenu");
  const jump = prefs.get("jumpToMessMenu");
  const bright = prefs.get("qrBrightnessEnabled");
  const level = prefs.get("qrBrightnessLevel");
  return switchRow({
      icon: "share", accent: "secondary", title: "Share mess menu data",
      desc: "Pool menu items and per-unit prices with other app users on the campus network, so past days and real prices become available to everyone. Never shares your balance, purchases, spending, roll number or name." +
        "\n\nNot available on the web: pooling needs the app's campus-network peer link, which a browser cannot open. This switch is remembered for the app's behaviour only.",
      checked: share, a: { "data-pref": "shareMessMenu" } }) + groupDivider() +
    switchRow({ icon: "restaurant", accent: "tertiary", title: "Open on the mess menu",
      desc: "When you open the app, go straight to the mess menu instead of Home. Back still returns to Home. Does not apply while you are signed out.",
      checked: jump, a: { "data-pref": "jumpToMessMenu" } }) + groupDivider() +
    switchRow({ icon: "brightness_high", accent: "primary", title: "Bright screen for QR billing",
      desc: "Raise the screen to the level below while the billing QR is showing, so the counter can scan it. Your phone's own brightness comes back when you leave.",
      checked: bright, a: { "data-pref": "qrBrightnessEnabled" } }) +
    `<div class="qr-level"${bright ? "" : " hidden"}>
      <div class="row-between"><span class="t-body-m">Brightness</span><span class="t-label-l w-semi c-primary" id="qr-level-pct">${Math.round(level * 100)}%</span></div>
      ${slider({ id: "qr-level", min: 30, max: 100, step: 1, value: Math.round(level * 100), label: "QR billing brightness" })}
      <p class="t-label-s c-muted">Hold the slider to preview it on this screen.</p>
      <p class="t-label-s c-muted qr-level__web">${icon("info", { size: 14 })} A browser cannot change your screen's brightness. On the web, QR Billing shows a white, high-contrast panel at this level and keeps the screen awake — turn your phone's brightness up yourself for the counter's scanner.</p>
    </div>`;
}

let previewEl = null;
function brightnessPreview(level) {
  if (level == null) { previewEl?.remove(); previewEl = null; return; }
  if (!previewEl) { previewEl = document.createElement("div"); previewEl.className = "bright-preview"; previewEl.setAttribute("aria-hidden", "true"); document.body.appendChild(previewEl); }
  previewEl.style.setProperty("--level", String(level));
}

function wireMess(root) {
  on(root, "click", ".switch-row[data-pref]", (e, b) => {
    const key = b.dataset.pref;
    const next = b.getAttribute("aria-checked") !== "true";
    haptics.select();
    prefs.set(key, next);
    b.setAttribute("aria-checked", String(next));
    if (key === "qrBrightnessEnabled") {
      const lv = root.querySelector(".qr-level");
      if (lv) {
        if (next) { lv.hidden = false; motion.animate(lv, [{ opacity: 0, maxHeight: "0px" }, { opacity: 1, maxHeight: "260px" }]); }
        else motion.animate(lv, [{ opacity: 1, maxHeight: "260px" }, { opacity: 0, maxHeight: "0px" }]).then(() => { lv.hidden = true; });
      }
    }
  });
  root.addEventListener("input", (e) => {
    if (e.target.id !== "qr-level") return;
    const v = +e.target.value;
    e.target.style.setProperty("--val", ((v - 30) / 70) * 100 + "%");
    root.querySelector("#qr-level-pct").textContent = v + "%";
    brightnessPreview(v / 100);
  });
  root.addEventListener("change", (e) => {
    if (e.target.id !== "qr-level") return;
    prefs.set("qrBrightnessLevel", Math.max(0.3, Math.min(1, +e.target.value / 100)));
    brightnessPreview(null);
  });
  root.addEventListener("pointerup", () => brightnessPreview(null));
  root.addEventListener("pointercancel", () => brightnessPreview(null));
}

/* ═══════════════════ sections ═══════════════════ */
const card = (inner, cls = "") => `<div class="settings-card neko-ears glass-med${cls ? " " + cls : ""}">${inner}</div>`;
const cardHead = (title, sub = "") => `<h3 class="settings-card__title">${esc(title)}</h3>${sub ? `<p class="settings-card__sub">${esc(sub)}</p>` : ""}`;

export async function renderDetail(el, ctx) {
  const section = ctx.params.section;
  if (!SECTION_TITLES[section] || section === HOME_CUSTOMIZE) { nav.go("settings", { replace: true }); return; }
  const draw = () => {
    const sc = el.querySelector(".screen__scroll");
    const keep = sc ? sc.scrollTop : 0;
    el.innerHTML = screen({ bar: topBar({ title: sectionTitle(section) }), body: `<div class="settings-detail">${SECTIONS[section]()}</div>` });
    el.querySelector(".screen__scroll").scrollTop = keep;
  };
  draw();
  // The router sets document.title from this once the screen is in; setting
  // document.title here was overwritten by the route's plain "Settings".
  ctx.title = sectionTitle(section);
  const cleanups = [];
  const wire = WIRES[section];
  if (wire) cleanups.push(wire(el, draw));
  const offs = [prefs.on("themeMode", draw), prefs.on("nekoCoat", draw), prefs.on("customPrimaryHex", draw)];
  return () => { offs.forEach((f) => f()); cleanups.forEach((f) => typeof f === "function" && f()); brightnessPreview(null); };
}

const SECTIONS = {
  /* ── Appearance ── */
  appearance() {
    const mode = prefs.get("themeMode");
    const hex = normalizeHexInput(prefs.get("customPrimaryHex"));
    const coat = prefs.get("nekoCoat");
    const eink = mode === EINK_THEME_MODE || mode === EINK_DARK_THEME_MODE;
    return `${sectionHeader("palette", "Appearance")}
      ${card(`${cardHead("Theme Mode", "Customize the app's visual appearance")}
        <p class="t-label-m c-muted mt-md">Current: ${esc(themeLabel(mode))}</p>
        <button type="button" class="dropdown mt-sm" data-act="theme-menu" aria-haspopup="menu"><span>${esc(themeLabel(mode))}</span>${icon("arrow_drop_down")}</button>
`)}
      ${eink ? `<p class="t-body-s c-muted settings-note">${mode === EINK_DARK_THEME_MODE
        ? "E-Ink Dark is for e-paper with the frontlight off: white on black, which is what the panel can actually do and what costs the least battery at night. No colour or shading, and animation off — an e-ink panel refreshes slowly and every refresh costs battery, so transitions and loading animations are shown as still frames. Your Motion setting is remembered and returns with any other theme."
        : "E-Ink is for e-paper screens. It uses pure black on white with no colour or shading, and turns animation off — an e-ink panel refreshes slowly and every refresh costs battery, so transitions and loading animations are shown as still frames. Your Motion setting is remembered and returns when you switch back to another theme."}</p>` : ""}
      ${mode === NEKO_THEME_MODE ? card(`${cardHead("Your cat", "Ears, fur and nose. Changes the whole palette; the rounder shapes and cat icons stay.")}
        <div class="coat-list mt-md">${NEKO_COATS.map((c) => `<button type="button" class="coat${c.id === coat ? " is-on" : ""}" data-coat="${c.id}" aria-pressed="${c.id === coat}">
          <span class="coat__plate" style="--fur:${c.fur};--ears:${c.ears};--nose:${c.nose}"><i></i></span>
          <span class="grow"><span class="coat__label">${esc(c.label)}</span><span class="coat__blurb">${esc(c.blurb)}</span></span>
          ${c.id === coat ? icon("check", { cls: "c-primary" }) : ""}</button>`).join("")}</div>`) : ""}
      ${card(`${cardHead("Custom Theme Color", "Use the visual picker for quick selection, or enter hex manually.")}
        <div class="row mt-md"><span class="color-dot" style="background:${hex || "var(--primary)"}"></span><span class="t-body-s c-muted">${esc(hex || "Using theme default")}</span></div>
        <div class="btn-row mt-md">
          <button class="btn btn--filled btn--grow" type="button" data-act="picker">${icon("palette", { size: 18 })}<span>Open Picker</span></button>
          <button class="btn btn--outlined btn--grow" type="button" data-act="reset-color"${hex ? "" : " disabled"}><span>Reset</span></button>
        </div>
        <div class="mt-md">${textField({ id: "hex-in", label: "Hex Code (optional)", value: hex || "", a: { spellcheck: "false", autocapitalize: "characters" } })}</div>
        <button class="btn btn--filled btn--block mt-sm" type="button" data-act="apply-hex"><span>Apply From Hex</span></button>`)}`;
  },

  /* ── Motion & Haptics ── */
  motion() {
    const level = prefs.get("motionLevel");
    const reason = motion.overrideReason();
    const strength = prefs.get("hapticStrength");
    return `${sectionHeader("animation", "Motion & Haptics")}
      ${card(`<div class="row" style="align-items:flex-start">${icon("animation", { size: 20, cls: "c-primary" })}<div>
          <h3 class="t-title-s w-semi">Animations</h3>
          <p class="t-body-s c-muted">How much the app moves when screens change. A device-wide "Remove animations" setting overrides this, whatever is chosen here.</p></div></div>
        ${reason ? `<p class="t-body-s settings-override">${icon("info", { size: 16 })}<span>${esc(reason)}</span></p>` : ""}
        <div class="mt-sm" role="radiogroup" aria-label="Animations">${motion.LEVELS.map((l) => radioRow({ checked: l === level, title: motion.label(l), desc: motion.description(l), a: { "data-motion": l } })).join("")}</div>`)}
      ${card(`<h3 class="t-body-m">Haptic strength</h3>
        <p class="t-body-s c-muted">Applies to taps, selections, confirmations and rejections. Tapping a level plays it, so you can feel the difference before you leave this screen.</p>
        ${canVibrate() ? "" : `<p class="t-body-s settings-override">${icon("info", { size: 16 })}<span>This browser cannot vibrate (desktop browsers and iPhone browsers have no vibration). The setting is kept and works where vibration exists, such as Chrome on Android.</span></p>`}
        <div class="mt-sm" role="radiogroup" aria-label="Haptic strength">${STRENGTHS.map((s) => radioRow({ checked: s.id === strength, title: s.label, desc: s.description, a: { "data-strength": s.id } })).join("")}</div>`)}
      ${card(`<div class="row"><div class="grow"><h3 class="t-body-m">Haptic feedback on tap</h3>
        <p class="t-body-s c-muted">A short tick when you tap a button or tile. Confirming, rejecting and selecting still buzz whatever this says — those answer something you cannot see yet.</p></div>
        ${switchEl(prefs.get("hapticOnTap"), "Haptic feedback on tap", { "data-act": "haptic-tap" })}</div>`)}`;
  },

  /* ── Account ── */
  account() {
    const has = creds.has();
    const p = prefs.get("profile");
    const c = creds.get();
    const accounts = prefs.get("savedAccounts") || [];
    const active = c && c.u;
    return `${sectionHeader("account_circle", "Account")}
      ${has ? `<a class="idcard-preview neko-ears glass-med" href="#/iiser-card">
        <div class="row-between"><div><h3 class="t-title-m w-bold">My Digital ID Card</h3><p class="t-body-s c-muted">Tap to view full card &amp; save as PNG</p></div>${icon("keyboard_arrow_right")}</div>
        <div class="idcard-preview__strip"><span class="idcard-preview__photo">${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : esc((p.name || c.u || "?").slice(0, 2).toUpperCase())}</span>
          <span><span class="idcard-preview__name">${esc((p.name || "IISERK Student").toUpperCase())}</span><span class="idcard-preview__id">ID: ${esc(p.roll || c.u)}</span>${p.stream ? `<span class="idcard-preview__dept">${esc(p.stream)}</span>` : ""}</span></div></a>` : ""}
      ${card(`${cardHead("IISERK Credentials")}
        <p class="t-label-m ${has ? "c-primary" : "c-error"}">${has ? "Saved" : "Not saved"}</p>
        <p class="t-body-s c-muted mt-sm">Kept in this browser's storage only (not encrypted — anyone with access to this browser profile could read them). They are sent nowhere except to the campus sign-in pages, and only when this browser can reach campus.</p>
        <div class="stack-sm mt-md">
          ${textField({ id: "cred-u", label: "LDAP username", placeholder: "e.g. sbs21ms999", a: { autocomplete: "username", autocapitalize: "none", spellcheck: "false" } })}
          ${textField({ id: "cred-p", label: "Password", type: "password", a: { autocomplete: "current-password" } })}
        </div>
        <div class="btn-row mt-sm">
          <button class="btn btn--filled" type="button" data-act="save-creds"><span>Save</span></button>
          <button class="btn btn--outlined settings-danger" type="button" data-act="clear-creds"><span>Clear All &amp; Logout</span></button>
        </div>`)}
      ${card(`${cardHead("Password Reset", "Reset your IISER Kolkata LDAP password (used for WeLearn, Wi-Fi, VPN, etc.)")}
        <a class="btn btn--filled mt-md" href="https://www.iiserkol.ac.in/account/" target="_blank" rel="noopener noreferrer"><span>Reset Password</span>${icon("open_in_new", { size: 16 })}</a>`)}
      ${card(`${cardHead("Digital ID Card", "Create a QR-code enabled digital student ID with your profile data")}
        <a class="btn btn--filled mt-md${has ? "" : " is-disabled"}" href="${has ? "#/iiser-card" : "#/settings/account"}"${has ? "" : ' aria-disabled="true"'}><span>View My Digital Card</span></a>
        ${has ? "" : `<p class="t-body-s c-error mt-sm">Save your credentials first to generate a card</p>`}`, has ? "settings-card--tint" : "")}
      ${card(`<div class="row" style="align-items:flex-start"><div class="grow"><h3 class="t-body-m w-semi">Multi-account</h3>
          <p class="t-body-s c-muted">Keep several accounts here and switch without re-entering passwords.</p></div></div>
        <div class="btn-row"><button class="btn btn--text" type="button" data-act="acc-save"${has ? "" : " disabled"}><span>Save current</span></button><button class="btn btn--text" type="button" data-act="acc-add"><span>Add account</span></button></div>
        ${accounts.length ? accounts.map((a) => `<div class="account-row${a.username === active ? " is-active" : ""}">
            ${icon("account_circle", { cls: "c-primary" })}
            <div class="grow"><div class="t-body-m w-semi">${esc(a.label || a.username)}</div><div class="t-body-s c-muted">${esc(a.username)}${a.username === active ? " · active" : ""}</div></div>
            ${a.username === active ? "" : `<button class="btn btn--text" type="button" data-switch="${esc(a.username)}"><span>Switch</span></button>`}
            <button class="icon-btn" type="button" data-remove="${esc(a.username)}" aria-label="Remove ${esc(a.username)}">${icon("delete")}</button>
          </div>`).join("")
        : `<p class="t-body-s c-muted">No saved accounts yet. Tap "Save current" to keep the account you are signed in as, or "Add account" to register another one.</p>`}`)}`;
  },

  /* ── Security ── */
  security() {
    const l = prefs.get("appLock");
    return `${sectionHeader("lock", "App lock")}
      ${card(`<p class="t-body-s c-muted">Ask for a fingerprint or PIN before opening the app. Behind it are your campus password, your library login, any saved SFTP passwords and your chats.</p>
        <div class="row-between mt-md"><span class="t-body-m">Lock this app</span>${switchEl(!!l.enabled, "Lock this app", { "data-act": "lock-toggle", disabled: !cryptoAvailable() })}</div>
        ${l.enabled ? `<h4 class="t-label-l mt-md">Ask again</h4>
          <div role="radiogroup" aria-label="Ask again">${TIMEOUTS.map((t) => radioRow({ checked: (l.askAgain || "AfterOneMinute") === t.id, title: t.label, a: { "data-timeout": t.id } })).join("")}</div>
          <div class="row-between mt-sm"><span class="t-body-m">Allow fingerprint</span>${switchEl(!!l.fingerprint, "Allow fingerprint", { "data-act": "fp-toggle" })}</div>
          <button class="btn btn--text mt-sm" type="button" data-act="change-pin"><span>Change PIN</span></button>` : ""}
        <p class="t-body-s c-primary" id="lock-msg" aria-live="polite"></p>`)}
      ${browserNote({ icon: "info", title: "What app lock does in a browser", body: "It hides IISERKonnect in this browser until the PIN (or this device's own unlock, for \"fingerprint\") is given. The PIN itself is never stored — only a salted hash. Your data stays in this browser's storage without extra encryption, so it protects against someone picking up your unlocked phone, not against someone who can read the browser profile's files." })}
      ${cryptoAvailable() ? "" : browserNote({ tone: "warn", icon: "warning", title: "Not available here", body: "This page is not on a secure (https) connection, so the browser withholds the cryptography app lock needs." })}`;
  },

  /* ── Notifications & Features ── */
  notifications() {
    const perm = permission();
    const on = perm === "granted";
    const cal = prefs.get("calorieReminder");
    return `${card(`<div class="row" style="align-items:flex-start">${icon(on ? "notifications" : "notifications_off", { cls: on ? "c-primary" : "c-error" })}
        <div class="grow"><h3 class="t-title-m">${on ? "Notifications are on" : "Notifications are off"}</h3>
        <p class="t-body-s c-muted">${esc(perm === "unsupported" ? "This browser cannot show notifications. Reminders still appear inside the page while it is open."
          : on ? "Notifications are on." : perm === "denied" ? "This browser has blocked notifications for this site. Allow them in the browser's site settings (the icon left of the address), then come back." : "Allow notifications so reminders, timers and focus sessions can tell you when they are due.")}</p>
        ${perm === "default" ? `<button class="btn btn--filled mt-sm" type="button" data-act="allow-notif"><span>Allow notifications</span></button>` : ""}
        <p class="t-body-s c-muted mt-sm">${esc(ALARM_NOTE)}</p></div></div>`)}
      <div class="mt-lg">${sectionHeader("flight", "Features")}</div>
      ${settingsGroup(null,
        switchRow({ icon: "chat_bubble", accent: "secondary", title: "Campus Chat button", desc: "Show the floating Campus Chat button. Drag it anywhere on screen to move it; it steps aside on screens that have their own button in that corner.", checked: prefs.get("chatFabEnabled"), a: { "data-pref": "chatFabEnabled" } }) +
        (prefs.get("chatFabEnabled") ? `<button class="btn btn--text settings-indent" type="button" data-act="reset-fab"><span>Reset position</span></button>` : "") +
        groupDivider() +
        switchRow({ icon: "storage", accent: "tertiary", title: "SFTP file manager", desc: "Browse and transfer files on a remote machine — a lab server, or your Computer Centre account. Off by default: it asks for that machine's password and can delete whole folders on it. (On the web this only shows the SFTP screen, which explains why a browser cannot open SSH connections.)", checked: !!prefs.get("sftpEnabled"), a: { "data-pref": "sftpEnabled" } }))}
      ${card(`<div class="row"><div class="grow"><h3 class="t-title-s">Daily Calorie Reminder</h3><p class="t-body-s c-muted">Get a daily reminder to track your calorie intake</p></div>
          ${switchEl(!!cal.enabled, "Daily Calorie Reminder", { "data-act": "cal-toggle" })}</div>
        <p class="t-body-s c-muted mt-md">Set reminder time (24h)</p>
        <div class="grid-2 mt-sm">${textField({ id: "cal-h", label: "Hour", type: "number", value: String(cal.hour), a: { min: 0, max: 23, inputmode: "numeric" } })}${textField({ id: "cal-m", label: "Minute", type: "number", value: String(cal.minute), a: { min: 0, max: 59, inputmode: "numeric" } })}</div>
        <button class="btn btn--filled btn--block mt-md" type="button" data-act="cal-save"><span>Save Reminder Time</span></button>`)}
      ${card(`<div class="row"><div class="grow"><h3 class="t-title-s">WeLearn Deep Cache</h3><p class="t-body-s c-muted">Cache course resources locally for faster opening and offline access</p></div>
          ${switchEl(false, "WeLearn Deep Cache", { disabled: true })}</div>
        ${browserNote({ icon: "cloud_off", title: "Not available in a browser", body: "The deep cache saves course files into the phone's storage in the background. A web page cannot write files into a folder of its own or sync while closed, so files you open from WeLearn are handled by the browser's own downloads." })}`)}
      ${card(`${cardHead("Download Folder", "Choose where downloaded course materials are saved")}
        <p class="t-body-s mono mt-sm">Your browser's download folder</p>
        <p class="t-body-s c-muted mt-sm">Browsers decide where downloads go (usually the Downloads folder, or they ask every time). Change it in your browser's own settings.</p>`)}`;
  },

  /* ── Chat & Storage ── */
  chat() {
    const months = prefs.get("chatRetentionMonths");
    return `${sectionHeader("folder", "Chat Storage")}
      ${settingsGroup(null, switchRow({ icon: "sync", accent: "primary", title: "Keep chat connected in background", desc: "Shows a permanent \"Campus Chat is running\" notification so messages arrive instantly while the app is closed. Off = no notification; chat works only while the app is open.", checked: false, disabled: true }))}
      ${browserNote({ icon: "info", title: "Not possible in a browser", body: "A web page cannot keep a connection open after its tab is closed. Web chat works only while the chat screen is open." })}
      ${card(`<h3 class="t-title-s">Keep chat history</h3>
        <div class="chips mt-sm">${[[0, "Forever"], [3, "3 months"], [6, "6 months"], [12, "12 months"]].map(([m, l]) => chip(l, { selected: months === m, a: { "data-retention": m } })).join("")}</div>
        <h3 class="t-title-s mt-lg">Chat media folder (files &amp; images)</h3>
        <p class="t-body-s c-muted">Files received in web chat are saved through your browser's downloads; the browser chooses the folder.</p>
        <h3 class="t-title-s mt-lg">Usage</h3>
        <p class="t-body-s c-muted" id="chat-usage">Counting…</p>
        <button class="btn btn--outlined mt-sm" type="button" data-act="chat-usage"><span>Refresh sizes</span></button>`)}`;
  },

  /* ── Advanced ── */
  advanced() {
    const src = prefs.get("dataSource");
    return `${sectionHeader("build", "Debug & Logs")}
      ${card(`<div class="row"><div class="grow"><h3 class="t-title-s">Enable Logging</h3><p class="t-body-s c-muted">App activity is logged for debugging when enabled</p></div>
          ${switchEl(!!prefs.get("loggingEnabled"), "Enable Logging", { "data-act": "log-toggle" })}</div>
        <div class="btn-row mt-md"><a class="btn btn--filled" href="#/log"><span>View Logs</span></a>
          <button class="btn btn--outlined" type="button" data-act="error-report"><span>Send Error Report</span></button></div>`)}
      ${card(`${cardHead("Data source", "Where campus screens get their data in this browser.")}
        <div class="mt-sm" role="radiogroup" aria-label="Data source">
          ${radioRow({ checked: src !== "sample", title: "Try campus, then sample data", desc: "Asks campus servers directly. Most browsers block this from another website, and you then see clearly-labelled sample data.", a: { "data-source": "auto" } })}
          ${radioRow({ checked: src === "sample", title: "Sample data only", desc: "Never contacts any campus server. Every campus screen shows made-up example data.", a: { "data-source": "sample" } })}
        </div>
        <button class="btn btn--text mt-sm" type="button" data-act="clear-cache"><span>Clear cached campus data</span></button>`)}
      ${card(`${cardHead("Your data in this browser", "Notes, tasks, reminders, events, budget, chat and settings live only here. Back them up or move them to another browser.")}
        <div class="btn-row mt-md">
          <button class="btn btn--filled" type="button" data-act="export">${icon("download", { size: 18 })}<span>Back up</span></button>
          <button class="btn btn--outlined" type="button" data-act="import">${icon("upload_file", { size: 18 })}<span>Restore</span></button>
        </div>
        <button class="btn btn--text settings-danger mt-sm" type="button" data-act="wipe"><span>Erase everything in this browser</span></button>`)}
      ${card(`${cardHead("Network Debug")}<pre class="netdebug mt-sm" id="netdebug">…</pre>`)}`;
  },

  /* ── About & Support ── */
  about() {
    return `${sectionHeader("favorite", "Support")}
      <div class="settings-card settings-card--primary neko-ears glass-med">
        <h3 class="t-body-m w-semi">Support the Developer</h3>
        <p class="t-body-s">If you find this app useful, consider supporting its development with a small donation.</p>
        <p class="t-body-s mt-sm">${icon("info", { size: 14 })} Donations are made from the Android app (About &amp; Support → Donate via UPI). The web version does not carry payment details.</p>
      </div>
      ${card(`<h3 class="t-body-m w-semi">IISER Kolkata App</h3>
        <p class="t-body-s c-muted">Web version · mirrors app version ${APP_VERSION}</p>
        <p class="t-body-m mt-sm">Developer: Shuvam Banerji Seal</p>
        <p class="t-body-s c-muted mt-sm">Access WeLearn courses, download study materials, browse the IISERK website, view your academic calendar, manage campus VPN, and more - all in one place.</p>
        <p class="t-body-s c-muted mt-sm">This web version is a pure frontend with no backend: everything personal stays in this browser. App, parsers and design by <strong>Shuvam Banerji Seal</strong> ·
          <a href="https://github.com/Shuvam-Banerji-Seal/IISERKonnect" target="_blank" rel="noopener">Android repo</a> ·
          <a href="${CONTACT_MAILTO}">email</a></p>
        <p class="t-label-s c-muted mt-sm">Unofficial student project — not affiliated with IISER Kolkata administration. MIT License. No analytics, no trackers, no cloud.</p>
        <a class="btn btn--outlined mt-md" href="https://github.com/Shuvam-Banerji-Seal/iiserkonnect-website" target="_blank" rel="noopener noreferrer"><span>Web app source</span>${icon("open_in_new", { size: 16 })}</a>`)}
      ${card(`<h3 class="t-body-m w-semi">Account</h3>
        <p class="t-body-s c-muted">Signs you out and clears sessions. Saved accounts are kept — remove them below if you want them gone too.</p>
        <div class="btn-row mt-md"><button class="btn btn--filled settings-danger-fill" type="button" data-act="logout">${icon("logout", { size: 18 })}<span>Sign out</span></button>
        <button class="btn btn--text settings-danger" type="button" data-act="wipe-accounts"><span>Delete all saved accounts</span></button></div>`)}`;
  },
};

/* ── wiring per section ── */
const WIRES = {
  appearance(el, draw) {
    el.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-act],[data-theme-mode],[data-coat]");
      if (!t) return;
      if (t.dataset.themeMode != null) { haptics.select(); prefs.set("themeMode", +t.dataset.themeMode); return; }
      if (t.dataset.coat != null) { haptics.select(); prefs.set("nekoCoat", +t.dataset.coat); return; }
      switch (t.dataset.act) {
        case "theme-menu": {
          const v = await menu(t, THEME_OPTIONS.map(([label, m]) => ({ label, value: m, checked: m === prefs.get("themeMode") })));
          if (v != null) prefs.set("themeMode", v);
          return;
        }
        case "reset-color": prefs.set("customPrimaryHex", null); return;
        case "apply-hex": {
          const raw = el.querySelector("#hex-in").value;
          if (!raw.trim()) { prefs.set("customPrimaryHex", null); return; }
          const n = normalizeHexInput(raw);
          if (!n) snackbar("Invalid hex code. Use #RRGGBB or #AARRGGBB");
          else prefs.set("customPrimaryHex", n);
          return;
        }
        case "picker": {
          const v = await colorPicker(normalizeHexInput(prefs.get("customPrimaryHex")) || currentTheme()?.scheme.primary || "#1B5E4A");
          if (v) prefs.set("customPrimaryHex", v);
        }
      }
    });
  },
  motion(el, draw) {
    el.addEventListener("click", (e) => {
      const m = e.target.closest("[data-motion]"), s = e.target.closest("[data-strength]"), t = e.target.closest("[data-act=haptic-tap]");
      if (m) { haptics.select(); prefs.set("motionLevel", +m.dataset.motion); draw(); }
      if (s) { haptics.preview(s.dataset.strength); prefs.set("hapticStrength", s.dataset.strength); draw(); }
      if (t) { const next = !prefs.get("hapticOnTap"); if (next) haptics.confirm(); prefs.set("hapticOnTap", next); draw(); }
    });
  },
  account(el, draw) {
    el.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-act],[data-switch],[data-remove]");
      if (!t || t.disabled) return;
      const accounts = prefs.get("savedAccounts") || [];
      if (t.dataset.switch) {
        const a = accounts.find((x) => x.username === t.dataset.switch);
        if (a && await confirm({ title: "Switch account?", text: `Sign in as ${a.label || a.username}? Campus sessions in this browser are cleared.`, confirmLabel: "Switch" })) {
          creds.save(a.username, a.password); prefs.set("signedIn", true); snackbar(`Switched to ${a.username}`); draw();
        }
        return;
      }
      if (t.dataset.remove) {
        if (await confirm({ title: "Remove account?", text: `${t.dataset.remove} is removed from this browser.`, confirmLabel: "Remove", danger: true })) {
          prefs.set("savedAccounts", accounts.filter((x) => x.username !== t.dataset.remove)); draw();
        }
        return;
      }
      switch (t.dataset.act) {
        case "save-creds": {
          const u = el.querySelector("#cred-u").value.trim(), p = el.querySelector("#cred-p").value;
          if (!u || !p) { snackbar("Enter both username and password."); return; }
          creds.save(u, p); prefs.set("signedIn", true); haptics.confirm(); snackbar("Credentials saved."); draw();
          return;
        }
        case "clear-creds":
          if (await confirm({ title: "Clear All & Logout?", text: "Your saved username and password are removed from this browser.", confirmLabel: "Clear", danger: true })) {
            creds.clear(); prefs.set("signedIn", false); clearCaches(); draw();
          }
          return;
        case "acc-save": {
          const c = creds.get(); if (!c) return;
          const label = await dialog({ title: "Save current account", body: textField({ id: "acc-label", label: "Account name (optional)" }), actions: [{ label: "Cancel", value: null }, { label: "Save", value: "ok", primary: true }] })
            .then((v) => (v ? document.getElementById("acc-label")?.value.trim() ?? "" : null));
          if (label == null) return;
          prefs.set("savedAccounts", [...accounts.filter((x) => x.username !== c.u), { username: c.u, password: c.p, label }]); draw();
          return;
        }
        case "acc-add": {
          let vals = null;
          const v = await dialog({
            title: "Add another account",
            body: `${textField({ id: "na-u", label: "LDAP username", placeholder: "e.g. abc21ms001", a: { autocapitalize: "none" } })}${textField({ id: "na-p", label: "Password", type: "password" })}${textField({ id: "na-l", label: "Label (optional)" })}`,
            actions: [{ label: "Cancel", value: null }, { label: "Add", value: "ok", primary: true }],
            validate: (val, d) => {
              const u = d.querySelector("#na-u").value.trim(), p = d.querySelector("#na-p").value, l = d.querySelector("#na-l").value.trim();
              if (!u || !p) { snackbar("Enter both username and password."); return false; }
              vals = { username: u, password: p, label: l };
              return true;
            },
          });
          if (v === "ok" && vals) { prefs.set("savedAccounts", [...accounts.filter((x) => x.username !== vals.username), vals]); draw(); }
          return;
        }
      }
    });
  },
  security(el, draw) {
    const msg = (t) => { const m = el.querySelector("#lock-msg"); if (m) m.textContent = t; };
    el.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-act],[data-timeout]");
      if (!t) return;
      if (t.dataset.timeout) { haptics.select(); prefs.patch("appLock", { askAgain: t.dataset.timeout }); draw(); return; }
      const l = prefs.get("appLock");
      if (t.dataset.act === "lock-toggle") {
        haptics.select();
        if (!l.enabled) { if (await pinDialog({ title: "Set a PIN", confirm: "Turn on", current: false })) { sessionStorage.setItem("iiserk-unlocked", String(Date.now())); draw(); msg("App lock is on."); } }
        else if (await pinDialog({ title: "Turn off app lock", confirm: "Turn off", current: true, newPin: false })) { draw(); msg("App lock is off."); }
      }
      if (t.dataset.act === "change-pin" && await pinDialog({ title: "Change PIN", confirm: "Change", current: true })) msg("PIN changed.");
      if (t.dataset.act === "fp-toggle") {
        if (l.fingerprint) { prefs.patch("appLock", { fingerprint: false, credId: null }); draw(); return; }
        if (!(await platformAuthAvailable())) { snackbar("This device or browser has no built-in unlock (fingerprint, face or screen lock) a web page can use."); return; }
        try { await enrollFingerprint(); haptics.confirm(); draw(); msg("Fingerprint unlock is on."); }
        catch { snackbar("Device unlock was cancelled."); }
      }
    });
  },
  notifications(el, draw) {
    el.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-act],.switch-row[data-pref]");
      if (!t) return;
      if (t.dataset.pref) { haptics.select(); prefs.set(t.dataset.pref, t.getAttribute("aria-checked") !== "true"); draw(); return; }
      switch (t.dataset.act) {
        case "allow-notif": await requestPermission(); draw(); return;
        case "reset-fab": prefs.set("chatFabPos", null); toast("Chat button moved back to the corner"); return;
        case "cal-toggle": prefs.patch("calorieReminder", { enabled: !prefs.get("calorieReminder").enabled }); draw(); return;
        case "cal-save": {
          const h = parseInt(el.querySelector("#cal-h").value, 10), m = parseInt(el.querySelector("#cal-m").value, 10);
          if (!(h >= 0 && h <= 23 && m >= 0 && m <= 59)) { snackbar("Use an hour from 0 to 23 and a minute from 0 to 59."); return; }
          prefs.patch("calorieReminder", { hour: h, minute: m }); snackbar(`Reminder set for ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }
      }
    });
  },
  chat(el, draw) {
    const usage = async () => {
      const [msgs, est] = await Promise.all([collection("chat").all().catch(() => []), storageEstimate()]);
      const u = el.querySelector("#chat-usage");
      if (u) u.textContent = `Messages: ${msgs.length}  •  This site's storage: ${est ? formatBytes(est.usage || 0) : "unknown"}`;
    };
    usage();
    el.addEventListener("click", (e) => {
      const r = e.target.closest("[data-retention]");
      if (r) { prefs.set("chatRetentionMonths", +r.dataset.retention); draw(); usage(); }
      if (e.target.closest("[data-act=chat-usage]")) usage();
    });
  },
  advanced(el, draw) {
    const fill = async () => {
      const n = el.querySelector("#netdebug"); if (!n) return;
      const c = navigator.connection || {};
      const est = await storageEstimate();
      n.textContent = [
        `Online: ${navigator.onLine}`,
        `Connection: ${c.effectiveType || "unknown"}${c.downlink ? ` · ${c.downlink} Mb/s` : ""}${c.rtt ? ` · rtt ${c.rtt} ms` : ""}`,
        `Data source: ${prefs.get("dataSource") === "sample" ? "sample data only" : "campus, then samples"}`,
        `Secure context: ${window.isSecureContext}`,
        `Storage: ${await storageBackend() === "idb" ? "IndexedDB" : "localStorage"}${est ? ` · ${formatBytes(est.usage || 0)} used` : ""}`,
        `Notifications: ${permission()}`,
        `Screen: ${window.screen.width}×${window.screen.height} @${devicePixelRatio}x`,
        `Browser: ${navigator.userAgent}`,
      ].join("\n");
    };
    fill();
    el.addEventListener("click", async (e) => {
      const s = e.target.closest("[data-source]");
      if (s) { prefs.set("dataSource", s.dataset.source); clearCaches(); draw(); fill(); return; }
      const t = e.target.closest("[data-act]");
      if (!t) return;
      switch (t.dataset.act) {
        case "log-toggle": prefs.set("loggingEnabled", !prefs.get("loggingEnabled")); draw(); fill(); return;
        case "clear-cache": clearCaches(); toast("Cached campus data cleared"); return;
        case "error-report": {
          const lines = readLog().slice(-40).map((l) => `${new Date(l.t).toISOString()} ${l.level}/${l.tag}: ${l.message}`).join("\n");
          const body = `Please describe the issue:\n\n\n---\nIISERKonnect Web ${APP_VERSION}\n${navigator.userAgent}\n${lines ? "\nRecent log:\n" + lines : ""}`;
          location.href = CONTACT_MAILTO + "?subject=" + encodeURIComponent("IISERK Web Error Report") + "&body=" + encodeURIComponent(body.slice(0, 1800));
          return;
        }
        case "export": return exportData();
        case "import": return importData(draw);
        case "wipe":
          if (await confirm({ title: "Erase everything?", text: "Every note, task, reminder, event, budget entry, chat, saved account and setting in this browser is deleted. This cannot be undone.", confirmLabel: "Erase", danger: true })) {
            for (const c of COLLECTIONS) await collection(c).clear().catch(() => {});
            store.clearAll(); clearCaches();
            try { sessionStorage.clear(); } catch {}
            location.hash = "#/login"; location.reload();
          }
      }
    });
  },
  about(el) {
    el.addEventListener("click", async (e) => {
      const t = e.target.closest("[data-act]");
      if (!t) return;
      if (t.dataset.act === "logout" && await confirm({ title: "Sign out?", text: "Campus chat disconnects and cached data (WeLearn courses, mess history, profile) is cleared. Saved accounts are kept.", confirmLabel: "Sign out", danger: true })) {
        creds.clear(); prefs.set("signedIn", false); prefs.set("loginSkipped", false); clearCaches(); nav.go("login", { replace: true });
      }
      if (t.dataset.act === "wipe-accounts" && await confirm({ title: "Delete all saved accounts?", text: "Every saved account (with its password) is removed from this device. You'll need to sign in manually next time.", confirmLabel: "Delete all", danger: true })) {
        prefs.set("savedAccounts", []); toast("Saved accounts deleted");
      }
    });
  },
};

/* PinDialog — resolves true when the action succeeded. */
function pinDialog({ title, confirm: label, current, newPin = true }) {
  return new Promise((resolve) => {
    let ok = false;
    dialog({
      title,
      body: `${current ? textField({ id: "pin-cur", label: "Current PIN", type: "password", a: { inputmode: "numeric", autocomplete: "off" } }) : ""}
        ${newPin ? textField({ id: "pin-new", label: `New PIN (${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} digits)`, type: "password", a: { inputmode: "numeric", autocomplete: "new-password" } }) + textField({ id: "pin-rep", label: "Repeat new PIN", type: "password", a: { inputmode: "numeric", autocomplete: "new-password" } }) : ""}
        <p class="t-body-s c-error" id="pin-err" aria-live="assertive"></p>`,
      actions: [{ label: "Cancel", value: null }, { label, value: "ok", primary: true }],
      validate: (v, d) => {
        const err = d.querySelector("#pin-err");
        const cur = d.querySelector("#pin-cur")?.value || "", nw = d.querySelector("#pin-new")?.value || "", rep = d.querySelector("#pin-rep")?.value || "";
        if (newPin && nw !== rep) { err.textContent = "The two PINs do not match."; haptics.reject(); return false; }
        if (newPin && !isAcceptablePin(nw)) { err.textContent = `Use ${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} digits, not all the same and not a run like 1234.`; haptics.reject(); return false; }
        // async checks: run, then click again when they pass
        if (d.dataset.verified !== "1") {
          (async () => {
            if (current && !(await checkPin(cur))) { err.textContent = "That PIN is not right."; haptics.reject(); return; }
            if (newPin) await setPin(nw); else disableLock();
            ok = true; haptics.confirm(); d.dataset.verified = "1";
            d.querySelector('[data-dlg="1"]').click();
          })();
          return false;
        }
        return true;
      },
    }).then(() => resolve(ok));
  });
}

/* CustomColorPickerDialog: presets + hue / saturation / brightness. */
function colorPicker(initial) {
  const toHsv = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [Math.round((h * 60 + 360) % 360), max ? d / max : 0, max];
  };
  const toHex = (h, s, v) => {
    const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return "#" + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
  };
  let [h, s, v] = toHsv(initial.slice(0, 7));
  const PRESETS = ["#4F9DFF", "#40C4FF", "#14B8A6", "#22C55E", "#F59E0B", "#EF4444", "#A855F7"];
  const body = () => `<div class="picker">
    <div class="row"><span class="color-dot color-dot--lg" style="background:${toHex(h, s, v)}"></span><span class="t-title-m mono" id="pk-hex">${toHex(h, s, v)}</span></div>
    <div class="row-wrap mt-sm">${PRESETS.map((p) => `<button type="button" class="color-dot color-dot--btn" style="background:${p}" data-preset="${p}" aria-label="${p}"></button>`).join("")}</div>
    <label class="t-label-l mt-md" for="pk-h">Hue</label><input class="slider slider--hue" id="pk-h" type="range" min="0" max="360" value="${h}">
    <label class="t-label-l" for="pk-s">Saturation ${Math.round(s * 100)}%</label><input class="slider" id="pk-s" type="range" min="0" max="100" value="${Math.round(s * 100)}" style="--val:${s * 100}%">
    <label class="t-label-l" for="pk-v">Brightness ${Math.round(v * 100)}%</label><input class="slider" id="pk-v" type="range" min="0" max="100" value="${Math.round(v * 100)}" style="--val:${v * 100}%">
  </div>`;
  let result = null;
  return dialog({
    title: "Choose Primary Color",
    body: `<div id="pk">${body()}</div>`,
    actions: [{ label: "Cancel", value: null }, { label: "Apply", value: "apply", primary: true }],
    onMount: (d) => {
      const host = d.querySelector("#pk");
      const redraw = (keepFocus) => { host.innerHTML = body(); if (keepFocus) host.querySelector("#" + keepFocus)?.focus(); };
      host.addEventListener("input", (e) => {
        if (e.target.id === "pk-h") h = +e.target.value;
        if (e.target.id === "pk-s") s = +e.target.value / 100;
        if (e.target.id === "pk-v") v = +e.target.value / 100;
        result = toHex(h, s, v);
        host.querySelector(".color-dot--lg").style.background = result;
        host.querySelector("#pk-hex").textContent = result;
        e.target.style.setProperty("--val", e.target.value / (e.target.max / 100) + "%");
      });
      host.addEventListener("click", (e) => { const p = e.target.closest("[data-preset]"); if (p) { [h, s, v] = toHsv(p.dataset.preset); result = p.dataset.preset; redraw(); } });
    },
  }).then((x) => (x === "apply" ? (result || toHex(h, s, v)) : null));
}

/* ── backup / restore (browser-local data) ── */
async function exportData() {
  const out = { format: "iiserkonnect-web-backup", version: 1, exportedAt: new Date().toISOString(), store: store.dump(), collections: {} };
  for (const c of COLLECTIONS) out.collections[c] = await collection(c).all().catch(() => []);
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `iiserkonnect-web-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  snackbar("Backup saved. It includes saved passwords — keep the file private.");
}
function importData(after) {
  const input = document.createElement("input");
  input.type = "file"; input.accept = "application/json,.json";
  input.onchange = async () => {
    const f = input.files && input.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (j.format !== "iiserkonnect-web-backup") throw new Error("not a backup");
      if (!await confirm({ title: "Restore this backup?", text: "Everything in this browser is replaced by the backup's contents.", confirmLabel: "Restore" })) return;
      store.clearAll();
      for (const [k, v] of Object.entries(j.store || {})) store.set(k, v);
      for (const c of COLLECTIONS) { await collection(c).clear(); if (Array.isArray(j.collections?.[c]) && j.collections[c].length) await collection(c).putAll(j.collections[c]); }
      applyTheme(); motion.applyMotion();
      snackbar("Backup restored."); after && after();
    } catch { snackbar("That file is not an IISERKonnect web backup."); }
  };
  input.click();
}
