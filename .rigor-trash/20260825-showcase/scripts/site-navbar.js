/**
 * components/site-navbar.js — <site-navbar>
 * Fixed glass navbar: brand, section links (desktop), CTA,
 * hamburger + drawer (mobile). Behavior wired by modules/mobile-nav.js
 * and modules/scroll-spy.js.
 */

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#chat",     label: "Campus Chat" },
  { href: "#themes",   label: "Themes" },
  { href: "#tech",     label: "Tech" },
];

const MARK = `
<svg class="brand__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
  <defs>
    <linearGradient id="bm-g" x1="6" y1="4" x2="42" y2="44">
      <stop offset="0" stop-color="var(--primary)"/>
      <stop offset="1" stop-color="var(--accent)"/>
    </linearGradient>
  </defs>
  <rect x="5" y="5" width="38" height="38" rx="12" fill="url(#bm-g)"/>
  <path d="M15 20.5c0-3.6 4-6 9-6s9 2.4 9 6-4 6-9 6h-.8L18 31v-4.9c-1.9-1.1-3-2.7-3-4.6Z"
        fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>
</svg>`;

export class SiteNavbar extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <nav class="site-nav" aria-label="Primary">
        <div class="site-nav__inner">
          <a class="brand" href="#top" aria-label="IISERKonnect home">
            ${MARK}
            <span>IISER<em>Konnect</em></span>
          </a>

          <ul class="nav-links">
            ${LINKS.map((l) => `<li><a href="${l.href}">${l.label}</a></li>`).join("")}
          </ul>

          <a class="btn btn--primary btn--sm nav-cta" href="#download">Get the App</a>

          <button class="nav-burger" type="button"
                  aria-expanded="false" aria-controls="mobile-drawer"
                  aria-label="Open menu"><span></span></button>
        </div>

        <div class="nav-drawer" id="mobile-drawer">
          ${LINKS.map((l) => `<a href="${l.href}">${l.label}</a>`).join("")}
          <a class="btn btn--primary" href="#download">Get the App</a>
        </div>
      </nav>
    `;
  }
}

customElements.define("site-navbar", SiteNavbar);
