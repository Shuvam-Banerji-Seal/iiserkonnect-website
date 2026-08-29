/**
 * ui/helpers.js — page scaffolding, no backend required.
 */

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

export function errorState(msg, retryHash, originalUrl) {
  const hint = /Failed to fetch|NetworkError|CORS|mixed content|blocked/i.test(msg)
    ? `Your browser blocked the request (CORS / mixed-content). When on campus this content loads directly — otherwise open the original site.`
    : esc(msg);
  const actions = [
    originalUrl ? `<a class="btn btn--primary btn--sm" href="${esc(originalUrl)}" target="_blank" rel="noopener">Open original site ↗</a>` : "",
    retryHash ? `<a class="btn btn--ghost btn--sm" href="#/${retryHash}">Retry</a>` : "",
  ].filter(Boolean).join(" ");
  return emptyState("⚠️", "Couldn't load this", hint, actions);
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

/** No gate — the site is just a rerouter. Always "ok". */
export function requireCreds() {
  if (store.get("ldap")) return { ok: true };
  return {
    ok: false,
    html: emptyState("🔐", "Sign in first",
      "Add your IISERK LDAP credentials in Settings — every feature shares one login, just like the app.",
      `<a class="btn btn--primary btn--sm" href="#/settings">Open Settings</a>`),
  };
}

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
