/**
 * pages/chat.page.js — Campus Chat for the web.
 * Browsers can't open raw TCP like the app, so peers connect via WebRTC
 * data channels (DTLS-encrypted, serverless). Discovery is replaced by
 * manual signaling: one peer creates an invite code, the other pastes it
 * and returns an answer code. Everything stays on the local network path.
 */

import { pageHead, card, esc, toast } from "../ui/helpers.js";
import { store } from "../core/store.js";

/** STUN is optional (off = pure LAN host candidates). STUN never carries
 * media — it only helps peers discover each other across strict NATs;
 * the data channel stays direct and DTLS-encrypted end-to-end. */
const iceConfig = () => store.get("chatStun")
  ? { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
  : { iceServers: [] };

export async function render(el) {
  el.innerHTML = pageHead("Campus Chat", "P2P, serverless", "WebRTC data channel over your LAN — DTLS-encrypted end-to-end, no signaling server. Exchange invite codes with the other device.");
  const mount = document.createElement("div");
  el.appendChild(mount);

  const state = { pc: null, dc: null };
  mount.innerHTML = `
    <div class="chat-grid">
      ${card(`
        <h3 class="h3">Connect</h3>
        <label class="row-gap small" style="margin-bottom:10px;cursor:pointer">
          <input type="checkbox" id="ch-stun" ${store.get("chatStun") ? "checked" : ""}>
          <span>Use public STUN for discovery (strict NATs / headless browsers — media stays direct)</span>
        </label>
        <div class="row-gap" style="flex-wrap:wrap">
          <button class="btn btn--primary btn--sm" id="ch-create">Create invite</button>
          <button class="btn btn--ghost btn--sm" id="ch-join">Join with code</button>
        </div>
        <div id="ch-signal" style="margin-top:14px"></div>
      `)}
      ${card(`
        <h3 class="h3">Conversation</h3>
        <div class="chat-log" id="ch-log"><p class="body-muted small">Not connected yet.</p></div>
        <form class="chat-send" id="ch-form">
          <input class="input" id="ch-input" placeholder="Message…" autocomplete="off" disabled>
          <button class="btn btn--primary btn--sm" id="ch-send" disabled>Send</button>
        </form>
        <div class="row-gap" style="margin-top:8px">
          <input type="file" id="ch-file" hidden>
          <button class="btn btn--ghost btn--sm" id="ch-attach" disabled>Attach file</button>
          <span class="tiny body-muted" id="ch-status">offline</span>
        </div>
      `)}
    </div>`;

  const log = mount.querySelector("#ch-log");
  const input = mount.querySelector("#ch-input");
  const sendBtn = mount.querySelector("#ch-send");
  const attachBtn = mount.querySelector("#ch-attach");
  const fileInput = mount.querySelector("#ch-file");
  const statusEl = mount.querySelector("#ch-status");
  const signalBox = mount.querySelector("#ch-signal");
  mount.querySelector("#ch-stun").onchange = (e) => {
    store.set("chatStun", e.target.checked);
    toast(e.target.checked ? "STUN discovery on" : "Pure LAN mode");
  };

  const addBubble = (text, out = false) => {
    if (log.querySelector("p")) log.innerHTML = "";
    const div = document.createElement("div");
    div.className = `bubble ${out ? "bubble--out" : "bubble--in"}`;
    div.textContent = text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  };

  const setStatus = (s) => { statusEl.textContent = s; };
  const enable = (on) => { input.disabled = sendBtn.disabled = attachBtn.disabled = !on; };

  function setupChannel(dc) {
    state.dc = dc;
    dc.onopen = () => { setStatus("connected ✓"); enable(true); toast("Peer connected"); };
    dc.onclose = () => { setStatus("peer left"); enable(false); addBubble("— peer disconnected —"); };
    dc.onmessage = (e) => {
      if (typeof e.data === "string") {
        if (e.data.startsWith("\u0001FILE:")) {
          const meta = JSON.parse(e.data.slice(5));
          addBubble(`📎 ${meta.name} (${(meta.size / 1024).toFixed(0)} KB) — receiving…`);
          receiveFile(meta);
        }
        // binary chunks handled in ondata below
        else addBubble(e.data);
      }
    };
  }

  /* file transfer (chunked over the data channel) */
  let incoming = null;
  function receiveFile(meta) {
    incoming = { ...meta, chunks: [], got: 0 };
    const origOn = state.dc.onmessage;
    state.dc.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer && incoming) {
        incoming.chunks.push(e.data);
        incoming.got += e.data.byteLength;
        if (incoming.got >= incoming.size) {
          const blob = new Blob(incoming.chunks);
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = incoming.name;
          a.click();
          addBubble(`✅ Saved ${incoming.name}`);
          state.dc.onmessage = origOn;
          incoming = null;
        }
      } else origOn(e);
    };
  }

  attachBtn.onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const f = fileInput.files[0];
    if (!f || !state.dc || state.dc.readyState !== "open") return;
    state.dc.send(`\u0001FILE:${JSON.stringify({ name: f.name, size: f.size })}`);
    const buf = await f.arrayBuffer();
    const CHUNK = 16 * 1024;
    for (let off = 0; off < buf.byteLength; off += CHUNK) {
      state.dc.send(buf.slice(off, off + CHUNK));
      await new Promise((r) => setTimeout(r, 2)); // backpressure-friendly
    }
    addBubble(`📎 ${f.name} — sent`, true);
  };

  mount.querySelector("#ch-form").onsubmit = (e) => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t || !state.dc || state.dc.readyState !== "open") return;
    state.dc.send(t);
    addBubble(t, true);
    input.value = "";
  };

  const codeArea = (label, value, mono = true) => `
    <label class="field"><span>${label}</span>
      <textarea class="input ${mono ? "mono" : ""}" rows="4" readonly>${esc(value)}</textarea></label>
    <button class="btn btn--ghost btn--sm copy-btn" data-copy="${esc(value)}">Copy</button>`;

  signalBox.addEventListener("click", (e) => {
    const b = e.target.closest(".copy-btn");
    if (b) { navigator.clipboard.writeText(b.dataset.copy); toast("Copied"); }
  });

  /* wait for ICE candidates so the code is self-contained. Resolves when
   * gathering completes, OR as soon as a srflx candidate lands (mDNS-only
   * environments can keep "gathering" alive indefinitely), capped at 8s. */
  function gatherComplete(pc) {
    if (pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise((res) => {
      const done = () => { clearInterval(iv); clearTimeout(t); res(); };
      const check = () => {
        if (pc.iceGatheringState === "complete") return done();
        if ((pc.localDescription?.sdp || "").includes("typ srflx")) return done();
      };
      const iv = setInterval(check, 250);
      const t = setTimeout(done, 8000);
      pc.addEventListener("icegatheringstatechange", check);
    });
  }

  /* ── offer side (create invite) ── */
  mount.querySelector("#ch-create").onclick = async () => {
    const pc = new RTCPeerConnection(iceConfig());
    state.pc = pc;
    const dc = pc.createDataChannel("chat");
    setupChannel(dc);
    await pc.setLocalDescription(await pc.createOffer());
    await gatherComplete(pc);
    signalBox.innerHTML = `
      <p class="small body-muted">1. Send this invite code to your peer (any channel):</p>
      ${codeArea("Invite code", btoa(JSON.stringify(pc.localDescription)))}
      <label class="field" style="margin-top:10px"><span>2. Paste their reply code here</span>
        <textarea class="input mono" id="ch-answer" rows="4" placeholder="Paste answer code"></textarea></label>
      <button class="btn btn--primary btn--sm" id="ch-accept">Accept reply</button>`;
    signalBox.querySelector("#ch-accept").onclick = async () => {
      try {
        const ans = JSON.parse(atob(signalBox.querySelector("#ch-answer").value.trim()));
        await pc.setRemoteDescription(ans);
        setStatus("connecting…");
      } catch { toast("Invalid reply code", "err"); }
    };
  };

  /* ── answer side (join) ── */
  mount.querySelector("#ch-join").onclick = async () => {
    signalBox.innerHTML = `
      <label class="field"><span>Paste the invite code</span>
        <textarea class="input mono" id="ch-offer" rows="4" placeholder="Paste invite code"></textarea></label>
      <button class="btn btn--primary btn--sm" id="ch-gen">Generate reply</button>
      <div id="ch-out" style="margin-top:10px"></div>`;
    signalBox.querySelector("#ch-gen").onclick = async () => {
      try {
        const offer = JSON.parse(atob(signalBox.querySelector("#ch-offer").value.trim()));
        const pc = new RTCPeerConnection(iceConfig());
        state.pc = pc;
        pc.ondatachannel = (e) => setupChannel(e.channel);
        await pc.setRemoteDescription(offer);
        await pc.setLocalDescription(await pc.createAnswer());
        await gatherComplete(pc);
        signalBox.querySelector("#ch-out").innerHTML =
          codeArea("Reply code — send it back:", btoa(JSON.stringify(pc.localDescription)));
        setStatus("waiting for peer…");
      } catch { toast("Invalid invite code", "err"); }
    };
  };
}
