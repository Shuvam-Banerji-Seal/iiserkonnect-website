/**
 * data/network.data.js — the Network Status model (ui/networkdashboard/
 * NetworkStatus.kt): verdict, service and device counts, MRTG targets.
 *
 * A browser cannot ping hosts or open raw sockets, and the monitors sit on
 * campus addresses, so every result here is sample data
 * (data/samples/network.json). The verdict logic is the app's own.
 */

import { load } from "../services/source.js";

export async function loadNetwork() {
  return load("network");
}

/** Turn a sample monitor into the result shape the app builds from a parsed page. */
export function monitorResult(m) {
  if (m.campusOnly) return { source: m, error: "Needs the campus network" };
  const groups = m.groups || [];
  const hosts = groups.flatMap((g) => g.hosts);
  return {
    source: m,
    error: null,
    upCount: hosts.filter((h) => h.up).length,
    downCount: hosts.filter((h) => !h.up).length,
    alertGroups: groups.filter((g) => g.alert || g.hosts.some((h) => !h.up)).length,
    groups,
  };
}

/** NetworkStatus.overview, over endpoints (up: true | false | null) and monitor results. */
export function overview(endpoints, results) {
  const servicesUp = endpoints.filter((e) => e.up === true).length;
  const servicesDown = endpoints.filter((e) => e.up === false).length;
  const servicesPending = endpoints.filter((e) => e.up == null).length;
  let reporting = 0, failed = 0, devicesUp = 0, devicesDown = 0, campusOnlyTotal = 0, campusOnlyFailed = 0;
  for (const r of results) {
    if (r.source.campusOnly) campusOnlyTotal++;
    if (r.error) { failed++; if (r.source.campusOnly) campusOnlyFailed++; }
    else { reporting++; devicesUp += r.upCount; devicesDown += r.downCount; }
  }
  const total = endpoints.length + results.length;
  const nothingBackYet = servicesPending === endpoints.length && reporting === 0 && failed === 0;
  let verdict;
  if (nothingBackYet) verdict = "Checking";
  else if (endpoints.length && servicesUp === 0 && servicesPending === 0) verdict = "Offline";
  else if (campusOnlyTotal > 0 && campusOnlyFailed === campusOnlyTotal && servicesUp > 0) verdict = "OffCampus";
  else if (servicesDown > 0 || devicesDown > 0 || failed > 0) verdict = "Degraded";
  else verdict = "AllWell";
  return {
    verdict, servicesUp, servicesDown, servicesPending, servicesTotal: endpoints.length,
    devicesUp, devicesDown, reporting, failed, monitorsTotal: results.length,
    campusOnlyTotal, campusOnlyFailed, total,
  };
}

/** Headline and supporting line for a verdict (NetworkStatus / NetworkDashboardScreen). */
export function verdictText(o) {
  switch (o.verdict) {
    case "AllWell": return ["Everything is up", `${o.servicesUp} services and ${o.devicesUp} devices reporting`];
    case "Degraded": {
      const s = o.servicesDown, d = o.devicesDown;
      const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
      let title = "Some monitors did not answer";
      if (s > 0 && d > 0) title = `${s} service and ${d} device problems`;
      else if (s > 0) title = `${plural(s, "service")} down`;
      else if (d > 0) title = `${plural(d, "device")} down`;
      return [title, `${o.servicesUp}/${o.servicesTotal} services · ${o.devicesUp} devices up`];
    }
    case "Offline": return ["No connection", "Nothing answered. Check Wi-Fi or mobile data."];
    case "OffCampus": return ["Off the campus network", "Campus services are fine; the device monitors need the campus network"];
    default: return ["Checking…", "Contacting campus services"];
  }
}

/** NetworkStatus.agoLabel */
export function agoLabel(atMillis, nowMillis = Date.now()) {
  if (atMillis == null || atMillis <= 0) return null;
  const e = nowMillis - atMillis;
  if (e < 10_000) return "just now";
  if (e < 60_000) return `${Math.floor(e / 1000)}s ago`;
  if (e < 3_600_000) return `${Math.floor(e / 60_000)} min ago`;
  if (e < 86_400_000) return `${Math.floor(e / 3_600_000)} h ago`;
  return `${Math.floor(e / 86_400_000)} d ago`;
}
