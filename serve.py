#!/usr/bin/env python3
"""Dev server with no-cache headers (python -m http.server caches aggressively,
which silently serves stale ES modules during development). Usage:
    python3 serve.py [port]
"""
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("0.0.0.0", PORT), NoCacheHandler) as httpd:
        print(f"serving on http://localhost:{PORT} (no-store)")
        httpd.serve_forever()
