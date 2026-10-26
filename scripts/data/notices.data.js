/**
 * data/notices.data.js — Notice Board (student and administration notices).
 *
 * Live: the two campus wiki pages (plain HTTP, campus network only).
 * Otherwise data/samples/notices.json. Returns { data: { student, admin }, sample }.
 */

import { sample } from "../services/source.js";
import { fetchNotices } from "../services/intranet.service.js";
import { C, sampleOnly } from "../core/net.js";

export async function loadNotices() {
  if (!sampleOnly()) {
    try {
      const [student, admin] = await Promise.all([fetchNotices(C.STUDENT_NOTICES), fetchNotices(C.ADMIN_NOTICES)]);
      if (student.length || admin.length) return { data: { student, admin }, sample: false };
    } catch { /* sample below */ }
  }
  const s = await sample("notices");
  return { data: { student: s.student, admin: s.admin }, sample: true };
}

/** Group a list of notices by year, newest year first, keeping order inside a year. */
export function groupByYear(list) {
  const map = new Map();
  for (const n of list) {
    if (!map.has(n.year)) map.set(n.year, []);
    map.get(n.year).push(n);
  }
  return [...map.entries()].sort((a, b) => (b[0] > a[0] ? 1 : b[0] < a[0] ? -1 : 0));
}
