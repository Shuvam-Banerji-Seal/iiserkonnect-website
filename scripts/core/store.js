/**
 * core/store.js — tiny reactive key-value store over localStorage.
 * store.get(k, d) / store.set(k, v) / store.subscribe(k, fn)
 */

const KEY = "iiserk-web";
const listeners = new Map();

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
}

function writeAll(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}

export const store = {
  get(k, d) {
    const v = readAll()[k];
    return v === undefined ? d : v;
  },
  set(k, v) {
    const all = readAll();
    all[k] = v;
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
};
