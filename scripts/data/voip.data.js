/**
 * data/voip.data.js — VoIP directory (ui/voip/VoipDirectoryViewModel.kt).
 *
 * Model: { pilotNumber, sections: [{ id, title, contacts: [{ name, extension, location }] }] }
 * Live: the institute VoIP directory page, parsed with DOMParser. Browsers
 * usually cannot read it (no CORS header), so the bundled sample is the normal
 * path off campus, and the page says so.
 */

import { load } from "../services/source.js";
import { get, C } from "../core/net.js";

export const PILOT_FALLBACK = "+91-33-6136-0000";

/** Parse the directory page the way the app does: pilot from <mark>, sections from <section id>, rows from tables. */
export function parseVoipPage(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const pilot = (doc.querySelector("mark")?.textContent || "").trim() || PILOT_FALLBACK;
  const sections = [...doc.querySelectorAll("section[id]")].map((sec) => {
    const title = (sec.querySelector("h2")?.textContent || sec.id).trim();
    const contacts = [...sec.querySelectorAll("table tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent.trim()))
      .filter((cells) => cells.length >= 3 && cells[0])
      .map(([name, extension, location]) => ({ name, extension, location }));
    return { id: sec.id, title, contacts };
  }).filter((s) => s.contacts.length);
  if (!sections.length) throw new Error("The directory came back empty. Try again later.");
  return { pilotNumber: pilot, sections };
}

export async function loadVoip() {
  return load("voip", async () => parseVoipPage((await get(C.VOIP)).text));
}

/** Filter sections and contacts by name, extension or location; a section whose title matches is shown in full. */
export function filterVoip(sections, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return sections;
  return sections.map((s) => {
    if (s.title.toLowerCase().includes(q)) return s;
    const contacts = s.contacts.filter((c) => [c.name, c.extension, c.location].some((v) => (v || "").toLowerCase().includes(q)));
    return { ...s, contacts };
  }).filter((s) => s.contacts.length);
}

/** tel: target for the pilot line (spaces and hyphens removed). */
export const pilotTel = (n) => "tel:" + String(n).replace(/[\s-]/g, "");
/** Extension via IVR: the comma is a short pause before the extension is dialled. */
export const extTel = (pilot, ext) => (ext ? `tel:${String(pilot).replace(/[\s-]/g, "")},${ext}` : pilotTel(pilot));
