# IISERKonnect Web

The **IISERKonnect** campus app for IISER Kolkata, in a browser: the same screens, the same
themes and the same on-device tools as the Android app, built as plain static files.

> **Live:** https://shuvam-banerji-seal.github.io/iiserkonnect-website/

There is **no backend** — no server of ours, no proxy, no accounts, no analytics. Everything you
create (notes, tasks, reminders, events, budget, chats, settings) stays in this browser
(IndexedDB and localStorage), and Settings → Advanced can back it up to a file or restore it.

What matches the app, screen by screen, is listed in **[PARITY.md](PARITY.md)**.

## What works

- **The app's look**: Material 3 surfaces, the app's top bars and bottom bar (a navigation rail on
  wide screens), and every theme — Dark, Light, System, Catppuccin Mocha and Latte, Tokyo Night,
  Coffee Green, Neon Contrast, Liquid Glass, Neko (nine coats), E-Ink and E-Ink Dark — plus a custom
  accent colour. Motion levels Off / Subtle / Full; `prefers-reduced-motion` and the E-Ink themes
  always turn motion off.
- **Home**: greeting, "Today at a glance", sections in grid / list / compact / carousel with
  accents, live cards, and **Customize Home** with templates.
- **Settings**: the grouped hub with search, whole-row switches and every section.
- **Fully in the browser**: Notes, Planner, Reminders, My Calendar, Timer, Stopwatch, Focus,
  My Budget, the digital ID card, app lock (PIN, or the device's own unlock), Customize Home,
  themes, logs, directories and the concept tree.
- **Campus Chat**: browser-to-browser chat over WebRTC — encrypted, direct, no server. Browsers
  cannot discover people on the network, so you connect by swapping an invite code.
- **Campus screens** (WeLearn, grades, attendance, mess transactions, mess menu, library, notices,
  research, TCP count, MAC registration, network status, QR billing, …): same screens as the app.
  They ask the campus server directly; campus servers do not answer requests from other websites,
  so you will normally see clearly labelled **made-up sample data** instead.
  Settings → Advanced → *Sample data only* stops every campus request.

### What a browser cannot do (and the screens say so)

- **Alarms** ring only while an IISERKonnect tab is open (it can be in the background), using the
  Notifications API. A web page cannot wake itself once every tab is closed.
- **VPN** (OpenVPN), **SFTP** and the app's **automatic chat discovery** need network access no
  web page has. The screens are there, with an explanation and what to use instead.
- **Screen brightness** cannot be set by a web page. QR Billing offers a white, high-contrast
  "bright presentation" and keeps the screen awake with the Screen Wake Lock API.
- **Haptics** work only where the browser can vibrate (e.g. Chrome on Android).

## Run it

```bash
python3 serve.py 8123        # → http://localhost:8123
```

Any static file server works (the site also runs from GitHub Pages under
`/iiserkonnect-website/`). `serve.py` only adds no-cache headers, so edited modules are never
served stale while developing. There is no build step.

## Test it

```bash
npm install                  # installs Playwright, only for the test
npm test                     # node tests/smoke.mjs
```

The smoke test serves the repository on a free local port and visits every route at 390×844 and
1280×800 in the Light, Dark, Liquid Glass, Neko and E-Ink themes, in sample-data mode. It fails
on any console error, uncaught exception, crash screen, sideways scrolling, or **any request that
leaves the machine**. `--quick` runs Light and Dark only; `--shots <dir>` saves screenshots.

## How it is built

```
index.html                 app shell: stage, bottom bar, navigation rail
scripts/
  main.js                  boot: theme → motion → app lock → router
  app/routes.js            every route (the Android route patterns), lazily loaded
  core/                    router, prefs (localStorage), db (IndexedDB), theme, motion,
                           notify (alarms), applock, net (direct campus fetch), session, log
  ui/                      components (Material 3 builders), overlay (dialogs, sheets, menus,
                           snackbars), icons, markdown, qr, haptics
  home/                    Home layout model, presets, greeting
  productivity/            the productivity rules (repeats, timer, focus, events, agenda)
  chat/engine.js           WebRTC chat
  data/                    per-feature loaders: live campus data or labelled samples
  services/                ports of the app's campus parsers
  pages/*.page.js          one module per screen group
  vendor/                  small third-party code (QR encoder)
styles/                    base, shell, components, themes, pages/*
data/samples/              made-up sample data (fictional people, rooms and amounts)
tests/smoke.mjs            the smoke test
```

Static ES modules, no bundler, no `node_modules` in the repository.

## Privacy

- Your LDAP username and password, if you save them, are kept only in this browser's storage
  (not encrypted) and are only ever sent to the campus sign-in pages, and only when this
  browser can reach them.
- The site loads nothing from third parties: fonts and icons are served from this repository.
  The one exception is optional: Campus Chat's "Use public STUN" switch (off by default).
- Third-party code and fonts: see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## License

MIT © Shuvam Banerji Seal. Unofficial student project — not affiliated with IISER Kolkata
administration.
