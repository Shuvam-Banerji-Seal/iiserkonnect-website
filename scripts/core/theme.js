/**
 * core/theme.js — the app's colour schemes, ported from ui/theme (Color.kt,
 * Theme.kt, NekoCoat.kt, SemanticColors.kt) and applied as CSS custom
 * properties on <html>.
 *
 * Theme mode numbers are the app's own (Theme.kt):
 *   0 Dark (default) · 1 Light · 2 System · 3 Catppuccin Mocha · 4 Catppuccin Latte
 *   5 Tokyo Night · 6 Coffee Green · 7 Neon Contrast · 8 Liquid Glass · 9 Neko
 *   10 E-Ink · 11 E-Ink Dark
 *
 * Roles a scheme leaves out are filled the way Material 3's lightColorScheme /
 * darkColorScheme fill them (the baseline lavender-grey containers). That is
 * not a guess: the app's tiles are drawn in surfaceContainerHigh, which no
 * IISERK scheme sets, and the screenshots measure #ECE6F0 / #2B2930 — the
 * Material baseline values.
 */

import { prefs } from "./prefs.js";

const LIGHT_DEFAULTS = {
  surfaceContainerLowest: "#FFFFFF", surfaceContainerLow: "#F7F2FA", surfaceContainer: "#F3EDF7",
  surfaceContainerHigh: "#ECE6F0", surfaceContainerHighest: "#E6E0E9",
  surfaceBright: "#FEF7FF", surfaceDim: "#DED8E1",
  inverseSurface: "#322F35", inverseOnSurface: "#F5EFF7", inversePrimary: "#D0BCFF",
  outlineVariant: "#CAC4D0", scrim: "#000000",
};
const DARK_DEFAULTS = {
  surfaceContainerLowest: "#0F0D13", surfaceContainerLow: "#1D1B20", surfaceContainer: "#211F26",
  surfaceContainerHigh: "#2B2930", surfaceContainerHighest: "#36343B",
  surfaceBright: "#3B383E", surfaceDim: "#141218",
  inverseSurface: "#E6E0E9", inverseOnSurface: "#322F35", inversePrimary: "#6750A4",
  outlineVariant: "#49454F", scrim: "#000000",
};

/** Compose writes colours as 0xAARRGGBB; CSS wants #RRGGBBAA. */
const argb = (h) => {
  const s = h.replace("#", "");
  if (s.length === 8) return "#" + s.slice(2) + s.slice(0, 2);
  return "#" + s;
};

const W = "#FFFFFF";

/* ── IISERK default (Color.kt / Theme.kt) ───────────────────────── */
const IISERK_LIGHT = {
  primary: "#1B5E4A", onPrimary: W, primaryContainer: "#B2DFCF", onPrimaryContainer: "#0D3B2F",
  secondary: "#E6A817", onSecondary: "#2D1F10", secondaryContainer: "#F5D060", onSecondaryContainer: "#2D1F10",
  tertiary: "#7B5E3A", onTertiary: W, tertiaryContainer: "#E8D5BD", onTertiaryContainer: "#2D1F10",
  background: "#FFF8F0", surface: "#FFF8F0", surfaceVariant: "#F2E8DC",
  onBackground: "#2D1F10", onSurface: "#2D1F10", onSurfaceVariant: "#534539", outline: "#8A7B6E",
  error: "#B3261E", onError: W, errorContainer: "#F9DEDC", onErrorContainer: "#410E0B",
};
const IISERK_DARK = {
  primary: "#7DD4B2", onPrimary: "#0D3B2F", primaryContainer: "#0D3B2F", onPrimaryContainer: "#B2DFCF",
  secondary: "#F5D060", onSecondary: "#2D1F10", secondaryContainer: "#5C4300", onSecondaryContainer: "#F5D060",
  tertiary: "#D4B896", onTertiary: "#2D1F10", tertiaryContainer: "#5C422A", onTertiaryContainer: "#E8D5BD",
  background: "#1E1714", surface: "#1E1714", surfaceVariant: "#2A211C",
  onBackground: "#F0E6D8", onSurface: "#F0E6D8", onSurfaceVariant: "#CDBEB0", outline: "#6B5B4F",
  error: "#F2B8B5", onError: "#601410", errorContainer: "#8C1D18", onErrorContainer: "#F9DEDC",
};

const MOCHA = {
  primary: "#CBA6F7", onPrimary: "#11111B", primaryContainer: "#313244", onPrimaryContainer: "#B4BEFE",
  secondary: "#F5C2E7", onSecondary: "#11111B", secondaryContainer: "#45475A", onSecondaryContainer: "#F2CDCD",
  tertiary: "#94E2D5", onTertiary: "#11111B", tertiaryContainer: "#313244", onTertiaryContainer: "#89DCEB",
  background: "#1E1E2E", surface: "#1E1E2E", surfaceVariant: "#313244",
  onBackground: "#CDD6F4", onSurface: "#CDD6F4", onSurfaceVariant: "#BAC2DE", outline: "#6C7086",
  error: "#F38BA8", onError: "#11111B", errorContainer: "#EBA0AC", onErrorContainer: "#1E1E2E",
};
const LATTE = {
  primary: "#8839EF", onPrimary: W, primaryContainer: "#CCD0DA", onPrimaryContainer: "#8839EF",
  secondary: "#EA76CB", onSecondary: W, secondaryContainer: "#BCC0CC", onSecondaryContainer: "#DD7878",
  tertiary: "#179299", onTertiary: W, tertiaryContainer: "#CCD0DA", onTertiaryContainer: "#179299",
  background: "#EFF1F5", surface: "#EFF1F5", surfaceVariant: "#E6E9EF",
  onBackground: "#4C4F69", onSurface: "#4C4F69", onSurfaceVariant: "#6C6F85", outline: "#9CA0B0",
  error: "#D20F39", onError: W, errorContainer: "#FCE4EC", onErrorContainer: "#D20F39",
};
const TOKYO = {
  primary: "#7AA2F7", onPrimary: "#16161E", primaryContainer: "#292E42", onPrimaryContainer: "#7DCFFF",
  secondary: "#BB9AF7", onSecondary: "#16161E", secondaryContainer: "#2A2040", onSecondaryContainer: "#9D7CD8",
  tertiary: "#73DACA", onTertiary: "#16161E", tertiaryContainer: "#1E3A38", onTertiaryContainer: "#9ECE6A",
  background: "#1A1B26", surface: "#1A1B26", surfaceVariant: "#292E42",
  onBackground: "#C0CAF5", onSurface: "#C0CAF5", onSurfaceVariant: "#A9B1D6", outline: "#565F89",
  error: "#F7768E", onError: "#16161E", errorContainer: "#3D1F28", onErrorContainer: "#F7768E",
};
const COFFEE = {
  primary: "#2D5F3C", onPrimary: W, primaryContainer: "#C8E6C9", onPrimaryContainer: "#1A3D26",
  secondary: "#8B6F47", onSecondary: W, secondaryContainer: "#E8D5BD", onSecondaryContainer: "#3E2C16",
  tertiary: "#6B8F71", onTertiary: W, tertiaryContainer: "#D4E8D6", onTertiaryContainer: "#1A3D26",
  background: "#F7F3ED", surface: "#FCFAF6", surfaceVariant: "#EDE7DC",
  onBackground: "#2C2417", onSurface: "#2C2417", onSurfaceVariant: "#5C4F3D", outline: "#9D8E7C",
  error: "#B3261E", onError: W, errorContainer: "#F9DEDC", onErrorContainer: "#410E0B",
};
const NEON = {
  primary: "#FFEB3B", onPrimary: "#000000", primaryContainer: "#2A2400", onPrimaryContainer: "#FFEB3B",
  secondary: "#39FF14", onSecondary: "#000000", secondaryContainer: "#003300", onSecondaryContainer: "#39FF14",
  tertiary: "#00FFFF", onTertiary: "#000000", tertiaryContainer: "#002A2A", onTertiaryContainer: "#00FFFF",
  background: "#000000", surface: "#0A0A0A", surfaceVariant: "#121212",
  onBackground: "#EEEEEE", onSurface: "#EEEEEE", onSurfaceVariant: "#AAAAAA", outline: "#333333",
  error: "#FF1493", onError: "#000000", errorContainer: "#3D0020", onErrorContainer: "#FF1493",
};
const LIQUID = {
  primary: "#2D78AB", onPrimary: W, primaryContainer: argb("#663C8CBE"), onPrimaryContainer: "#EAF7FF",
  secondary: "#2F7B76", onSecondary: W, secondaryContainer: argb("#55448E89"), onSecondaryContainer: "#E4FFFA",
  tertiary: "#5A62A6", onTertiary: W, tertiaryContainer: argb("#555E66B8"), onTertiaryContainer: "#ECEFFF",
  background: "#0C1626", surface: argb("#BF152336"), surfaceVariant: argb("#99304766"),
  onBackground: "#F4F8FF", onSurface: "#F2F7FF", onSurfaceVariant: "#D2DEEF", outline: argb("#80D9E5FF"),
  error: "#FF8D9B", onError: W, errorContainer: argb("#993E1B2A"), onErrorContainer: "#FFEAF0",
};

/* ── E-Ink (Theme.kt): three values only, every role set explicitly ── */
const einkScheme = (paper, ink, grey, ladder) => ({
  primary: ink, onPrimary: paper, primaryContainer: paper, onPrimaryContainer: ink,
  secondary: grey, onSecondary: paper, secondaryContainer: paper, onSecondaryContainer: ink,
  tertiary: ink, onTertiary: paper, tertiaryContainer: paper, onTertiaryContainer: ink,
  background: paper, surface: paper, surfaceVariant: paper,
  onBackground: ink, onSurface: ink, onSurfaceVariant: grey, outline: ink,
  error: ink, onError: paper, errorContainer: ink, onErrorContainer: paper,
  surfaceContainerLowest: paper, surfaceContainerLow: ladder[0], surfaceContainer: ladder[1],
  surfaceContainerHigh: ladder[2], surfaceContainerHighest: ladder[3],
  surfaceBright: ladder.bright, surfaceDim: ladder.dim,
  inverseSurface: ink, inverseOnSurface: paper, inversePrimary: paper, outlineVariant: grey, scrim: ink,
});
const EINK = einkScheme("#FFFFFF", "#000000", "#6E6E6E",
  Object.assign(["#FCFCFC", "#F9F9F9", "#F5F5F5", "#F2F2F2"], { bright: "#FFFFFF", dim: "#F2F2F2" }));
const EINK_DARK = einkScheme("#000000", "#FFFFFF", "#999999",
  Object.assign(["#0D0D0D", "#141414", "#1C1C1C", "#242424"], { bright: "#242424", dim: "#000000" }));

/* ── Neko coats (NekoCoat.kt) ───────────────────────────────────── */
export const NEKO_COATS = [
  { id: 0, label: "Calico", blurb: "Strawberry milk and cream — the original", dark: false, ears: "#E8859B", fur: "#FFF6F0", nose: "#E8859B",
    s: { primary: "#E8859B", onPrimary: "#601F30", primaryContainer: "#FFD9E1", onPrimaryContainer: "#6E2437",
      secondary: "#9B7EC8", onSecondary: W, secondaryContainer: "#EADDF7", onSecondaryContainer: "#3D2A52",
      tertiary: "#F2A65A", onTertiary: "#4A2600", tertiaryContainer: "#FFDCC2", onTertiaryContainer: "#4A2600",
      background: "#FFF6F0", surface: "#FFFBF8", surfaceVariant: "#F7E7E0",
      onBackground: "#4A3A38", onSurface: "#4A3A38", onSurfaceVariant: "#7A6663", outline: "#D9BFB8",
      error: "#C0392B", onError: W, errorContainer: "#FFDAD6", onErrorContainer: "#410002" } },
  { id: 1, label: "Tuxedo", blurb: "Black coat, white bib, pink nose", dark: true, ears: "#F3B0C3", fur: "#1C1A1E", nose: "#F3B0C3",
    s: { primary: "#F3B0C3", onPrimary: "#3A1622", primaryContainer: "#52272F", onPrimaryContainer: "#FFD9E1",
      secondary: "#CFC4D8", onSecondary: "#2E2833", secondaryContainer: "#3E3646", onSecondaryContainer: "#EADDF7",
      tertiary: "#E8C98A", onTertiary: "#3A2C0A", tertiaryContainer: "#50401A", onTertiaryContainer: "#FFEBC2",
      background: "#1C1A1E", surface: "#232128", surfaceVariant: "#322E38",
      onBackground: "#F4EFF2", onSurface: "#F4EFF2", onSurfaceVariant: "#CFC7CE", outline: "#6E6672",
      error: "#FFB4AB", onError: "#690005", errorContainer: "#93000A", onErrorContainer: "#FFDAD6" } },
  { id: 2, label: "Siamese", blurb: "Cream body, chocolate points, blue eyes", dark: false, ears: "#6B4A3A", fur: "#FBF3E7", nose: "#3E6285",
    s: { primary: "#3E6285", onPrimary: W, primaryContainer: "#D3E3F5", onPrimaryContainer: "#17263A",
      secondary: "#6B4A3A", onSecondary: W, secondaryContainer: "#F2DFD3", onSecondaryContainer: "#32200F",
      tertiary: "#8A6D3B", onTertiary: W, tertiaryContainer: "#F6E3C3", onTertiaryContainer: "#2E2003",
      background: "#FBF3E7", surface: "#FFFAF2", surfaceVariant: "#EFE2D2",
      onBackground: "#3B2E22", onSurface: "#3B2E22", onSurfaceVariant: "#6B5B4B", outline: "#C3B29E",
      error: "#B3261E", onError: W, errorContainer: "#F9DEDC", onErrorContainer: "#410E0B" } },
  { id: 3, label: "Ginger", blurb: "Marmalade tabby, warm all over", dark: false, ears: "#D2691E", fur: "#FFF4E6", nose: "#A8471A",
    s: { primary: "#A8471A", onPrimary: W, primaryContainer: "#FFDCC6", onPrimaryContainer: "#3A1300",
      secondary: "#7A5A2E", onSecondary: W, secondaryContainer: "#F6E2C4", onSecondaryContainer: "#2B1C00",
      tertiary: "#6C6A2C", onTertiary: W, tertiaryContainer: "#EFEDC0", onTertiaryContainer: "#212000",
      background: "#FFF4E6", surface: "#FFFAF3", surfaceVariant: "#F3E3D2",
      onBackground: "#44291A", onSurface: "#44291A", onSurfaceVariant: "#745642", outline: "#C9A98F",
      error: "#B3261E", onError: W, errorContainer: "#F9DEDC", onErrorContainer: "#410E0B" } },
  { id: 4, label: "Russian Blue", blurb: "Silver-grey plush and green eyes", dark: false, ears: "#6E8290", fur: "#F0F4F6", nose: "#3F5B6B",
    s: { primary: "#3F5B6B", onPrimary: W, primaryContainer: "#D1E4EE", onPrimaryContainer: "#16242C",
      secondary: "#4C6B52", onSecondary: W, secondaryContainer: "#D3E8D8", onSecondaryContainer: "#102316",
      tertiary: "#5C5B7A", onTertiary: W, tertiaryContainer: "#E0DFF5", onTertiaryContainer: "#1A1930",
      background: "#F0F4F6", surface: "#F9FCFD", surfaceVariant: "#DFE7EB",
      onBackground: "#232B30", onSurface: "#232B30", onSurfaceVariant: "#54636B", outline: "#A7B6BE",
      error: "#B3261E", onError: W, errorContainer: "#F9DEDC", onErrorContainer: "#410E0B" } },
  { id: 5, label: "Midnight", blurb: "A black cat with lantern-gold eyes", dark: true, ears: "#E8B84B", fur: "#14131A", nose: "#E8B84B",
    s: { primary: "#E8B84B", onPrimary: "#3A2A00", primaryContainer: "#543D00", onPrimaryContainer: "#FFE8AE",
      secondary: "#C5B9D6", onSecondary: "#2C2536", secondaryContainer: "#423A4E", onSecondaryContainer: "#E6DCF5",
      tertiary: "#9ED0B8", onTertiary: "#0B3324", tertiaryContainer: "#234A39", onTertiaryContainer: "#BBECD4",
      background: "#14131A", surface: "#1D1B24", surfaceVariant: "#2C2934",
      onBackground: "#F0EDF4", onSurface: "#F0EDF4", onSurfaceVariant: "#C9C4D2", outline: "#6A6478",
      error: "#FFB4AB", onError: "#690005", errorContainer: "#93000A", onErrorContainer: "#FFDAD6" } },
  { id: 6, label: "Tortoiseshell", blurb: "Mottled amber and ink, no two alike", dark: false, ears: "#8A5A2B", fur: "#FDF6EC", nose: "#6B3410",
    s: { primary: "#6B3410", onPrimary: W, primaryContainer: "#FFDCC4", onPrimaryContainer: "#2B1300",
      secondary: "#5A4634", onSecondary: W, secondaryContainer: "#EEDFCE", onSecondaryContainer: "#1E1509",
      tertiary: "#4C4438", onTertiary: W, tertiaryContainer: "#E8DECE", onTertiaryContainer: "#1A150C",
      background: "#FDF6EC", surface: "#FFFBF5", surfaceVariant: "#EFE2D2",
      onBackground: "#241A10", onSurface: "#241A10", onSurfaceVariant: "#5B4B3B", outline: "#B3A190",
      error: "#B3261E", onError: W, errorContainer: "#F9DEDC", onErrorContainer: "#410E0B" } },
  { id: 7, label: "Mint", blurb: "A sage-eyed cat in a cool room", dark: false, ears: "#4F7A63", fur: "#F1F7F3", nose: "#2F5C46",
    s: { primary: "#2F5C46", onPrimary: W, primaryContainer: "#CCE9DA", onPrimaryContainer: "#0C2419",
      secondary: "#44635A", onSecondary: W, secondaryContainer: "#D3E8E0", onSecondaryContainer: "#10241E",
      tertiary: "#3F5C6B", onTertiary: W, tertiaryContainer: "#D4E6EF", onTertiaryContainer: "#13242C",
      background: "#F1F7F3", surface: "#FAFDFB", surfaceVariant: "#DDE9E2",
      onBackground: "#1E2C26", onSurface: "#1E2C26", onSurfaceVariant: "#4C6459", outline: "#9FB6AB",
      error: "#B3261E", onError: W, errorContainer: "#F9DEDC", onErrorContainer: "#410E0B" } },
  { id: 8, label: "Lavender", blurb: "Dusk-coloured fur, violet eyes", dark: true, ears: "#C9AEE8", fur: "#1A1622", nose: "#C9AEE8",
    s: { primary: "#C9AEE8", onPrimary: "#2A1B3D", primaryContainer: "#3F2C58", onPrimaryContainer: "#EADDF7",
      secondary: "#B9C0E8", onSecondary: "#1F2440", secondaryContainer: "#343A5A", onSecondaryContainer: "#E0E4F7",
      tertiary: "#E8AEC9", onTertiary: "#3D1B2A", tertiaryContainer: "#582C42", onTertiaryContainer: "#F7DDE8",
      background: "#1A1622", surface: "#221D2E", surfaceVariant: "#2E2740",
      onBackground: "#EDE7F5", onSurface: "#EDE7F5", onSurfaceVariant: "#C3BAD2", outline: "#6C6280",
      error: "#F2B8B5", onError: "#601410", errorContainer: "#8C1D18", onErrorContainer: "#F9DEDC" } },
];

export const NEKO_THEME_MODE = 9;
export const EINK_THEME_MODE = 10;
export const EINK_DARK_THEME_MODE = 11;

/** The picker's list, in the app's order and with the app's labels. */
export const THEME_OPTIONS = [
  ["Dark (Default)", 0], ["Light", 1], ["System", 2], ["Catppuccin Mocha", 3], ["Catppuccin Latte", 4],
  ["Tokyo Night", 5], ["Coffee Green", 6], ["Neon Contrast", 7], ["Liquid Glass", 8],
  ["Neko \u{1F43E}", NEKO_THEME_MODE], ["E-Ink (e-paper)", EINK_THEME_MODE], ["E-Ink Dark (e-paper)", EINK_DARK_THEME_MODE],
];

export const themeLabel = (mode) => (THEME_OPTIONS.find((o) => o[1] === mode) || THEME_OPTIONS[0])[0];

const darkQuery = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null;
export const systemDark = () => !!(darkQuery && darkQuery.matches);

/** Resolve { scheme, isDark, name } for a mode, the way IISERKTheme() does. */
export function resolveScheme(mode, coatId = 0) {
  const coat = NEKO_COATS.find((c) => c.id === coatId) || NEKO_COATS[0];
  let base, isDark, name;
  switch (mode) {
    case 1: base = IISERK_LIGHT; isDark = false; name = "light"; break;
    case 2: isDark = systemDark(); base = isDark ? IISERK_DARK : IISERK_LIGHT; name = isDark ? "dark" : "light"; break;
    case 3: base = MOCHA; isDark = true; name = "mocha"; break;
    case 4: base = LATTE; isDark = false; name = "latte"; break;
    case 5: base = TOKYO; isDark = true; name = "tokyo"; break;
    case 6: base = COFFEE; isDark = false; name = "coffee"; break;
    case 7: base = NEON; isDark = true; name = "neon"; break;
    case 8: base = LIQUID; isDark = true; name = "liquid"; break;
    case NEKO_THEME_MODE: base = coat.s; isDark = coat.dark; name = "neko"; break;
    case EINK_THEME_MODE: base = EINK; isDark = false; name = "eink"; break;
    case EINK_DARK_THEME_MODE: base = EINK_DARK; isDark = true; name = "eink-dark"; break;
    default: base = IISERK_DARK; isDark = true; name = "dark";
  }
  const defaults = (mode === EINK_THEME_MODE || mode === EINK_DARK_THEME_MODE) ? {} : (isDark ? DARK_DEFAULTS : LIGHT_DEFAULTS);
  return { scheme: { ...defaults, surfaceTint: base.primary, ...base }, isDark, name, coat };
}

/* ── custom primary (Theme.kt applyCustomPrimary) ───────────────── */
const hexToRgb = (h) => {
  const s = h.replace("#", "");
  const v = s.length === 8 ? s.slice(2) : s.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
};
const rgbToHex = (r) => "#" + r.map((c) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
const blend = (a, b, t) => rgbToHex(hexToRgb(a).map((c, i) => c + (hexToRgb(b)[i] - c) * t));
export const luminance = (h) => {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const [r, g, b] = hexToRgb(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export function normalizeHexInput(raw) {
  const n = String(raw || "").trim().replace(/^#/, "");
  if (n.length !== 6 && n.length !== 8) return null;
  if (!/^[0-9a-f]+$/i.test(n)) return null;
  return "#" + n.toUpperCase();
}

function applyCustomPrimary(scheme, custom, isDarkScheme, preferLightOnPrimary) {
  if (preferLightOnPrimary) {
    return { ...scheme, primary: blend(custom, "#000000", 0.42), onPrimary: W,
      primaryContainer: blend(custom, "#000000", 0.58), onPrimaryContainer: "#F1F7FF" };
  }
  const container = isDarkScheme ? blend(custom, "#000000", 0.35) : blend(custom, "#FFFFFF", 0.78);
  return { ...scheme, primary: rgbToHex(hexToRgb(custom)),
    onPrimary: luminance(custom) > 0.5 ? "#000000" : W,
    primaryContainer: container, onPrimaryContainer: luminance(container) > 0.5 ? "#000000" : W };
}

/* ── status ramp (SemanticColors.kt) ────────────────────────────── */
function statusFor(scheme, mode) {
  if (mode === EINK_THEME_MODE) return { good: "#000000", warn: "#4D4D4D", bad: "#000000", neutral: "#6E6E6E", info: "#333333" };
  if (mode === EINK_DARK_THEME_MODE) return { good: "#FFFFFF", warn: "#B2B2B2", bad: "#FFFFFF", neutral: "#999999", info: "#CCCCCC" };
  return { good: "#2E7D32", warn: "#F57F17", bad: "#C62828", neutral: scheme.onSurfaceVariant, info: "#1565C0" };
}

const kebab = (s) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

let current = null;

/** Apply the theme in prefs to <html>. Returns the resolved theme. */
export function applyTheme() {
  const mode = prefs.get("themeMode");
  const coatId = prefs.get("nekoCoat");
  const custom = normalizeHexInput(prefs.get("customPrimaryHex"));
  const r = resolveScheme(mode, coatId);
  let scheme = r.scheme;
  const isEInk = mode === EINK_THEME_MODE || mode === EINK_DARK_THEME_MODE;
  if (custom) {
    // E-Ink counts as a light scheme here, exactly as Theme.kt lists it.
    const darkForCustom = isEInk ? false : r.isDark;
    scheme = applyCustomPrimary(scheme, custom, darkForCustom, mode === 8);
  }
  const root = document.documentElement;
  const st = root.style;
  for (const [k, v] of Object.entries(scheme)) st.setProperty("--" + kebab(k), v);
  for (const [k, v] of Object.entries(statusFor(scheme, mode))) st.setProperty("--status-" + k, v);
  if (mode === NEKO_THEME_MODE) {
    st.setProperty("--neko-ears", r.coat.ears);
  }
  root.dataset.theme = r.name;
  root.dataset.scheme = r.isDark ? "dark" : "light";
  root.classList.toggle("is-eink", isEInk);
  root.classList.toggle("is-liquid", mode === 8);
  root.classList.toggle("is-neko", mode === NEKO_THEME_MODE);
  root.style.colorScheme = r.isDark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === 8 ? "#0B1420" : scheme.background.slice(0, 7));
  current = { ...r, scheme, mode, isEInk };
  document.dispatchEvent(new CustomEvent("themechange", { detail: current }));
  return current;
}

export const currentTheme = () => current;

if (darkQuery) {
  const onSys = () => { if (prefs.get("themeMode") === 2) applyTheme(); };
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", onSys);
}
