# 02 — Strategy (REV 2 — modular architecture)

## Chosen: Layered vanilla architecture, zero build step

GitHub-Pages-native static site composed of four strictly separated layers:

```
L1 TOKENS      styles/tokens/*      design tokens + the app's real palettes
L2 BASE/LAYOUT styles/base|layout/* reset, type, containers, grids
L3 COMPONENTS  styles/components/*  one stylesheet per UI component
L4 BEHAVIOR    scripts/modules/*    framework-free ES modules, one concern each
L5 CONTENT     scripts/data/*       ALL copy/content as typed data modules
L6 ELEMENTS    scripts/components/* light-DOM custom elements (<feature-card> …)
ENTRY          index.html (composition root) + styles/main.css (@import hub)
               + scripts/main.js (bootstrap)
```

Rules:
- index.html contains ONLY structure + section copy; repeated UI renders from
  data modules via custom elements → editing content never touches markup.
- Every CSS file owns exactly one concern; cascade order fixed in main.css.
- Theming = swapping `data-theme` on <html>; palettes are verbatim from the
  app's ui/theme/Color.kt (verified this session).
- Relative asset paths only (Pages serves under /<repo>/ subpath).
- ES modules require http → local verify via `python -m http.server`.

## Alternatives rejected
- Vite/Astro/Tailwind: adds toolchain for zero runtime benefit on a brochure site.
- Single-file site: violates the modular requirement; unmaintainable at 25+ features.
- Shadow-DOM components: complicate theming (vars pierce but styling friction ↑);
  light-DOM custom elements keep global tokens authoritative.

## Folder contract (see README for the documented tree)
assets/ favicon · styles/{tokens,base,layout,components,utilities} ·
scripts/{data,components,modules} + main.js · plans/ · LICENSE MIT · .nojekyll
