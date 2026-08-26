/**
 * main.js — app bootstrap: registers routes, wires the shell (sidebar,
 * drawer, proxy status dot, theme dialog), starts the hash router.
 */

import { registerRoute, setOutlet, startRouter, onRouted } from "./core/router.js?v=4";
import { probeProxy } from "./core/net.js?v=4";
import "./modules/theme-manager.js?v=4";
import { themeManager } from "./modules/theme-manager.js?v=4";

import { render as home } from "./pages/home.page.js?v=4";
import { render as settings } from "./pages/settings.page.js?v=4";
import { render as welearn } from "./pages/welearn.page.js?v=4";
import { render as mess } from "./pages/mess.page.js?v=4";
import { render as menu } from "./pages/menu.page.js?v=4";
import { render as calendar } from "./pages/calendar.page.js?v=4";
import { render as library } from "./pages/library.page.js?v=4";
import { render as research } from "./pages/research.page.js?v=4";
import { render as netmon } from "./pages/netmon.page.js?v=4";
import { renderTcp, renderGrades } from "./pages/gateway.page.js?v=4";
import { renderPyq, renderNotices, renderVoip } from "./pages/misc.page.js?v=4";
import { render as chat } from "./pages/chat.page.js?v=4";
import { render as about } from "./pages/about.page.js?v=4";

/* ── route table (drives sidebar too) ──────────────────────────── */
const ROUTES = [
  { id: "home",      title: "Home",            icon: "🏠", group: null,      render: home },
  { id: "welearn",   title: "WeLearn",         icon: "📚", group: "Academics", render: welearn },
  { id: "grades",    title: "Grade Card",      icon: "🎓", group: "Academics", render: renderGrades },
  { id: "pyq",       title: "PYQ",             icon: "📄", group: "Academics", render: renderPyq },
  { id: "calendar",  title: "Calendar",        icon: "🗓️", group: "Campus",   render: calendar },
  { id: "mess",      title: "Mess",            icon: "🧾", group: "Campus",   render: mess },
  { id: "menu",      title: "Mess Menu",       icon: "🍽️", group: "Campus",   render: menu },
  { id: "notices",   title: "Notices",         icon: "📢", group: "Campus",   render: renderNotices },
  { id: "library",   title: "Library",         icon: "📖", group: "Campus",   render: library },
  { id: "research",  title: "Research",        icon: "🔬", group: "Campus",   render: research },
  { id: "voip",      title: "VoIP",            icon: "☎️", group: "Tools",    render: renderVoip },
  { id: "tcp",       title: "TCP Counter",     icon: "🌐", group: "Tools",    render: renderTcp },
  { id: "netmon",    title: "Network",         icon: "📡", group: "Tools",    render: netmon },
  { id: "chat",      title: "Campus Chat",     icon: "💬", group: "Tools",    render: chat },
  { id: "settings",  title: "Settings",        icon: "⚙️", group: null,      render: settings },
  { id: "about",     title: "About",           icon: "ℹ️", group: null,      render: about },
];

for (const r of ROUTES) registerRoute(r.id, r);

/* ── shell ─────────────────────────────────────────────────────── */
setOutlet(document.getElementById("outlet"));

const navHtml = () => {
  const groups = [...new Set(ROUTES.map((r) => r.group).filter(Boolean))];
  const link = (r) =>
    `<a class="side-link" data-nav="${r.id}" href="#/${r.id}"><span>${r.icon}</span>${r.title}</a>`;
  return (
    link(ROUTES[0]) +
    groups.map((g) =>
      `<div class="side-group"><div class="side-group__label">${g}</div>${
        ROUTES.filter((r) => r.group === g).map(link).join("")}</div>`).join("") +
    link(ROUTES.find((r) => r.id === "settings"))
  );
};
document.getElementById("sidebar").querySelector(".side-nav").innerHTML = navHtml();
document.getElementById("drawer").innerHTML = navHtml();

/* mobile drawer */
const burger = document.getElementById("burger");
const drawer = document.getElementById("drawer");
burger.onclick = () => {
  const open = drawer.classList.toggle("open");
  burger.setAttribute("aria-expanded", String(open));
};
drawer.addEventListener("click", (e) => {
  if (e.target.closest("a")) drawer.classList.remove("open");
});

/* theme quick button → cycles to the picker in Settings */
document.getElementById("theme-btn").onclick = () => { location.hash = "#/settings"; };

/* proxy status dot */
async function refreshDot() {
  const dot = document.getElementById("proxy-dot");
  const r = await probeProxy();
  dot.className = `proxy-dot ${r.ok ? (r.mock ? "mock" : "on") : "off"}`;
  dot.title = r.ok ? `Companion ${r.mock ? "(demo mode)" : "connected"}` : "Companion offline";
}
refreshDot();
setInterval(refreshDot, 15000);

/* topbar title + post-route hooks */
onRouted((id) => {
  const r = ROUTES.find((x) => x.id === id);
  document.getElementById("topbar-title").textContent = r ? r.title : "IISERKonnect";
});

/* boot */
startRouter();
