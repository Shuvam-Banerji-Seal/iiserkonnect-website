/**
 * main.js — boot: theme → motion → shell → app lock → router.
 * Pure frontend: no backend, no build step. Everything personal stays in
 * this browser (localStorage + IndexedDB).
 */

import { prefs } from "./core/prefs.js";
import "./core/log.js";
import { applyTheme } from "./core/theme.js";
import { applyMotion, spec as motionSpec } from "./core/motion.js";
import { setStage, startRouter, onRouted, beforeRoute, nav } from "./core/router.js";
import { registerRoutes, TABS } from "./app/routes.js";
import { icon } from "./ui/icons.js";
import { haptics } from "./ui/haptics.js";
import { mountChatFab } from "./app/chatfab.js";
import { guardWithAppLock } from "./core/applock.js";
import { startNotifier } from "./core/notify.js";

applyTheme();
applyMotion();
prefs.on("themeMode", applyTheme);
prefs.on("nekoCoat", applyTheme);
prefs.on("customPrimaryHex", applyTheme);

/* ── NavigationBar / NavigationRail ── */
const navItem = (t) => `<a class="nav-item" href="${t.href}" data-tab="${t.id}" data-replace="false">
  <span class="nav-item__ind">${icon(t.icon)}<span class="nav-item__badge"></span></span>
  <span class="nav-item__label">${t.label}</span></a>`;
document.getElementById("bottom-nav").innerHTML = TABS.map(navItem).join("");
document.getElementById("rail").innerHTML =
  `<a class="rail__brand" href="#/home" aria-label="IISERKonnect home">${brandMark()}</a>` +
  TABS.map(navItem).join("") +
  `<div class="rail__spacer"></div><div class="rail__foot">IISERKonnect<br>web</div>`;

function brandMark() {
  return `<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path d="M8 12.5c0-3 3.4-5 7.5-5S23 9.5 23 12.5s-3.4 5-7.5 5h-.7L10.2 21v-4.2C8.8 15.9 8 14.3 8 12.5Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
}

function setActiveTab(tab) {
  document.querySelectorAll(".nav-item").forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

/* Tapping the tab you are already on does nothing (MainActivity). */
document.addEventListener("click", (e) => {
  const a = e.target.closest(".nav-item");
  if (!a) return;
  haptics.tap();
  const cur = nav.current();
  if (cur && cur.route.isTab && cur.route.tab === a.dataset.tab) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);

/* Top-bar back arrows anywhere: <button data-back> */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-back]");
  if (b) { e.preventDefault(); nav.back(b.dataset.back || "home"); return; }
  const c = e.target.closest("[data-clear-search]");
  if (c) {
    const input = c.parentElement.querySelector("input");
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    return;
  }
  if (e.target.closest(".tile, .tile-chip, .tile-row, .btn, .fab")) haptics.tap();
});
/* keep the search clear button in sync */
document.addEventListener("input", (e) => {
  const s = e.target.closest && e.target.closest(".search");
  if (s) s.classList.toggle("has-value", !!e.target.value);
});

/* ── routing ── */
setStage(document.getElementById("stage"));
registerRoutes();

let startupJumpDone = false;
beforeRoute((m, path) => {
  const signedIn = prefs.get("signedIn") || prefs.get("loginSkipped");
  if (!signedIn && m && m.route.pattern !== "login") return "login";
  // "Open on the mess menu": once per visit, only from Home, only when signed in.
  if (!startupJumpDone) {
    startupJumpDone = true;
    if (signedIn && prefs.get("jumpToMessMenu") && m && m.route.pattern === "home" && path === "home") {
      history.replaceState({ depth: 0 }, "", "#/home");
      setTimeout(() => nav.go("foodmenu"), 0);
    }
  }
  return null;
});

onRouted((route) => {
  setActiveTab(route.tab);
  document.body.classList.toggle("no-nav", route.pattern === "login");
  document.getElementById("bottom-nav").hidden = route.pattern === "login";
  document.getElementById("rail").hidden = route.pattern === "login";
});

/* FirstOpenAnimationOverlay (MainActivity): a short welcome, once per browser. */
function firstOpenOverlay() {
  if (prefs.get("onboarded")) return;
  prefs.set("onboarded", true);
  const o = document.createElement("div");
  o.className = "first-open";
  o.setAttribute("aria-hidden", "true");
  o.innerHTML = `<div><h1>Welcome to IISERK App</h1><p>Campus tools. Faster access. Less friction.</p></div>`;
  document.body.appendChild(o);
  const s = motionSpec();
  const fade = (from, to) => (s.dur ? o.animate([{ opacity: from }, { opacity: to }], { duration: s.dur, fill: "forwards" }).finished : Promise.resolve());
  fade(0, 1).then(() => new Promise((r) => setTimeout(r, 800))).then(() => fade(1, 0)).then(() => o.remove());
}

mountChatFab();
startNotifier();
firstOpenOverlay();
guardWithAppLock().then(() => startRouter()).then(() => {
  // unread chat messages kept from an earlier visit light the Chat tab badge
  import("./chat/engine.js").then((c) => c.updateBadge()).catch(() => {});
});
