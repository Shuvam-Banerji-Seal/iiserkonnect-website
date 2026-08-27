/**
 * core/net.js — campus fetch via the unified serve.py proxy.
 * On campus, just `python3 serve.py` — the page and the proxy are the
 * same origin, so no CORS and no extra config. Off-campus, the proxy
 * still works if you run it locally (or point proxyBase at a campus box).
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

function sid() {
  let s = store.get("sid");
  if (!s) { s = crypto.randomUUID(); store.set("sid", s); }
  return s;
}

/* Resolve the proxy base: same-origin first (serve.py unified), then stored, then legacy */
function candidates() {
  const list = [];
  // same-origin — works when served via `python3 serve.py` (on campus, no config)
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") list.push(location.origin);
  const stored = store.get("proxyBase");
  if (stored) list.push(stored.replace(/\/$/, ""));
  list.push("http://localhost:8787", "http://localhost:8123");
  return [...new Set(list)];
}
let resolvedBase = null;

export function proxyBase() {
  return (resolvedBase || store.get("proxyBase") || candidates()[0]).replace(/\/$/, "");
}

async function proxyFetch(path, init = {}) {
  const base = proxyBase();
  const res = await fetch(base + path + (path.includes("?") ? "&" : "?") + "_=" + Date.now(), {
    ...init,
    cache: "no-store",
    headers: { "X-SID": sid(), ...(init.headers || {}) },
  });
  if (!res.ok && res.status >= 500 && res.headers.get("content-type")?.includes("json")) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `proxy ${res.status}`);
  }
  return res;
}

export async function get(url) {
  const res = await proxyFetch(`/fetch?url=${encodeURIComponent(url)}`);
  const finalUrl = res.headers.get("X-Final-URL") || url;
  const text = await res.text();
  return { ok: res.ok, status: res.status, url: finalUrl, text };
}

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

export async function getBlob(url) {
  const res = await proxyFetch(`/fetch?url=${encodeURIComponent(url)}`);
  return res.blob();
}

export function fileUrl(url) {
  const s = store.get("sid") || sid();
  return `${proxyBase()}/file?url=${encodeURIComponent(url)}&sid=${s}`;
}

/* Probe: try same-origin first, then fallbacks; remember the winner */
export async function probeProxy() {
  for (const base of candidates()) {
    try {
      const r = await fetch(base + "/ping?_=" + Date.now(), { signal: AbortSignal.timeout(2000), cache: "no-store" });
      const j = await r.json();
      if (j.ok) { resolvedBase = base; return { ok: true, mock: !!j.mock, base }; }
    } catch {}
  }
  return { ok: false };
}

export async function clearServerSession() {
  try { await fetch(proxyBase() + "/jar/clear", { method: "POST", headers: { "X-SID": sid() } }); } catch {}
}
