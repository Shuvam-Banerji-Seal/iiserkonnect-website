/** pages/welearn.page.js — courses, files, downloads, deadlines, attendance. */

import { fetchCourses, fetchCourseFiles, downloadUrl, fetchAttendance, fetchDeadlines } from "../services/welearn.service.js";
import { pageHead, card, esc, emptyState, errorState, requireProxy, requireCreds, toast, chip } from "../ui/helpers.js";

let cache = { courses: null, files: {} };

export async function render(el) {
  el.innerHTML = pageHead("WeLearn", "Courses & materials", "Moodle courses, files with one-tap download, deadlines and attendance.");
  const proxy = await requireProxy();
  if (!proxy.ok) return el.insertAdjacentHTML("beforeend", proxy.html);
  const credsOk = requireCreds();
  if (!credsOk.ok) return el.insertAdjacentHTML("beforeend", credsOk.html);

  const mount = document.createElement("div");
  el.appendChild(mount);
  mount.innerHTML = `<div class="page-loading"><span class="spinner"></span> Loading courses…</div>`;

  try {
    if (!cache.courses) cache.courses = await fetchCourses();
    const tabs = ["Files", "Deadlines", "Attendance"];
    mount.innerHTML = `
      <div class="tabbar" role="tablist">
        ${tabs.map((t, i) => `<button class="tab ${i === 0 ? "active" : ""}" data-tab="${t.toLowerCase()}">${t}</button>`).join("")}
      </div>
      <div id="wl-body"></div>`;

    const body = mount.querySelector("#wl-body");
    const show = (tab) => {
      if (tab === "files") renderFiles(body);
      if (tab === "deadlines") renderDeadlines(body);
      if (tab === "attendance") renderAttendance(body);
    };
    mount.querySelectorAll(".tab").forEach((b) =>
      b.onclick = () => {
        mount.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        show(b.dataset.tab);
      });
    show("files");
  } catch (e) {
    mount.innerHTML = errorState(e.message, "welearn");
  }
}

async function renderFiles(body) {
  const courses = cache.courses;
  if (!courses.length) return body.innerHTML = emptyState("📚", "No courses found", "Your Moodle dashboard listed no courses.");
  body.innerHTML = `
    <div class="course-grid">
      ${courses.map((c) => `
        <div class="app-card course-card" data-id="${esc(c.id)}">
          <div class="course-card__head"><strong>${esc(c.title)}</strong>${chip(`id ${c.id}`)}</div>
          <div class="course-card__files body-muted small">Loading files…</div>
        </div>`).join("")}
    </div>`;

  for (const cardEl of body.querySelectorAll(".course-card")) {
    const id = cardEl.dataset.id;
    const course = courses.find((c) => String(c.id) === String(id));
    const slot = cardEl.querySelector(".course-card__files");
    try {
      if (!cache.files[id]) cache.files[id] = await fetchCourseFiles(course);
      const files = cache.files[id];
      slot.innerHTML = files.length
        ? `<ul class="filelist">${files.map((f) => `
            <li>
              ${f.kind === "folder" ? "📁" : fileIcon(f.name)}
              <span class="filelist__name">${esc(f.name)}</span>
              ${f.kind !== "folder" ? `<a class="btn btn--ghost btn--sm" href="${downloadUrl(f.url)}" download>Get</a>` : ""}
            </li>`).join("")}</ul>`
        : `<p>No files listed.</p>`;
    } catch (e) {
      slot.innerHTML = `<p class="err-text">${esc(e.message)}</p>`;
    }
  }
}

const fileIcon = (name) => {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (["pdf"].includes(ext)) return "📕";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "🖼️";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  if (["mp4", "mkv", "webm"].includes(ext)) return "🎬";
  return "📄";
};

async function renderDeadlines(body) {
  body.innerHTML = `<div class="page-loading"><span class="spinner"></span> Scraping assignments…</div>`;
  try {
    const list = await fetchDeadlines(cache.courses);
    body.innerHTML = list.length
      ? `<div class="app-card"><table class="datatable"><thead><tr><th>Course</th><th>Assignment</th><th>Due</th></tr></thead>
         <tbody>${list.map((d) => `<tr><td>${esc(d.course)}</td><td>${esc(d.name)}</td><td>${esc(d.due || "—")}</td></tr>`).join("")}</tbody></table></div>`
      : emptyState("🗓️", "No assignments found", "No /mod/assign pages on your enrolled courses.");
  } catch (e) { body.innerHTML = errorState(e.message, "welearn"); }
}

async function renderAttendance(body) {
  body.innerHTML = `<div class="page-loading"><span class="spinner"></span> Reading attendance modules…</div>`;
  try {
    const list = await fetchAttendance(cache.courses);
    body.innerHTML = list.length ? list.map((a) => `
      ${card(`
        <div class="row-between">
          <strong>${esc(a.course)}</strong>
          <span class="pct-badge ${a.summary.pct >= 75 ? "ok" : "warn"}">${a.summary.pct}%</span>
        </div>
        <p class="tiny body-muted">${a.summary.present} present · ${a.summary.absent} absent · ${a.summary.late} late · ${a.summary.excused} excused (of ${a.summary.total})</p>
        <div class="barchart">
          <div class="barchart__row">
            <span class="barchart__label">Attendance</span>
            <span class="barchart__track"><span class="barchart__fill" style="width:${a.summary.pct}%"></span></span>
            <span class="barchart__value">${a.summary.pct}%</span>
          </div>
        </div>`)}
    `).join("") : emptyState("🧾", "No attendance modules", "None of your courses have a Moodle attendance activity.");
  } catch (e) { body.innerHTML = errorState(e.message, "welearn"); }
}
