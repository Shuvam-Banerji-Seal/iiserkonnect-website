/**
 * pages/budget.page.js — the Budget, all kept in this browser.
 *
 *   renderAnalysis  budget          ui/budget/BudgetAnalysisScreen.kt
 *   renderLedger    budget/ledger   ui/budget/BudgetLedgerScreen.kt
 *   renderSync      budget/sync     ui/budget/BudgetSyncScreen.kt
 *
 * The figures come from data/budget.data.js. Calories are what the user types
 * (kcal per serving); the app's catalogue calories and nutrition estimates are
 * not available on the web.
 */

import { screen, topBar, chip, card, button, emptyState, browserNote, sampleBanner, extLink, loading, errorCard, textField } from "../ui/components.js";
import { esc, on, longDate, isoDay, fromIsoDay, timeOf, shortDate, DAY_NAMES, MONTH_NAMES, pad2 } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { dialog, confirm, snackbar } from "../ui/overlay.js";
import { haptics } from "../ui/haptics.js";
import { collection } from "../core/db.js";
import { loadTransactions } from "../data/mess.data.js";
import {
  loadEntries, saveEntry, deleteEntry, syncFromMess, calorieTarget, setCalorieTarget, lastSyncAt,
  dailyStats, monthlyStats, byMealType, calorieLedger, spendLastDays, spendOn, kcalOn, entriesCsv,
} from "../data/budget.data.js";

const MEAL_ORDER = ["Breakfast", "Lunch", "Snacks", "Dinner"];
const rs = (n) => `Rs ${(+n || 0).toFixed(2)}`;
const rsRound = (n) => `Rs ${Math.round(+n || 0)}`;
const monthName = (y, m) => `${MONTH_NAMES[m]} ${y}`;
const monthShort = (y, m) => `${MONTH_NAMES[m].slice(0, 3)} ${String(y).slice(2)}`;
const ymText = (y, m) => `${y}-${pad2(m + 1)}`;
const dateText = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** Sits in the top bar of the ledger/analysis, and tints by a state the user can see. */
const linkIcon = (href, ic, label) => `<a class="icon-btn" href="${esc(href)}" aria-label="${esc(label)}" title="${esc(label)}">${icon(ic)}</a>`;

/* ════════════════════════════════════════════════════════════════════
 * Budget Analysis
 * ════════════════════════════════════════════════════════════════════ */
export async function renderAnalysis(el) {
  let entries = [];
  let mode = "day";          // day | month
  let chartKind = "bar";     // bar | line
  let now = new Date();
  let ym = { y: now.getFullYear(), m: now.getMonth() };
  let picked = null;         // selected point index, or null = default
  let target = calorieTarget();
  let alive = true;

  const points = () => {
    if (mode === "day") {
      return dailyStats(entries, ym.y, ym.m).map((d) => ({
        label: String(d.day), descriptor: isoDay(d.date), spend: d.spend, kcal: d.kcal,
      }));
    }
    return monthlyStats(entries, now, 8).map((x) => ({
      label: monthShort(x.year, x.month), descriptor: ymText(x.year, x.month), spend: x.spend, kcal: x.kcal,
    }));
  };
  const defaultSel = (pts) => {
    if (!pts.length) return 0;
    const i = pts.map((p, k) => [p, k]).filter(([p]) => p.spend > 0 || p.kcal > 0).map(([, k]) => k).pop();
    return i == null ? pts.length - 1 : i;
  };

  const chartCard = (cfg, pts, sel) => {
    const selPt = pts[sel];
    const value = cfg.value;
    return card(`
      <div class="budget-card__head">
        <div class="budget-card__titles">
          <h2 class="t-title-m w-semi">${esc(cfg.title)}</h2>
          <span class="t-body-s c-muted">${esc(cfg.subtitle)}</span>
        </div>
        ${selPt ? `<div class="budget-card__value">
          <span class="budget-card__num" style="color:${cfg.color}">${esc(cfg.fmt(value(selPt)))}</span>
          <span class="t-label-s c-muted">${esc(selPt.descriptor)}</span></div>` : ""}
      </div>
      ${!pts.length ? `<p class="t-body-m c-muted">No data available for this period.</p>` : `
        <p class="t-label-m c-muted budget-yaxis">${esc(cfg.yLabel)}</p>
        ${chartSvg({ pts, sel, value, kind: chartKind, color: cfg.color, target: cfg.target, fmtTick: cfg.tick, fmt: cfg.fmt, which: cfg.which })}
        <p class="t-label-m c-muted budget-xaxis">${esc(cfg.xLabel)}</p>`}
    `, { tone: "high", prism: false, cls: "budget-card" });
  };

  const paint = () => {
    const pts = points();
    const sel = picked != null && picked < pts.length ? picked : defaultSel(pts);
    const selPt = pts[sel];
    const prev = pts[Math.max(0, sel - 1)];
    const todaySpend = spendOn(entries, now);
    const week = spendLastDays(entries, 7), month = spendLastDays(entries, 30);
    const monthLabel = monthName(ym.y, ym.m);
    const cal = calorieLedger(entries, ym.y, ym.m, target);
    const comp = byMealType(entries, ym.y, ym.m);
    const compTotal = comp.reduce((s, x) => s + x.spend, 0);
    const kcalToday = kcalOn(entries, now);
    const subtitleDay = mode === "day" ? monthLabel : `Last ${pts.length} months`;

    const modeChips = `<div class="chips chips--scroll budget-chips">
      ${chip("Day-wise", { selected: mode === "day", a: { "data-mode": "day" } })}
      ${chip("Month-wise", { selected: mode === "month", a: { "data-mode": "month" } })}
      ${chip("Bar Graph", { selected: chartKind === "bar", a: { "data-kind": "bar" } })}
      ${chip("Line Graph", { selected: chartKind === "line", a: { "data-kind": "line" } })}
    </div>`;

    const navRow = mode === "day" ? `<div class="budget-monthnav">
      <button class="icon-btn" type="button" data-act="prev-month" aria-label="Previous month">${icon("chevron_left")}</button>
      <span class="t-title-s w-semi">${esc(monthLabel)}</span>
      <button class="icon-btn" type="button" data-act="next-month" aria-label="Next month">${icon("chevron_right")}</button>
    </div>` : "";

    const summary = `<div class="budget-summary">
      ${summaryChip("Today", rs(todaySpend))}
      ${summaryChip("Week", rs(week))}
      ${summaryChip("Month", rs(month))}
    </div>`;

    const spendCfg = {
      title: mode === "day" ? "Daily Spend" : "Monthly Spend",
      subtitle: subtitleDay,
      value: (p) => p.spend, fmt: rs, color: "var(--primary)", which: "spend",
      tick: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))),
      yLabel: "Spend (Rs)", xLabel: mode === "day" ? "Day of month" : "Month",
    };
    const kcalCfg = {
      title: mode === "day" ? "Daily Calories" : "Monthly Calories",
      subtitle: mode === "day" ? `Target ${target} kcal` : "Calorie trend",
      value: (p) => p.kcal, fmt: (v) => `${Math.round(v)} kcal`, color: "var(--tertiary)", which: "kcal",
      tick: (v) => String(Math.round(v)), yLabel: "Calories (kcal)", xLabel: mode === "day" ? "Day of month" : "Month",
      target: mode === "day" ? target : null,
    };

    // PRICE-CATALOGUE STUB: catalogue calories and the nutrition table are not used on the web;
    // the figures below come only from the kcal the user typed in.
    const calNote = browserNote({
      title: "Calories are what you enter",
      body: "Calories here come from the kcal you type into the ledger. The app's catalogue calories and nutrition estimates are not available on the web.",
      icon: "info", tone: "info",
    });

    const firstRun = !entries.length ? browserNote({
      title: "Nothing recorded in this browser yet",
      body: "Add an entry in the Ledger, or rebuild the mess rows from Budget Sync. Everything here stays in this browser.",
      icon: "info", tone: "info",
    }) : "";

    const calorieCard = cal.isEmpty
      ? `${card(`
          <div class="budget-card__head"><div class="budget-card__titles">
            <h2 class="t-title-m w-semi">Calorie ledger</h2>
            <span class="t-body-s c-muted">${cal.daysLogged} of ${cal.daysInMonth} days recorded · target ${target} kcal</span></div>
            ${trendBadge(cal.trendPercent)}</div>
          <p class="t-body-s c-muted">Nothing recorded this month yet. A day with no canteen transaction is not counted as zero — the app cannot know what was eaten elsewhere, so it does not pretend to.</p>`,
          { tone: "high", prism: false, cls: "budget-card" })}`
      : card(`
          <div class="budget-card__head"><div class="budget-card__titles">
            <h2 class="t-title-m w-semi">Calorie ledger</h2>
            <span class="t-body-s c-muted">${cal.daysLogged} of ${cal.daysInMonth} days recorded · target ${target} kcal</span></div>
            ${trendBadge(cal.trendPercent)}</div>
          <p class="budget-bigkcal">${Math.round(cal.average)} kcal</p>
          <p class="t-label-m c-muted">average on a recorded day</p>
          <dl class="budget-kv">
            ${kvRow("Total", `${Math.round(cal.total)} kcal`)}
            ${kvRow("On target", `${cal.onTarget} of ${cal.daysLogged} days`)}
            ${kvRow("Over", `${cal.over} days`)}
            ${kvRow("Under", `${cal.under} days`)}
            ${cal.biggest ? kvRow("Biggest day", `${cal.biggest.date.getDate()} ${MONTH_NAMES[cal.biggest.date.getMonth()].slice(0, 3)} · ${Math.round(cal.biggest.kcal)} kcal`) : ""}
          </dl>`, { tone: "high", prism: false, cls: "budget-card" });

    const ringProgress = calorieProgress(kcalToday, target);

    el.innerHTML = screen({
      bar: topBar({ title: "Budget Analysis", actions: linkIcon("#/budget/ledger", "table_view", "Open ledger and CSV") }),
      body: `
        ${firstRun}
        ${card(`${modeChips}${navRow}${summary}
          <div class="budget-actions">
            <a class="btn btn--filled" href="#/budget/ledger">${icon("table_chart", { size: 18 })}<span>Ledger + CSV</span></a>
            <button class="btn btn--outlined" type="button" data-act="export">${icon("download", { size: 18 })}<span>Export CSV</span></button>
          </div>`, { tone: "high", prism: false, cls: "budget-card" })}
        ${chartCard(spendCfg, pts, sel)}
        ${calNote}
        ${chartCard(kcalCfg, pts, sel)}
        ${calorieCard}
        ${card(`
          <h2 class="t-title-m w-semi">Where it went</h2>
          <p class="t-body-s c-muted">${esc(monthLabel)}</p>
          ${compTotal <= 0 ? `<p class="t-body-m c-muted">Nothing recorded this month yet.</p>` : `
            <div class="budget-donut-row">
              ${donutSvg(comp.filter((x) => x.spend > 0), compTotal)}
              <ul class="budget-legend">${comp.filter((x) => x.spend > 0).map((x, i) => `
                <li><span class="budget-swatch" style="background:${PALETTE[i % PALETTE.length]}"></span>
                  <span class="t-label-m budget-legend__name">${esc(x.mealType)}</span>
                  <span class="t-label-m w-semi">${Math.round((x.spend / compTotal) * 100)}%</span></li>`).join("")}</ul>
            </div>`}
          ${target > 0 ? `<div class="budget-ring-row">
            ${progressRing(ringProgress, `of ${target} kcal`, Math.round(kcalToday))}
            <div class="budget-ring-text">
              <span class="t-label-m c-muted">Today's calories</span>
              <span class="t-title-s w-bold ${kcalToday > target ? "c-error" : ""}">${kcalToday - target >= 0 ? `${Math.round(kcalToday - target)} kcal over` : `${Math.round(target - kcalToday)} kcal left`}</span>
              <span class="t-label-s c-muted">${esc(ringProgress.label)}</span>
            </div>
          </div>` : ""}`, { tone: "high", prism: false, cls: "budget-card" })}
        ${pts.length && sel != null && selPt ? card(`
          <h3 class="t-title-s w-semi">Selected: ${esc(selPt.descriptor)}</h3>
          <p class="t-body-m">Spend: ${esc(rs(selPt.spend))}</p>
          <p class="t-body-m">Calories: ${Math.round(selPt.kcal)} kcal</p>
          ${(() => {
            const diff = selPt.spend - (prev ? prev.spend : 0);
            return `<p class="t-body-m w-semi ${diff >= 0 ? "c-error" : "c-primary"}">vs previous: ${diff >= 0 ? "+" : "-"} Rs ${Math.abs(diff).toFixed(2)}</p>`;
          })()}`, { tone: "high", prism: false, cls: "budget-card" }) : ""}
        <p class="t-label-m c-muted budget-foot">${esc(monthName(ym.y, ym.m))} · ${entries.length} recorded entries in this browser</p>`,
    });
  };

  const summaryChip = (label, value) => `<div class="budget-summary__item">
    <span class="t-label-m c-muted">${esc(label)}</span>
    <span class="t-title-s w-bold">${esc(value)}</span></div>`;
  const kvRow = (k, v) => `<div class="budget-kv__row"><dt class="t-body-m c-muted">${esc(k)}</dt><dd class="t-body-m w-semi">${esc(v)}</dd></div>`;
  const trendBadge = (pct) => {
    const text = pct == null ? "no earlier month"
      : Math.abs(pct) < 0.5 ? "about the same"
      : pct > 0 ? `▲ ${Math.round(pct)}% vs last month` : `▼ ${Math.round(Math.abs(pct))}% vs last month`;
    return `<span class="t-label-s c-muted budget-trend">${esc(text)}</span>`;
  };

  const refresh = async () => {
    entries = await loadEntries();
    if (!alive) return;
    paint();
  };

  on(el, "click", "[data-mode]", (e, b) => { mode = b.dataset.mode; picked = null; haptics.select(); paint(); });
  on(el, "click", "[data-kind]", (e, b) => { chartKind = b.dataset.kind; haptics.select(); paint(); });
  on(el, "click", "[data-act=prev-month]", () => { const d = new Date(ym.y, ym.m - 1, 1); ym = { y: d.getFullYear(), m: d.getMonth() }; picked = null; paint(); });
  on(el, "click", "[data-act=next-month]", () => { const d = new Date(ym.y, ym.m + 1, 1); ym = { y: d.getFullYear(), m: d.getMonth() }; picked = null; paint(); });
  on(el, "click", "[data-pt]", (e, b) => { picked = +b.dataset.pt; haptics.select(); paint(); });
  on(el, "click", "[data-act=export]", async () => {
    const choice = await dialog({
      title: "Export CSV",
      body: `<p class="t-body-m">Choose how you want to export your meal ledger CSV.</p>
        <p class="t-label-m c-muted">Your browser decides where the file is saved; use its download settings to pick a folder.</p>`,
      actions: [{ label: "Cancel", value: false, variant: "text" }, { label: "Quick Save", value: "save", variant: "filled" }],
    });
    if (choice === "save") downloadCsv(entries);
  });

  const unsub = [collection("ledger").onChange(() => alive && refresh()), collection("meals").onChange(() => alive && refresh())];
  el.innerHTML = screen({ bar: topBar({ title: "Budget Analysis", actions: linkIcon("#/budget/ledger", "table_view", "Open ledger and CSV") }), body: loading("Loading budget...") });
  await refresh();
  return () => { alive = false; unsub.forEach((f) => f && f()); };
}

const PALETTE = ["var(--primary)", "var(--tertiary)", "var(--secondary)", "var(--error)", "var(--primary-container)", "var(--tertiary-container)"];

/** CalorieProgressUtils.evaluate: Low / On track / Over target. */
function calorieProgress(consumed, target) {
  if (target <= 0) return { progress: 0, label: "No target", color: "var(--status-neutral, var(--outline))" };
  const ratio = Math.max(0, consumed / target);
  const progress = Math.min(ratio, 1.2);
  if (ratio < 0.7) return { progress, label: "Low", color: "var(--status-info, var(--secondary))" };
  if (ratio <= 1) return { progress, label: "On track", color: "var(--status-good, var(--primary))" };
  return { progress, label: "Over target", color: "var(--status-bad, var(--error))" };
}

function progressRing(p, label, value) {
  const R = 40, C = 2 * Math.PI * R;
  const frac = Math.min(p.progress, 1);
  return `<div class="budget-ring" role="img" aria-label="${esc(`${value} ${label}, ${p.label}`)}">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="${R}" class="budget-ring__track"/>
      <circle cx="50" cy="50" r="${R}" class="budget-ring__bar" style="stroke:${p.color}" stroke-dasharray="${(frac * C).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 50 50)"/>
    </svg>
    <div class="budget-ring__centre"><span class="t-title-s w-bold">${esc(value)}</span><span class="t-label-s c-muted">${esc(label)}</span></div>
  </div>`;
}

function donutSvg(slices, total) {
  const R = 50, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = slices.map((s, i) => {
    const len = (s.spend / total) * C;
    const el = `<circle cx="60" cy="60" r="${R}" fill="none" style="stroke:${PALETTE[i % PALETTE.length]}" stroke-width="18" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"/>`;
    off += len;
    return el;
  }).join("");
  return `<div class="budget-donut" role="img" aria-label="Spend by meal, ${Math.round(total)} rupees">
    <svg viewBox="0 0 120 120" aria-hidden="true">${arcs}</svg>
    <div class="budget-donut__centre"><span class="t-title-s w-bold">Rs ${Math.round(total)}</span><span class="t-label-s c-muted">month</span></div>
  </div>`;
}

/** Bar or line chart as inline SVG. Each column is a tap target (data-pt). */
function chartSvg({ pts, sel, value, kind, color, target, fmtTick, which }) {
  const W = 320, H = 176, L = 42, R = 8, T = 10, B = 22;
  const n = pts.length;
  const vals = pts.map(value);
  const top = Math.max(100, ...vals, target || 0);
  const max = top * 1.1;
  const band = (W - L - R) / n;
  const cx = (i) => L + band * (i + 0.5);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const baseY = H - B;
  const ticks = [0, top / 2, top];
  const showLabel = (i) => n <= 12 || i % 5 === 0 || i === n - 1;

  const grid = ticks.map((t) => `<line class="budget-grid" x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>
    <text class="budget-tick" x="${L - 6}" y="${(y(t) + 3).toFixed(1)}" text-anchor="end">${esc(fmtTick(t))}</text>`).join("");

  let body;
  if (kind === "line") {
    const xy = pts.map((_, i) => [cx(i), y(vals[i])]);
    const d = xy.map(([x, yy], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${yy.toFixed(1)}`).join(" ");
    const area = `${d} L${xy[n - 1][0].toFixed(1)} ${baseY} L${xy[0][0].toFixed(1)} ${baseY} Z`;
    body = `<path class="budget-area" style="fill:${color}" d="${area}"/>
      <path class="budget-line" style="stroke:${color}" d="${d}"/>
      ${xy.map(([x, yy], i) => `<circle class="budget-dot${i === sel ? " is-sel" : ""}" style="fill:${color}" cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="${i === sel ? 5 : 3}"/>`).join("")}`;
  } else {
    const w = Math.max(2, Math.min(18, band * 0.66));
    body = pts.map((_, i) => {
      const v = vals[i];
      const h = Math.max(0, baseY - y(v));
      return `<rect class="budget-bar${i === sel ? " is-sel" : ""}" style="fill:${color}" x="${(cx(i) - w / 2).toFixed(1)}" y="${(baseY - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="3"/>`;
    }).join("");
  }
  const tgt = target ? `<line class="budget-target" x1="${L}" x2="${W - R}" y1="${y(target).toFixed(1)}" y2="${y(target).toFixed(1)}"/>
    <text class="budget-tick budget-tick--target" x="${W - R}" y="${(y(target) - 4).toFixed(1)}" text-anchor="end">Target</text>` : "";
  const labels = pts.map((p, i) => (showLabel(i) ? `<text class="budget-tick" x="${cx(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(p.label)}</text>` : "")).join("");
  const hits = pts.map((p, i) => `<rect class="budget-hit" data-pt="${i}" x="${(L + band * i).toFixed(1)}" y="${T}" width="${band.toFixed(1)}" height="${(H - T - B).toFixed(1)}" fill="transparent"><title>${esc(p.descriptor)}: ${esc(fmtTick(vals[i]))}</title></rect>`).join("");
  return `<svg class="budget-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${which === "kcal" ? "Calories" : "Spend"} chart">
    ${grid}${tgt}${body}${labels}${hits}</svg>`;
}

function downloadCsv(entries) {
  const blob = new Blob([entriesCsv(entries)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `FoodBudget_${Date.now()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  snackbar(`Exported ${entries.length} entries as CSV`);
}

/* ════════════════════════════════════════════════════════════════════
 * Budget Ledger
 * ════════════════════════════════════════════════════════════════════ */
export async function renderLedger(el) {
  let entries = [];
  let alive = true;

  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const paint = () => {
    const now = new Date();
    const target = calorieTarget();
    const today = entries.filter((e) => e.dateMillis >= dayStart(now) && e.dateMillis < dayStart(now) + 86400000);
    const totalToday = today.reduce((s, e) => s + (+e.cost || 0), 0);
    const totalAll = entries.reduce((s, e) => s + (+e.cost || 0), 0);
    const kcalToday = today.reduce((s, e) => s + (+e.kcal || 0) * Math.max(1, +e.quantity || 1), 0);

    const rows = entries.map((r) => ledgerRow(r)).join("");
    el.innerHTML = screen({
      bar: topBar({ title: "Budget Ledger", actions: `<button class="icon-btn" type="button" data-act="preview" aria-label="Preview CSV" title="Preview CSV">${icon("table_view")}</button>` }),
      fab: `<button class="fab fab--extended" type="button" data-act="add" aria-label="Add entry">${icon("add")}<span>Add entry</span></button>`,
      body: `
        ${card(`
          <h2 class="t-title-m w-semi">Ledger Summary</h2>
          <div class="budget-ledger-sum">
            <span>Today: ${esc(rs(totalToday))}</span><span>Total: ${esc(rs(totalAll))}</span>
            <span>Today kcal: ${Math.round(kcalToday)}</span><span>Target: ${target}</span>
          </div>
          <p class="t-label-s c-muted">Protein, carbs and fat are not shown on the web (no nutrition table here).</p>`,
          { tone: "secondary", prism: false, cls: "budget-card budget-card--sum" })}
        ${entries.length ? `<div class="budget-rows">${rows}</div>` : emptyState({
          icon: "table_chart", title: "Nothing in the ledger yet",
          body: "Add an entry with the button below, or rebuild the mess rows from Budget Sync.",
        })}
        <div class="mess-bottom-gap"></div>`,
    });
  };

  const ledgerRow = (r) => {
    const q = Math.max(1, +r.quantity || 1);
    return `<article class="budget-row card card--high">
      <div class="budget-row__head">
        <div class="budget-row__titles">
          <span class="t-title-s w-semi">${esc(r.mealType)}  |  ${esc(r.itemName)}</span>
          ${r.source === "mess" ? `<span class="t-label-s c-muted">From mess transactions</span>` : ""}
        </div>
        <button class="icon-btn" type="button" data-act="edit" data-id="${esc(r.id)}" data-store="${esc(r.store)}" aria-label="Edit row">${icon("edit")}</button>
        <button class="icon-btn" type="button" data-act="delete" data-id="${esc(r.id)}" data-store="${esc(r.store)}" aria-label="Delete row">${icon("delete")}</button>
      </div>
      <p class="t-body-s">Date: ${esc(dateText(r.dateMillis))}</p>
      <p class="t-body-s">Quantity: ${q} × ${esc(rs(r.unitPrice))} = ${esc(rs(r.cost))}</p>
      <p class="t-body-s">Calories: ${r.kcal != null && r.kcal !== "" ? Math.round(+r.kcal * q) : "Unknown"}</p>
      ${r.description ? `<p class="t-body-s">Notes: ${esc(r.description)}</p>` : ""}
    </article>`;
  };

  /* ── add / edit (EditLedgerRowDialog) ── */
  /* Add (row = null) or edit one row. The form is read in validate, before the dialog closes. */
  const openEditor = async (row) => {
    let saved = null;
    await dialog({
      title: row ? "Edit Ledger Row" : "Add Ledger Row",
      body: formHtml(row),
      actions: [{ label: "Cancel", value: null, variant: "text" }, { label: "Save", value: "save", variant: "filled", primary: true }],
      onMount: (d) => {
        const upd = () => {
          const f = readForm(d);
          const total = f.quantity > 0 && !isNaN(f.unitPrice) ? f.quantity * f.unitPrice : null;
          d.querySelector("#b-total").textContent = total == null ? "" : `Total Cost: Rs ${total.toFixed(2)}`;
        };
        d.addEventListener("input", upd);
        upd();
      },
      validate: (v, d) => {
        const msg = validateForm(readForm(d));
        const err = d.querySelector("#b-err");
        if (msg) { err.textContent = msg; err.hidden = false; return false; }
        saved = readForm(d);
        return true;
      },
    });
    if (!saved) return;
    const base = row ? { ...row } : { id: undefined, dateMillis: Date.now() };
    const [y, m, dd] = saved.dateStr.split("-").map(Number);
    const old = new Date(base.dateMillis);
    const sameDay = old.getFullYear() === y && old.getMonth() === m - 1 && old.getDate() === dd;
    const when = sameDay ? base.dateMillis : new Date(y, m - 1, dd, old.getHours(), old.getMinutes()).getTime();
    const quantity = saved.quantity;
    const unitPrice = saved.unitPrice;
    await saveEntry({
      ...(row ? { id: row.id, store: row.store, source: row.source } : {}),
      dateMillis: when,
      mealType: saved.mealType,
      itemName: saved.itemName,
      quantity,
      unitPrice,
      cost: quantity * unitPrice,
      kcal: saved.kcal,
      description: saved.description,
    });
    snackbar(row ? "Entry updated" : "Entry added");
  };

  function formHtml(r) {
    const x = r || { dateMillis: Date.now(), mealType: "Lunch", itemName: "", quantity: 1, unitPrice: "", kcal: "", description: "" };
    const d0 = new Date(x.dateMillis);
    const dateVal = `${d0.getFullYear()}-${pad2(d0.getMonth() + 1)}-${pad2(d0.getDate())}`;
    return `<div class="budget-form">
      <label class="budget-field"><span>Meal Type</span><input id="b-meal" list="b-meals" type="text" value="${esc(x.mealType)}" autocomplete="off"></label>
      <datalist id="b-meals">${MEAL_ORDER.map((m) => `<option value="${m}"></option>`).join("")}</datalist>
      <label class="budget-field"><span>Item Name</span><input id="b-item" type="text" value="${esc(x.itemName)}" autocomplete="off"></label>
      <div class="budget-two">
        <label class="budget-field"><span>Date</span><input id="b-date" type="date" value="${dateVal}"></label>
        <label class="budget-field"><span>Quantity</span><input id="b-qty" type="text" inputmode="numeric" value="${esc(x.quantity)}" autocomplete="off"></label>
      </div>
      <label class="budget-field"><span>Unit Price</span><input id="b-price" type="text" inputmode="decimal" value="${esc(x.unitPrice)}" autocomplete="off"></label>
      <p class="t-body-s c-primary" id="b-total"></p>
      <label class="budget-field"><span>Calories (kcal per serving)</span><input id="b-kcal" type="text" inputmode="decimal" value="${esc(x.kcal ?? "")}" autocomplete="off"></label>
      <label class="budget-field"><span>Description</span><input id="b-desc" type="text" value="${esc(x.description || "")}" autocomplete="off"></label>
      <p class="t-body-s c-error" id="b-err" hidden></p>
    </div>`;
  }
  function readForm(d) {
    const k = d.querySelector("#b-kcal").value.trim();
    return {
      mealType: d.querySelector("#b-meal").value.trim(),
      itemName: d.querySelector("#b-item").value.trim(),
      dateStr: d.querySelector("#b-date").value,
      quantity: parseInt(d.querySelector("#b-qty").value, 10),
      unitPrice: parseFloat(d.querySelector("#b-price").value),
      kcal: k === "" ? null : parseFloat(k),
      description: d.querySelector("#b-desc").value.trim(),
    };
  }
  function validateForm(f) {
    if (!f.mealType) return "Enter a meal type.";
    if (!f.itemName) return "Enter an item name.";
    if (!(f.quantity >= 1)) return "Quantity must be a whole number, 1 or more.";
    if (isNaN(f.unitPrice) || f.unitPrice < 0) return "Enter a unit price.";
    if (f.kcal != null && (isNaN(f.kcal) || f.kcal < 0)) return "Calories must be a number.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.dateStr)) return "Pick a date.";
    return "";
  }

  on(el, "click", "[data-act=add]", () => openEditor(null));
  on(el, "click", "[data-act=edit]", (e, b) => {
    const row = entries.find((r) => r.id === b.dataset.id);
    if (row) openEditor(row);
  });
  on(el, "click", "[data-act=delete]", async (e, b) => {
    const row = entries.find((r) => r.id === b.dataset.id);
    if (!row) return;
    await deleteEntry(row);
    snackbar("Entry deleted");
  });
  on(el, "click", "[data-act=preview]", () => {
    dialog({
      title: "CSV Preview",
      body: `<pre class="budget-csv">${esc(entriesCsv(entries))}</pre>`,
      actions: [{ label: "Close", value: true, variant: "text" }],
      wide: true,
    });
  });

  const refresh = async () => {
    entries = await loadEntries();
    if (!alive) return;
    paint();
  };
  const unsub = [collection("ledger").onChange(() => alive && refresh()), collection("meals").onChange(() => alive && refresh())];
  el.innerHTML = screen({ bar: topBar({ title: "Budget Ledger" }), body: loading("Loading ledger...") });
  await refresh();
  return () => { alive = false; unsub.forEach((f) => f && f()); };
}

/* ════════════════════════════════════════════════════════════════════
 * Budget Cloud Sync (retired on Android; the mess import is the web's version)
 * ════════════════════════════════════════════════════════════════════ */
export async function renderSync(el) {
  let sample = false, failed = null, busy = false;
  let alive = true;

  const lastLine = () => {
    const at = lastSyncAt();
    return at ? `Last synced ${timeOf(new Date(at))}, ${longDate(new Date(at))}` : "Not synced in this browser yet.";
  };

  const paint = () => {
    el.innerHTML = screen({
      bar: topBar({ title: "Budget Cloud Sync" }),
      body: `
        ${sample ? sampleBanner("the canteen ERP") : ""}
        ${card(`
          <h2 class="t-title-m w-semi">Google Sheets sync has been retired.</h2>
          <p class="t-body-m">Budget data export is still available via CSV from the Analysis and Ledger screens.</p>
          <a class="btn btn--filled" href="#/budget">${icon("arrow_back", { size: 18 })}<span>Back to Budget</span></a>`,
          { tone: "medium", prism: false, cls: "budget-card" })}
        ${card(`
          <h2 class="t-title-m w-semi">Sync from mess transactions</h2>
          <p class="t-body-m">Rebuilds the mess rows of your budget from the mess transactions in this browser. Each canteen debit is split into its dishes, dated and tagged with the meal it was served at. Rows you typed in by hand are kept.</p>
          <p class="t-label-m c-muted" id="sync-last">${esc(lastLine())}</p>
          ${failed ? `<p class="t-body-s c-error">${esc(failed)}</p>` : ""}
          <button class="btn btn--tonal" type="button" data-act="sync-now"${busy ? " disabled" : ""}>${icon("sync", { size: 18 })}<span>Sync now</span></button>`,
          { tone: "high", prism: false, cls: "budget-card" })}
        ${browserNote({
          title: "Where the transactions come from",
          body: "This browser cannot log in to the canteen ERP. Without a saved copy of your transactions, the sync uses the sample history, and the rows it creates are made up.",
          icon: "info", tone: "info",
        })}`,
    });
  };

  const run = async () => {
    if (busy) return;
    busy = true; failed = null; paint();
    try {
      const t = await loadTransactions();
      sample = !!t.sample;
      const r = await syncFromMess(t.data.transactions);
      snackbar(`Rebuilt the budget from ${r.transactions} transactions (${r.items} items)`);
    } catch (e) {
      failed = `Sync failed: ${e && e.message ? e.message : e}`;
    } finally {
      busy = false;
      if (alive) paint();
    }
  };

  on(el, "click", "[data-act=sync-now]", () => run());
  el.innerHTML = screen({ bar: topBar({ title: "Budget Cloud Sync" }), body: loading("Loading...") });
  try {
    const t = await loadTransactions();
    sample = !!t.sample;
  } catch {}
  if (!alive) return;
  paint();
  return () => { alive = false; };
}
