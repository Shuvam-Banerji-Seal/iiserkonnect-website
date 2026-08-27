## Session Summary
| Field | Value |
|-------|-------|
| Session | Web app faithful to app UI + campus-aware |
| Phase | COMPLETE — deployed, verified desktop+mobile |
| What I did | Rebuilt web shell to match app's HomeScreen exactly: warm cocoa dark default, Prism tile shapes, greeting header with time-based greeting + campus pill, hero spotlight, 3 FlowRow sections (8+11+7 tiles) with HomeTileCard styling; SVG stroke icons (not emoji) via icons.js; campus-aware proxy pill (On Campus vs Live vs Demo vs Offline) probing intranet wiki; responsive 3→2 col grid |
| What worked | Faithful tile grid, staggered reveal, campus detection via proxy, mobile drawer as bottom-nav adaptation, theme switcher still works |
| What failed | None — prior huge-icon bug fixed via icon width attributes + no-store server |
| Next | Optional: add skeleton loaders, command palette (⌘K), real app screenshots, PWA manifest |
| Audit | PASS — home faithful to Compose, all 16 modules reachable, mobile 390px clean, live Pages 200 |

## Stack
Same modular architecture: tokens/base/layout/components/data/home + core/session/net + services + pages; proxy with allow-list + mock fixtures; serve.py no-cache dev server.
Live: https://shuvam-banerji-seal.github.io/iiserkonnect-website/
Repo: https://github.com/Shuvam-Banerji-Seal/iiserkonnect-website
Run: `node proxy/server.mjs` (--mock for demo) + `python3 serve.py 8123`
On campus: proxy can reach intranet without VPN — pill shows "On Campus", all intranet features work.
