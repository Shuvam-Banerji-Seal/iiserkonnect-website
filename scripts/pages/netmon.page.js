/**
 * pages/netmon.page.js — Network Status (ui/networkdashboard/
 * NetworkDashboardScreen.kt, NetworkStatus.kt).
 *
 * Service endpoints, campus device monitors (Skipole status pages) and MRTG
 * traffic graphs. A browser cannot ping hosts or open sockets, and campus
 * monitors answer only on campus, so every result is sample data. The MRTG
 * graphs are drawn as SVG from the sample numbers; no campus image is loaded.
 */

import { esc, on } from "../ui/dom.js";
import { nav } from "../core/router.js";
import { icon, topBar, screen, iconBtn, sampleBanner, browserNote, button } from "../ui/components.js";
import { loadNetwork, monitorResult, overview, verdictText, agoLabel } from "../data/network.data.js";

const VERDICT_ICON = {
  AllWell: ["check_circle", "ok"],
  Degraded: ["warning", "warn"],
  OffCampus: ["signal_wifi_off", "info"],
  Offline: ["wifi_off", "bad"],
  Checking: ["hourglass_empty", "info"],
};

/** Smooth-free two-series line chart (in / out), drawn from sample numbers. */
export function mrtgChart(title, inSeries, outSeries) {
  const W = 320, H = 130, pad = { l: 34, r: 8, t: 8, b: 18 };
  const max = Math.max(1, ...inSeries, ...outSeries) * 1.1;
  const x = (i, n) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, n - 1);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const line = (s) => s.map((v, i) => `${i ? "L" : "M"}${x(i, s.length).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const grid = [0, 0.5, 1].map((f) => {
    const gy = y(max * f);
    return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${gy}" y2="${gy}" class="tools-chart__grid"/>
      <text x="${pad.l - 4}" y="${gy + 3}" text-anchor="end" class="tools-chart__tick">${Math.round(max * f)}</text>`;
  }).join("");
  return `<figure class="tools-chart">
    <figcaption class="t-label-m">${esc(title)}</figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}: sample traffic in and out, Mbps">
      ${grid}
      <path d="${line(inSeries)}" class="tools-chart__in" fill="none"/>
      <path d="${line(outSeries)}" class="tools-chart__out" fill="none"/>
      <text x="${pad.l}" y="${H - 4}" class="tools-chart__tick">24 samples</text>
      <text x="${W - pad.r}" y="${H - 4}" text-anchor="end" class="tools-chart__tick">Mbps</text>
    </svg>
    <p class="tools-legend"><span class="tools-legend__in">In</span><span class="tools-legend__out">Out</span></p>
  </figure>`;
}

const dot = (up) => `<span class="tools-dot tools-dot--${up ? "up" : "down"}" aria-label="${up ? "Online" : "Problem reported"}"></span>`;

function monitorBlock(r) {
  const name = esc(r.source.name);
  if (r.error) {
    return `<div class="card card--flush tools-mon tools-mon--off">
      <div class="tools-mon__head">${icon("signal_wifi_off", { size: 22 })}<div><h3 class="t-title-s">${name}</h3><p class="t-body-s c-muted">${esc(r.error)}</p></div></div>
    </div>`;
  }
  const sub = `${r.upCount} up${r.downCount ? ` · ${r.downCount} down` : ""}${r.alertGroups ? ` · ${r.alertGroups} alerting` : ""}`;
  const groups = r.groups.map((g) => `<details class="tools-group"${g.alert ? " open" : ""}>
      <summary><span class="t-label-l">${esc(g.name)}</span><span class="t-label-s c-muted">${g.hosts.filter((h) => h.up).length}/${g.hosts.length} up</span></summary>
      <ul class="tools-hosts">${g.hosts.map((h) => `<li>${dot(h.up)}<span>${esc(h.name)}</span><span class="t-label-s">${h.up ? "Online" : "Problem reported"}</span></li>`).join("")}</ul>
    </details>`).join("");
  return `<details class="card card--flush tools-mon">
    <summary class="tools-mon__head">${icon("router", { size: 22 })}<span class="tools-mon__text"><span class="t-title-s">${name}</span><span class="t-body-s c-muted">${esc(sub)}</span></span>${icon("expand_more", { size: 20, cls: "tools-mon__chev" })}</summary>
    <div class="tools-mon__body">${groups}</div>
  </details>`;
}

export async function render(el) {
  const { data, sample } = await loadNetwork();
  const results = data.monitors.map(monitorResult);
  const o = overview(data.endpoints, results);
  const [title, sub] = verdictText(o);
  const [vIcon, tone] = VERDICT_ICON[o.verdict];
  const ago = agoLabel(Date.now() - data.updatedMinutesAgo * 60000);

  el.innerHTML = screen({ cls: "tools-body",
    bar: topBar({ title: "Network Status", actions: iconBtn("refresh", "Refresh", { "data-act": "refresh" }) }),
    body: `
      ${sample ? sampleBanner("the campus network") : ""}
      ${browserNote({
        icon: "info",
        tone: "info",
        title: "This browser cannot run these checks",
        body: "A web page cannot ping hosts or open network sockets, and the campus monitors answer only on campus. Results here are sample data. The Android app checks each service and device from the phone itself.",
      })}
      <section class="card tools-verdict tools-verdict--${tone}" aria-live="polite">
        ${icon(vIcon, { size: 40 })}
        <div>
          <h2 class="t-title-m">${esc(title)}</h2>
          <p class="t-body-s">${esc(sub)}</p>
          <p class="t-label-s">${o.monitorsTotal ? `${results.filter((r) => !r.error).length}/${o.monitorsTotal} monitors reporting` : ""}${ago ? ` · updated ${esc(ago)}` : ""} · sample</p>
        </div>
      </section>
      ${button("Re-check All Endpoints", { variant: "tonal", icon: "refresh", block: true, disabled: true })}
      <p class="tools-fine c-muted tools-center">Checks need the Android app or a campus connection; this browser cannot start them.</p>

      <h2 class="t-title-m tools-heading">Services</h2>
      <section class="card card--flush tools-svc">
        <div class="tools-svc__head"><span class="t-title-s">Service Endpoints</span><span class="t-body-s c-muted">${o.servicesUp} of ${o.servicesTotal} online${o.servicesDown ? ` · ${o.servicesDown} down` : ""}</span></div>
        <ul class="tools-hosts">${data.endpoints.map((e) => `<li>${dot(e.up)}<span class="tools-svc__name">${esc(e.name)}<small>${esc(e.host)}</small></span><span class="t-label-s">${e.up ? `${e.ms} ms` : "Problem reported"}</span></li>`).join("")}</ul>
      </section>

      <h2 class="t-title-m tools-heading">Campus devices</h2>
      <div class="tools-mons">${results.map(monitorBlock).join("")}</div>

      <h2 class="t-title-m tools-heading">Traffic</h2>
      <section class="card tools-traffic">
        <h3 class="t-title-s">Traffic Graphs (MRTG)</h3>
        <p class="t-body-s c-muted">Router and switch bandwidth over time</p>
        ${data.mrtg.map((src) => `<div class="tools-traffic__src"><h4 class="t-label-l">${esc(src.name)}</h4>
          ${src.targets.map((t) => mrtgChart(t.title, t.in, t.out)).join("")}</div>`).join("")}
      </section>
    `,
  });

  on(el, "click", "[data-act=refresh]", () => nav.reload());
}
