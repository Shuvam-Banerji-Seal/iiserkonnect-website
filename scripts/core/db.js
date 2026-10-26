/**
 * core/db.js — browser-local records (the app's Room database), in IndexedDB.
 *
 * One database, one object store per collection, every record keyed by `id`.
 * When IndexedDB is unavailable (some private windows) the same API runs on
 * localStorage, and when that is unavailable too, on memory — the screens
 * never need to know which.
 *
 *   const notes = collection("notes");
 *   await notes.all();  await notes.put({ id, ... });  await notes.remove(id);
 *   notes.onChange(fn)  // fires after any write, in this tab or another one
 */

const DB_NAME = "iiserkonnect";
const DB_VERSION = 1;
export const COLLECTIONS = [
  "notes", "tasks", "reminders", "events", "ledger", "meals", "chat", "chatPeers", "focus", "laps", "kv",
];

let dbPromise = null;
let backend = "idb";

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") { backend = "ls"; resolve(null); return; }
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); } catch { backend = "ls"; resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of COLLECTIONS) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { backend = "ls"; resolve(null); };
    req.onblocked = () => { backend = "ls"; resolve(null); };
  });
  return dbPromise;
}

/* ── localStorage / memory fallback ── */
const mem = {};
const lsKey = (name) => "iiserk-db." + name;
function lsRead(name) {
  try { return JSON.parse(localStorage.getItem(lsKey(name)) || "{}"); } catch { return mem[name] || {}; }
}
function lsWrite(name, obj) {
  mem[name] = obj;
  try { localStorage.setItem(lsKey(name), JSON.stringify(obj)); } catch {}
}

const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("iiserk-db") : null;
const listeners = new Map();
function emit(name, local = true) {
  (listeners.get(name) || []).slice().forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } });
  if (local && channel) { try { channel.postMessage(name); } catch {} }
}
if (channel) channel.onmessage = (e) => emit(e.data, false);

function tx(db, name, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(name, mode);
    const store = t.objectStore(name);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export function collection(name) {
  if (!COLLECTIONS.includes(name)) throw new Error("unknown collection " + name);
  return {
    async all() {
      const db = await openDb();
      if (!db) return Object.values(lsRead(name));
      return tx(db, name, "readonly", (s) => reqP(s.getAll()));
    },
    async get(id) {
      const db = await openDb();
      if (!db) return lsRead(name)[id] || null;
      return tx(db, name, "readonly", (s) => reqP(s.get(id))).then((r) => r || null);
    },
    async put(record) {
      if (!record.id) record.id = newId();
      const db = await openDb();
      if (!db) { const all = lsRead(name); all[record.id] = record; lsWrite(name, all); }
      else await tx(db, name, "readwrite", (s) => { s.put(record); });
      emit(name);
      return record;
    },
    async putAll(records) {
      const db = await openDb();
      if (!db) { const all = lsRead(name); for (const r of records) { if (!r.id) r.id = newId(); all[r.id] = r; } lsWrite(name, all); }
      else await tx(db, name, "readwrite", (s) => { for (const r of records) { if (!r.id) r.id = newId(); s.put(r); } });
      emit(name);
    },
    async remove(id) {
      const db = await openDb();
      if (!db) { const all = lsRead(name); delete all[id]; lsWrite(name, all); }
      else await tx(db, name, "readwrite", (s) => { s.delete(id); });
      emit(name);
    },
    async clear() {
      const db = await openDb();
      if (!db) lsWrite(name, {});
      else await tx(db, name, "readwrite", (s) => { s.clear(); });
      emit(name);
    },
    onChange(fn) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(fn);
      return () => { const a = listeners.get(name); const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
    },
  };
}

/** Which storage is actually in use ("idb" or "ls"), for the About screen. */
export async function storageBackend() { await openDb(); return backend; }

/** Rough usage figure, where the browser can tell. */
export async function storageEstimate() {
  try { return navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; } catch { return null; }
}
