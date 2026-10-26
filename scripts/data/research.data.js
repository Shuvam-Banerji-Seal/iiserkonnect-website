/**
 * data/research.data.js — ePrints repository (latest deposits, divisions,
 * years, papers, paper detail).
 *
 * Each call tries the campus ePrints service first when the browser may
 * reach it, and falls back to data/samples/research.json otherwise. Callers
 * get { data, sample } and show sampleBanner() when sample is true.
 */

import { sample } from "../services/source.js";
import * as eprints from "../services/eprints.service.js";
import { sampleOnly } from "../core/net.js";

async function either(live, pick) {
  if (!sampleOnly()) {
    try { return { data: await live(), sample: false }; } catch { /* sample below */ }
  }
  return { data: pick(await sample("research")), sample: true };
}

const paper = (p) => ({ eprintId: String(p.eprintId ?? p.id), title: p.title || "", authors: p.authors || [], year: p.year || null, typeLine: p.typeLine || null });

export const loadLatest = () => either(
  async () => (await eprints.latest()).map(paper),
  (s) => s.latest.map(paper),
);

export const loadDivisions = () => either(
  () => eprints.divisions(),
  (s) => s.divisions,
);

export const loadYears = (divisionId) => either(
  () => eprints.years(divisionId),
  (s) => s.years[divisionId] || [],
);

export const loadPapers = (divisionId, year) => either(
  async () => (await eprints.divisionYearPapers(divisionId, year)).map(paper),
  (s) => (s.papers[`${divisionId}|${year}`] || []).map(paper),
);

/** Detail for one paper. `fallback` = { title, authors } from the link, used when the record cannot be loaded. */
export async function loadDetail(eprintId, fallback = null) {
  const res = await either(
    async () => {
      const d = await eprints.detail(eprintId);
      return { eprintId: String(d.id), title: d.title, authors: d.authors, year: d.year || null, typeLine: null, abstractText: d.abstract || "", pdfUrl: d.pdf || null };
    },
    (s) => {
      const d = s.details[eprintId];
      return d ? { ...d, abstractText: d.abstractText || "", pdfUrl: d.pdfUrl || null } : null;
    },
  );
  if (res.data) return res;
  if (fallback && fallback.title) {
    return { sample: res.sample, data: { eprintId, title: fallback.title, authors: fallback.authors || [], year: null, typeLine: null, abstractText: "", pdfUrl: null }, fromLink: true };
  }
  return { ...res, data: null };
}

export const isCampusHost = (url) => /(^|\.)iiserkol\.ac\.in$/i.test(new URL(url, location.href).hostname);
