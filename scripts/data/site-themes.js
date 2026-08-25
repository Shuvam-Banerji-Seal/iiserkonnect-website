/**
 * data/site-themes.js — the site's theme switcher options.
 * Swatch colors are the SAME hex values shipped in the app
 * (ui/theme/Color.kt). `system` follows the OS light/dark setting.
 */

export const siteThemes = [
  { id: "liquid-glass",    label: "Liquid Glass",    swatch: ["#0C1626", "#2D78AB", "#7FD4FF"] },
  { id: "dark",            label: "Dark Cocoa",      swatch: ["#1E1714", "#7DD4B2", "#F5D060"] },
  { id: "light",           label: "Warm Light",      swatch: ["#FFF8F0", "#1B5E4A", "#E6A817"], light: true },
  { id: "catppuccin-mocha",label: "Catppuccin Mocha",swatch: ["#1E1E2E", "#CBA6F7", "#94E2D5"] },
  { id: "catppuccin-latte",label: "Catppuccin Latte",swatch: ["#EFF1F5", "#8839EF", "#EA76CB"], light: true },
  { id: "tokyo-night",     label: "Tokyo Night",     swatch: ["#1A1B26", "#7AA2F7", "#BB9AF7"] },
  { id: "coffee-green",    label: "Coffee Green",    swatch: ["#F7F3ED", "#2D5F3C", "#8B6F47"], light: true },
  { id: "neon",            label: "Neon Contrast",   swatch: ["#000000", "#FFEB3B", "#39FF14"] },
];

/** The OS-following pseudo theme (app mode 2). */
export const SYSTEM_THEME = {
  id: "system",
  label: "System",
  swatch: ["#3a3a3a", "#dddddd", "#888888"],
};

export const DEFAULT_THEME = "liquid-glass";
export const STORAGE_KEY = "iiserk-site-theme";
