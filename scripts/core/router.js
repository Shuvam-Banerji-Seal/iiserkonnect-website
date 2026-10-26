/**
 * core/router.js — hash router with the app's navigation rules.
 *
 * Routes use the Android route patterns (Screen.kt): "settings/:section",
 * "chat/room/:peer/:name", plus a ?query. Each route lazy-loads its page
 * module, so the first visit downloads only Home.
 *
 * Motion follows NavMotion.kt: drilling in slides, switching tab fades, Back
 * is the same motion mirrored. Direction is known because every navigation
 * made here is a pushState carrying a depth counter; a hash typed into the
 * address bar has none and simply fades.
 */

import * as motion from "./motion.js";

const routes = [];
let stage = null;
let current = null;          // { el, cleanup, path, route }
let depth = 0;
let navToken = 0;
let afterHooks = [];
let beforeHooks = [];
const scrollMemory = new Map();

/** Register a route: pattern like "welearn/courses/:id/:title/files". */
export function route(pattern, def) {
  const parts = pattern.split("/").filter(Boolean);
  routes.push({ pattern, parts, ...def });
}

export function setStage(el) { stage = el; }
export function onRouted(fn) { afterHooks.push(fn); }
export function beforeRoute(fn) { beforeHooks.push(fn); }

/** "#/foodmenu?meal=Lunch" → { path: "foodmenu", query: {meal: "Lunch"} } */
export function parseHash(hash = location.hash) {
  const raw = (hash || "").replace(/^#\/?/, "");
  const [p, qs = ""] = raw.split("?");
  const query = Object.fromEntries(new URLSearchParams(qs));
  return { path: p.replace(/\/+$/, "") || "home", query };
}

export function match(path) {
  const segs = path.split("/").filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  for (const r of routes) {
    if (r.parts.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < r.parts.length; i++) {
      const p = r.parts[i];
      if (p.startsWith(":")) params[p.slice(1)] = segs[i];
      else if (p !== segs[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

/** Build "#/a/b?x=1" from a path and query object. */
export function href(path, query) {
  const qs = query ? new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== "")).toString() : "";
  return "#/" + path.replace(/^#?\/?/, "") + (qs ? "?" + qs : "");
}

/** Encode one path segment (titles, names) the way Screen.createRoute does. */
export const seg = (s) => encodeURIComponent(String(s ?? ""));

export const nav = {
  go(target, { replace = false } = {}) {
    const h = target.startsWith("#") ? target : "#/" + target.replace(/^\/+/, "");
    if (h === location.hash && !replace) return;
    if (replace) history.replaceState({ depth }, "", h);
    else { depth += 1; history.pushState({ depth }, "", h); }
    render(replace ? "replace" : "forward");
  },
  /** Back like the app's top-bar arrow: pop if there is somewhere to pop to. */
  back(fallback = "home") {
    if (depth > 0) history.back();
    else nav.go(fallback, { replace: true });
  },
  get depth() { return depth; },
  current: () => current,
  reload() { render("replace"); },
};

function tabOf(r) { return r ? r.tab || null : null; }

async function render(kind) {
  const { path, query } = parseHash();
  const m = match(path) || match(aliasFor(path)) || match("home");
  for (const fn of beforeHooks) {
    const redirect = fn(m, path, query);
    if (redirect) { history.replaceState({ depth }, "", "#/" + redirect); return render("replace"); }
  }
  const prev = current;
  // Same pattern + same params + same query = nothing to do.
  const key = location.hash || "#/home";
  if (prev && prev.key === key && kind !== "replace") return;

  // NavMotion: tab↔tab and anything involving login fades; otherwise slides.
  const tabSwitch = prev && m.route.isTab && prev.route && prev.route.isTab;
  const motionKind = !prev || kind === "replace" || kind === "jump" || tabSwitch ? "fade" : kind;

  if (prev) {
    const body = prev.el.querySelector(".screen__scroll") || prev.el;
    scrollMemory.set(prev.key, body.scrollTop);
    if (scrollMemory.size > 40) scrollMemory.delete(scrollMemory.keys().next().value);
  }

  const token = ++navToken;
  const el = document.createElement("section");
  el.className = "screen";
  el.dataset.route = m.route.pattern;
  el.setAttribute("aria-busy", "true");
  stage.appendChild(el);

  const ctx = { params: m.params, query, path, nav, route: m.route };
  let cleanup = null;
  try {
    const mod = await m.route.load();
    const fn = mod[m.route.export || "render"];
    if (typeof fn !== "function") throw new Error("page has no " + (m.route.export || "render"));
    cleanup = await fn(el, ctx);
  } catch (err) {
    console.error(err);
    el.innerHTML = crashScreen(err);
  }
  el.removeAttribute("aria-busy");
  if (token !== navToken) { /* a newer navigation already won */ el.remove(); if (typeof cleanup === "function") cleanup(); return; }

  current = { el, cleanup, key, route: m.route, path, params: m.params, query };

  // restore scroll on Back
  if (kind === "back" && scrollMemory.has(key)) {
    const body = el.querySelector(".screen__scroll") || el;
    body.scrollTop = scrollMemory.get(key);
  }

  await transition(prev, el, motionKind);
  if (prev) {
    prev.el.remove();
    if (typeof prev.cleanup === "function") { try { prev.cleanup(); } catch (e) { console.warn(e); } }
  }
  const t = m.route.title;
  document.title = (typeof t === "function" ? t(ctx) : t || "IISERKonnect") + " · IISERKonnect Web";
  afterHooks.forEach((fn) => fn(m.route, ctx));
  // move focus for keyboard and screen-reader users without scrolling
  const h = el.querySelector("h1, .topbar__title");
  if (h && kind !== "replace") { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
}

function transition(prev, next, kind) {
  if (!prev || !motion.enabled()) return Promise.resolve();
  const s = motion.spec();
  const slide = s.slide > 1 ? `${(100 / s.slide).toFixed(2)}%` : "0%";
  const opts = { duration: s.dur, easing: s.ease };
  prev.el.classList.add("screen--leaving");
  const anims = [];
  if (kind === "forward") {
    anims.push(next.animate([{ transform: `translateX(${slide})`, opacity: 0 }, { transform: "none", opacity: 1 }], opts));
    anims.push(prev.el.animate([{ opacity: 1 }, { opacity: 0 }], opts));
  } else if (kind === "back") {
    anims.push(next.animate([{ opacity: 0 }, { opacity: 1 }], opts));
    anims.push(prev.el.animate([{ transform: "none", opacity: 1 }, { transform: `translateX(${slide})`, opacity: 0 }], opts));
  } else {
    anims.push(next.animate([{ opacity: 0 }, { opacity: 1 }], opts));
    anims.push(prev.el.animate([{ opacity: 1 }, { opacity: 0 }], opts));
  }
  return Promise.all(anims.map((a) => a.finished.catch(() => {})));
}

function crashScreen(err) {
  const msg = String((err && err.message) || err).replace(/[<>&]/g, "");
  return `<div class="topbar"><button class="icon-btn" onclick="history.back()" aria-label="Back"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg></button><h1 class="topbar__title">Something went wrong</h1></div>
  <div class="screen__scroll"><div class="screen__body"><div class="error-card"><p>${msg}</p><button class="btn" onclick="location.reload()">Retry</button></div></div></div>`;
}

/* Old web routes and short names keep working. */
const ALIASES = {
  mess: "mess-transactions", menu: "foodmenu", notices: "notice-board", tcp: "tcpcount",
  netmon: "network-dashboard", voip: "voip-directory", about: "settings/about", welearn: "welearn/courses",
  timetable: "schedule", emergency: "emergency-contacts", events: "campus-events",
};
function aliasFor(path) { return ALIASES[path] || path; }

export function startRouter() {
  const st = history.state;
  depth = st && Number.isFinite(st.depth) ? st.depth : 0;
  history.replaceState({ depth }, "", location.hash || "#/home");
  addEventListener("popstate", (e) => {
    const d = e.state && Number.isFinite(e.state.depth) ? e.state.depth : null;
    let kind = "jump";
    if (d != null) { kind = d < depth ? "back" : d > depth ? "forward" : "jump"; depth = d; }
    else { depth += 1; history.replaceState({ depth }, "", location.hash); }
    render(kind);
  });
  // in-app links: <a href="#/notes"> navigates with history depth tracking
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href^="#/"]');
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    e.preventDefault();
    nav.go(a.getAttribute("href"), { replace: a.dataset.replace === "true" });
  });
  return render("replace");
}
