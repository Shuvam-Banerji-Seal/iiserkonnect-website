/**
 * modules/scroll-spy.js — highlights the nav link of the section in view,
 * and adds .is-scrolled to the navbar once the page scrolls.
 */

export function initScrollSpy() {
  const nav = document.querySelector(".site-nav");
  const links = [...document.querySelectorAll(".nav-links a, .nav-drawer a")];

  const onScroll = () =>
    nav?.classList.toggle("is-scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const sections = links
    .map((a) => document.querySelector(a.hash))
    .filter(Boolean);

  if (!("IntersectionObserver" in window) || sections.length === 0) return;

  const byId = new Map(sections.map((s) => [`#${s.id}`, s]));

  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const hash = `#${entry.target.id}`;
        links.forEach((a) =>
          a.setAttribute("aria-current", String(a.hash === hash)));
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );

  byId.forEach((section) => spy.observe(section));
}
