/**
 * components/site-footer.js — <site-footer>
 */

const GH = "https://github.com/Shuvam-Banerji-Seal";

export class SiteFooter extends HTMLElement {
  connectedCallback() {
    const year = new Date().getFullYear();
    this.innerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <a class="brand" href="#top">
                <svg class="brand__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <rect x="5" y="5" width="38" height="38" rx="12" fill="var(--primary)"/>
                  <path d="M15 20.5c0-3.6 4-6 9-6s9 2.4 9 6-4 6-9 6h-.8L18 31v-4.9c-1.9-1.1-3-2.7-3-4.6Z"
                        fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>
                </svg>
                <span>IISER<em style="font-style:normal;color:var(--primary)">Konnect</em></span>
              </a>
              <p>An unofficial, open-spirit campus companion for the IISER Kolkata
                 community — built by a student, for students.</p>
            </div>

            <nav class="footer-col" aria-label="Site">
              <h4>Explore</h4>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#chat">Campus Chat</a></li>
                <li><a href="#themes">Themes</a></li>
                <li><a href="#download">Get the App</a></li>
              </ul>
            </nav>

            <div class="footer-col">
              <h4>Project</h4>
              <ul>
                <li>
                  <a href="${GH}" target="_blank" rel="noopener noreferrer">
                    GitHub profile
                  </a>
                </li>
                <li>
                  <a href="${GH}/IISERKonnect" target="_blank" rel="noopener noreferrer">
                    Source repository
                  </a>
                </li>
                <li>
                  <a href="mailto:sbs22ms076@iiserkol.ac.in">
                    sbs22ms076@iiserkol.ac.in
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div class="footer-bottom">
            <span>© ${year} Shuvam Banerji Seal · MIT License</span>
            <span>Unofficial student project — not affiliated with IISER Kolkata administration.</span>
          </div>
        </div>
      </footer>
    `;
  }
}

customElements.define("site-footer", SiteFooter);
