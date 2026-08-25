/**
 * modules/render-sections.js — the only place where data modules meet
 * the DOM. Fills mount points declared in index.html; keeps markup and
 * content fully decoupled.
 */

import { academics, campus, tools } from "../data/features.js";
import { discovery, checklist } from "../data/chat-facts.js";
import { techStack, security } from "../data/tech-stack.js";
import { icon } from "../components/icons.js";

function fill(id, html) {
  const mount = document.getElementById(id);
  if (mount) mount.innerHTML = html;
}

export function renderSections() {
  const card = (f) => `
    <feature-card icon="${f.icon}" title="${f.title}"
                  desc="${f.desc}" tags="${f.tags.join(", ")}"
                  ${f.featured ? "featured" : ""}></feature-card>`;

  fill("grid-academics", academics.map(card).join(""));
  fill("grid-campus",    campus.map(card).join(""));
  fill("grid-tools",     tools.map(card).join(""));

  fill("discovery-mount", discovery.map((d) => `
    <div class="discovery__card">
      ${icon(d.icon)}
      <strong>${d.title}</strong>
      <span>${d.desc}</span>
    </div>`).join(""));

  fill("checklist-mount", checklist.map((item) => `<li>${item}</li>`).join(""));

  fill("chip-cloud-mount",
    techStack.map((t) => `<span class="chip">${t}</span>`).join(""));

  fill("security-list-mount", security.map((s) => `
    <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round"
             stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
       <span>${s}</span></li>`).join(""));
}
