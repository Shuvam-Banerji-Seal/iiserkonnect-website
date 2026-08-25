# 03 — Steps

STEP 1: tokens layer — styles/tokens/colors.css (semantic vars, :root fallback),
        themes.css ([data-theme] blocks ×8, verbatim Color.kt hexes)
STEP 2: base + layout + utilities (reset, typography, container/sections,
        animations/reveals, helpers: glass/prism/sr-only/chips)
STEP 3: component CSS ×12 (navbar hero phone cards stats chat themes tech
        download footer buttons)
STEP 4: styles/main.css @import hub (documented cascade order)
STEP 5: scripts/data/*.js — features(25), chat-facts, site-themes, tech-stack
STEP 6: scripts/components/*.js — site-navbar feature-card section-heading
        stat-counter theme-picker crypto-pipeline site-footer
STEP 7: scripts/modules/*.js — theme-manager mobile-nav scroll-spy
        reveal-on-scroll count-up chat-demo-loop back-to-top
STEP 8: scripts/main.js bootstrap (guarded inits)
STEP 9: index.html composition root (relative paths, SEO meta, noscript)
STEP 10: aux — README(architecture doc) LICENSE .gitignore .nojekyll favicon.svg
TEST 1: python http.server → Playwright desktop 1440 + mobile 390 screenshots,
        console-error check, hamburger open/close, theme switch click-through
RISK:   any module throw → guarded try/catch per init; noscript banner present
FALLBACK: if a component fails to render, section shell + heading still visible
