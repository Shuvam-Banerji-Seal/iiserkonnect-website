/** pages/gateway.page.js — TCP counter + grades: the two captcha flows. */

import { gatewayLoginPage, gatewaySubmit, captchaBlob, gradesLoginPage, gradesSubmit, ensureGrades } from "../core/session.js";
import { parseGatewayDevices } from "../services/intranet.service.js";
import { fetchGrades } from "../services/library.service.js";
import { pageHead, card, esc, errorState, requireCreds, toast } from "../ui/helpers.js";

function captchaForm(id, hint) {
  return `
    <div class="captcha-row">
      <img id="${id}-img" class="captcha-img" alt="captcha">
      <button class="btn btn--ghost btn--sm" id="${id}-refresh" title="New captcha">↻</button>
    </div>
    <label class="field"><span>Captcha ${hint}</span><input class="input" id="${id}-input" autocomplete="off"></label>
    <button class="btn btn--primary btn--sm" id="${id}-go">Submit</button>
    <p class="err-text small" id="${id}-err" hidden></p>`;
}

function wireCaptcha(root, id, loadPage, submit, onSuccess) {
  const img = root.querySelector(`#${id}-img`);
  const err = root.querySelector(`#${id}-err`);
  let login = null;

  const load = async () => {
    login = await loadPage();
    if (login.loggedIn) return onSuccess();
    img.src = URL.createObjectURL(await captchaBlob(login.imgUrl));
  };
  root.querySelector(`#${id}-refresh`).onclick = load;
  root.querySelector(`#${id}-go`).onclick = async () => {
    err.hidden = true;
    const res = await submit(login, root.querySelector(`#${id}-input`).value.trim());
    if (res.ok) { toast("Signed in"); onSuccess(res); }
    else { err.textContent = res.error || "Failed"; err.hidden = false; load(); }
  };
  load();
}

/* ── TCP counter ───────────────────────────────────────────────── */
export async function renderTcp(el) {
  el.innerHTML = pageHead("TCP Counter", "Gateway & devices", "Campus TCP count and your registered MACs (captcha login).");
  const credsOk = requireCreds();
  if (!credsOk.ok) return el.insertAdjacentHTML("beforeend", credsOk.html);

  const mount = document.createElement("div");
  el.appendChild(mount);
  mount.innerHTML = card(`<h3 class="h3">Gateway login</h3>${captchaForm("tcp", "is case-sensitive")}`);
  wireCaptcha(mount, "tcp",
    () => gatewayLoginPage(),
    (login, captcha) => gatewaySubmit(login, captcha),
    (res) => {
      const html = res?.html;
      const info = parseGatewayDevices(html || "");
      if (!info.loggedIn) return;
      mount.innerHTML = `
        <div class="statrow">
          ${card(`<div class="stat"><span class="stat__value">${info.tcpCount.toLocaleString()}</span><span class="stat__label">Campus TCP count</span></div>`)}
          ${card(`<div class="stat"><span class="stat__value">${info.devices.length}</span><span class="stat__label">Your devices</span></div>`)}
        </div>
        ${info.devices.length ? card(`<table class="datatable"><thead><tr>
          <th>MAC</th><th>Type</th><th>Location</th><th>Valid till</th></tr></thead>
          <tbody>${info.devices.map((d) => `<tr><td class="mono">${esc(d.mac)}</td><td>${esc(d.type)}</td><td>${esc(d.location)}</td><td>${esc(d.validTill)}</td></tr>`).join("")}
          </tbody></table>`) : `<p class="body-muted">No registered devices listed.</p>`}`;
    });
}

/* ── Grades ────────────────────────────────────────────────────── */
export async function renderGrades(el) {
  el.innerHTML = pageHead("Grades", "Grade cards", "SGPA / CGPA for every semester (captcha login).");
  const credsOk = requireCreds();
  if (!credsOk.ok) return el.insertAdjacentHTML("beforeend", credsOk.html);

  const mount = document.createElement("div");
  el.appendChild(mount);

  if (await ensureGrades()) return showGrades(mount);
  mount.innerHTML = card(`<h3 class="h3">MyProfile login</h3>${captchaForm("gr", "— mock mode accepts anything")}`);
  wireCaptcha(mount, "gr",
    () => gradesLoginPage(),
    (login, captcha) => gradesSubmit(login, captcha),
    async () => { mount.innerHTML = `<div class="page-loading"><span class="spinner"></span> Fetching all semesters…</div>`; await showGrades(mount); });
}

async function showGrades(mount) {
  try {
    const sems = await fetchGrades();
    if (!sems || !sems.length) {
      mount.innerHTML = errorState("No semester data — the session may have expired. Reload and retry.");
      return;
    }
    mount.innerHTML = sems.map((s) => card(`
      <div class="row-between">
        <strong>Semester ${s.semester}</strong>
        <span><span class="chip chip--accent">SGPA ${esc(s.sgpa)}</span> <span class="chip">CGPA ${esc(s.cgpa)}</span></span>
      </div>
      <table class="datatable" style="margin-top:10px">
        <thead><tr><th>Code</th><th>Course</th><th>Grade</th></tr></thead>
        <tbody>${s.courses.map((c) => `<tr><td class="mono">${esc(c.code)}</td><td>${esc(c.name)}</td><td><strong>${esc(c.grade)}</strong></td></tr>`).join("")}
        </tbody></table>`)).join("");
  } catch (e) { mount.innerHTML = errorState(e.message); }
}
