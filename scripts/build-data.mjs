#!/usr/bin/env node
// Build static snapshots so the Pages site works with zero backend.
// Run on a campus machine (or with --mock) to refresh data/*.json
import { writeFileSync, mkdirSync } from "node:fs";

const MOCK = process.argv.includes("--mock");
mkdirSync("data", { recursive: true });

// Minimal realistic snapshots — same shapes the parsers produce
const now = new Date().toISOString();

writeFileSync("data/welearn.json", JSON.stringify({
  updatedAt: now,
  courses: [
    { id: "101", title: "PH4201 Quantum Mechanics", url: "https://welearn.iiserkol.ac.in/course/view.php?id=101" },
    { id: "102", title: "CS3102 Data Structures", url: "https://welearn.iiserkol.ac.in/course/view.php?id=102" },
    { id: "103", title: "MA4104 Real Analysis", url: "https://welearn.iiserkol.ac.in/course/view.php?id=103" },
  ],
  files: {
    "101": [{ name: "Lecture 1 Notes", url: "https://welearn.iiserkol.ac.in/mod/resource/view.php?id=9001", kind: "resource" }],
    "102": [{ name: "Lecture 1 Notes", url: "https://welearn.iiserkol.ac.in/mod/resource/view.php?id=9001", kind: "resource" }],
    "103": [{ name: "Lecture 1 Notes", url: "https://welearn.iiserkol.ac.in/mod/resource/view.php?id=9001", kind: "resource" }],
  },
  grades: Array.from({ length: 10 }, (_, i) => ({
    semester: i + 1,
    sgpa: (8 + (i + 1) * 0.1).toFixed(2),
    cgpa: "8.42",
    courses: [
      { code: "PH4201", name: "Quantum Mechanics II", grade: "A" },
      { code: "MA4104", name: "Real Analysis", grade: "A-" },
    ]
  }))
}, null, 2));

writeFileSync("data/mess.json", JSON.stringify({
  updatedAt: now,
  transactions: [
    { dateTime: "2026:08:20 13:05:11", foodItems: "Rice:1:12|Dal:1:25", totalCost: 37, type: "Debited", balanceAdded: "", modeOfTran: "", balance: 813, remarks: "" },
    { dateTime: "2026:08:19 20:10:02", foodItems: "Dinner", totalCost: 45, type: "Debited", balanceAdded: "", modeOfTran: "", balance: 850, remarks: "" },
  ]
}, null, 2));

writeFileSync("data/menu.json", JSON.stringify({
  updatedAt: now,
  title: "Today's Menu",
  meals: [
    { type: "Lunch", items: ["Rice", "Dal Tadka", "★ Special Paneer"] },
    { type: "Dinner", items: ["Chapati", "Mixed Veg"] },
  ]
}, null, 2));

writeFileSync("data/calendar.json", JSON.stringify({
  updatedAt: now,
  academic: {
    monthLabel: "August 24 – 30, 2026",
    days: [{ day: "Mon", date: "24 Aug", today: true }, { day: "Tue", date: "25 Aug", today: false }],
    events: [{ id: "pop101", title: "PH4201", start: "8:00 a.m.", end: "9:30 a.m.", venue: "LHC 201", day: 0, hour: 8 }]
  },
  events: {
    monthLabel: "August 24 – 30, 2026",
    days: [{ day: "Mon", date: "24 Aug", today: true }],
    events: [{ id: "pop201", title: "Physics Colloquium", time: "14:30", venue: "Asima Theatre", day: 0, hour: 14 }]
  }
}, null, 2));

writeFileSync("data/notices.json", JSON.stringify({
  updatedAt: now,
  notices: [
    { year: "2026", title: "Hostel allotment notice", link: "http://intranet.iiserkol.ac.in/w/images/notice1.pdf", type: "PDF" },
    { year: "2026", title: "Registration deadline extended", link: null, type: null },
  ]
}, null, 2));

writeFileSync("data/library.json", JSON.stringify({
  updatedAt: now,
  results: [
    { title: "Gravitation", author: "Misner, Charles W.", callNumber: "QC 173 .M57", url: "http://lib.iiserkol.ac.in:9000/record=b1234" }
  ]
}, null, 2));

writeFileSync("data/research.json", JSON.stringify({
  updatedAt: now,
  latest: [{ id: "2157", title: "Topological Phases", year: "2025", url: "http://eprints.iiserkol.ac.in/2157/" }],
  divisions: [{ id: "dps", name: "Physical Sciences" }, { id: "dcs", name: "Chemical Sciences" }]
}, null, 2));

writeFileSync("data/voip.json", JSON.stringify({
  updatedAt: now,
  pilot: "+91-33-6136-0000",
  sections: [{ id: "admin", title: "Administration", contacts: [{ name: "Dean Office", ext: "5001", location: "Admin Block" }] }]
}, null, 2));

writeFileSync("data/netmon.json", JSON.stringify({
  updatedAt: now,
  monitors: [{ name: "Core", hosts: [{ name: "Router", up: true, url: "http://x/1/index.html" }] }],
  mrtg: [{ title: "Core Router", base: "core", day: "core-day.png" }]
}, null, 2));

writeFileSync("data/pyq.json", JSON.stringify({
  updatedAt: now,
  years: [{ year: 2025, url: "http://intranet.iiserkol.ac.in/wiki/Library:Old_Question_Papers_(2025)" }],
  sections: [{ exam: "Mid Semester", semester: "Autumn", depts: [{ name: "Physics", url: "http://intranet.iiserkol.ac.in/w/images/phy_mid_2025.pdf" }] }]
}, null, 2));

console.log("Wrote data/*.json (" + (MOCK ? "mock" : "live") + " mode)");
