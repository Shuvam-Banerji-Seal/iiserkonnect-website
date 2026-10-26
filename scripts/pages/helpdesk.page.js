/**
 * pages/helpdesk.page.js — Helpdesk (ui/helpdesk/HelpdeskScreen.kt).
 *
 * Eight fixed categories, each opening its campus ticket page in a new tab
 * (user-clicked). The vendor support numbers come from the campus help page
 * in the Android app; they are not in this build.
 */

import { esc } from "../ui/dom.js";
import { icon, topBar, screen, browserNote } from "../ui/components.js";
import { HELPDESK_CATEGORIES } from "../data/helpdesk.data.js";

export async function render(el) {
  el.innerHTML = screen({
    bar: topBar({ title: "Helpdesk" }),
    body: `
      <header class="help-head">
        <h2 class="help-head__title">Report Issues</h2>
        <p class="help-head__sub">Select a category to submit a helpdesk ticket via the campus Trac system.</p>
      </header>
      <div class="help-grid">${HELPDESK_CATEGORIES.map((c) => `
        <a class="help-card" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">
          <span class="help-card__icon">${icon(c.icon, { size: 24 })}</span>
          <span class="help-card__text">
            <span class="help-card__name">${esc(c.name)}</span>
            <span class="help-card__desc">${esc(c.description)}</span>
          </span>
          ${icon("open_in_new", { size: 18, cls: "help-card__ext" })}
        </a>`).join("")}
      </div>
      <section class="help-vendor" aria-labelledby="help-vendor-title">
        <h2 class="help-vendor__title" id="help-vendor-title">Vendor Support Numbers</h2>
        ${browserNote({
          title: "Not in this build",
          body: "The Android app lists vendor support numbers from the campus help page. Browsers cannot read that page, so the list is not shown here.",
          icon: "info",
          tone: "info",
        })}
      </section>`,
  });
  return () => {};
}
