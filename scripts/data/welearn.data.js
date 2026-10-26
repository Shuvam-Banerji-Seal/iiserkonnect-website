/**
 * data/welearn.data.js — WeLearn (Moodle) courses, course files, the
 * browser-local downloads list and notification read marks.
 *
 * Courses and files go live only where the browser can reach WeLearn;
 * otherwise services/source.js returns the made-up sample. Notifications have
 * no live path here (the Moodle web service needs a sign-in from the campus
 * network), so they always come from the sample.
 */

import { load } from "../services/source.js";
import { fetchCourses, fetchCourseFiles } from "../services/welearn.service.js";
import { collection } from "../core/db.js";
import { C } from "../core/net.js";

const kv = () => collection("kv");

/** { data: { courses: [{ id, title, url, files? }] }, sample, stale, cachedAt, error } */
export function loadCourses({ force = false } = {}) {
  return load("welearn", async () => ({ courses: await fetchCourses() }), force ? { maxAgeMs: 0 } : undefined);
}

/** Files of one course. Sample files are made up; live ones link to the campus pages. */
export async function loadCourseFiles(courseId, courseTitle = "") {
  const r = await loadCourses();
  const course = r.data.courses.find((c) => String(c.id) === String(courseId));
  if (r.sample) {
    const files = (course?.files || []).map((f) => ({ name: f.name, kind: f.kind, depth: f.depth || 0, description: f.description || "", url: "", sample: true }));
    return { files, sample: true };
  }
  const liveCourse = course || { id: courseId, title: courseTitle, url: `${C.WELEARN}/course/view.php?id=${encodeURIComponent(courseId)}` };
  const found = await fetchCourseFiles(liveCourse);
  return {
    files: found.map((f) => ({
      name: f.name, kind: f.kind === "folder" ? "folder" : "file", depth: 0, description: "", url: f.url, sample: false,
    })),
    sample: false,
  };
}

/** Notifications: sample only in a browser. */
export async function loadNotifications() {
  const r = await load("welearn-notifications");
  return r.data.notifications.map((n) => ({
    id: n.id, course: n.course, subject: n.subject, body: n.body,
    at: Date.now() - n.hoursAgo * 3600_000, read: !!n.read,
  }));
}

/* ── browser-local lists (kv collection) ───────────────────────── */
const DOWNLOADS = "welearn.downloads";
const NOTIF_READ = "welearn.notifRead";

async function readKv(id, fallback) {
  try { const r = await kv().get(id); return r && r.value !== undefined ? r.value : fallback; } catch { return fallback; }
}
async function writeKv(id, value) {
  try { await kv().put({ id, value }); } catch { /* storage unavailable: nothing to remember */ }
}

/** Files the user opened from this browser, newest first. */
export const listDownloads = () => readKv(DOWNLOADS, []);

export async function rememberDownload({ name, course, url }) {
  const all = await listDownloads();
  const rest = all.filter((d) => d.url !== url);
  const next = [{ id: String(Date.now()) + Math.random().toString(36).slice(2, 6), name, course, url, at: Date.now() }, ...rest].slice(0, 200);
  await writeKv(DOWNLOADS, next);
  return next;
}
export async function forgetDownload(id) {
  const next = (await listDownloads()).filter((d) => d.id !== id);
  await writeKv(DOWNLOADS, next);
  return next;
}
export const clearDownloads = () => writeKv(DOWNLOADS, []);

export const readNotificationIds = () => readKv(NOTIF_READ, []);
export async function markNotificationRead(id) {
  const ids = await readNotificationIds();
  if (!ids.includes(id)) await writeKv(NOTIF_READ, [...ids, id]);
}

/** Browser-side file type (filename extension), as CourseFilesScreen.getFileTypeIcon. */
export function fileKind(name = "") {
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx", "odt", "rtf", "txt"].includes(ext)) return "doc";
  if (["ppt", "pptx", "odp"].includes(ext)) return "slides";
  if (["xls", "xlsx", "ods", "csv"].includes(ext)) return "sheet";
  if (["jpg", "jpeg", "png", "gif", "svg", "bmp", "webp"].includes(ext)) return "image";
  if (["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "flac", "aac"].includes(ext)) return "audio";
  if (["py", "java", "kt", "c", "cpp", "h", "js", "html", "css", "xml", "json"].includes(ext)) return "code";
  return "file";
}
