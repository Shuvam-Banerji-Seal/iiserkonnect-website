/**
 * data/pyq.data.js — previous year question papers from the intranet archive.
 * The archive is plain http on the campus network, so a browser can only read
 * it from inside campus. Paper links are never fetched or embedded: the page
 * opens them only when the user clicks.
 */

import { load } from "../services/source.js";
import { fetchPyqYears, fetchPyqYear } from "../services/intranet.service.js";

/** { data: { years: [{ year, url?, sections? }] }, sample, ... } */
export const loadPyqYears = ({ force = false } = {}) => load("pyq", async () => ({
  years: (await fetchPyqYears()).map((y) => ({ year: y.year, url: y.url })),
}), force ? { maxAgeMs: 0 } : undefined);

/** Sections of one year: { year, sections: [{ exam, semester, depts: [{ name, url }] }] } */
export async function loadPyqYear(year, sample) {
  if (sample) return { year: year.year, sections: year.sections || [] };
  const r = await fetchPyqYear(year);
  return { year: r.year, sections: r.sections };
}
