/**
 * data/attendance.data.js — attendance from the Moodle attendance modules of
 * the WeLearn courses. Live only where WeLearn can be reached; otherwise the
 * made-up sample. Summary follows AttendanceSummary.fromRecords: the
 * percentage counts Present and Late sessions.
 */

import { load } from "../services/source.js";
import { fetchCourses, fetchAttendance } from "../services/welearn.service.js";

export const STATUS = {
  Present: { label: "Present", short: "P", icon: "check_circle", tone: "good" },
  Absent: { label: "Absent", short: "A", icon: "cancel", tone: "bad" },
  Late: { label: "Late", short: "L", icon: "schedule", tone: "warn" },
  Excused: { label: "Excused", short: "E", icon: "info", tone: "info" },
  Unknown: { label: "Unknown", short: "?", icon: "hourglass_empty", tone: "neutral" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function summarize(records) {
  const total = records.length;
  const c = (s) => records.filter((r) => r.status === s).length;
  const present = c("Present"), absent = c("Absent"), late = c("Late"), excused = c("Excused");
  return {
    totalSessions: total, presentCount: present, absentCount: absent, lateCount: late, excusedCount: excused,
    percentage: total ? ((present + late) / total) * 100 : 0,
  };
}

/** "Mon 14 Jul 2025" — the Android AttendanceRecord.date shape. */
export function dateLabel(daysAgo, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** { data: { courses: [{ courseName, records, summary }] }, sample, ... } */
export async function loadAttendance({ force = false } = {}) {
  const r = await load("attendance", async () => {
    const courses = await fetchCourses();
    const list = await fetchAttendance(courses);
    return { courses: list.map((c) => ({ courseName: c.course, records: c.records })) };
  }, force ? { maxAgeMs: 0 } : undefined);
  const now = new Date();
  const courses = (r.data.courses || []).map((c) => ({
    courseName: c.course || c.courseName,
    records: (c.records || []).map((rec) => ({
      date: rec.date || (rec.daysAgo != null ? dateLabel(rec.daysAgo, now) : ""),
      time: rec.time || "", description: rec.description || "", status: rec.status || "Unknown",
      points: rec.points || "", remarks: rec.remarks || "",
    })),
  })).map((c) => ({ ...c, summary: summarize(c.records) }));
  return { ...r, data: { courses } };
}

/** Overall stats across courses (OverallSummaryCard). */
export function overall(courses) {
  const sum = (f) => courses.reduce((n, c) => n + f(c.summary), 0);
  const totalSessions = sum((s) => s.totalSessions);
  const present = sum((s) => s.presentCount), late = sum((s) => s.lateCount);
  return {
    totalCourses: courses.length, totalSessions,
    totalPresent: present, totalAbsent: sum((s) => s.absentCount), totalLate: late,
    percentage: totalSessions ? ((present + late) / totalSessions) * 100 : 0,
  };
}
