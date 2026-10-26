/**
 * pages/log.page.js — Error Logs (ui/log/LogScreen.kt, LogCollector.kt).
 *
 * Shows the lines core/log.js keeps in this browser while logging is on.
 * Nothing leaves the browser unless the user copies or downloads the text.
 */

import { prefs } from "../core/prefs.js";
import { readLog, clearLog } from "../core/log.js";
import { esc, on, pad2 } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, browserNote, emptyState, chip, searchField } from "../ui/components.js";
import { confirm, snackbar } from "../ui/overlay.js";

const LEVEL_NAME = { D: "DEBUG", I: "INFO", W: "WARN", E: "ERROR" };
const LEVELS = [["ALL", "All"], ["D", "Debug"], ["I", "Info"], ["W", "Warn"], ["E", "Error"]];

const stamp = (t) => {
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
};
/** One line in the app's own format: "HH:mm:ss.SSS [LEVEL] tag: message". */
export const formatLine = (l) => `${stamp(l.t)} [${LEVEL_NAME[l.level] || l.level}] ${l.tag}: ${l.message}`;

function listHtml(lines, level, q) {
  const needle = q.trim().toLowerCase();
  const shown = lines.filter((l) => (level === "ALL" || l.level === level)
    && (!needle || formatLine(l).toLowerCase().includes(needle)));
  if (!lines.length) {
    return emptyState({ icon: "history", title: "No log lines yet", body: "Lines appear here as you use the app while logging is on." });
  }
  if (!shown.length) {
    return emptyState({ icon: "search_off", title: "No lines match", body: "Change the level or the search text." });
  }
  return `<p class="t-label-s c-muted tools-log__count" aria-live="polite">${shown.length} of ${lines.length} lines</p>
    <div class="tools-log" tabindex="0" aria-label="Log lines">
      ${shown.map((l) => `<div class="tools-log__line tools-log__line--${esc(l.level)}">
        <span class="tools-log__time">${stamp(l.t)}</span>
        <span class="tools-log__lvl">${esc(LEVEL_NAME[l.level] || l.level)}</span>
        <span class="tools-log__tag">${esc(l.tag)}</span>
        <span class="tools-log__msg">${esc(l.message)}</span>
      </div>`).join("")}
    </div>`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

export async function render(el) {
  const enabled = !!prefs.get("loggingEnabled");
  let level = "ALL";
  let q = "";
  let lastKey = "";

  el.innerHTML = screen({ cls: "tools-body",
    bar: topBar({
      title: "Error Logs",
      actions: iconBtn("refresh", "Refresh", { "data-act": "refresh" })
        + iconBtn("content_copy", "Copy all", { "data-act": "copy" })
        + iconBtn("download", "Download as .txt", { "data-act": "download" })
        + iconBtn("delete_sweep", "Clear", { "data-act": "clear" }),
    }),
    body: `
      ${enabled ? "" : browserNote({
        icon: "info",
        tone: "info",
        title: "Logging is off",
        body: "Turn on Enable Logging in Settings → Advanced to record lines here. Lines are kept only in this browser, the last 500 of them, and nothing is sent anywhere unless you copy or download them.",
        extra: `<p><a class="btn btn--tonal btn--sm" href="#/settings">${icon("settings", { size: 16 })}<span>Open Settings</span></a></p>`,
      })}
      <div class="tools-log-filters">
        <div class="chips chips--scroll" role="group" aria-label="Filter by level">
          ${LEVELS.map(([v, label]) => chip(label, { selected: v === level, a: { "data-level": v } })).join("")}
        </div>
        ${searchField({ id: "log-search", placeholder: "Search log" })}
      </div>
      <div id="log-list">${listHtml(readLog(), level, q)}</div>`,
  });

  const list = el.querySelector("#log-list");
  const paintList = () => {
    const lines = readLog();
    list.innerHTML = listHtml(lines, level, q);
    lastKey = keyOf(lines);
  };
  const keyOf = (lines) => JSON.stringify(lines.length) + (lines.length ? lines[lines.length - 1].t : "");
  lastKey = keyOf(readLog());

  on(el, "click", "[data-level]", (e, b) => {
    level = b.dataset.level;
    el.querySelectorAll("[data-level]").forEach((c) => {
      const on_c = c.dataset.level === level;
      c.classList.toggle("chip--selected", on_c);
      c.setAttribute("aria-pressed", String(on_c));
    });
    paintList();
  });

  const search = el.querySelector("#log-search");
  search.addEventListener("input", () => { q = search.value; paintList(); });

  on(el, "click", "[data-act=refresh]", () => { paintList(); snackbar("Log refreshed", { duration: 1500 }); });

  on(el, "click", "[data-act=copy]", async () => {
    const lines = readLog();
    if (!lines.length) { snackbar("Nothing to copy yet"); return; }
    const ok = await copyText(lines.map(formatLine).join("\n"));
    snackbar(ok ? `Copied ${lines.length} lines` : "Could not copy in this browser");
  });

  on(el, "click", "[data-act=download]", () => {
    const lines = readLog();
    if (!lines.length) { snackbar("Nothing to download yet"); return; }
    const d = new Date();
    const stampName = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
    const url = URL.createObjectURL(new Blob([lines.map(formatLine).join("\n") + "\n"], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `iiserkonnect-log-${stampName}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  });

  on(el, "click", "[data-act=clear]", async () => {
    const ok = await confirm({
      title: "Clear logs?",
      text: "Every saved line is removed from this browser.",
      confirmLabel: "Clear",
      danger: true,
    });
    if (!ok) return;
    clearLog();
    paintList();
    snackbar("Logs cleared");
  });

  /* new lines arrive while the page is open */
  const tick = setInterval(() => {
    const lines = readLog();
    if (keyOf(lines) !== lastKey) paintList();
  }, 1500);
  return () => clearInterval(tick);
}
