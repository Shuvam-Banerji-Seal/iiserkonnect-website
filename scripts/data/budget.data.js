/**
 * data/budget.data.js — the Budget: everything stays in this browser.
 *
 * Two stores hold the rows, both in IndexedDB (core/db.js):
 *   "ledger" — rows the user types in (Budget Ledger → Add entry, Edit).
 *   "meals"  — rows rebuilt from mess transactions by Budget Sync (source "mess").
 * The Android app keeps both in one table; the split lets a sync replace the
 * imported rows without touching what the user typed.
 *
 * Entry shape: { id, dateMillis, mealType, itemName, quantity, unitPrice, cost,
 *                kcal (per serving, or null), description, source }
 * Goals live in prefs under "budget.*".
 *
 * PRICE-CATALOGUE STUB: the app also fills item prices and calories from its
 * canteen price catalogue (BudgetViewModel.knownPrice / knownCalories, the
 * nutrition table in MessNutrition). Neither is available in the browser, so
 * calories are only what the user types, and prices are what was typed or
 * came from the ERP transactions.
 */

import { collection } from "../core/db.js";
import { prefs } from "../core/prefs.js";
import { allocateItemCosts } from "../services/canteen.service.js";
import { isCredit, pricedItems, mealOf } from "./mess.data.js";

export const DEFAULT_CALORIE_TARGET = 2000;
/** Target range that counts as "on target" (BudgetStats.TARGET_TOLERANCE). */
export const TARGET_TOLERANCE = 0.15;
const MEAL_ORDER = ["Breakfast", "Lunch", "Snacks", "Dinner"];
const MAX_MONTHS = 96;

export const calorieTarget = () => {
  const v = Math.round(+prefs.get("budget.calorieTarget"));
  return v > 0 ? v : DEFAULT_CALORIE_TARGET;
};
export const setCalorieTarget = (n) => prefs.set("budget.calorieTarget", Math.max(1, Math.round(+n) || DEFAULT_CALORIE_TARGET));
export const lastSyncAt = () => +prefs.get("budget.lastSync") || 0;

/* ── storage ── */
export async function loadEntries() {
  const [ledger, meals] = await Promise.all([collection("ledger").all(), collection("meals").all()]);
  return [
    ...ledger.map((r) => ({ ...r, store: "ledger" })),
    ...meals.map((r) => ({ ...r, store: "meals" })),
  ].sort((a, b) => b.dateMillis - a.dateMillis);
}

/** Creates or updates a row; the row keeps the store it came from. */
export async function saveEntry(row) {
  const { store, ...rec } = row;
  const target = store === "meals" ? "meals" : "ledger";
  const cost = (+rec.quantity || 1) * (+rec.unitPrice || 0);
  if (target === "meals") return collection("meals").put({ ...rec, cost, source: "mess", edited: true });
  return collection("ledger").put({ ...rec, cost, source: "manual" });
}

export async function deleteEntry(row) {
  return collection(row.store === "meals" ? "meals" : "ledger").remove(row.id);
}

/** Budget Sync: rebuild the mess rows from transactions. Manual rows are kept. */
export async function syncFromMess(transactions) {
  const rows = [];
  let items = 0;
  for (const t of transactions) {
    if (isCredit(t) || !t.items || !t.items.length) continue;
    const priced = pricedItems(t).filter((p) => p.unitPrice > 0);
    if (!priced.length) continue;
    const allocated = allocateItemCosts(priced.map((p) => [p.name, p.quantity, p.unitPrice]), t.total);
    const mealType = mealOf(t);
    allocated.forEach((a, i) => {
      rows.push({
        id: `mess-${t.at}-${i}`,
        dateMillis: t.at,
        mealType,
        itemName: a.name,
        quantity: a.quantity,
        unitPrice: a.unitPrice,
        cost: a.cost,
        kcal: null,
        description: "",
        source: "mess",
      });
      items++;
    });
  }
  // Rows the user edited keep their values: same id → the edited copy wins,
  // and edited rows whose transaction has gone are kept as the user left them.
  const meals = collection("meals");
  const edited = (await meals.all()).filter((r) => r.edited);
  const byId = new Map(edited.map((r) => [r.id, r]));
  const merged = rows.map((r) => byId.get(r.id) || r);
  for (const r of edited) if (!rows.some((x) => x.id === r.id)) merged.push(r);
  await meals.clear();
  if (merged.length) await meals.putAll(merged);
  prefs.set("budget.lastSync", Date.now());
  return { transactions: transactions.length, items };
}

/* ── pure statistics (port of BudgetStats / BudgetViewModel) ── */
const sameMonth = (ms, y, m) => { const d = new Date(ms); return d.getFullYear() === y && d.getMonth() === m; };
const kcalOf = (e) => (+e.kcal || 0) * Math.max(1, +e.quantity || 1);

/** One point per day of the month: { day, date, spend, kcal }. */
export function dailyStats(entries, y, m) {
  const n = new Date(y, m + 1, 0).getDate();
  const out = Array.from({ length: n }, (_, i) => ({ day: i + 1, date: new Date(y, m, i + 1), spend: 0, kcal: 0 }));
  for (const e of entries) {
    if (!sameMonth(e.dateMillis, y, m)) continue;
    const p = out[new Date(e.dateMillis).getDate() - 1];
    p.spend += +e.cost || 0; p.kcal += kcalOf(e);
  }
  return out;
}

/** The last `minMonths` months (more when the history is longer): { year, month, spend, kcal }. */
export function monthlyStats(entries, now = new Date(), minMonths = 8) {
  let count = minMonths;
  const times = entries.map((e) => e.dateMillis).filter((t) => t > 0);
  if (times.length) {
    const first = new Date(Math.min(...times));
    const span = (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth()) + 1;
    count = Math.min(MAX_MONTHS, Math.max(minMonths, span));
  }
  const out = [];
  for (let k = count - 1; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const y = d.getFullYear(), m = d.getMonth();
    let spend = 0, kcal = 0;
    for (const e of entries) if (sameMonth(e.dateMillis, y, m)) { spend += +e.cost || 0; kcal += kcalOf(e); }
    out.push({ year: y, month: m, spend, kcal });
  }
  return out;
}

/** Spend and kcal per meal in one month, known meals first (BudgetStats.byMealType). */
export function byMealType(entries, y, m) {
  const norm = (raw) => MEAL_ORDER.find((x) => x.toLowerCase() === String(raw || "").trim().toLowerCase()) || (String(raw || "").trim() || "Other");
  const map = new Map();
  for (const e of entries) {
    if (!sameMonth(e.dateMillis, y, m)) continue;
    const k = norm(e.mealType);
    const c = map.get(k) || { mealType: k, spend: 0, kcal: 0 };
    c.spend += +e.cost || 0; c.kcal += kcalOf(e);
    map.set(k, c);
  }
  const known = MEAL_ORDER.map((k) => map.get(k) || { mealType: k, spend: 0, kcal: 0 });
  const extra = [...map.keys()].filter((k) => !MEAL_ORDER.includes(k)).sort()
    .map((k) => map.get(k));
  return [...known, ...extra];
}

/** Calorie ledger for a month against a target (BudgetStats.calorieLedger). */
export function calorieLedger(entries, y, m, target) {
  const logged = dailyStats(entries, y, m).filter((d) => d.kcal > 0);
  const pm = m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 };
  const prev = dailyStats(entries, pm.y, pm.m).filter((d) => d.kcal > 0);
  const total = logged.reduce((s, d) => s + d.kcal, 0);
  const average = logged.length ? total / logged.length : 0;
  const prevAverage = prev.length ? prev.reduce((s, d) => s + d.kcal, 0) / prev.length : 0;
  const low = target * (1 - TARGET_TOLERANCE), high = target * (1 + TARGET_TOLERANCE);
  let biggest = null;
  for (const d of logged) if (!biggest || d.kcal > biggest.kcal) biggest = d;
  return {
    target, total, daysLogged: logged.length, daysInMonth: new Date(y, m + 1, 0).getDate(),
    average, trendPercent: prevAverage > 0 ? (average - prevAverage) / prevAverage * 100 : null,
    onTarget: logged.filter((d) => d.kcal >= low && d.kcal <= high).length,
    over: logged.filter((d) => d.kcal > high).length,
    under: logged.filter((d) => d.kcal < low).length,
    biggest, isEmpty: logged.length === 0,
  };
}

/** Spend from the last `days` days including today. */
export function spendLastDays(entries, days, now = Date.now()) {
  const cutoff = now - days * 86400000;
  return entries.filter((e) => e.dateMillis >= cutoff).reduce((s, e) => s + (+e.cost || 0), 0);
}
export function spendOn(entries, date) {
  const s = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return entries.filter((e) => e.dateMillis >= s && e.dateMillis < s + 86400000).reduce((a, e) => a + (+e.cost || 0), 0);
}
export function kcalOn(entries, date) {
  const s = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return entries.filter((e) => e.dateMillis >= s && e.dateMillis < s + 86400000).reduce((a, e) => a + kcalOf(e), 0);
}

/** CSV with the Android export's header. */
export function entriesCsv(entries) {
  const fmt = (ms) => {
    const d = new Date(ms), p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };
  const esc = (s) => (/[",\n]/.test(String(s ?? "")) ? `"${String(s).replace(/"/g, '""')}"` : String(s ?? ""));
  const rows = [...entries].sort((a, b) => a.dateMillis - b.dateMillis).map((e) =>
    [e.id, fmt(e.dateMillis), e.mealType, e.itemName, e.quantity, e.unitPrice, e.cost].map(esc).join(","));
  return ["ID,Date,MealType,ItemName,Quantity,UnitPrice,TotalCost", ...rows].join("\n");
}
