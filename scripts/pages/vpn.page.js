/**
 * pages/vpn.page.js — VPN Connection (ui/vpn/VpnScreen.kt), a bottom-bar tab.
 *
 * A browser cannot create a VPN tunnel, so the connect controls are disabled
 * and the page explains the setup. The profile names are the app's own; the
 * server addresses come from the uploaded profile files and are not shown.
 */

import { esc } from "../ui/dom.js";
import { icon, topBar, screen, browserNote, textField, linkButton, radioRow, button } from "../ui/components.js";

const PROFILES = [
  { name: "IISERK-NKN", desc: "Primary (NKN)", file: "IISERK-NKN.ovpn" },
  { name: "IISERK-Alliance", desc: "Backup (Alliance)", file: "IISERK-Alliance.ovpn" },
];

export async function render(el) {
  el.innerHTML = screen({ cls: "tools-body",
    bar: topBar({ title: "VPN Connection", back: false }),
    body: `
      <section class="card card--high tools-vpn-status" aria-live="polite">
        ${icon("vpn_key_off", { size: 40 })}
        <div>
          <h2 class="t-title-m">VPN Off</h2>
          <p class="t-body-s c-muted">This browser cannot see whether a VPN is active on your device.</p>
        </div>
      </section>

      ${browserNote({
        icon: "vpn_lock",
        tone: "warn",
        title: "Browsers cannot create a VPN tunnel",
        body: "A web page cannot start an OpenVPN tunnel or change how this device sends its traffic, so the connect controls below are disabled. To connect, use the IISERKonnect Android app, or an OpenVPN app on your device with the campus profile files.",
      })}

      <section class="card card--high tools-stack">
        <h2 class="t-title-s">OpenVPN app</h2>
        <p class="t-body-s">Install an OpenVPN app to create VPN connections. Either option works — choose whichever you prefer.</p>
        <div class="tools-vpn-app">
          <p class="t-label-m">OpenVPN for Android (Open-Source, Recommended)</p>
          <div class="tools-actions">
            ${linkButton("F-Droid", "https://f-droid.org/en/packages/de.blinkt.openvpn/", { variant: "outlined", external: true })}
            ${linkButton("Play Store", "https://play.google.com/store/apps/details?id=de.blinkt.openvpn", { variant: "outlined", external: true })}
          </div>
        </div>
        <div class="tools-vpn-app">
          <p class="t-label-m">OpenVPN Connect (Official)</p>
          <div class="tools-actions">
            ${linkButton("Play Store", "https://play.google.com/store/apps/details?id=net.openvpn.openvpn", { variant: "outlined", external: true })}
          </div>
        </div>
        <p class="tools-fine c-muted">This browser cannot tell whether either app is installed.</p>
      </section>

      <section class="card card--high tools-stack">
        <h2 class="t-title-s">Required VPN Files</h2>
        <p class="t-body-s c-muted">Upload exactly these 3 files from your device files:</p>
        <ul class="tools-filelist">
          <li>${icon("description", { size: 18 })}<span>1. IISERK-NKN.ovpn</span></li>
          <li>${icon("description", { size: 18 })}<span>2. IISERK-Alliance.ovpn</span></li>
          <li>${icon("description", { size: 18 })}<span>3. IISERK-CA.crt</span></li>
        </ul>
        <p class="t-body-s c-muted">Files are uploaded in the Android app and kept in its private storage. This page never reads or stores them.</p>
        <p class="t-body-s c-error">Please upload all 3 files before connecting.</p>
      </section>

      <h2 class="t-title-s tools-heading">Select VPN Profile</h2>
      <div class="tools-stack-sm" role="radiogroup" aria-label="Select VPN Profile">
        ${PROFILES.map((p, i) => `<div class="card card--flush tools-vpn-profile">
          ${radioRow({ checked: i === 0, title: p.name, desc: p.desc, a: { disabled: true, "aria-disabled": "true" } })}
        </div>`).join("")}
      </div>

      <section class="card card--high tools-stack">
        ${textField({ id: "vpn-user", label: "VPN Username", a: { disabled: true, autocomplete: "off" } })}
        ${textField({ id: "vpn-pass", label: "VPN Password", type: "password", a: { disabled: true, autocomplete: "off" } })}
        <label class="tools-check tools-check--off">
          <input type="checkbox" disabled>
          <span>Save VPN credentials</span>
        </label>
        ${button("Connect", { block: true, disabled: true, icon: "vpn_key" })}
      </section>

      <section class="card tools-info">
        ${icon("info", { size: 20 })}
        <div>
          <p class="t-label-m">Auto-Detection (Android app)</p>
          <p class="t-body-s">This app automatically detects any active VPN on your device. If you connect through OpenVPN for Android, Android Settings, or any other VPN app, it will be detected here.</p>
        </div>
      </section>
    `,
  });
}
