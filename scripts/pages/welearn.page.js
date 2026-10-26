/**
 * pages/welearn.page.js — the WeLearn tab: sign-in (WeLearnLoginScreen), My
 * Courses (CourseListScreen), course files (CourseFilesScreen), Downloads
 * (DownloadQueueScreen) and Notifications (NotificationsScreen).
 *
 * A browser cannot keep a WeLearn session of its own (WeLearn does not accept
 * sign-ins started from another website), so courses load live only where
 * the browser can reach WeLearn and otherwise show labelled sample data.
 * Files open in a new tab when the user asks for them; the browser keeps the
 * downloaded copies, and this page only remembers which files were opened.
 */

import { prefs } from "../core/prefs.js";
import { creds } from "../core/session.js";
import { nav, seg } from "../core/router.js";
import { C } from "../core/net.js";
import { esc, on, ago } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, button, checkbox, chip, textField, browserNote, sampleBanner, errorCard, emptyState, loading, linearProgress, extLink, listHeading } from "../ui/components.js";
import { confirm, dialog, snackbar } from "../ui/overlay.js";
import { loadCourses, loadCourseFiles, loadNotifications, listDownloads, rememberDownload, forgetDownload, clearDownloads, readNotificationIds, markNotificationRead, fileKind } from "../data/welearn.data.js";
import { dueFormat } from "../data/deadlines.data.js";

const WELEARN_HOME = `${C.WELEARN}/my/`;
const SAMPLE_FILE = "This is a sample file. The demo has no real file behind it, so nothing was downloaded.";
const KIND_ICON = { pdf: "picture_as_pdf", doc: "description", slides: "slideshow", sheet: "table_chart", image: "image", video: "videocam", audio: "audio_file", code: "code", file: "insert_drive_file", folder: "folder", note: "article" };
const KIND_TONE = { pdf: "error", doc: "primary", slides: "tertiary", sheet: "secondary", image: "tertiary", video: "error", audio: "secondary", code: "primary", file: "primary" };

/* ═══════════════════ WeLearn Login ═══════════════════ */
export async function renderLogin(el, ctx) {
  if (!(ctx && ctx.query && ctx.query.form) && (prefs.get("welearnLoginSkipped") || creds.has())) {
    nav.go("welearn/courses", { replace: true });
    return;
  }
  let remember = false;
  el.innerHTML = screen({
    bar: topBar({ title: "WeLearn Login" }),
    body: `
      <div class="wl-login">
        <div class="wl-login__hero">
          <span class="wl-login__icon">${icon("school", { size: 48 })}</span>
          <h2 class="t-headline-s">WeLearn Course Portal</h2>
        </div>
        <div class="card card--high wl-login__card">
          <form class="stack-sm" id="wl-form" autocomplete="on">
            ${textField({ id: "wl-user", label: "Username", a: { autocomplete: "username", autocapitalize: "none", spellcheck: "false", required: true } })}
            ${textField({ id: "wl-pass", label: "Password", type: "password", a: { autocomplete: "current-password", required: true },
              trailing: `<button type="button" class="icon-btn" data-act="show-pass" aria-label="Toggle password" title="Toggle password">${icon("visibility")}</button>` })}
            <button type="button" class="wl-check" role="checkbox" aria-checked="false" data-act="remember">
              <span class="checkbox__box">${icon("check", { size: 16 })}</span><span>Remember credentials</span>
            </button>
            <button class="btn btn--filled btn--block" type="submit" id="wl-login" disabled>Login</button>
            <div class="row-between">
              <a class="ext-link" href="${esc(C.WELEARN_LOGIN)}" target="_blank" rel="noopener noreferrer">Open WeLearn${icon("open_in_new", { size: 16 })}</a>
              <button class="btn btn--text" type="button" data-act="skip">Skip login for now</button>
            </div>
          </form>
        </div>
        ${browserNote({
          icon: "cloud_off", tone: "warn", title: "WeLearn does not accept sign-ins from other websites",
          body: "WeLearn is a Moodle site and only answers the campus network. This page can save your username and password in this browser only (if you tick Remember credentials). Courses load live only where this browser can reach WeLearn; otherwise you get clearly marked sample courses.",
        })}
      </div>`,
  });

  const user = el.querySelector("#wl-user"), pass = el.querySelector("#wl-pass"), go = el.querySelector("#wl-login");
  const sync = () => { go.disabled = !(user.value.trim() && pass.value); };
  user.addEventListener("input", sync);
  pass.addEventListener("input", sync);
  on(el, "click", "[data-act=show-pass]", (e, b) => {
    const show = pass.type === "password";
    pass.type = show ? "text" : "password";
    b.innerHTML = icon(show ? "visibility_off" : "visibility");
  });
  on(el, "click", "[data-act=remember]", (e, b) => {
    remember = !remember;
    b.setAttribute("aria-checked", String(remember));
    b.querySelector(".checkbox__box").classList.toggle("is-on", remember);
  });
  el.querySelector("#wl-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const u = user.value.trim(), p = pass.value;
    if (!u || !p) return;
    if (remember) creds.save(u, p);
    prefs.set("welearnLoginSkipped", false);
    snackbar(remember
      ? "Saved in this browser only. WeLearn needs the campus network, so courses show sample data here."
      : "Not saved. WeLearn needs the campus network, so courses show sample data here.");
    nav.go("welearn/courses", { replace: true });
  });
  on(el, "click", "[data-act=skip]", () => {
    prefs.set("welearnLoginSkipped", true);
    snackbar("Login skipped for now. You can sign in later from the WeLearn tab.");
    nav.go("welearn/courses", { replace: true });
  });
}

/* ═══════════════════ My Courses ═══════════════════ */
export async function renderCourses(el) {
  el.innerHTML = screen({
    bar: topBar({
      title: "My Courses",
      actions: [
        `<a class="icon-btn" href="#/deadlines" aria-label="Deadlines" title="Deadlines">${icon("event_note")}</a>`,
        `<a class="icon-btn" href="#/welearn/downloads" aria-label="Downloads" title="Downloads">${icon("cloud_download")}</a>`,
        `<a class="icon-btn" href="${esc(WELEARN_HOME)}" target="_blank" rel="noopener noreferrer" aria-label="Open Web" title="Open Web">${icon("language")}</a>`,
        iconBtn("refresh", "Refresh", { "data-act": "refresh" }),
      ].join(""),
    }),
    body: `<div id="wl-courses">${linearProgress()}${loading("Scanning courses...")}</div>`,
  });
  const body = el.querySelector("#wl-courses");

  const paint = (r) => {
    const { data, sample, stale } = r;
    const courses = data.courses || [];
    const status = sample ? "" : stale ? "Using cached data" : `Updated ${ago(r.cachedAt || Date.now())}`;
    body.innerHTML = `
      ${sample ? sampleBanner("WeLearn") : ""}
      ${status ? `<p class="t-body-s c-primary wl-status">${esc(status)}</p>` : ""}
      ${courses.length ? `<div class="stack-sm">${courses.map((c) => `
        <a class="card card--low card--prism wl-course" href="#/welearn/courses/${seg(c.id)}/${seg(c.title)}/files">
          <span class="t-title-m">${esc(c.title)}</span>
          <span class="t-body-s c-muted">Course ID: ${esc(c.id)}</span>
        </a>`).join("")}</div>`
        : errorCard("No courses found.", { retry: true })}
      ${browserNote({
        icon: "info", tone: "info", title: "Offline copies are an Android feature",
        body: "The app can keep WeLearn files on the phone for offline use. A browser cannot keep that kind of copy, so files open from WeLearn each time you ask for them.",
      })}
      ${sample ? `<p class="t-body-s"><a href="#/welearn/login?form=1">Sign in to WeLearn</a> to try live courses from this browser.</p>` : ""}`;
  };
  const load = async (force) => {
    body.innerHTML = `${linearProgress()}${loading("Scanning courses...")}`;
    try { paint(await loadCourses({ force })); }
    catch (e) { body.innerHTML = errorCard(e.message || "Could not load courses.", { retry: true }); }
  };
  on(el, "click", "[data-act=retry],[data-act=refresh]", () => load(true));
  await load(false);
}

/* ═══════════════════ Course files ═══════════════════ */
export async function renderFiles(el, ctx) {
  const courseId = ctx.params.courseId, title = ctx.params.courseTitle || "Course files";
  let files = [], isSample = false, selected = new Set(), expanded = new Set();

  el.innerHTML = screen({
    bar: topBar({
      title,
      actions: [
        iconBtn("download", "Download all files", { "data-act": "all" }),
        iconBtn("select_all", "Select All", { "data-act": "select-all" }),
      ].join(""),
    }),
    body: `<div id="wl-files">${linearProgress()}${loading("Scanning files...")}</div>`,
    fab: `<span class="fab-slot-empty"></span>`,
  });
  const body = el.querySelector("#wl-files");
  const fabSlot = () => el.querySelector(".fab-slot");
  const downloadable = () => files.map((f, i) => ({ f, i })).filter(({ f }) => f.kind === "file");

  const paintFab = () => {
    const n = selected.size;
    const slot = fabSlot();
    if (!slot) return;
    slot.innerHTML = n ? `<button class="fab fab--extended" type="button" data-act="download-selected">${icon("download")}<span>Download (${n})</span></button>` : "";
  };

  const paint = () => {
    if (!files.length) {
      body.innerHTML = `${isSample ? sampleBanner("WeLearn") : ""}${errorCard("Nothing in this course yet — no files and no instructions posted.")}`;
      return;
    }
    body.innerHTML = `${isSample ? sampleBanner("WeLearn") : ""}
      <div class="wl-files stack-xs">${files.map((f, i) => {
        const kind = f.kind === "note" ? "note" : f.kind === "folder" ? "folder" : fileKind(f.name);
        const ic = KIND_ICON[kind] || "insert_drive_file";
        const tone = KIND_TONE[kind] || "primary";
        const pad = 16 + f.depth * 24;
        const canDownload = f.kind === "file";
        const open = !canDownload ? "" : f.sample
          ? `<button class="icon-btn" type="button" data-act="sample-file" aria-label="Open file" title="Open file">${icon("open_in_new")}</button>`
          : `<a class="icon-btn" href="${esc(f.url)}" target="_blank" rel="noopener noreferrer" data-live="${i}" aria-label="Open file" title="Open file">${icon("open_in_new")}</a>`;
        const hasDesc = !!f.description;
        const isOpen = expanded.has(i);
        return `<div class="wl-file" style="padding-left:${pad}px">
          <div class="wl-file__row">
            ${canDownload ? checkbox(selected.has(i), `Select ${f.name}`, { "data-act": "select", "data-i": i }) : `<span class="wl-file__spacer"></span>`}
            <span class="wl-file__icon wl-tone--${tone}">${icon(ic)}</span>
            <span class="wl-file__name ${f.kind === "folder" ? "t-title-s" : "t-body-m"}">${esc(f.name)}</span>
            ${open}
          </div>
          ${hasDesc ? `<div class="wl-file__desc">
            <button class="btn btn--text btn--sm" type="button" data-act="toggle-desc" data-i="${i}" aria-expanded="${isOpen}">${icon(isOpen ? "expand_less" : "expand_more", { size: 18 })}<span>${isOpen ? "Hide instructions" : "Show instructions"}</span></button>
            ${isOpen ? `<p class="t-body-m c-muted">${esc(f.description)}</p>` : ""}
          </div>` : ""}
        </div>`;
      }).join("")}</div>`;
    paintFab();
  };

  const load = async () => {
    body.innerHTML = `${linearProgress()}${loading("Scanning files...")}`;
    try {
      const r = await loadCourseFiles(courseId, title);
      files = r.files; isSample = r.sample;
      expanded = new Set(files.map((f, i) => (f.kind === "note" ? i : -1)).filter((i) => i >= 0));
      paint();
    } catch (e) {
      body.innerHTML = errorCard(e.message || "Could not load files.", { retry: true });
    }
  };

  on(el, "click", "[data-act=select]", (e, b) => {
    const i = +b.dataset.i;
    selected.has(i) ? selected.delete(i) : selected.add(i);
    b.setAttribute("aria-checked", String(selected.has(i)));
    b.classList.toggle("is-on", selected.has(i));
    paintFab();
  });
  on(el, "click", "[data-act=select-all]", () => {
    const all = downloadable();
    const allOn = all.length && all.every(({ i }) => selected.has(i));
    selected = allOn ? new Set() : new Set(all.map(({ i }) => i));
    body.querySelectorAll("[data-act=select]").forEach((b) => {
      const on_ = selected.has(+b.dataset.i);
      b.setAttribute("aria-checked", String(on_));
      b.classList.toggle("is-on", on_);
    });
    paintFab();
  });
  on(el, "click", "[data-act=toggle-desc]", (e, b) => {
    const i = +b.dataset.i;
    expanded.has(i) ? expanded.delete(i) : expanded.add(i);
    paint();
  });
  on(el, "click", "[data-act=sample-file]", () => snackbar(SAMPLE_FILE));
  on(el, "click", "[data-live]", (e, a) => { rememberDownload({ name: files[+a.dataset.live].name, course: title, url: a.href }); });

  // Download all / Download (n): live files open one tab each (the browser may ask to allow pop-ups)
  const queue = (list) => {
    if (!list.length) return;
    if (isSample) { snackbar(SAMPLE_FILE); return; }
    list.forEach(({ f }) => {
      window.open(f.url, "_blank", "noopener,noreferrer");
      rememberDownload({ name: f.name, course: title, url: f.url });
    });
    snackbar(list.length === 1 ? "Opened in a new tab. Your browser keeps the file." : `Opened ${list.length} files in new tabs. Your browser may ask to allow pop-ups.`);
  };
  on(el, "click", "[data-act=all]", () => queue(downloadable()));
  on(el, "click", "[data-act=download-selected]", () => queue(downloadable().filter(({ i }) => selected.has(i))));

  await load();
  return () => {};
}

/* ═══════════════════ Downloads ═══════════════════ */
export async function renderDownloads(el) {
  el.innerHTML = screen({
    bar: topBar({ title: "Downloads", actions: iconBtn("clear_all", "Clear completed", { "data-act": "clear" }) }),
    body: `<div id="wl-dl">${loading()}</div>`,
  });
  const body = el.querySelector("#wl-dl");

  const paint = async () => {
    const items = await listDownloads();
    const now = Date.now();
    body.innerHTML = `
      ${browserNote({
        icon: "info", tone: "info", title: "Where the files are",
        body: "Your browser downloads the files itself, so they sit in your browser's downloads. This list only remembers which WeLearn and PYQ files you opened in this browser.",
      })}
      ${items.length ? `<div class="stack-xs mt-sm">${items.map((d) => `
        <div class="card card--high wl-dl-item">
          <span class="wl-dl-item__icon">${icon(KIND_ICON[fileKind(d.name)] || "insert_drive_file", { size: 32 })}</span>
          <div class="grow">
            <div class="t-title-s ellipsis">${esc(d.name)}</div>
            <div class="t-body-s c-muted ellipsis">${esc(d.course || "")}</div>
            <div class="t-label-m c-tertiary">Opened ${esc(ago(d.at, now))} · Tap to open again</div>
          </div>
          ${d.url ? `<a class="icon-btn" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open file" title="Open file">${icon("open_in_new", { size: 18 })}</a>` : ""}
          <button class="icon-btn" type="button" data-act="forget" data-id="${esc(d.id)}" aria-label="Delete" title="Delete">${icon("delete", { size: 18 })}</button>
        </div>`).join("")}</div>`
        : emptyState({ icon: "cloud_download", title: "No downloads yet.", body: "Downloaded files from WeLearn and PYQ will appear here." })}`;
  };

  on(el, "click", "[data-act=forget]", async (e, b) => { await forgetDownload(b.dataset.id); paint(); });
  on(el, "click", "[data-act=clear]", async () => {
    const items = await listDownloads();
    if (!items.length) return;
    if (await confirm({ title: "Clear completed", text: "Remove every file from this list? The files stay in your browser's downloads.", confirmLabel: "Clear", danger: true })) {
      await clearDownloads();
      paint();
    }
  });
  await paint();
}

/* ═══════════════════ Notifications ═══════════════════ */
export async function renderNotifications(el) {
  el.innerHTML = screen({
    bar: topBar({ title: "Notifications", actions: iconBtn("refresh", "Refresh", { "data-act": "refresh" }) }),
    body: `<div id="wl-notif">${loading()}</div>`,
  });
  const body = el.querySelector("#wl-notif");
  let items = [];

  const paint = async () => {
    const readIds = await readNotificationIds();
    const unread = (n) => !n.read && !readIds.includes(n.id);
    body.innerHTML = `
      ${sampleBanner("WeLearn")}
      ${items.length ? `<div class="stack-sm mt-sm">${items.map((n, i) => `
        <button class="card card--low wl-notif${unread(n) ? " wl-notif--unread" : ""}" type="button" data-act="open" data-i="${i}" aria-label="Open notification: ${esc(n.subject)}">
          <span class="wl-notif__dot" aria-hidden="true"></span>
          <span class="wl-notif__body">
            <span class="wl-notif__head">
              <span class="wl-tag">${esc(n.course)}</span>
              <span class="${unread(n) ? "w-bold" : "w-semi"} wl-notif__subject">${esc(n.subject.replace(new RegExp("^" + n.course + ":\\s*"), ""))}</span>
            </span>
            <span class="t-label-m c-muted">${esc(dueFormat(n.at))}</span>
            <span class="t-body-s c-muted wl-notif__text">${esc(n.body)}</span>
          </span>
        </button>`).join("")}</div>`
        : `<div class="card card--high mt-sm"><p class="t-title-s w-semi">No notifications</p><p class="t-body-s c-muted">Announcements and feedback from your courses will appear here.</p></div>`}`;
  };

  const load = async () => {
    items = await loadNotifications();
    await paint();
  };
  on(el, "click", "[data-act=refresh]", () => { load(); });
  on(el, "click", "[data-act=open]", async (e, b) => {
    const n = items[+b.dataset.i];
    await markNotificationRead(n.id);
    await dialog({
      title: n.subject,
      body: `<p class="wl-tag">${esc(n.course)}</p>
        <p class="t-label-m c-muted">${esc(dueFormat(n.at))}</p>
        <p class="t-body-m">${esc(n.body || "This notification has no message body.")}</p>
        ${extLink("Open in WeLearn", WELEARN_HOME, "mt-sm")}`,
      actions: [{ label: "Close", value: null, variant: "text" }],
    });
    paint();
  });
  await load();
}
