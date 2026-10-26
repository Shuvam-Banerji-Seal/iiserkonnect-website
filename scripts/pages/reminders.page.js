/**
 * pages/reminders.page.js — Reminders (ui/reminders/RemindersScreen.kt).
 *
 * Upcoming reminders first (soonest first), then past ones (most recent
 * first). The editor has a title, details, a repeat rule and a date and time;
 * "Remind me about…" starts one from a calendar entry. Alarms ring only while
 * a tab is open, which the screen says in plain words (ALARM_NOTE).
 */

import { collection, newId } from "../core/db.js";
import { esc, on } from "../ui/dom.js";
import { screen, topBar, iconBtn, card, textField, chip, switchEl, emptyState, icon } from "../ui/components.js";
import { dialog, confirm, snackbar } from "../ui/overlay.js";
import {
  REPEAT_RULES, parseRule, reminderRows, reconcileReminder, resolveAnchor, nextTriggerAfter,
  isPastOneShot, reminderTimeText, agendaReminderAt, defaultTriggerMillis, entrySummary,
} from "../productivity/logic.js";
import { draft, alarmBlock, bindAlarm, infoBanner, localInstant, splitInstant, fieldValue } from "../productivity/shared.js";
import { pickCalendarEntry } from "../productivity/calendarpicker.js";

const LABEL = { NONE: "Once", DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" };
const SUFFIX = { NONE: "", DAILY: "  ·  daily", WEEKLY: "  ·  weekly", MONTHLY: "  ·  monthly" };
const PAST_ERR = "That time has passed — pick a later time, or make it repeat.";
const PAST_TOGGLE = "That time has passed — edit the reminder to pick a new time.";

/** The stored reminder for an editor form, or { error } (an empty error means "no title yet"). */
function buildReminder(st, existing, now) {
  const title = st.title.trim();
  if (!title) return { error: "Give the reminder a title." };
  const trigger = localInstant(st.date, st.time);
  if (!Number.isFinite(trigger)) return { error: "Pick a date and a time." };
  const rule = parseRule(st.rule);
  const enabled = existing ? !!existing.enabled : true;
  if (rule === "NONE" && enabled && trigger <= now) return { error: PAST_ERR };
  const anchor = resolveAnchor(rule, trigger, existing);
  let at = trigger;
  if (rule !== "NONE" && at <= now) at = nextTriggerAfter(at, now, rule, anchor) ?? at;
  return {
    record: {
      id: existing?.id || newId(),
      title,
      details: st.details.trim(),
      triggerAtMillis: at,
      repeatRule: rule,
      enabled,
      createdAtMillis: existing?.createdAtMillis ?? now,
      lastFiredAtMillis: existing?.lastFiredAtMillis ?? null,
      anchorDayOfMonth: anchor,
      notifiedAt: existing?.notifiedAt ?? null,
    },
  };
}

function editorBody(s) {
  return `
    ${textField({ id: "rem-title", label: "What should I remind you about?", value: s.title, a: { "data-f": "title" } })}
    ${textField({ id: "rem-details", label: "Details (optional)", value: s.details, multiline: true, rows: 2, a: { "data-f": "details" } })}
    <p class="prod-label">Repeat</p>
    <div class="chips" data-rules>${REPEAT_RULES.map((r) => chip(LABEL[r], { selected: parseRule(s.rule) === r, a: { "data-rule": r } })).join("")}</div>
    <p class="prod-label">Remind me</p>
    <div class="prod-fields">
      ${textField({ id: "rem-date", label: "Date", type: "date", value: s.date, a: { "data-f": "date" }, cls: "prod-field" })}
      ${textField({ id: "rem-time", label: "Time", type: "time", value: s.time, a: { "data-f": "time" }, cls: "prod-field" })}
    </div>
    <p class="prod-err" data-err role="alert"></p>
    <div data-alarm-host>${alarmBlock({ note: false })}</div>`;
}

function readForm(d, base) {
  return {
    ...base,
    title: fieldValue(d, "title"),
    details: fieldValue(d, "details"),
    rule: d.querySelector("[data-rules] .chip--selected")?.dataset.rule || base.rule,
    date: fieldValue(d, "date"),
    time: fieldValue(d, "time"),
  };
}

function wireEditor(d, base) {
  const sync = () => draft.set("reminder", { ...readForm(d, base), id: base.id || null, createdAtMillis: base.createdAtMillis, enabled: base.enabled });
  d.addEventListener("input", sync);
  d.addEventListener("change", sync);
  d.addEventListener("click", (e) => {
    const c = e.target.closest("[data-rule]");
    if (!c) return;
    d.querySelectorAll("[data-rule]").forEach((b) => {
      const on = b === c;
      b.classList.toggle("chip--selected", on);
      b.setAttribute("aria-pressed", String(on));
    });
    sync();
  });
}

export async function render(el) {
  const reminders = collection("reminders");
  let msg = "";
  let now = Date.now();

  /** Advance repeating reminders whose time has passed (ReminderReconcile). */
  async function reconcile() {
    now = Date.now();
    for (const r of await reminders.all()) {
      const next = reconcileReminder(r, now);
      if (next) await reminders.put(next);
    }
  }

  const rowHtml = (r) => {
    const past = r.triggerAtMillis <= now;
    const rule = parseRule(r.repeatRule);
    return card(`
      <button type="button" class="rem-row__main" data-act="edit" data-id="${esc(r.id)}">
        <span class="rem-row__title">${esc(r.title)}</span>
        <span class="rem-row__when${past ? "" : " is-upcoming"}">${esc(reminderTimeText(r.triggerAtMillis, now))}${esc(SUFFIX[rule])}</span>
        ${r.details ? `<span class="rem-row__details">${esc(r.details)}</span>` : ""}
      </button>
      ${switchEl(!!r.enabled, `Reminder on or off: ${r.title}`, { "data-act": "toggle", "data-id": r.id })}
      <button type="button" class="icon-btn" data-act="delete" data-id="${esc(r.id)}" aria-label="Delete reminder ${esc(r.title)}" title="Delete">${icon("delete")}</button>`,
    { tone: "high", pad: false, cls: "rem-row" + (past ? " is-past" : "") });
  };

  const listHtml = (list) => {
    if (!list.length) return emptyState({ icon: "alarm", title: "No reminders yet", body: "Tap + to be reminded at a time you choose." });
    const { upcoming, past } = reminderRows(list, now);
    return `<div class="stack-sm">${[...upcoming, ...past].map(rowHtml).join("")}</div>`;
  };

  const bodyHtml = (list) => `
    <div class="stack">
      <div>${alarmBlock({ note: true })}</div>
      ${msg ? infoBanner(msg, { action: "Dismiss", act: "dismiss" }) : ""}
      <div data-list>${listHtml(list)}</div>
    </div>`;

  const paint = async () => {
    const list = await reminders.all();
    const host = el.querySelector("[data-list]");
    if (host) host.innerHTML = listHtml(list);
  };
  const repaintAll = async () => {
    const body = el.querySelector(".screen__body");
    if (body) body.innerHTML = bodyHtml(await reminders.all());
  };

  /** Run the editor; stores the reminder on Save. */
  async function runEditor(initial, existing) {
    const base = { ...initial, id: existing?.id || initial.id || null, createdAtMillis: initial.createdAtMillis || now, enabled: existing ? existing.enabled : initial.enabled !== false };
    let stored = null;
    const v = await dialog({
      title: existing ? "Edit reminder" : "New reminder",
      body: editorBody(base),
      wide: true,
      actions: [{ label: "Cancel", value: false }, { label: "Save", value: true, variant: "text", primary: true }],
      validate(val, d) {
        if (val !== true) return true;
        const out = buildReminder(readForm(d, base), existing, Date.now());
        const err = d.querySelector("[data-err]");
        if (!out.record) { err.textContent = out.error; return false; }
        stored = out.record;
        return true;
      },
      onMount(d) { bindAlarm(d); wireEditor(d, base); },
    });
    draft.clear("reminder");
    if (v === true && stored) {
      await reminders.put(stored);
      snackbar(existing ? "Reminder saved" : "Reminder set");
    }
  }

  const freshForm = () => {
    const s = splitInstant(defaultTriggerMillis(Date.now()));
    return { title: "", details: "", rule: "NONE", date: s.date, time: s.time, enabled: true };
  };

  async function openForm(initial, existing) {
    await runEditor(initial, existing);
    await repaintAll();
  }

  el.innerHTML = screen({
    bar: topBar({
      title: "Reminders",
      actions: iconBtn("calendar_month", "Remind me about a calendar event", { "data-act": "from-cal" }) + iconBtn("add", "New reminder", { "data-act": "new" }),
    }),
    body: bodyHtml(await (async () => { await reconcile(); return reminders.all(); })()),
  });
  bindAlarm(el);

  on(el, "click", "[data-act=new]", () => openForm(freshForm(), null));
  on(el, "click", "[data-act=from-cal]", async () => {
    const entry = await pickCalendarEntry({ title: "Remind me about…" });
    if (!entry) return;
    const at = agendaReminderAt(entry, Date.now()) ?? defaultTriggerMillis(Date.now());
    const s = splitInstant(at);
    await openForm({ title: entry.title, details: entrySummary(entry), rule: "NONE", date: s.date, time: s.time, enabled: true }, null);
  });
  on(el, "click", "[data-act=edit]", async (e, btn) => {
    const r = await reminders.get(btn.dataset.id);
    if (!r) return;
    const s = splitInstant(r.triggerAtMillis);
    await openForm({ title: r.title, details: r.details, rule: r.repeatRule, date: s.date, time: s.time, createdAtMillis: r.createdAtMillis }, r);
  });
  on(el, "click", "[data-act=toggle]", async (e, btn) => {
    const r = await reminders.get(btn.dataset.id);
    if (!r) return;
    const turnOn = btn.getAttribute("aria-checked") !== "true";
    now = Date.now();
    if (turnOn && isPastOneShot({ ...r, enabled: true }, now)) {
      msg = PAST_TOGGLE;
      await repaintAll();
      return;
    }
    await reminders.put({ ...r, enabled: turnOn });
  });
  on(el, "click", "[data-act=delete]", async (e, btn) => {
    const r = await reminders.get(btn.dataset.id);
    if (!r) return;
    const ok = await confirm({ title: "Delete reminder?", text: `“${r.title}” will be removed and its alarm cancelled.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    await reminders.remove(r.id);
    snackbar("Reminder deleted");
  });
  on(el, "click", "[data-act=dismiss]", async () => { msg = ""; await repaintAll(); });

  const unsub = reminders.onChange(() => { paint(); });
  const tick = setInterval(async () => { now = Date.now(); await paint(); }, 30000);

  // An editor left open before a reload comes back with its draft.
  const saved = draft.get("reminder");
  if (saved) {
    const existing = saved.id ? await reminders.get(saved.id) : null;
    setTimeout(() => openForm(saved, existing), 0);
  }

  return () => { unsub(); clearInterval(tick); };
}
