/**
 * data/grades.data.js — Grade card. Campus login needs a security code that a
 * browser cannot read from another site, so there is no live path: the page
 * always shows the made-up sample with a note.
 */

import { load } from "../services/source.js";

export const loadGrades = () => load("grades");

/** GradeScreen summary: latest CGPA/SGPA over semesters that have courses. */
export function gradeSummary(semesters) {
  const withCourses = semesters.filter((s) => s.courses.length);
  const last = withCourses[withCourses.length - 1];
  return {
    withCourses,
    latestCgpa: last ? last.cgpa : "N/A",
    latestSgpa: last ? last.sgpa : "N/A",
    totalCourses: semesters.reduce((n, s) => n + s.courses.length, 0),
  };
}

/** Grade letter colour family, as GradeChip. */
export function gradeTone(grade = "") {
  if (grade.startsWith("A")) return "primary";
  if (grade.startsWith("B")) return "tertiary";
  if (grade.startsWith("C")) return "secondary";
  if (grade.startsWith("D")) return "warn";
  return "error";
}
