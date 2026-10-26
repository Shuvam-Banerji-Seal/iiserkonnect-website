/**
 * pages/tcpcount.page.js — Device Count (ui/tcpcount/TcpCountScreen.kt).
 *
 * The gateway needs a CAPTCHA sign-in, which a browser on another site cannot
 * complete, so the figures and devices are sample data. The gateway opens in
 * a new tab when the user asks for it.
 */

import { esc } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, sampleBanner, browserNote, linkButton, linearProgress } from "../ui/components.js";
import { loadGateway, GATEWAY_URL, deviceIcon } from "../data/tcp.data.js";
import { nav } from "../core/router.js";
import { on } from "../ui/dom.js";

export function deviceCard(d) {
  return `<article class="card card--flush tools-device">
    <span class="tools-device__icon">${icon(deviceIcon(d.deviceType), { size: 22 })}</span>
    <div class="tools-device__text">
      ${d.slNo ? `<span class="tools-device__no">#${esc(d.slNo)}</span>` : ""}
      ${d.macAddress ? `<span class="tools-device__mac">${esc(d.macAddress)}</span>` : ""}
      ${d.deviceType ? `<span class="t-body-s">Type: ${esc(d.deviceType)}</span>` : ""}
      ${d.location ? `<span class="t-body-s">Location: ${esc(d.location)}</span>` : ""}
      ${d.validFrom || d.validTill ? `<span class="t-label-s c-muted">Valid: ${esc(d.validFrom)} — ${esc(d.validTill)}</span>` : ""}
    </div>
  </article>`;
}

export async function render(el) {
  const { data: d, sample } = await loadGateway();
  const ratio = d.maxAllowed > 0 ? Math.min(1, d.totalDevices / d.maxAllowed) : 0;

  el.innerHTML = screen({ cls: "tools-body",
    bar: topBar({
      title: "Device Count",
      actions: iconBtn("refresh", "Refresh", { "data-act": "refresh" })
        + `<a class="icon-btn" href="${esc(GATEWAY_URL)}" target="_blank" rel="noopener noreferrer" aria-label="Open in browser" title="Open in browser">${icon("open_in_browser")}</a>`,
    }),
    body: `
      ${sample ? sampleBanner("the campus gateway") : ""}
      ${browserNote({
        icon: "security",
        tone: "warn",
        title: "Gateway sign-in needs a CAPTCHA",
        body: "Campus servers do not answer requests from other websites, and the gateway asks for a CAPTCHA, so this browser cannot sign in or read your devices. The figures and devices below are sample data.",
      })}
      ${linkButton("Open the gateway in a new tab", GATEWAY_URL, { variant: "filled", icon: "open_in_new", external: true, block: true })}
      <section class="card card--primary tools-hero" aria-label="TCP count">
        <div class="tools-hero__head">
          ${icon("network_check", { size: 40, cls: "c-primary" })}
          <div>
            <h2 class="t-title-m">TCP Count</h2>
            <p class="t-body-s">User: ${esc(d.user)}</p>
          </div>
        </div>
        <p class="tools-hero__count" aria-label="${d.tcpCount} current TCP connections">${d.tcpCount}</p>
        <p class="t-body-s tools-center">Current TCP connections</p>
        <p class="t-body-m w-med tools-center">${d.totalDevices} registered device(s)${d.maxAllowed > 0 ? ` <span class="t-body-m">/ ${d.maxAllowed} max</span>` : ""}</p>
        ${d.maxAllowed > 0 ? linearProgress(ratio) : ""}
        <p class="t-label-s tools-center">Sample figures, not live</p>
      </section>
      ${d.devices.length ? `<h2 class="t-title-m tools-heading">Registered Devices</h2>
        <div class="tools-devices">${d.devices.map(deviceCard).join("")}</div>` : ""}
      ${d.devices.length === 0 && d.totalDevices > 0 ? `<section class="card tools-center"><p class="t-body-l">${d.totalDevices} device(s) registered</p><p class="t-body-s c-muted">Detailed device info may not be available from this page.</p></section>` : ""}
    `,
  });

  on(el, "click", "[data-act=refresh]", () => nav.reload());
}
