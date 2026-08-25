# 00 — Understanding

## Task
Create a **new public GitHub repo** containing a beautifully designed, mobile-friendly
website that showcases everything the IISERKonnect Android app does.

## Restated
- Static showcase/landing website (not a functional clone — the app scrapes campus
  intranet with private credentials, impossible/unsafe to replicate publicly).
- "Everything the app is doing" = present ALL feature groups comprehensively.
- Public repo under Shuvam-Banerji-Seal. The main app repo stays PRIVATE (agents.md rule).
- Mobile friendly is a hard requirement.

## Source of truth for content
All facts come from the IISERKonnect codebase read this session:
- agents.md §1 feature list; ui/theme/Color.kt + Theme.kt palettes; chat/* crypto+net;
  WeLearnRepository deep cache; MessRepository/BudgetRepository; NetworkDashboard*;
  LibraryCatalogService; EprintsService; VpnManager; TcpCount flow; 421 @Test methods;
  minSdk 26 / target 35; Kotlin+Compose+Hilt+Room+WorkManager stack.
- Theme hex values copied VERBATIM from Color.kt [VERIFIED this session].

## Constraints
- No personal data on the public site (no balances, no UPI). Contact email
  sbs22ms076@iiserkol.ac.in is already public in the code → acceptable as contact.
- Download CTA points at the private repo's releases page (works for owner) +
  email contact for campus distribution.
- Zero build tooling: plain HTML/CSS/JS so GitHub Pages serves it directly.

## Success criteria
1. Site renders correctly at mobile (390px) and desktop (1440px) — screenshot verified.
2. All ~25 features represented across sections.
3. Interactive theme switcher using the app's real 9 palettes.
4. No console errors; animations respect prefers-reduced-motion.
5. Public repo pushed; GitHub Pages enabled if API permits.
