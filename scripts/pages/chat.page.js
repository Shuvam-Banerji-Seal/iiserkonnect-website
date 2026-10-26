/**
 * pages/chat.page.js — Campus Chat (ui/chat/ChatHomeScreen.kt, ChatRoomScreen.kt).
 *
 * Same screens as the app — Contacts / Requests / Graph tabs, the status card,
 * the people list, the thread with date chips, ticks, typing bubble, jump to
 * latest, message actions, Markdown toggle, attachments and transcript export.
 * The transport is WebRTC between browsers (see chat/engine.js for why).
 */

import * as chat from "../chat/engine.js";
import { prefs } from "../core/prefs.js";
import { nav, seg } from "../core/router.js";
import * as motion from "../core/motion.js";
import { esc, on, timeOf, ago, formatBytes, DAY_NAMES, MONTH_NAMES } from "../ui/dom.js";
import { icon, topBar, screen, tabs, searchField, avatar, iconBtn, browserNote, emptyState, textField } from "../ui/components.js";
import { dialog, confirm, snackbar, toast, menu } from "../ui/overlay.js";
import { renderMarkdown } from "../ui/markdown.js";
import { haptics } from "../ui/haptics.js";

const NOT_POSSIBLE = "Phones running the app find each other on campus Wi-Fi by themselves and talk directly. A web page cannot listen on the network or discover devices, so web chat links two browsers with WebRTC: one person creates an invite code, the other answers it, and the conversation then flows directly between the two browsers, encrypted (DTLS). Both of you need the chat open; it cannot reach people using the Android app.";

/* ═══════════════ Chat home ═══════════════ */
export async function renderHome(el, ctx) {
  let tab = ctx.query.tab || "contacts";
  let query = "";
  const draw = async () => {
    const list = (await chat.peers()).sort((a, b) => (b.lastAt || b.addedAt || 0) - (a.lastAt || a.addedAt || 0));
    const pend = chat.pendingInvites();
    const reqBadge = pend.length;
    const sc = el.querySelector(".screen__scroll");
    const keep = sc ? sc.scrollTop : 0;
    el.innerHTML = screen({
      bar: topBar({ title: "Campus Chat" }),
      body: `${tabs([{ id: "contacts", label: "Contacts" }, { id: "requests", label: "Requests", badge: reqBadge || "" }, { id: "graph", label: "Graph" }], tab)}
        <div class="chat-tab">${tab === "contacts" ? contacts(list) : tab === "requests" ? requests(list, pend) : graph(list)}</div>`,
    });
    el.querySelector(".screen__scroll").scrollTop = keep;
    if (tab === "graph") layoutGraph(el.querySelector(".chat-graph"), list);
  };

  const contacts = (list) => {
    const me = chat.me();
    const onlineCount = list.filter((p) => chat.isOnline(p.id)).length;
    const filtered = list.filter((p) => !query.trim() || `${chat.displayName(p)} ${p.username}`.toLowerCase().includes(query.trim().toLowerCase()));
    return `
      <div class="chat-status neko-ears glass-med">
        <div class="row" style="gap:16px">
          <span class="chat-status__icon">${icon("chat_bubble")}</span>
          <div class="grow"><h2 class="t-title-m">${chat.webrtcSupported() ? "Ready — connect with an invite code" : "Chat is not available in this browser"}</h2>
            <p class="t-body-m c-muted">${chat.webrtcSupported() ? `${onlineCount} connected · you appear as ${esc(me.name)}` : "This browser has no WebRTC."}</p></div>
        </div>
        <div class="btn-row mt-md"><button class="btn btn--filled btn--grow" type="button" data-act="invite"${chat.webrtcSupported() ? "" : " disabled"}><span>Create invite</span></button>
          <button class="btn btn--outlined btn--grow" type="button" data-act="join"${chat.webrtcSupported() ? "" : " disabled"}><span>Join with code</span></button></div>
        <p class="t-body-s c-muted mt-sm">Browsers can't see who is on the network · Can't find someone?</p>
        <button class="btn btn--text chat-status__link" type="button" data-act="how">How web chat connects…</button>
      </div>
      ${searchField({ id: "chat-q", placeholder: "Search users...", value: query, pill: false })}
      <h2 class="list-heading">People you've connected with (${filtered.length})</h2>
      ${filtered.length ? `<div class="chat-people">${filtered.map(personRow).join("")}</div>`
        : emptyState({ icon: "people_outline", title: query ? "No one matches" : "No one yet", body: query ? `Nobody called "${query.trim()}".` : "Create an invite and send the code to a friend (any messenger works), or paste the code a friend sent you." })}`;
  };

  const personRow = (p) => {
    const online = chat.isOnline(p.id);
    const unread = p.unread || 0;
    const sub = chat.isTyping(p.id) ? "typing…" : p.lastMessage ? (p.lastDir === "out" ? "You: " : "") + p.lastMessage : p.username;
    return `<a class="chat-person" href="#/chat/room/${seg(p.id)}/${seg(chat.displayName(p))}">
      ${avatar(chat.displayName(p), { size: 44, online })}
      <span class="chat-person__text"><span class="chat-person__name">${esc(chat.displayName(p))}</span>
        <span class="chat-person__sub${unread ? " is-unread" : ""}">${esc(sub)}</span></span>
      <span class="chat-person__meta">${p.lastAt ? `<span class="t-label-m c-muted">${esc(shortAgo(p.lastAt))}</span>` : ""}${unread ? `<span class="badge badge--lg">${unread > 99 ? "99+" : unread}</span>` : ""}</span>
      <span class="chat-person__state">${online ? "Online" : "Friend"}</span>
    </a>`;
  };

  const requests = (list, pend) => {
    const hist = chat.history();
    return `
      <h2 class="list-heading">Incoming Requests (0)</h2>
      <p class="t-body-m c-muted">On the web there are no incoming requests to approve: someone can only reach you through an invite code you made and gave them, so accepting their reply is the approval.</p>
      <h2 class="list-heading">Sent Requests (${pend.length})</h2>
      ${pend.length ? pend.map((p) => `<div class="chat-request neko-ears">
          ${avatar("?", { size: 44, tone: "variant" })}
          <div class="grow"><div class="t-body-l">Invite ${esc(p.inviteId)}</div><div class="t-body-s c-muted">Sent ${esc(ago(p.createdAt))} — waiting for their reply code</div></div>
          <button class="btn btn--text" type="button" data-reply="${esc(p.inviteId)}"><span>Paste reply</span></button>
          <button class="btn btn--danger-text" type="button" data-cancel="${esc(p.inviteId)}"><span>Cancel Request</span></button></div>`).join("")
        : `<p class="t-body-m c-muted">No sent requests.</p>`}
      <h2 class="list-heading">History</h2>
      ${hist.length ? `<div class="chat-history">${hist.map((h) => `<div class="chat-history__row">${icon({ sent: "send", received: "download", accepted: "check_circle", cancelled: "cancel", left: "logout" }[h.kind] || "history", { size: 18 })}<span class="grow">${esc(h.text)}</span><span class="t-label-s c-muted">${esc(ago(h.at))}</span></div>`).join("")}</div>
          <button class="btn btn--text mt-sm" type="button" data-act="clear-history"><span>Clear history</span></button>`
        : `<p class="t-body-m c-muted">Nothing yet. Every request you send or receive is logged here, including the ones that were accepted or declined.</p>`}`;
  };

  const graph = (list) => `<div class="chat-graph-wrap">
      <svg class="chat-graph" role="img" aria-label="Your chat connections"></svg>
      <button class="fab fab--small chat-graph__recenter" type="button" data-act="recenter" aria-label="Recenter">${icon("center_focus_strong")}</button>
    </div>
    <p class="t-body-s c-muted mt-sm">You in the middle; solid lines are people connected right now, dashed lines people you have talked to before. The app's mesh graph also shows phones it discovers on the network — a browser cannot discover anyone.</p>`;

  await draw();
  const offs = [chat.on("change", draw), chat.on("message", () => tab === "contacts" && draw()), chat.on("typing", () => tab === "contacts" && draw())];
  chat.updateBadge();

  el.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-tab],[data-act],[data-cancel],[data-reply]");
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; haptics.select(); history.replaceState(history.state, "", `#/chat?tab=${tab}`); draw(); return; }
    if (t.dataset.cancel) { chat.cancelInvite(t.dataset.cancel); return; }
    if (t.dataset.reply) { pasteReplyDialog(); return; }
    switch (t.dataset.act) {
      case "invite": return inviteFlow();
      case "join": return joinFlow();
      case "how": return dialog({ title: "How web chat connects", body: `<p>${esc(NOT_POSSIBLE)}</p><p>${esc("Invite codes describe how to reach your browser on the network you are on. Two browsers on the same campus Wi-Fi connect directly. Across different networks it may fail unless you turn on public STUN below (it only helps the two browsers find each other; messages still go directly).")}</p>
          <button type="button" class="switch-row" role="switch" aria-checked="${!!prefs.get("chat.stun")}" data-stun><span class="switch-row__text"><span class="switch-row__title">Use public STUN for discovery</span><span class="switch-row__desc">Asks a public Google STUN server for this browser's public address. Off by default.</span></span><span class="switch" aria-hidden="true"><span class="switch__thumb"></span></span></button>`,
          actions: [{ label: "Close", value: null }],
          onMount: (d) => d.addEventListener("click", (ev) => { const s = ev.target.closest("[data-stun]"); if (s) { const v = !prefs.get("chat.stun"); prefs.set("chat.stun", v); s.setAttribute("aria-checked", String(v)); } }) });
      case "clear-history": chat.clearHistory(); return;
      case "recenter": layoutGraph(el.querySelector(".chat-graph"), await chat.peers()); return;
    }
  });
  el.addEventListener("input", (e) => {
    if (e.target.id !== "chat-q") return;
    query = e.target.value;
    const pos = e.target.selectionStart;
    draw().then(() => { const i = el.querySelector("#chat-q"); if (i) { i.focus(); i.setSelectionRange(pos, pos); } });
  });
  return () => offs.forEach((f) => f());
}

const shortAgo = (t) => {
  const d = Date.now() - t;
  if (d < 60000) return "just now";
  if (d < 3600000) return `${Math.round(d / 60000)} min`;
  if (new Date(t).toDateString() === new Date().toDateString()) return timeOf(new Date(t));
  return `${new Date(t).getDate()} ${MONTH_NAMES[new Date(t).getMonth()].slice(0, 3)}`;
};

/* ── connect flows ── */
const codeBox = (id, value, label) => `<div class="chat-code"><label class="t-label-l" for="${id}">${esc(label)}</label>
  <textarea id="${id}" class="chat-code__text" rows="4" readonly spellcheck="false">${esc(value)}</textarea>
  <div class="btn-row"><button class="btn btn--tonal btn--sm" type="button" data-copy="${id}">${icon("content_copy", { size: 16 })}<span>Copy</span></button>
  ${navigator.share ? `<button class="btn btn--text btn--sm" type="button" data-share="${id}">${icon("share", { size: 16 })}<span>Share</span></button>` : ""}</div></div>`;
function wireCopy(d) {
  d.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-copy]"), s = e.target.closest("[data-share]");
    if (c) { const v = d.querySelector("#" + c.dataset.copy).value; try { await navigator.clipboard.writeText(v); toast("Copied"); } catch { d.querySelector("#" + c.dataset.copy).select(); } }
    if (s) { try { await navigator.share({ text: d.querySelector("#" + s.dataset.share).value }); } catch {} }
  });
}

async function inviteFlow() {
  let made;
  try { made = await chat.createInvite(); } catch { snackbar("This browser cannot start a direct connection (WebRTC)."); return; }
  const v = await dialog({
    title: "Invite someone",
    body: `<p>1. Send this invite code to the person you want to chat with — any messenger works.</p>
      ${codeBox("inv-code", made.code, "Your invite code")}
      <p>2. They paste it under "Join with code" and send you back a reply code. Paste it here:</p>
      ${textField({ id: "inv-reply", label: "Their reply code", multiline: true, rows: 3, a: { spellcheck: "false" } })}`,
    actions: [{ label: "Later", value: "later" }, { label: "Connect", value: "connect", primary: true }],
    onMount: wireCopy,
    validate: (val, d) => { if (val !== "connect") return true; if (!d.querySelector("#inv-reply").value.trim()) { snackbar("Paste their reply code first."); return false; } return true; },
  });
  if (v === "connect") {
    const code = document.getElementById("inv-reply")?.value;
    try { const p = await chat.acceptReply(code); haptics.confirm(); snackbar(`Connecting to ${p.name}…`); }
    catch { snackbar("That reply code does not match this invite."); }
  } else if (v === "later") snackbar("Invite kept in Requests until you paste their reply.");
}

async function pasteReplyDialog() {
  const v = await dialog({ title: "Paste reply code", body: textField({ id: "late-reply", label: "Their reply code", multiline: true, rows: 3 }), actions: [{ label: "Cancel", value: null }, { label: "Connect", value: "ok", primary: true }] });
  if (v !== "ok") return;
  try { const p = await chat.acceptReply(document.getElementById("late-reply")?.value); snackbar(`Connecting to ${p.name}…`); }
  catch { snackbar("That reply code does not match any open invite."); }
}

async function joinFlow() {
  const v = await dialog({
    title: "Join with code",
    body: `<p>Paste the invite code someone sent you.</p>${textField({ id: "join-code", label: "Invite code", multiline: true, rows: 3, a: { spellcheck: "false" } })}`,
    actions: [{ label: "Cancel", value: null }, { label: "Make reply", value: "ok", primary: true }],
  });
  if (v !== "ok") return;
  let r;
  try { r = await chat.answerInvite(document.getElementById("join-code")?.value); }
  catch { snackbar("That is not a valid invite code."); return; }
  await dialog({
    title: `Reply to ${r.peer.name}`,
    body: `<p>Send this reply code back to ${esc(r.peer.name)}. You are connected as soon as they paste it.</p>${codeBox("rep-code", r.code, "Your reply code")}`,
    actions: [{ label: "Done", value: true }],
    onMount: wireCopy,
  });
}

/* ── graph (ChatNetworkGraph.kt, simplified force layout) ── */
function layoutGraph(svg, list) {
  if (!svg) return;
  const w = svg.clientWidth || 360, h = svg.clientHeight || 360;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const cx = w / 2, cy = h / 2;
  const nodes = list.map((p, i) => {
    const a = (i / Math.max(1, list.length)) * Math.PI * 2;
    const r = Math.min(w, h) * (chat.isOnline(p.id) ? 0.28 : 0.38);
    return { p, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, online: chat.isOnline(p.id) };
  });
  // a few relaxation passes keep labels apart
  for (let k = 0; k < 60; k++) for (const n of nodes) for (const m of nodes) {
    if (n === m) continue;
    const dx = n.x - m.x, dy = n.y - m.y, d = Math.hypot(dx, dy) || 1;
    if (d < 70) { n.x += (dx / d) * 1.5; n.y += (dy / d) * 1.5; }
  }
  const me = chat.me();
  svg.innerHTML = `
    ${nodes.map((n) => `<line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" class="g-edge${n.online ? " is-on" : ""}"/>`).join("")}
    <g class="g-node g-node--me"><circle cx="${cx}" cy="${cy}" r="26"/><text x="${cx}" y="${cy + 5}" text-anchor="middle">${esc((me.name[0] || "?").toUpperCase())}</text><text class="g-label" x="${cx}" y="${cy + 44}" text-anchor="middle">You</text></g>
    ${nodes.map((n) => `<a href="#/chat/room/${seg(n.p.id)}/${seg(chat.displayName(n.p))}"><g class="g-node${n.online ? " is-on" : ""}"><circle cx="${n.x}" cy="${n.y}" r="20"/><text x="${n.x}" y="${n.y + 5}" text-anchor="middle">${esc((chat.displayName(n.p)[0] || "?").toUpperCase())}</text><text class="g-label" x="${n.x}" y="${n.y + 36}" text-anchor="middle">${esc(chat.displayName(n.p).slice(0, 14))}</text></g></a>`).join("")}
    ${nodes.length ? "" : `<text class="g-label" x="${cx}" y="${cy + 70}" text-anchor="middle">No connections yet</text>`}`;
  if (motion.enabled()) svg.querySelectorAll(".g-node").forEach((g, i) => motion.reveal(g, i));
}

/* ═══════════════ Chat room ═══════════════ */
const dayLabel = (t) => {
  const d = new Date(t), today = new Date();
  const diff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff >= 2 && diff <= 6) return DAY_NAMES[d.getDay()];
  const base = `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
  return d.getFullYear() === today.getFullYear() ? base : `${base} ${d.getFullYear()}`;
};
const RUN_WINDOW = 3 * 60000;
const ticks = (s) => ({ queued: icon("schedule", { size: 13 }), sent: "✓", delivered: "✓✓", read: "✓✓" }[s] || "");

export async function renderRoom(el, ctx) {
  const peerId = ctx.params.peer;
  let p = await chat.peer(peerId);
  if (!p) {
    el.innerHTML = screen({ bar: topBar({ title: ctx.params.name || "Chat" }), body: emptyState({ icon: "chat_bubble", title: "This conversation is not in this browser", body: "Chats live in the browser where they happened. Connect again with an invite code to start one here.", action: `<a class="btn btn--filled" href="#/chat">Campus Chat</a>` }) });
    return;
  }
  let md = !!prefs.get("chat.md");
  let unseen = 0;
  const urls = new Set();

  el.innerHTML = `${topBar({
    title: chat.displayName(p),
    subtitle: p.username,
    actions: iconBtn("search", "Search messages", { "data-act": "search" }) + iconBtn("share", "Export chat", { "data-act": "export" }) + iconBtn("more_vert", "More", { "data-act": "more" }),
  })}
    <div class="chat-conn" id="chat-conn"></div>
    <div class="screen__scroll chat-scroll" id="chat-scroll"><div class="chat-thread" id="chat-thread"></div></div>
    <button class="fab fab--small chat-jump" type="button" id="chat-jump" hidden aria-label="Jump to latest message">${icon("keyboard_arrow_down")}<span class="chat-jump__badge"></span></button>
    <form class="chat-composer" id="chat-form">
      <div class="chat-composer__pill">
        <button class="icon-btn" type="button" data-act="attach" aria-label="Attach">${icon("attach_file")}</button>
        <textarea id="chat-input" rows="1" placeholder="Message" aria-label="Message"></textarea>
        <button class="chat-md${md ? " is-on" : ""}" type="button" data-act="md" aria-pressed="${md}" title="Markdown">MD</button>
      </div>
      <button class="chat-send" type="submit" aria-label="Send" disabled>${icon("send")}</button>
      <input type="file" id="chat-file" hidden>
    </form>`;

  const scroll = el.querySelector("#chat-scroll");
  const threadEl = el.querySelector("#chat-thread");
  const input = el.querySelector("#chat-input");
  const sendBtn = el.querySelector(".chat-send");
  const jump = el.querySelector("#chat-jump");
  const atBottom = () => scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 48;

  const drawConn = () => {
    const c = el.querySelector("#chat-conn");
    const online = chat.isOnline(peerId);
    const sub = el.querySelector(".topbar__subtitle");
    if (sub) sub.innerHTML = chat.isTyping(peerId) ? `<span class="chat-typing-sub">${icon("more_horiz", { size: 14 })} typing…</span>` : esc(p.username) + (online ? " · online" : "");
    c.innerHTML = online ? "" : `<div class="chat-offline">${icon("cloud_off", { size: 18 })}<span>Not connected. Messages wait here and send when you connect again with a new invite code.</span><a class="btn btn--text btn--sm" href="#/chat">Connect</a></div>`;
  };

  const bubble = (m, cont, last) => {
    const out = m.dir === "out";
    let body;
    if (m.kind === "file") {
      const isImg = String(m.file?.type).startsWith("image/") && m.blob;
      let url = "";
      if (m.blob) { url = URL.createObjectURL(m.blob); urls.add(url); }
      body = isImg ? `<button type="button" class="chat-img" data-view="${esc(url)}"><img src="${esc(url)}" alt="${esc(m.file.name)}"></button><div class="chat-file__name">🖼️ ${esc(m.file.name)}</div>`
        : `<div class="chat-file">${icon("insert_drive_file")}<div class="grow"><div class="chat-file__name">📎 ${esc(m.file?.name || "File")}</div><div class="chat-file__meta">File • ${esc(formatBytes(m.file?.size || 0))}</div></div>${url ? `<a class="icon-btn" href="${esc(url)}" download="${esc(m.file.name)}" aria-label="Save file">${icon("download")}</a>` : ""}</div>`;
    } else body = m.md ? `<div class="chat-md-body">${renderMarkdown(m.text)}</div>` : `<div class="chat-text">${esc(m.text)}</div>`;
    return `<div class="chat-row${out ? " is-out" : ""}${cont ? " is-cont" : ""}" data-mid="${esc(m.id)}">
      <div class="chat-bubble${out ? " chat-bubble--out" : ""}${last ? " is-last" : ""}" tabindex="0">${body}
        <div class="chat-meta">${esc(timeOf(new Date(m.at)))}${out ? ` <span class="chat-ticks${m.status === "read" ? " is-read" : ""}">${ticks(m.status)}</span>` : ""}</div></div></div>`;
  };

  let msgs = [];
  const drawThread = async ({ follow = false } = {}) => {
    const wasBottom = atBottom();
    msgs = await chat.thread(peerId);
    urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear();
    if (!msgs.length) {
      threadEl.innerHTML = `<div class="chat-empty">${icon("lock", { size: 32 })}<h2>No messages yet</h2><p>Say hello. Messages travel directly between your two browsers, encrypted end to end — no server in between.</p></div>`;
    } else {
      let html = "", prev = null;
      msgs.forEach((m, i) => {
        if (!prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString()) html += `<div class="chat-day"><span>${esc(dayLabel(m.at))}</span></div>`;
        const cont = prev && prev.dir === m.dir && m.at - prev.at <= RUN_WINDOW && new Date(prev.at).toDateString() === new Date(m.at).toDateString();
        const next = msgs[i + 1];
        const last = !next || next.dir !== m.dir || next.at - m.at > RUN_WINDOW;
        html += bubble(m, cont, last);
        prev = m;
      });
      if (chat.isTyping(peerId)) html += `<div class="chat-row"><div class="chat-bubble chat-typing" aria-label="typing"><i></i><i></i><i></i></div></div>`;
      threadEl.innerHTML = html;
    }
    const newestOut = msgs.length && msgs[msgs.length - 1].dir === "out";
    if (wasBottom || follow || newestOut) { scroll.scrollTop = scroll.scrollHeight; unseen = 0; }
    else if (!follow) unseen += 1;
    drawJump();
  };
  const drawJump = () => {
    const show = !atBottom() && msgs.length > 0;
    jump.hidden = !show;
    jump.querySelector(".chat-jump__badge").innerHTML = unseen ? `<span class="badge">${unseen}</span>` : "";
  };

  drawConn();
  await chat.setActiveThread(peerId);
  await drawThread({ follow: true });
  scroll.addEventListener("scroll", () => { if (atBottom()) unseen = 0; drawJump(); });
  jump.addEventListener("click", () => { scroll.scrollTo({ top: scroll.scrollHeight, behavior: motion.enabled() ? "smooth" : "auto" }); unseen = 0; drawJump(); });

  const offs = [
    chat.on("message", async (m) => { if (!m.peer || m.peer === peerId || m.deleted) { await chat.setActiveThread(peerId); await drawThread(); } }),
    chat.on("change", async () => { p = (await chat.peer(peerId)) || p; drawConn(); }),
    chat.on("typing", (id) => { if (id === peerId) { drawConn(); drawThread(); } }),
  ];

  /* composer */
  const autosize = () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 140) + "px"; sendBtn.disabled = !input.value.trim(); };
  let lastTyping = 0;
  input.addEventListener("input", () => { autosize(); if (Date.now() - lastTyping > 2500) { chat.sendTyping(peerId); lastTyping = Date.now(); } });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); el.querySelector("#chat-form").requestSubmit(); } });
  el.querySelector("#chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = ""; autosize();
    haptics.tap();
    await chat.sendText(peerId, text, md);
    motion.animate(sendBtn, [{ transform: "scale(.86)" }, { transform: "none" }]);
  });
  el.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-act],[data-view]");
    if (!t) return;
    if (t.dataset.view) return viewImage(t.dataset.view);
    switch (t.dataset.act) {
      case "md": md = !md; prefs.set("chat.md", md); t.classList.toggle("is-on", md); t.setAttribute("aria-pressed", String(md)); toast(md ? "Markdown on — **bold**, _italic_, `code`" : "Markdown off"); return;
      case "attach": {
        if (!chat.isOnline(peerId)) { snackbar("Files go straight to the other browser, so you both need to be connected."); return; }
        const kind = await menu(t, [{ label: "Photo or video", value: "image/*,video/*", icon: "image" }, { label: "Any file", value: "*/*", icon: "insert_drive_file" }]);
        if (!kind) return;
        const f = el.querySelector("#chat-file"); f.accept = kind; f.click();
        return;
      }
      case "export": return exportDialog(p, msgs);
      case "search": return searchDialog(msgs);
      case "more": {
        const v = await menu(t, [{ label: "Rename…", value: "rename", icon: "edit" }, chat.isOnline(peerId) ? { label: "Disconnect", value: "disconnect", icon: "logout" } : null, { divider: true }, { label: "Delete conversation…", value: "forget", icon: "delete", danger: true }].filter(Boolean));
        if (v === "rename") {
          const r = await dialog({ title: "Name for this person", body: `<p>Leave empty to use the name they broadcast.</p>${textField({ id: "alias", label: "Name", value: p.alias || "" })}`, actions: [{ label: "Cancel", value: null }, { label: "Save name", value: "ok", primary: true }] });
          if (r === "ok") { await chat.renamePeer(peerId, document.getElementById("alias")?.value || ""); p = await chat.peer(peerId); el.querySelector(".topbar__title").textContent = chat.displayName(p); }
        }
        if (v === "disconnect") chat.disconnect(peerId);
        if (v === "forget" && await confirm({ title: "Delete this conversation?", text: "Every message with this person is removed from this browser. They keep their copy.", confirmLabel: "Delete", danger: true })) { await chat.forgetPeer(peerId); nav.go("chat", { replace: true }); }
      }
    }
  });
  el.querySelector("#chat-file").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    try { await chat.sendFile(peerId, f); } catch (err) { snackbar(err.message === "too-big" ? "Files up to 25 MB can be sent from the web." : "Not connected — files need both browsers open."); }
  });

  /* long-press / right-click → message actions */
  let pressT;
  const openActions = async (row) => {
    const m = msgs.find((x) => x.id === row.dataset.mid);
    if (!m) return;
    haptics.select();
    const text = m.kind === "file" ? m.file?.name || "" : m.text;
    const v = await dialog({
      title: "Message",
      body: `<p class="t-label-m">${esc(timeOf(new Date(m.at)))}</p><div class="msg-actions">
        <button type="button" data-a="copy">Copy text</button><button type="button" data-a="share">Share</button><button type="button" class="is-danger" data-a="delete">Delete for me</button></div>`,
      actions: [{ label: "Close", value: null }],
      onMount: (d, close) => d.addEventListener("click", (ev) => { const b = ev.target.closest("[data-a]"); if (b) close(b.dataset.a); }),
    });
    if (v === "copy") { try { await navigator.clipboard.writeText(text); toast("Copied"); } catch { snackbar("Copy is not allowed here."); } }
    if (v === "share") { if (navigator.share) { try { await navigator.share({ text }); } catch {} } else { try { await navigator.clipboard.writeText(text); toast("Copied — this browser has no share sheet"); } catch {} } }
    if (v === "delete" && await confirm({ title: "Delete for me?", text: "Remove this message from this device? The other person keeps their copy.", confirmLabel: "Delete", danger: true })) { await chat.deleteMessage(m.id); }
  };
  threadEl.addEventListener("contextmenu", (e) => { const r = e.target.closest(".chat-row[data-mid]"); if (r) { e.preventDefault(); openActions(r); } });
  threadEl.addEventListener("pointerdown", (e) => { const r = e.target.closest(".chat-row[data-mid]"); if (!r || e.pointerType === "mouse") return; pressT = setTimeout(() => openActions(r), 500); });
  ["pointerup", "pointercancel", "pointermove"].forEach((ev) => threadEl.addEventListener(ev, () => clearTimeout(pressT)));
  threadEl.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === "ContextMenu") && e.target.classList.contains("chat-bubble")) openActions(e.target.closest(".chat-row")); });

  return () => { offs.forEach((f) => f()); chat.setActiveThread(null); urls.forEach((u) => URL.revokeObjectURL(u)); };
}

/* full-screen image viewer (ChatImageViewer.kt) with wheel / pinch zoom */
function viewImage(url) {
  const v = document.createElement("div");
  v.className = "img-viewer";
  v.innerHTML = `<img src="${esc(url)}" alt=""><button type="button" class="icon-btn img-viewer__close" aria-label="Close">${icon("close")}</button>`;
  document.body.appendChild(v);
  const img = v.querySelector("img");
  let s = 1;
  const set = () => { img.style.transform = `scale(${s})`; };
  v.addEventListener("wheel", (e) => { e.preventDefault(); s = Math.max(1, Math.min(5, s * (e.deltaY < 0 ? 1.15 : 0.87))); set(); }, { passive: false });
  img.addEventListener("dblclick", () => { s = s > 1 ? 1 : 2.5; set(); });
  const close = () => v.remove();
  v.querySelector(".img-viewer__close").addEventListener("click", close);
  v.addEventListener("click", (e) => { if (e.target === v) close(); });
  document.addEventListener("keydown", function esc1(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc1); } });
}

/* Export this chat: Markdown / JSON / plain text (ChatRoomScreen export). */
async function exportDialog(p, msgs) {
  const fmt = await dialog({
    title: "Export this chat",
    body: `<p>Save the conversation with ${esc(chat.displayName(p))} as a file. Files you exchanged are listed by name.</p><div class="msg-actions">
      <button type="button" data-f="md">Markdown (.md)</button><button type="button" data-f="json">JSON (.json)</button><button type="button" data-f="txt">Plain text (.txt)</button></div>`,
    actions: [{ label: "Cancel", value: null }],
    onMount: (d, close) => d.addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b) close(b.dataset.f); }),
  });
  if (!fmt) return;
  const who = (m) => (m.dir === "out" ? "You" : chat.displayName(p));
  const when = (m) => new Date(m.at).toLocaleString();
  const body = (m) => (m.kind === "file" ? `[file] ${m.file?.name || ""}` : m.text);
  let out, type;
  if (fmt === "json") { out = JSON.stringify({ with: { name: p.name, username: p.username }, exportedAt: new Date().toISOString(), messages: msgs.map((m) => ({ from: who(m), at: new Date(m.at).toISOString(), kind: m.kind, text: m.text, file: m.file || null, status: m.status })) }, null, 2); type = "application/json"; }
  else if (fmt === "md") { out = `# Chat with ${chat.displayName(p)}\n\n` + msgs.map((m) => `**${who(m)}** · ${when(m)}\n\n${body(m)}\n`).join("\n"); type = "text/markdown"; }
  else { out = msgs.map((m) => `[${when(m)}] ${who(m)}: ${body(m)}`).join("\n"); type = "text/plain"; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out], { type }));
  a.download = `chat-${chat.displayName(p).replace(/\W+/g, "-").toLowerCase()}.${fmt}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function searchDialog(msgs) {
  return dialog({
    title: "Search Messages",
    body: `${searchField({ id: "msg-q", placeholder: "Search all chat messages...", pill: false })}<div class="msg-results" id="msg-results"></div>`,
    actions: [{ label: "Close", value: null }],
    onMount: (d, close) => {
      const res = d.querySelector("#msg-results");
      d.querySelector("#msg-q").addEventListener("input", (e) => {
        const q = e.target.value.trim().toLowerCase();
        const hits = q ? msgs.filter((m) => (m.text || m.file?.name || "").toLowerCase().includes(q)).slice(-50) : [];
        res.innerHTML = hits.length ? hits.map((m) => `<button type="button" class="list-item" data-goto="${esc(m.id)}"><span class="list-item__text"><span class="list-item__headline">${esc((m.text || m.file?.name || "").slice(0, 80))}</span><span class="list-item__supporting">${esc(dayLabel(m.at) + " · " + timeOf(new Date(m.at)))}</span></span></button>`).join("") : q ? `<p class="t-body-s c-muted">No messages match.</p>` : "";
      });
      res.addEventListener("click", (e) => {
        const b = e.target.closest("[data-goto]");
        if (!b) return;
        close(null);
        const row = document.querySelector(`.chat-row[data-mid="${CSS.escape(b.dataset.goto)}"]`);
        if (row) { row.scrollIntoView({ block: "center" }); row.querySelector(".chat-bubble").classList.add("is-flash"); setTimeout(() => row.querySelector(".chat-bubble")?.classList.remove("is-flash"), 1500); }
      });
    },
  });
}
