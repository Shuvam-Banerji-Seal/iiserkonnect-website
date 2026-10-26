/**
 * pages/emergency.page.js — Emergency Contacts (ui/emergency/EmergencyScreen.kt).
 *
 * Fully offline: the national numbers are listed in full and each is a tel:
 * link. The campus list is fetched by the Android app from the campus wiki;
 * this build does not carry those numbers, so the section says so instead of
 * guessing.
 */

import { esc } from "../ui/dom.js";
import { icon, topBar, screen, browserNote } from "../ui/components.js";
import { NATIONAL_CONTACTS } from "../data/emergency.data.js";

const row = (c) => `
  <li class="emerg-row">
    <span class="emerg-row__role">${esc(c.role)}</span>
    <a class="emerg-call" href="tel:${esc(c.phone)}" aria-label="Call ${esc(c.role)} ${esc(c.phone)}">
      <span class="emerg-call__num">${esc(c.phone)}</span>${icon("call", { size: 18 })}<span>Call</span>
    </a>
  </li>`;

export async function render(el) {
  el.innerHTML = screen({
    bar: topBar({ title: "Emergency Contacts" }),
    body: `
      <p class="emerg-intro">Campus emergency numbers — tap to call. Requires connection to the campus network.</p>
      <section class="emerg-card" aria-labelledby="emerg-national">
        <h2 class="emerg-card__title" id="emerg-national">${icon("medical_services", { size: 22 })}<span>National emergency numbers</span></h2>
        <ul class="emerg-list">${NATIONAL_CONTACTS.map(row).join("")}</ul>
      </section>
      <section class="emerg-card" aria-labelledby="emerg-campus">
        <h2 class="emerg-card__title" id="emerg-campus">${icon("emergency", { size: 22 })}<span>Campus</span></h2>
        <p class="emerg-placeholder">Campus numbers are not included in this build. The Android app fetches the live list from the campus wiki.</p>
      </section>
      ${browserNote({
        title: "Campus list needs the Android app",
        body: "Campus numbers are published on the campus intranet, which other websites cannot read from a browser. Use the Android app for the live list.",
        icon: "cloud_off",
        tone: "info",
      })}`,
  });
  return () => {};
}
