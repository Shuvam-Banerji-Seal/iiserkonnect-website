/** pages/about.page.js — credits & architecture note. */

import { pageHead, card } from "../ui/helpers.js";

export async function render(el) {
  el.innerHTML = `
    ${pageHead("About", "IISERKonnect Web",
      "The browser sibling of the IISERKonnect Android app.")}
    <div class="home-grid">
      ${card(`
        <h3 class="h3">How it works</h3>
        <p class="small body-muted">A pure frontend — no backend, no proxy. On IISERK WiFi or VPN
        the browser fetches campus pages directly and parses them with DOMParser,
        the same selectors the Android app uses with Jsoup. Every scraper is a
        1:1 port of the Kotlin parsers. Campus Chat uses WebRTC data channels
        so it stays serverless and DTLS-encrypted. Captcha images are fetched
        directly for you to solve.</p>`)}
      ${card(`
        <h3 class="h3">Credits</h3>
        <p class="small body-muted">App, parsers and design by <strong>Shuvam Banerji Seal</strong> ·
        <a href="https://github.com/Shuvam-Banerji-Seal/IISERKonnect" target="_blank" rel="noopener">Android repo</a> ·
        <a href="mailto:sbs22ms076@iiserkol.ac.in">email</a></p>
        <p class="tiny body-muted" style="margin-top:10px">Unofficial student project — not affiliated
        with IISER Kolkata administration. MIT License. No analytics, no trackers, no cloud.</p>`)}
    </div>`;
}
