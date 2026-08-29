/**
 * core/session.js — credential storage and campus login flows.
 * No proxy. Credentials live in localStorage.
 * Login-protected flows (WeLearn, Canteen ERP, Grades, Gateway) POST
 * directly to campus endpoints. On campus with same-origin or permissive
 * CORS, sessions work natively; off-campus they redirect to the portal.
 */

import { get, postForm, getBlob, C } from "./net.js";
import { store } from "../core/store.js";
import { parse, q, attr } from "../core/html.js";

/* ── shared credentials (localStorage) ──────────────────────────── */
export const creds = {
  get() { return store.get("ldap") || null; },
  save(u, p) { store.set("ldap", { u, p }); },
  clear() { store.set("ldap", null); store.set("flags", {}); },
  has() { return !!creds.get(); },
};

const flags = {
  get: () => store.get("flags", {}),
  set(k, v) { const f = flags.get(); f[k] = v; store.set("flags", f); },
};

function isCorsError(e) { return /Failed to fetch|NetworkError|TypeError.*Failed/i.test(e.message || e); }

/* ── WeLearn (Moodle) — direct fetch, campus-only ──────────────── */
export function welearnLoggedIn(html) {
  const doc = parse(html);
  if (doc.body.textContent.includes("Invalid login")) return false;
  if (q(doc, ".loginerrors")) return false;
  return !!q(doc, 'a[href*="/login/logout.php"]');
}

async function welearnLogin() {
  const { u, p } = creds.get() || {};
  if (!u) return false;
  try {
    const page = await get(C.WELEARN_LOGIN);
    const doc = parse(page.text);
    const token = attr(q(doc, 'input[name="logintoken"]'), "value");
    if (!token) return false;
    const res = await postForm(C.WELEARN_LOGIN, { username: u, password: p, logintoken: token });
    const ok = welearnLoggedIn(res.text);
    flags.set("welearn", ok);
    return ok;
  } catch {
    flags.set("welearn", false);
    return false;
  }
}

export async function ensureWelearn() {
  if (flags.get().welearn) return true;
  try {
    const dash = await get(C.WELEARN_MY);
    if (welearnLoggedIn(dash.text)) { flags.set("welearn", true); return true; }
  } catch { /* campus-only or CORS block */ }
  return welearnLogin();
}

/* ── Canteen ERP (CSRF-only, no captcha) ───────────────────────── */
export async function ensureCanteen() {
  if (flags.get().canteen) return true;
  const { u, p } = creds.get() || {};
  if (!u) return false;
  try {
    const page = await get(C.CANTEEN_LOGIN);
    const csrf = attr(q(parse(page.text), 'input[name="csrfmiddlewaretoken"]'), "value");
    if (!csrf) return false;
    const res = await postForm(C.CANTEEN_LOGIN, { csrfmiddlewaretoken: csrf, userid: u, password: p });
    const ok = res.text.toLowerCase().includes("logged in as");
    flags.set("canteen", ok);
    return ok;
  } catch { return false; }
}

/* ── MyProfile grades (captcha-gated) ───────────────────────────── */
export async function gradesLoginPage() {
  try {
    const page = await get(C.WELEARN_MYPROFILE_LOGIN);
    const doc = parse(page.text);
    const csrf = attr(q(doc, 'input[name="csrfmiddlewaretoken"]'), "value");
    const hash = attr(q(doc, 'input[name="captcha_0"]'), "value");
    const img = q(doc, "img.captcha");
    const imgUrl = img
      ? new URL(attr(img, "src"), C.WELEARN).href
      : `${C.WELEARN}/myprofile/captcha/image/${hash}/`;
    return { csrf, hash, imgUrl };
  } catch { return { csrf: "", hash: "", imgUrl: "" }; }
}

export async function gradesSubmit(login, captcha) {
  const { u, p } = creds.get() || {};
  try {
    const res = await postForm(C.WELEARN_MYPROFILE_LOGIN, {
      csrfmiddlewaretoken: login.csrf, username: u, password: p,
      captcha_0: login.hash, captcha_1: captcha,
    });
    const bad = res.text.toLowerCase().includes("invalid captcha");
    const backToLogin = res.text.includes("captcha_0") && res.text.length < 4000;
    const ok = !bad && !backToLogin;
    flags.set("grades", ok);
    return { ok, error: bad ? "Invalid captcha" : ok ? null : "Login failed — check credentials" };
  } catch { return { ok: false, error: "Network error — ensure campus access" }; }
}

export async function ensureGrades() {
  if (flags.get().grades) return true;
  try {
    const probe = await get(`${C.WELEARN_MYPROFILE_GRADES}1/`);
    if (probe.ok && !(probe.text.includes("captcha_0") && probe.text.length < 4000)) {
      flags.set("grades", true); return true;
    }
  } catch { /* campus-only */ }
  return false;
}

/* ── Gateway MAC registration (captcha-gated) ──────────────────── */
export async function gatewayLoginPage() {
  try {
    const page = await get(C.MACREG);
    const doc = parse(page.text);
    if (!page.text.toLowerCase().includes("captcha") || page.text.toLowerCase().includes("logout")) {
      return { loggedIn: true };
    }
    const csrf = attr(q(doc, 'input[name="csrfmiddlewaretoken"]'), "value");
    const hash = attr(q(doc, 'input[name="captcha_0"]'), "value");
    const img = q(doc, "img.captcha");
    const imgUrl = img ? new URL(attr(img, "src"), C.GW).href : `${C.GW}/macreg/captcha/image/${hash}/`;
    const form = q(doc, "form[action]");
    const action = form ? new URL(attr(form, "action") || "/macreg/login/?next=/macreg/", C.GW).href : `${C.GW}/macreg/login/?next=/macreg/`;
    return { loggedIn: false, csrf, hash, imgUrl, action };
  } catch { return { loggedIn: false, csrf: "", hash: "", imgUrl: "", action: "" }; }
}

export async function gatewaySubmit(login, captcha) {
  const { u, p } = creds.get() || {};
  try {
    const res = await postForm(login.action, { csrfmiddlewaretoken: login.csrf, username: u, password: p, captcha_0: login.hash, captcha_1: captcha });
    const ok = res.text.toLowerCase().includes("logout") || (res.text.toLowerCase().includes("logged in") && !res.text.toLowerCase().includes("captcha"));
    flags.set("gateway", ok);
    return { ok, html: res.text, error: ok ? null : "Incorrect credentials or captcha" };
  } catch { return { ok: false, html: "", error: "Network error — ensure campus access" }; }
}

export function gatewayLoggedInHtml(html) {
  const t = html.toLowerCase();
  return t.includes("logout") || (t.includes("logged in") && !t.includes("captcha"));
}

export async function captchaBlob(url) { return getBlob(url); }
