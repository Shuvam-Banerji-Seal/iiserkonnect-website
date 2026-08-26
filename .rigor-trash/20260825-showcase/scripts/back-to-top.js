/**
 * modules/back-to-top.js — floating button that appears after scrolling.
 */

export function initBackToTop() {
  const btn = document.createElement("button");
  btn.className = "to-top";
  btn.type = "button";
  btn.setAttribute("aria-label", "Back to top");
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
  </svg>`;
  document.body.appendChild(btn);

  const toggle = () =>
    btn.classList.toggle("is-visible", window.scrollY > 480);
  toggle();
  window.addEventListener("scroll", toggle, { passive: true });

  btn.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" }));
}
