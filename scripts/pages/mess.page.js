/**
 * pages/mess.page.js — Mess Transactions (ui/mess/MessTransactionsScreen.kt,
 * MessFilterSheet.kt, MessTransactionFilter.kt).
 *
 * Two pages swipe sideways like the app's HorizontalPager: Summary and
 * Transactions (the app opens on Transactions). Filter, sync, refresh and CSV
 * download are in the top bar. Live history needs the canteen ERP login, which
 * a browser on another site cannot do, so the screen shows the sample and
 * offers the ERP as a link to open by hand.
 */

import { screen, topBar, tabs, card, chip, button, emptyState, browserNote, sampleBanner, extLink, loading, errorCard } from "../ui/components.js";
import { esc, on, ago } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { sheet, snackbar } from "../ui/overlay.js";
import { haptics } from "../ui/haptics.js";
import * as motion from "../core/motion.js";
import { C } from "../core/net.js";
import { userid } from "../services/canteen.service.js";
import {
  loadTransactions, forgetCachedTransactions, totalDebited, totalCredited, amountOf, isCredit,
  aggregateItemSpend, aggregateWeekdaySpend, itemVocabulary, suggestItems, applyFilter, describeFilter,
  filterProblem, filterActive, filterCount, EMPTY_FILTER, FILTER_MEALS, FILTER_PAYMENTS, FILTER_PERIODS,
  formatAt, transactionsCsv,
} from "../data/mess.data.js";
import { syncFromMess } from "../data/budget.data.js";

const TABS = [{ id: "sum", label: "Summary" }, { id: "tx", label: "Transactions" }];
const SHOW_LIMIT = 200;
const rs = (n) => "₹" + (+n || 0).toFixed(0);
const rs2 = (n) => "₹" + (+n || 0).toFixed(2);

export async function render(el) {
  let data = null;          // { transactions, account } once loaded
  let sample = false, stale = false, cachedAt = null, failed = null;
  let filter = { ...EMPTY_FILTER };
  let tab = "tx";           // the app opens on Transactions
  let pendingSync = false;
  let alive = true;

  const pager = () => el.querySelector("#mess-pager");
  const visible = () => (data ? applyFilter(data.transactions, filter) : []);

  /* ── top bar ── */
  const actions = () => {
    if (!data) return "";
    const on = filterActive(filter);
    return `
      <button class="icon-btn" type="button" data-act="sync" aria-label="Sync to Budget" title="Sync to Budget"${pendingSync ? " disabled" : ""}>${icon("sync")}</button>
      <button class="icon-btn" type="button" data-act="download" aria-label="Download CSV" title="Download CSV">${icon("download")}</button>
      <button class="icon-btn mess-filter-btn${on ? " is-on" : ""}" type="button" data-act="filter" aria-label="${on ? "Filter (on)" : "Filter"}" title="${on ? "Filter (on)" : "Filter"}">${icon("filter_list")}</button>
      <button class="icon-btn" type="button" data-act="refresh" aria-label="Refresh" title="Refresh">${icon("refresh")}</button>`;
  };

  /* ── body ── */
  const notices = () => {
    if (!sample && !failed && !stale) return "";
    const parts = [];
    if (sample) {
      parts.push(sampleBanner("the canteen ERP"));
      parts.push(browserNote({
        title: "Your live history needs the canteen ERP login",
        body: "The ERP signs in with your LDAP details and only answers the campus network, so this browser cannot fetch your statement. Open the ERP in a new tab, sign in there, and your own transactions appear on that page.",
        icon: "lock", tone: "info",
        extra: `<p class="mess-note-link">${extLink("Open the canteen ERP in a new tab", C.CANTEEN_LOGIN)}</p>`,
      }));
    }
    if (stale && cachedAt) parts.push(`<p class="t-label-m c-muted mess-updated">Last updated ${esc(ago(cachedAt))}</p>`);
    return parts.join("");
  };

  const filterRow = (shown) => {
    if (!filterActive(filter)) return "";
    const problem = filterProblem(filter);
    return `<div class="mess-filter-row">
      <div class="mess-filter-row__text">
        <span class="t-body-m w-semi">${esc(describeFilter(filter))}</span>
        <span class="t-label-m ${problem ? "c-error" : "c-muted"}">${esc(problem || `${shown} of ${data.transactions.length} transactions`)}</span>
      </div>
      <button class="btn btn--text btn--sm" type="button" data-act="filter">Edit</button>
      <button class="btn btn--text btn--sm" type="button" data-act="clear-filter">Clear</button>
    </div>`;
  };

  const statCard = (value, label, color) => `<div class="mess-stat card card--variant">
    <span class="mess-stat__value" style="color:${color}">${esc(value)}</span>
    <span class="mess-stat__label">${esc(label)}</span></div>`;

  const summaryPage = (txs) => {
    const sorted = [...txs].sort((a, b) => b.at - a.at);
    const debit = totalDebited(txs), credit = totalCredited(txs);
    const first = sorted.length ? formatAt(sorted[sorted.length - 1].at) : "—";
    const last = sorted.length ? formatAt(sorted[0].at) : "—";
    const avg = txs.length ? debit / txs.length : 0;
    const top = aggregateItemSpend(txs).slice(0, 10);
    const week = aggregateWeekdaySpend(txs);
    const maxWeek = Math.max(0, ...week.map((d) => d.totalSpend));
    const id = data.account ? data.account.employeeNumber : userid();
    return `
      <div class="mess-balance card card--primary">
        <span class="t-title-m c-muted">Current Mess Balance</span>
        <span class="mess-balance__value">${esc(rs2(latestBalance()))}</span>
        <span class="t-body-s c-muted">ID: ${esc(id || "—")}</span>
      </div>
      <div class="mess-stat-grid">
        ${statCard(rs(debit), "Total Debited", "var(--error)")}
        ${statCard(rs(credit), "Total Credited", "var(--primary)")}
        ${statCard(String(txs.length), "Transactions", "var(--tertiary)")}
        ${statCard(rs(avg), "Avg per txn", "var(--on-surface-variant)")}
      </div>
      ${card(`
        <h3 class="t-title-s w-semi">History period</h3>
        <p class="t-body-m">${esc(first)}  →  ${esc(last)}</p>
        <p class="t-body-s c-muted">Net change: ${esc(rs(credit - debit))} (credits − debits)</p>`, { tone: "low", prism: false })}
      ${card(`
        <h3 class="t-title-s w-semi">Top items (by spend)</h3>
        ${top.length ? `<ul class="mess-rank">${top.map((x) => {
          const pct = top[0].totalSpend ? (x.totalSpend / top[0].totalSpend) * 100 : 0;
          return `<li class="mess-rank__row">
            <span class="mess-rank__name">${esc(x.name)}</span>
            <span class="t-label-m c-muted">×${x.quantity}</span>
            <span class="w-semi">${esc(rs(x.totalSpend))}</span>
            <span class="mess-rank__bar" aria-hidden="true"><span style="width:${pct.toFixed(1)}%"></span></span>
          </li>`;
        }).join("")}</ul>` : `<p class="t-body-s c-muted">No itemised debits yet.</p>`}`, { tone: "low", prism: false })}
      ${card(`
        <h3 class="t-title-s w-semi">Weekly pattern</h3>
        ${maxWeek <= 0 ? `<p class="t-body-s c-muted">No itemised debits yet.</p>` : `<ul class="mess-week">${week.map((d) => `
          <li class="mess-week__row">
            <span class="mess-week__day">${esc(d.dayLabel)}</span>
            <span class="mess-week__bar"><span style="width:${((d.totalSpend / maxWeek) * 100).toFixed(1)}%"></span></span>
            <span class="t-label-m c-muted">${esc(rs(d.totalSpend))} · ${d.txnCount}×</span>
          </li>`).join("")}</ul>`}`, { tone: "low", prism: false })}
      <p class="t-label-m c-muted mess-tip">Tip: tap Sync (top bar) to push these items into Budget Analysis with calories.</p>`;
  };

  const txnCard = (t) => {
    const credit = isCredit(t);
    const amt = amountOf(t);
    const items = t.items.map((i) => `${i.name} ×${i.qty}`).join(", ");
    return `<article class="mess-txn card card--surface">
      <div class="mess-txn__head">
        <span class="t-label-m c-muted">${esc(formatAt(t.at))}</span>
        ${amt > 0 ? `<span class="mess-txn__amt ${credit ? "is-credit" : "is-debit"}">${credit ? "+" : "-"}${esc(rs(amt))}</span>` : ""}
      </div>
      ${credit
        ? `<div class="mess-txn__line"><span class="t-body-m w-semi">Balance added</span>${t.mode ? `<span class="t-label-s mess-txn__mode">${esc(t.mode)}</span>` : ""}</div>`
        : items ? `<p class="t-body-m mess-txn__items">${esc(items)}</p>` : ""}
      <div class="mess-txn__head">
        <span class="t-label-s ${credit ? "c-primary" : "c-error"}">${esc(t.type)}</span>
        <span class="t-label-m c-muted">Balance: ${esc(rs(t.balance))}</span>
      </div>
    </article>`;
  };

  const txPage = (txs) => {
    const sorted = [...txs].sort((a, b) => b.at - a.at);
    const shown = sorted.slice(0, SHOW_LIMIT);
    const id = data.account ? data.account.employeeNumber : userid();
    return `
      <div class="mess-balance card card--primary">
        <span class="t-title-m c-muted">Mess Balance</span>
        <span class="mess-balance__value">${esc(rs(latestBalance()))}</span>
        <span class="t-body-s c-muted">ID: ${esc(id || "—")}  •  ${data.transactions.length} transactions</span>
        <span class="t-label-m c-muted">Spent: ${esc(rs(totalDebited(txs)))}  •  Added: ${esc(rs(totalCredited(txs)))}</span>
      </div>
      <button class="btn btn--tonal mess-sync-btn" type="button" data-act="sync"${pendingSync ? " disabled" : ""}>${icon("sync", { size: 18 })}<span>Sync Transactions to Budget</span></button>
      <h3 class="t-title-m c-primary mess-recent">Recent Transactions</h3>
      ${txs.length === 0
        ? `<div class="mess-nomatch"><p class="t-title-s c-muted">No transactions match</p><p class="t-body-s c-muted">Widen the filter to see more of your history.</p></div>`
        : `<div class="mess-txn-list">${shown.map(txnCard).join("")}</div>
           ${sorted.length > SHOW_LIMIT ? `<p class="t-label-m c-muted">Showing the newest ${SHOW_LIMIT} of ${sorted.length} matching transactions. Download the CSV for all of them.</p>` : ""}`}
      <div class="mess-bottom-gap"></div>`;
  };

  const latestBalance = () => (data && data.transactions.length ? [...data.transactions].sort((a, b) => b.at - a.at)[0].balance : 0);

  const body = () => {
    if (failed) return errorCard(failed, { retry: true });
    if (!data) return loading("Loading mess transactions...");
    if (!data.transactions.length) return emptyState({ icon: "receipt_long", title: "No transactions", body: "There is no mess history to show yet." });
    const txs = visible();
    return `${notices()}
      ${tabs(TABS, tab, { a: { "data-tabs": "mess" } })}
      ${filterRow(txs.length)}
      <div class="mess-pager" id="mess-pager">
        <section class="mess-pager__page" aria-label="Summary">${summaryPage(txs)}</section>
        <section class="mess-pager__page" aria-label="Transactions">${txPage(txs)}</section>
      </div>`;
  };

  const paint = () => {
    const scroller = el.querySelector(".screen__scroll");
    const y = scroller ? scroller.scrollTop : 0;
    el.innerHTML = screen({ bar: topBar({ title: "Mess Transactions", actions: actions() }), body: body(), wide: false });
    const p = pager();
    if (p) {
      p.scrollLeft = (tab === "sum" ? 0 : 1) * p.clientWidth;
      p.addEventListener("scroll", onPagerScroll, { passive: true });
    }
    const s2 = el.querySelector(".screen__scroll");
    if (s2) s2.scrollTop = y;
  };

  /* Tab buttons follow the pager. While the pager is moving to a tab on
   * purpose, scroll events are ignored so the tab does not flip back midway. */
  let travelTo = null;
  const markTab = (id) => {
    tab = id;
    el.querySelectorAll("[data-tabs=mess] [role=tab]").forEach((b) => {
      const on = b.dataset.tab === id;
      b.classList.toggle("tab--active", on);
      b.setAttribute("aria-selected", String(on));
    });
  };
  const setTab = (id, { animate = true } = {}) => {
    markTab(id);
    const p = pager();
    if (!p) return;
    const left = (id === "sum" ? 0 : 1) * p.clientWidth;
    travelTo = left;
    p.scrollTo({ left, behavior: animate && motion.enabled() ? "smooth" : "auto" });
    setTimeout(() => { if (travelTo === left) travelTo = null; }, 700);
  };
  function onPagerScroll(e) {
    const p = e.currentTarget;
    if (travelTo != null) {
      if (Math.abs(p.scrollLeft - travelTo) < 2) travelTo = null;
      return;
    }
    const next = p.scrollLeft > p.clientWidth / 2 ? "tx" : "sum";
    if (next !== tab) markTab(next);
  }

  /* ── loading ── */
  const load = async (force = false) => {
    if (force) forgetCachedTransactions();
    if (!data) { el.innerHTML = screen({ bar: topBar({ title: "Mess Transactions" }), body: loading("Loading mess transactions...") }); }
    failed = null;
    try {
      const r = await loadTransactions();
      if (!alive) return;
      data = { transactions: r.data.transactions, account: r.data.account || null };
      sample = !!r.sample; stale = !!r.stale; cachedAt = r.cachedAt;
    } catch (e) {
      if (!alive) return;
      failed = e && e.message ? e.message : "Could not load mess transactions.";
    }
    paint();
  };

  /* ── actions ── */
  const syncToBudget = async () => {
    if (!data || pendingSync) return;
    pendingSync = true; paint();
    try {
      const r = await syncFromMess(data.transactions);
      snackbar(`Rebuilt the budget from ${r.transactions} transactions (${r.items} items)`);
    } catch (e) {
      snackbar(`Sync failed: ${e.message || e}`);
    } finally {
      pendingSync = false;
      if (alive) paint();
    }
  };

  const downloadCsv = () => {
    if (!data) return;
    const txs = visible();
    const blob = new Blob([transactionsCsv(txs)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mess_transactions.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    snackbar(`Exported ${txs.length} transactions to a CSV download`);
  };

  /* ── filter sheet (MessFilterSheet) ── */
  const openFilter = () => {
    if (!data) return;
    let draft = { ...filter };
    const all = data.transactions;
    const vocab = itemVocabulary(all);
    let dlg = null;

    const count = (f) => applyFilter(all, f).length;
    const chipRow = (key, opts, current, withCounts) => opts.map(([value, text]) => {
      const n = withCounts ? ` · ${count({ ...draft, [key]: value })}` : "";
      return chip(`${text}${n}`, { selected: current === value, a: { "data-f": key, "data-v": value ?? "" } });
    }).join("");

    const inner = () => {
      const problem = filterProblem(draft);
      const kept = count(draft);
      const typed = String(draft.search || "").trim();
      const matches = suggestItems(vocab, draft.search);
      const nothing = typed && !matches.length;
      return `
        <h2 class="sheet__title mess-sheet-title">Filter transactions</h2>
        <div class="mess-facet">
          <h3 class="t-title-s">Meal</h3>
          <p class="t-body-s c-muted">A top-up is not a meal, so top-ups are left out.</p>
          <div class="chips chips--scroll">${chipRow("meal", [[null, "Any"], ...FILTER_MEALS.map((m) => [m, m])], draft.meal, true)}</div>
        </div>
        <div class="mess-facet">
          <h3 class="t-title-s">When</h3>
          <div class="chips chips--scroll">${Object.entries(FILTER_PERIODS).map(([k, v]) =>
            chip(v, { selected: draft.period === k, a: { "data-f": "period", "data-v": k } })).join("")}</div>
          ${draft.period === "CUSTOM" ? `<div class="mess-two">
            <label class="mess-field"><span>From</span><input id="f-from" type="text" maxlength="10" placeholder="yyyy-mm-dd" value="${esc(draft.from)}" autocomplete="off"></label>
            <label class="mess-field"><span>To</span><input id="f-to" type="text" maxlength="10" placeholder="yyyy-mm-dd" value="${esc(draft.to)}" autocomplete="off"></label>
          </div>` : ""}
        </div>
        <div class="mess-facet">
          <h3 class="t-title-s">Amount</h3>
          <div class="mess-two">
            <label class="mess-field"><span>At least ₹</span><input id="f-min" type="text" inputmode="decimal" value="${esc(draft.minAmount)}" autocomplete="off"></label>
            <label class="mess-field"><span>At most ₹</span><input id="f-max" type="text" inputmode="decimal" value="${esc(draft.maxAmount)}" autocomplete="off"></label>
          </div>
        </div>
        <div class="mess-facet">
          <h3 class="t-title-s">Top-ups by</h3>
          <p class="t-body-s c-muted">Only a top-up records how it was paid.</p>
          <div class="chips chips--scroll">${chipRow("payment", [[null, "Any"], ...FILTER_PAYMENTS.map((p) => [p, p])], draft.payment, false)}</div>
        </div>
        <div class="mess-facet">
          <h3 class="t-title-s">Contains</h3>
          <p class="t-body-s c-muted">Food items and remarks.</p>
          <label class="mess-field mess-field--wide"><span>Search</span>
            <input id="f-search" type="search" list="f-vocab" placeholder="Pick a dish, or type" value="${esc(draft.search)}" autocomplete="off">
          </label>
          <datalist id="f-vocab">${matches.map((v) => `<option value="${esc(v)}"></option>`).join("")}</datalist>
          ${nothing ? `<p class="t-label-m c-muted">No dish you have eaten matches "${esc(typed)}"</p>` : ""}
        </div>
        <p class="t-body-m ${kept === 0 ? "c-error" : "c-muted"} mess-kept">${kept === all.length ? `Showing all ${all.length} transactions` : `${kept} of ${all.length} transactions`}</p>
        ${problem ? `<p class="t-body-s c-error">${esc(problem)}</p>` : ""}
        <div class="mess-sheet-actions">
          ${button("Clear", { variant: "text", attrs: { "data-sheet": "clear" } })}
          ${button("Apply", { variant: "filled", block: true, disabled: !!problem, attrs: { "data-sheet": "apply" } })}
        </div>`;
    };

    const paintSheet = () => {
      const bodyEl = dlg.querySelector(".sheet__body");
      const y = bodyEl.scrollTop;
      bodyEl.innerHTML = inner();
      bodyEl.scrollTop = y;
    };
    /* repaint, then put focus and the caret back where the user was typing */
    const repaintKeeping = (input) => {
      const id = input.id, pos = input.selectionStart;
      paintSheet();
      const again = id && dlg.querySelector("#" + id);
      if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch {} }
    };

    sheet({
      onMount: (d, close) => {
        dlg = d;
        paintSheet();
        on(d, "click", "[data-f]", (e, b) => {
          const key = b.dataset.f, v = b.dataset.v;
          if (key === "meal") draft.meal = draft.meal === v ? null : (v || null);
          else if (key === "payment") draft.payment = draft.payment === v ? null : (v || null);
          else if (key === "period") draft.period = v;
          haptics.select();
          paintSheet();
        });
        on(d, "click", "[data-sheet=clear]", () => {
          draft = { ...EMPTY_FILTER };
          filter = { ...EMPTY_FILTER };
          paint();
          paintSheet();
        });
        on(d, "click", "[data-sheet=apply]", () => { filter = { ...draft }; close(); paint(); });
        d.addEventListener("input", (e) => {
          const t = e.target;
          if (t.id === "f-from") draft.from = t.value.slice(0, 10);
          else if (t.id === "f-to") draft.to = t.value.slice(0, 10);
          else if (t.id === "f-min") draft.minAmount = t.value.replace(/[^\d.]/g, "");
          else if (t.id === "f-max") draft.maxAmount = t.value.replace(/[^\d.]/g, "");
          else if (t.id === "f-search") draft.search = t.value;
          else return;
          repaintKeeping(t);
        });
      },
    });
  };

  /* ── wiring ── */
  on(el, "click", "[data-tabs=mess] [role=tab]", (e, b) => { if (b.dataset.tab !== tab) { haptics.select(); setTab(b.dataset.tab); } });
  on(el, "click", "[data-act=filter]", () => openFilter());
  on(el, "click", "[data-act=clear-filter]", () => { filter = { ...EMPTY_FILTER }; paint(); });
  on(el, "click", "[data-act=sync]", () => syncToBudget());
  on(el, "click", "[data-act=download]", () => downloadCsv());
  on(el, "click", "[data-act=refresh]", () => { if (!pendingSync) load(true); });
  on(el, "click", "[data-act=retry]", () => load(true));

  await load(false);
  return () => { alive = false; };
}
