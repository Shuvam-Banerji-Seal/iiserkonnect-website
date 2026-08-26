/**
 * core/html.js — DOMParser helpers. This is the Jsoup→browser port:
 * every Kotlin scraper selector maps to one of these tiny helpers.
 */

export function parse(html) {
  return new DOMParser().parseFromString(html, "text/html");
}

export const q = (doc, sel) => doc.querySelector(sel);
export const qa = (doc, sel) => [...doc.querySelectorAll(sel)];
export const text = (el) => (el ? el.textContent.trim() : "");
export const attr = (el, name) => (el ? el.getAttribute(name) || "" : "");

/** abs url like Jsoup abs:href, given a base */
export function absUrl(el, name, base) {
  const raw = attr(el, name);
  if (!raw) return "";
  try { return new URL(raw, base).href; } catch { return raw; }
}

export function regex1(re, s, group = 1) {
  const m = re.exec(s || "");
  return m ? m[group] : null;
}
