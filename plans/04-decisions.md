
## Reversal R1 — 2026-08-25 — Showcase → FUNCTIONAL WEB APP
| | |
|---|---|
| From | marketing showcase site |
| To | web version of the app: local companion proxy + full frontend port |
| Why | user clarified intent |
| Constraint | browsers cannot fetch campus hosts directly (no CORS headers) — the app's OkHttp role moves to a zero-dep Node proxy (proxy/server.mjs) with per-session cookie jars; HTML parsing ports from Jsoup to DOMParser; chat moves from raw TCP to WebRTC data channels (manual signaling replaces UDP/mDNS discovery); captcha flows (grades, TCP) render the real captcha image through the proxy |
| Quarantine | old showcase index/components → .rigor-trash/ (git history also preserves) |
