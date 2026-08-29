#!/usr/bin/env python3
"""Dev server — no-cache, no proxy. Just serves the static site.
On campus the browser fetches campus URLs directly; off-campus
the pages show an 'Open original site' fallback. No backend needed.
"""

import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8123


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("0.0.0.0", PORT), NoCacheHandler) as httpd:
        print(f"serving on http://localhost:{PORT}  (no-store, no proxy)")
        httpd.serve_forever()
