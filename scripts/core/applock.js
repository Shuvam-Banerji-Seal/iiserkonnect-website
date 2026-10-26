/**
 * core/applock.js — App lock (security/AppLockPolicy.kt, AppLockScreen.kt).
 *
 * A PIN of 4–12 digits, never stored: only a salted PBKDF2 hash. The same
 * policy as the phone: no all-same digits, no straight runs, no "1234"-type
 * PINs; a growing wait after three wrong tries; re-lock after the chosen idle
 * time once the tab has been hidden.
 *
 * Honest limits, also shown in Settings → Security: this hides the app in this
 * browser, but the data itself sits unencrypted in this browser's storage, so
 * anyone with access to the device's browser profile could still read it.
 * "Use fingerprint" uses the browser's own device unlock (WebAuthn) where the
 * device offers one; it proves someone could unlock the device, nothing more.
 */

import { prefs } from "./prefs.js";
import { esc } from "../ui/dom.js";
import { icon } from "../ui/icons.js";

export const MIN_PIN_LENGTH = 4, MAX_PIN_LENGTH = 12;
export const TIMEOUTS = [
  { id: "Immediately", ms: 0, label: "Immediately" },
  { id: "AfterOneMinute", ms: 60_000, label: "After 1 minute" },
  { id: "AfterFiveMinutes", ms: 300_000, label: "After 5 minutes" },
  { id: "AfterFifteenMinutes", ms: 900_000, label: "After 15 minutes" },
];
const OBVIOUS = new Set(["1234", "0000", "1111", "2580", "1212", "123456", "654321"]);

export function isAcceptablePin(pin) {
  if (!/^\d+$/.test(pin) || pin.length < MIN_PIN_LENGTH || pin.length > MAX_PIN_LENGTH) return false;
  if (new Set(pin).size === 1) return false;
  const d = [...pin].map(Number);
  const asc = d.every((v, i) => i === 0 || v - d[i - 1] === 1);
  const desc = d.every((v, i) => i === 0 || d[i - 1] - v === 1);
  if (asc || desc) return false;
  return !OBVIOUS.has(pin);
}

export function lockoutMillisAfter(failed) {
  if (failed < 3) return 0;
  if (failed < 5) return 30_000;
  if (failed < 8) return 60_000;
  return 300_000;
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
async function hashPin(pin, saltB64) {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, key, 256);
  return b64(bits);
}

export async function setPin(pin) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  prefs.patch("appLock", { enabled: true, salt, pinHash: await hashPin(pin, salt) });
}
export async function checkPin(pin) {
  const l = prefs.get("appLock");
  if (!l.pinHash || !l.salt) return false;
  return (await hashPin(pin, l.salt)) === l.pinHash;
}
export function disableLock() { prefs.set("appLock", null); sessionStorage.removeItem("iiserk-unlocked"); }
export const cryptoAvailable = () => !!(globalThis.crypto && crypto.subtle);

/* ── device unlock via WebAuthn (no server; a local presence check) ── */
export const platformAuthAvailable = async () => {
  try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
  catch { return false; }
};
export async function enrollFingerprint() {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { name: "IISERKonnect Web" },
    user: { id: crypto.getRandomValues(new Uint8Array(16)), name: "iiserkonnect-web", displayName: "IISERKonnect Web" },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
    timeout: 60000,
  } });
  prefs.patch("appLock", { fingerprint: true, credId: b64(cred.rawId) });
}
async function verifyFingerprint() {
  const l = prefs.get("appLock");
  const id = Uint8Array.from(atob(l.credId || ""), (c) => c.charCodeAt(0));
  await navigator.credentials.get({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    allowCredentials: [{ type: "public-key", id }],
    userVerification: "required", timeout: 60000,
  } });
  return true;
}

/* ── the lock screen ── */
const UNLOCK_KEY = "iiserk-unlocked";
let hiddenAt = 0;

function shouldLock() {
  const l = prefs.get("appLock");
  if (!l.enabled || !l.pinHash) return false;
  const unlockedAt = +sessionStorage.getItem(UNLOCK_KEY) || 0;
  if (!unlockedAt) return true;
  if (!hiddenAt || hiddenAt <= unlockedAt) return false;
  const t = TIMEOUTS.find((x) => x.id === l.askAgain) || TIMEOUTS[1];
  return Date.now() - hiddenAt >= t.ms;
}

function showLock() {
  return new Promise((resolve) => {
    if (document.querySelector(".lock")) return;
    const l = prefs.get("appLock");
    const box = document.createElement("div");
    box.className = "lock";
    box.innerHTML = `
      <span class="icon-tile icon-tile--primary" style="--tile:64px">${icon("lock", { size: 34 })}</span>
      <h1 class="t-headline-m">IISERKonnect is locked</h1>
      <p class="c-muted">Enter your PIN to continue</p>
      <form class="stack" style="width:min(320px,100%)">
        <div class="field"><input id="lock-pin" class="field__input" type="password" inputmode="numeric" autocomplete="off" maxlength="${MAX_PIN_LENGTH}" placeholder=" " aria-label="PIN"><label class="field__label" for="lock-pin">PIN</label></div>
        <p class="lock__msg c-error t-body-s" aria-live="assertive"></p>
        <button class="btn btn--filled btn--block" type="submit">Unlock</button>
        ${l.fingerprint ? `<button class="btn btn--text btn--block" type="button" data-fp>${icon("fingerprint", { size: 18 })}<span>Use fingerprint</span></button>` : ""}
      </form>`;
    document.body.appendChild(box);
    const input = box.querySelector("#lock-pin");
    const msg = box.querySelector(".lock__msg");
    const btn = box.querySelector('[type="submit"]');
    input.focus();
    const done = () => { sessionStorage.setItem(UNLOCK_KEY, String(Date.now())); prefs.patch("appLock", { failed: 0, lockedUntil: 0 }); box.remove(); resolve(); };
    let tick;
    const refreshWait = () => {
      const until = prefs.get("appLock").lockedUntil || 0;
      const secs = Math.ceil((until - Date.now()) / 1000);
      if (secs > 0) { btn.disabled = true; btn.querySelector ? (btn.textContent = `Wait ${secs}s`) : 0; msg.textContent = `Too many attempts. Try again in ${secs}s.`; }
      else { btn.disabled = false; btn.textContent = "Unlock"; clearInterval(tick); tick = null; }
    };
    if ((prefs.get("appLock").lockedUntil || 0) > Date.now()) { refreshWait(); tick = setInterval(refreshWait, 1000); }
    box.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      const ok = await checkPin(input.value);
      if (ok) return done();
      const failed = (prefs.get("appLock").failed || 0) + 1;
      const wait = lockoutMillisAfter(failed);
      prefs.patch("appLock", { failed, lockedUntil: wait ? Date.now() + wait : 0 });
      input.value = "";
      const left = 3 - failed;
      msg.textContent = wait ? "" : left >= 1 && left <= 2 ? `Wrong PIN — ${left} attempt${left === 1 ? "" : "s"} before a wait.` : "Wrong PIN.";
      if (wait) { refreshWait(); tick = setInterval(refreshWait, 1000); }
    });
    const fp = box.querySelector("[data-fp]");
    if (fp) fp.addEventListener("click", async () => {
      try { await verifyFingerprint(); done(); } catch { msg.textContent = esc("Device unlock was cancelled or is not available."); }
    });
  });
}

export async function guardWithAppLock() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (shouldLock()) showLock();
  });
  if (shouldLock()) await showLock();
}
