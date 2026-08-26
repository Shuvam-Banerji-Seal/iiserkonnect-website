/**
 * services/library.service.js — port of LibraryCatalogService (VTLS Chamo,
 * two-step session POST) + grades (WeLearnMyProfileService port).
 */

import { get, postForm, C } from "../core/net.js";
import { parse, q, qa, text } from "../core/html.js";
import { ensureGrades, gradesLoginPage, gradesSubmit } from "../core/session.js";

/* ── catalogue search ──────────────────────────────────────────── */
export async function search(query) {
  const base = C.LIBCAT;
  const page = await get(`${base}/search/query?theme=iiserk`);
  const action = findAction(page.text);
  if (!action) throw new Error("Could not find the library search form");
  const postUrl = resolve(base, action.startsWith("..") ? action.slice(2) : action);
  const res = await postForm(postUrl, { query: query.trim(), "search-sort-submit": "Sort" });
  return parseResults(res.text);
}

function findAction(html) {
  for (const m of html.matchAll(/<form[^>]*action="([^"]*)"[^>]*>(.*?)<\/form>/gs)) {
    if (m[2].includes('name="query"') && m[1].includes("quickSearch")) return m[1];
  }
  return null;
}

const resolve = (base, rel) => rel.startsWith("http") ? rel
  : rel.startsWith("/") ? base + rel : `${base}/${rel}`;

const strip = (s) => (s || "").replace(/<[^>]+>/g, "").trim()
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#039;|&#x27;|&apos;/g, "'").replace(/&quot;/g, '"')
  .replace(/&nbsp;|&#160;/g, " ");

function parseResults(html) {
  const out = [];
  const re = /<a[^>]*href="([^"]*lib\/item[^"]*)"[^>]*>(.*?)<\/a>.*?(?:<span[^>]*>|<br\s*\/?>|<p[^>]*>)(.*?)(?:<\/span>|<\/p>|<br)/gs;
  for (const m of html.matchAll(re)) {
    const url = m[1].replace(/&amp;/g, "&");
    const titleRaw = strip(m[2]);
    const slash = titleRaw.indexOf(" / ");
    out.push({
      url: url.startsWith("http") ? url : `${C.LIBCAT}${url}`,
      title: slash > 0 ? titleRaw.slice(0, slash).trim() : titleRaw,
      author: slash > 0 ? titleRaw.slice(slash + 3).trim() : "",
      callNumber: strip(m[3]),
    });
  }
  return out.filter((r, i, a) => a.findIndex((x) => x.url === r.url) === i);
}

export async function itemDetail(itemUrl) {
  const full = itemUrl.startsWith("http") ? itemUrl : `${C.LIBCAT}/${itemUrl}`;
  const page = await get(full);
  const html = page.text;
  const doc = parse(html);
  const title = text(q(doc, "h1"));
  const bib = {};
  for (const table of html.matchAll(/<table[^>]*>.*?<\/table>/gs)) {
    for (const tr of table[0].matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
      const cells = [...tr[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) => strip(c[1]));
      if (cells.length !== 2) continue;
      const [label, value] = cells;
      if (!label || !value) continue;
      const key = /^author$/i.test(label) ? "author"
        : /^physical description$/i.test(label) ? "physical"
        : /^publication$/i.test(label) ? "publication"
        : /^series/i.test(label) ? "series"
        : /^note/i.test(label) ? "notes"
        : /^isbn$/i.test(label) ? "isbn" : null;
      if (key) bib[key] = (bib[key] ? bib[key] + " " : "") + value;
    }
  }
  const availability = [];
  for (const table of html.matchAll(/<table[^>]*>.*?<\/table>/gs)) {
    const trs = [...table[0].matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)];
    if (trs.length < 2) continue;
    const headers = [...trs[0][1].matchAll(/<t[h][^>]*>(.*?)<\/t[h]>/gs)].map((h) => strip(h[1]).toLowerCase());
    if (!headers.some((h) => /location|status|call|available/.test(h))) continue;
    for (let i = 1; i < trs.length; i++) {
      const cells = [...trs[i][1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((c) => strip(c[1]));
      if (cells.length >= 7 && cells.some(Boolean)) {
        availability.push({ location: cells[1], barcode: cells[2], status: cells[6], callNumber: cells[0] });
      }
    }
  }
  return { title, ...bib, availability };
}

/* ── grade card (captcha flow) ─────────────────────────────────── */
export const gradesLogin = { page: gradesLoginPage, submit: gradesSubmit, ensure: ensureGrades };

export async function fetchGrades() {
  if (!(await ensureGrades())) return null; // caller must run captcha flow
  const sems = [];
  for (let s = 1; s <= 10; s++) {
    try {
      const page = await get(`${C.WELEARN_MYPROFILE_GRADES}${s}/`);
      if (page.text.includes("captcha_0") && page.text.length < 4000) break;
      const g = parseGradeCard(page.text, s);
      if (g.courses.length) sems.push(g);
    } catch { break; }
  }
  return sems;
}

function parseGradeCard(html, fallbackSem) {
  const doc = parse(html);
  let sem = fallbackSem, sgpa = "N/A", cgpa = "N/A";
  for (const table of qa(doc, "table#studentinfo")) {
    for (const cell of qa(table, "td")) {
      const t = text(cell);
      if (t.startsWith("Semester No:")) sem = parseInt(t.slice(12).trim()) || fallbackSem;
      if (t.startsWith("SGPA:")) sgpa = t.slice(5).trim();
      if (t.startsWith("CGPA:")) cgpa = t.slice(5).trim();
    }
  }
  const courses = [];
  const gt = q(doc, "table#tathyatable");
  if (gt) {
    for (const row of qa(gt, "tr")) {
      const cells = qa(row, "td");
      if (cells.length >= 4) {
        const code = text(cells[1]), grade = text(cells[3]);
        if (code && grade) courses.push({ code, name: text(cells[2]), grade });
      }
    }
  }
  return { semester: sem, sgpa, cgpa, courses };
}
