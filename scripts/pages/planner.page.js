/**
 * pages/planner.page.js — Planner (ui/planner/PlannerScreen.kt).
 *
 * Undone tasks first, dated before someday, timed before untimed. Ticking a
 * task off strikes it through. "Clear completed tasks" deletes every finished
 * task after a confirmation that names how many. Today's entries from both
 * calendars sit above the list; "Plan" turns one into a task.
 */

import { collection, newId } from "../core/db.js";
import { esc, on, isoDay } from "../ui/dom.js";
import { screen, topBar, iconBtn, fab, card, textField, checkbox, switchRow, emptyState, icon } from "../ui/components.js";
import { dialog, confirm, snackbar } from "../ui/overlay.js";
import {
  plannerRows, isOverdue, blockError, taskBlockText, dayKeyWord, entryTaskFields, entrySummary,
  entriesOnDay, eventRangeText,
} from "../productivity/logic.js";
import { draft, alarmBlock, bindAlarm, infoBanner, localInstant, splitInstant, fieldValue, plural } from "../productivity/shared.js";
import { pickCalendarEntry, upcomingEntries } from "../productivity/calendarpicker.js";

const minutesOf = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};
const hhmmOf = (min) => (min == null ? "" : `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`);

/** The stored task for an editor form, or { error }. */
function buildTask(st, existing, now) {
  const title = st.title.trim();
  if (!title) return { error: "Give the task a title." };
  const start = minutesOf(st.startTime), end = minutesOf(st.endTime);
  const blockErr = blockError(start, end);
  if (blockErr) return { error: blockErr };
  let remindAtMillis = null;
  if (st.remindOn) {
    remindAtMillis = localInstant(st.remindDate, st.remindTime);
    if (!Number.isFinite(remindAtMillis)) return { error: "Pick a date and a time for the reminder." };
    if (remindAtMillis <= now) return { error: "That time has passed — pick a later time." };
  }
  const changedRemind = (existing?.remindAtMillis ?? null) !== remindAtMillis;
  return {
    record: {
      id: existing?.id || newId(),
      title,
      details: st.details.trim(),
      done: existing ? !!existing.done : false,
      dueDay: st.dueDay || null,
      startMinute: start,
      endMinute: start == null ? null : end,
      remindAtMillis,
      createdAtMillis: existing?.createdAtMillis ?? now,
      notifiedAt: changedRemind ? null : existing?.notifiedAt ?? null,
    },
  };
}

function editorBody(s) {
  const when = s.dueDay ? "" : "Someday";
  return `
    ${textField({ id: "task-title", label: "What needs doing?", value: s.title, a: { "data-f": "title" } })}
    ${textField({ id: "task-details", label: "Details (optional)", value: s.details, multiline: true, rows: 2, a: { "data-f": "details" } })}
    <p class="prod-label">When</p>
    ${textField({ id: "task-day", label: "Day", type: "date", value: s.dueDay || "", placeholder: when,
      trailing: `<button type="button" class="btn btn--text btn--sm" data-act="clear-day">Clear</button>`, a: { "data-f": "dueDay" } })}
    <div class="prod-fields">
      ${textField({ id: "task-from", label: "From", type: "time", value: s.startTime || "", a: { "data-f": "startTime" }, cls: "prod-field" })}
      ${textField({ id: "task-to", label: "To", type: "time", value: s.endTime || "", a: { "data-f": "endTime" }, cls: "prod-field" })}
    </div>
    <div class="prod-switches">
      ${switchRow({ title: "Remind me", checked: !!s.remindOn, a: { "data-switch": "remind" } })}
    </div>
    <div class="prod-fields" data-remind-fields ${s.remindOn ? "" : "hidden"}>
      ${textField({ id: "task-rdate", label: "Reminder date", type: "date", value: s.remindDate || "", a: { "data-f": "remindDate" }, cls: "prod-field" })}
      ${textField({ id: "task-rtime", label: "Reminder time", type: "time", value: s.remindTime || "", a: { "data-f": "remindTime" }, cls: "prod-field" })}
    </div>
    <div data-alarm-host ${s.remindOn ? "" : "hidden"}>${s.remindOn ? alarmBlock({ note: true }) : ""}</div>
    <p class="prod-err" data-err role="alert"></p>`;
}

function readForm(d, base) {
  return {
    ...base,
    title: fieldValue(d, "title"),
    details: fieldValue(d, "details"),
    dueDay: fieldValue(d, "dueDay"),
    startTime: fieldValue(d, "startTime"),
    endTime: fieldValue(d, "endTime"),
    remindOn: d.querySelector("[data-switch=remind]")?.getAttribute("aria-checked") === "true",
    remindDate: fieldValue(d, "remindDate"),
    remindTime: fieldValue(d, "remindTime"),
  };
}

export async function render(el) {
  const tasks = collection("tasks");
  let msg = "";
  let entries = [];
  const today = isoDay(new Date());

  try { entries = entriesOnDay((await upcomingEntries()).entries, today); } catch { entries = []; }

  const block = (t) => taskBlockText(t.startMinute, t.endMinute);

  const rowHtml = (t, now) => {
    const overdue = isOverdue(t, isoDay(new Date(now)));
    const day = t.dueDay ? dayKeyWord(t.dueDay, new Date(now)) : "Someday";
    const b = block(t);
    const sub = b ? `${day}  ·  ${b}` : day;
    return card(`
      ${checkbox(!!t.done, `Done: ${t.title || "task"}`, { "data-act": "done", "data-id": t.id })}
      <button type="button" class="plan-row__main" data-act="edit" data-id="${esc(t.id)}">
        <span class="plan-row__title${t.done ? " is-done" : ""}">${esc(t.title || "(no title)")}</span>
        <span class="plan-row__when${overdue ? " is-overdue" : ""}">${esc(sub)}</span>
        ${t.remindAtMillis && !t.done ? `<span class="plan-row__remind">${icon("alarm", { size: 14 })} Reminder set</span>` : ""}
      </button>
      <button type="button" class="icon-btn" data-act="delete" data-id="${esc(t.id)}" aria-label="Delete task ${esc(t.title || "untitled")}" title="Delete">${icon("delete")}</button>`,
    { tone: "high", pad: false, cls: "plan-row" + (t.done ? " is-done" : "") });
  };

  const dayStrip = () => {
    if (!entries.length) return "";
    const rows = entries.map((e) => {
      const idx = entries.indexOf(e);
      const time = eventRangeText(e.start, e.end, e.allDay);
      const src = e.source === "CAMPUS" ? "Campus" : "My Calendar";
      const sub = [time, src, (e.location || "").trim()].filter(Boolean).join("  ·  ");
      return `<div class="day-strip__row">
        <span class="day-strip__text"><span class="day-strip__title">${esc(e.title)}</span><span class="day-strip__sub">${esc(sub)}</span></span>
        <button type="button" class="btn btn--text btn--sm" data-act="plan-entry" data-entry="${idx}">Plan</button>
      </div>`;
    }).join("");
    const lines = entries.map((e) => `<li>${esc(e.allDay ? "All day" : eventRangeText(e.start, e.end, false))}  ·  ${esc(e.title)}</li>`).join("");
    return `
      ${card(`<h2 class="day-strip__head">On your calendars today</h2>${rows}`, { tone: "variant", cls: "day-strip" })}
      ${card(`<div class="day-strip__agenda-head"><span class="day-strip__agenda-title">${icon("today", { size: 20 })} Today's agenda</span><span class="day-strip__count">${entries.length} today</span></div>
        <ul class="day-strip__lines">${lines}</ul>`, { tone: "variant", cls: "day-strip day-strip--agenda" })}`;
  };

  const listHtml = (list) => {
    const now = Date.now();
    const rows = plannerRows(list);
    if (!rows.length) return emptyState({ icon: "checklist", title: "Nothing planned", body: "Tap + to add a task, with an optional time and reminder." });
    return `<div class="stack-sm">${rows.map((t) => rowHtml(t, now)).join("")}</div>`;
  };

  const doneCount = (list) => list.filter((t) => t.done).length;
  const actionsHtml = (list) => (doneCount(list) > 0 ? iconBtn("delete_sweep", "Clear completed tasks", { "data-act": "clear-done" }) : "")
    + iconBtn("calendar_month", "Plan a calendar event", { "data-act": "from-cal" });

  const bodyHtml = (list) => `
    <div class="stack">
      ${msg ? infoBanner(msg, { action: "Dismiss", act: "dismiss" }) : ""}
      <div data-strip>${dayStrip()}</div>
      <div data-list>${listHtml(list)}</div>
    </div>`;

  const repaint = async () => {
    const list = await tasks.all();
    const body = el.querySelector(".screen__body");
    if (body) body.innerHTML = bodyHtml(list);
    const bar = el.querySelector(".topbar__actions");
    if (bar) bar.innerHTML = actionsHtml(list);
  };

  el.innerHTML = screen({
    bar: topBar({ title: "Planner", actions: actionsHtml(await tasks.all()) }),
    body: bodyHtml(await tasks.all()),
    fab: fab("add", "New task", { "data-act": "new" }),
  });
  bindAlarm(el);

  /* ── editor ───────────────────────────────────────────────── */
  async function runEditor(initial, existing) {
    const base = { ...initial };
    let stored = null;
    const v = await dialog({
      title: existing ? "Edit task" : "New task",
      body: editorBody(base),
      wide: true,
      actions: [{ label: "Cancel", value: false }, { label: "Save", value: true, variant: "text", primary: true }],
      validate(val, d) {
        if (val !== true) return true;
        const out = buildTask(readForm(d, base), existing, Date.now());
        const err = d.querySelector("[data-err]");
        if (!out.record) { err.textContent = out.error; return false; }
        stored = out.record;
        return true;
      },
      onMount(d) {
        bindAlarm(d);
        const sync = () => draft.set("task", { ...readForm(d, base), id: base.id || null, createdAtMillis: base.createdAtMillis, done: base.done });
        d.addEventListener("input", sync);
        d.addEventListener("change", sync);
        d.addEventListener("click", (e) => {
          if (e.target.closest("[data-act=clear-day]")) {
            d.querySelector("[data-f=dueDay]").value = "";
            sync();
            return;
          }
          const sw = e.target.closest("[data-switch=remind]");
          if (!sw) return;
          const on = sw.getAttribute("aria-checked") !== "true";
          sw.setAttribute("aria-checked", String(on));
          const fields = d.querySelector("[data-remind-fields]");
          const host = d.querySelector("[data-alarm-host]");
          if (on && !d.querySelector("[data-f=remindDate]").value) {
            const dateBase = d.querySelector("[data-f=dueDay]").value || today;
            d.querySelector("[data-f=remindDate]").value = dateBase;
            d.querySelector("[data-f=remindTime]").value = d.querySelector("[data-f=startTime]").value || "09:00";
          }
          fields.hidden = !on;
          host.hidden = !on;
          if (on) host.innerHTML = alarmBlock({ note: true });
          sync();
        });
        sync();
      },
    });
    draft.clear("task");
    if (v === true && stored) {
      await tasks.put(stored);
      snackbar(existing ? "Task saved" : "Task added");
    }
    if (v === true || v === false) await repaint();
  }

  const formOf = (t) => {
    const rem = t.remindAtMillis ? splitInstant(t.remindAtMillis) : { date: "", time: "" };
    return {
      id: t.id, title: t.title || "", details: t.details || "", dueDay: t.dueDay || "",
      startTime: hhmmOf(t.startMinute), endTime: hhmmOf(t.endMinute),
      remindOn: !!t.remindAtMillis, remindDate: rem.date, remindTime: rem.time,
      createdAtMillis: t.createdAtMillis, done: t.done,
    };
  };
  const fresh = (extra = {}) => ({ title: "", details: "", dueDay: "", startTime: "", endTime: "", remindOn: false, remindDate: "", remindTime: "", ...extra });

  on(el, "click", "[data-act=new]", () => runEditor(fresh(), null));
  on(el, "click", "[data-act=edit]", async (e, btn) => {
    const t = await tasks.get(btn.dataset.id);
    if (t) runEditor(formOf(t), t);
  });
  on(el, "click", "[data-act=done]", async (e, btn) => {
    const t = await tasks.get(btn.dataset.id);
    if (!t) return;
    const done = btn.getAttribute("aria-checked") !== "true";
    const next = { ...t, done };
    // Being reminded about a task that is already past its time would fire at once.
    if (!done && t.remindAtMillis && t.remindAtMillis <= Date.now()) next.notifiedAt = t.remindAtMillis;
    await tasks.put(next);
  });
  on(el, "click", "[data-act=delete]", async (e, btn) => {
    const t = await tasks.get(btn.dataset.id);
    if (!t) return;
    const ok = await confirm({ title: "Delete task?", text: `“${(t.title || "").trim() || "This task"}” will be removed.`, confirmLabel: "Delete", danger: true });
    if (ok) await tasks.remove(t.id);
  });
  on(el, "click", "[data-act=plan-entry]", (e, btn) => {
    const entry = entries[+btn.dataset.entry];
    if (entry) planEntry(entry);
  });
  on(el, "click", "[data-act=from-cal]", async () => {
    const entry = await pickCalendarEntry({ title: "Plan a calendar event" });
    if (entry) planEntry(entry);
  });
  on(el, "click", "[data-act=dismiss]", async () => { msg = ""; await repaint(); });
  on(el, "click", "[data-act=clear-done]", async () => {
    const ids = (await tasks.all()).filter((t) => t.done).map((t) => t.id);
    if (!ids.length) return;
    const ok = await dialog({
      title: "Clear completed tasks?",
      body: `<p>Delete ${ids.length} completed ${ids.length === 1 ? "task" : "tasks"}? This cannot be undone.</p>`,
      actions: [{ label: "Cancel", value: false }, { label: "Clear", value: true, variant: "danger-text", primary: true }],
    });
    if (ok !== true) return;
    for (const id of ids) await tasks.remove(id);
    msg = `Cleared ${plural(ids.length, "completed task", "completed tasks")}.`;
    await repaint();
  });

  /** A calendar entry becomes a new task, opened in the editor for the user to save. */
  function planEntry(entry) {
    const f = entryTaskFields(entry);
    const startTime = f.startMinute == null ? "" : hhmmOf(f.startMinute);
    const endTime = f.endMinute == null ? "" : hhmmOf(f.endMinute);
    runEditor(fresh({ title: entry.title, details: entrySummary(entry), dueDay: f.dueDay, startTime, endTime }), null);
  }

  const unsub = tasks.onChange(() => { repaint(); });

  const saved = draft.get("task");
  if (saved) {
    const existing = saved.id ? await tasks.get(saved.id) : null;
    setTimeout(() => runEditor(saved, existing), 0);
  }

  return () => { unsub(); };
}
