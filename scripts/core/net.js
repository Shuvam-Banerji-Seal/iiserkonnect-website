/**
 * core/net.js — direct campus fetch. No proxy, no backend.
 * The site is a single-page rerouter: fetch each campus URL, parse
 * with DOMParser, render in-place. On IISERK WiFi/VPN the browser
 * can reach campus directly; off-campus the fetch fails and the page
 * shows a graceful "Open in browser" fallback.
 */

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

/**
 * Direct browser fetch — same as curl on campus, same CORS rules.
 * On campus (campus WiFi / VPN), the browser CAN reach campus hosts
 * when they send CORS headers (most do). Off-campus it fails gracefully.
 */
export async function get(url) {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  const text = await res.text();
  return { ok: res.ok, status: res.status, url: res.url || url, text };
}

export async function postForm(url, fields) {
  const body = new URLSearchParams(fields).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    credentials: "include",
    cache: "no-store",
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, url: res.url || url, text };
}

export async function getBlob(url) {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  return res.blob();
}

export function fileUrl(url) { return url; }
