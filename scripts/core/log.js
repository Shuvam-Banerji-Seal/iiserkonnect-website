/**
 * core/log.js — the in-app log (ui/log/LogCollector.kt), kept in this browser.
 *
 * Off unless Settings → Advanced → "Enable Logging" is on. Keeps the last 500
 * lines in localStorage; nothing leaves the browser unless the user copies or
 * downloads it from the Logs screen.
 */

import { prefs } from "./prefs.js";

const KEY = "iiserk-log";
const MAX = 500;

export function readLog() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
export function clearLog() { try { localStorage.removeItem(KEY); } catch {} }

export function log(level, tag, message) {
  if (!prefs.get("loggingEnabled")) return;
  const lines = readLog();
  lines.push({ t: Date.now(), level, tag, message: String(message).slice(0, 2000) });
  while (lines.length > MAX) lines.shift();
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch {}
}

export const logger = (tag) => ({
  d: (m) => log("D", tag, m), i: (m) => log("I", tag, m), w: (m) => log("W", tag, m), e: (m) => log("E", tag, m),
});

/* uncaught errors are worth keeping when logging is on */
addEventListener("error", (e) => log("E", "window", `${e.message} @ ${e.filename}:${e.lineno}`));
addEventListener("unhandledrejection", (e) => log("E", "promise", e.reason && (e.reason.stack || e.reason.message) || String(e.reason)));
addEventListener("hashchange", () => log("I", "nav", location.hash));
