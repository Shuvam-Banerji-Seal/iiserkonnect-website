/**
 * pages/notes.page.js — Notes (ui/notes/NotesScreen.kt).
 *
 * Pinned notes first, then the most recently edited. The search icon opens a
 * field: every word must appear in the title or body. Each card has share and
 * delete. A note can carry a one-shot alarm (ALARM_NOTE applies).
 */

import { collection, newId } from "../core/db.js";
import { esc, on } from "../ui/dom.js";
import { screen, topBar, iconBtn, fab, card, textField, switchRow, searchField, emptyState, icon } from "../ui/components.js";
import { dialog, confirm, snackbar } from "../ui/overlay.js";
import {
  noteRows, noteMatches, noteShareText, noteAlarmLabel, defaultTriggerMillis, entryNoteBody,
} from "../productivity/logic.js";
import { draft, alarmBlock, bindAlarm, localInstant, splitInstant, fieldValue } from "../productivity/shared.js";
import { pickCalendarEntry } from "../productivity/calendarpicker.js";

const PAST_ALARM = "That time has passed — pick a later time.";

/** The stored note for an editor form, or { error }. */
function buildNote(st, existing, now) {
  const title = st.title.trim(), body = st.body.trim();
  if (!title && !body) return { error: "A note needs a title or some text." };
  let alarmAtMillis = existing?.alarmAtMillis ?? null;
  let alarmEnabled = false;
  if (st.alarmOn) {
    const at = localInstant(st.alarmDate, st.alarmTime);
    if (!Number.isFinite(at)) return { error: "Pick a date and a time for the alarm." };
    if (at <= now) return { error: PAST_ALARM };
    alarmAtMillis = at;
    alarmEnabled = true;
  } else if (st.alarmDate && st.alarmTime) {
    alarmAtMillis = localInstant(st.alarmDate, st.alarmTime);
  }
  return {
    record: {
      id: existing?.id || newId(),
      title: st.title,
      body: st.body,
      pinned: !!st.pinned,
      alarmAtMillis,
      alarmEnabled,
      createdAtMillis: existing?.createdAtMillis ?? now,
      updatedAtMillis: now,
    },
  };
}

function shareSheet(note) {
  const text = noteShareText(note);
  const title = (note.title || "").trim();
  if (navigator.share) {
    return navigator.share({ title: title || undefined, text }).catch((err) => {
      if (err && err.name === "AbortError") return;
      return copyText(text);
    });
  }
  return copyText(text);
}
async function copyText(text) {
  try {
    if (!navigator.clipboard) throw new Error("no clipboard");
    await navigator.clipboard.writeText(text);
    snackbar("Copied");
  } catch {
    snackbar("Sharing is not available in this browser.");
  }
}

function editorBody(s) {
  return `
    ${textField({ id: "note-title", label: "Title", value: s.title, a: { "data-f": "title" } })}
    ${textField({ id: "note-body", label: "Note", value: s.body, multiline: true, rows: 6, a: { "data-f": "body" } })}
    <div class="prod-switches">
      ${switchRow({ title: "Pin to top", checked: !!s.pinned, a: { "data-switch": "pinned" } })}
      ${switchRow({ title: "Set an alarm", checked: !!s.alarmOn, a: { "data-switch": "alarm" } })}
    </div>
    <div class="prod-fields" data-alarm-fields ${s.alarmOn ? "" : "hidden"}>
      ${textField({ id: "note-date", label: "Alarm date", type: "date", value: s.alarmDate, a: { "data-f": "alarmDate" }, cls: "prod-field" })}
      ${textField({ id: "note-time", label: "Alarm time", type: "time", value: s.alarmTime, a: { "data-f": "alarmTime" }, cls: "prod-field" })}
    </div>
    <div data-alarm-host ${s.alarmOn ? "" : "hidden"}>${s.alarmOn ? alarmBlock({ note: true }) : ""}</div>
    <p class="prod-err" data-err role="alert"></p>`;
}

function readForm(d, base) {
  return {
    ...base,
    title: fieldValue(d, "title"),
    body: fieldValue(d, "body"),
    pinned: d.querySelector("[data-switch=pinned]")?.getAttribute("aria-checked") === "true",
    alarmOn: d.querySelector("[data-switch=alarm]")?.getAttribute("aria-checked") === "true",
    alarmDate: fieldValue(d, "alarmDate"),
    alarmTime: fieldValue(d, "alarmTime"),
  };
}

export async function render(el) {
  const notes = collection("notes");
  let query = "";
  let searching = false;
  const now0 = Date.now();

  /** reconcileNoteAlarms: an alarm whose time passed is switched off, its time kept. */
  for (const n of await notes.all()) {
    if (n.alarmEnabled && n.alarmAtMillis && n.alarmAtMillis <= now0) await notes.put({ ...n, alarmEnabled: false });
  }

  const noteCard = (n, now) => {
    const title = n.title || "";
    return card(`
      <button type="button" class="note-card__main" data-act="open" data-id="${esc(n.id)}">
        <span class="note-card__head">${n.pinned ? icon("push_pin", { size: 18, cls: "note-card__pin" }) : ""}<span class="note-card__title">${esc(title || "(no title)")}</span></span>
        ${n.body ? `<span class="note-card__body">${esc(n.body)}</span>` : ""}
        ${n.alarmAtMillis ? `<span class="note-card__alarm${n.alarmAtMillis <= now ? " is-passed" : ""}">${esc(noteAlarmLabel(n, now))}</span>` : ""}
      </button>
      <div class="note-card__actions">
        <button type="button" class="icon-btn" data-act="share" data-id="${esc(n.id)}" aria-label="Share note" title="Share">${icon("share")}</button>
        <button type="button" class="icon-btn" data-act="delete" data-id="${esc(n.id)}" aria-label="Delete note ${esc(title || "untitled")}" title="Delete">${icon("delete")}</button>
      </div>`, { tone: "high", pad: false, cls: "note-card" });
  };

  const listHtml = (list) => {
    const now = Date.now();
    if (!list.length) {
      return emptyState({ icon: "edit_note", title: "No notes yet", body: "Tap + to write one. You can set an alarm on it too." });
    }
    const rows = noteRows(list).filter((n) => (searching ? noteMatches(n, query) : true));
    if (!rows.length) return `<p class="prod-nomatch t-title-m">No notes match “${esc(query)}”.</p>`;
    return `<div class="stack-sm">${rows.map((n) => noteCard(n, now)).join("")}</div>`;
  };

  const paintList = async () => {
    const host = el.querySelector("[data-list]");
    if (host) host.innerHTML = listHtml(await notes.all());
  };

  el.innerHTML = screen({
    bar: topBar({
      title: "Notes",
      actions: iconBtn("search", "Search notes", { "data-act": "search" }) + iconBtn("calendar_month", "Note for a calendar event", { "data-act": "from-cal" }),
    }),
    body: `<div class="stack">
      <div data-search-host>${searching ? searchField({ id: "notes-q", placeholder: "Search notes", value: query, pill: false }) : ""}</div>
      <div data-list>${listHtml(await notes.all())}</div>
    </div>`,
    fab: fab("add", "New note", { "data-act": "new" }),
  });

  /* ── editor ───────────────────────────────────────────────── */
  async function runEditor(initial, existing) {
    const base = { ...initial, pinned: !!initial.pinned, alarmOn: !!initial.alarmOn };
    let stored = null;
    const v = await dialog({
      title: existing ? "Edit note" : "New note",
      body: editorBody(base),
      wide: true,
      actions: [{ label: "Cancel", value: false }, { label: "Save", value: true, variant: "text", primary: true }],
      validate(val, d) {
        if (val !== true) return true;
        const out = buildNote(readForm(d, base), existing, Date.now());
        const err = d.querySelector("[data-err]");
        if (!out.record) { err.textContent = out.error; return false; }
        stored = out.record;
        return true;
      },
      onMount(d) {
        bindAlarm(d);
        const sync = () => draft.set("note", { ...readForm(d, base), id: base.id || null, createdAtMillis: base.createdAtMillis, alarmAtMillis: base.alarmAtMillis });
        d.addEventListener("input", sync);
        d.addEventListener("change", sync);
        d.addEventListener("click", (e) => {
          const sw = e.target.closest("[data-switch]");
          if (!sw) return;
          const on = sw.getAttribute("aria-checked") !== "true";
          sw.setAttribute("aria-checked", String(on));
          if (sw.dataset.switch === "alarm") {
            const fields = d.querySelector("[data-alarm-fields]");
            const host = d.querySelector("[data-alarm-host]");
            if (on && !d.querySelector("[data-f=alarmDate]").value) {
              const s = splitInstant(defaultTriggerMillis(Date.now()));
              d.querySelector("[data-f=alarmDate]").value = s.date;
              d.querySelector("[data-f=alarmTime]").value = s.time;
            }
            fields.hidden = !on;
            host.hidden = !on;
            if (on) host.innerHTML = alarmBlock({ note: true });
          }
          sync();
        });
        sync();
      },
    });
    draft.clear("note");
    if (v === true && stored) {
      await notes.put(stored);
      snackbar("Note saved");
    }
    await paintList();
  }

  const fresh = () => ({ title: "", body: "", pinned: false, alarmOn: false, alarmDate: "", alarmTime: "" });
  const formOf = (n) => {
    const at = n.alarmAtMillis ? splitInstant(n.alarmAtMillis) : { date: "", time: "" };
    return { id: n.id, title: n.title || "", body: n.body || "", pinned: !!n.pinned, alarmOn: !!n.alarmEnabled, alarmDate: at.date, alarmTime: at.time, createdAtMillis: n.createdAtMillis, alarmAtMillis: n.alarmAtMillis };
  };

  on(el, "click", "[data-act=new]", () => runEditor(fresh(), null));
  on(el, "click", "[data-act=open]", async (e, btn) => {
    const n = await notes.get(btn.dataset.id);
    if (n) runEditor(formOf(n), n);
  });
  on(el, "click", "[data-act=from-cal]", async () => {
    const entry = await pickCalendarEntry({ title: "Note for a calendar event" });
    if (!entry) return;
    await runEditor({ ...fresh(), title: entry.title, body: entryNoteBody(entry) }, null);
  });
  on(el, "click", "[data-act=search]", async () => {
    searching = !searching;
    query = "";
    el.querySelector("[data-search-host]").innerHTML = searching ? searchField({ id: "notes-q", placeholder: "Search notes", value: "", pill: false }) : "";
    if (searching) el.querySelector("#notes-q")?.focus();
    await paintList();
  });
  on(el, "click", "[data-clear-search]", async () => {
    if (!searching) return;
    query = "";
    const input = el.querySelector("#notes-q");
    if (input) { input.value = ""; input.focus(); }
    await paintList();
  });
  on(el, "input", "#notes-q", async (e) => {
    query = e.target.value;
    e.target.closest(".search")?.classList.toggle("has-value", query !== "");
    await paintList();
  });
  on(el, "click", "[data-act=share]", async (e, btn) => {
    const n = await notes.get(btn.dataset.id);
    if (n) shareSheet(n);
  });
  on(el, "click", "[data-act=delete]", async (e, btn) => {
    const n = await notes.get(btn.dataset.id);
    if (!n) return;
    const ok = await confirm({
      title: "Delete note?",
      text: `“${(n.title || "").trim() || "This note"}” will be removed and its alarm cancelled.`,
      confirmLabel: "Delete", danger: true,
    });
    if (!ok) return;
    await notes.remove(n.id);
    snackbar("Note deleted");
  });

  const unsub = notes.onChange(() => { paintList(); });

  const saved = draft.get("note");
  if (saved) {
    const existing = saved.id ? await notes.get(saved.id) : null;
    setTimeout(() => runEditor(saved, existing), 0);
  }

  return () => { unsub(); };
}
