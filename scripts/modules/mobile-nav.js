/**
 * modules/mobile-nav.js — hamburger toggle + drawer dismissal.
 */

export function initMobileNav() {
  const nav = document.querySelector(".site-nav");
  const burger = nav?.querySelector(".nav-burger");
  if (!nav || !burger) return;

  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  burger.addEventListener("click", () =>
    setOpen(!nav.classList.contains("is-open")));

  // Close on any drawer link tap
  nav.querySelectorAll(".nav-drawer a").forEach((a) =>
    a.addEventListener("click", () => setOpen(false)));

  // Close on Escape / outside tap
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("is-open") && !e.target.closest(".site-nav")) {
      setOpen(false);
    }
  });
}
