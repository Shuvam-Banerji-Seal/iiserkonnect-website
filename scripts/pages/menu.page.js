/** pages/menu.page.js — today's canteen menu. */

import { fetchMenu } from "../services/canteen.service.js";
import { pageHead, card, esc, emptyState, errorState, requireProxy } from "../ui/helpers.js";

export async function render(el) {
  el.innerHTML = pageHead("Mess Menu", "Today's menu", "Live from the canteen ERP — the same parser the app uses.");
  const proxy = await requireProxy();
  if (!proxy.ok) return el.insertAdjacentHTML("beforeend", proxy.html);

  const mount = document.createElement("div");
  el.appendChild(mount);
  mount.innerHTML = `<div class="page-loading"><span class="spinner"></span> Fetching menu…</div>`;
  try {
    const menu = await fetchMenu();
    mount.innerHTML = `
      <p class="body-muted small" style="margin-bottom:16px">${esc(menu.title)}</p>
      <div class="menu-grid">
        ${menu.meals.map((m) => card(`
          <h3 class="h3">${esc(m.type)}</h3>
          <ul class="menulist">
            ${m.items.map((i) => `<li class="${i.startsWith("★") ? "special" : ""}">${esc(i)}</li>`).join("")}
          </ul>`)).join("")}
      </div>`;
  } catch (e) {
    mount.innerHTML = errorState(e.message, "menu");
  }
}
