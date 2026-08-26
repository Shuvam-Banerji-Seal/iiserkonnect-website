# IISERKonnect Web

The **web version of IISERKonnect** — the IISER Kolkata campus app — running as a
static frontend plus a zero-dependency local companion proxy. Same features, same
parsers (ported 1:1 from the Kotlin/Jsoup originals), no installs, no cloud.

> **Live frontend:** https://shuvam-banerji-seal.github.io/iiserkonnect-website/
> The frontend is only half the app — see **Run it** below.

---

## Run it

```bash
# 1. the companion (the app's "networking layer")
node proxy/server.mjs            # real mode — needs campus network / VPN
node proxy/server.mjs --mock     # demo mode — built-in fixtures, no campus needed

# 2. the frontend — either GitHub Pages (above) or locally:
python3 serve.py 8123            # no-cache dev server → http://localhost:8123
```

Then open the site → **Settings** → enter your LDAP credentials → every module works.

> Tip: `python3 -m http.server` works too but sends cache headers that can serve
> stale ES modules while developing — `serve.py` exists to avoid that trap.

### Verified end-to-end (mock mode, Playwright)

login → WeLearn courses/files · mess stats & tables · menu (★ specials) ·
calendar week grid · library search→detail→availability · research
latest/divisions/years/papers/detail · PYQ (exam/semester/dept) · notices ·
VoIP · TCP captcha login (34,654 count + devices) · grades captcha (10
semesters, SGPA/CGPA) · WebRTC chat handshake + message delivery
(loopback-verified; headless Chromium can't resolve mDNS cross-tab — real
browsers do; the optional STUN toggle covers strict networks).

## Why a companion proxy?

Browsers refuse cross-origin requests to `welearn.iiserkol.ac.in`, `newsmerp…`,
`intranet…` (no CORS headers). The Android app did all networking natively via
OkHttp. The proxy reproduces exactly that role:

- per-browser **cookie jars** (keyed by an `X-SID` header) — sessions survive page reloads
- **host allow-list** (campus domains only — it is not an open proxy)
- binds to `127.0.0.1` by default; credentials go browser → localhost → campus, nowhere else
- `/file` streams downloads as attachments with Content-Disposition preserved

## Modules

| Module | Backing service (ported from) |
|---|---|
| WeLearn courses / files / downloads | `HtmlParser`, `WeLearnRepository` |
| Deadlines | `scrapeAssignments` |
| Attendance (+ % summary) | `AttendanceParser` |
| Mess transactions / budget charts | `CanteenErpService`, `allocateItemCosts` |
| Mess menu (today, ★ specials) | `parseFoodMenuFromCanteen` |
| Academic calendar week grid | `CalendarScraper` |
| Campus events | `EventCalendarScraper` |
| Grade cards (captcha) | `WeLearnMyProfileService` |
| Course selection | — (planned) |
| PYQ archive | `IntranetService.fetchPYQ*` |
| Notices (student/admin) | `parseNoticeBoard` |
| Library catalogue + availability | `LibraryCatalogService` (VTLS Chamo) |
| Research (ePrints) | `EprintsService` |
| VoIP directory | `fetchVoipDirectory` |
| TCP counter / MACs (captcha) | `fetchMacRegLoginPage`, `parseTcpDevices` |
| Network dashboard (health, Skipole, MRTG) | `Skipole/Mrtg/HostDetailParser` |
| Campus Chat | WebRTC data channels (replaces raw-TCP `ChatNetworkManager`; DTLS-E2E, serverless, manual invite codes replace UDP/mDNS discovery; optional STUN toggle for strict NATs — media stays direct) |

## Architecture

```
index.html                  app shell (sidebar / topbar / outlet)
serve.py                    no-cache dev server (stale-module prevention)
proxy/server.mjs            companion: cookie jars, allow-list, /fetch /file /ping, --mock fixtures
scripts/
  main.js                   route table + shell wiring
  core/                     store (localStorage), net (proxy client), session (logins/captcha),
                            router, html (DOMParser = the Jsoup port)
  services/                 welearn, canteen, intranet, calendar, eprints, library, netmon
  pages/                    home, settings, welearn, mess, menu, calendar, library, research,
                            gateway (tcp+grades), misc (pyq/notices/voip), netmon, chat, about
  modules/theme-manager.js  the app's 9 palettes as site themes
  components/               icons, theme picker
styles/                     tokens → base → layout → utilities → components (shell, data, …)
```

**Layer rules:** `data` never touches the DOM · only `pages` render · only `core/net`
speaks to the proxy · every page degrades to an explicit state (proxy offline /
not signed in) instead of failing silently.

## Security & privacy

- Credentials live in this browser's localStorage and are sent **only** to your
  local proxy, which forwards them **only** to the allow-listed campus hosts.
- No analytics, no third-party requests (fonts excepted), no cloud anything.
- Chat has no signaling server: invite codes travel over any channel you choose,
  media path is direct LAN WebRTC (DTLS-encrypted).

## License

MIT © Shuvam Banerji Seal. Unofficial student project — not affiliated with
IISER Kolkata administration.
