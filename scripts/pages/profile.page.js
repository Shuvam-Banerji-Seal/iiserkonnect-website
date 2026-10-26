/**
 * pages/profile.page.js — My Profile (ui/profile/ProfileScreen.kt) and the
 * ERP sub-pages (ui/profile/ProfilePageScreen.kt, route profile/page/:page).
 *
 * Everything from the ERP is sample data here (see data/profile.data.js).
 * The name, roll, stream and photo come from the Settings profile on this
 * device, as the Settings header shows them.
 */

import { prefs } from "../core/prefs.js";
import { nav } from "../core/router.js";
import { esc, on } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, sampleBanner, browserNote, linkButton, extLink, button, emptyState } from "../ui/components.js";
import {
  loadErp, PROFILE_SECTIONS, titleFor, isEditable, ERP_LOGIN_URL, ERP_DASHBOARD_URL,
} from "../data/profile.data.js";

/** ModuleCard icon picker (ProfileScreen.moduleIcon). */
export function moduleIcon(name = "") {
  const n = name.toLowerCase();
  if (n.includes("profile")) return "person";
  if (n.includes("google") || n.includes("workspace")) return "email";
  if (n.includes("help")) return "help_center";
  if (n.includes("device")) return "devices";
  if (n.includes("calendar")) return "calendar_month";
  if (n.includes("wiki") || n.includes("intranet") || n.includes("library")) return "menu_book";
  if (n.includes("welearn") || n.includes("learning") || n.includes("course")) return "school";
  if (n.includes("teaching") || n.includes("plan") || n.includes("apply") || n.includes("application")) return "description";
  if (n.includes("canteen") || n.includes("food") || n.includes("menu")) return "restaurant";
  if (n.includes("fee") || n.includes("payment")) return "payment";
  return "apps";
}

const initials = (name) => (String(name || "").trim()[0] || "?").toUpperCase();

/** The Settings profile header, as it reads on this device. */
function deviceProfileCard(p) {
  const name = (p.name || "").trim();
  const sub = [p.roll, p.stream].map((x) => (x || "").trim()).filter(Boolean).join(" · ");
  const photo = p.avatar && /^(data:image\/|blob:)/.test(p.avatar)
    ? `<img src="${esc(p.avatar)}" alt="Profile photo">` : `<span>${esc(name ? initials(name) : "?")}</span>`;
  return `<section class="card card--high tools-me" aria-label="Your details on this device">
    <div class="tools-me__portrait">${photo}</div>
    <div class="tools-me__text">
      <h2 class="t-title-m w-bold">${esc(name || "IISERK Student")}</h2>
      <p class="t-body-s c-muted">${esc(sub || "Tap to add your roll number & stream")}</p>
      <p class="tools-fine">${icon("lock", { size: 14 })} Shown only on this device.</p>
    </div>
    <a class="btn btn--tonal btn--sm" href="#/settings">${icon("edit", { size: 16 })}<span>Edit details</span></a>
  </section>`;
}

function moduleCard(m) {
  return `<a class="tools-module" href="${esc(ERP_DASHBOARD_URL)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(m.name)} (opens the website in a new tab)">
    <span class="tools-module__icon">${icon(moduleIcon(m.name), { size: 22 })}</span>
    <span class="tools-module__name">${esc(m.name)}</span>
    <span class="tools-module__desc">${esc(m.description || "")}</span>
  </a>`;
}

export async function render(el) {
  const { data: d, sample } = await loadErp();
  const p = prefs.get("profile") || {};
  const pct = Math.max(0, Math.min(100, d.erp.profileCompletion));

  const modules = d.erp.sections.map((s) => `
    <h2 class="tools-section-title">${esc(s.title)}</h2>
    <div class="tools-modules">${s.modules.map(moduleCard).join("")}</div>`).join("");

  const details = PROFILE_SECTIONS.map((s) => `
    <h3 class="tools-group-title">${esc(s.title)}</h3>
    <p class="tools-group-blurb">${esc(s.blurb)}</p>
    <div class="tools-list card card--high">
      ${s.slugs.map((slug, i) => `${i ? '<div class="group-divider group-divider--inset" role="separator"></div>' : ""}
        <a class="tools-row" href="#/profile/page/${esc(slug)}">
          <span class="tools-row__title">${esc(titleFor(slug))}</span>
          <span class="tools-row__tag">View</span>
          ${icon("chevron_right", { size: 20, cls: "tools-row__chev" })}
        </a>`).join("")}
    </div>`).join("");

  const fields = d.erp.fields.map(([label, value], i) => `
    ${i ? '<div class="group-divider" role="separator"></div>' : ""}
    <div class="tools-kv"><span class="tools-kv__k">${esc(label)}</span><span class="tools-kv__v">${esc(value)}</span></div>`).join("");

  el.innerHTML = screen({ cls: "tools-body",
    bar: topBar({
      title: "My Profile",
      actions: iconBtn("refresh", "Refresh", { "data-act": "refresh" })
        + `<a class="icon-btn" href="${esc(ERP_LOGIN_URL)}" target="_blank" rel="noopener noreferrer" aria-label="Open in browser" title="Open in browser">${icon("open_in_browser")}</a>`,
    }),
    body: `
      ${sample ? sampleBanner("the ERP dashboard") : ""}
      ${deviceProfileCard(p)}
      <section class="card card--high tools-welcome">
        <p class="t-body-s c-muted">Welcome back,</p>
        <h2 class="t-headline-m w-bold c-primary">${esc(d.erp.fullName)}</h2>
        <p class="tools-meta">${icon("email", { size: 16 })}<span>${esc(d.erp.email)}</span></p>
        <p class="tools-meta w-semi">${icon("person", { size: 16 })}<span>${esc(d.erp.idNumber)}</span></p>
      </section>
      <section class="card tools-completion">
        <div class="row-between"><span class="t-label-m w-med">Profile Completion</span><span class="t-label-l w-bold c-primary">${pct}%</span></div>
        <div class="lprog" role="progressbar" aria-label="Profile Completion" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      </section>
      ${modules}
      <h2 class="tools-section-title">Your details</h2>
      ${details}
      ${fields ? `<section class="card card--high tools-fields"><h2 class="t-title-m w-semi">Profile Details</h2>${fields}</section>` : ""}
      ${linkButton("View Full Dashboard on the website", ERP_DASHBOARD_URL, { variant: "outlined", icon: "open_in_new", external: true, block: true })}
    `,
  });

  on(el, "click", "[data-act=refresh]", () => nav.reload());
}

export async function renderPage(el, { params }) {
  const slug = params.page;
  const { data: d, sample } = await loadErp();
  const title = titleFor(slug) || "Profile";
  const page = d.pages[slug];
  const edit = isEditable(slug);

  let body;
  if (!page) {
    body = `${emptyState({
      icon: "description",
      title: "Nothing cached for this page yet.",
      body: "The Android app keeps a copy of each ERP page after you sign in to My Profile. This browser cannot fetch those pages, so there is nothing to show here.",
      action: `<div class="tools-actions">
        ${button("Back", { variant: "tonal", attrs: { "data-back": "profile" } })}
        ${linkButton("Open the ERP dashboard", ERP_DASHBOARD_URL, { variant: "filled", icon: "open_in_new", external: true })}
      </div>`,
    })}
    <p class="tools-fine c-muted">${esc(slug)}</p>`;
  } else {
    body = `
      ${sample ? sampleBanner("the ERP dashboard") : ""}
      ${edit ? browserNote({
        icon: "edit_note",
        tone: "info",
        title: "Read only here",
        body: "Changes on this page are saved to the ERP itself, not just to this app. This browser cannot save to the ERP, so the page is shown without editing.",
        extra: `<p>${extLink("Edit on the ERP website", ERP_DASHBOARD_URL)}</p>`,
      }) : ""}
      <section class="card card--high tools-fields">
        ${page.rows.map(([label, value], i) => `${i ? '<div class="group-divider" role="separator"></div>' : ""}
          <div class="tools-kv"><span class="tools-kv__k">${esc(label)}</span><span class="tools-kv__v">${esc(value)}</span></div>`).join("")}
      </section>
      <p class="tools-fine c-muted">Sample copy, not fetched from the ERP</p>`;
  }

  el.innerHTML = screen({ cls: "tools-body", bar: topBar({ title }), body });
}
