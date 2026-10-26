/**
 * data/mess.data.js — mess transactions and the mess menu, in the shapes the
 * screens use, plus the serving windows (data/repository/MealSchedule.kt) and
 * the transaction rules the Mess Transactions screen applies (filter, item
 * pricing, weekday pattern, item vocabulary).
 *
 * Transaction model:
 *   { id, at (epoch ms), items: [{ name, qty, price }], total, type: "Debited"|"Credited",
 *     added, mode, balance, remarks }
 * Menu model:
 *   { title, days: [{ weekday: 1..7 (Mon=1), meals: [{ type, items: ["Rice", "★ Paneer"] }] }] }
 *
 * The sample files carry relative times (daysAgo / weekday) so the samples
 * always look current.
 */

import { load } from "../services/source.js";
import { fetchTransactions, fetchMenu, parseItems } from "../services/canteen.service.js";

/* ── transactions ── */
function fromSample(s) {
  const now = new Date();
  return {
    account: s.account,
    transactions: s.transactions.map((t, i) => {
      const [h, m] = (t.time || "12:00").split(":").map(Number);
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (t.daysAgo || 0), h, m).getTime();
      return { id: "s" + i, at, items: (t.items || []).map(([name, qty, price]) => ({ name, qty, price })), total: t.total, type: t.type,
        added: t.added || 0, mode: t.mode || "", balance: t.balance, remarks: t.remarks || "" };
    }).sort((a, b) => b.at - a.at),
  };
}
function fromLive(rows) {
  const parseAt = (raw) => {
    const m = /(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : Date.parse(raw) || 0;
  };
  return {
    account: null,
    transactions: rows.map((t, i) => ({
      id: "l" + i, at: parseAt(t.dateTime),
      items: parseItems(t.foodItems).map(([name, qty, price]) => ({ name, qty, price })),
      total: +t.totalCost || 0, type: /credit/i.test(t.type) ? "Credited" : "Debited",
      added: parseFloat(t.balanceAdded) || 0, mode: t.modeOfTran || "", balance: +t.balance || 0, remarks: t.remarks || "",
    })).sort((a, b) => b.at - a.at),
  };
}
export async function loadTransactions({ full = false } = {}) {
  const r = await load("mess", async () => fromLive(await fetchTransactions(full)));
  if (r.sample) r.data = fromSample(r.data);
  return r;
}
export const latestBalance = (tx) => (tx.length ? tx[0].balance : null);

/* ── menu ── */
export async function loadMenu() {
  const r = await load("menu", async () => {
    const today = await fetchMenu();
    const wd = ((new Date().getDay() + 6) % 7) + 1;
    return { title: today.title, days: [{ weekday: wd, meals: today.meals }], liveTodayOnly: true };
  }, { maxAgeMs: 60 * 60000 });
  return r;
}

/* ── MealSchedule ── */
export const MEALS = ["Breakfast", "Lunch", "Snacks", "Dinner"];
export function servings(isWeekend) {
  const at = (h, m = 0) => h * 60 + m;
  return [
    { meal: "Breakfast", start: at(7, 30), end: at(10) },
    { meal: "Lunch", start: at(12), end: at(14) },
    isWeekend ? { meal: "Snacks", start: at(17), end: at(18) } : { meal: "Snacks", start: at(16, 45), end: at(18, 30) },
    { meal: "Dinner", start: at(20), end: at(22) },
  ];
}
export const mealMatches = (label, meal) => {
  const a = String(label).trim().toLowerCase(), b = String(meal).trim().toLowerCase();
  return !!a && !!b && (a.includes(b) || b.includes(a));
};
/** "7:30 – 10:00 AM" (MealSchedule.label) */
export function servingLabel(meal, isWeekend) {
  const s = servings(isWeekend).find((x) => mealMatches(meal, x.meal));
  if (!s) return "";
  const clock = (m) => { const h = Math.floor(m / 60), mm = m % 60; return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")}`; };
  const suf = (m) => (m < 720 ? "AM" : "PM");
  return suf(s.start) === suf(s.end) ? `${clock(s.start)} – ${clock(s.end)} ${suf(s.end)}` : `${clock(s.start)} ${suf(s.start)} – ${clock(s.end)} ${suf(s.end)}`;
}
/** MealSchedule.currentOrNext */
export function currentOrNextMeal(date, todayMeals, tomorrowMeals = todayMeals) {
  if (!todayMeals.length) return null;
  const minute = date.getHours() * 60 + date.getMinutes();
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const day = servings(weekend);
  const onMenu = (meal) => todayMeals.some((l) => mealMatches(l, meal));
  const now = day.find((s) => minute >= s.start && minute < s.end && onMenu(s.meal));
  if (now) return { meal: now.meal, servingNow: true, tomorrow: false };
  const later = day.filter((s) => s.start > minute).find((s) => onMenu(s.meal));
  if (later) return { meal: later.meal, servingNow: false, tomorrow: false };
  const next = (tomorrowMeals.length ? tomorrowMeals : todayMeals);
  const first = day.find((s) => next.some((l) => mealMatches(l, s.meal)));
  return first ? { meal: first.meal, servingNow: false, tomorrow: true } : null;
}
/** The menu day for a date (weekday 1..7, Mon = 1), or null. */
export const menuDayFor = (menu, date) => (menu.days || []).find((d) => d.weekday === ((date.getDay() + 6) % 7) + 1) || null;
export const isSpecial = (item) => String(item).startsWith("★");
export const itemName = (item) => String(item).replace(/^★\s*/, "");

/* ── money (MessTransactionFilter.amountOf, MessTransactionsViewModel.totalDebited/totalCredited) ── */
export const isCredit = (t) => /credit/i.test(t.type);
export const amountOf = (t) => (isCredit(t) ? (t.added || t.total || 0) : (t.total || 0));
export const totalDebited = (tx) => tx.filter((t) => !isCredit(t)).reduce((s, t) => s + amountOf(t), 0);
export const totalCredited = (tx) => tx.filter(isCredit).reduce((s, t) => s + amountOf(t), 0);

/** The meal a debit falls in, by the hour it was made (MessErpTime.mealTypeFor). */
export function mealOf(t) {
  if (isCredit(t)) return null;
  const h = new Date(t.at).getHours();
  return h < 10 ? "Breakfast" : h < 15 ? "Lunch" : h < 18 ? "Snacks" : "Dinner";
}

/* ── item pricing (MessItemPricing.priceItems) ──────────────────────
 * The ERP gives "name:qty:value" per item; the value is a unit price or a
 * line total depending on the day. The total of the bill decides which. */
const PRICE_TOLERANCE = 0.51;
function valueMeaning(items, total) {
  if (!items.length || !(total > 0)) return "UNKNOWN";
  if (items.every((i) => i.qty === 1)) return "AMBIGUOUS";
  const asUnit = items.reduce((s, i) => s + i.qty * i.price, 0);
  const asLine = items.reduce((s, i) => s + i.price, 0);
  const unitOff = Math.abs(asUnit - total), lineOff = Math.abs(asLine - total);
  const unitFits = unitOff <= PRICE_TOLERANCE, lineFits = lineOff <= PRICE_TOLERANCE;
  if (unitFits && !lineFits) return "UNIT";
  if (lineFits && !unitFits) return "LINE";
  if (unitFits && lineFits) return "AMBIGUOUS";
  return unitOff < lineOff ? "UNIT" : lineOff < unitOff ? "LINE" : "UNKNOWN";
}
/** [{ name, quantity, unitPrice, lineTotal }] for one transaction. */
export function pricedItems(t) {
  const items = t.items || [];
  if (!items.length) return [];
  const line = valueMeaning(items, t.total) === "LINE";
  return items.map((i) => {
    const qty = i.qty || 1;
    return line
      ? { name: i.name, quantity: qty, unitPrice: i.price / qty, lineTotal: i.price }
      : { name: i.name, quantity: qty, unitPrice: i.price, lineTotal: i.price * qty };
  });
}

/** Top items by spend over debits (MessTransactionsViewModel.aggregateItemSpend). */
export function aggregateItemSpend(tx) {
  const m = new Map();
  for (const t of tx) {
    if (isCredit(t)) continue;
    for (const p of pricedItems(t)) {
      const c = m.get(p.name) || { name: p.name, quantity: 0, totalSpend: 0 };
      c.quantity += p.quantity; c.totalSpend += p.lineTotal;
      m.set(p.name, c);
    }
  }
  return [...m.values()].sort((a, b) => b.totalSpend - a.totalSpend);
}
/** Spend by weekday, Mon first (MessTransactionsViewModel.aggregateWeekdaySpend). */
export function aggregateWeekdaySpend(tx) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const totals = days.map(() => 0), counts = days.map(() => 0);
  for (const t of tx) {
    if (isCredit(t)) continue;
    const idx = (new Date(t.at).getDay() + 6) % 7;
    totals[idx] += t.total || 0; counts[idx] += 1;
  }
  return days.map((dayLabel, i) => ({ dayLabel, txnCount: counts[i], totalSpend: totals[i] }));
}
/** Latest unit price seen per item name in this browser's own transactions. */
export function ownUnitPrices(tx) {
  const m = new Map();
  for (const t of [...tx].sort((a, b) => b.at - a.at)) {
    if (isCredit(t)) continue;
    for (const p of pricedItems(t)) {
      const k = p.name.toLowerCase();
      if (!m.has(k)) m.set(k, p.unitPrice);
    }
  }
  return m;
}

/* ── item vocabulary (MessItemVocabulary) ── */
export function itemVocabulary(tx) {
  const seen = new Map();
  for (const t of tx) for (const i of t.items || []) {
    const k = i.name.toLowerCase();
    const cur = seen.get(k);
    seen.set(k, cur ? { n: cur.n + 1, name: cur.name } : { n: 1, name: i.name });
  }
  return [...seen.values()]
    .sort((a, b) => b.n - a.n || a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    .slice(0, 40).map((x) => x.name);
}
export function suggestItems(vocab, typed) {
  const needle = String(typed || "").trim().toLowerCase();
  if (!needle) return vocab;
  return vocab.filter((v) => v.toLowerCase().includes(needle));
}

/* ── filter (MessTransactionFilter) ── */
export const FILTER_MEALS = ["Breakfast", "Lunch", "Snacks", "Dinner"];
export const FILTER_PAYMENTS = ["Card", "Cash", "Other"];
export const FILTER_PERIODS = {
  ALL: "All time", TODAY: "Today", LAST_7_DAYS: "Last 7 days", LAST_30_DAYS: "Last 30 days",
  THIS_MONTH: "This month", CUSTOM: "Choose dates",
};
export const EMPTY_FILTER = Object.freeze({ meal: null, payment: null, period: "ALL", from: "", to: "", minAmount: "", maxAmount: "", search: "" });

const blank = (s) => !String(s ?? "").trim();
export const filterActive = (f) => !!(f.meal || f.payment || f.period !== "ALL" || !blank(f.from) || !blank(f.to)
  || !blank(f.minAmount) || !blank(f.maxAmount) || !blank(f.search));
export function filterCount(f) {
  return [!!f.meal, !!f.payment, f.period !== "ALL", !blank(f.from) || !blank(f.to),
    !blank(f.minAmount) || !blank(f.maxAmount), !blank(f.search)].filter(Boolean).length;
}
const paymentOf = (t) => {
  const m = String(t.mode || "").trim().toLowerCase();
  return m === "card" ? "Card" : m === "cash" ? "Cash" : "Other";
};
const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const dayEnd = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
/** "yyyy-mm-dd" → start or end of that local day, or null when not a real date. */
function parseDay(s, end) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (d.getFullYear() !== +m[1] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null;
  return end ? dayEnd(d) : dayStart(d);
}
const amountNum = (s) => { const n = parseFloat(String(s ?? "").trim()); return Number.isNaN(n) ? null : n; };

/** Reason the filter cannot be applied, or null (MessTransactionFilter.problem). */
export function filterProblem(f) {
  const lo = amountNum(f.minAmount), hi = amountNum(f.maxAmount);
  if (lo != null && hi != null && lo > hi) return "Minimum is above the maximum";
  if (f.period === "CUSTOM" && !blank(f.from) && !blank(f.to)) {
    const a = parseDay(f.from, false), b = parseDay(f.to, true);
    if (a != null && b != null && a > b) return "The start date is after the end date";
  }
  return null;
}

/** The transactions that pass the filter (MessTransactionFilter.apply). */
export function applyFilter(tx, f, now = Date.now()) {
  if (!filterActive(f)) return tx;
  if (filterProblem(f)) return [];
  const min = amountNum(f.minAmount), max = amountNum(f.maxAmount);
  const search = String(f.search || "").trim().toLowerCase();
  const today = new Date(now);
  let from = null, to = null;
  switch (f.period) {
    case "TODAY": from = dayStart(today); to = dayEnd(today); break;
    case "LAST_7_DAYS": from = dayStart(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6)); to = dayEnd(today); break;
    case "LAST_30_DAYS": from = dayStart(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29)); to = dayEnd(today); break;
    case "THIS_MONTH": from = new Date(today.getFullYear(), today.getMonth(), 1).getTime(); to = dayEnd(today); break;
    case "CUSTOM":
      from = blank(f.from) ? null : parseDay(f.from, false);
      to = blank(f.to) ? null : parseDay(f.to, true);
      break;
    default: break;
  }
  return tx.filter((t) => {
    if (f.meal && mealOf(t) !== f.meal) return false;
    if (f.payment && (!isCredit(t) || paymentOf(t) !== f.payment)) return false;
    if (from != null && t.at < from) return false;
    if (to != null && t.at > to) return false;
    const amount = amountOf(t);
    if (min != null && amount < min) return false;
    if (max != null && amount > max) return false;
    if (search) {
      const items = (t.items || []).map((i) => `${i.name}:${i.qty}:${i.price}`).join("|");
      if (!`${items} ${t.remarks || ""}`.toLowerCase().includes(search)) return false;
    }
    return true;
  });
}

/** "Lunch · Card top-up · Last 7 days" (MessTransactionFilter.describe). */
export function describeFilter(f) {
  if (!filterActive(f)) return "";
  const parts = [];
  if (f.meal) parts.push(f.meal);
  if (f.payment) parts.push(`${f.payment} top-up`);
  if (f.period === "CUSTOM") {
    const a = String(f.from || "").trim(), b = String(f.to || "").trim();
    parts.push(a && b ? `${a} to ${b}` : a ? `from ${a}` : `until ${b}`);
  } else if (f.period !== "ALL") parts.push(FILTER_PERIODS[f.period]);
  const lo = String(f.minAmount || "").trim(), hi = String(f.maxAmount || "").trim();
  if (lo || hi) parts.push(lo && hi ? `₹${lo}–₹${hi}` : lo ? `at least ₹${lo}` : `at most ₹${hi}`);
  if (!blank(f.search)) parts.push(`"${String(f.search).trim()}"`);
  return parts.filter((x) => !blank(x)).join(" · ");
}

/** "21-03-2026 08:12" style date from epoch ms (MessTransactionsViewModel.formatDateTime). */
export function formatAt(ms) {
  const d = new Date(ms), p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
/** ERP-style "yyyy:MM:dd HH:mm:ss" (the export format). */
export function erpStamp(ms) {
  const d = new Date(ms), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
/** Mess CSV, same header as the Android export. */
export function transactionsCsv(tx) {
  const esc = (s) => (/[",\n]/.test(String(s ?? "")) ? `"${String(s).replace(/"/g, '""')}"` : String(s ?? ""));
  const rows = tx.map((t) => [
    erpStamp(t.at),
    t.items.map((i) => `${i.name}:${i.qty}:${i.price}`).join("|"),
    t.total, t.type, isCredit(t) ? t.added : "", t.mode, t.balance, t.remarks,
  ].map(esc).join(","));
  return ["Date Time,Food Items,Total Cost,Type,Balance Added,Mode,Balance,Remarks", ...rows].join("\n");
}

/** Drops this browser's saved copy of the transactions so the next load goes back to the ERP. */
export function forgetCachedTransactions() {
  try { localStorage.removeItem("iiserk-cache.mess"); } catch {}
}
