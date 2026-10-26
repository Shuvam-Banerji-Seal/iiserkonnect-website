/**
 * pages/iisercard.page.js — Digital ID Card (ui/settings/IiserCardScreen.kt).
 *
 * The card is drawn from the Settings profile (name, photo) and the sign-in
 * username (student ID, programme, e-mail), as the app draws it. The app
 * reads the name and photo from WeLearn; a browser cannot, so this card is
 * sample data until the user signs in. The campus logo is not loaded: the
 * browser would fetch it from a campus host, so a plain mark is drawn instead.
 */

import { prefs } from "../core/prefs.js";
import { creds } from "../core/session.js";
import { esc, on } from "../ui/dom.js";
import { icon, topBar, screen, iconBtn, browserNote } from "../ui/components.js";
import { menu, snackbar } from "../ui/overlay.js";
import { nav } from "../core/router.js";

/** IISER_DEPARTMENTS (ui/settings/IiserCardViewModel.kt). */
export const IISER_DEPARTMENTS = [
  "Biological Sciences", "Chemical Sciences", "Earth Sciences", "Humanities & Social Sciences",
  "Mathematical Sciences", "Physical Sciences", "Computational & Data Sciences",
];

const SAMPLE = { name: "Sample Student", id: "21MS999", email: "sample.student@example.com" };
const BLUE = "#003366", GOLD = "#B8860B", INK = "#1A1A1A", MUTED = "#555555", PHOTO_BG = "#F0F0F0";

const MARK = `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 12.5c0-3 3.4-5 7.5-5S23 9.5 23 12.5s-3.4 5-7.5 5h-.7L10.2 21v-4.2C8.8 15.9 8 14.3 8 12.5Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>`;

/** IiserCardViewModel.extractStudentId */
export function extractStudentId(username) {
  const m = /(\d{2})([a-zA-Z]{2,3})(\d{2,3})/.exec(username);
  return m ? `${m[1]}${m[2].toUpperCase()}${m[3]}` : username.toUpperCase();
}

/** IiserCardViewModel.getProgramType */
export function programType(studentId) {
  const m = /\d{2}([A-Z]{2,3})\d{2,3}/.exec(studentId);
  if (!m) return "";
  return { MS: "BS-MS", RS: "Research Scholar", IP: "Integrated PhD", MP: "Masters Programme", MR: "Masters Research" }[m[1]] || m[1];
}

/** Code 128 (subset B), with the patterns checked against the standard table. */
const CODE128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232",
];
const STOP = "2331112";

/** Returns { modules, bars: [[x, w], ...] } for a Code 128B symbol, or null. */
export function code128(text) {
  if (!text) return null;
  const vals = [104];
  for (const ch of text) {
    const v = ch.charCodeAt(0) - 32;
    if (v < 0 || v > 94) return null;
    vals.push(v);
  }
  let sum = vals[0];
  for (let i = 1; i < vals.length; i++) sum += vals[i] * i;
  vals.push(sum % 103);
  const widths = vals.map((v) => CODE128[v]).join("") + STOP;
  const bars = [];
  let x = 0;
  for (let i = 0; i < widths.length; i++) {
    const w = +widths[i];
    if (i % 2 === 0) bars.push([x, w]);
    x += w;
  }
  return { modules: x, bars };
}

const barcodeSvg = (text) => {
  const c = code128(text);
  if (!c) return "";
  const rects = c.bars.map(([x, w]) => `<rect x="${x}" y="0" width="${w}" height="40"/>`).join("");
  return `<svg class="idcard__barcode-svg" viewBox="-10 0 ${c.modules + 20} 40" preserveAspectRatio="none" role="img" aria-label="Barcode: ${esc(text)}"><g fill="${INK}">${rects}</g></svg>`;
};

function cardData(profile, creds_) {
  const user = creds_ && creds_.u ? String(creds_.u).trim() : "";
  const id = user ? extractStudentId(user) : SAMPLE.id;
  return {
    name: (profile.name || "").trim() || (user || SAMPLE.name),
    id,
    email: user ? `${user}@iiserkol.ac.in` : SAMPLE.email,
    programme: programType(id),
    department: prefs.get("cardDepartment") || "",
    photo: profile.avatar && /^data:image\//.test(profile.avatar) ? profile.avatar : "",
    sample: !user,
  };
}

function cardHtml(c) {
  const row = (label, value) => `<div class="idcard__line"><span class="idcard__label">${esc(label)}: </span><span class="idcard__value">${esc(value)}</span></div>`;
  const photo = c.photo
    ? `<img class="idcard__photo-img" src="${esc(c.photo)}" alt="Profile Photo">`
    : `<span class="idcard__initials">${esc(c.name.slice(0, 2).toUpperCase())}</span>`;
  return `<div class="idcard" id="idcard" role="img" aria-label="Digital student ID card for ${esc(c.name)}">
    <div class="idcard__head">
      <span class="idcard__logo" aria-hidden="true">${MARK}</span>
      <div class="idcard__org">
        <span>INDIAN INSTITUTE OF SCIENCE</span>
        <span>EDUCATION AND RESEARCH</span>
        <span class="idcard__kol">KOLKATA</span>
      </div>
      <span class="idcard__tag">STUDENT ID</span>
    </div>
    <div class="idcard__body">
      <div class="idcard__photo">${photo}</div>
      <div class="idcard__info">
        <div class="idcard__name">${esc(c.name.toUpperCase())}</div>
        ${row("ID", c.id)}
        ${c.programme ? row("PROGRAMME", c.programme) : ""}
        ${c.department ? row("DEPT", c.department) : ""}
        ${row("EMAIL", c.email)}
      </div>
    </div>
    <div class="idcard__foot">
      <div class="idcard__barcode">${barcodeSvg(c.id)}</div>
      <div class="idcard__code">${esc(c.id)}</div>
    </div>
  </div>`;
}

/* ── PNG export (renderCardToBitmap, same 856 × 540 layout) ── */
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawCard(c) {
  const W = 856, H = 540;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const font = (px, color, weight = "bold") => { g.font = `${weight} ${px}px Roboto, Arial, sans-serif`; g.fillStyle = color; };
  g.fillStyle = "#fff";
  roundRect(g, 0, 0, W, H, 24); g.fill();
  g.strokeStyle = BLUE; g.lineWidth = 4;
  roundRect(g, 2, 2, W - 4, H - 4, 24); g.stroke();
  g.fillStyle = BLUE;
  roundRect(g, 8, 8, W - 16, 112, 12); g.fill();
  font(20, "#fff"); g.fillText("INDIAN INSTITUTE OF SCIENCE", 80, 46);
  g.fillText("EDUCATION AND RESEARCH", 80, 72);
  font(26, "rgb(255,215,0)"); g.fillText("KOLKATA", 80, 104);
  font(30, INK); g.fillText(c.name.toUpperCase(), 140, 220);
  const line = (label, value, y, vx) => {
    font(20, BLUE); g.fillText(label, 140, y);
    font(20, "rgb(55,55,55)", "normal"); g.fillText(value, vx, y);
  };
  line("ID: ", c.id, 260, 180);
  let y = 290;
  if (c.programme) { line("PROGRAMME: ", c.programme, y, 310); y += 30; }
  if (c.department) { line("DEPT: ", c.department, y, 210); y += 30; }
  line("EMAIL: ", c.email, y, 230);
  const code = code128(c.id);
  if (code) {
    const bw = 500, bx = (W - bw) / 2, unit = bw / code.modules;
    g.fillStyle = "#fff";
    roundRect(g, bx - 8, 380, bw + 16, 80, 4); g.fill();
    g.fillStyle = INK;
    for (const [mx, mw] of code.bars) g.fillRect(bx + mx * unit, 388, mw * unit, 60);
    font(18, INK, "normal"); g.textAlign = "center"; g.fillText(c.id, W / 2, 490); g.textAlign = "left";
  }
  return cv;
}

export async function render(el) {
  const profile = prefs.get("profile") || {};
  let c = cardData(profile, creds.get());

  el.innerHTML = screen({ cls: "tools-body",
    bar: topBar({ title: "IISER Card", actions: iconBtn("refresh", "Refresh", { "data-act": "refresh" }) }),
    body: `
      <div class="tools-idwrap">
        <div id="id-card">${cardHtml(c)}</div>
        <button type="button" class="field tools-dept" data-act="dept" aria-haspopup="menu">
          <span class="tools-dept__label">Department</span>
          <span class="tools-dept__value${c.department ? "" : " is-empty"}" id="dept-value">${esc(c.department || "Select your department")}</span>
          ${icon("arrow_drop_down", { size: 24 })}
        </button>
        <button type="button" class="btn btn--filled btn--block tools-brand-btn" data-act="download">
          ${icon("download", { size: 18 })}<span>Download as PNG</span>
        </button>
        ${c.sample ? browserNote({ icon: "info", tone: "info", title: "Sample card", body: "This is made-up sample data. Sign in on the first screen to put your own ID on the card." }) : ""}
        <p class="tools-fine c-muted tools-center">This is a digital student card generated from your profile. It is NOT an official IISER Kolkata identity document.</p>
      </div>`,
  });

  const paint = () => { el.querySelector("#id-card").innerHTML = cardHtml(c); };

  on(el, "click", "[data-act=dept]", async (e, btn) => {
    const pick = await menu(btn, IISER_DEPARTMENTS.map((d) => ({ label: d, value: d, checked: d === c.department })));
    if (!pick) return;
    prefs.set("cardDepartment", pick);
    c = { ...c, department: pick };
    el.querySelector("#dept-value").textContent = pick;
    el.querySelector("#dept-value").classList.remove("is-empty");
    paint();
  });

  on(el, "click", "[data-act=download]", () => {
    const cv = drawCard(c);
    cv.toBlob((blob) => {
      if (!blob) { snackbar("Failed to render card"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `IISERK_Card_${c.id}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      snackbar(`Card downloaded as IISERK_Card_${c.id}.png`);
    }, "image/png");
  });

  on(el, "click", "[data-act=refresh]", () => nav.reload());
}
