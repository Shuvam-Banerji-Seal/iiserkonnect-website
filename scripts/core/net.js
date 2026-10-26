/**
 * core/net.js — direct campus fetch, for a browser that can reach campus.
 *
 * There is no proxy and no backend. A request goes straight from this browser
 * to the campus host. In practice campus servers do not send CORS headers, and
 * the intranet is plain http, so most browsers refuse these requests from a
 * different website; services/source.js then shows clearly-labelled sample
 * data instead. With Settings → Advanced → "Data source: Sample data only",
 * nothing is ever sent to a campus host.
 */

import { prefs } from "./prefs.js";

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
  ACCOUNT_RESET: "https://www.iiserkol.ac.in/account/",
  CANTEEN: "https://newsmerp.iiserkol.ac.in",
  CANTEEN_LOGIN: "https://newsmerp.iiserkol.ac.in/login/",
  CANTEEN_MINI: "https://newsmerp.iiserkol.ac.in/canteen/UserMinistatement/",
  CANTEEN_MENU: "https://newsmerp.iiserkol.ac.in/canteen/",
  CANTEEN_QR_BILLING: "https://newsmerp.iiserkol.ac.in/canteen/qrCode/",
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
  WEBSITE: "https://www.iiserkol.ac.in",
};

/** Thrown whenever live campus data is not available, for whatever reason. */
export class CampusUnavailable extends Error {
  constructor(reason, url) {
    super(reason === "sample-only" ? "Sample data only (Settings → Advanced)" : "Campus server not reachable from this browser");
    this.name = "CampusUnavailable";
    this.reason = reason;
    this.url = url;
  }
}

export const sampleOnly = () => prefs.get("dataSource") === "sample";

async function req(url, init) {
  if (sampleOnly()) throw new CampusUnavailable("sample-only", url);
  let res;
  try { res = await fetch(url, { credentials: "include", cache: "no-store", ...init }); }
  catch { throw new CampusUnavailable("network", url); }
  if (!res.ok && res.status !== 302) throw new CampusUnavailable("http-" + res.status, url);
  return res;
}

export async function get(url) {
  const res = await req(url);
  return { ok: res.ok, status: res.status, url: res.url || url, text: await res.text() };
}

export async function postForm(url, fields) {
  const res = await req(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
  return { ok: res.ok, status: res.status, url: res.url || url, text: await res.text() };
}

export async function getBlob(url) {
  const res = await req(url);
  return res.blob();
}

export function fileUrl(url) { return url; }
