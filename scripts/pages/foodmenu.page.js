/**
 * pages/foodmenu.page.js — Mess Menu (ui/foodmenu/FoodMenuScreen.kt).
 *
 * Day chips, meal tabs (All / Breakfast / Lunch / Snacks / Dinner), a search
 * field, and one card per meal with numbered dishes. The meal that is being
 * served now, or is next, is picked automatically and marked; ?meal=Lunch in
 * the address opens that meal's tab (Home's "Next meal" row links there).
 *
 * Not in the browser: the app's recorded menu history (past days and NEW
 * badges), the calorie estimates, catalogue prices and the campus menu-sharing
 * pool. Prices come from the user's own mess transactions when they are loaded.
 */

import { screen, topBar, tabs, textField, card, emptyState, browserNote, sampleBanner, errorCard, loading } from "../ui/components.js";
import { esc, on, ago, longDate } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { confirm, snackbar } from "../ui/overlay.js";
import { haptics } from "../ui/haptics.js";
import { loadMenu, loadTransactions, menuDayFor, currentOrNextMeal, mealMatches, servingLabel, isSpecial, itemName, ownUnitPrices } from "../data/mess.data.js";

const MEAL_TABS = ["All", "Breakfast", "Lunch", "Snacks", "Dinner"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Meal icon and tile colour by meal name (getMealIcon / getMealColor). */
const mealIcon = (type) => {
  const t = String(type).toLowerCase();
  return t.includes("breakfast") ? "breakfast_dining" : t.includes("lunch") ? "lunch_dining"
    : t.includes("snack") ? "cookie" : t.includes("dinner") ? "dinner_dining" : "restaurant";
};
const mealTone = (type) => {
  const t = String(type).toLowerCase();
  return t.includes("breakfast") ? "tertiary" : t.includes("lunch") ? "secondary" : t.includes("snack") ? "variant" : t.includes("dinner") ? "primary" : "variant";
};
/** mealTabIndexFor: exact label first, then a loose match, else All. */
export function mealTabIndexFor(meal) {
  if (!meal || !String(meal).trim()) return 0;
  const m = String(meal).trim().toLowerCase();
  const exact = MEAL_TABS.findIndex((t) => t.toLowerCase() === m);
  if (exact >= 0) return exact;
  const loose = MEAL_TABS.findIndex((t, i) => i > 0 && mealMatches(meal, t));
  return loose >= 0 ? loose : 0;
}
const tabMatches = (tabIdx, type) => tabIdx === 0 || mealMatches(type, MEAL_TABS[tabIdx]);
const money = (p) => `₹${Number.isInteger(p) ? p : p.toFixed(2)}`;

export async function render(el, ctx = {}) {
  const initialMeal = ctx && ctx.query ? ctx.query.meal || null : null;
  let days = [];                 // [{ weekday, meals }] Mon..Sun, as the menu gives them
  let title = "Today's Menu";
  let sample = false, stale = false, cachedAt = null, failed = null;
  let prices = new Map();        // own unit prices by lower-case dish name
  let dayIdx = -1;               // index into days
  let tabIdx = mealTabIndexFor(initialMeal);
  let userPicked = false;
  let query = "";
  let alive = true;

  const todayWeekday = () => ((new Date().getDay() + 6) % 7) + 1;
  const sorted = () => [...days].sort((a, b) => a.weekday - b.weekday);
  const dayAt = (i) => sorted()[i] || null;
  const isToday = (d) => !!d && d.weekday === todayWeekday();

  const pickDefaultDay = () => {
    const i = sorted().findIndex((d) => isToday(d));
    dayIdx = i >= 0 ? i : 0;
  };

  /** The meal being served or next, for today's menu only (MealSchedule.currentOrNext). */
  const servingInfo = (day) => {
    if (!day || !isToday(day)) return null;
    const now = new Date();
    const list = sorted();
    const tomorrow = menuDayFor({ days: list }, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const c = currentOrNextMeal(now, day.meals.map((m) => m.type), tomorrow ? tomorrow.meals.map((m) => m.type) : day.meals.map((m) => m.type));
    return c && !c.tomorrow ? c : null;
  };

  const autoTabFor = (day) => {
    const c = servingInfo(day);
    return c ? mealTabIndexFor(c.meal) : null;
  };

  const headerCard = () => {
    const sub = sample ? "Made-up sample menu" : stale && cachedAt ? `Cached · updated ${ago(cachedAt)}` : "";
    return `<div class="mess-menu-head card card--primary">
      ${icon("restaurant", { size: 32, cls: "mess-menu-head__icon" })}
      <div class="mess-menu-head__text">
        <span class="t-title-m">${esc(title)}</span>
        ${sub ? `<span class="t-body-s">${esc(sub)}</span>` : ""}
      </div>
    </div>`;
  };

  const dayChips = () => {
    const list = sorted();
    return `<div class="chips chips--scroll mess-days" role="group" aria-label="Day">${list.map((d, i) => {
      const today = isToday(d);
      const label = today ? "Today" : DAY_SHORT[d.weekday - 1];
      return `<button type="button" class="chip chip--filter${i === dayIdx ? " chip--selected" : ""}${today ? " mess-day--today" : ""}" aria-pressed="${i === dayIdx}" data-day="${i}">
        ${i === dayIdx ? icon("check", { size: 18 }) : ""}<span${today ? ' style="font-weight:700"' : ""}>${esc(label)}</span></button>`;
    }).join("")}</div>`;
  };

  const selectedHeading = (day) => {
    const isT = isToday(day);
    const label = isT ? longDate(new Date()) : DAY_LONG[day.weekday - 1];
    const chipLabel = isT ? "Today" : sample ? "Sample week" : "Other day";
    return `<div class="mess-day-head">
      <h2 class="t-headline-s mess-day-head__title">${esc(label)}</h2>
      <span class="mess-day-pill ${isT ? "is-today" : ""}">${esc(chipLabel)}</span>
    </div>`;
  };

  const mealTabsHtml = () => tabs(MEAL_TABS.map((t, i) => ({ id: String(i), label: t })), String(tabIdx), { scroll: true, a: { "data-tabs": "meal" } });

  const listHtml = (day) => {
    const meals = (day ? day.meals : []).filter((m) => tabMatches(tabIdx, m.type) && (!query.trim()
      || m.type.toLowerCase().includes(query.trim().toLowerCase())
      || m.items.some((i) => i.toLowerCase().includes(query.trim().toLowerCase()))));
    if (!meals.length) return card(`<p class="t-body-m c-muted">No menu items match your current filter.</p>`, { tone: "low", prism: false });
    const serving = servingInfo(day);
    const q = query.trim().toLowerCase();
    return meals.map((meal) => {
      const timeLabel = servingLabel(meal.type, isWeekendDay(day));
      const now = serving && mealMatches(serving.meal, meal.type);
      const visible = q ? meal.items.filter((i) => i.toLowerCase().includes(q)) : meal.items;
      const pill = now ? `<span class="mess-meal-pill${serving.servingNow ? " is-now" : ""}">${serving.servingNow ? "Serving now" : "Next"}</span>` : "";
      return `<section class="mess-meal${now ? " is-highlight" : ""}" aria-label="${esc(meal.type)}">
        <div class="mess-meal__head">
          <h2 class="t-title-s c-primary w-bold">${esc(meal.type)}</h2>
          ${timeLabel ? `<span class="t-label-m c-muted">${esc(timeLabel)}</span>` : ""}
          ${pill}
        </div>
        <div class="card card--low mess-meal__card">
          <div class="mess-meal__title">
            <span class="mess-meal__tile mess-meal__tile--${mealTone(meal.type)}">${icon(mealIcon(meal.type), { size: 22 })}</span>
            <span class="t-title-s w-semi">${esc(meal.type)}</span>
          </div>
          ${visible.length ? `<ol class="mess-dishes">${visible.map((item, idx) => dishRow(item, idx)).join("")}</ol>`
            : `<p class="t-body-s c-muted">No items listed</p>`}
        </div>
      </section>`;
    }).join("");
  };

  const dishRow = (raw, idx) => {
    const name = itemName(raw);
    const price = prices.get(name.toLowerCase());
    // PRICE-CATALOGUE STUB: the app prefers catalogue prices and shared pool
    // prices over this. Only the user's own transactions are used here.
    // PRICE-CATALOGUE STUB: per-dish kcal (MessNutrition) are not shown on the web.
    return `<li class="mess-dish${idx % 2 === 0 ? " is-striped" : ""}">
      <span class="mess-dish__no">${idx + 1}.</span>
      <span class="mess-dish__name">${isSpecial(raw) ? `<span class="mess-star" role="img" aria-label="Special">★</span>${esc(raw.replace(/^★\s*/, " "))}` : esc(raw)}</span>
      ${price != null ? `<span class="mess-badge mess-badge--price" title="Your last price for this dish, from your own mess transactions">${esc(money(price))}</span>` : ""}
    </li>`;
  };

  const isWeekendDay = (day) => !!day && (day.weekday === 6 || day.weekday === 7);

  const body = () => {
    if (failed) return errorCard(failed, { retry: true });
    if (!days.length) return emptyState({ icon: "restaurant", title: "No menu yet", body: "The canteen has not published a menu." });
    const day = dayAt(dayIdx);
    return `${sample ? sampleBanner("the canteen menu") : ""}
      ${headerCard()}
      ${browserNote({
        title: "Share mess menu data with other students",
        body: "In the app, students on campus can pool the menus they have seen. A browser cannot join that peer pool, so this option is not offered here.",
        icon: "groups", tone: "info",
      })}
      ${dayChips()}
      ${selectedHeading(day)}
      ${textField({ id: "menu-search", label: "Search menu items", value: query, placeholder: "Type a dish, e.g. rice, paneer", leading: "search", a: { autocomplete: "off" } })}
      <p class="t-label-m c-muted mess-note-prices">Calories are not available on the web. Prices come only from your own mess transactions, not the canteen price list.</p>
      ${mealTabsHtml()}
      <div id="menu-list" class="mess-list">${listHtml(day)}</div>
      <div class="mess-bottom-gap"></div>`;
  };

  const actions = () => `
    <button class="icon-btn" type="button" data-act="clear-cache" aria-label="Clear menu cache" title="Clear menu cache">${icon("delete_sweep")}</button>
    <button class="icon-btn" type="button" data-act="refresh" aria-label="Refresh" title="Refresh">${icon("refresh")}</button>`;

  const paint = () => {
    const scroller = el.querySelector(".screen__scroll");
    const y = scroller ? scroller.scrollTop : 0;
    el.innerHTML = screen({ bar: topBar({ title: "Mess Menu", actions: actions() }), body: body() });
    const s2 = el.querySelector(".screen__scroll");
    if (s2) s2.scrollTop = y;
    // keep the selected meal tab in view inside its scrolling row
    const row = el.querySelector("[data-tabs=meal]"), on = row && row.querySelector("[aria-selected=true]");
    if (row && on) row.scrollLeft = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
  };

  const load = async (force = false) => {
    if (force) { try { localStorage.removeItem("iiserk-cache.menu"); } catch {} }
    if (!days.length) el.innerHTML = screen({ bar: topBar({ title: "Mess Menu", actions: actions() }), body: loading("Loading menu...") });
    failed = null;
    try {
      const r = await loadMenu();
      if (!alive) return;
      title = (r.data.title || "Today's Menu");
      days = r.data.days || [];
      sample = !!r.sample; stale = !!r.stale; cachedAt = r.cachedAt;
      if (dayIdx < 0 || dayIdx >= days.length) pickDefaultDay();
    } catch (e) {
      if (!alive) return;
      failed = e && e.message ? e.message : "Could not load the menu.";
    }
    paint();
    if (!userPicked) {
      const auto = autoTabFor(dayAt(dayIdx));
      if (auto != null && !initialMeal) { tabIdx = auto; paint(); }
    }
    // Own prices: from this browser's mess transactions, when there are any.
    try {
      const t = await loadTransactions();
      if (!alive) return;
      prices = ownUnitPrices(t.data.transactions);
      paint();
    } catch {}
  };

  on(el, "click", "[data-day]", (e, b) => {
    dayIdx = +b.dataset.day;
    tabIdx = 0; query = "";
    haptics.select();
    paint();
  });
  on(el, "click", "[data-tabs=meal] [role=tab]", (e, b) => {
    tabIdx = +b.dataset.tab; userPicked = true;
    haptics.select();
    paint();
  });
  el.addEventListener("input", (e) => {
    if (e.target.id !== "menu-search") return;
    query = e.target.value;
    const pos = e.target.selectionStart;
    el.querySelector("#menu-list").innerHTML = listHtml(dayAt(dayIdx));
    e.target.focus(); try { e.target.setSelectionRange(pos, pos); } catch {}
  });
  on(el, "click", "[data-act=refresh]", () => load(true));
  on(el, "click", "[data-act=retry]", () => load(true));
  on(el, "click", "[data-act=clear-cache]", async () => {
    const ok = await confirm({
      title: "Reset menu cache?",
      text: "Clears the menu saved in this browser and fetches it again. Use this when the canteen switches to a new seasonal menu.",
      confirmLabel: "Clear", cancelLabel: "Cancel", danger: true,
    });
    if (!ok) return;
    try { localStorage.removeItem("iiserk-cache.menu"); } catch {}
    snackbar("Menu cache cleared");
    load(true);
  });

  await load(false);
  return () => { alive = false; };
}
