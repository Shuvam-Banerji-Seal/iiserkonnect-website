/**
 * modules/count-up.js — animates every .stat__value[data-count] from 0
 * to its target when it scrolls into view.
 */

export function initCountUp() {
  const values = document.querySelectorAll(".stat__value[data-count]");
  if (values.length === 0) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const render = (el, n) => {
    el.textContent = `${n}${el.dataset.countSuffix ?? ""}`;
  };

  const animate = (el) => {
    const suffix = (el.textContent.match(/[^\d.]+$/) ?? [""])[0];
    el.dataset.countSuffix = suffix;
    const target = parseFloat(el.dataset.count) || 0;
    if (reduced || target <= 0) { render(el, target); return; }

    const t0 = performance.now();
    const dur = 950;
    const tick = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      render(el, Math.round(target * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (!("IntersectionObserver" in window)) {
    values.forEach(animate);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animate(entry.target);
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.6 }
  );

  values.forEach((el) => io.observe(el));
}
