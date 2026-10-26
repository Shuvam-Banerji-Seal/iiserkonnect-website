/**
 * pages/macreg.page.js — MAC Registration (ui/macreg/MacRegScreen.kt).
 *
 * The app shows the gateway's MAC registration page in a WebView. A browser
 * cannot show it here (campus sign-in and CAPTCHA, no cross-site access), so
 * the page offers the gateway in a new tab and shows sample registrations.
 */

import { esc, on } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, sampleBanner, browserNote, linkButton } from "../ui/components.js";
import { loadGateway, GATEWAY_URL, deviceIcon } from "../data/tcp.data.js";
import { nav } from "../core/router.js";

export async function render(el) {
  const { data: d, sample } = await loadGateway();

  el.innerHTML = screen({ cls: "tools-body",
    bar: topBar({
      title: "MAC Registration",
      actions: iconBtn("refresh", "Refresh", { "data-act": "refresh" })
        + `<a class="icon-btn" href="${esc(GATEWAY_URL)}" target="_blank" rel="noopener noreferrer" aria-label="Open in browser" title="Open in browser">${icon("open_in_browser")}</a>`,
    }),
    body: `
      ${sample ? sampleBanner("the campus gateway") : ""}
      ${browserNote({
        icon: "devices",
        tone: "warn",
        title: "Registration needs the campus gateway",
        body: "Registering a device means signing in to the campus gateway with your credentials and a CAPTCHA. This browser cannot load that page, so use the gateway in a new tab. The list below is sample data.",
      })}
      ${linkButton("Open MAC Registration in a new tab", GATEWAY_URL, { variant: "filled", icon: "open_in_new", external: true, block: true })}
      <h2 class="t-title-m tools-heading">Registered devices</h2>
      <div class="tools-devices">
        ${d.devices.map((x) => `<article class="card card--flush tools-device">
          <span class="tools-device__icon">${icon(deviceIcon(x.deviceType), { size: 22 })}</span>
          <div class="tools-device__text">
            <span class="tools-device__mac">${esc(x.macAddress)}</span>
            <span class="t-body-s">${esc(x.deviceType)} · ${esc(x.location)}</span>
          </div>
        </article>`).join("")}
      </div>
      <p class="tools-fine c-muted tools-center">MAC addresses shown are made up (02:00:00:xx:xx:xx).</p>
    `,
  });

  on(el, "click", "[data-act=refresh]", () => nav.reload());
}
