/**
 * core/net.js — the browser's stand-in for the app's OkHttp layer.
 * Every campus request goes through the local companion proxy, which owns
 * the cookie jars (per X-SID session) exactly like CookieStore.kt did.
 */

import { store } from "./store.js";

export const C = {
  WELEARN: "https://welearn.iiserkol.ac.in",
  WELEARN_LOGIN: "https://welearn.iiserkol.ac.in/login/index.php",
  WELEARN_MY: "https://welearn.iiserkol.ac.in/my/",
  WELEARN_MYPROFILE: "https://welearn.iiserkol.ac.in/myprofile/",
  WELEARN_MYPROFILE_LOGIN: "https://welearn.iiserkol.ac.in/myprofile/login/",
  WELEARN_MYPROFILE_GRADES: "https://welearn.iiserkol.ac.in/myprofile/grade_card/",
  ERP: "https://www.iiserkol.ac.in",
  ERP_LOGIN: "https://www.iiserkol.ac.in/myprofile/ldap/login/?next=/myprofile/dashboard/",
  ERP_DASHBOARD: "https://www.iiserkol.ac.in/myprofile/dashboard/",
  CANTEEN: "https://newsmerp.iiserkol.ac.in",
  CANTEEN_LOGIN: "https://newsmerp.iiserkol.ac.in/login/",
  CANTEEN_MINI: "https://newsmerp.iiserkol.ac.in/canteen/UserMinistatement/",
  CANTEEN_MENU: "https://newsmerp.iiserkol.ac.in/canteen/",
  CALENDAR: "https://calendar.iiserkol.ac.in",
  EVENTS_CAL: "https://calendar.iiserkol.ac.in/calendar_view/",
  INTRANET: "http://intranet.iiserkol.ac.in",
  WIKI: "http://intranet.iiserkol.ac.in/wiki",
  LIBRARY_HOME: "http://intranet.iiserkol.ac.in/wiki/Library:Home",
  STUDENT_NOTICES: "http://intranet.iiserkol.ac.in/wiki/GenNotice:Students%27Notice_Board",
  ADMIN_NOTICES: "http://intranet.iiserkol.ac.in/wiki/GenNotice:Administration_Notice_Board",
  GW: "https://gw.iiserkol.ac.in",
  MACREG: "https://gw.iiserkol.ac.in/macreg/",
  EPRINTS: "http://eprints.iiserkol.ac.in",
  LIBCAT: "http://lib.iiserkol.ac.in:9000",
  VOIP: "https://www.iiserkol.ac.in/voip-directory/",
  TIMETABLE_PDF: "https://www.iiserkol.ac.in/web/assets/images/ck_editor_image/1769612117_Time-Table-Spring-2026_28.01.2026.pdf",
};

export function proxyBase() {
  return (store.get("proxyBase") || "http://localhost:8787").replace(/\/$/, "");
}

function sid() {
  let s = store.get("sid");
  if (!s) { s = crypto.randomUUID(); store.set("sid", s); }
  return s;
}

async function proxyFetch(path, init = {}) {
  const res = await fetch(proxyBase() + path + (path.includes("?") ? "&" : "?") + "_=" + Date.now(), {
    ...init,
    cache: "no-store",
    headers: { "X-SID": sid(), ...(init.headers || {}) },
  });
  if (res.status === 0 || (!res.ok && res.status >= 500 && res.headers.get("content-type")?.includes("json"))) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `proxy ${res.status}`);
  }
  return res;
}

/** GET a campus URL through the proxy → { ok, status, url, doc|text } */
export async function get(url) {
  const res = await proxyFetch(`/fetch?url=${encodeURIComponent(url)}`);
  const finalUrl = res.headers.get("X-Final-URL") || url;
  const text = await res.text();
  return { ok: res.ok, status: res.status, url: finalUrl, text };
}

/** POST a urlencoded form through the proxy → same shape as get() */
export async function postForm(url, fields) {
  const res = await proxyFetch("/fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, form: fields, method: "POST" }),
  });
  const finalUrl = res.headers.get("X-Final-URL") || url;
  const text = await res.text();
  return { ok: res.ok, status: res.status, url: finalUrl, text };
}

/** Blob for images (captchas) fetched with the session's cookies. */
export async function getBlob(url) {
  const res = await proxyFetch(`/fetch?url=${encodeURIComponent(url)}`);
  return res.blob();
}

/** Direct download link (proxy streams it as an attachment). */
export function fileUrl(url) {
  const s = store.get("sid") || sid();
  return `${proxyBase()}/file?url=${encodeURIComponent(url)}&sid=${s}`;
}

/** Probe the companion. Returns {ok, mock} or {ok:false}. */
export async function probeProxy() {
  try {
    const r = await fetch(proxyBase() + "/ping", { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    return { ok: !!j.ok, mock: !!j.mock };
  } catch { return { ok: false }; }
}

export async function clearServerSession() {
  try { await fetch(proxyBase() + "/jar/clear", { method: "POST", headers: { "X-SID": sid() } }); } catch {}
}
