/** pages/home.page.js — dashboard */

import { probeProxy } from "../core/net.js";
import { creds } from "../core/session.js";
import { pageHead, card } from "../ui/helpers.js";
import { icon } from "../components/icons.js";

export async function render(el) {
  const probe = await probeProxy();
  const hasCreds = creds.has();

  el.innerHTML = `
    <div class="page-head" style="margin-bottom:20px">
      <div>
        <div class="eyebrow">Dashboard</div>
        <h2 class="h2" style="font-size:1.5rem">Welcome back</h2>
        <p class="small" style="color:var(--text-secondary)">The campus app, in your browser — same features, same parsers, zero installs.</p>
      </div>
      <div class="row-gap">
        ${!hasCreds ? `<a class="btn btn--primary btn--sm" href="#/settings">${icon("lock", "btn__icon")} Sign in</a>` : `<span class="chip chip--success">${icon("check-circle")} Signed in</span>`}
      </div>
    </div>

    <div class="statrow">
      ${card(`<div class="stat">
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${probe.ok ? "var(--success)" : "var(--text-tertiary)"}"><span style="width:7px;height:7px;border-radius:50%;background:${probe.ok ? "var(--success)" : "var(--text-faint)"};box-shadow:0 0 0 3px ${probe.ok ? "color-mix(in srgb, var(--success) 16%, transparent)" : "transparent"}"></span>${probe.ok ? (probe.mock ? "Demo" : "Live") : "Offline"}</span>
        <span class="stat__value" style="font-size:1.125rem;margin-top:4px">Companion</span>
        <span class="stat__label">${probe.ok ? "Proxy connected" : "Start proxy/server.mjs"}</span>
      </div>`)}
      ${card(`<div class="stat">
        <span style="color:${hasCreds ? "var(--success)" : "var(--text-faint)"};display:flex;justify-content:center">${icon(hasCreds ? "check-circle" : "lock", "icon-sm")}</span>
        <span class="stat__value" style="font-size:1.125rem">${hasCreds ? "Ready" : "Sign in"}</span>
        <span class="stat__label">Campus login</span>
      </div>`)}
      ${card(`<div class="stat"><span class="stat__value">16</span><span class="stat__label">Modules</span><span class="tiny" style="color:var(--text-faint)">WeLearn to Chat</span></div>`)}
      ${card(`<div class="stat"><span class="stat__value">0</span><span class="stat__label">Cloud servers</span><span class="tiny" style="color:var(--text-faint)">100% local</span></div>`)}
    </div>

    <div class="home-grid">
      ${card(`
        <div class="app-card__header" style="margin:-4px -4px 12px;padding-bottom:12px">
          <h3 class="h3">Quick start</h3>
          <span class="chip">${probe.ok ? "Ready" : "Setup needed"}</span>
        </div>
        <div class="home-links">
          ${!hasCreds ? `<a href="#/settings">${icon("lock")} Add LDAP credentials <span style="margin-left:auto;color:var(--text-faint)">↗</span></a>` : ""}
          ${!probe.ok ? `<a href="#/settings">${icon("plug")} Start companion proxy <span style="margin-left:auto;color:var(--text-faint)">↗</span></a>` : ""}
          <a href="#/welearn">${icon("book")} WeLearn — courses & files <span style="margin-left:auto;color:var(--text-faint)">↗</span></a>
          <a href="#/mess">${icon("receipt")} Mess — transactions & budget <span style="margin-left:auto;color:var(--text-faint)">↗</span></a>
          <a href="#/calendar">${icon("calendar")} Calendar — week view <span style="margin-left:auto;color:var(--text-faint)">↗</span></a>
          <a href="#/chat">${icon("chat")} Campus Chat — P2P <span style="margin-left:auto;color:var(--text-faint)">↗</span></a>
        </div>`)}
      ${card(`
        <div class="app-card__header" style="margin:-4px -4px 12px;padding-bottom:12px">
          <h3 class="h3">How it works</h3>
          ${icon("shield", "icon--muted")}
        </div>
        <p class="small" style="color:var(--text-secondary);line-height:1.6">Browsers can't talk to campus hosts directly (CORS), so a tiny local proxy plays the role of the app's networking layer — cookie jars, logins and all. Every scraper here is a 1:1 port of the Kotlin parsers.</p>
        <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
          <span class="chip">No cloud</span><span class="chip">No analytics</span><span class="chip chip--accent">E2E chat</span>
        </div>
        <p class="tiny" style="color:var(--text-tertiary);margin-top:12px">Credentials never leave your machine except to campus itself.</p>`)}
    </div>

    <div class="app-card" style="margin-top:16px;display:flex;align-items:center;gap:12px;padding:14px 16px">
      <span style="width:28px;height:28px;border-radius:8px;background:var(--primary);color:var(--primary-contrast);display:grid;place-items:center;flex:none">${icon("zap", "icon-sm")}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.875rem;font-weight:600">Tip — try the theme switcher</div>
        <div class="tiny" style="color:var(--text-secondary)">Settings → Appearance holds the 9 app palettes. Your pick syncs live.</div>
      </div>
      <a class="btn btn--ghost btn--sm" href="#/settings">Open</a>
    </div>`;
}
