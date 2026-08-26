/**
 * modules/reveal-on-scroll.js — progressive enhancement.
 * Tags [data-reveal] elements with .js-reveal, then reveals them via
 * IntersectionObserver. Without JS the content simply shows (no class).
 */

export function initRevealOnScroll() {
  const targets = document.querySelectorAll("[data-reveal]");
  if (targets.length === 0) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) return; // stay visible

  targets.forEach((el) => {
    el.classList.add("js-reveal");
    // Stagger siblings inside the same parent
    const idx = [...el.parentElement.children].indexOf(el);
    el.style.setProperty("--reveal-delay", `${Math.min(idx, 8) * 60}ms`);
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );

  targets.forEach((el) => io.observe(el));
}
