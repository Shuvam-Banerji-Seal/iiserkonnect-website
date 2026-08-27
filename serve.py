#!/usr/bin/env python3
"""
IISERKonnect Web — unified dev server

Serves the static frontend AND proxies campus requests (CORS bypass)
with per-session cookie jars, exactly like the Node companion did.

  python3 serve.py              # real — needs campus/VPN for intranet
  python3 serve.py --mock       # demo fixtures, no campus needed
  python3 serve.py 3000 --mock  # custom port

On campus, every page "just works" — the browser fetches same-origin
/fetch?url=... which this server forwards with its cookies.
"""

import http.server
import urllib.request
import urllib.parse
import urllib.error
import json
import sys
import re
from http.cookies import SimpleCookie

PORT = 8123
MOCK = "--mock" in sys.argv
for a in sys.argv[1:]:
    if a.isdigit():
        PORT = int(a)

ALLOWED = {
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
    "10.0.20.20",
    "10.0.50.50",
    "10.0.50.51",
    "10.0.50.52",
}
UA = "Mozilla/5.0 (Linux; Android 12; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"

# per-SID jars: sid -> {host -> {name: value}}
JARS = {}
PDF_BYTES = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"


def allowed(url):
    try:
        return urllib.parse.urlparse(url).hostname in ALLOWED
    except:
        return False


def jar_of(sid):
    if sid not in JARS:
        JARS[sid] = {}
    return JARS[sid]


def store_cookies(sid, host, headers):
    jar = jar_of(sid)
    if host not in jar:
        jar[host] = {}
    for h in headers.get_all("Set-Cookie", []):
        c = SimpleCookie(h)
        for k, v in c.items():
            jar[host][k] = v.value


def cookie_header(sid, host):
    jar = jar_of(sid)
    m = jar.get(host, {})
    return "; ".join(f"{k}={v}" for k, v in m.items()) if m else ""


# ---------- mock fixtures ----------
def mock_login_page():
    return '<html><body><form action="/login/index.php" method="post"><input type="hidden" name="logintoken" value="MOCKTOKEN"><input name="username"><input name="password" type="password"><button>Login</button></form></body></html>'


def mock_login_failed():
    return (
        '<html><body><div class="loginerrors">Invalid login, please try again</div>'
        + mock_login_page()
        + "</body></html>"
    )


def mock_dashboard():
    return '<html><body><a href="/login/logout.php">Logout</a><a class="list-group-item list-group-item-action" href="https://welearn.iiserkol.ac.in/course/view.php?id=101">Course: PH4201 Quantum Mechanics</a><a class="list-group-item list-group-item-action" href="https://welearn.iiserkol.ac.in/course/view.php?id=102">Course: CS3102 Data Structures</a><a class="list-group-item list-group-item-action" href="https://welearn.iiserkol.ac.in/course/view.php?id=103">Course: MA4104 Real Analysis</a></body></html>'


def mock_course():
    return '<html><body><a href="https://welearn.iiserkol.ac.in/mod/resource/view.php?id=9001">Lecture 1 Notes</a><a href="https://welearn.iiserkol.ac.in/mod/folder/view.php?id=9002">Problem Sets</a><a href="https://welearn.iiserkol.ac.in/pluginfile.php/123/mod_resource/content/1/sol.pdf">Solutions PDF</a></body></html>'


def mock_attendance():
    return '<html><body><table class="generaltable attwidth"><thead><tr><th>Session</th><th>Time</th><th>Description</th><th>Status</th><th>Points</th><th>Remarks</th></tr></thead><tbody><tr><td>Mon 10 Aug 2026</td><td>10:00 AM</td><td></td><td>Present</td><td>2</td><td></td></tr></tbody></table></body></html>'


def mock_menu():
    return '<html><body><div class="tmenucon"><div class="headerText">Today\'s Menu</div><table><tr bgcolor="#b8d1f3"><td>BreakFast:</td></tr><tr bgcolor="#dae5f4"><td>1.Boiled egg(N) 1pc.</td></tr><tr bgcolor="#b8d1f3"><td>Lunch:</td></tr><tr bgcolor="#dae5f4"><td>1.Rice</td></tr><tr bgcolor="#dae5f4"><td>3.<div class="blink_me">Special Paneer</div></td></tr></table></div></body></html>'


def mock_gateway_login():
    return '<html><body><form action="/macreg/login/?next=/macreg/" method="post"><input name="csrfmiddlewaretoken" value="MOCKGW"><input name="captcha_0" value="abc123hash"><img class="captcha" src="/macreg/captcha/image/abc123hash/"><input name="username"><input name="password"><input name="captcha_1"></form></body></html>'


def mock_gateway_devices():
    return '<html><body>Logged in as mockuser<table><tr><th colspan="6">Current TCP Count for All Devices</th><th colspan="2">34654</th></tr><tr><td>1</td><td>AA:BB:CC:DD:EE:01</td><td>Laptop</td><td>HAB</td><td>2026-01-01</td><td>2027-01-01</td></tr></table></body></html>'


def mock_myprofile_login():
    return '<html><body><form action="/myprofile/login/" method="post"><input name="csrfmiddlewaretoken" value="MOCKMP"><input name="captcha_0" value="mp123hash"><img class="captcha" src="/myprofile/captcha/image/mp123hash/"><input name="username"><input name="password"><input name="captcha_1"></form></body></html>'


def mock_grade(sem=1):
    return f'<html><body><table id="studentinfo"><tr><td>Semester No: {sem}</td></tr><tr><td>SGPA: {8 + sem * 0.1:.2f}</td></tr><tr><td>CGPA: 8.42</td></tr></table><table id="tathyatable"><tr><th>Sl</th><th>Code</th><th>Course</th><th>Grade</th></tr><tr><td>1</td><td>PH4201</td><td>Quantum</td><td>A</td></tr></table></body></html>'


def mock_academic_week():
    return '<html><body><div class="topnav"><span class="date">August 24 – 30, 2026</span></div><table class="main"><tr><th class="empty"></th><th class="mon today"><a>Mon<br/>24 Aug</a></th><th class="tue"><a>Tue<br/>25 Aug</a></th></tr><tr></tr><tr><th class="row">8:00hr</th><td class="mon"><a class="entry event1" id="pop101" href="#">08:00 PH4201</a></td><td></td></tr><tr><th class="row">10:00hr</th><td></td><td class="tue"><a class="entry event2" id="pop102" href="#">10:00 MA4104 (Tut)</a></td></tr></table><dl class="popup" id="eventinfo-pop101"><dt>Time:</dt><dd>8:00 a.m. - 9:30 a.m.</dd><dt>Venue:</dt><dd>LHC 201</dd></dl></body></html>'


MOCK_ROUTES = [
    (
        "welearn.iiserkol.ac.in/login/index.php",
        lambda sid, jar, body, method, url: (
            mock_dashboard()
            if jar.get("_wl") == "1" and method == "GET"
            else (
                mock_login_failed()
                if method == "POST" and body and body.get("password") == "wrong"
                else (
                    mock_dashboard() if method == "POST" and body else mock_login_page()
                )
            ),
            None,
        ),
    ),
]


def mock_response(url, sid, jar, body, method):
    if not MOCK:
        return None
    host_path = urllib.parse.urlparse(url).hostname + urllib.parse.urlparse(url).path
    # welearn
    if "welearn.iiserkol.ac.in/login/index.php" in host_path:
        logged = jar.get("_wl") == "1"
        if method == "POST":
            ok = body.get("password") != "wrong" if body else False
            jar["_wl"] = "1" if ok else "0"
            return (mock_dashboard() if ok else mock_login_failed(), "text/html")
        return (mock_dashboard() if logged else mock_login_page(), "text/html")
    if (
        host_path.startswith("welearn.iiserkol.ac.in/my/")
        or host_path == "welearn.iiserkol.ac.in/my"
    ):
        return (mock_dashboard(), "text/html")
    if "welearn.iiserkol.ac.in/course/view.php" in host_path:
        return (mock_course(), "text/html")
    if "welearn.iiserkol.ac.in/mod/attendance" in host_path:
        return (mock_attendance(), "text/html")
    if "welearn.iiserkol.ac.in/pluginfile.php" in host_path:
        return (PDF_BYTES, "application/pdf")
    if "newsmerp.iiserkol.ac.in/login/" in host_path:
        if method == "POST":
            ok = body.get("password") != "wrong" if body else False
            if ok:
                jar["sessionid"] = "mock-session"
            return (
                "<html><body>Logged in as mockuser</body></html>"
                if ok
                else "<html><body>Bad</body></html>",
                "text/html",
            )
        return (
            '<form><input name="csrfmiddlewaretoken" value="MOCKCSRF"></form>',
            "text/html",
        )
    if "newsmerp.iiserkol.ac.in/canteen/UserMinistatement" in host_path:
        if method == "POST":
            return (
                "<html><body><table><tr><th>Food Taken</th></tr><tr><td>Rice:1:12|Dal:1:25</td><td>37</td><td>Debited</td><td></td><td></td><td>813</td><td>2026:08:20 13:05:11</td><td></td></tr></table></body></html>",
                "text/html",
            )
        return (
            '<form><input name="csrfmiddlewaretoken" value="MOCKCSRF"></form>',
            "text/html",
        )
    if "newsmerp.iiserkol.ac.in/canteen/" in host_path:
        return (mock_menu(), "text/html")
    if "gw.iiserkol.ac.in/macreg/" in host_path:
        if method == "POST":
            ok = (body.get("captcha_1", "").upper() == "MOCK") if body else False
            if ok:
                jar["_gw"] = "1"
            return (mock_gateway_devices() if ok else mock_gateway_login(), "text/html")
        return (
            mock_gateway_devices() if jar.get("_gw") == "1" else mock_gateway_login(),
            "text/html",
        )
    if "gw.iiserkol.ac.in/macreg/captcha" in host_path:
        return (
            b'<svg xmlns="http://www.w3.org/2000/svg" width="140" height="48"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="60%" font-size="24" text-anchor="middle" font-family="monospace">MOCK</text></svg>',
            "image/svg+xml",
        )
    if "welearn.iiserkol.ac.in/myprofile/login" in host_path:
        if method == "POST":
            ok = (body.get("captcha_1", "").upper() == "MOCK") if body else False
            if ok:
                jar["_mp"] = "1"
            return (mock_grade(1) if ok else mock_myprofile_login(), "text/html")
        return (
            mock_grade(1) if jar.get("_mp") == "1" else mock_myprofile_login(),
            "text/html",
        )
    if "welearn.iiserkol.ac.in/myprofile/grade_card" in host_path:
        import re as _re

        m = _re.search(r"grade_card/(\d+)", url)
        sem = int(m.group(1)) if m else 1
        return (mock_grade(sem), "text/html")
    if "welearn.iiserkol.ac.in/myprofile/captcha" in host_path:
        return (
            b'<svg xmlns="http://www.w3.org/2000/svg" width="140" height="48"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="60%" font-size="24" text-anchor="middle" font-family="monospace">MOCK</text></svg>',
            "image/svg+xml",
        )
    if "calendar.iiserkol.ac.in/calendar_view" in host_path:
        return (mock_academic_week(), "text/html")
    if "intranet.iiserkol.ac.in/wiki/Library:Home" in host_path:
        return (
            '<html><body><div id="mw-content-text"><h2><span class="mw-headline" id="Library_News">Library News</span></h2><p>New journals.</p><h2><span class="mw-headline" id="Old_Question_Papers">Old Question Papers</span></h2><p><a href="/wiki/Library:Old_Question_Papers_(2025)">2025</a></p></div></body></html>',
            "text/html",
        )
    if "intranet.iiserkol.ac.in/wiki/Library:Old_Question_Papers" in host_path:
        return (
            '<html><body><div id="mw-content-text"><font size="4">Mid Semester</font><p><b>Autumn</b></p><p>Physics <span class="plainlinks"><a href="http://intranet.iiserkol.ac.in/w/images/phy_mid_2025.pdf">Physics Paper</a></span></p></div></body></html>',
            "text/html",
        )
    if "intranet.iiserkol.ac.in/wiki/GenNotice" in host_path:
        return (
            '<html><body><div id="mw-content-text"><h2>2026</h2><li><a href="/w/images/notice1.pdf">Hostel notice [PDF]</a></li></div></body></html>',
            "text/html",
        )
    if "www.iiserkol.ac.in/voip-directory" in host_path:
        return (
            '<html><body><mark>Central Pilot: +91-33-6136-0000</mark><section id="admin"><h2>Administration</h2><table><tbody><tr><td>Dean Office</td><td>5001</td><td>Admin Block</td></tr></tbody></table></section></body></html>',
            "text/html",
        )
    if "eprints.iiserkol.ac.in/cgi/latest_tool" in host_path:
        return (
            "<rss><channel><item><title>Topological Phases</title><link>http://eprints.iiserkol.ac.in/2157/</link><description>Kumar (2025) Topological Phases. PhD.</description></item></channel></rss>",
            "application/rss+xml",
        )
    if "eprints.iiserkol.ac.in/view/divisions/dps/2025.html" in host_path:
        return (
            '<html><body><p><span class="person_name">Kumar</span> (2025) <a href="http://eprints.iiserkol.ac.in/2157/"><em>Topological Phases.</em></a> PhD.</p></body></html>',
            "text/html",
        )
    if "eprints.iiserkol.ac.in/view/divisions/dps/" in host_path:
        return (
            '<html><body><a href="2025.html">2025</a><a href="2024.html">2024</a></body></html>',
            "text/html",
        )
    if "eprints.iiserkol.ac.in/view/divisions/" in host_path:
        return (
            '<html><body><a href="dps/">Physical Sciences</a><a href="dcs/">Chemical Sciences</a></body></html>',
            "text/html",
        )
    if "eprints.iiserkol.ac.in/view/year/" in host_path:
        return ('<html><body><a href="2025.html">2025</a></body></html>', "text/html")
    if "eprints.iiserkol.ac.in/2157/" in host_path and "document.pdf" not in host_path:
        return (
            '<html><head><title>Topological Phases (2025)</title></head><body><h2>Abstract</h2><p>We study.</p><span class="person_name">Kumar</span><a href="http://eprints.iiserkol.ac.in/2157/document.pdf">PDF</a></body></html>',
            "text/html",
        )
    if "eprints.iiserkol.ac.in/2157/document.pdf" in host_path:
        return (PDF_BYTES, "application/pdf")
    if "lib.iiserkol.ac.in:9000/search/quickSearch" in host_path:
        return (
            '<html><body><a href="/record=b1234~S9*eng/lib/item?id=b1234">Gravitation / Misner</a><p>QC 173</p></body></html>',
            "text/html",
        )
    if "lib.iiserkol.ac.in:9000/search/query" in host_path:
        return (
            '<html><body><form action="../search/quickSearch" method="post"><input name="query"></form></body></html>',
            "text/html",
        )
    if (
        "lib.iiserkol.ac.in:9000/record=" in host_path
        or "lib.iiserkol.ac.in:9000/lib/item" in host_path
    ):
        return (
            "<html><body><h1>Gravitation / Misner</h1><table><tr><td>Author</td><td>Misner</td></tr></table><table><tr><th>Location</th><th>Barcode</th><th>Item Class</th><th>Units</th><th>Copy</th><th>Status</th><th>Call</th></tr><tr><td>Main Library</td><td>03234</td><td>Book</td><td>1</td><td>1</td><td>Available</td><td>QC 173</td></tr></table></body></html>",
            "text/html",
        )
    if "gw.iiserkol.ac.in/live/" in host_path:
        if "index.html" in host_path:
            return (
                '<html><head><title>Router</title></head><body><h1 class="is_green">Router<span class="description">Core</span></h1><p class="is_white">Aug 24</p><img src="log.png"><iframe src="log.html"></body></html>',
                "text/html",
            )
        return (
            '<html><body><a class="whitegroup" href="1.html">Core</a><a class="greenhost" href="1/index.html">Router</a><a class="redhost" href="2/index.html">Backup</a></body></html>',
            "text/html",
        )
    if "gw.iiserkol.ac.in/mrtg/" in host_path:
        return (
            '<html><body><IMG ALT="Core Router Traffic Graph" SRC="core-day.png"></body></html>',
            "text/html",
        )
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-SID")
        self.send_header("Access-Control-Expose-Headers", "X-Final-URL")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        sid = self.headers.get("X-SID") or qs.get("sid", ["anon"])[0]
        if parsed.path == "/ping":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps({"ok": True, "mock": MOCK, "name": "iiserk-proxy"}).encode()
            )
            return
        if parsed.path in ("/fetch", "/file"):
            target = qs.get("url", [None])[0]
            if not target:
                self.send_error(400, "missing url")
                return
            if not allowed(target):
                self.send_response(403)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "host not allowed"}).encode())
                return
            # mock?
            jar = jar_of(sid)
            mocked = mock_response(target, sid, jar, None, "GET")
            if mocked is not None:
                body, ctype = mocked
                if isinstance(body, str):
                    body = body.encode()
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                if parsed.path == "/file":
                    self.send_header(
                        "Content-Disposition", 'attachment; filename="download.bin"'
                    )
                self.send_header("X-Final-URL", target)
                self.end_headers()
                self.wfile.write(body)
                return
            # real proxy
            try:
                host = urllib.parse.urlparse(target).hostname
                req = urllib.request.Request(
                    target, headers={"User-Agent": UA, "Referer": target}
                )
                ck = cookie_header(sid, host)
                if ck:
                    req.add_header("Cookie", ck)
                with urllib.request.urlopen(req, timeout=12) as resp:
                    store_cookies(sid, host, resp.headers)
                    ctype = resp.headers.get("Content-Type", "text/html; charset=utf-8")
                    body = resp.read()
                    self.send_response(resp.status)
                    self.send_header("Content-Type", ctype)
                    if parsed.path == "/file":
                        cd = resp.headers.get("Content-Disposition", "")
                        m = re.search(
                            r'filename\*?=(?:UTF-8\'\'|")?([^\";]+)', cd, re.I
                        )
                        fname = (
                            urllib.parse.unquote(m.group(1).strip('"'))
                            if m
                            else "download.bin"
                        )
                        self.send_header(
                            "Content-Disposition", f'attachment; filename="{fname}"'
                        )
                    self.send_header("X-Final-URL", resp.url)
                    self.end_headers()
                    self.wfile.write(body)
            except Exception as e:
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
        # static file
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        sid = self.headers.get("X-SID") or "anon"
        if parsed.path == "/jar/clear":
            JARS.pop(sid, None)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            return
        if parsed.path == "/fetch":
            length = int(self.headers.get("Content-Length", 0))
            try:
                data = json.loads(self.rfile.read(length) or b"{}")
            except:
                data = {}
            target = data.get("url")
            form = data.get("form")
            if not target or not allowed(target):
                self.send_response(403)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "host not allowed"}).encode())
                return
            jar = jar_of(sid)
            mocked = mock_response(target, sid, jar, form, "POST")
            if mocked is not None:
                body, ctype = mocked
                if isinstance(body, str):
                    body = body.encode()
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("X-Final-URL", target)
                self.end_headers()
                self.wfile.write(body)
                return
            try:
                host = urllib.parse.urlparse(target).hostname
                body_enc = urllib.parse.urlencode(form or {}).encode() if form else None
                req = urllib.request.Request(
                    target,
                    data=body_enc,
                    headers={
                        "User-Agent": UA,
                        "Referer": target,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                )
                ck = cookie_header(sid, host)
                if ck:
                    req.add_header("Cookie", ck)
                with urllib.request.urlopen(req, timeout=12) as resp:
                    store_cookies(sid, host, resp.headers)
                    ctype = resp.headers.get("Content-Type", "text/html")
                    body = resp.read()
                    self.send_response(resp.status)
                    self.send_header("Content-Type", ctype)
                    self.send_header("X-Final-URL", resp.url)
                    self.end_headers()
                    self.wfile.write(body)
            except Exception as e:
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
        self.send_error(404)


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler) as httpd:
        mode = "mock" if MOCK else "live"
        print(f"iiserk-web on http://localhost:{PORT}  [{mode}]")
        print(f"  allow-list: {len(ALLOWED)} hosts · proxy at /fetch  ·  ping at /ping")
        httpd.serve_forever()
