# 05 — Audit Log

## Verification Wave 1 — local (http://localhost:8123)
| Check | Result |
|---|---|
| Console errors/warnings | 0 / 0 |
| Sections mounted (hero/stats/features/chat/themes/tech/download) | 7/7 |
| Feature cards rendered | 28 (11 academics + 11 campus + 6 tools) |
| Theme swatches / pipeline / discovery / checklist / chips / security | 9 / 3 / 3 / 7 / 16 / 6 |
| Desktop 1440px screenshots (hero, stats, features, chat, themes, download) | PASS — see plans/screenshots/ |
| Theme switch → Catppuccin Mocha | theme applied ✅ |
| **BUG-1** pressed-state sync | ❌ found: picker listened on `document`, manager dispatches on itself |
| **BUG-2** checkmark anchor | ❌ found: `.swatch` not positioned → ::after floated to container corner |
| **BUG-3** phone send-button stretched | ❌ found: missing flex:none |

## Fixes (commit 6f2aff0)
- theme-picker listens on `themeManager` (the EventTarget)
- `.swatch { position: relative }`
- `.chat-input .send { flex: none }`, FAB 38px @ bottom:74px, demo markdown stripped

## Verification Wave 2 — post-fix local + LIVE deploy
| Check | Result |
|---|---|
| set('tokyo-night') → exactly one pressed swatch, id matches | PASS |
| Light theme (Warm Light) contrast + checkmark on dot | PASS (screenshot) |
| Mobile 390px: hero, drawer open/close, stacked cards | PASS |
| Horizontal overflow | 0px (hero glow intentionally clipped) |
| `gh repo create --public --push` | https://github.com/Shuvam-Banerji-Seal/iiserkonnect-website |
| GitHub Pages | enabled, status `built`, HTTP 200 |
| LIVE console errors/warnings | 0 / 0 |
| LIVE: 28 cards, 9 swatches, one pressed = applied theme | PASS |
| LIVE: demo bubbles clean (no raw markdown) | PASS |

## Meta-loop
| Cycle | What I did | What happened | Learned | Next move |
|---|---|---|---|---|
| 1 | Built modular site, verified w/ Playwright | 3 UI bugs found | EventTarget ≠ document for custom events | fixed + re-verified |
| 2 | Re-verified local + live | all green | Playwright click-through catches what eyeballing misses | — |
