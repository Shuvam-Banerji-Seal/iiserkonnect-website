/**
 * app/chatfab.js — the movable Campus Chat button (ui/chat/MovableChatFab.kt).
 *
 * Off by default (Settings → Notifications & Features → Campus Chat button).
 * Drag it anywhere; the position is remembered as a fraction of the window so
 * it survives a resize. Hidden on chat screens themselves and on sign-in.
 */

import { prefs } from "../core/prefs.js";
import { icon } from "../ui/icons.js";
import { nav, onRouted } from "../core/router.js";

let fab = null;
let routePattern = "";

function place() {
  if (!fab) return;
  const pos = prefs.get("chatFabPos") || { x: 1, y: 1 };
  const w = innerWidth, h = innerHeight;
  const navH = innerWidth >= 840 ? 0 : 80;
  const maxX = w - 56 - 16, maxY = h - navH - 56 - 16;
  fab.style.left = Math.round(16 + (maxX - 16) * pos.x) + "px";
  fab.style.top = Math.round(16 + (maxY - 16) * pos.y) + "px";
}

function sync() {
  const want = prefs.get("chatFabEnabled") && !routePattern.startsWith("chat") && routePattern !== "login";
  if (!want) { if (fab) { fab.remove(); fab = null; } return; }
  if (!fab) {
    fab = document.createElement("button");
    fab.type = "button";
    fab.className = "chat-fab";
    fab.setAttribute("aria-label", "Open Campus Chat (drag to move)");
    fab.innerHTML = icon("chat_bubble");
    document.body.appendChild(fab);
    drag(fab);
  }
  place();
}

function drag(el) {
  let start = null, moved = false;
  el.addEventListener("pointerdown", (e) => {
    start = { x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop };
    moved = false;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener("pointermove", (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    moved = true;
    el.style.left = Math.max(8, Math.min(innerWidth - 64, start.l + dx)) + "px";
    el.style.top = Math.max(8, Math.min(innerHeight - 64, start.t + dy)) + "px";
  });
  el.addEventListener("pointerup", () => {
    if (!start) return;
    if (moved) {
      const navH = innerWidth >= 840 ? 0 : 80;
      const maxX = innerWidth - 56 - 16, maxY = innerHeight - navH - 56 - 16;
      prefs.set("chatFabPos", {
        x: Math.max(0, Math.min(1, (el.offsetLeft - 16) / Math.max(1, maxX - 16))),
        y: Math.max(0, Math.min(1, (el.offsetTop - 16) / Math.max(1, maxY - 16))),
      });
    } else {
      nav.go("chat");
    }
    start = null;
  });
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nav.go("chat"); } });
}

export function mountChatFab() {
  onRouted((r) => { routePattern = r.pattern; sync(); });
  prefs.on("chatFabEnabled", sync);
  prefs.on("chatFabPos", place);
  addEventListener("resize", place);
}
