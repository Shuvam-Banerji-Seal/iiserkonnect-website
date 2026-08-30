/**
 * services/welearn.service.js — port of WeLearnRepository + HtmlParser +
 * AttendanceParser. All selectors mirror the Kotlin originals.
 */

import { get, postForm, C, fileUrl } from "../core/net.js";
import { ensureWelearn } from "../core/session.js";
import { parse, q, qa, text, attr, absUrl } from "../core/html.js";

export const isLoginOk = (html) => {
  const doc = parse(html);
  if (doc.body.textContent.includes("Invalid login, please try again")) return false;
  if (q(doc, ".loginerrors")) return false;
  return !!q(doc, 'a[href*="/login/logout.php"]');
};

export async function fetchCourses() {
  // Try direct campus fetch first
  try {
    if (!(await ensureWelearn())) throw new Error("WeLearn login failed");
    const dash = await get(C.WELEARN_MY);
    // Check for JSON fallback (when off-campus, get() returns data/welearn.json)
    const t = dash.text.trim();
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        const j = JSON.parse(t);
        if (j.courses) return j.courses;
        if (Array.isArray(j)) return j;
      } catch {}
    }
    const doc = parse(dash.text);
    const courses = qa(doc, 'a.list-group-item.list-group-item-action[href*="/course/view.php?id="]')
      .map((a) => {
        const url = absUrl(a, "href", C.WELEARN);
        const id = regexId(url);
        return { id, url, title: text(a).replace(/^Course:\s*/, "") || `course_${id}` };
      })
      .filter((c) => c.id)
      .map((c, i, arr) => ({ ...c, title: c.title || arr.find(x => x.id === c.id)?.title }))
      .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
    if (courses.length) return courses;
  } catch {}
  // Fallback to static snapshot (works off-campus, no login needed)
  try {
    const r = await fetch("data/welearn.json", { cache: "no-store" });
    const j = await r.json();
    if (j.courses) return j.courses;
  } catch {}
  throw new Error("Could not load courses — try on campus or open WeLearn directly");
}

const regexId = (url) => (/[?&]id=(\d+)/.exec(url) || [])[1] || null;

/** Port of HtmlParser.extractResourceLinks (RESOURCE / PLUGINFILE / FOLDER). */
export async function fetchCourseFiles(course) {
  if (!(await ensureWelearn())) throw new Error("WeLearn session invalid");
  const visited = new Set();
  const files = [];
  await walk(course.url, 0);
  return files;

  async function walk(url, depth) {
    if (visited.has(url) || depth > 5) return;
    visited.add(url);
    const page = await get(url).catch(() => null);
    if (!page) return;
    const doc = parse(page.text);

    for (const a of qa(doc, 'a[href*="/mod/resource/view.php?id="]')) {
      files.push({ name: text(a) || "resource", url: absUrl(a, "href", C.WELEARN), kind: "resource" });
    }
    for (const a of qa(doc, 'a[href*="pluginfile.php"]')) {
      const raw = absUrl(a, "href", C.WELEARN);
      const guess = decodeURIComponent(raw.split("?")[0].split("/").pop() || "");
      let name = text(a) || guess || "file";
      const ext = guess.includes(".") ? guess.split(".").pop().toLowerCase() : "";
      if (ext && ext.length <= 6 && !name.toLowerCase().endsWith("." + ext)) name += "." + ext;
      files.push({ name, url: raw, kind: "file" });
    }
    for (const a of qa(doc, 'a[href*="/mod/folder/view.php?id="]')) {
      const furl = absUrl(a, "href", C.WELEARN);
      if (visited.has(furl)) continue;
      files.push({ name: text(a) || "Folder", url: furl, kind: "folder" });
      await walk(furl, depth + 1);
    }
  }
}

export const downloadUrl = (u) => fileUrl(u);

/* ── Attendance (port of AttendanceParser) ─────────────────────── */
export async function fetchAttendance(courses) {
  const out = [];
  for (const course of courses) {
    try {
      const page = await get(course.url);
      const doc = parse(page.text);
      let link = q(doc, 'li.activity.attendance a[href*="/mod/attendance/view.php"], li.modtype_attendance a[href*="/mod/attendance/view.php"]')
        || qa(doc, 'a[href*="/mod/attendance/view.php"]')[0];
      if (!link) continue;
      const base = absUrl(link, "href", C.WELEARN).replace(/[&?]view=\d+/, "");
      const all = base + (base.includes("?") ? "&" : "?") + "view=5";
      const sess = await get(all);
      const records = parseAttendance(sess.text);
      out.push({ course: course.title, records, summary: summarize(records) });
    } catch { /* skip course */ }
  }
  return out;
}

function parseAttendance(html) {
  const doc = parse(html);
  for (const table of qa(doc, "table.generaltable, table.attwidth, table[id*=attendance], table")) {
    const headers = qa(table, "thead th, thead td, tr:first-child th, tr:first-child td").map((t) => text(t).toLowerCase());
    if (!headers.length) continue;
    const hasSession = headers.some((h) => /session|date|time/.test(h));
    const hasStatus = headers.some((h) => /status|attendance/.test(h));
    if (!hasSession && !hasStatus) continue;

    const idx = (pred) => headers.findIndex(pred);
    const dateI = idx((h) => /session|date/.test(h));
    const timeI = idx((h) => /time/.test(h) && !/session/.test(h));
    const descI = idx((h) => /desc/.test(h));
    const statusI = idx((h) => /status|attendance/.test(h) && !/session/.test(h));

    const records = [];
    const rows = qa(table, "tbody tr").length
      ? qa(table, "tbody tr")
      : qa(table, "tr").slice(1);
    for (const row of rows) {
      const cells = qa(row, "td");
      if (!cells.length) continue;
      const at = (i) => (i >= 0 && cells[i] ? text(cells[i]) : "");
      const date = at(dateI >= 0 ? dateI : 0);
      const status = at(statusI);
      if (!date && !status) continue;
      records.push({
        date, time: at(timeI), description: at(descI), status: normStatus(status),
        points: at(idx((h) => /point|score|grade/.test(h))),
        remarks: at(idx((h) => /remark|note|comment/.test(h))),
      });
    }
    if (records.length) return records;
  }
  return [];
}

function normStatus(raw) {
  const s = (raw || "").trim().toUpperCase();
  if (s.startsWith("PRESENT") || s === "P") return "Present";
  if (s.startsWith("ABSENT") || s === "A") return "Absent";
  if (s.startsWith("LATE") || s === "L") return "Late";
  if (s.startsWith("EXCUSED") || s === "E") return "Excused";
  return "Unknown";
}

const summarize = (records) => {
  const total = records.length;
  const c = (s) => records.filter((r) => r.status === s).length;
  return {
    total, present: c("Present"), absent: c("Absent"),
    late: c("Late"), excused: c("Excused"),
    pct: total ? +(((c("Present") + c("Late")) / total) * 100).toFixed(1) : 0,
  };
};

/* ── Deadlines (port of scrapeAssignments) ─────────────────────── */
export async function fetchDeadlines(courses) {
  const out = [];
  for (const course of courses) {
    try {
      const page = await get(`${C.WELEARN}/mod/assign/index.php?id=${course.id}`);
      const doc = parse(page.text);
      const courseName = (text(q(doc, "title")).split("|")[1] || course.title).trim();
      for (const row of qa(doc, "table tr")) {
        const link = q(row, "a[href*='mod/assign/view']");
        if (!link) continue;
        const name = text(link);
        if (!name) continue;
        let due = "";
        for (const cell of qa(row, "td")) {
          const t = text(cell);
          if (t.includes("/") || t.includes("-")) { due = t; break; }
        }
        out.push({ course: courseName.split(":")[0].trim(), name, due });
      }
    } catch { /* skip */ }
  }
  return out;
}
