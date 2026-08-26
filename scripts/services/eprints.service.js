/**
 * services/eprints.service.js — verbatim port of EprintsService's regex
 * parsers (they were pure-string in Kotlin too).
 */

import { get, C } from "../core/net.js";
import { regex1 } from "../core/html.js";

const clean = (s) => (s || "")
  .replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'")
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const tag = (block, name) => regex1(new RegExp(`<${name}>(.*?)</${name}>`, "s"), block, 1)?.trim() || null;

export async function latest() {
  const page = await get(`${C.EPRINTS}/cgi/latest_tool?output=RSS2`);
  const xml = page.text;
  const papers = [];
  for (const m of xml.matchAll(/<item>(.*?)<\/item>/gs)) {
    const block = m[1];
    const id = regex1(/<link>[^<]*?\/(\d{2,6})\/?<\/link>/, block);
    if (!id) continue;
    const title = clean(tag(block, "title") || "");
    const desc = clean((tag(block, "description") || ""));
    const year = regex1(/\((20\d\d)\)/, desc);
    papers.push({ id, title, year, url: `${C.EPRINTS}/${id}/` });
  }
  return papers.filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i);
}

export async function divisions() {
  const page = await get(`${C.EPRINTS}/view/divisions/`);
  const out = [];
  for (const m of page.text.matchAll(/<a href="([a-z0-9_=]+)\/">([^<]+)<\/a>/g)) {
    if (m[1].toLowerCase() === "divisions") continue;
    out.push({ id: m[1], name: m[2].trim() });
  }
  return out.filter((d, i, a) => a.findIndex((x) => x.id === d.id) === i);
}

export async function years(divisionId) {
  const path = divisionId ? `/view/divisions/${divisionId}/` : "/view/year/";
  const page = await get(C.EPRINTS + path);
  return [...page.text.matchAll(/href="((?:19|20)\d\d)\.html"/g)]
    .map((m) => m[1])
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort().reverse();
}

export async function divisionYearPapers(divisionId, year) {
  const page = await get(`${C.EPRINTS}/view/divisions/${divisionId}/${year}.html`)
    .catch(() => get(`${C.EPRINTS}/view/year/${year}.html`));
  return parseListing(page.text);
}

function parseListing(html) {
  const papers = [];
  const re = /href="[^"]*?\/(\d{2,6})\/?"[^>]*>\s*<em>(.*?)<\/em>/gs;
  for (const m of re.matchAll ? re[Symbol.matchAll](html) : html.matchAll(re)) {
    const id = m[1], title = clean(m[2]);
    const start = html.lastIndexOf("<p>", m.index);
    const end = html.indexOf("</p>", m.index);
    const block = start >= 0 && end > start ? html.slice(start, end + 4) : "";
    const authors = [...block.matchAll(/<span class="person_name">(.*?)<\/span>/gs)].map((x) => clean(x[1]));
    const year = regex1(/\((20\d\d)\)/, block);
    papers.push({ id, title, authors, year, url: `${C.EPRINTS}/${id}/` });
  }
  return papers.filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i);
}

export async function detail(id) {
  const page = await get(`${C.EPRINTS}/${id}/`);
  const html = page.text;
  const title = regex1(/<title>(.*?)<\/title>/i, html) || `Paper ${id}`;
  const abstract = clean(regex1(/<h[23][^>]*>\s*Abstract\s*<\/h[23]>\s*<p[^>]*>(.*?)<\/p>/s, html, 1) || "");
  const pdfRel = regex1(/href="([^"]+\.pdf[^"]*)"/i, html);
  const pdf = pdfRel ? (pdfRel.startsWith("http") ? pdfRel : `${C.EPRINTS}/${pdfRel.replace(/^\//, "")}`) : null;
  const authors = [...html.matchAll(/<span class="person_name">(.*?)<\/span>/gs)]
    .map((m) => clean(m[1])).filter((v, i, a) => a.indexOf(v) === i);
  const year = regex1(/\((20\d\d)\)/, title) || regex1(/\b(20\d\d)\b/, html);
  return { id, title, abstract, pdf, authors, year };
}
