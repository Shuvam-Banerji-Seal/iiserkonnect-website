/**
 * services/source.js — one rule for every campus-backed screen:
 *
 *   1. "Sample data only" (Settings → Advanced) → the bundled sample, labelled.
 *   2. Otherwise try the live campus fetch (services/*.service.js).
 *      Success → shown and cached in this browser for next time.
 *   3. Live failed → the last cached live result if there is one (labelled
 *      with its age), else the bundled sample (labelled as sample).
 *
 * Samples live in data/samples/<key>.json and are entirely made up: fictional
 * people, rooms, amounts and roll numbers. Pages never present a sample as
 * the user's own data — they show components.sampleBanner().
 */

import { sampleOnly } from "../core/net.js";

const CACHE_PREFIX = "iiserk-cache.";
const memo = new Map();

export async function sample(key) {
  if (memo.has(key)) return structuredClone(memo.get(key));
  const res = await fetch(new URL(`../../data/samples/${key}.json`, import.meta.url), { cache: "no-cache" });
  if (!res.ok) throw new Error(`missing sample ${key}`);
  const json = await res.json();
  memo.set(key, json);
  return structuredClone(json);
}

function readCache(key) {
  try { return JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || "null"); } catch { return null; }
}
function writeCache(key, data) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data })); } catch {}
}
export function clearCaches() {
  try { Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k)); } catch {}
}

/**
 * load("mess", () => liveFetch()) → { data, sample, stale, cachedAt, error }
 * `live` may be omitted for features that have no live path in a browser.
 */
export async function load(key, live, { maxAgeMs = 15 * 60000 } = {}) {
  if (sampleOnly() || !live) return { data: await sample(key), sample: true, stale: false, cachedAt: null, error: null };
  const cached = readCache(key);
  if (cached && Date.now() - cached.at < maxAgeMs) return { data: cached.data, sample: false, stale: false, cachedAt: cached.at, error: null };
  try {
    const data = await live();
    writeCache(key, data);
    return { data, sample: false, stale: false, cachedAt: Date.now(), error: null };
  } catch (error) {
    if (cached) return { data: cached.data, sample: false, stale: true, cachedAt: cached.at, error };
    return { data: await sample(key), sample: true, stale: false, cachedAt: null, error };
  }
}
