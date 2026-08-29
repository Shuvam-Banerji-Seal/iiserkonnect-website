/** pages/mess.page.js — transactions + budget (port of MessRepository/Budget). */

import { fetchTransactions, allocateItemCosts, parseItems, formatDateTime,
         totalDebited, totalCredited, lastBalance } from "../services/canteen.service.js";
import { store } from "../core/store.js";
import { pageHead, card, esc, emptyState, errorState, requireCreds, barChart } from "../ui/helpers.js";

export async function render(el) {
  el.innerHTML = pageHead("Mess", "Transactions & budget", "Full canteen ERP history with ERP-authoritative cost allocation.");
  const credsOk = requireCreds();
  if (!credsOk.ok) return el.insertAdjacentHTML("beforeend", credsOk.html);

  const mount = document.createElement("div");
  el.appendChild(mount);
  mount.innerHTML = `<div class="page-loading"><span class="spinner"></span> Syncing with canteen ERP…</div>`;

  try {
    const tx = await fetchTransactions(true);
    if (!tx.length) return mount.innerHTML = emptyState("🧾", "No transactions", "The ERP returned zero rows.");
    renderAll(mount, tx);
  } catch (e) {
    mount.innerHTML = errorState(e.message, "mess");
  }
}

function renderAll(mount, tx) {
  const balance = lastBalance(tx);
  const spent = totalDebited(tx);
  const added = totalCredited(tx);

  // aggregate item spend (port of aggregateItemSpend)
  const agg = new Map();
  for (const t of tx) {
    if (!/debit/i.test(t.type)) continue;
    for (const [name, qty, price] of parseItems(t.foodItems)) {
      const cur = agg.get(name) || { qty: 0, spend: 0 };
      cur.qty += qty; cur.spend += price * qty;
      agg.set(name, cur);
    }
  }
  const topItems = [...agg.entries()].map(([name, v]) => [name, v.spend])
    .sort((a, b) => b[1] - a[1]).slice(0, 10);

  // monthly spend (port of getMonthlyStats, simplified)
  const monthly = new Map();
  for (const t of tx) {
    if (!/debit/i.test(t.type)) continue;
    const m = t.dateTime.slice(0, 7).replace(":", "-");
    monthly.set(m, (monthly.get(m) || 0) + t.totalCost);
  }
  const months = [...monthly.entries()].sort().slice(-6);

  mount.innerHTML = `
    <div class="statrow">
      ${card(`<div class="stat"><span class="stat__value">₹${balance.toFixed(0)}</span><span class="stat__label">Balance</span></div>`)}
      ${card(`<div class="stat"><span class="stat__value">₹${spent.toFixed(0)}</span><span class="stat__label">Total spent</span></div>`)}
      ${card(`<div class="stat"><span class="stat__value">₹${added.toFixed(0)}</span><span class="stat__label">Total added</span></div>`)}
      ${card(`<div class="stat"><span class="stat__value">${tx.length}</span><span class="stat__label">Transactions</span></div>`)}
    </div>

    <div class="tabbar">
      <button class="tab active" data-tab="tx">Transactions</button>
      <button class="tab" data-tab="items">Top items</button>
      <button class="tab" data-tab="monthly">Monthly</button>
    </div>
    <div id="mess-body"></div>`;

  const body = mount.querySelector("#mess-body");
  const show = (tab) => {
    if (tab === "tx") {
      body.innerHTML = `<div class="app-card" style="overflow:auto">
        <table class="datatable"><thead><tr><th>Date</th><th>Items</th><th>Cost</th><th>Type</th><th>Balance</th></tr></thead>
        <tbody>${[...tx].sort((a, b) => b.dateTime.localeCompare(a.dateTime)).slice(0, 300).map((t) => `
          <tr><td class="nowrap">${esc(formatDateTime(t.dateTime))}</td>
          <td class="wrap">${esc(t.foodItems || "—")}</td>
          <td>${t.totalCost ? "₹" + t.totalCost.toFixed(0) : "—"}</td>
          <td>${/credit/i.test(t.type) ? `<span class="chip chip--accent">+${esc(t.balanceAdded)}</span>` : esc(t.type)}</td>
          <td>₹${t.balance.toFixed(0)}</td></tr>`).join("")}</tbody></table></div>`;
    }
    if (tab === "items") {
      body.innerHTML = card(`<h3 class="h3" style="margin-bottom:12px">Where the money went</h3>` +
        barChart(topItems, (v) => `₹${v.toFixed(0)}`));
    }
    if (tab === "monthly") {
      body.innerHTML = card(`<h3 class="h3" style="margin-bottom:12px">Monthly spend</h3>` +
        barChart(months, (v) => `₹${v.toFixed(0)}`));
    }
  };
  mount.querySelectorAll(".tab").forEach((b) => b.onclick = () => {
    mount.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    b.classList.add("active"); show(b.dataset.tab);
  });
  show("tx");
}
