/**
 * main.js — app bootstrap: routes, shell, proxy status, theme
 */

import { registerRoute, setOutlet, startRouter, onRouted } from "./core/router.js?v=8";
import { probeProxy } from "./core/net.js?v=8";
import "./modules/theme-manager.js?v=8";
import { icon } from "./components/icons.js?v=8";

import { render as home } from "./pages/home.page.js?v=8";
import { render as settings } from "./pages/settings.page.js?v=8";
import { render as welearn } from "./pages/welearn.page.js?v=8";
import { render as mess } from "./pages/mess.page.js?v=8";
import { render as menu } from "./pages/menu.page.js?v=8";
import { render as calendar } from "./pages/calendar.page.js?v=8";
import { render as library } from "./pages/library.page.js?v=8";
import { render as research } from "./pages/research.page.js?v=8";
import { render as netmon } from "./pages/netmon.page.js?v=8";
import { renderTcp, renderGrades } from "./pages/gateway.page.js?v=8";
import { renderPyq, renderNotices, renderVoip } from "./pages/misc.page.js?v=8";
import { render as chat } from "./pages/chat.page.js?v=8";
import { render as about } from "./pages/about.page.js?v=8";

const ROUTES = [
  { id: "home",     title: "Home",        icon: "home",     group: null,       render: home },
  { id: "welearn",  title: "WeLearn",     icon: "book",     group: "Academics", render: welearn },
  { id: "grades",   title: "Grades",      icon: "award",    group: "Academics", render: renderGrades },
  { id: "pyq",      title: "PYQ",         icon: "archive",  group: "Academics", render: renderPyq },
  { id: "calendar", title: "Calendar",    icon: "calendar", group: "Campus",    render: calendar },
  { id: "mess",     title: "Mess",        icon: "receipt",  group: "Campus",    render: mess },
  { id: "menu",     title: "Mess Menu",   icon: "utensils", group: "Campus",    render: menu },
  { id: "notices",  title: "Notices",     icon: "megaphone",group: "Campus",    render: renderNotices },
  { id: "library",  title: "Library",     icon: "library",  group: "Campus",    render: library },
  { id: "research", title: "Research",    icon: "flask",    group: "Campus",    render: research },
  { id: "voip",     title: "VoIP",        icon: "phone",    group: "Tools",     render: renderVoip },
  { id: "tcp",      title: "TCP Counter", icon: "activity", group: "Tools",     render: renderTcp },
  { id: "netmon",   title: "Network",     icon: "radar",    group: "Tools",     render: netmon },
  { id: "chat",     title: "Campus Chat", icon: "chat",     group: "Tools",     render: chat },
  { id: "settings", title: "Settings",    icon: "settings", group: null,        render: settings },
  { id: "about",    title: "About",       icon: "info",     group: null,        render: about },
];

for (const r of ROUTES) registerRoute(r.id, r);

/* ── shell nav ── */
setOutlet(document.getElementById("outlet"));

const navLink = (r) =>
  `<a class="side-link" data-nav="${r.id}" href="#/${r.id}">${icon(r.icon)}<span>${r.title}</span></a>`;

const navHtml = () => {
  const groups = [...new Set(ROUTES.map((r) => r.group).filter(Boolean))];
  return (
    navLink(ROUTES[0]) +
    groups.map((g) =>
      `<div class="side-group"><div class="side-group__label">${g}</div>${
        ROUTES.filter((r) => r.group === g).map(navLink).join("")}</div>`).join("") +
    `<div class="side-group"><div class="side-group__label">System</div>` +
    [ROUTES.find((r) => r.id === "settings"), ROUTES.find((r) => r.id === "about")].map(navLink).join("") +
    `</div>`
  );
};

document.getElementById("sidebar").querySelector(".side-nav").innerHTML = navHtml();
document.getElementById("drawer").innerHTML = navHtml();

/* update foot theme button with icon */
const themeBtn = document.getElementById("theme-btn");
if (themeBtn) {
  themeBtn.innerHTML = `${icon("settings")}<span>Theme</span>`;
}

/* mobile drawer */
const burger = document.getElementById("burger");
const drawer = document.getElementById("drawer");
burger.onclick = () => {
  const open = drawer.classList.toggle("open");
  burger.setAttribute("aria-expanded", String(open));
  burger.innerHTML = open
    ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
    : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
};
drawer.addEventListener("click", (e) => {
  if (e.target.closest("a")) {
    drawer.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
    burger.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
  }
});

/* proxy pill */
async function refreshProxy() {
  const el = document.getElementById("proxy-pill");
  if (!el) return;
  const r = await probeProxy();
  const label = r.ok ? (r.mock ? "Demo" : "Live") : "Offline";
  const dotClass = r.ok ? (r.mock ? "mock" : "on") : "off";
  el.className = `proxy-pill ${dotClass}`;
  el.innerHTML = `<span class="proxy-pill__dot"></span>${label}`;
  el.title = r.ok ? `Companion ${r.mock ? "demo mode" : "connected"} — ${r.ok ? "campus reachable via proxy" : ""}` : "Companion offline — start proxy/server.mjs";
  // keep legacy dot in sync if present
  const legacy = document.getElementById("proxy-dot");
  if (legacy) {
    legacy.className = `proxy-dot ${dotClass}`;
    legacy.title = el.title;
  }
}
refreshProxy();
setInterval(refreshProxy, 12000);

/* breadcrumb + title */
onRouted((id) => {
  const r = ROUTES.find((x) => x.id === id);
  const title = r ? r.title : "IISERKonnect";
  const crumb = document.getElementById("topbar-breadcrumb");
  if (crumb) {
    crumb.innerHTML = r && r.group
      ? `<span>${r.group}</span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg><strong>${title}</strong>`
      : `<strong>${title}</strong>`;
  }
  const t = document.getElementById("topbar-title");
  if (t) t.textContent = title;
  document.title = `${title} · IISERKonnect Web`;
});

/* cmd+k → settings search focus */
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    const input = document.querySelector("#outlet input[type='search'], #outlet input[placeholder*='Search' i], #lib-q, #voip-q");
    if (input) input.focus();
    else location.hash = "#/settings";
  }
});

/* boot */
startRouter();
