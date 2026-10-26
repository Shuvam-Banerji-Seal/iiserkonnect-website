/**
 * pages/mycalendar.page.js — My Calendar (ui/mycalendar/MyCalendarScreen.kt).
 *
 * A month grid (dots mark days with events) and the agenda for the selected
 * day. Events repeat daily, weekly or monthly and can remind a set number of
 * minutes before they start. Campus events are not edited here; they appear
 * in the Planner and the calendar picker.
 */

import { collection, newId } from "../core/db.js";
import { esc, on, isoDay, fromIsoDay, MONTH_NAMES } from "../ui/dom.js";
import { screen, topBar, iconBtn, fab, card, textField, chip, switchRow, emptyState, icon } from "../ui/components.js";
import { dialog, confirm, snackbar } from "../ui/overlay.js";
import {
  REPEAT_RULES, REPEAT_LABELS, parseRule, buildEventTimes, occurrencesOnDay, nextEventReminderAt,
  monthWeeks, weekdayLabels, markedDaysInMonth, eventRangeText,
} from "../productivity/logic.js";
import { draft, alarmBlock, bindAlarm, fieldValue, splitInstant } from "../productivity/shared.js";

const OFFSETS = [null, 5, 15, 30, 60];
const OFFSET_LABEL = (m) => (m == null ? "Off" : m === 60 ? "1h" : `${m}m`);
const REPEAT_CHIP = { NONE: "None", DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly" };
const REPEAT_NOTE = { NONE: "", DAILY: "Repeats daily", WEEKLY: "Repeats weekly", MONTHLY: "Repeats monthly" };

function editorBody(s) {
  const timed = !s.allDay;
  return `
    ${textField({ id: "ev-title", label: "Title", value: s.title, a: { "data-f": "title" } })}
    ${textField({ id: "ev-location", label: "Location (optional)", value: s.location, a: { "data-f": "location" } })}
    <div class="prod-switches">${switchRow({ title: "All day", checked: !!s.allDay, a: { "data-switch": "allday" } })}</div>
    <p class="prod-label">Starts</p>
    <div class="prod-fields">
      ${textField({ id: "ev-sd", label: "Date", type: "date", value: s.startDate, a: { "data-f": "startDate" }, cls: "prod-field" })}
      <span data-timed-start ${timed ? "" : "hidden"} class="prod-field-wrap">${textField({ id: "ev-st", label: "Time", type: "time", value: s.startTime, a: { "data-f": "startTime" }, cls: "prod-field" })}</span>
    </div>
    <p class="prod-label">Ends</p>
    <div class="prod-fields">
      ${textField({ id: "ev-ed", label: "End date (empty = no end)", type: "date", value: s.endDate, a: { "data-f": "endDate" }, cls: "prod-field" })}
      <span data-timed-end ${timed ? "" : "hidden"} class="prod-field-wrap">${textField({ id: "ev-et", label: "End time", type: "time", value: s.endTime, a: { "data-f": "endTime" }, cls: "prod-field" })}</span>
    </div>
    <p class="prod-label">Repeats</p>
    <div class="chips" data-repeats>${REPEAT_RULES.map((r) => chip(REPEAT_CHIP[r], { selected: parseRule(s.repeatRule) === r, a: { "data-rule": r } })).join("")}</div>
    ${s.id && parseRule(s.repeatRule) !== "NONE" ? `<p class="prod-hint">Changes apply to every repeat.</p>` : ""}
    <p class="prod-label">Remind me</p>
    <div class="chips" data-offsets>${OFFSETS.map((m) => chip(OFFSET_LABEL(m), { selected: (s.remindMinutesBefore ?? null) === m, a: { "data-offset": m == null ? "off" : String(m) } })).join("")}</div>
    <div data-alarm-host>${s.remindMinutesBefore != null ? alarmBlock({ note: false }) : ""}</div>
    ${textField({ id: "ev-notes", label: "Notes (optional)", value: s.notes, multiline: true, rows: 3, a: { "data-f": "notes" } })}
    <p class="prod-err" data-err role="alert"></p>`;
}

function readForm(d, base) {
  const offChip = d.querySelector("[data-offsets] .chip--selected");
  const off = offChip ? offChip.dataset.offset : "off";
  return {
    ...base,
    title: fieldValue(d, "title"),
    location: fieldValue(d, "location"),
    notes: fieldValue(d, "notes"),
    allDay: d.querySelector("[data-switch=allday]")?.getAttribute("aria-checked") === "true",
    startDate: fieldValue(d, "startDate"),
    startTime: fieldValue(d, "startTime"),
    endDate: fieldValue(d, "endDate"),
    endTime: fieldValue(d, "endTime"),
    repeatRule: d.querySelector("[data-repeats] .chip--selected")?.dataset.rule || base.repeatRule,
    remindMinutesBefore: off === "off" ? null : +off,
  };
}

const minutesOf = (hhmm) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** The stored event for an editor form, or { error }. */
function buildEvent(st, existing, now) {
  const title = st.title.trim();
  if (!title) return { error: "Give the event a title." };
  if (!st.startDate) return { error: "Pick a start date." };
  const endDay = st.endDate || st.startDate;
  const timesRes = buildEventTimes({
    startDay: st.startDate,
    endDay,
    startMinute: st.allDay ? null : minutesOf(st.startTime) ?? 540,
    endMinute: st.allDay ? null : st.endTime ? minutesOf(st.endTime) : st.endDate ? Math.min(1439, (minutesOf(st.startTime) ?? 540) + 60) : null,
    allDay: st.allDay,
  });
  if (timesRes.error) return { error: timesRes.error };
  const rec = {
    id: existing?.id || newId(),
    title,
    location: st.location.trim(),
    notes: st.notes.trim(),
    startMillis: timesRes.startMillis,
    endMillis: timesRes.endMillis,
    allDay: !!st.allDay,
    repeatRule: parseRule(st.repeatRule),
    remindMinutesBefore: st.remindMinutesBefore ?? null,
    createdAtMillis: existing?.createdAtMillis ?? now,
  };
  rec.nextReminderAt = nextEventReminderAt(rec, now);
  return { record: rec };
}

export async function render(el) {
  const events = collection("events");
  const todayIso = isoDay(new Date());
  let cursor = fromIsoDay(todayIso);
  let year = cursor.getFullYear(), month = cursor.getMonth();
  let selected = todayIso;

  const cells = (list, y, m) => {
    const marked = markedDaysInMonth(list, y, m);
    const weeks = monthWeeks(y, m);
    return weeks.map((week) => `<div class="mycal-week">${week.map((iso) => {
      if (!iso) return `<span class="mycal-slot" aria-hidden="true"></span>`;
      const d = fromIsoDay(iso);
      const cls = ["mycal-cell"];
      if (iso === todayIso) cls.push("is-today");
      if (iso === selected) cls.push("is-selected");
      if (marked.has(iso)) cls.push("has-events");
      const label = `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}${marked.has(iso) ? ", has events" : ""}${iso === todayIso ? ", today" : ""}${iso === selected ? ", selected" : ""}`;
      return `<span class="mycal-slot"><button type="button" class="${cls.join(" ")}" data-day="${iso}" aria-label="${esc(label)}" aria-pressed="${iso === selected}"><span>${d.getDate()}</span></button></span>`;
    }).join("")}</div>`).join("");
  };

  const agendaHtml = (list) => {
    const occ = occurrencesOnDay(list, selected);
    if (!occ.length) return `<p class="mycal-empty">Nothing planned for this day.</p>`;
    return `<div class="stack-sm">${occ.map((o) => {
      const rule = parseRule(o.repeatRule);
      const sub = [eventRangeText(o.occStart, o.occEnd, o.allDay), (o.location || "").trim()].filter(Boolean).join("  ·  ");
      const remind = o.remindMinutesBefore != null ? `Reminder ${o.remindMinutesBefore} min before` : "";
      const repeat = REPEAT_NOTE[rule];
      return card(`
        <button type="button" class="mycal-ev__main" data-act="edit" data-id="${esc(o.id)}" data-occ="${o.occStart}">
          <span class="mycal-ev__title">${esc(o.title)}</span>
          <span class="mycal-ev__sub">${esc(sub)}</span>
          ${remind || repeat ? `<span class="mycal-ev__meta">${esc([remind, repeat].filter(Boolean).join("  ·  "))}</span>` : ""}
        </button>
        <button type="button" class="icon-btn" data-act="delete" data-id="${esc(o.id)}" aria-label="Delete event ${esc(o.title)}" title="Delete">${icon("delete")}</button>`,
      { tone: "high", pad: false, cls: "mycal-ev" });
    }).join("")}</div>`;
  };

  const monthTitle = () => `${MONTH_NAMES[month]} ${year}`;
  const labels = weekdayLabels().map((l) => `<span class="mycal-weekday">${l}</span>`).join("");

  const bodyHtml = (list) => `
    <div class="stack">
      <div class="mycal-head">
        <button type="button" class="icon-btn" data-act="prev" aria-label="Previous month">${icon("chevron_left")}</button>
        <h2 class="mycal-title t-title-m">${esc(monthTitle())}</h2>
        <button type="button" class="icon-btn" data-act="next" aria-label="Next month">${icon("chevron_right")}</button>
      </div>
      <div class="mycal-card" data-grid>
        <div class="mycal-week mycal-week--labels">${labels}</div>
        ${cells(list, year, month)}
      </div>
      <div data-agenda>${agendaHtml(list)}</div>
    </div>`;

  const repaint = async () => {
    const list = await events.all();
    const body = el.querySelector(".screen__body");
    if (body) body.innerHTML = bodyHtml(list);
  };

  el.innerHTML = screen({
    bar: topBar({ title: "My Calendar" }),
    body: bodyHtml(await events.all()),
    fab: fab("add", "New event on this day", { "data-act": "new" }),
  });

  /* ── editor ───────────────────────────────────────────────── */
  async function runEditor(initial, existing) {
    const base = { ...initial };
    let stored = null;
    const v = await dialog({
      title: existing ? "Edit event" : "New event",
      body: editorBody(base),
      wide: true,
      actions: [{ label: "Cancel", value: false }, { label: "Save", value: true, variant: "text", primary: true }],
      validate(val, d) {
        if (val !== true) return true;
        const out = buildEvent(readForm(d, base), existing, Date.now());
        const err = d.querySelector("[data-err]");
        if (!out.record) { err.textContent = out.error; return false; }
        stored = out.record;
        return true;
      },
      onMount(d) {
        bindAlarm(d);
        const sync = () => draft.set("event", { ...readForm(d, base), id: base.id || null, createdAtMillis: base.createdAtMillis });
        d.addEventListener("input", sync);
        d.addEventListener("change", sync);
        d.addEventListener("click", (e) => {
          const sw = e.target.closest("[data-switch=allday]");
          if (sw) {
            const on = sw.getAttribute("aria-checked") !== "true";
            sw.setAttribute("aria-checked", String(on));
            d.querySelectorAll("[data-timed-start], [data-timed-end]").forEach((n) => { n.hidden = on; });
          }
          const rc = e.target.closest("[data-rule]");
          if (rc) {
            d.querySelectorAll("[data-rule]").forEach((b) => { const on = b === rc; b.classList.toggle("chip--selected", on); b.setAttribute("aria-pressed", String(on)); });
          }
          const oc = e.target.closest("[data-offset]");
          if (oc) {
            d.querySelectorAll("[data-offset]").forEach((b) => { const on = b === oc; b.classList.toggle("chip--selected", on); b.setAttribute("aria-pressed", String(on)); });
            d.querySelector("[data-alarm-host]").innerHTML = oc.dataset.offset === "off" ? "" : alarmBlock({ note: false });
          }
          if (sw || rc || oc) sync();
        });
        sync();
      },
    });
    draft.clear("event");
    if (v === true && stored) {
      await events.put(stored);
      snackbar(existing ? "Event saved" : "Event added");
    }
    if (v === true || v === false) await repaint();
  }

  const formOf = (ev, occStart) => {
    const s = splitInstant(occStart ?? ev.startMillis);
    const e = ev.endMillis != null ? splitInstant(ev.endMillis) : { date: "", time: "" };
    // An all-day end is stored as the midnight after its last day.
    const endDate = ev.allDay && ev.endMillis != null ? splitInstant(ev.endMillis - 1).date : e.date;
    return {
      id: ev.id, title: ev.title, location: ev.location || "", notes: ev.notes || "",
      allDay: !!ev.allDay, startDate: s.date, startTime: ev.allDay ? "" : s.time,
      endDate: ev.endMillis != null ? endDate : "", endTime: ev.endMillis != null && !ev.allDay ? e.time : "",
      repeatRule: ev.repeatRule, remindMinutesBefore: ev.remindMinutesBefore ?? null, createdAtMillis: ev.createdAtMillis,
    };
  };
  const freshAt = (iso) => ({
    title: "", location: "", notes: "", allDay: false, startDate: iso, startTime: "09:00",
    endDate: "", endTime: "", repeatRule: "NONE", remindMinutesBefore: 15,
  });

  on(el, "click", "[data-act=new]", () => runEditor(freshAt(selected), null));
  on(el, "click", "[data-act=prev]", async () => { month -= 1; if (month < 0) { month = 11; year -= 1; } await repaint(); });
  on(el, "click", "[data-act=next]", async () => { month += 1; if (month > 11) { month = 0; year += 1; } await repaint(); });
  on(el, "click", "[data-day]", async (e, btn) => {
    const iso = btn.dataset.day;
    selected = iso;
    const d = fromIsoDay(iso);
    if (d.getMonth() !== month || d.getFullYear() !== year) { year = d.getFullYear(); month = d.getMonth(); }
    await repaint();
  });
  on(el, "click", "[data-act=edit]", async (e, btn) => {
    const ev = await events.get(btn.dataset.id);
    if (ev) runEditor(formOf(ev, +btn.dataset.occ), ev);
  });
  on(el, "click", "[data-act=delete]", async (e, btn) => {
    const ev = await events.get(btn.dataset.id);
    if (!ev) return;
    const series = parseRule(ev.repeatRule) !== "NONE";
    const text = series
      ? `Delete “${ev.title}” and all its repeats?`
      : `“${ev.title}” will be removed and its reminder cancelled.`;
    const ok = await confirm({ title: "Delete event?", text, confirmLabel: "Delete", danger: true });
    if (ok) await events.remove(ev.id);
  });

  const unsub = events.onChange(() => { repaint(); });

  const saved = draft.get("event");
  if (saved) {
    const existing = saved.id ? await events.get(saved.id) : null;
    setTimeout(() => runEditor(saved, existing), 0);
  }

  return () => { unsub(); };
}
