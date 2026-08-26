/** pages/settings.page.js — credentials, companion, theme, session. */

import { store } from "../core/store.js";
import { creds } from "../core/session.js";
import { probeProxy, clearServerSession as clearJar } from "../core/net.js";
import { pageHead, card, esc, toast } from "../ui/helpers.js";
import "./../components/theme-picker-module.js";

export async function render(el) {
  const probe = await probeProxy();
  const ldap = creds.get();

  el.innerHTML = `
    ${pageHead("Settings", "One login, every feature",
      "Credentials are stored only in this browser and sent only to your local companion proxy.")}

    <div class="settings-grid">
      ${card(`
        <h3 class="h3">Campus account</h3>
        <p class="body-muted small">Shared by WeLearn, ERP, canteen, VPN & chat — same as the app.</p>
        <label class="field"><span>LDAP username</span>
          <input id="f-user" class="input" value="${esc(ldap?.u || "")}" placeholder="e.g. sbs22ms076" autocomplete="username"></label>
        <label class="field"><span>Password</span>
          <input id="f-pass" class="input" type="password" value="${esc(ldap?.p || "")}" autocomplete="current-password"></label>
        <div class="row-gap">
          <button class="btn btn--primary btn--sm" id="save-creds">Save</button>
          <button class="btn btn--ghost btn--sm" id="clear-creds">Sign out & clear</button>
        </div>
      `)}

      ${card(`
        <h3 class="h3">Companion proxy</h3>
        <p class="body-muted small">The local server that talks to campus for you.</p>
        <label class="field"><span>Base URL</span>
          <input id="f-proxy" class="input" value="${esc(store.get("proxyBase") || "http://localhost:8787")}"></label>
        <div class="row-gap">
          <button class="btn btn--primary btn--sm" id="save-proxy">Save</button>
          <button class="btn btn--ghost btn--sm" id="test-proxy">Test connection</button>
        </div>
        <p class="small ${probe.ok ? "ok-text" : "err-text"}" style="margin-top:10px">
          ${probe.ok ? `● Connected${probe.mock ? " — DEMO MODE (mock fixtures)" : ""}` : "● Not detected"}
        </p>
      `)}

      ${card(`
        <h3 class="h3">Appearance</h3>
        <p class="body-muted small">The same nine palettes that ship in the app.</p>
        <theme-picker></theme-picker>
      `)}

      ${card(`
        <h3 class="h3">Server session</h3>
        <p class="body-muted small">Cookie jars live in the proxy's memory, keyed to this browser.</p>
        <button class="btn btn--ghost btn--sm" id="clear-jar">Clear proxy session</button>
        <p class="tiny body-muted" style="margin-top:8px">Use this if a campus service acts logged-out.</p>
      `)}
    </div>
  `;

  el.querySelector("#save-creds").onclick = () => {
    const u = el.querySelector("#f-user").value.trim();
    const p = el.querySelector("#f-pass").value;
    if (!u || !p) return toast("Username and password required", "err");
    creds.save(u, p);
    toast("Credentials saved");
  };
  el.querySelector("#clear-creds").onclick = async () => {
    creds.clear(); await clearJar();
    toast("Signed out — proxy session cleared");
    render(el);
  };
  el.querySelector("#save-proxy").onclick = () => {
    store.set("proxyBase", el.querySelector("#f-proxy").value.trim());
    toast("Proxy URL saved"); render(el);
  };
  el.querySelector("#test-proxy").onclick = async () => {
    store.set("proxyBase", el.querySelector("#f-proxy").value.trim());
    const r = await probeProxy();
    toast(r.ok ? `Connected${r.mock ? " (mock mode)" : ""}` : "Not reachable — is it running?", r.ok ? "ok" : "err");
    if (r.ok) render(el);
  };
  el.querySelector("#clear-jar").onclick = async () => {
    await clearJar();
    store.set("flags", {});
    toast("Proxy session cleared");
  };
}
