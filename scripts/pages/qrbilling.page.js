/**
 * pages/qrbilling.page.js — QR Billing (ui/mess/QrBillingScreen.kt).
 *
 * In the app this is a launcher: it checks the network, signs you in with the
 * saved WeLearn login and opens the counter's own page (/canteen/qrCode/),
 * raising the screen brightness while the rolling QR shows.
 *
 * In a browser:
 *   - the network cannot be inspected, so the screen shows the app's
 *     "Campus network needed" state and the user confirms with "I'm on campus
 *     Wi-Fi — open anyway", which opens the counter page in a new tab;
 *   - sign-in cannot be handed over (the counter page asks for it itself);
 *   - brightness cannot be set by a web page. The Settings → Mess level is kept
 *     and used for a "bright presentation": a white, high-contrast screen that
 *     also holds a Screen Wake Lock so the phone does not dim in the queue.
 */

import { prefs } from "../core/prefs.js";
import { C } from "../core/net.js";
import { esc } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn } from "../ui/components.js";
import { snackbar } from "../ui/overlay.js";
import * as motion from "../core/motion.js";

export const QR_BILLING_PILOT_LOCATION = "DH-2, the 2 self-billing counters";

const wakeLockSupported = () => "wakeLock" in navigator;

export async function render(el) {
  const brightOn = prefs.get("qrBrightnessEnabled");
  const level = Math.max(0.3, Math.min(1, prefs.get("qrBrightnessLevel") || 1));

  const step = (n, text) => `<li>${esc(text)}</li>`;
  const bullet = (text) => `<li>${esc(text)}</li>`;
  const section = (ic, title, inner) => `<section class="qr-card neko-ears glass-med">
    <h2 class="qr-card__title">${icon(ic, { cls: "c-primary" })}<span>${esc(title)}</span></h2>${inner}</section>`;

  el.innerHTML = screen({
    bar: topBar({
      title: "QR Billing", subtitle: "SMC self-billing · pilot",
      actions: brightOn ? iconBtn("brightness_high", "Bright presentation", { "data-act": "bright" }) : "",
    }),
    body: `<div class="qr-page">
      <div class="qr-ready qr-ready--off" role="status">
        ${icon("warning")}
        <div><h2>Campus network needed</h2>
          <p>The counter is not reachable from mobile data. Connect to iiserk-wifi first.</p>
          <p class="qr-ready__web">A browser cannot see which network you are on, so this cannot turn green by itself — check your Wi-Fi, then use the link below.</p></div>
      </div>

      <button class="btn btn--filled btn--block qr-primary" type="button" disabled>${icon("qr_code_scanner")}<span>Open billing page</span></button>
      <p class="t-body-s c-muted">Connect to iiserk-wifi to enable this.</p>
      <a class="qr-anyway" href="${esc(C.CANTEEN_QR_BILLING)}" target="_blank" rel="noopener noreferrer" data-act="open">I'm on campus Wi-Fi — open anyway</a>
      <p class="t-body-s c-muted">The billing page opens in a new tab and asks for your login there — the web version cannot sign you in for it, and nothing is typed here.</p>

      ${brightOn ? `<section class="qr-bright neko-ears glass-med">
        <div class="row">${icon("brightness_high", { cls: "c-primary" })}<h2 class="t-title-s w-semi grow">Bright screen · ${Math.round(level * 100)}%</h2>
          <a class="btn btn--text btn--sm" href="#/settings">Change</a></div>
        <p class="t-body-s c-muted">A web page cannot change your phone's brightness, and it cannot reach into the billing page's tab. Turn your brightness up yourself before you show the QR. Here, "Bright presentation" switches this screen to a white, high-contrast view at the level above and ${wakeLockSupported() ? "keeps the screen awake while it is open" : "would keep the screen awake, but this browser has no Screen Wake Lock"}.</p>
        <button class="btn btn--tonal mt-sm" type="button" data-act="bright">${icon("brightness_high", { size: 18 })}<span>Bright presentation</span></button>
      </section>` : ""}

      ${section("info", "How it works", `<ol class="olist">
        ${step(1, "Connect to iiserk-wifi. You can do this from anywhere, not just in the queue.")}
        ${step(2, "Open the billing page. If the app has your WeLearn login saved, you are signed in automatically.")}
        ${step(3, "Your phone shows a rolling QR with a countdown, with the screen brightened so the counter can read it (full by default; change it with the sun button on that page or in Settings → Mess). Show it at the counter.")}
        ${step(4, "Select your items and complete the billing.")}</ol>
        <p class="fineprint mt-md">If the page won't load, use your ID card at the manned counter instead.</p>
        <p class="fineprint mt-sm">On the web, step 2 asks for your login on the counter's page, and step 3's brightening is up to you (see Bright screen above).</p>`)}
      ${section("restaurant", "Why the barcode was replaced", `<ul class="ulist">
        ${bullet("It was a plain, unencrypted barcode: a barcode carrying someone else's roll number was easy to generate and misuse.")}
        ${bullet("SMC could not reissue it. A lost or stolen card's old barcode stayed valid and could still be duplicated.")}
        ${bullet("The new QR is encrypted and expires quickly, so a copied or screenshotted code is useless.")}</ul>`)}
      ${section("lock", "What is still a weak point", `<ul class="ulist">
        ${bullet("Your WeLearn credentials. Anyone holding them can bill as you.")}
        ${bullet("Change them yourself at any time through the intranet if you suspect they have leaked.")}</ul>`)}
      <p class="qr-pilot neko-ears">Pilot. This runs only at ${esc(QR_BILLING_PILOT_LOCATION)} today, and the ID-card barcodes no longer work there. Full rollout follows once the pilot completes.</p>
    </div>`,
  });

  /* ── bright presentation + wake lock ── */
  let lock = null;
  let overlay = null;
  const acquire = async () => {
    if (!wakeLockSupported() || document.visibilityState !== "visible") return false;
    try { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; renderLockState(); }); return true; }
    catch { lock = null; return false; }
  };
  const renderLockState = () => {
    const s = overlay && overlay.querySelector("[data-lock-state]");
    if (!s) return;
    s.innerHTML = wakeLockSupported()
      ? (lock ? `${icon("check_circle", { size: 18 })}<span>Screen kept awake</span>` : `${icon("info", { size: 18 })}<span>Screen may dim — tap to keep it awake</span>`)
      : `${icon("info", { size: 18 })}<span>This browser cannot keep the screen awake</span>`;
  };
  const openBright = async () => {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "qr-present";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Bright presentation");
    overlay.style.setProperty("--level", String(level));
    overlay.innerHTML = `
      <div class="qr-present__inner">
        <span class="qr-present__sun">${icon("brightness_high", { size: 40 })}</span>
        <h2>Ready at the counter</h2>
        <p>Turn your phone's brightness all the way up now — a web page cannot do it for you. This white screen stays at ${Math.round(level * 100)}% and is kept awake while it is open.</p>
        <a class="qr-present__open" href="${esc(C.CANTEEN_QR_BILLING)}" target="_blank" rel="noopener noreferrer">${icon("qr_code_scanner")}<span>Open billing page</span></a>
        <button type="button" class="qr-present__lock" data-lock-state></button>
        <button type="button" class="qr-present__exit" data-exit>${icon("close", { size: 18 })}<span>Exit bright presentation</span></button>
      </div>`;
    document.body.appendChild(overlay);
    motion.animate(overlay, [{ opacity: 0 }, { opacity: 1 }]);
    overlay.querySelector("[data-exit]").addEventListener("click", closeBright);
    overlay.querySelector("[data-lock-state]").addEventListener("click", async () => { await acquire(); renderLockState(); });
    overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") closeBright(); });
    overlay.querySelector("[data-exit]").focus();
    try { if (document.documentElement.requestFullscreen && matchMedia("(max-width: 840px)").matches) await document.documentElement.requestFullscreen({ navigationUI: "hide" }); } catch { /* optional */ }
    await acquire();
    renderLockState();
  };
  const closeBright = () => {
    if (!overlay) return;
    const o = overlay; overlay = null;
    if (lock) { lock.release().catch(() => {}); lock = null; }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    motion.animate(o, [{ opacity: 1 }, { opacity: 0 }]).then(() => o.remove());
  };
  // The lock is dropped by the browser whenever the tab is hidden; take it again on return.
  const onVis = () => { if (overlay && document.visibilityState === "visible") acquire().then(renderLockState); };
  document.addEventListener("visibilitychange", onVis);

  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.dataset.act === "bright") openBright();
    if (b.dataset.act === "open") snackbar("Opening the counter's page in a new tab — it only loads on campus Wi-Fi.");
  });

  return () => { document.removeEventListener("visibilitychange", onVis); closeBright(); };
}
