/**
 * pages/courseselection.page.js — Course Selection (ui/courseselection/
 * CourseSelectionScreen.kt).
 *
 * Choosing a course for each slot needs the campus sign-in with a security
 * code, which a browser cannot complete from another site. The page shows the
 * made-up sample. The dropdowns work for trying things out; saving and
 * resetting on campus is not possible here, so those buttons say so.
 */

import { esc, on } from "../ui/dom.js";
import { icon, topBar, screen, browserNote, sampleBanner, extLink } from "../ui/components.js";
import { snackbar } from "../ui/overlay.js";
import { loadCourseSelection, choiceSelections } from "../data/academic.data.js";
import { C } from "../core/net.js";

const TYPE_TONE = { CORE: "primary", ELECTIVE: "tertiary", AUDIT: "secondary" };

export async function render(el) {
  el.innerHTML = screen({
    bar: topBar({ title: "Course Selection" }),
    body: `<div id="cs-body"><div class="loading" role="status"><p>Loading course selection...</p></div></div>`,
  });
  const body = el.querySelector("#cs-body");
  const r = await loadCourseSelection();
  const page = r.data;
  const initial = choiceSelections(page);
  let selections = { ...initial };

  const paint = () => {
    body.innerHTML = `
      ${r.sample ? sampleBanner("the campus course selection") : ""}
      ${browserNote({
        icon: "lock", tone: "info", title: "Changes are made on campus",
        body: "Saving or resetting your choices needs the campus sign-in with a security code, which this browser cannot complete. You can try the drop-downs here; nothing is sent anywhere.",
        extra: `<p>${extLink("Open WeLearn", C.WELEARN_MY)}</p>`,
      })}
      <div class="card card--primary cs-student">
        <div class="t-title-s w-bold">Student: ${esc(page.studentId)} : ${esc(page.studentName)}</div>
        <div class="t-body-s c-muted">Major: ${esc(page.major)}  •  Batch: ${esc(page.batch)}  •  Semester: ${esc(page.semesterNo)}</div>
        <div class="t-body-s c-muted">Registered in: ${esc(page.registeredIn)}</div>
      </div>
      ${page.credits && page.credits.length ? `
        <div class="card card--variant cs-credits">
          <div class="t-title-s w-semi">Credits</div>
          <div class="cs-credits__row">${page.credits.map(([label, value]) => `
            <div class="cs-credits__cell"><span class="t-title-m w-bold c-primary">${esc(value)}</span><span class="t-label-s c-muted">${esc(label)}</span></div>`).join("")}</div>
        </div>` : ""}
      <h2 class="t-title-m w-bold c-primary cs-h">Course Choices</h2>
      <div class="stack-sm">${page.choices.map((c) => choiceCard(c, selections[c.index] ?? c.selectedCourseId)).join("")}</div>
      <div class="cs-actions">
        <button class="btn btn--filled" type="button" data-act="save">${icon("save", { size: 18 })}<span>Save Selections</span></button>
        <button class="btn btn--outlined" type="button" data-act="reset">Reset Selections</button>
      </div>`;
  };

  on(el, "change", "[data-slot]", (e, sel) => {
    selections = { ...selections, [+sel.dataset.slot]: sel.value };
  });
  on(el, "click", "[data-act=save]", () => {
    snackbar("Not sent: saving needs the campus sign-in, which this browser cannot complete.");
  });
  on(el, "click", "[data-act=reset]", () => {
    selections = { ...initial };
    paint();
    snackbar("Reset on this page only. Nothing was sent to campus.");
  });

  paint();
}

function choiceCard(choice, selectedId) {
  const tone = TYPE_TONE[choice.courseType] || "variant";
  return `<div class="card card--high cs-choice">
    <div class="row-between">
      <span class="t-label-m w-semi">Slot ${choice.index + 1}</span>
      <span class="cs-type cs-type--${tone}">${esc(choice.courseType)}</span>
    </div>
    <label class="cs-select">
      <span class="t-label-s c-muted">Course</span>
      <select data-slot="${choice.index}" aria-label="Slot ${choice.index + 1} course">
        ${choice.availableCourses.map((o) => `<option value="${esc(o.id)}"${o.id === selectedId ? " selected" : ""}>${esc(o.label)}</option>`).join("")}
      </select>
    </label>
  </div>`;
}
