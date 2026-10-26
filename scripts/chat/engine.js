/**
 * chat/engine.js — Campus Chat for browsers, peer to peer over WebRTC.
 *
 * The app finds people on campus Wi-Fi by itself (mDNS) and talks to them over
 * direct TCP. A web page can do neither: it cannot listen on the network,
 * discover devices or open raw sockets. What a browser CAN do is open a
 * direct, DTLS-encrypted WebRTC data channel to another browser — once the
 * two sides have exchanged a description of how to reach each other. With no
 * server, that exchange is by hand: one person creates an invite code, the
 * other pastes it and sends back a reply code.
 *
 * So: web chat is browser ↔ browser, both people need the chat open, nothing
 * passes through any server, and it cannot talk to the Android app's chat.
 *
 * Wire protocol (JSON text frames, file bytes as binary frames):
 *   hello {id, name, username}  · msg {mid, text, md, at}  · ack {mid, s}
 *   typing {}  · file {mid, name, size, type, at}  then the bytes  · bye {}
 * Stored: collection("chatPeers") and collection("chat") (IndexedDB).
 */

import { collection, newId } from "../core/db.js";
import { prefs } from "../core/prefs.js";
import { creds } from "../core/session.js";

const peersDb = collection("chatPeers");
const msgsDb = collection("chat");
const CHUNK = 16 * 1024;
const MAX_FILE = 25 * 1024 * 1024;

/* ── identity ── */
export function me() {
  let id = prefs.get("chat.id");
  if (!id) { id = newId(); prefs.set("chat.id", id); }
  const p = prefs.get("profile");
  const c = creds.get();
  return { id, name: (p.name || "").trim() || (c && c.u) || "Web user", username: (c && c.u) || "web-" + id.slice(0, 6) };
}

/* ── events ── */
const subs = new Map();
export function on(ev, fn) {
  if (!subs.has(ev)) subs.set(ev, new Set());
  subs.get(ev).add(fn);
  return () => subs.get(ev).delete(fn);
}
const emit = (ev, data) => (subs.get(ev) || []).forEach((fn) => { try { fn(data); } catch (e) { console.warn(e); } });

/* ── live connections (kept while this tab is open) ── */
const live = new Map();      // peerId → { pc, dc, incoming }
const pending = new Map();   // inviteId → { pc, dc, createdAt }
const typingUntil = new Map();

export const isOnline = (peerId) => !!(live.get(peerId) && live.get(peerId).dc && live.get(peerId).dc.readyState === "open");
export const isTyping = (peerId) => (typingUntil.get(peerId) || 0) > Date.now();
export const pendingInvites = () => [...pending.values()];

const iceConfig = () => (prefs.get("chat.stun") ? { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] } : { iceServers: [] });

/* ── invite codes: deflate + base64url when the browser can compress ── */
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function pack(prefix, obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === "function") {
    const out = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    return `${prefix}z.${b64u(out)}`;
  }
  return `${prefix}j.${b64u(raw)}`;
}
async function unpack(prefix, code) {
  const s = String(code || "").trim().replace(/\s+/g, "");
  if (!s.startsWith(prefix)) throw new Error("not-a-code");
  const kind = s.slice(prefix.length, prefix.length + 1);
  const body = unb64u(s.slice(prefix.length + 2));
  let bytes = body;
  if (kind === "z") bytes = new Uint8Array(await new Response(new Blob([body]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}
const INVITE = "IKC1", REPLY = "IKR1";

function gather(pc) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((res) => {
    const done = () => { clearInterval(iv); clearTimeout(t); res(); };
    const check = () => { if (pc.iceGatheringState === "complete" || /typ srflx/.test(pc.localDescription?.sdp || "")) done(); };
    const iv = setInterval(check, 200);
    const t = setTimeout(done, 6000);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

/** Step 1 (you): make an invite code for someone. */
export async function createInvite() {
  if (typeof RTCPeerConnection !== "function") throw new Error("no-webrtc");
  const pc = new RTCPeerConnection(iceConfig());
  const dc = pc.createDataChannel("iiserkonnect-chat", { ordered: true });
  const inviteId = newId().slice(0, 8);
  await pc.setLocalDescription(await pc.createOffer());
  await gather(pc);
  const entry = { inviteId, pc, dc, createdAt: Date.now() };
  pending.set(inviteId, entry);
  wire(pc, dc, null);
  logHistory({ kind: "sent", at: Date.now(), text: "Invite created" });
  emit("change");
  const code = await pack(INVITE, { v: 1, inviteId, from: me(), sdp: pc.localDescription });
  return { inviteId, code };
}

/** Step 2 (them): paste an invite, get a reply code to send back. */
export async function answerInvite(inviteCode) {
  if (typeof RTCPeerConnection !== "function") throw new Error("no-webrtc");
  const inv = await unpack(INVITE, inviteCode);
  const pc = new RTCPeerConnection(iceConfig());
  const ready = new Promise((res) => { pc.ondatachannel = (e) => res(e.channel); });
  await pc.setRemoteDescription(inv.sdp);
  await pc.setLocalDescription(await pc.createAnswer());
  await gather(pc);
  await upsertPeer(inv.from, { addedAt: Date.now() });
  live.set(inv.from.id, { pc, dc: null });
  ready.then((dc) => { const l = live.get(inv.from.id); if (l) l.dc = dc; wire(pc, dc, inv.from.id); });
  logHistory({ kind: "received", at: Date.now(), text: `Answered an invite from ${inv.from.name}`, peer: inv.from.id });
  emit("change");
  return { peer: inv.from, code: await pack(REPLY, { v: 1, inviteId: inv.inviteId, from: me(), sdp: pc.localDescription }) };
}

/** Step 3 (you): paste their reply to finish connecting. */
export async function acceptReply(replyCode) {
  const rep = await unpack(REPLY, replyCode);
  const entry = pending.get(rep.inviteId);
  if (!entry) throw new Error("unknown-invite");
  await entry.pc.setRemoteDescription(rep.sdp);
  pending.delete(rep.inviteId);
  await upsertPeer(rep.from, { addedAt: Date.now() });
  live.set(rep.from.id, { pc: entry.pc, dc: entry.dc });
  entry.peerId = rep.from.id;
  rebind(entry.dc, rep.from.id);
  logHistory({ kind: "accepted", at: Date.now(), text: `Connected to ${rep.from.name}`, peer: rep.from.id });
  emit("change");
  return rep.from;
}

export function cancelInvite(inviteId) {
  const e = pending.get(inviteId);
  if (e) { try { e.pc.close(); } catch {} pending.delete(inviteId); logHistory({ kind: "cancelled", at: Date.now(), text: "Invite cancelled" }); emit("change"); }
}

export function disconnect(peerId) {
  const l = live.get(peerId);
  if (!l) return;
  try { l.dc && l.dc.readyState === "open" && l.dc.send(JSON.stringify({ t: "bye" })); } catch {}
  try { l.pc.close(); } catch {}
  live.delete(peerId);
  emit("change");
}

/* ── channel wiring ── */
const peerOfChannel = new WeakMap();
function rebind(dc, peerId) { peerOfChannel.set(dc, peerId); }

function wire(pc, dc, peerId) {
  if (peerId) peerOfChannel.set(dc, peerId);
  dc.binaryType = "arraybuffer";
  dc.onopen = () => {
    dc.send(JSON.stringify({ t: "hello", ...me() }));
    const pid = peerOfChannel.get(dc);
    if (pid) { touchPeer(pid, { lastSeen: Date.now() }); flushQueue(pid); }
    emit("change");
  };
  dc.onclose = () => {
    const pid = peerOfChannel.get(dc);
    if (pid) { live.delete(pid); touchPeer(pid, { lastSeen: Date.now() }); logHistory({ kind: "left", at: Date.now(), text: "Disconnected", peer: pid }); }
    emit("change");
  };
  let incoming = null;
  dc.onmessage = async (e) => {
    const pid = peerOfChannel.get(dc);
    if (typeof e.data !== "string") {
      if (!incoming) return;
      incoming.parts.push(e.data); incoming.got += e.data.byteLength;
      emit("progress", { mid: incoming.mid, progress: incoming.got / incoming.size });
      if (incoming.got >= incoming.size) {
        const blob = new Blob(incoming.parts, { type: incoming.type || "application/octet-stream" });
        await saveMessage({ id: incoming.mid, peer: pid, dir: "in", kind: "file", text: "", at: incoming.at, status: "delivered", file: { name: incoming.name, size: incoming.size, type: incoming.type }, blob });
        send(pid, { t: "ack", mid: incoming.mid, s: "delivered" });
        incoming = null;
      }
      return;
    }
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.t === "hello") {
      if (!pid) peerOfChannel.set(dc, m.id);
      await upsertPeer({ id: m.id, name: m.name, username: m.username }, { lastSeen: Date.now() });
      const id = peerOfChannel.get(dc);
      if (!live.get(id)) live.set(id, { pc, dc });
      else live.get(id).dc = dc;
      flushQueue(id);
      emit("change");
    } else if (m.t === "msg") {
      await saveMessage({ id: m.mid, peer: pid, dir: "in", kind: "text", text: String(m.text || "").slice(0, 20000), md: !!m.md, at: m.at || Date.now(), status: "delivered" });
      typingUntil.delete(pid);
      send(pid, { t: "ack", mid: m.mid, s: "delivered" });
    } else if (m.t === "ack") {
      const rec = await msgsDb.get(m.mid);
      if (rec && rec.peer === pid && rank(m.s) > rank(rec.status)) { await msgsDb.put({ ...rec, status: m.s }); emit("message", rec); }
    } else if (m.t === "typing") {
      typingUntil.set(pid, Date.now() + 4000);
      emit("typing", pid);
      setTimeout(() => emit("typing", pid), 4100);
    } else if (m.t === "file") {
      if (m.size > MAX_FILE) return;
      incoming = { mid: m.mid, name: m.name, size: m.size, type: m.type, at: m.at || Date.now(), parts: [], got: 0 };
    } else if (m.t === "bye") {
      try { pc.close(); } catch {}
      live.delete(pid);
      emit("change");
    }
  };
}
const rank = (s) => ({ queued: 0, sent: 1, delivered: 2, read: 3 }[s] ?? 0);

function send(peerId, obj) {
  const l = live.get(peerId);
  if (!l || !l.dc || l.dc.readyState !== "open") return false;
  try { l.dc.send(JSON.stringify(obj)); return true; } catch { return false; }
}

/* ── peers ── */
async function upsertPeer(p, extra = {}) {
  const old = await peersDb.get(p.id);
  const rec = { status: "friend", unread: 0, ...old, id: p.id, name: p.name, username: p.username, ...extra };
  await peersDb.put(rec);
  return rec;
}
async function touchPeer(id, extra) { const old = await peersDb.get(id); if (old) await peersDb.put({ ...old, ...extra }); }
export const peers = () => peersDb.all();
export const peer = (id) => peersDb.get(id);
export async function renamePeer(id, alias) { await touchPeer(id, { alias: alias.trim() || null }); emit("change"); }
export async function forgetPeer(id) {
  disconnect(id);
  for (const m of (await msgsDb.all()).filter((x) => x.peer === id)) await msgsDb.remove(m.id);
  await peersDb.remove(id);
  emit("change");
}
export const displayName = (p) => (p && (p.alias || p.name)) || "Unknown";

/* ── messages ── */
async function saveMessage(rec) {
  await msgsDb.put(rec);
  const p = await peersDb.get(rec.peer);
  if (p) {
    const preview = rec.kind === "file" ? (String(rec.file?.type).startsWith("image/") ? "🖼️ " : "📎 ") + (rec.file?.name || "File") : previewText(rec.text);
    await peersDb.put({ ...p, lastMessage: preview, lastAt: rec.at, lastDir: rec.dir, unread: rec.dir === "in" && activeThread !== rec.peer ? (p.unread || 0) + 1 : p.unread || 0 });
  }
  emit("message", rec);
  updateBadge();
}
export async function thread(peerId) {
  const all = (await msgsDb.all()).filter((m) => m.peer === peerId).sort((a, b) => a.at - b.at);
  const months = prefs.get("chatRetentionMonths");
  if (!months) return all;
  const cutoff = Date.now() - months * 30.44 * 86400000;
  const old = all.filter((m) => m.at < cutoff);
  for (const m of old) await msgsDb.remove(m.id);
  return all.filter((m) => m.at >= cutoff);
}

/** Send text; it waits in this browser until the person is connected. */
export async function sendText(peerId, text, md = false) {
  const rec = { id: newId(), peer: peerId, dir: "out", kind: "text", text, md, at: Date.now(), status: "queued" };
  if (send(peerId, { t: "msg", mid: rec.id, text, md, at: rec.at })) rec.status = "sent";
  await saveMessage(rec);
  return rec;
}
export async function sendFile(peerId, file) {
  if (file.size > MAX_FILE) throw new Error("too-big");
  const l = live.get(peerId);
  if (!l || !l.dc || l.dc.readyState !== "open") throw new Error("offline");
  const rec = { id: newId(), peer: peerId, dir: "out", kind: "file", text: "", at: Date.now(), status: "sent", file: { name: file.name, size: file.size, type: file.type }, blob: file };
  await saveMessage(rec);
  l.dc.send(JSON.stringify({ t: "file", mid: rec.id, name: file.name, size: file.size, type: file.type, at: rec.at }));
  const buf = await file.arrayBuffer();
  l.dc.bufferedAmountLowThreshold = 1 << 20;
  for (let off = 0; off < buf.byteLength; off += CHUNK) {
    if (l.dc.bufferedAmount > 4 << 20) await new Promise((r) => { l.dc.onbufferedamountlow = () => { l.dc.onbufferedamountlow = null; r(); }; });
    l.dc.send(buf.slice(off, off + CHUNK));
    emit("progress", { mid: rec.id, progress: Math.min(1, (off + CHUNK) / buf.byteLength) });
  }
  return rec;
}
async function flushQueue(peerId) {
  const q = (await msgsDb.all()).filter((m) => m.peer === peerId && m.dir === "out" && m.status === "queued").sort((a, b) => a.at - b.at);
  for (const m of q) if (send(peerId, { t: "msg", mid: m.id, text: m.text, md: m.md, at: m.at })) { await msgsDb.put({ ...m, status: "sent" }); emit("message", m); }
}
export const sendTyping = (peerId) => send(peerId, { t: "typing" });
export async function deleteMessage(id) { await msgsDb.remove(id); emit("message", { id, deleted: true }); }

let activeThread = null;
/** The open thread: its messages count as read and are acknowledged as such. */
export async function setActiveThread(peerId) {
  activeThread = peerId;
  if (!peerId) return;
  const p = await peersDb.get(peerId);
  if (p && p.unread) { await peersDb.put({ ...p, unread: 0 }); updateBadge(); emit("change"); }
  for (const m of (await msgsDb.all()).filter((x) => x.peer === peerId && x.dir === "in" && x.status !== "read")) {
    await msgsDb.put({ ...m, status: "read" });
    send(peerId, { t: "ack", mid: m.id, s: "read" });
  }
}

/* ── request history (Requests tab) ── */
export function history() { return prefs.get("chat.history") || []; }
function logHistory(item) { const h = history(); h.unshift(item); prefs.set("chat.history", h.slice(0, 50)); }
export function clearHistory() { prefs.set("chat.history", []); emit("change"); }

/* ── unread badge on the Chat tab ── */
export async function totalUnread() { return (await peersDb.all()).reduce((s, p) => s + (p.unread || 0), 0); }
export async function updateBadge() {
  const n = await totalUnread();
  document.querySelectorAll('.nav-item[data-tab="chat"] .nav-item__badge').forEach((b) => {
    b.innerHTML = n ? `<span class="badge">${n > 99 ? "99+" : n}</span>` : "";
  });
}

/* ── Markdown preview text (ChatPreviewText.kt) ── */
export function previewText(md) {
  return String(md || "")
    .replace(/```[^\n]*/g, " ")
    .replace(/!\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+(\[[ xX]]\s+)?|\d+[.)]\s+)/gm, "")
    .replace(/(\*\*|__|~~)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])([*_])(?!\s)(.+?)(?<!\s)\2(?![\w*])/g, "$1$3")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ").trim();
}

export const webrtcSupported = () => typeof RTCPeerConnection === "function";
