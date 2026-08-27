/**
 * ui/helpers.js — page scaffolding shared by every screen.
 */

import { probeProxy, proxyBase } from "../core/net.js";
import { store } from "../core/store.js";

export const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function pageHead(eyebrow, title, sub = "") {
  return `
    <header class="page-head">
      <div>
        <span class="eyebrow">${esc(eyebrow)}</span>
        <h2 class="h2">${esc(title)}</h2>
        ${sub ? `<p class="body-muted">${esc(sub)}</p>` : ""}
      </div>
    </header>`;
}

export function card(inner, cls = "") {
  return `<div class="app-card ${cls}">${inner}</div>`;
}

export function emptyState(icon, title, hint, action = "") {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">${icon}</div>
      <h3>${esc(title)}</h3>
      <p class="body-muted">${hint}</p>
      ${action}
    </div>`;
}

export function errorState(msg, retryHash) {
  return emptyState("⚠️", "Couldn't load this", esc(msg),
    retryHash ? `<a class="btn btn--ghost btn--sm" href="#/${retryHash}">Retry</a>` : "");
}

export function loading(label = "Loading…") {
  return `<div class="page-loading"><span class="spinner"></span> ${esc(label)}</div>`;
}

export function chip(text, accent = false) {
  return `<span class="chip ${accent ? "chip--accent" : ""}">${esc(text)}</span>`;
}

export function toast(msg, kind = "info") {
  let host = document.querySelector(".toast-host");
  if (!host) {
    host = document.createElement("div");
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = `toast toast--${kind}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 350); }, 3200);
}

/** Guard used by every campus-backed page: is the companion reachable? */
export async function requireProxy() {
  const probe = await probeProxy();
  if (probe.ok) return { ok: true, mock: probe.mock };
  return {
    ok: false,
    html: emptyState("🔌", "Companion proxy not detected",
      `This web app talks to campus services through a tiny local proxy (the browser
       itself is not allowed to — CORS). Start it, then reload:`,
      `<code class="mono">python3 serve.py</code>
       <p class="tiny body-muted" style="margin-top:8px">Expected at <code>${esc(proxyBase())}</code> —
       change it in Settings. Demo mode: <code>python3 serve.py --mock</code></p>`),
  };
}

export function requireCreds() {
  if (store.get("ldap")) return { ok: true };
  return {
    ok: false,
    html: emptyState("🔐", "Sign in first",
      "Add your IISERK LDAP credentials in Settings — every feature shares one login, just like the app.",
      `<a class="btn btn--primary btn--sm" href="#/settings">Open Settings</a>`),
  };
}

/** simple bar chart (pure divs) */
export function barChart(pairs, fmt = (v) => String(v)) {
  if (!pairs.length) return `<p class="body-muted small">No data yet.</p>`;
  const max = Math.max(...pairs.map(([, v]) => v), 1);
  return `<div class="barchart">${pairs.map(([label, v]) => `
    <div class="barchart__row" title="${esc(label)}: ${esc(fmt(v))}">
      <span class="barchart__label">${esc(label)}</span>
      <span class="barchart__track"><span class="barchart__fill" style="width:${(v / max) * 100}%"></span></span>
      <span class="barchart__value">${esc(fmt(v))}</span>
    </div>`).join("")}</div>`;
}
