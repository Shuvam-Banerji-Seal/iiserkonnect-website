/** pages/misc.page.js — PYQ, notices, VoIP: the three list-style screens. */

import { fetchPyqYears, fetchPyqYear, fetchNotices, fetchVoip } from "../services/intranet.service.js";
import { downloadUrl } from "../services/welearn.service.js";
import { C } from "../core/net.js";
import { pageHead, card, esc, errorState, requireProxy, emptyState } from "../ui/helpers.js";

/* ── PYQ ───────────────────────────────────────────────────────── */
export async function renderPyq(el) {
  el.innerHTML = pageHead("PYQ", "Previous year papers", "Year → exam → department, straight from the intranet wiki.");
  const proxy = await requireProxy();
  if (!proxy.ok) return el.insertAdjacentHTML("beforeend", proxy.html);
  const mount = document.createElement("div");
  el.appendChild(mount);
  mount.innerHTML = `<div class="page-loading"><span class="spinner"></span> Loading years…</div>`;
  try {
    const years = await fetchPyqYears();
    if (!years.length) return mount.innerHTML = emptyState("📚", "No PYQ index found", "The wiki page listed no year links.");
    mount.innerHTML = `<div class="chipcloud">${years.map((y) =>
      `<button class="chip chip--accent" data-y="${y.year}">${y.year}</button>`).join("")}</div><div id="pyq-body"></div>`;
    const body = mount.querySelector("#pyq-body");
    mount.querySelectorAll("[data-y]").forEach((b) => {
      b.onclick = async () => {
        body.innerHTML = `<div class="page-loading"><span class="spinner"></span> Loading ${b.dataset.y}…</div>`;
        try {
          const data = await fetchPyqYear(years.find((y) => String(y.year) === b.dataset.y));
          body.innerHTML = data.sections.length ? data.sections.map((s) => card(`
            <h3 class="h3">${esc(s.exam)} · ${esc(s.semester)}</h3>
            <ul class="filelist">${s.depts.map((d) => `
              <li><span class="filelist__name">${esc(d.name)}</span>
              <a class="btn btn--ghost btn--sm" href="${downloadUrl(d.url)}" download>PDF</a></li>`).join("")}
            </ul>`)).join("") : `<p class="body-muted">No sections parsed for ${b.dataset.y}.</p>`;
        } catch (e) { body.innerHTML = errorState(e.message); }
      };
    });
  } catch (e) { mount.innerHTML = errorState(e.message); }
}

/* ── Notice board ──────────────────────────────────────────────── */
export async function renderNotices(el) {
  el.innerHTML = pageHead("Notices", "Notice boards", "Student and administration wiki notices by year.");
  const proxy = await requireProxy();
  if (!proxy.ok) return el.insertAdjacentHTML("beforeend", proxy.html);
  const mount = document.createElement("div");
  el.appendChild(mount);
  mount.innerHTML = `
    <div class="tabbar">
      <button class="tab active" data-tab="student">Students</button>
      <button class="tab" data-tab="admin">Administration</button>
    </div><div id="nb-body"></div>`;
  const body = mount.querySelector("#nb-body");
  const load = (url) => {
    body.innerHTML = `<div class="page-loading"><span class="spinner"></span> Loading notices…</div>`;
    fetchNotices(url).then((list) => {
      body.innerHTML = list.length ? card(`
        <ul class="noticelist">${list.map((n) => `
          <li><span class="chip">${esc(n.year)}</span>
            <span class="filelist__name">${esc(n.title)}</span>
            ${n.link ? `<a class="btn btn--ghost btn--sm" href="${downloadUrl(n.link)}" download>${esc(n.type || "Open")}</a>` : ""}
          </li>`).join("")}</ul>`) : `<p class="body-muted">No notices parsed.</p>`;
    }).catch((e) => body.innerHTML = errorState(e.message));
  };
  mount.querySelectorAll(".tab").forEach((b) => b.onclick = () => {
    mount.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    load(b.dataset.tab === "student" ? C.STUDENT_NOTICES : C.ADMIN_NOTICES);
  });
  load(C.STUDENT_NOTICES);
}

/* ── VoIP directory ────────────────────────────────────────────── */
export async function renderVoip(el) {
  el.innerHTML = pageHead("VoIP", "Telephone directory", "Searchable campus extensions.");
  const proxy = await requireProxy();
  if (!proxy.ok) return el.insertAdjacentHTML("beforeend", proxy.html);
  const mount = document.createElement("div");
  el.appendChild(mount);
  mount.innerHTML = `<div class="page-loading"><span class="spinner"></span> Loading directory…</div>`;
  try {
    const dir = await fetchVoip();
    mount.innerHTML = `
      <p class="body-muted small">Central pilot: <strong class="mono">${esc(dir.pilot)}</strong></p>
      <input class="input" id="voip-q" placeholder="Filter by name / extension / location…" autocomplete="off">
      <div id="voip-body" style="margin-top:14px"></div>`;
    const body = mount.querySelector("#voip-body");
    const draw = (query = "") => {
      const qy = query.trim().toLowerCase();
      const secs = dir.sections.map((s) => ({
        ...s,
        contacts: qy ? s.contacts.filter((c) =>
          c.name.toLowerCase().includes(qy) || c.ext.toLowerCase().includes(qy) || c.location.toLowerCase().includes(qy)) : s.contacts,
      })).filter((s) => qy ? s.contacts.length : s.contacts.length);
      body.innerHTML = secs.length ? secs.map((s) => card(`
        <h3 class="h3">${esc(s.title)}</h3>
        <table class="datatable"><tbody>${s.contacts.map((c) => `
          <tr><td>${esc(c.name)}</td><td class="mono">${esc(c.ext)}</td><td class="body-muted small">${esc(c.location)}</td></tr>`).join("")}
        </tbody></table>`)).join("") : `<p class="body-muted">No matches.</p>`;
    };
    mount.querySelector("#voip-q").oninput = (e) => draw(e.target.value);
    draw();
  } catch (e) { mount.innerHTML = errorState(e.message); }
}
