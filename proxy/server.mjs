#!/usr/bin/env node
/**
 * IISERKonnect Web — companion proxy
 * -----------------------------------
 * Plays the role of the Android app's OkHttp layer: server-side fetches to
 * campus hosts with per-session cookie jars, so the browser frontend (bound
 * by CORS) can log in and scrape exactly like the native app.
 *
 *   node proxy/server.mjs            # real mode (needs campus network/VPN)
 *   node proxy/server.mjs --mock     # demo mode with built-in fixtures
 *   PORT=8787 HOST=127.0.0.1 ...     # env overrides
 *
 * Security: binds to loopback by default and ONLY proxies an allow-list of
 * campus hosts. It is not an open proxy.
 */

import http from "node:http";
import crypto from "node:crypto";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const MOCK = process.argv.includes("--mock");

/* ── campus host allow-list ──────────────────────────────────────── */
const ALLOWED = [
  "welearn.iiserkol.ac.in",
  "www.iiserkol.ac.in",
  "iiserkol.ac.in",
  "newsmerp.iiserkol.ac.in",
  "intranet.iiserkol.ac.in",
  "calendar.iiserkol.ac.in",
  "gw.iiserkol.ac.in",
  "eprints.iiserkol.ac.in",
  "lib.iiserkol.ac.in",
  "helpdesk.iiserkol.ac.in",
  "iiserkol.samarth.edu.in",
  "10.0.20.20", "10.0.50.50", "10.0.50.51", "10.0.50.52",
];
const allowed = (u) => {
  try { return ALLOWED.includes(new URL(u).hostname); }
  catch { return false; }
};

/* ── per-session cookie jars ─────────────────────────────────────── */
const jars = new Map(); // sid -> Map<host, Map<name,value>>
const jarOf = (sid) => {
  if (!jars.has(sid)) jars.set(sid, new Map());
  return jars.get(sid);
};
const storeCookies = (sid, host, res) => {
  const jar = jarOf(sid);
  if (!jar.has(host)) jar.set(host, new Map());
  const list = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie() : [];
  for (const raw of list) {
    const [pair] = raw.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.get(host).set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
};
const cookieHeader = (sid, host) => {
  const m = jarOf(sid).get(host);
  if (!m || m.size === 0) return "";
  return [...m].map(([k, v]) => `${k}=${v}`).join("; ");
};

/* ── mock fixtures ───────────────────────────────────────────────── */
const F = new Map(); // url matcher string → handler(sid, jar, body) => {status, html, type}
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF", "utf8");

if (MOCK) {
  const set = (k, fn) => F.set(k, fn);

  // WeLearn login
  set("welearn.iiserkol.ac.in/login/index.php", (sid, jar, body, method) => {
    const logged = jar.get("_wl") === "1";
    if (method === "POST") {
      const ok = body?.get("password") !== "wrong";
      jar.set("_wl", ok ? "1" : "0");
      return { html: ok ? mockDashboard() : mockLoginFailed() };
    }
    return { html: logged ? mockDashboard() : mockLoginPage() };
  });
  set("welearn.iiserkol.ac.in/my/", () => ({ html: mockDashboard() }));
  set("welearn.iiserkol.ac.in/course/view.php", () => ({ html: mockCourse() }));
  set("welearn.iiserkol.ac.in/mod/attendance/view.php", () => ({ html: mockAttendance() }));
  set("welearn.iiserkol.ac.in/pluginfile.php", () => ({ bytes: PDF_BYTES, type: "application/pdf" }));
  set("welearn.iiserkol.ac.in/mod/resource/view.php", (s, jar, b, m) =>
    m === "GET" && new URL("x", "http://x").searchParams ? { bytes: PDF_BYTES, type: "application/pdf" } : { html: "<html/>" });

  // Canteen ERP
  set("newsmerp.iiserkol.ac.in/login/", (sid, jar, body, method) => {
    if (method === "POST") {
      const ok = body?.get("password") !== "wrong";
      if (ok) jar.set("sessionid", "mock-session");
      return { html: ok ? "<html><body>Logged in as mockuser</body></html>" : "<html><body>Bad</body></html>" };
    }
    return { html: `<form><input name="csrfmiddlewaretoken" value="MOCKCSRF"></form>` };
  });
  set("newsmerp.iiserkol.ac.in/canteen/UserMinistatement/", (sid, jar, body, method) => {
    if (method === "POST" && body?.get("choice") === "range") return { html: mockStatement(true) };
    if (method === "POST") return { html: mockStatement(false) };
    return { html: `<form><input name="csrfmiddlewaretoken" value="MOCKCSRF"></form>` };
  });
  set("newsmerp.iiserkol.ac.in/canteen/", () => ({ html: mockMenu() }));

  // Gateway macreg
  set("gw.iiserkol.ac.in/macreg/", (sid, jar, body, method) => {
    if (method === "POST") {
      const ok = (body?.get("captcha_1") || "").toUpperCase() === "MOCK";
      if (ok) jar.set("_gw", "1");
      return { html: ok ? mockGatewayDevices() : mockGatewayLogin() };
    }
    return { html: jar.get("_gw") === "1" ? mockGatewayDevices() : mockGatewayLogin() };
  });
  set("gw.iiserkol.ac.in/macreg/captcha", () => ({ svg: "MOCK" }));

  // MyProfile (grades)
  set("welearn.iiserkol.ac.in/myprofile/login/", (sid, jar, body, method) => {
    if (method === "POST") {
      const ok = (body?.get("captcha_1") || "").toUpperCase() === "MOCK";
      if (ok) jar.set("_mp", "1");
      return { html: ok ? mockGradeCard(1) : mockMyProfileLogin() };
    }
    return { html: jar.get("_mp") === "1" ? mockGradeCard(1) : mockMyProfileLogin() };
  });
  set("welearn.iiserkol.ac.in/myprofile/grade_card/", (sid, jar, b, m, url) => {
    const sem = Number((url.match(/grade_card\/(\d+)/) || [])[1] || 1);
    return { html: mockGradeCard(sem) };
  });
  set("welearn.iiserkol.ac.in/myprofile/captcha", () => ({ svg: "MOCK" }));

  // Calendars
  set("calendar.iiserkol.ac.in/calendar_view/", (s, jar, b, m, url) =>
    ({ html: url.includes("event") || url === "https://calendar.iiserkol.ac.in/calendar_view/" && !url.includes("view_mode")
        ? mockEventsWeek() : mockAcademicWeek() }));

  // Intranet wiki
  set("intranet.iiserkol.ac.in/wiki/Library:Home", () => ({ html: mockLibraryHome() }));
  set("intranet.iiserkol.ac.in/wiki/Library:Old_Question_Papers_(2025)", () => ({ html: mockPyq() }));
  set("intranet.iiserkol.ac.in/wiki/GenNotice", () => ({ html: mockNotices() }));
  set("intranet.iiserkol.ac.in/wiki/Main_Page", () => ({ html: "<html><body><p>Intranet up</p></body></html>" }));
  set("www.iiserkol.ac.in/voip-directory/", () => ({ html: mockVoip() }));

  // ePrints — SPECIFIC matchers first (Map iterates insertion order)
  set("eprints.iiserkol.ac.in/cgi/latest_tool", () => ({ html: mockEprintsRss(), type: "application/rss+xml" }));
  set("eprints.iiserkol.ac.in/view/divisions/dps/2025.html", () => ({ html: mockEprintsList() }));
  set("eprints.iiserkol.ac.in/view/divisions/dcs/2025.html", () => ({ html: mockEprintsList() }));
  set("eprints.iiserkol.ac.in/view/divisions/dps/", () => ({ html: mockEprintsYears() }));
  set("eprints.iiserkol.ac.in/view/divisions/dcs/", () => ({ html: mockEprintsYears() }));
  set("eprints.iiserkol.ac.in/view/divisions/", () => ({ html: mockEprintsDivisions() }));
  set("eprints.iiserkol.ac.in/view/year/2", () => ({ html: mockEprintsList() }));
  set("eprints.iiserkol.ac.in/view/year/", () => ({ html: mockEprintsYears() }));
  set("eprints.iiserkol.ac.in/2157/document.pdf", () => ({ bytes: PDF_BYTES, type: "application/pdf" }));
  set("eprints.iiserkol.ac.in/2157/", () => ({ html: mockEprintsItem() }));

  // Library catalogue
  set("lib.iiserkol.ac.in:9000/search/query", (sid, jar, body, method) => {
    if (method === "POST") return { html: mockLibraryResults() };
    return { html: mockLibrarySearchForm() };
  });
  set("lib.iiserkol.ac.in:9000/search/quickSearch", () => ({ html: mockLibraryResults() }));
  set("lib.iiserkol.ac.in:9000/lib/item", () => ({ html: mockLibraryItem() }));
  set("lib.iiserkol.ac.in:9000/record=", () => ({ html: mockLibraryItem() }));

  // Netmon
  set("gw.iiserkol.ac.in/live/", (s, jar, b, m, url) =>
    url.includes("index.html") ? { html: mockHostDetail() } : { html: mockSkipole() });
  set("gw.iiserkol.ac.in/mrtg/", () => ({ html: mockMrtg() }));
}

/* ── mock fixture HTML ──────────────────────────────────────────── */
function mockLoginPage() {
  return `<html><body><form action="/login/index.php" method="post">
    <input type="hidden" name="logintoken" value="MOCKTOKEN">
    <input name="username"><input name="password" type="password">
    <button>Login</button></form></body></html>`;
}
function mockLoginFailed() {
  return `<html><body><div class="loginerrors">Invalid login, please try again</div>${mockLoginPage()}</body></html>`;
}
function mockDashboard() {
  const c = (id, t) =>
    `<a class="list-group-item list-group-item-action" href="https://welearn.iiserkol.ac.in/course/view.php?id=${id}">Course: ${t}</a>`;
  return `<html><body>
    <a href="/login/logout.php">Logout</a>
    ${c(101, "PH4201 Quantum Mechanics")}
    ${c(102, "CS3102 Data Structures")}
    ${c(103, "MA4104 Real Analysis")}
  </body></html>`;
}
function mockCourse() {
  return `<html><body>
    <a href="https://welearn.iiserkol.ac.in/mod/resource/view.php?id=9001">Lecture 1 Notes</a>
    <a href="https://welearn.iiserkol.ac.in/mod/folder/view.php?id=9002">Problem Sets</a>
    <a href="https://welearn.iiserkol.ac.in/pluginfile.php/123/mod_resource/content/1/sol.pdf">Solutions PDF</a>
  </body></html>`;
}
function mockAttendance() {
  const row = (d, st) => `<tr><td>${d}</td><td>10:00 AM</td><td></td><td class="${st.toLowerCase()}">${st}</td><td>2</td><td></td></tr>`;
  return `<html><body><table class="generaltable attwidth"><thead><tr>
    <th>Session</th><th>Time</th><th>Description</th><th>Status</th><th>Points</th><th>Remarks</th>
  </tr></thead><tbody>
    ${row("Mon 10 Aug 2026", "Present")}${row("Mon 03 Aug 2026", "Absent")}
    ${row("Mon 27 Jul 2026", "Present")}${row("Mon 20 Jul 2026", "Late")}
  </tbody></table></body></html>`;
}
const txnRow = (dt, items, cost, type, added, mode, bal) =>
  `<tr><td>${items}</td><td>${cost}</td><td>${type}</td><td>${added}</td><td>${mode}</td><td>${bal}</td><td>${dt}</td><td></td></tr>`;
function mockStatement(full) {
  const rows = full
    ? txnRow("2026:08:20 13:05:11", "Rice:1:12|Dal:1:25", 37, "Debited", "", "", 812.5) +
      txnRow("2026:08:19 20:10:02", "Dinner", 45, "Debited", "", "", 849.5) +
      txnRow("2026:08:15 11:00:00", "", "", "Credited", "2000", "Online", 894.5)
    : txnRow("2026:08:24 13:02:44", "Rice:1:12|Dal:1:25", 37, "Debited", "", "", 775.5);
  return `<html><body><table><tr><th>Food Taken</th></tr>${rows}</table></body></html>`;
}
function mockMenu() {
  const item = (t) => `<tr bgcolor="#dae5f4"><td>${t}</td></tr>`;
  const meal = (t) => `<tr bgcolor="#b8d1f3"><td>${t}:</td></tr>`;
  return `<html><body><div class="tmenucon"><div class="headerText">Today's Menu</div><table>
    ${meal("BreakFast")}${item("1.Boiled egg(N) 1pc.")}${item("2.Cornflakes")}
    ${meal("Lunch")}${item("1.Rice")}${item("2.Dal Tadka")}<tr bgcolor="#dae5f4"><td>3.<div class="blink_me">Special Paneer</div></td></tr>
    ${meal("Snacks")}${item("1.Tea")} ${meal("Dinner")}${item("1.Chapati")}${item("2.Mixed Veg")}
  </table></div></body></html>`;
}
function mockGatewayLogin() {
  return `<html><body><form action="/macreg/login/?next=/macreg/" method="post">
    <input name="csrfmiddlewaretoken" value="MOCKGW">
    <input name="captcha_0" value="abc123hash">
    <img class="captcha" src="/macreg/captcha/image/abc123hash/">
    <input name="username"><input name="password"><input name="captcha_1">
  </form></body></html>`;
}
function mockGatewayDevices() {
  const r = (n, mac) => `<tr><td>${n}</td><td>${mac}</td><td>Laptop</td><td>HAB</td><td>2026-01-01</td><td>2027-01-01</td></tr>`;
  return `<html><body>Logged in as mockuser<table>
    <tr><th colspan="6">Current TCP Count for All Devices</th><th colspan="2">34654</th></tr>
    ${r(1, "AA:BB:CC:DD:EE:01")}${r(2, "AA:BB:CC:DD:EE:02")}
  </table></body></html>`;
}
function mockMyProfileLogin() {
  return `<html><body><form action="/myprofile/login/" method="post">
    <input name="csrfmiddlewaretoken" value="MOCKMP">
    <input name="captcha_0" value="mp123hash">
    <img class="captcha" src="/myprofile/captcha/image/mp123hash/">
    <input name="username"><input name="password"><input name="captcha_1">
  </form></body></html>`;
}
function mockGradeCard(sem) {
  const c = (n, code, name, g) => `<tr><td>${n}</td><td>${code}</td><td>${name}</td><td>${g}</td></tr>`;
  return `<html><body><table id="studentinfo"><tr><td>Semester No: ${sem}</td></tr>
    <tr><td>SGPA: ${(8 + sem * 0.1).toFixed(2)}</td></tr><tr><td>CGPA: 8.42</td></tr></table>
    <table id="tathyatable"><tr><th>Sl</th><th>Code</th><th>Course</th><th>Grade</th></tr>
    ${c(1, "PH4201", "Quantum Mechanics II", "A")}${c(2, "MA4104", "Real Analysis", "A-")}
    </table></body></html>`;
}
function mockAcademicWeek() {
  const ev = (id, txt, cls) => `<a class="entry ${cls}" id="${id}" href="#">${txt}</a>`;
  const dl = (id, time, venue) => `<dl class="popup" id="eventinfo-${id}">
    <dt>Time:</dt><dd>${time}</dd><dt>Venue:</dt><dd>${venue}</dd></dl>`;
  return `<html><body><div class="topnav"><span class="date">August 24 – 30, 2026</span></div>
    <a class="prev" href="https://calendar.iiserkol.ac.in/calendar_view/20260817/?view_mode=week">prev</a>
    <a class="next" href="https://calendar.iiserkol.ac.in/calendar_view/20260831/?view_mode=week">next</a>
    <table class="main"><tr>
      <th class="empty"></th><th class="mon today"><a>Mon<br/>24 Aug</a></th><th class="tue"><a>Tue<br/>25 Aug</a></th>
    </tr>
    <tr></tr>
    <tr><th class="row">8:00hr</th><td class="mon">${ev("pop101", "08:00 PH4201", "event1")}</td><td></td></tr>
    <tr><th class="row">10:00hr</th><td></td><td class="tue">${ev("pop102", "10:00 MA4104 (Tut)", "event2")}</td></tr>
    </table>
    <select id="venue"><option>LHC 101</option><option>Asima Theatre</option></select>
    ${dl("pop101", "8:00 a.m. - 9:30 a.m.", "LHC 201")}
    ${dl("pop102", "10:00 a.m. - 11:00 a.m.", "LHC 101")}
    </body></html>`;
}
function mockEventsWeek() {
  const dl = (id, t, v, d) => `<dl class="popup" id="eventinfo-${id}">
    <dt>Time:</dt><dd>${t}</dd><dt>Venue:</dt><dd>${v}</dd><dt>Description:</dt><dd>${d}</dd></dl>`;
  return `<html><body><span class="date">August 24 – 30, 2026</span>
    <a class="prev" href="https://calendar.iiserkol.ac.in/calendar_view/20260817/">prev</a>
    <a class="next" href="https://calendar.iiserkol.ac.in/calendar_view/20260831/">next</a>
    <table class="main"><tr><th class="row"></th><th class="mon today"><a>Mon<br/>24 Aug</a></th></tr>
    <tr><th class="row">14:00hr</th><td class="mon seminar"><a class="entry" id="pop201" href="#">14:30 Physics Colloquium</a></td></tr></table>
    ${dl("pop201", "2:30 p.m. - 4:00 p.m.", "Asima Theatre", "Topological phases of matter")}
    </body></html>`;
}
function mockLibraryHome() {
  return `<html><body><div id="mw-content-text">
    <h2><span class="mw-headline" id="Library_News">Library News</span></h2><p>New e-journals added this month.</p>
    <h2><span class="mw-headline" id="Old_Question_Papers">Old Question Papers</span></h2>
    <p><a href="/wiki/Library:Old_Question_Papers_(2025)">2025</a></p>
    <h2><span class="mw-headline" id="Quick_Links">Quick Links</span></h2>
    <p><a href="http://lib.iiserkol.ac.in:9000/search/query?theme=iiserk">OPAC</a></p>
  </div></body></html>`;
}
function mockPyq() {
  const p = (dept, f) => `<p>${dept} <span class="plainlinks"><a href="http://intranet.iiserkol.ac.in/w/images/${f}" title="${f}">${dept} Paper</a></span></p>`;
  return `<html><body><div id="mw-content-text">
    <font size="4">Mid Semester</font><p><b>Autumn</b></p>
    ${p("Physics", "phy_mid_2025.pdf")}${p("Mathematics", "math_mid_2025.pdf")}
    <font size="4">End Semester</font>
    ${p("Physics", "phy_end_2025.pdf")}
  </div></body></html>`;
}
function mockNotices() {
  return `<html><body><div id="mw-content-text">
    <h2>2026</h2><li><a href="/w/images/notice1.pdf">Hostel allotment notice [PDF]</a></li>
    <li>Registration deadline extended</li>
    <h2>2025</h2><li><a href="/w/images/notice2.pdf">Scholarship notice [PDF]</a></li>
  </div></body></html>`;
}
function mockVoip() {
  const sec = (id, t, rows) => `<section id="${id}"><h2>${t}</h2><table><tbody>
    ${rows.map(([n, e, l]) => `<tr><td>${n}</td><td>${e}</td><td>${l}</td></tr>`).join("")}
  </tbody></table></section>`;
  return `<html><body><mark>Central Pilot: +91-33-6136-0000</mark>
    ${sec("admin", "Administration", [["Dean Office", "5001", "Admin Block"]])}
    ${sec("academics", "Academics", [["Physics Office", "5102", "PSB"]])}
  </body></html>`;
}
function mockEprintsRss() {
  const it = (id, t, d) => `<item><title>${t}</title><link>http://eprints.iiserkol.ac.in/${id}/</link>
    <description>${d}</description></item>`;
  return `<rss><channel>${it(2157, "Topological Phases", "Kumar, Ram Nandan (2025) Topological Phases. PhD thesis, IISER Kolkata.")}
    ${it(2156, "Cold Atoms", "Doe, Jane (2025) Cold Atoms. Journal article.")}</channel></rss>`;
}
function mockEprintsDivisions() {
  return `<html><body><a href="dps/">Department of Physical Sciences</a>
    <a href="dcs/">Department of Chemical Sciences</a></body></html>`;
}
function mockEprintsYears() {
  return `<html><body><a href="2025.html">2025</a><a href="2024.html">2024</a></body></html>`;
}
function mockEprintsList() {
  return `<html><body><p><span class="person_name">Kumar, Ram Nandan</span> (2025)
    <a href="http://eprints.iiserkol.ac.in/2157/"><em>Topological Phases of Matter.</em></a>
    PhD thesis, Indian Institute of Science Education and Research Kolkata.</p></body></html>`;
}
function mockEprintsItem() {
  return `<html><head><title>Topological Phases of Matter (2025)</title></head><body>
    <h2>Abstract</h2><p>We study topological phases.</p>
    <span class="person_name">Kumar, Ram Nandan</span>
    <a href="http://eprints.iiserkol.ac.in/2157/document.pdf">Download PDF</a></body></html>`;
}
function mockLibrarySearchForm() {
  return `<html><body><form action="../search/quickSearch" method="post">
    <input name="query"></form></body></html>`;
}
function mockLibraryResults() {
  return `<html><body>
    <a href="/record=b1234~S9*eng/lib/item?id=b1234">Gravitation / Misner</a><p>QC 173 .M57</p>
    <a href="/record=b1235~S9*eng/lib/item?id=b1235">QED / Feynman</a><p>QC 680 .F45</p>
  </body></html>`;
}
function mockLibraryItem() {
  const row = (a, b) => `<tr><td>${a}</td><td>${b}</td></tr>`;
  return `<html><body><h1>Gravitation / Misner</h1><table>
    ${row("Author", "Misner, Charles W.")}${row("Publication", "Freeman, 1973")}
    </table><table><tr><th>Location</th><th>Barcode</th><th>Item Class</th><th>Units</th><th>Copy</th><th>Status</th><th>Call</th></tr>
    <tr><td>Main Library</td><td>03234</td><td>Book</td><td>1</td><td>1</td><td>Available</td><td>QC 173</td></tr>
    </table></body></html>`;
}
function mockSkipole() {
  return `<html><body>
    <a class="whitegroup" href="1.html">Core</a>
    <a class="greenhost" href="1/index.html">Router</a>
    <a class="redhost" href="2/index.html">Backup Link</a>
    <a class="whitegroup" href="3.html">Hostels</a>
    <a class="greenhost" href="3/index.html">HAB Switch</a>
  </body></html>`;
}
function mockHostDetail() {
  return `<html><head><title>Router</title></head><body>
    <h1 class="is_green">Router<span class="description">Core gateway</span></h1>
    <p class="is_white">Aug 24, 2026 - 03:20</p>
    <div class="graphimage"><img src="log.png"></div>
    <iframe id="logs" src="log.html"></iframe></body></html>`;
}
function mockMrtg() {
  return `<html><body>
    <IMG ALT="Core Router Traffic Graph" SRC="core-day.png">
    <IMG ALT="Uplink Traffic Graph" SRC="uplink-day.png">
  </body></html>`;
}

/* ── proxy core ─────────────────────────────────────────────────── */
const UA = "Mozilla/5.0 (Linux; Android 12; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function json(res, code, obj) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-SID",
  });
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const sid = req.headers["x-sid"] || url.searchParams.get("sid") || "anon";
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, X-SID", "Cache-Control": "no-store" };

  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }

  /* ping / jar management */
  if (url.pathname === "/ping") {
    return json(res, 200, { ok: true, mock: MOCK, name: "iiserk-proxy", version: 1 });
  }
  if (url.pathname === "/jar/clear") {
    jars.delete(sid); return json(res, 200, { ok: true });
  }

  /* file download (streams as attachment) */
  if (url.pathname === "/file") {
    const target = url.searchParams.get("url");
    if (!allowed(target)) return json(res, 403, { error: "host not allowed" });
    try {
      const upstream = await fetch(target, {
        headers: { "User-Agent": UA, Cookie: cookieHeader(sid, new URL(target).hostname) },
        redirect: "follow",
      });
      storeCookies(sid, new URL(target).hostname, upstream);
      const cd = upstream.headers.get("content-disposition") || "";
      const name = (cd.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i)?.[1] || "download.bin")
        .replace(/["']/g, "");
      res.writeHead(200, {
        ...cors,
        "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${decodeURIComponent(name)}"`,
      });
      const reader = upstream.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      return res.end();
    } catch (e) { return json(res, 502, { error: String(e) }); }
  }

  /* main fetch endpoint */
  if (url.pathname === "/fetch") {
    let target, form = null, method = "GET";
    if (req.method === "POST") {
      try {
        const body = JSON.parse(await readBody(req));
        target = body.url; form = body.form || null; method = body.method || "POST";
      } catch { return json(res, 400, { error: "bad json" }); }
    } else {
      target = url.searchParams.get("url");
    }
    if (!target) return json(res, 400, { error: "missing url" });
    if (!allowed(target)) return json(res, 403, { error: `host not allowed: ${new URL(target).hostname}` });

    /* mock interception */
    if (MOCK) {
      const u = new URL(target);
      const hostPath = u.host + u.pathname;
      for (const [key, fn] of F) {
        if (hostPath.includes(key) || hostPath.startsWith(key.split("?")[0])) {
          const jar = jarOf(sid);
          let body = null;
          if (form) { body = new Map(Object.entries(form)); jar.set(`_last:${key}`, "1"); }
          const out = fn(sid, jar, body, method, target);
          const host = u.hostname;
          const h = { ...cors, "Content-Type": "text/html; charset=utf-8", "Access-Control-Expose-Headers": "X-Final-URL", "X-Final-URL": target };
          if (out.bytes) { h["Content-Type"] = out.type; delete h["Content-Type"]; h["Content-Type"] = out.type; res.writeHead(200, h); return res.end(out.bytes); }
          if (out.svg) { h["Content-Type"] = "image/svg+xml"; res.writeHead(200, h); return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="140" height="48"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="60%" font-size="24" text-anchor="middle" font-family="monospace">${out.svg}</text></svg>`); }
          res.writeHead(out.status || 200, h);
          return res.end(out.html ?? "");
        }
      }
    }

    /* real fetch */
    const host = new URL(target).hostname;
    const headers = { "User-Agent": UA, Referer: new URL(target).origin };
    const ck = cookieHeader(sid, host);
    if (ck) headers.Cookie = ck;
    const init = { method, headers, redirect: "follow" };
    if (form) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      init.body = new URLSearchParams(form).toString();
    }
    try {
      const upstream = await fetch(target, init);
      storeCookies(sid, host, upstream);
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, {
        ...cors,
        "Content-Type": upstream.headers.get("content-type") || "text/html; charset=utf-8",
        "Access-Control-Expose-Headers": "X-Final-URL",
        "X-Final-URL": upstream.url || target,
      });
      return res.end(buf);
    } catch (e) {
      return json(res, 502, { error: `upstream failed: ${e.cause?.code || e.message}` });
    }
  }

  json(res, 404, { error: "unknown route" });
});

server.listen(PORT, HOST, () => {
  console.log(`iiserk-proxy on http://${HOST}:${PORT}  (mock: ${MOCK})`);
  console.log(`allow-list: ${ALLOWED.length} campus hosts`);
});
