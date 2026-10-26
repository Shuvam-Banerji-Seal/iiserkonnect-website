#!/usr/bin/env node
/**
 * tests/smoke.mjs — visit every route of the web app and fail on any console
 * error, uncaught exception, crash screen or request that leaves this machine.
 *
 *   npm install          # once (installs Playwright only; nothing is bundled)
 *   npm test             # or: node tests/smoke.mjs [--shots <dir>] [--quick]
 *
 * It serves the repository itself on a free local port, runs in "Sample data
 * only" mode (so the app never tries to reach a campus server) and blocks every
 * request that is not to that local server — any such request fails the run.
 *
 * Matrix: 390×844 (phone) and 1280×800 (desktop) × Light, Dark, Liquid Glass,
 * Neko and E-Ink. --quick runs only Light and Dark.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const shotsDir = args.includes("--shots") ? path.resolve(args[args.indexOf("--shots") + 1]) : null;
const quick = args.includes("--quick");

/* ── routes, read from the app's own route table ── */
const table = fs.readFileSync(path.join(ROOT, "scripts/app/routes.js"), "utf8");
const patterns = [...table.matchAll(/^\s*\["([^"]+)",\s*"[a-z]+",\s*"[A-Za-z]+"/gm)].map((m) => m[1]);
if (patterns.length < 40) { console.error(`Only ${patterns.length} routes found in routes.js — parser out of date?`); process.exit(2); }

const SETTINGS_SECTIONS = ["appearance", "motion", "account", "security", "notifications", "chat", "advanced", "about"];
const EXPAND = {
  "settings/:section": SETTINGS_SECTIONS.map((s) => `settings/${s}`),
  "welearn/courses/:courseId/:courseTitle/files": ["welearn/courses/101/Sample%20Course/files"],
  "chat/room/:peer/:name": ["chat/room/nobody/Nobody"],
  "profile/page/:page": ["profile/page/personal"],
  "research/detail/:eprintId": ["research/detail/1001?title=Sample%20paper&authors=A.%20Author"],
  "website/section": ["website/section?title=About&url=" + encodeURIComponent("https://www.iiserkol.ac.in/web/about")],
  "website/vpnview": ["website/vpnview?title=Course%20Material&url=" + encodeURIComponent("https://drive.google.com/drive/folders/sample")],
  "pdf": ["pdf?title=Academic%20Calendar&url=" + encodeURIComponent("https://www.iiserkol.ac.in/web/academic/academic-calendar")],
  "teaching-plan/course": ["teaching-plan/course?url=" + encodeURIComponent("https://www.iiserkol.ac.in/sample-course")],
  "foodmenu": ["foodmenu", "foodmenu?meal=Lunch"],
};
const routes = patterns.flatMap((p) => EXPAND[p] || (p.includes(":") ? [] : [p]));
const unexpanded = patterns.filter((p) => p.includes(":") && !EXPAND[p]);
if (unexpanded.length) { console.error("Routes with parameters but no test value:", unexpanded.join(", ")); process.exit(2); }

/* ── a tiny static server for the repository ── */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".txt": "text/plain", ".md": "text/markdown" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT) || file.includes(`${path.sep}node_modules${path.sep}`)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

/* ── browser (falls back to any cached Chromium when the pinned build is missing) ── */
async function launch() {
  try { return await chromium.launch(); }
  catch (e) {
    const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(), ".cache", "ms-playwright");
    const cands = [process.env.CHROMIUM_PATH].filter(Boolean);
    if (fs.existsSync(cache)) {
      for (const d of fs.readdirSync(cache).filter((n) => /^chromium-\d+$/.test(n)).sort((a, b) => +b.split("-")[1] - +a.split("-")[1])) {
        for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-win/chrome.exe"]) {
          const p = path.join(cache, d, sub);
          if (fs.existsSync(p)) cands.push(p);
        }
      }
    }
    for (const executablePath of cands) { try { return await chromium.launch({ executablePath }); } catch {} }
    throw e;
  }
}

const THEMES = quick ? [[1, "light"], [0, "dark"]] : [[1, "light"], [0, "dark"], [8, "liquid-glass"], [9, "neko"], [10, "e-ink"]];
const VIEWPORTS = [{ width: 390, height: 844, name: "phone" }, { width: 1280, height: 800, name: "desktop" }];

const browser = await launch();
const failures = [];
let visits = 0;
const t0 = Date.now();

for (const vp of VIEWPORTS) {
  for (const [mode, themeName] of THEMES) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: shotsDir ? 2 : 1 });
    const seed = { "pref.themeMode": mode, "pref.loginSkipped": true, "pref.dataSource": "sample", "pref.profile": { name: "Sample Student", roll: "21MS999", stream: "Physical Sciences", avatar: null } };
    await ctx.addInitScript(`try { if (!sessionStorage.getItem("smoke-seeded")) { localStorage.setItem("iiserk-web", ${JSON.stringify(JSON.stringify(seed))}); sessionStorage.setItem("smoke-seeded", "1"); } } catch (e) {}`);
    let current = "(boot)";
    await ctx.route("**/*", (route) => {
      const u = route.request().url();
      if (u.startsWith(BASE) || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
      failures.push({ where: `${vp.name}/${themeName}/${current}`, what: `request left the machine: ${u}` });
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") failures.push({ where: `${vp.name}/${themeName}/${current}`, what: `console error: ${m.text()}` }); });
    page.on("pageerror", (e) => failures.push({ where: `${vp.name}/${themeName}/${current}`, what: `uncaught: ${e.message}` }));
    await page.goto(BASE + "#/home", { waitUntil: "load" });
    await page.waitForSelector(".screen:not([aria-busy])", { timeout: 15000 });

    for (const r of routes) {
      current = r;
      visits++;
      await page.evaluate((h) => { location.hash = h; }, "#/" + r);
      try {
        await page.waitForFunction(() => {
          const s = [...document.querySelectorAll(".screen")].pop();
          return s && !s.hasAttribute("aria-busy") && !document.querySelector(".screen--leaving");
        }, null, { timeout: 15000 });
      } catch { failures.push({ where: `${vp.name}/${themeName}/${r}`, what: "screen never finished rendering" }); continue; }
      await page.waitForTimeout(140);
      const state = await page.evaluate(() => {
        const s = [...document.querySelectorAll(".screen")].pop();
        return { route: s && s.dataset.route, text: s ? s.innerText.trim().length : 0, crashed: !!(s && /Something went wrong/.test(s.innerText) && s.querySelector(".error-card")), overflowX: document.documentElement.scrollWidth > innerWidth + 1 || [...(s ? s.querySelectorAll(".screen__body") : [])].some((b) => b.scrollWidth > b.clientWidth + 1) };
      });
      if (state.crashed) failures.push({ where: `${vp.name}/${themeName}/${r}`, what: "crash screen shown" });
      if (!state.text) failures.push({ where: `${vp.name}/${themeName}/${r}`, what: "screen is empty" });
      if (state.overflowX) failures.push({ where: `${vp.name}/${themeName}/${r}`, what: "page scrolls sideways" });
      if (shotsDir && (mode === 1 || mode === 0 || vp.name === "phone")) {
        fs.mkdirSync(shotsDir, { recursive: true });
        await page.screenshot({ path: path.join(shotsDir, `${vp.name}-${themeName}-${r.replace(/[^a-z0-9]+/gi, "_").slice(0, 60)}.png`) });
      }
    }
    await ctx.close();
  }
}

await browser.close();
server.close();

const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(`smoke: ${routes.length} routes × ${VIEWPORTS.length} viewports × ${THEMES.length} themes = ${visits} visits in ${secs}s`);
if (failures.length) {
  const seen = new Set();
  for (const f of failures) { const k = f.where + f.what; if (!seen.has(k)) { seen.add(k); console.log(`  FAIL ${f.where}: ${f.what}`); } }
  console.log(`smoke: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log("smoke: all clean — no console errors, no uncaught exceptions, no requests off this machine");
