/**
 * components/feature-card.js — <feature-card icon="…" title="…" tags="a,b">
 * Light-DOM card used inside the bento grids. Content is injected by
 * the section renderers from scripts/data/features.js.
 */

import { icon } from "./icons.js";

export class FeatureCard extends HTMLElement {
  connectedCallback() {
    const iconName = this.getAttribute("icon") ?? "sparkles";
    const title = this.getAttribute("title") ?? "";
    const desc = this.getAttribute("desc") ?? "";
    const tags = (this.getAttribute("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    this.classList.add("feature-card");
    if (this.hasAttribute("featured")) this.classList.add("span-2");

    this.innerHTML = `
      <div class="feature-card__head">
        <span class="icon-bubble">${icon(iconName)}</span>
        <h3>${title}</h3>
      </div>
      <p>${desc}</p>
      ${tags.length
        ? `<div class="feature-card__tags">
             ${tags.map((t) => `<span class="chip chip--accent">${t}</span>`).join("")}
           </div>`
        : ""}
    `;
  }
}

customElements.define("feature-card", FeatureCard);
