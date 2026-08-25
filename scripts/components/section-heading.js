/**
 * components/section-heading.js — <section-heading eyebrow="…" title="…" sub="…">
 */

export class SectionHeading extends HTMLElement {
  connectedCallback() {
    const eyebrow = this.getAttribute("eyebrow") ?? "";
    const title = this.getAttribute("title") ?? "";
    const sub = this.getAttribute("sub") ?? "";

    this.classList.add("section-head");
    this.innerHTML = `
      ${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ""}
      <h2 class="h2">${title}</h2>
      ${sub ? `<p class="lead">${sub}</p>` : ""}
    `;
  }
}

customElements.define("section-heading", SectionHeading);
