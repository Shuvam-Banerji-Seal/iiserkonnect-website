/**
 * services/netmon.service.js — ports of SkipoleStatusParser, HostDetailParser
 * and MrtgTargetParser (all were pure-regex in Kotlin — direct translation).
 */

import { get } from "../core/net.js";

/* ── Skipole status page ───────────────────────────────────────── */
export function parseSkipole(html, baseUrl) {
  const groups = [];
  let current = null;
  const re = /<a\s+class="(greenhost|redhost|whitegroup|redgroup)"\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gis;
  for (const m of html.matchAll(re)) {
    const cls = m[1].toLowerCase();
    const name = m[3].replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    if (!name) continue;
    if (cls === "whitegroup" || cls === "redgroup") {
      if (current && current.hosts.length) groups.push(current);
      current = { name, hosts: [], alerts: cls === "redgroup" };
    } else {
      if (!current) current = { name: "Ungrouped", hosts: [], alerts: false };
      current.hosts.push({ name, up: cls === "greenhost", url: resolve(baseUrl, m[2]) });
      if (cls === "redhost") current.alerts = true;
    }
  }
  if (current && current.hosts.length) groups.push(current);
  return groups;
}

export const summarize = (groups) => {
  let up = 0, down = 0, alerts = 0;
  for (const g of groups) {
    if (g.alerts) alerts++;
    for (const h of g.hosts) h.up ? up++ : down++;
  }
  return { up, down, alerts };
};

/* ── host detail ───────────────────────────────────────────────── */
export function parseHostDetail(html, baseUrl) {
  const name = /<title>(.*?)<\/title>/i.exec(html)?.[1]?.trim();
  if (!name) return null;
  const statusCls = /<h1 class="is_([a-z]+)"/i.exec(html)?.[1]?.toLowerCase();
  const status = statusCls === "green" ? "UP" : statusCls === "red" ? "DOWN" : "UNKNOWN";
  const description = strip(/<span class="description">(.*?)<\/span>/is.exec(html)?.[1]);
  const lastChecked = strip(/<p class="is_white">(.*?)<\/p>/is.exec(html)?.[1]);
  const graph = /<img[^>]*src="(log\.png)"/i.exec(html)?.[1];
  const log = /<iframe[^>]*src="(log\.html)"/i.exec(html)?.[1];
  return {
    name, status, description, lastChecked,
    graphUrl: graph ? resolve(baseUrl, graph) : null,
    logUrl: log ? resolve(baseUrl, log) : null,
  };
}

export function parsePingLog(logText) {
  const re = /^(\w{3} \w{3} \d{2} \d{2}:\d{2}:\d{2} \d{4})\s*:\s*Replies\s*=\s*(\d+)\s*:\s*milliseconds RTT\s*=\s*(\d+)/gm;
  return [...logText.matchAll(re)]
    .map((m) => ({ timestamp: m[1], replies: +m[2], rtt: +m[3] }))
    .reverse();
}

/* ── MRTG ──────────────────────────────────────────────────────── */
export function parseMrtgIndex(html, baseUrl) {
  const targets = [];
  const re = /<img[^>]*\balt="([^"]*?)\s*Traffic Graph"[^>]*\bsrc="([^"]*-day\.png)"[^>]*>/gis;
  for (const m of html.matchAll(re)) {
    const base = m[2].replace(/-day\.png$/, "");
    targets.push({
      title: m[1].replace(/&amp;/g, "&").trim(), base,
      day: resolve(baseUrl, m[2]),
      week: resolve(baseUrl, `${base}-week.png`),
      month: resolve(baseUrl, `${base}-month.png`),
      year: resolve(baseUrl, `${base}-year.png`),
    });
  }
  return targets;
}

const resolve = (base, href) => !href ? null
  : /^https?:\/\//.test(href) ? href
  : href.startsWith("/") ? base + href : `${base}/${href}`;

const strip = (s) => (s || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

/* ── high-level fetchers used by the page ──────────────────────── */
export const MONITORS = [
  { name: "Campus Network (LAN)", url: "https://gw.iiserkol.ac.in/live/" },
  { name: "Switches", url: "http://10.0.20.20/live/" },
  { name: "Access Points", url: "http://10.0.50.51/live-ap/" },
  { name: "ONU Devices", url: "http://10.0.50.52/live/" },
];

export const MRTG_SOURCES = [
  { name: "Core Router (gw)", url: "https://gw.iiserkol.ac.in/mrtg/" },
];

export const ENDPOINTS = [
  "WeLearn (Moodle)|https://welearn.iiserkol.ac.in",
  "IISERK Website|https://www.iiserkol.ac.in",
  "Samarth Portal|https://iiserkol.samarth.edu.in",
  "Intranet|https://intranet.iiserkol.ac.in",
  "Calendar|https://calendar.iiserkol.ac.in",
  "TCP Counter / Gateway|https://gw.iiserkol.ac.in",
  "Canteen ERP|https://newsmerp.iiserkol.ac.in",
  "Helpdesk|http://helpdesk.iiserkol.ac.in",
].map((s) => { const [name, url] = s.split("|"); return { name, url }; });

export async function fetchMonitor(source) {
  try {
    const page = await get(source.url);
    const groups = parseSkipole(page.text, source.url.replace(/\/$/, ""));
    return { source, groups, ...summarize(groups), error: null };
  } catch (e) {
    return { source, groups: [], up: 0, down: 0, alerts: 0, error: e.message };
  }
}

export async function fetchMrtg(source) {
  try {
    const page = await get(source.url);
    return { source, targets: parseMrtgIndex(page.text, source.url.replace(/\/$/, "")), error: null };
  } catch (e) {
    return { source, targets: [], error: e.message };
  }
}
