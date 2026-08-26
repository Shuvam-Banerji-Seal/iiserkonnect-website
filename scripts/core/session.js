/**
 * core/session.js — port of CredentialManager + the ensureLoggedIn flows.
 * Credentials live in localStorage (browser has no keystore; the companion
 * proxy holds the actual server sessions under the X-SID jar).
 */

import { store } from "./store.js";
import { get, postForm, getBlob, clearServerSession, C } from "./net.js";
import { parse, q, attr, regex1 } from "./html.js";

export const creds = {
  get() { return store.get("ldap") || null; },              // {u, p}
  save(u, p) { store.set("ldap", { u, p }); },
  clear() { store.set("ldap", null); clearServerSession(); store.set("flags", {}); },
  has() { return !!creds.get(); },
};

export const flags = {
  get: () => store.get("flags", {}),
  set(k, v) { const f = flags.get(); f[k] = v; store.set("flags", f); },
};

/* ── WeLearn (Moodle) ──────────────────────────────────────────── */
export function welearnLoggedIn(html) {
  const doc = parse(html);
  if (doc.body.textContent.includes("Invalid login, please try again")) return false;
  if (q(doc, ".loginerrors")) return false;
  return !!q(doc, 'a[href*="/login/logout.php"]');
}

async function welearnLogin() {
  const { u, p } = creds.get() || {};
  if (!u) return false;
  const page = await get(C.WELEARN_LOGIN);
  const token = attr(q(parse(page.text), 'input[name="logintoken"]'), "value");
  if (!token) return false;
  const res = await postForm(C.WELEARN_LOGIN, { username: u, password: p, logintoken: token });
  const ok = welearnLoggedIn(res.text);
  flags.set("welearn", ok);
  return ok;
}

export async function ensureWelearn() {
  if (flags.get().welearn) return true;
  const dash = await get(C.WELEARN_MY).catch(() => null);
  if (dash && welearnLoggedIn(dash.text)) { flags.set("welearn", true); return true; }
  return welearnLogin();
}

/* ── Canteen ERP (no captcha — CSRF only) ──────────────────────── */
export async function ensureCanteen() {
  if (flags.get().canteen) return true;
  const { u, p } = creds.get() || {};
  if (!u) return false;
  const page = await get(C.CANTEEN_LOGIN);
  const csrf = regex1(/csrfmiddlewaretoken[^>]*value=['"]([^'"]+)['"]/, page.text);
  if (!csrf) return false;
  const res = await postForm(C.CANTEEN_LOGIN, {
    csrfmiddlewaretoken: csrf, userid: u, password: p,
  });
  const ok = res.text.toLowerCase().includes("logged in as");
  flags.set("canteen", ok);
  return ok;
}

/* ── MyProfile grades (captcha-gated) ──────────────────────────── */
export async function gradesLoginPage() {
  const page = await get(C.WELEARN_MYPROFILE_LOGIN);
  const doc = parse(page.text);
  const csrf = attr(q(doc, 'input[name="csrfmiddlewaretoken"]'), "value");
  const hash = attr(q(doc, 'input[name="captcha_0"]'), "value");
  const img = q(doc, "img.captcha");
  const imgUrl = img ? new URL(attr(img, "src"), C.WELEARN).href
    : `${C.WELEARN}/myprofile/captcha/image/${hash}/`;
  return { csrf, hash, imgUrl };
}

export async function gradesSubmit(login, captcha) {
  const { u, p } = creds.get() || {};
  const res = await postForm(C.WELEARN_MYPROFILE_LOGIN, {
    csrfmiddlewaretoken: login.csrf, username: u, password: p,
    captcha_0: login.hash, captcha_1: captcha,
  });
  const bad = res.text.toLowerCase().includes("invalid captcha");
  const backToLogin = res.text.includes("captcha_0") && res.text.length < 4000;
  const ok = !bad && !backToLogin;
  flags.set("grades", ok);
  return { ok, error: bad ? "Invalid captcha" : ok ? null : "Login failed — check credentials" };
}

export async function ensureGrades() {
  if (flags.get().grades) return true;
  const probe = await get(C.WELEARN_MYPROFILE_GRADES + "1/").catch(() => null);
  if (probe && !(probe.text.includes("captcha_0") && probe.text.length < 4000)) {
    flags.set("grades", true); return true;
  }
  return false;
}

/* ── Gateway macreg / TCP counter (captcha-gated) ──────────────── */
export async function gatewayLoginPage() {
  const page = await get(C.MACREG);
  const doc = parse(page.text);
  if (!page.text.toLowerCase().includes("captcha") || page.text.toLowerCase().includes("logout")) {
    return { loggedIn: true };
  }
  const csrf = attr(q(doc, 'input[name="csrfmiddlewaretoken"]'), "value");
  const hash = attr(q(doc, 'input[name="captcha_0"]'), "value");
  const img = q(doc, "img.captcha");
  const imgUrl = img ? new URL(attr(img, "src"), C.GW).href
    : `${C.GW}/macreg/captcha/image/${hash}/`;
  const form = q(doc, "form[action]");
  const action = form ? new URL(attr(form, "action") || "/macreg/login/?next=/macreg/", C.GW).href
    : `${C.GW}/macreg/login/?next=/macreg/`;
  return { loggedIn: false, csrf, hash, imgUrl, action };
}

export async function gatewaySubmit(login, captcha) {
  const { u, p } = creds.get() || {};
  const res = await postForm(login.action, {
    csrfmiddlewaretoken: login.csrf, username: u, password: p,
    captcha_0: login.hash, captcha_1: captcha,
  });
  const t = res.text.toLowerCase();
  const ok = !t.includes("captcha") || t.includes("logout");
  flags.set("gateway", ok);
  return { ok, html: res.text, error: ok ? null : "Incorrect credentials or captcha" };
}

export function gatewayLoggedInHtml(html) {
  const t = html.toLowerCase();
  return t.includes("logout") || (t.includes("logged in as") && !t.includes("captcha"));
}

export async function captchaBlob(url) {
  return getBlob(url);
}
