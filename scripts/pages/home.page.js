/** pages/home.page.js — dashboard: proxy status, quick stats, quick links. */

import { probeProxy } from "../core/net.js";
import { creds } from "../core/session.js";
import { pageHead, card, esc } from "../ui/helpers.js";

export async function render(el) {
  const probe = await probeProxy();
  const hasCreds = creds.has();

  el.innerHTML = `
    ${pageHead("Home", "IISERKonnect Web",
      "The campus app, in your browser — same features, same parsers, zero installs.")}

    <div class="statrow">
      ${card(`<div class="stat">
        <span class="stat__value" style="color:${probe.ok ? "var(--success)" : "var(--text-muted)"}">${probe.ok ? "●" : "○"}</span>
        <span class="stat__label">Companion ${probe.ok ? (probe.mock ? "· demo" : "· live") : "offline"}</span>
      </div>`)}
      ${card(`<div class="stat">
        <span class="stat__value" style="color:${hasCreds ? "var(--success)" : "var(--text-muted)"}">${hasCreds ? "●" : "○"}</span>
        <span class="stat__label">Campus login</span>
      </div>`)}
      ${card(`<div class="stat"><span class="stat__value">16</span><span class="stat__label">Modules</span></div>`)}
      ${card(`<div class="stat"><span class="stat__value">0</span><span class="stat__label">Cloud servers</span></div>`)}
    </div>

    <div class="home-grid">
      ${card(`
        <h3 class="h3">Start here</h3>
        <ul class="home-links">
          ${!hasCreds ? `<li><a href="#/settings">🔐 Add your LDAP credentials in Settings</a></li>` : ""}
          ${!probe.ok ? `<li><a href="#/settings">🔌 Start the companion proxy (Settings has the command)</a></li>` : ""}
          <li><a href="#/welearn">📚 WeLearn — courses, files, downloads</a></li>
          <li><a href="#/mess">🍽️ Mess — transactions & budget</a></li>
          <li><a href="#/chat">💬 Campus Chat — serverless P2P</a></li>
        </ul>`)}
      ${card(`
        <h3 class="h3">How this works</h3>
        <p class="small body-muted">Browsers can't talk to campus hosts directly (CORS), so a tiny
        local proxy plays the role of the app's networking layer — cookie jars, logins and all.
        Every scraper here is a 1:1 port of the Android app's Kotlin parsers.</p>
        <p class="small body-muted" style="margin-top:8px">No cloud. No analytics. Your credentials
        never leave your machine except to campus itself.</p>`)}
    </div>`;
}
