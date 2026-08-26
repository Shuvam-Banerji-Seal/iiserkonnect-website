/**
 * core/router.js — hash router with route table + active-link sync.
 */

const routes = new Map();
let outlet = null;
let onAfter = null;

export function registerRoute(id, def) { routes.set(id, def); }
export function setOutlet(el) { outlet = el; }
export function onRouted(fn) { onAfter = fn; }

export function currentRoute() {
  return (location.hash || "#/home").replace(/^#\/?/, "").split("?")[0] || "home";
}

export function navigate(id) { location.hash = `#/${id}`; }

export async function renderCurrent() {
  const id = currentRoute();
  const def = routes.get(id) || routes.get("home");
  document.title = `${def.title} · IISERKonnect Web`;
  if (outlet) {
    outlet.innerHTML = `<div class="page-loading"><span class="spinner"></span></div>`;
    try { await def.render(outlet); }
    catch (err) {
      outlet.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">⚠️</div>
          <h3>Something broke</h3>
          <p class="body-muted">${(err && err.message) || err}</p>
          <button class="btn btn--ghost btn--sm" onclick="location.reload()">Reload</button>
        </div>`;
    }
  }
  document.querySelectorAll("[data-nav]").forEach((a) =>
    a.setAttribute("aria-current", String(a.dataset.nav === id)));
  if (onAfter) onAfter(id);
}

export function startRouter() {
  window.addEventListener("hashchange", renderCurrent);
  return renderCurrent();
}
