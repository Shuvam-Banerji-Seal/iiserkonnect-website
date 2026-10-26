/**
 * pages/website.page.js — IISER Kolkata website screens (ui/website/*).
 *
 *  renderHome         website                 home: quick links + navigation categories
 *  renderSection      website/section         a website section (links only, no page embed)
 *  renderWebView      website/vpnview         campus page that needs the VPN in the app
 *  renderPdf          pdf                     PDF viewer: open, or show here for public PDFs
 *  renderTeachingPlan teaching-plan           teaching plans (sample only in a browser)
 *  renderCourseDetail teaching-plan/course    one course (sample only)
 *  renderConceptTree  concept-tree            topic tree built from course syllabi
 *
 * Campus pages are never loaded automatically: a browser cannot show most of
 * them, and campus servers do not answer requests from other websites. They
 * open in a new tab when the user asks.
 */

import { esc, on, debounce } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, searchField, chip, card, browserNote, emptyState, loading, errorCard, sampleBanner, extLink } from "../ui/components.js";
import { href } from "../core/router.js";
import { QUICK_LINKS, NAV_CATEGORIES, WEB_BASE, routeFor, loadTeachingPlans, semesterOrder, buildConceptTree } from "../data/website.data.js";

const isCampusUrl = (u) => { try { return /(^|\.)iiserkol\.ac\.in$/i.test(new URL(u).hostname); } catch { return false; } };
const isHttps = (u) => { try { return new URL(u).protocol === "https:"; } catch { return false; } };
const CAMPUS_NOTE = "Campus pages are not loaded here. Browsers cannot show most campus pages, and campus servers do not answer requests from other websites. The Android app shows them inside its VPN web view.";

/* ── home ──────────────────────────────────────────────────────── */
function quickHref(q) {
  const r = routeFor(q.url, q.vpn);
  if (r.route === "teaching-plan") return "#/teaching-plan";
  return href(r.route, { url: q.url, title: q.title });
}

function catMatches(cat, q) {
  if (!q) return true;
  return cat.title.toLowerCase().includes(q) || cat.subs.some((s) => s.title.toLowerCase().includes(q));
}

export async function renderHome(el) {
  const expanded = new Set();
  let query = "";

  el.innerHTML = screen({ bar: topBar({ title: "IISER Kolkata" }), body: "" });
  const body = el.querySelector(".screen__body");

  const paint = () => {
    const q = query.trim().toLowerCase();
    const cats = NAV_CATEGORIES.filter((c) => catMatches(c, q));
    const open = (c) => q ? true : expanded.has(c.title);
    body.innerHTML = `
      ${searchField({ id: "web-q", placeholder: "Search sections...", value: query })}
      ${q ? "" : `
        <h2 class="web-h">Quick Links</h2>
        <div class="web-quick">${QUICK_LINKS.map((l) => `
          <a class="web-quick__chip" href="${esc(quickHref(l))}">${l.vpn ? icon("vpn_key", { size: 16 }) : ""}<span>${esc(l.title)}</span></a>`).join("")}
        </div>
        <h2 class="web-h">Website Navigation</h2>`}
      <div class="web-cats">${cats.length ? cats.map((c) => {
        const isOpen = open(c);
        const subs = q ? c.subs.filter((s) => s.title.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)) : c.subs;
        const pageHref = href("website/section", { url: `${WEB_BASE}${c.url}`, title: c.title });
        return `<article class="web-cat">
          ${c.subs.length
            ? `<button class="web-cat__head" type="button" data-cat="${esc(c.title)}" aria-expanded="${isOpen}">
                 ${icon(c.icon, { size: 24, cls: "web-cat__icon" })}
                 <span class="web-cat__text"><span class="web-cat__title">${esc(c.title)}</span><span class="web-cat__sub">${c.subs.length} items</span></span>
                 ${icon(isOpen ? "expand_less" : "expand_more", { size: 22 })}
               </button>`
            : `<a class="web-cat__head" href="${esc(pageHref)}">
                 ${icon(c.icon, { size: 24, cls: "web-cat__icon" })}
                 <span class="web-cat__text"><span class="web-cat__title">${esc(c.title)}</span></span>
                 ${icon("arrow_forward", { size: 20 })}
               </a>`}
          ${c.subs.length && isOpen ? `<ul class="web-subs">${subs.map((s) => `
            <li><a class="web-sub" href="${esc(href("website/section", { url: s.url, title: s.title }))}">
              <span>${esc(s.title)}</span>${icon("arrow_forward", { size: 16 })}</a></li>`).join("")}</ul>` : ""}
        </article>`;
      }).join("") : emptyState({ icon: "search_off", title: "No matches", body: "Try a different word." })}
      </div>`;
  };

  on(el, "input", "#web-q", debounce(() => {
    query = el.querySelector("#web-q").value;
    paint();
    el.querySelector("#web-q")?.focus();
  }, 120));
  on(el, "click", "[data-cat]", (e, btn) => {
    const t = btn.dataset.cat;
    expanded.has(t) ? expanded.delete(t) : expanded.add(t);
    paint();
  });
  on(el, "click", ".search__clear", () => { query = ""; paint(); });

  paint();
  return () => {};
}

/* ── section ───────────────────────────────────────────────────── */
export async function renderSection(el, { query }) {
  const url = query.url || "";
  const title = query.title || "Website";
  const cat = NAV_CATEGORIES.find((c) => `${WEB_BASE}${c.url}` === url);
  el.innerHTML = screen({
    bar: topBar({ title, actions: url ? extLink("", url, "web-ext-icon") : "" }),
    body: !url
      ? errorCard("No page address was given.")
      : `${card(`
          <p class="web-page__url">${esc(url)}</p>
          <a class="btn btn--filled web-open" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon("open_in_browser", { size: 18 })}<span>Open in a new tab</span></a>`)}
        ${browserNote({ title: "Page not shown here", body: CAMPUS_NOTE, icon: "cloud_off", tone: "warn" })}
        ${cat && cat.subs.length ? `<h2 class="web-h">Related pages</h2><ul class="web-subs web-subs--open">${cat.subs.map((s) => `
          <li><a class="web-sub" href="${esc(href("website/section", { url: s.url, title: s.title }))}"><span>${esc(s.title)}</span>${icon("arrow_forward", { size: 16 })}</a></li>`).join("")}</ul>` : ""}`,
  });
  return () => {};
}

/* ── web view (campus page behind the VPN) ─────────────────────── */
export async function renderWebView(el, { query }) {
  const url = query.url || "";
  const title = query.title || "Web page";
  el.innerHTML = screen({
    bar: topBar({ title }),
    body: !url
      ? errorCard("No page address was given.")
      : `${browserNote({ title: "Needs the Android app", body: CAMPUS_NOTE, icon: "vpn_key", tone: "warn" })}
        ${card(`
          <p class="web-page__title">${esc(title)}</p>
          <p class="web-page__url">${esc(url)}</p>
          <a class="btn btn--filled web-open" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon("open_in_browser", { size: 18 })}<span>Open in a new tab</span></a>`)}`,
  });
  return () => {};
}

/* ── PDF ───────────────────────────────────────────────────────── */
export async function renderPdf(el, { query }) {
  const url = query.url || "";
  const title = query.title || "PDF";
  const showable = url && isHttps(url) && !isCampusUrl(url);
  el.innerHTML = screen({
    bar: topBar({ title }),
    body: !url
      ? errorCard("No document URL provided.")
      : `
        ${card(`
          <p class="web-page__title">${icon("picture_as_pdf", { size: 22 })}<span>${esc(title)}</span></p>
          <div class="pdf-actions">
            <a class="btn btn--filled" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon("open_in_browser", { size: 18 })}<span>Open PDF</span></a>
            ${showable ? `<button class="btn btn--tonal" type="button" data-act="show-pdf">${icon("visibility", { size: 18 })}<span>Show here</span></button>` : ""}
          </div>
          ${showable ? "" : `<p class="fineprint">Campus documents are not shown in this browser. Open them in a new tab, or use the Android app.</p>`}`)}
        <div id="pdf-frame-host"></div>`,
  });
  on(el, "click", "[data-act=show-pdf]", (e, btn) => {
    // Embedded only after this click, and only for public https documents.
    if (!showable) return;
    const host = el.querySelector("#pdf-frame-host");
    host.innerHTML = `<iframe class="pdf-frame" title="${esc(title)}" src="${esc(url)}" referrerpolicy="no-referrer" loading="lazy"></iframe>`;
    btn.disabled = true;
  });
  return () => {};
}

/* ── teaching plans (sample only) ──────────────────────────────── */
export async function renderTeachingPlan(el) {
  let data = null, dept = "", query = "";
  el.innerHTML = screen({
    bar: topBar({ title: "Teaching Plans", actions: `<a class="icon-btn" href="#/concept-tree" aria-label="Concept Tree" title="Concept Tree">${icon("account_tree")}</a>` }),
    body: loading("Loading..."),
  });
  const body = el.querySelector(".screen__body");

  const allCourses = () => data.semesters.flatMap((s) => s.courses.map((c) => ({ ...c, semester: s.label })));
  const matches = (c) => {
    const q = query.trim().toLowerCase();
    if (dept && !c.code.toUpperCase().startsWith(dept)) return false;
    if (!q) return true;
    return [c.code, c.name, c.type, ...(c.instructors || []), c.syllabus || "", c.references || ""].some((v) => v.toLowerCase().includes(q));
  };

  const paint = () => {
    const depts = [...new Set(allCourses().map((c) => c.code.slice(0, 2).toUpperCase()))].sort();
    body.innerHTML = `
      ${sampleBanner("WeLearn")}
      ${searchField({ id: "tp-q", placeholder: "Search courses, instructors, or syllabus...", value: query })}
      <div class="tp-chips">${chip("All", { selected: !dept, a: { "data-dept": "" } })}${depts.map((d) => chip(d, { selected: dept === d, a: { "data-dept": d } })).join("")}</div>
      ${data.semesters.map((s) => {
        const list = s.courses.filter(matches);
        if (!list.length) return "";
        return `<section class="tp-sem">
          <h2 class="tp-sem__title">${esc(s.label)}${s === data.semesters[0] ? ` <span class="tp-current">Current Semester</span>` : ""}</h2>
          ${list.map((c) => `
            <a class="tp-course" href="${esc(href("teaching-plan/course", { url: c.url }))}">
              <span class="tp-course__code">${esc(c.code)}</span>
              <span class="tp-course__cr">${esc(c.credits)} cr</span>
              <span class="tp-course__name">${esc(c.name)}</span>
              <span class="tp-course__meta">${esc(c.type)} · ${esc((c.instructors || []).join(", "))}</span>
            </a>`).join("")}
        </section>`;
      }).join("") || emptyState({ icon: "search_off", title: "No matches", body: "Try another search or department." })}`;
  };

  on(el, "input", "#tp-q", debounce(() => { query = el.querySelector("#tp-q").value; paint(); el.querySelector("#tp-q")?.focus(); }, 150));
  on(el, "click", "[data-dept]", (e, b) => { dept = b.dataset.dept; paint(); });
  on(el, "click", ".search__clear", () => { query = ""; paint(); });

  try {
    const r = await loadTeachingPlans();
    data = { ...r.data, semesters: [...r.data.semesters].sort((a, b) => semesterOrder(b) - semesterOrder(a)) };
    paint();
  } catch (err) {
    body.innerHTML = errorCard(err.message || "Could not load teaching plans.");
  }
  return () => {};
}

/* ── course detail (sample only) ───────────────────────────────── */
export async function renderCourseDetail(el, { query }) {
  const target = query.url || "";
  el.innerHTML = screen({ bar: topBar({ title: "Course details" }), body: loading("Loading course details...") });
  const body = el.querySelector(".screen__body");
  try {
    const r = await loadTeachingPlans();
    let course = null;
    for (const s of r.data.semesters) for (const c of s.courses) if (c.url === target) course = c;
    if (!course) throw new Error("Could not load course details.");
    el.querySelector(".topbar__title").textContent = `${course.code} - ${course.name}`;
    const credit = `${Number(course.credits).toFixed(1)} Credits`;
    body.innerHTML = `
      ${sampleBanner("WeLearn")}
      ${card(`
        <p class="tp-detail__code">${esc(course.code)}</p>
        <p class="tp-detail__name">${esc(course.name)}</p>
        <div class="tp-chips">
          ${course.level ? chip(`Level ${course.level}`, { kind: "info", icon: "book" }) : ""}
          ${chip(course.type, { kind: "info", icon: course.type === "Laboratory" ? "science" : "book" })}
          ${course.credits ? chip(credit, { kind: "info" }) : ""}
        </div>`)}
      ${course.instructors?.length ? card(`<h2 class="tp-h">Instructors</h2>${course.instructors.map((i) => `<p class="tp-line">${icon("person", { size: 18 })}<span>${esc(i)}</span></p>`).join("")}`) : ""}
      ${course.syllabus ? `<details class="tp-fold" open><summary>Syllabus</summary><pre class="tp-text">${esc(course.syllabus)}</pre></details>` : ""}
      ${course.references ? `<details class="tp-fold"><summary>References</summary><pre class="tp-text">${esc(course.references)}</pre></details>` : ""}
      ${course.creditOptions?.length ? card(`<h2 class="tp-h">Credit Options</h2>
        <table class="tp-table"><thead><tr><th>Prog</th><th>Sem</th><th>Choice</th></tr></thead>
        <tbody>${course.creditOptions.map((o) => `<tr><td>${esc(o.programme)}</td><td>${esc(o.semesterNo)}</td><td>${esc(o.courseChoice)}</td></tr>`).join("")}</tbody></table>`) : ""}`;
  } catch (err) {
    body.innerHTML = errorCard(err.message || "Could not load course details.");
  }
  return () => {};
}

/* ── concept tree (browser-local, from the course details above) ── */
export async function renderConceptTree(el) {
  let tree = null, query = "";
  const open = new Set();
  el.innerHTML = screen({ bar: topBar({ title: "Concept Tree" }), body: loading("Building concept tree...") });
  const body = el.querySelector(".screen__body");

  const q = () => query.trim().toLowerCase();
  const hit = (s) => !!s && s.toLowerCase().includes(q());

  // Returns the node if it or a descendant matches; keeps all children when a department name matches.
  const filter = (node) => {
    if (!q()) return node;
    if (node.type === "DEPARTMENT") {
      if (hit(node.label)) return node;
      const kids = node.children.map(filter).filter(Boolean);
      return kids.length ? { ...node, children: kids } : null;
    }
    if (node.type === "COURSE") {
      if (hit(node.label) || hit(node.detail)) return node;
      const kids = node.children.filter((t) => hit(t.label) || hit(t.detail));
      return kids.length ? { ...node, children: kids } : null;
    }
    return hit(node.label) || hit(node.detail) ? node : null;
  };

  const row = (node, depth) => {
    const key = node.type + ":" + node.id;
    const isOpen = q() ? true : open.has(key);
    const hasKids = node.children.length > 0 || (node.type === "TOPIC" && node.detail);
    const icons = { DEPARTMENT: "school", COURSE: "book", TOPIC: "topic" };
    const detail = node.type === "COURSE" && node.detail ? `<span class="ctree-row__detail">${esc(node.detail)}</span>` : "";
    const count = node.type === "COURSE" ? `<span class="ctree-row__count">${node.topicCount} topics</span>` : "";
    const sub = node.type === "DEPARTMENT" ? `<span class="ctree-row__count">${node.children.length} courses</span>` : "";
    const viewCourse = node.type === "COURSE"
      ? `<a class="icon-btn ctree-view" href="${esc(href("teaching-plan/course", { url: courseUrl(node.id) }))}" aria-label="View course">${icon("chevron_right", { size: 20 })}</a>` : "";
    const label = node.type === "TOPIC" ? node.label : node.label;
    return `<li class="ctree-item ctree-item--${node.type.toLowerCase()}" style="--depth:${depth}">
      <div class="ctree-row">
        <button class="ctree-row__main" type="button" data-node="${esc(key)}" aria-expanded="${!!isOpen}" ${hasKids ? "" : "disabled"}>
          ${icon(icons[node.type], { size: 20 })}
          <span class="ctree-row__text"><span class="ctree-row__label">${esc(label)}</span>${detail}${count}${sub}</span>
          ${hasKids ? icon(isOpen ? "expand_less" : "expand_more", { size: 20 }) : ""}
        </button>${viewCourse}
      </div>
      ${isOpen && node.children.length ? `<ul class="ctree-list">${node.children.map((c) => row(c, depth + 1)).join("")}</ul>` : ""}
      ${isOpen && node.type === "TOPIC" ? `<p class="ctree-topic">${esc(node.detail)}</p>` : ""}
    </li>`;
  };

  const courseUrl = (code) => tree.courseUrls[code] || "";

  const paint = () => {
    const nodes = tree.nodes.map(filter).filter(Boolean);
    body.innerHTML = `
      ${sampleBanner("WeLearn")}
      ${searchField({ id: "ctree-q", placeholder: "Search topics, courses, or concepts...", value: query })}
      <div class="ctree-stats">${icon("account_tree", { size: 18 })}
        <span>${tree.stats.departments} depts</span><span>${tree.stats.courses} courses</span><span>${tree.stats.topics} topics</span></div>
      ${nodes.length ? `<ul class="ctree-list ctree-root">${nodes.map((n) => row(n, 0)).join("")}</ul>`
        : emptyState({ icon: "account_tree", title: "No concept data available.", body: "" })}`;
  };

  on(el, "input", "#ctree-q", debounce(() => { query = el.querySelector("#ctree-q").value; paint(); el.querySelector("#ctree-q")?.focus(); }, 150));
  on(el, "click", "[data-node]", (e, b) => {
    const k = b.dataset.node;
    open.has(k) ? open.delete(k) : open.add(k);
    paint();
  });
  on(el, "click", ".search__clear", () => { query = ""; paint(); });

  try {
    const r = await loadTeachingPlans();
    const seen = new Map();
    for (const s of r.data.semesters) for (const c of s.courses) if (!seen.has(c.code)) seen.set(c.code, c);
    const courses = [...seen.values()];
    tree = buildConceptTree(courses);
    tree.courseUrls = Object.fromEntries(courses.map((c) => [c.code, c.url]));
    if (!courses.length) body.innerHTML = emptyState({ icon: "account_tree", title: "No concept data available.", body: "" });
    else paint();
  } catch (err) {
    body.innerHTML = errorCard(`Failed to build concept tree: ${err.message}`);
  }
  return () => {};
}
