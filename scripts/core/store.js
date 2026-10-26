/**
 * core/store.js — tiny reactive key-value store over localStorage.
 * store.get(k, d) / store.set(k, v) / store.subscribe(k, fn)
 *
 * Falls back to memory when storage is unavailable (private windows, blocked
 * site data), so every screen still works for the length of the visit.
 */

const KEY = "iiserk-web";
const listeners = new Map();
let memory = {};

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return memory; }
}

function writeAll(obj) {
  memory = obj;
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch { /* memory only */ }
}

export const store = {
  get(k, d) {
    const v = readAll()[k];
    return v === undefined ? d : v;
  },
  set(k, v) {
    const all = readAll();
    if (v === null || v === undefined) delete all[k];
    else all[k] = v;
    writeAll(all);
    (listeners.get(k) || []).forEach((fn) => { try { fn(v); } catch {} });
  },
  subscribe(k, fn) {
    if (!listeners.has(k)) listeners.set(k, []);
    listeners.get(k).push(fn);
    return () => {
      const arr = listeners.get(k);
      arr.splice(arr.indexOf(fn), 1);
    };
  },
  /** Everything, for export / reset. */
  dump() { return readAll(); },
  clearAll() { writeAll({}); },
};
