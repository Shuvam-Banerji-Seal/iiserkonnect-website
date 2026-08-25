/**
 * components/crypto-pipeline.js — <crypto-pipeline>
 * Renders the E2E encryption pipeline from data/chat-facts.js.
 */

import { pipeline } from "../data/chat-facts.js";
import { icon } from "./icons.js";

export class CryptoPipeline extends HTMLElement {
  connectedCallback() {
    this.classList.add("pipeline");
    this.innerHTML = pipeline
      .map((step, i) => `
        ${i > 0 ? `<span class="pipeline__arrow" aria-hidden="true">→</span>` : ""}
        <div class="pipeline__step">
          <strong>${icon("lock")} ${step.name}</strong>
          <span>${step.desc}</span>
        </div>
      `)
      .join("");

    this.querySelectorAll(".pipeline__step strong svg")
      .forEach((svg) => { svg.style.width = "13px"; svg.style.height = "13px"; });
  }
}

customElements.define("crypto-pipeline", CryptoPipeline);
