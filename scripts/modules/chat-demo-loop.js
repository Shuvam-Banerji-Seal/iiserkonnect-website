/**
 * modules/chat-demo-loop.js — drives the hero phone mockup.
 * Plays a scripted Campus Chat conversation (typing indicator → bubble →
 * ticks), then restarts. Respects prefers-reduced-motion with a static
 * final frame.
 */

const SCRIPT = [
  { dir: "in",  delay: 900,  html: `Hey! Are you on the campus WiFi? 📡` },
  { dir: "out", delay: 1100, html: `Yep, just joined. Chat's running` },
  { dir: "in",  delay: 900,  html: `Sending the DS notes…` },
  { dir: "out", delay: 700,  type: "file", html: `<span class="file-pill">📄 DS-Unit4.pdf</span><span class="meta">2.1 MB · transferred <span class="ticks read">✓✓</span></span>` },
  { dir: "in",  delay: 1000, html: `Got it — thanks a lot! 🙌` },
  { dir: "out", delay: 800,  html: `Btw mess menu has biryani today 👀`, meta: true },
];

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function bubble(msg) {
  const div = document.createElement("div");
  const cls = msg.dir === "out" ? "bubble--out" : "bubble--in";
  const meta = msg.meta
    ? `<span class="meta">${time()} <span class="ticks read">✓✓</span></span>`
    : (msg.dir === "out" && !msg.type ? `<span class="meta"><span class="ticks read">✓✓</span></span>` : "");
  div.className = `bubble ${cls}`;
  div.innerHTML = `${msg.html}${meta}`;
  return div;
}

function time() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function playOnce(body) {
  body.innerHTML = "";
  for (const msg of SCRIPT) {
    if (msg.dir === "in") {
      const typing = document.createElement("div");
      typing.className = "typing";
      typing.innerHTML = "<i></i><i></i><i></i>";
      body.appendChild(typing);
      await sleep(750);
      typing.remove();
    }
    body.appendChild(bubble(msg));
    // keep at most 4 bubbles visible
    while (body.children.length > 4) body.firstElementChild.remove();
    await sleep(msg.delay);
  }
}

export function initChatDemo() {
  const body = document.querySelector(".chat-body");
  if (!body) return;

  if (reduced) {
    SCRIPT.forEach((m) => body.appendChild(bubble(m)));
    return;
  }

  (async () => {
    for (;;) {
      await playOnce(body);
      await sleep(2600);
    }
  })();
}
