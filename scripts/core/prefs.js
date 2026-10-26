/**
 * core/prefs.js — the app's settings (PreferencesManager), kept in this
 * browser's localStorage through core/store.js.
 *
 * Every key has the app's default, so a fresh browser behaves like a fresh
 * install. Values are plain JSON. Subscribe to react to a change made on any
 * screen (or in another tab: the storage event is forwarded).
 */

import { store } from "./store.js";

export const DEFAULTS = Object.freeze({
  themeMode: 0,               // Theme.kt: 0 = Dark (Default)
  nekoCoat: 0,
  customPrimaryHex: null,
  motionLevel: 2,             // UiMotion.FULL
  hapticOnTap: true,
  hapticStrength: "MEDIUM",
  homeLayout: null,           // HomeLayout JSON; null = defaultHomeLayout()
  chatFabEnabled: false,
  chatFabPos: null,
  jumpToMessMenu: false,
  shareMessMenu: false,
  qrBrightnessEnabled: true,
  qrBrightnessLevel: 1,       // QrBrightness.DEFAULT_LEVEL
  profile: { name: "", roll: "", stream: "", avatar: null },
  appLock: { enabled: false, pinHash: null, salt: null, fingerprint: false, askAgain: "immediately" },
  dataSource: "auto",         // "auto" = try campus, fall back to samples · "sample" = samples only
  calorieReminder: { enabled: false, hour: 20, minute: 0 },
  welearnLoginSkipped: false,
  welearnDeepCache: false,
  loggingEnabled: false,
  chatRetentionMonths: 6,
  chatBackground: false,
  signedIn: false,
  loginSkipped: false,
  savedAccounts: [],
  onboarded: false,
  timerState: null,
  stopwatchState: null,
  focusState: null,
  focusSettings: null,
});

const subs = new Map();

export const prefs = {
  get(key) {
    const v = store.get("pref." + key);
    if (v === undefined || v === null) {
      const d = DEFAULTS[key];
      return d && typeof d === "object" ? structuredClone(d) : d;
    }
    return v;
  },
  set(key, value) {
    store.set("pref." + key, value);
    (subs.get(key) || []).slice().forEach((fn) => { try { fn(value); } catch (e) { console.warn(e); } });
  },
  /** Shallow-merge into an object-valued pref. */
  patch(key, partial) { prefs.set(key, { ...prefs.get(key), ...partial }); },
  reset(key) { prefs.set(key, null); },
  on(key, fn) {
    if (!subs.has(key)) subs.set(key, []);
    subs.get(key).push(fn);
    return () => { const a = subs.get(key); const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  },
};

/* another tab changed something: re-announce every key */
addEventListener("storage", (e) => {
  if (e.key !== "iiserk-web") return;
  for (const [key, fns] of subs) fns.forEach((fn) => { try { fn(prefs.get(key)); } catch {} });
});
