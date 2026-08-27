/** pages/about.page.js — credits & architecture note. */

import { pageHead, card } from "../ui/helpers.js";

export async function render(el) {
  el.innerHTML = `
    ${pageHead("About", "IISERKonnect Web",
      "The browser sibling of the IISERKonnect Android app.")}
    <div class="home-grid">
      ${card(`
        <h3 class="h3">Architecture in one paragraph</h3>
        <p class="small body-muted">A static frontend (this site) + a zero-dependency Node companion
        (<code class="mono">serve.py</code>) that performs campus logins with per-session cookie
        jars — the same job OkHttp did natively. Every scraper is a 1:1 port of the Kotlin parsers
        (Jsoup → DOMParser). Campus Chat uses WebRTC data channels instead of raw TCP, so it stays
        serverless and DTLS-encrypted end-to-end. Captcha-gated flows (grades, gateway) render the
        real captcha through the proxy for you to solve.</p>`)}
      ${card(`
        <h3 class="h3">Credits</h3>
        <p class="small body-muted">App, parsers and design by <strong>Shuvam Banerji Seal</strong> ·
        <a href="https://github.com/Shuvam-Banerji-Seal/IISERKonnect" target="_blank" rel="noopener">Android repo</a> ·
        <a href="mailto:sbs22ms076@iiserkol.ac.in">email</a></p>
        <p class="tiny body-muted" style="margin-top:10px">Unofficial student project — not affiliated
        with IISER Kolkata administration. MIT License. No analytics, no trackers, no cloud.</p>`)}
    </div>`;
}
