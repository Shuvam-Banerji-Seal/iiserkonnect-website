/**
 * services/canteen.service.js — port of CanteenErpService + the food-menu
 * parser + MessRepository.allocateItemCosts.
 */

import { get, postForm, C } from "../core/net.js";
import { ensureCanteen } from "../core/session.js";
import { parse, q, qa, text } from "../core/html.js";
import { regex1 } from "../core/html.js";

/* ── transactions ──────────────────────────────────────────────── */
export async function fetchTransactions(full = false) {
  if (!(await ensureCanteen())) throw new Error("Canteen ERP login failed — check credentials in Settings");
  const page = await get(C.CANTEEN_MINI);
  if (/not logeed in/i.test(page.text)) { throw new Error("Canteen session expired — retry"); }
  const csrf = regex1(/csrfmiddlewaretoken[^>]*value=['"]([^'"]+)['"]/, page.text);
  if (!csrf) throw new Error("Could not find CSRF token on ERP page");
  const form = { csrfmiddlewaretoken: csrf, userid: userid(), submit: "Get Result" };
  if (full) Object.assign(form, {
    choice: "range", syear: "2000", smon: "1", sday: "1",
    eyear: "2100", emon: "1", eday: "1",
  });
  else Object.assign(form, { choice: "ministatement" });
  const res = await postForm(C.CANTEEN_MINI, form);
  return parseTransactions(res.text);
}

/** ERP userid = employee number, e.g. sbs22ms076 → 22MS076 (port of extractEmployeeNumber). */
export function userid() {
  const u = (localStorage.getItem("iiserk-web") && JSON.parse(localStorage.getItem("iiserk-web")).ldap?.u) || "";
  const m = /^[a-zA-Z]{2,5}(\d{2})([a-z]{2})(\d{2,3})$/i.exec(u.trim());
  return m ? m[1] + m[2].toUpperCase() + m[3] : u;
}

function parseTransactions(html) {
  const doc = parse(html);
  const out = [];
  for (const table of qa(doc, "table")) {
    for (const row of qa(table, "tr")) {
      const cells = qa(row, "td");
      if (cells.length < 7) continue;
      const g = (i) => text(cells[i]);
      const food = g(0), cost = g(1), type = g(2), added = g(3),
            mode = g(4), bal = g(5), dt = g(6), remarks = cells[7] ? g(7) : "";
      const isData = /debited|credited/i.test(type) ||
        (!isNaN(parseFloat(cost)) && type.trim() !== "");
      if (isData && dt) {
        out.push({ dateTime: dt, foodItems: food, totalCost: parseFloat(cost) || 0,
          type, balanceAdded: added, modeOfTran: mode, balance: parseFloat(bal) || 0, remarks });
      }
    }
  }
  return out;
}

/** Port of allocateItemCosts — ERP total is authoritative. */
export function allocateItemCosts(items, realTotal) {
  if (!items.length) return [];
  const parsedSum = items.reduce((s, [, qty, price]) => s + qty * price, 0);
  const safe = Math.max(realTotal, 0);
  const scale = parsedSum > 0 ? safe / parsedSum : 1;
  return items.map(([name, qty, unitPrice]) => ({
    name, quantity: qty, unitPrice, cost: unitPrice * qty * scale,
  }));
}

/** "name:qty:price|name:qty:price" → [[name,qty,price],…] */
export function parseItems(foodItems) {
  return (foodItems || "").split("|").map((s) => {
    const p = s.split(":");
    if (p.length < 3) return null;
    const name = p[0].trim(), qty = parseInt(p[1]) || 1, price = parseFloat(p[2]) || 0;
    return name && price > 0 ? [name, qty, price] : null;
  }).filter(Boolean);
}

/** Port of MessTransactionsViewModel.formatDateTime */
export function formatDateTime(raw) {
  const m = /(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw);
  return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}` : raw;
}

export const totalDebited = (tx) => tx.filter((t) => /debit/i.test(t.type)).reduce((s, t) => s + t.totalCost, 0);
export const totalCredited = (tx) => tx.filter((t) => /credit/i.test(t.type)).reduce((s, t) => s + (parseFloat(t.balanceAdded) || 0), 0);
export const lastBalance = (tx) => (tx.length ? [...tx].sort((a, b) => b.dateTime.localeCompare(a.dateTime))[0].balance : 0);

/* ── today's menu (port of parseFoodMenuFromCanteen) ───────────── */
export async function fetchMenu() {
  const page = await get(C.CANTEEN_MENU);
  const doc = parse(page.text);
  const box = q(doc, "div.tmenucon");
  if (!box) throw new Error("Menu not published right now (no div.tmenucon on the ERP page)");
  const meals = [];
  let type = "", items = [];
  const flush = () => { if (type && items.length) meals.push({ type, items: [...items] }); type = ""; items = []; };
  for (const row of qa(box, "table tr")) {
    const bg = (row.getAttribute("bgcolor") || "").toLowerCase();
    if (bg === "#b8d1f3") {
      flush();
      type = text(row).replace(/:$/, "").replace(/^./, (c) => c.toUpperCase());
    } else if (bg === "#dae5f4") {
      let t = text(row);
      if (!t) continue;
      t = t.replace(/^\d+\.\s*/, "");
      if (q(row, "div.blink_me")) t = "★ " + t;
      if (t) items.push(t);
    }
  }
  flush();
  if (!meals.length) throw new Error("No meals found on today's menu");
  return { title: text(q(box, "div.headerText")) || "Today's Menu", meals };
}
