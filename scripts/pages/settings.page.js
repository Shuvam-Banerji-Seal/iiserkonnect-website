/** pages/settings.page.js — credentials + theme + session (no proxy config) */

import { store } from "../core/store.js";
import { creds } from "../core/session.js";
import { pageHead, card } from "../ui/helpers.js";

export async function render(el) {
  const ldap = creds.get();

  el.innerHTML = `
    <div class="page-head" style="margin-bottom:20px">
      <div>
        <div class="eyebrow">Settings</div>
        <h2 class="h2">One login, every feature</h2>
        <p class="small body-muted">Credentials stored only in this browser. Shared by WeLearn, ERP, canteen, VPN &amp; chat — just like the app.</p>
      </div>
    </div>

    <div class="settings-grid">
      ${card(`
        <h3 class="h3">Campus account</h3>
        <label class="field"><span>LDAP username</span>
          <input id="f-user" class="input" value="${ldap?.u || ""}" placeholder="e.g. sbs22ms076" autocomplete="username"></label>
        <label class="field"><span>Password</span>
          <input id="f-pass" class="input" type="password" value="${ldap?.p || ""}" autocomplete="current-password"></label>
        <div class="row-gap">
          <button class="btn btn--primary btn--sm" id="save-creds">Save</button>
          <button class="btn btn--ghost btn--sm" id="clear-creds">Sign out &amp; clear</button>
        </div>
        <p class="small body-muted" style="margin-top:10px">On campus this page can log in directly. Off-campus, login-protected pages show an "Open campus portal" link.</p>
      `)}

      ${card(`
        <h3 class="h3">Appearance</h3>
        <p class="small body-muted">The same nine palettes that ship in the app.</p>
        <theme-picker></theme-picker>
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
  el.querySelector("#clear-creds").onclick = () => {
    creds.clear();
    toast("Signed out");
    render(el);
  };
}

function toast(msg) {
  let host = document.querySelector(".toast-host");
  if (!host) { host = document.createElement("div"); host.className = "toast-host"; document.body.appendChild(host); }
  const el = document.createElement("div"); el.className = "toast toast--info"; el.textContent = msg;
  host.appendChild(el); setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 350); }, 3200);
}
