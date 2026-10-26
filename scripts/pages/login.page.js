/**
 * pages/login.page.js — Sign in (ui/login/GlobalLoginScreen.kt).
 *
 * Credentials are saved only in this browser (session.creds). "Skip for now"
 * goes on without them. main.js hides the bottom bar on this route.
 */

import { prefs } from "../core/prefs.js";
import { creds } from "../core/session.js";
import { nav } from "../core/router.js";
import { on } from "../ui/dom.js";
import { icon, screen, textField, button, browserNote } from "../ui/components.js";
import { haptics } from "../ui/haptics.js";

const BRAND = `<svg viewBox="0 0 32 32" width="64" height="64" aria-hidden="true"><path d="M8 12.5c0-3 3.4-5 7.5-5S23 9.5 23 12.5s-3.4 5-7.5 5h-.7L10.2 21v-4.2C8.8 15.9 8 14.3 8 12.5Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>`;

function applyWeLearn(deepCache, skipWeLearn) {
  prefs.set("welearnDeepCache", !!deepCache);
  prefs.set("welearnLoginSkipped", !!skipWeLearn);
}

export async function render(el) {
  const saved = creds.get();

  el.innerHTML = screen({ cls: "tools-body",
    bar: "",
    body: `
    <div class="login">
      <div class="login__mark">${BRAND}</div>
      <h1 class="login__title">IISERKonnect</h1>
      <p class="t-title-s c-muted login__tag">Campus tools for IISER Kolkata</p>
      <p class="t-body-s c-muted login__lead">Sign in with your IISERK credentials. They stay on this device.</p>

      <form class="login__form" novalidate>
        ${textField({
          id: "login-user", label: "Username", placeholder: "e.g. sbs21ms999", value: saved?.u || "",
          a: { autocomplete: "username", autocapitalize: "none", spellcheck: "false" },
        })}
        ${textField({
          id: "login-pass", label: "Password", type: "password", a: { autocomplete: "current-password" },
          trailing: `<button type="button" class="icon-btn" data-act="pw" aria-label="Show password" title="Show password">${icon("visibility")}</button>`,
        })}
        <div class="login__error" role="alert" hidden></div>

        <section class="login__welearn">
          <h2 class="t-title-s">WeLearn setup</h2>
          <label class="tools-check">
            <input type="checkbox" id="login-deep" ${prefs.get("welearnDeepCache") ? "checked" : ""}>
            <span>Enable WeLearn deep cache</span>
          </label>
          <label class="tools-check">
            <input type="checkbox" id="login-skipwl" ${prefs.get("welearnLoginSkipped") ? "checked" : ""}>
            <span>Skip WeLearn login for now</span>
          </label>
          <p class="t-body-s c-muted">You can change these later from WeLearn and Settings.</p>
        </section>

        <div class="login__actions">
          ${button("Save & Continue", { block: true, attrs: { "data-act": "save" } })}
          ${button("Skip for now", { variant: "text", block: true, attrs: { "data-act": "skip" } })}
        </div>
      </form>

      ${browserNote({
        icon: "info",
        tone: "info",
        title: "Where your sign-in goes",
        body: "Credentials are kept only in this browser's local storage, without encryption, and this site never sends them to a server. Campus portals do not accept sign-ins from another website, so campus screens show sample data unless this browser can reach campus.",
      })}
    </div>`,
  });

  const errBox = el.querySelector(".login__error");
  const showError = (msg) => { errBox.textContent = msg; errBox.hidden = !msg; };

  on(el, "click", "[data-act=pw]", (e, b) => {
    const input = el.querySelector("#login-pass");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    b.setAttribute("aria-label", show ? "Hide password" : "Show password");
    b.title = show ? "Hide password" : "Show password";
    b.innerHTML = icon(show ? "visibility_off" : "visibility");
  });

  on(el, "click", "[data-act=save]", () => {
    const user = el.querySelector("#login-user").value.trim();
    const pass = el.querySelector("#login-pass").value;
    const problem = !user ? "Username cannot be empty" : !pass.trim() ? "Password cannot be empty" : "";
    if (problem) { haptics.reject(); showError(problem); return; }
    creds.save(user, pass);
    applyWeLearn(el.querySelector("#login-deep").checked, el.querySelector("#login-skipwl").checked);
    prefs.set("signedIn", true);
    haptics.confirm();
    nav.go("home", { replace: true });
  });

  on(el, "click", "[data-act=skip]", () => {
    applyWeLearn(el.querySelector("#login-deep").checked, true);
    prefs.set("loginSkipped", true);
    nav.go("home", { replace: true });
  });
}
