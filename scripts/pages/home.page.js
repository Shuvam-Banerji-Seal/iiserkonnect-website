/** pages/home.page.js — faithful to ui/home/HomeScreen.kt */

import { creds } from "../core/session.js";
import { card } from "../ui/helpers.js";
import { icon } from "../components/icons.js";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}
function firstName(u) {
  if (!u) return "";
  const dot = u.split(".");
  if (dot.length >= 2) return dot[0].replace(/^./, (c) => c.toUpperCase());
  const us = u.split("_");
  if (us.length >= 2) return us[0].replace(/^./, (c) => c.toUpperCase());
  return "";
}

const TILES = {
  academics: [
    { icon: "book",       label: "WeLearn",          href: "#/welearn" },
    { icon: "book",       label: "Teaching Plans",   href: "#/research" },
    { icon: "edit-3",     label: "Course Selection", href: "#/grades" },
    { icon: "calendar",   label: "Timetable",        href: "#/calendar" },
    { icon: "folder",     label: "Course Material",  href: "https://drive.google.com/drive/folders/1ddxItH9bU8zvQxof3hM8h4fMNNu8UTmw?usp=drive_link", external: true },
    { icon: "award",      label: "Grade Card",       href: "#/grades" },
    { icon: "archive",    label: "PYQs",             href: "#/pyq" },
    { icon: "check-circle",label: "Attendance",      href: "#/welearn" },
  ],
  campus: [
    { icon: "celebrate",  label: "Event Calendar",   href: "#/calendar" },
    { icon: "calendar",   label: "Calendar",         href: "#/calendar" },
    { icon: "utensils",   label: "Mess Menu",        href: "#/menu" },
    { icon: "wallet",     label: "My Budget",        href: "#/mess" },
    { icon: "receipt",    label: "Mess Transactions",href: "#/mess" },
    { icon: "library",    label: "Library",          href: "#/library" },
    { icon: "life-buoy",  label: "Helpdesk",         href: "#/notices" },
    { icon: "phone",      label: "VoIP Directory",   href: "#/voip" },
    { icon: "chat",       label: "Campus Chat",      href: "#/chat" },
    { icon: "flask",      label: "Research Papers",  href: "#/research" },
    { icon: "plug",       label: "Mess Recharge",    href: "https://docs.google.com/forms/d/e/1FAIpQLSfRkplSmeklsEd8QWFpTFY3DTeuVpwUu-42SVYJtPsAgGmVvQ/viewform", external: true },
  ],
  tools: [
    { icon: "cast",       label: "Website",          href: "#/research" },
    { icon: "shield",     label: "VPN",              href: "#/settings" },
    { icon: "activity",   label: "TCP Counter",      href: "#/tcp" },
    { icon: "radar",      label: "Network Status",   href: "#/netmon" },
    { icon: "user",       label: "My Profile",       href: "#/settings" },
    { icon: "download",   label: "Downloads",        href: "#/welearn" },
    { icon: "lock",       label: "Reset Password",   href: "https://www.iiserkol.ac.in/account/", external: true },
  ],
};

function tile(t) {
  const ext = t.external ? ` target="_blank" rel="noopener"` : "";
  return `<a class="home-tile" href="${t.href}"${ext}>
    <span class="home-tile__icon">${icon(t.icon)}</span>
    <span class="home-tile__label">${t.label}</span>
  </a>`;
}
function section(title, tiles) {
  return `
    <div class="home-section">
      <h3 class="home-section__title">${title}</h3>
      <div class="home-tile-grid">${tiles.map(tile).join("")}</div>
    </div>`;
}

export async function render(el) {
  const hasCreds = creds.has();
  const u = hasCreds ? creds.get().u : "";
  const name = firstName(u);
  const greet = greeting();

  el.innerHTML = `
    <div class="greeting-header">
      <div>
        <h1 class="greeting-header__greeting">${name ? `${greet}, ${name}!` : `${greet}!`}</h1>
        <p class="greeting-header__sub">IISER Kolkata — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      </div>
    </div>

    <div class="hero-card">
      <div class="hero-card__icon">${icon("sparkles")}</div>
      <div class="hero-card__body">
        <div class="hero-card__eyebrow">Campus tools</div>
        <div class="hero-card__title">Faster access. Less friction.</div>
        <div class="hero-card__sub">WeLearn · Mess · Calendar · Chat — one login, every page.</div>
      </div>
      <span class="hero-card__arrow">↗</span>
    </div>

    ${!hasCreds ? `<div class="app-card" style="display:flex;align-items:center;gap:12px;padding:12px 16px;margin-bottom:16px">
      <span style="width:32px;height:32px;border-radius:8px;background:var(--warning);color:#000;display:grid;place-items:center;flex:none">${icon("lock", "icon-sm")}</span>
      <div style="flex:1"><div style="font-weight:600;font-size:0.875rem">Sign in to unlock everything</div><div class="tiny" style="color:var(--text-secondary)">Your LDAP credentials unlock WeLearn, mess, grades and chat.</div></div>
      <a class="btn btn--primary btn--sm" href="#/settings">Sign in</a>
    </div>` : ""}

    ${section("Academics", TILES.academics)}
    <div class="section-divider"></div>
    ${section("Campus Life", TILES.campus)}
    <div class="section-divider"></div>
    ${section("Tools & Network", TILES.tools)}
  `;

  const sections = el.querySelectorAll(".home-section");
  sections.forEach((s, i) => {
    s.style.opacity = "0";
    s.style.transform = "translateY(8px)";
    s.style.transition = `opacity 0.4s var(--ease-out) ${80 + i * 90}ms, transform 0.4s var(--ease-out) ${80 + i * 90}ms`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      s.style.opacity = "1";
      s.style.transform = "none";
    }));
  });
}
