/**
 * components/stat-counter.js — <stat-counter value="25" suffix="+" label="Features">
 * The number animates from 0 when scrolled into view (modules/count-up.js).
 */

export class StatCounter extends HTMLElement {
  connectedCallback() {
    const value = this.getAttribute("value") ?? "0";
    const suffix = this.getAttribute("suffix") ?? "";
    const label = this.getAttribute("label") ?? "";

    this.classList.add("stat");
    this.innerHTML = `
      <span class="stat__value" data-count="${value}">0${suffix}</span>
      <span class="stat__label">${label}</span>
    `;
  }
}

customElements.define("stat-counter", StatCounter);
