/**
 * data/mess.data.js — mess transactions and the mess menu, in the shapes the
 * screens use, plus the serving windows (data/repository/MealSchedule.kt).
 *
 * Transaction model:
 *   { id, at (epoch ms), items: [{ name, qty, price }], total, type: "Debited"|"Credited",
 *     added, mode, balance, remarks }
 * Menu model:
 *   { days: [{ weekday: 1..7 (Mon=1), meals: [{ type, items: ["Rice", "★ Paneer"] }] }] }
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
  const r = await load(full ? "mess" : "mess", async () => fromLive(await fetchTransactions(full)));
  if (r.sample) r.data = fromSample(r.data);
  return r;
}
export const latestBalance = (tx) => (tx.length ? tx[0].balance : null);

/* ── menu ── */
export async function loadMenu() {
  const r = await load("menu", async () => {
    const today = await fetchMenu();
    const wd = ((new Date().getDay() + 6) % 7) + 1;
    return { days: [{ weekday: wd, meals: today.meals }], liveTodayOnly: true };
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
