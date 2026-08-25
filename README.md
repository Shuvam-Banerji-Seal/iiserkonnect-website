# IISERKonnect — Website

The showcase site for **IISERKonnect**, an all-in-one Android app for the IISER
Kolkata community. Static, dependency-free, mobile-first, and themed with the
app's real palettes.

> **Live:** `https://shuvam-banerji-seal.github.io/iiserkonnect-website/` *(after Pages is enabled)*

---

## ✨ What's on the page

- **Hero** with a CSS-only phone mockup running a live E2E-chat demo
- **25+ features** across Academics / Campus Life / Tools & Network
- **Campus Chat spotlight** — the X25519 → HKDF → AES-GCM pipeline and triple peer discovery
- **Interactive theme switcher** — 9 palettes lifted verbatim from the app's `Color.kt`
- Tech stack + security posture, download steps, and a fully responsive layout

## 🏗️ Architecture

Zero build step. Four strictly separated layers; GitHub Pages serves it as-is.

```
iiserkonnect-website/
├── index.html                  # composition root — structure & section copy only
│
├── styles/                     # ── presentation layer ──
│   ├── main.css                # @import hub · fixes cascade order
│   ├── tokens/
│   │   ├── colors.css          # semantic design tokens (single source of truth)
│   │   └── themes.css          # [data-theme] palettes = the app's Color.kt values
│   ├── base/
│   │   ├── reset.css           # modern reset, selection, focus rings, scrollbar
│   │   └── typography.css      # fluid type scale, eyebrow, gradient text
│   ├── layout/
│   │   └── container.css       # .container, .section rhythm, grid systems
│   ├── components/             # ONE file per UI component
│   │   ├── buttons.css  navbar.css  hero.css  phone.css  cards.css
│   │   ├── stats.css    chat.css    themes.css        tech.css
│   │   └── download.css footer.css
│   └── utilities/
│       ├── animations.css      # scroll-reveal + keyframes
│       └── helpers.css         # .glass, prism radii, chips, sr-only
│
├── scripts/                    # ── behavior layer (ES modules) ──
│   ├── main.js                 # bootstrap — guarded, isolated init steps
│   ├── data/                   # ALL content/copy lives here
│   │   ├── features.js         #   the 25+ feature cards
│   │   ├── chat-facts.js       #   crypto pipeline + discovery + checklist
│   │   ├── site-themes.js      #   switcher metadata (swatch hexes)
│   │   └── tech-stack.js       #   stack chips + security bullets
│   ├── components/             # light-DOM custom elements
│   │   ├── icons.js            #   inline SVG set (currentColor)
│   │   ├── site-navbar.js      #   <site-navbar>
│   │   ├── feature-card.js     #   <feature-card>
│   │   ├── section-heading.js  #   <section-heading>
│   │   ├── stat-counter.js     #   <stat-counter>
│   │   ├── theme-picker.js     #   <theme-picker>
│   │   ├── crypto-pipeline.js  #   <crypto-pipeline>
│   │   └── site-footer.js      #   <site-footer>
│   └── modules/                # one concern per module
│       ├── theme-manager.js    #   data-theme swap + persistence + events
│       ├── render-sections.js  #   data → DOM bridge (only DOM writer)
│       ├── mobile-nav.js       #   hamburger / drawer
│       ├── scroll-spy.js       #   active nav link + navbar scrolled state
│       ├── reveal-on-scroll.js #   IntersectionObserver reveals
│       ├── count-up.js         #   animated stat numbers
│       ├── chat-demo-loop.js   #   hero phone conversation script
│       └── back-to-top.js      #   floating button
│
├── assets/favicon.svg
└── plans/                      # design/planning artifacts
```

### Layer rules

| Layer | May import from | Never touches |
|---|---|---|
| `data/*` | nothing | the DOM |
| `components/*` | `data/*`, sibling components | — |
| `modules/*` | `data/*`, `components/icons.js` | — except `render-sections.js` |
| `main.js` | everything | business logic |

Only `render-sections.js` writes content into the page; only
`theme-manager.js` mutates the root attribute; every init step in
`main.js` is individually try/caught so one failure can't blank the site.

## 🔧 Common tasks

**Add a feature card** → append to `scripts/data/features.js`:
```js
{ icon: "zap", title: "New Thing", desc: "What it does.",
  tags: ["Tag"], featured: false }
```

**Add a theme** → add a `[data-theme="…"]` block in `styles/tokens/themes.css`,
then register it in `scripts/data/site-themes.js`. Done.

**Run locally** (ES modules need http):
```bash
python3 -m http.server 8080
# → http://localhost:8080
```

## 📄 License

MIT © Shuvam Banerji Seal. Unofficial student project — not affiliated with
IISER Kolkata administration.
