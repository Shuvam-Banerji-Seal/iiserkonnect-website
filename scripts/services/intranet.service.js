/**
 * services/intranet.service.js — ports of the intranet wiki scrapers:
 * PYQ archive, Library:Home sections, notice boards, VoIP directory,
 * and the gateway (macreg/TCP) device parser.
 */

import { get, C } from "../core/net.js";
import { parse, q, qa, text, attr } from "../core/html.js";
import { gatewayLoggedInHtml } from "../core/session.js";

/* ── PYQ (port of fetchPYQYears / fetchPYQForYear) ─────────────── */
export async function fetchPyqYears() {
  const page = await get(`${C.WIKI}/Library:Home`);
  const doc = parse(page.text);
  const years = [];
  for (const a of qa(doc, 'a[href*="Old_Question_Papers"]')) {
    const m = /\((\d{4})\)/.exec(text(a)) || /\((\d{4})\)/.exec(attr(a, "href"));
    if (m) years.push({ year: +m[1], url: new URL(attr(a, "href"), "http://intranet.iiserkol.ac.in").href });
  }
  return [...new Map(years.map((y) => [y.year, y])).values()].sort((a, b) => b.year - a.year);
}

export async function fetchPyqYear(pyq) {
  const page = await get(pyq.url);
  const doc = parse(page.text);
  const content = q(doc, "#mw-content-text") || doc.body;
  const sections = [];
  let exam = "", sem = "", depts = [];
  let lastDept = "";

  const flush = () => {
    if (exam && depts.length) sections.push({ exam, semester: sem || "General", depts: [...depts] });
    depts = [];
  };
  const examOf = (t) => /mid\s*-?\s*semester/i.test(t) ? "Mid Semester"
    : /end\s*-?\s*semester/i.test(t) ? "End Semester" : null;
  const isSem = (t) => /^spring$/i.test(t.trim()) || /^autumn$/i.test(t.trim());
  const clean = (raw) => raw
    .replace(/\[\s*pdf\s*\]/gi, " ").replace(/\b(mid\s*-?\s*semester|end\s*-?\s*semester)\b/gi, " ")
    .replace(/\b(spring|autumn)\b/gi, " ").replace(/\s+/g, " ").replace(/^[\s:\-•]+|[\s:\-•]+$/g, "");

  for (const el of content.children) {
    if (el.tagName === "HR") continue;
    const fontEls = el.tagName === "FONT" && el.hasAttribute("size")
      ? [el, ...qa(el, "font[size]")]
      : qa(el, "font[size]");
    for (const f of fontEls) {
      const t = text(f);
      if (examOf(t)) { flush(); exam = examOf(t); }
      else if (isSem(t)) { flush(); sem = t; lastDept = ""; }
    }
    for (const b of qa(el, "b")) {
      if (q(b, "font[size]")) continue;
      const t = text(b);
      if (isSem(t)) { flush(); sem = t; lastDept = ""; }
      else if (examOf(t)) { flush(); exam = examOf(t); }
    }
    const pdfs = qa(el, "a[href]").filter((a) => /\.pdf/i.test(attr(a, "href")) || attr(a, "href").includes("/w/images/"));
    if (pdfs.length) {
      if (!exam) exam = examOf(text(el)) || "General";
      if (!sem) sem = "General";
      for (const a of pdfs) {
        const url = new URL(attr(a, "href"), "http://intranet.iiserkol.ac.in").href;
        let dept = clean(prevText(a)) || attr(a, "title").replace(/\.(pdf|PDF)$/, "").replace(/_/g, " ").trim() || lastDept;
        if (dept && !depts.some((d) => d.name === dept && d.url === url)) depts.push({ name: dept, url });
      }
    } else {
      const t = text(el).replace(/\s+/g, " ");
      if (t.length > 2 && !examOf(t) && !isSem(t) && !/^From /i.test(t) && !/Retrieved from/.test(t)) lastDept = t;
    }
  }
  flush();
  return { year: pyq.year, sections };
}

function prevText(link) {
  let n = (link.parentElement && link.parentElement.tagName === "SPAN" ? link.parentElement : link).previousSibling;
  while (n) {
    const t = (n.textContent || "").trim();
    const c = t.replace(/\[\s*pdf\s*\]/gi, " ").replace(/\b(mid\s*-?\s*semester|end\s*-?\s*semester)\b/gi, " ")
      .replace(/\b(spring|autumn)\b/gi, " ").replace(/\s+/g, " ").replace(/^[\s:\-•]+|[\s:\-•]+$/g, "");
    if (c) return c;
    n = n.previousSibling;
  }
  return "";
}

/* ── Library wiki (port of fetchLibraryInfo) ───────────────────── */
export async function fetchLibraryInfo() {
  const page = await get(C.LIBRARY_HOME);
  const doc = parse(page.text, "http://intranet.iiserkol.ac.in");
  const content = q(doc, "#mw-content-text");
  const sections = [];
  if (content) {
    for (const h2 of qa(content, "h2")) {
      const span = q(h2, "span.mw-headline");
      if (!span) continue;
      const title = text(span);
      if (!span.id || title === "Contents") continue;
      const links = [];
      let sib = h2.nextElementSibling;
      while (sib && sib.tagName !== "H2") {
        for (const a of qa(sib, "a[href]")) {
          const t = text(a);
          const href = new URL(attr(a, "href"), "http://intranet.iiserkol.ac.in").href;
          if (t && t.length < 200 && !/action=edit/.test(href) && !/^\[edit\]$/i.test(t)) {
            const parent = (a.parentElement?.textContent || "").toUpperCase();
            const closed = /TRIAL CLOSED|DISCONTINUED|NOT RENEWED|ACCESS DISCONTINUED/.test(parent);
            links.push({ label: t, url: href, internal: href.includes("/wiki/Library:"), closed });
          }
        }
        sib = sib.nextElementSibling;
      }
      if (links.length) sections.push({ id: span.id, title, links });
    }
  }
  const mail = q(doc, 'a[href^="mailto:"]');
  return {
    sections,
    contactEmail: mail ? attr(mail, "href").replace("mailto:", "") : "librarian@iiserkol.ac.in",
    catalogueUrl: "http://lib.iiserkol.ac.in:9000/search/query?theme=iiserk",
  };
}

/* ── Notice board (port of parseNoticeBoard) ───────────────────── */
export async function fetchNotices(url) {
  const page = await get(url);
  const doc = parse(page.text);
  const content = q(doc, "#mw-content-text");
  if (!content) return [];
  const notices = [];
  let year = "";
  for (const el of content.children) {
    const tag = el.tagName, t = text(el);
    if (tag === "H2" || tag === "H3") {
      const m = /(\d{4})/.exec(t); if (m) year = m[1];
    } else if (tag === "LI" || tag === "P") {
      if (t.length > 5) {
        const a = q(el, "a[href]");
        const link = a ? new URL(attr(a, "href"), "http://intranet.iiserkol.ac.in").href : null;
        const type = /\.pdf/i.test(link || t) ? "PDF" : /\.doc/i.test(link || t) ? "DOC" : link ? "Link" : null;
        const title = t.replace(/\[\s*(PDF|DOC|Click Here|Link)\s*\]/gi, "").trim();
        if (title && !/^Retrieved from/.test(title) && !/^Personal tools/.test(title))
          notices.push({ year: year || "Unknown", title, link, type });
      }
    } else if (tag === "TABLE") {
      for (const row of qa(el, "tr")) {
        const t = qa(row, "td, th").map((c) => text(c)).join(" ");
        if (t.length > 10) {
          const a = q(row, "a[href]");
          notices.push({ year: year || "Unknown", title: t, link: a ? new URL(attr(a, "href"), "http://intranet.iiserkol.ac.in").href : null, type: a ? "Link" : null });
        }
      }
    }
  }
  return notices.filter((n, i, arr) => arr.findIndex((x) => x.title === n.title) === i);
}

/* ── VoIP (port of fetchVoipDirectory) ─────────────────────────── */
export async function fetchVoip() {
  const page = await get(C.VOIP);
  const doc = parse(page.text);
  const pilot = (text(q(doc, "mark")).match(/\+?[\d\s-]+0000/) || ["+91-33-6136-0000"])[0].trim();
  const sections = [];
  for (const sec of qa(doc, "section[id]")) {
    const id = attr(sec, "id");
    const title = text(q(sec, "h2")) || id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
    const contacts = [];
    for (const row of qa(sec, "table tbody tr")) {
      const cells = qa(row, "td");
      if (cells.length >= 3) {
        const name = text(cells[0]);
        if (name) contacts.push({ name, ext: text(cells[1]), location: text(cells[2]) });
      }
    }
    if (contacts.length) sections.push({ id, title, contacts });
  }
  return { pilot, sections };
}

/* ── Gateway TCP devices (port of parseTcpDevices) ─────────────── */
export function parseGatewayDevices(html) {
  if (gatewayLoggedInHtml(html)) {
    const doc = parse(html);
    const devices = [];
    let tcp = 0;
    for (const table of qa(doc, "table")) {
      for (const row of qa(table, "tr")) {
        const ths = qa(row, "th"), tds = qa(row, "td");
        if (ths.length >= 2 && /TCP Count|Current TCP/i.test(text(ths[0]))) {
          tcp = parseInt(text(ths[ths.length - 1]).replace(/,/g, "")) || tcp;
          continue;
        }
        if (ths.length && !tds.length) continue;
        if (tds.length >= 6 && /^\d+$/.test(text(tds[0]))) {
          devices.push({ mac: text(tds[1]), type: text(tds[2]), location: text(tds[3]), validFrom: text(tds[4]), validTill: text(tds[5]) });
        }
      }
    }
    const userM = /(?:logged\s*in\s*(?:as)?|welcome|user)\s*:?\s*([a-zA-Z0-9._@]+)/i.exec(doc.body.textContent);
    return { loggedIn: true, tcpCount: tcp, devices, username: userM ? userM[1] : "" };
  }
  return { loggedIn: false };
}
