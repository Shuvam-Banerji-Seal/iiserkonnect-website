/**
 * pages/library.page.js — Library (ui/library/LibraryScreen.kt).
 *
 * Two tabs, as in the app: "Search" (catalogue search with sort and filters,
 * new arrivals, hours, quick links, e-resources) and "My Account" (which needs
 * the campus library login, so it is explained rather than faked here).
 */

import { prefs } from "../core/prefs.js";
import { C } from "../core/net.js";
import { href, seg } from "../core/router.js";
import { esc, on } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, button, tabs, sampleBanner, browserNote, loading, errorCard, extLink, searchField } from "../ui/components.js";
import { dialog, toast } from "../ui/overlay.js";
import * as D from "../data/library.data.js";

const PAGE_SIZE = 10;
const RECENT_KEY = "library.recent";
const READING_KEY = "library.reading";

const labelOf = (pairs, value) => (pairs.find(([v]) => v === value) || [null, ""])[1];
const hueOf = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 360; };
const initials = (s) => String(s || "?").replace(/[^A-Za-z ]/g, "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";

const cover = (b, cls = "") => `<span class="lib-cover ${cls}" style="--h:${hueOf(b.title)}" aria-hidden="true"><span>${esc(initials(b.title))}</span></span>`;

function availability(b) {
  if (!b.availabilityText) return { text: "Availability unknown", tone: "neutral" };
  return { text: b.availabilityText, tone: b.isAvailable === true ? "good" : b.isAvailable === false ? "bad" : "neutral" };
}

const selectField = (name, label, options, value) => `
  <label class="lib-select"><span class="lib-select__label">${esc(label)}</span>
    <select data-opt="${esc(name)}">${options.map(([v, l]) => `<option value="${esc(v ?? "")}"${String(v ?? "") === String(value ?? "") ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>
  </label>`;

export async function render(el) {
  let tab = "search";
  let query = "";
  const filters = { field: "text", sort: "relevance", itemClass: "", language: "", format: "" };
  let page = 1;
  let state = { searched: false, busy: false, error: "", results: [], sample: false };
  let arrivals = null;
  let detail = null;
  let shown = [];
  let showSample = false;

  const recent = () => (prefs.get(RECENT_KEY) || []).slice(0, 8);
  const reading = () => prefs.get(READING_KEY) || [];
  const isSaved = (b) => reading().some((r) => r.id === D.bookId(b));
  const bodyEl = () => el.querySelector(".screen__body");

  const applyClientFilters = (list) => {
    let out = list.slice();
    const cls = labelOf(D.ITEM_CLASSES, filters.itemClass);
    if (cls) out = out.filter((b) => !b.itemClass || b.itemClass === cls);
    const lang = labelOf(D.LANGUAGES, filters.language);
    if (lang) out = out.filter((b) => !b.language || b.language === lang);
    const fmt = labelOf(D.FORMATS, filters.format);
    if (fmt) out = out.filter((b) => !b.format || b.format === fmt);
    const key = { title: "title", author: "author", call_number: "callNumber" }[filters.sort];
    if (key) out.sort((a, b) => String(a[key]).localeCompare(String(b[key])));
    return out;
  };

  const bookCard = (b, i) => `
    <div class="lib-result" data-act="open" data-i="${i}" role="button" tabindex="0">
      ${cover(b)}
      <div class="lib-result__text">
        <div class="lib-result__title">${esc(b.title)}</div>
        ${b.author ? `<div class="lib-result__author">${esc(b.author)}</div>` : ""}
        <span class="lib-avail lib-avail--${availability(b).tone}">${esc(availability(b).text)}</span>
        ${b.callNumber ? `<div class="lib-result__call">${icon("menu_book", { size: 14 })} ${esc(b.callNumber)}</div>` : ""}
      </div>
      <button type="button" class="icon-btn lib-save" data-act="save" data-i="${i}" aria-label="${isSaved(b) ? "Remove from reading list" : "Save to reading list"}">${icon(isSaved(b) ? "bookmark" : "bookmark_border")}</button>
    </div>`;

  const coverTile = (b, i) => `<button type="button" class="lib-arrival" data-act="open" data-i="${i}">${cover(b, "lib-cover--big")}<span class="lib-arrival__title">${esc(b.title)}</span><span class="lib-arrival__author">${esc(b.author)}</span></button>`;

  const detailView = () => {
    const b = detail;
    shown = [b];
    const copies = b.copies && b.copies.length ? `
      <h3 class="lib-h">Availability</h3>
      <div class="lib-copies">${b.copies.map((c) => `
        <div class="lib-copy">
          <div class="lib-copy__row"><strong>${esc(c.callNumber || b.callNumber)}</strong>${c.volume ? `<span>${esc(c.volume)}</span>` : ""}
          <span class="lib-avail lib-avail--${/available/i.test(c.status) ? "good" : "bad"}">${esc(c.status)}</span></div>
          <div class="c-muted">📍 ${esc(c.location)}</div>
          <div class="c-muted">Barcode: ${esc(c.barcode)}</div>
        </div>`).join("")}</div>` : "";
    return `
      <button type="button" class="lib-back" data-act="close-detail">${icon("arrow_back", { size: 18 })} Back to results</button>
      ${showSample ? sampleBanner("the library catalogue") : ""}
      <div class="lib-detail">
        <div class="lib-detail__head">${cover(b, "lib-cover--big")}
          <div>
            <h2 class="lib-detail__title">${esc(b.title)}</h2>
            ${b.author ? `<div class="lib-detail__author">${esc(b.author)}</div>` : ""}
            <span class="lib-avail lib-avail--${availability(b).tone}">${esc(availability(b).text)}</span>
          </div>
        </div>
        <dl class="lib-kv">
          ${b.callNumber ? `<dt>Call Number</dt><dd>${esc(b.callNumber)}</dd>` : ""}
          ${b.publication ? `<dt>Publication</dt><dd>${esc(b.publication)}</dd>` : ""}
          ${b.isbn ? `<dt>ISBN</dt><dd>${esc(b.isbn)}</dd>` : ""}
        </dl>
        ${b.subjects.length ? `<div class="lib-chips">${b.subjects.map((s) => `<span class="lib-tag">${esc(s)}</span>`).join("")}</div>` : ""}
        ${b.notes ? `<p class="lib-notes">${esc(b.notes)}</p>` : ""}
        ${copies}
        <div class="lib-actions">
          ${button(isSaved(b) ? "Remove from reading list" : "Save to reading list", { variant: "tonal", icon: isSaved(b) ? "bookmark" : "bookmark_border", attrs: { "data-act": "save-detail" } })}
        </div>
        ${browserNote({ title: "Requesting a hold needs your library login", body: "Holds are placed from the campus catalogue, which only answers requests from campus Wi-Fi or VPN. This browser cannot place one. On the Android app, sign in under My Account." })}
      </div>`;
  };

  const resultsHtml = () => {
    if (state.busy) return loading("Searching catalogue...");
    if (state.error) return errorCard(state.error);
    const list = applyClientFilters(state.results);
    if (!list.length) return `<p class="lib-empty">No books found.</p>`;
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (page > pages) page = pages;
    const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    shown = slice;
    return `
      <div class="lib-list">${slice.map((b, i) => bookCard(b, i)).join("")}</div>
      <div class="lib-pager">
        <button type="button" class="btn btn--text btn--sm" data-act="page" data-dir="-1"${page <= 1 ? " disabled" : ""}>&lt; Prev</button>
        <span>Page ${page} of ${pages}</span>
        <button type="button" class="btn btn--text btn--sm" data-act="page" data-dir="1"${page >= pages ? " disabled" : ""}>Next &gt;</button>
      </div>`;
  };

  const searchBody = () => {
    if (detail) return detailView();
    const idle = !state.searched;
    const saved = reading();
    const hours = `
      <div class="lib-card lib-card--info">
        <div class="lib-card__row">${icon("person", { size: 20 })}<div><strong>Library Hours &amp; Contact</strong>
          <p>Central Library, IISER Kolkata — Mohanpur, Nadia - 741246</p>
          <p class="c-muted">${icon("search", { size: 14 })} Mon-Sat: 9:00 AM - 8:00 PM • Sun: Closed • contact details on the library's intranet page</p></div></div>
      </div>`;
    const quick = `
      <h2 class="lib-h">Quick Links</h2>
      <div class="lib-quick">
        <a class="lib-quick__card" href="${href("pyq")}">${icon("menu_book", { size: 22 })}<strong>Old Papers</strong><span>2025-2018</span></a>
        <a class="lib-quick__card" href="#lib-resources">${icon("search", { size: 22 })}<strong>E-Resources</strong><span>Journals &amp; DBs</span></a>
        <a class="lib-quick__card" href="#lib-resources">${icon("person", { size: 22 })}<strong>Guides</strong><span>By Subject</span></a>
      </div>
      <p class="fineprint">Search the full catalogue below</p>`;
    const resources = `
      <section id="lib-resources" class="lib-resources">
        <h2 class="lib-h">Subject guides</h2>
        <div class="lib-links">${D.SUBJECT_GUIDES.map((g) => extLinkRow(g.name, g.url, g.description)).join("")}</div>
        <h2 class="lib-h">E-resources</h2>
        <div class="lib-links">${D.E_RESOURCES.map((r) => extLinkRow(r.name, r.url, [r.category, r.note].filter(Boolean).join(" · "))).join("")}</div>
      </section>`;
    const recentHtml = recent().length ? `
      <div class="lib-row-head"><h2 class="lib-h">Recent searches</h2>
        <button type="button" class="btn btn--text btn--sm" data-act="clear-recent">Clear</button></div>
      <div class="chips chips--scroll">${recent().map((q) => `<button type="button" class="chip chip--filter" data-act="recent" data-q="${esc(q)}"><span>${esc(q)}</span></button>`).join("")}</div>` : "";
    const readingHtml = saved.length ? `
      <h2 class="lib-h">Your reading list (${saved.length})</h2>
      <div class="lib-row">${saved.map((b, i) => `<button type="button" class="lib-arrival lib-arrival--small" data-act="open-saved" data-i="${i}">${cover(b, "lib-cover--big")}<span class="lib-arrival__title">${esc(b.title)}</span></button>`).join("")}</div>` : "";
    const arrivalsHtml = arrivals ? `
      <h2 class="lib-h">New Arrivals</h2><p class="fineprint">Latest in catalogue</p>
      <div class="lib-grid">${arrivals.map((b, i) => coverTile(b, i)).join("")}</div>` : "";
    const searchOpts = `
      <div class="lib-opts">
        ${selectField("field", "Field", D.SEARCH_FIELDS, filters.field)}
        ${selectField("sort", "Sort", D.SORT_OPTIONS, filters.sort)}
        ${selectField("itemClass", "Item type", D.ITEM_CLASSES, filters.itemClass)}
        ${selectField("language", "Language", D.LANGUAGES, filters.language)}
        ${selectField("format", "Format", D.FORMATS, filters.format)}
      </div>`;
    return `
      ${showSample ? sampleBanner("the library catalogue") : ""}
      <div class="lib-card lib-card--intro">${icon("menu_book", { size: 22 })}<div><strong>Library Catalogue</strong><p class="c-muted">Search by title, author, ISBN or call number</p></div></div>
      <form class="lib-search" data-form="search" role="search">
        ${searchField({ id: "lib-q", placeholder: "Search the catalogue...", value: query })}
      </form>
      ${searchOpts}
      ${idle ? `${recentHtml}${readingHtml}${arrivalsHtml}${hours}${quick}${resources}` : `<div class="lib-results">${resultsHtml()}</div>`}`;
  };

  const extLinkRow = (name, url, sub) => `<div class="lib-link"><div><strong>${esc(name)}</strong>${sub ? `<div class="c-muted">${esc(sub)}</div>` : ""}</div>${extLink("Open", url)}</div>`;

  const accountBody = () => `
    ${browserNote({
      title: "Library account is not available in a browser",
      body: "Sign-in, loans, holds, dues and purchase suggestions use the campus library catalogue. It only answers requests from campus Wi-Fi or VPN, and this browser does not store or send your library password. On the Android app this tab shows your account.",
      icon: "lock",
      tone: "warn",
    })}
    <div class="lib-row-end">${extLink("Open the library catalogue in a new tab", C.LIBCAT)}</div>
    <div class="lib-card lib-card--info">
      <div class="lib-card__row">${icon("info", { size: 20 })}<div><strong>Library Information</strong>
        <p>Central Library, IISER Kolkata • Mohanpur - 741246</p>
        <p class="c-muted">Hours: 9:00 AM - 11:00 PM (Mon-Sat) • Contact: see the library's intranet page</p>
        <p class="c-muted">For account issues, visit the circulation desk with your ID card.</p></div></div>
    </div>`;

  const paint = () => {
    const bar = topBar({
      title: "Library",
      actions: iconBtn("refresh", "Refresh", { "data-act": "refresh" }) + button("Suggest", { variant: "text", icon: "add", attrs: { "data-act": "suggest" }, small: true }),
    });
    const tabBar = tabs([{ id: "search", label: "Search" }, { id: "account", label: "My Account" }], tab);
    el.innerHTML = screen({ bar, body: tabBar + (tab === "search" ? searchBody() : accountBody()), wide: false });
    if (tab === "search" && !detail && !arrivals) loadArrivals();
  };

  const loadArrivals = async () => {
    const r = await D.loadNewArrivals();
    arrivals = r.data;
    showSample = showSample || r.sample;
    if (tab === "search" && !detail && !state.searched) paint();
  };

  const runSearch = async (term) => {
    const t = term.trim();
    if (!t) return;
    query = t;
    detail = null;
    page = 1;
    state = { searched: true, busy: true, error: "", results: [], sample: false };
    prefs.set(RECENT_KEY, [t, ...recent().filter((x) => x !== t)].slice(0, 8));
    paint();
    try {
      const r = await D.searchCatalogue(t, { field: filters.field });
      state = { searched: true, busy: false, error: "", results: r.results, sample: r.sample };
      showSample = showSample || r.sample;
    } catch (e) {
      state = { searched: true, busy: false, error: e.message || "Search failed.", results: [], sample: false };
    }
    paint();
  };

  on(el, "click", "[data-tab]", (e, b) => { tab = b.dataset.tab; paint(); });
  on(el, "submit", "[data-form=search]", (e) => {
    e.preventDefault();
    runSearch(el.querySelector("#lib-q").value);
  });
  on(el, "change", "[data-opt]", (e, sel) => {
    const key = sel.dataset.opt;
    if (key === "field") { filters.field = sel.value; if (state.searched && query) runSearch(query); return; }
    filters[key] = sel.value; page = 1; paint();
  });
  on(el, "click", "[data-act=recent]", (e, b) => runSearch(b.dataset.q));
  on(el, "click", "[data-act=clear-recent]", () => { prefs.set(RECENT_KEY, []); paint(); });
  on(el, "click", "[data-act=page]", (e, b) => { page += +b.dataset.dir; paint(); });
  on(el, "click", "[data-act=close-detail]", () => { detail = null; paint(); });
  on(el, "click", "[data-act=refresh]", () => { arrivals = null; loadArrivals(); if (state.searched && query) runSearch(query); });
  on(el, "click", "[data-act=suggest]", () => dialog({
    title: "Suggest a Book",
    body: browserNote({
      title: "Purchase suggestions need your library login",
      body: "Suggestions are sent from the library account, which this browser cannot sign in to. On the Android app, sign in under My Account and use Suggest there.",
      tone: "warn",
    }),
    actions: [{ label: "Close", value: true, variant: "text", primary: true }],
  }));
  on(el, "click", "[data-act=open-saved]", (e, b) => {
    const saved = reading();
    detail = saved[+b.dataset.i];
    if (detail) { showSample = false; paint(); }
  });

  const openAt = (list, i) => {
    detail = list[i] || null;
    if (detail) paint();
  };
  on(el, "click", "[data-act=open]", (e, b) => {
    if (e.target.closest("[data-act=save]")) return;
    openAt(arrivals && !state.searched ? arrivals : shown, +b.dataset.i);
    if (detail) { el.querySelector(".screen__scroll")?.scrollTo({ top: 0 }); }
  });
  on(el, "keydown", "[data-act=open]", (e, b) => {
    if (e.key === "Enter") { e.preventDefault(); b.click(); }
  });
  const toggleSave = (b) => {
    const list = reading();
    const id = D.bookId(b);
    const next = list.some((r) => r.id === id) ? list.filter((r) => r.id !== id) : [...list, { id, title: b.title, author: b.author, callNumber: b.callNumber, itemUrl: b.itemUrl, isbn: b.isbn, publication: b.publication, availabilityText: b.availabilityText, availableCopies: b.availableCopies, totalCopies: b.totalCopies, isAvailable: b.isAvailable, copies: b.copies, subjects: b.subjects, notes: b.notes, itemClass: b.itemClass, language: b.language, format: b.format }];
    prefs.set(READING_KEY, next);
    return next;
  };
  on(el, "click", "[data-act=save]", (e, b) => {
    e.stopPropagation();
    const book = shown[+b.dataset.i];
    if (!book) return;
    const was = isSaved(book);
    toggleSave(book);
    toast(was ? "Removed from your reading list." : "Saved to your reading list.");
    paint();
  });
  on(el, "click", "[data-act=save-detail]", () => {
    if (!detail) return;
    const was = isSaved(detail);
    toggleSave(detail);
    toast(was ? "Removed from your reading list." : "Saved to your reading list.");
    paint();
  });

  paint();
  return () => {};
}
