/**
 * data/website.data.js — IISER Kolkata website screens (ui/website/*).
 *
 *  - Quick links and navigation categories are the app's hardcoded lists
 *    (data/repository/WebsiteRepository.kt), copied verbatim.
 *  - Teaching plans come from the bundled sample (WeLearn cannot be read from
 *    another website's page), and the course topic tree is built from the
 *    course details in that data, exactly as the app does it.
 */

import { load } from "../services/source.js";

export const WEB_BASE = "https://www.iiserkol.ac.in";

/** Quick links on the website home. `vpn` = requiresVpn. */
export const QUICK_LINKS = [
  { title: "ERP Dashboard", url: "https://www.iiserkol.ac.in/myprofile/ldap/login/?next=/myprofile/dashboard/", vpn: true, icon: "dashboard" },
  { title: "Samarth", url: "https://iiserkol.samarth.edu.in", vpn: true, icon: "account_balance" },
  { title: "Intranet", url: "http://intranet.iiserkol.ac.in/wiki/Main_Page", vpn: true, icon: "lan" },
  { title: "TCP Counter", url: "https://gw.iiserkol.ac.in/macreg/", vpn: true, icon: "router" },
  { title: "Event Calendar", url: "https://calendar.iiserkol.ac.in/calendar_view/", vpn: false, icon: "calendar_month" },
  { title: "Teaching Plan", url: "https://welearn.iiserkol.ac.in/teaching-plan/", vpn: false, icon: "assignment", native: "teaching-plan" },
  { title: "Timetable", url: `${WEB_BASE}/web/en/student-activities/time-table`, vpn: false, icon: "schedule" },
  { title: "Holiday List", url: `${WEB_BASE}/web/footer-content/holiday-list-%282025%29`, vpn: false, icon: "beach_access" },
  { title: "Outreach", url: `${WEB_BASE}/web/outreach`, vpn: false, icon: "campaign" },
  { title: "People", url: `${WEB_BASE}/web/people`, vpn: false, icon: "people" },
];

const sub = (path, title) => ({ title, url: `${WEB_BASE}${path}` });

/** Navigation categories (main, then upper), with their sub-pages. */
export const NAV_CATEGORIES = [
  { title: "About Us", icon: "info", url: "/web/about-us", subs: [
    sub("/web/about-us/directors-message", "Director's Message"), sub("/web/about-us/mission-and-vision", "Mission and Vision"),
    sub("/web/about-us/statutory-bodies", "Statutory Bodies"), sub("/web/about-us/administration", "Administration"),
    sub("/web/about-us/annual-and-audit-reports", "Annual & Audit Reports"), sub("/web/about-us/campus", "Campus"),
    sub("/web/about-us/act-&-statutes", "Act & Statutes"), sub("/web/about-us/newsletter", "Newsletter"),
    sub("/web/about-us/news-&-press-release", "News & Press Release"), sub("/web/about-us/documentary-and-videos", "Documentary and Videos"),
    sub("/web/about-us/rti-information", "RTI Information"), sub("/web/about-us/ex-directors", "Ex-Directors"),
  ] },
  { title: "Academic", icon: "school", url: "/web/acedemic", subs: [
    sub("/web/acedemic/departments", "Departments"), sub("/web/acedemic/programmes", "Programmes"),
    sub("/web/acedemic/academic-guidelines", "Academic Guidelines"), sub("/web/acedemic/teaching-plan", "Teaching Plan"),
    sub("/web/acedemic/courses-of-study", "Courses of Study"), sub("/web/acedemic/academic-calendar", "Academic Calendar"),
    sub("/web/acedemic/convocation", "Convocation"), sub("/web/acedemic/nad-cell", "NAD Cell"),
    sub("/web/acedemic/iiserk-open-courseware", "IISERK Open Courseware"), sub("/web/acedemic/pmrf", "PMRF"),
  ] },
  { title: "Research", icon: "science", url: "/web/research", subs: [
    sub("/web/research/projects-and-other-facilities", "Projects & Facilities"), sub("/web/research/vision-and-policies", "Vision and Policies"),
    sub("/web/research/centers-at-iiser-kolkata", "Centers at IISER Kolkata"), sub("/web/research/research-facilities", "Research Facilities"),
    sub("/web/research/central-instrument-facility", "Central Instrument Facility"),
  ] },
  { title: "Events", icon: "event", url: "/web/events", subs: [] },
  { title: "Campus", icon: "location_city", url: "/web/campus", subs: [] },
  { title: "Admission", icon: "how_to_reg", url: "/web/admission", subs: [] },
  { title: "NIRF", icon: "leaderboard", url: "/web/nirf", subs: [2025, 2024, 2023, 2022, 2021, 2020].map((y) => sub(`/web/nirf/nirf-${y}`, `NIRF ${y}`)) },
  { title: "Contact", icon: "contact_mail", url: "/web/contact", subs: [] },
  { title: "Students", icon: "people", url: "/web/students", subs: [
    sub("/web/students/student%27s-brochure", "Student's Brochure"), sub("/web/students/students-affairs-council-%28sac%29", "SAC"),
    sub("/web/students/placement", "Placement"), sub("/web/students/e-cell", "E-Cell"), sub("/web/students/inquivesta", "Inquivesta"),
    sub("/web/students/alumni", "Alumni"), sub("/web/students/anti-ragging", "Anti Ragging"),
    sub("/web/students/awards-and-recognition", "Awards & Recognition"), sub("/web/students/fee-structure", "Fee Structure"),
    sub("/web/students/inscight", "InScight"),
  ] },
  { title: "Outreach", icon: "campaign", url: "/web/outreach", subs: [] },
  { title: "Facilities", icon: "apartment", url: "/web/facilities", subs: [
    sub("/web/facilities/hostel", "Hostel"), sub("/web/facilities/medical", "Medical"), sub("/web/facilities/library", "Library"),
    sub("/web/facilities/guest-house", "Guest House"), sub("/web/facilities/computing", "Computing"),
    sub("/web/facilities/rn-tagore-auditorium", "RN Tagore Auditorium"), sub("/web/facilities/campus-school", "Campus School"),
    sub("/web/facilities/laboratories", "Laboratories"), sub("/web/facilities/animal-facility", "Animal Facility"),
    sub("/web/facilities/students%27-monitored-canteen", "Students' Canteen"),
    sub("/web/facilities/mind-care-and-wellness-centre", "Mind Care & Wellness"), sub("/web/facilities/sc-st", "SC-ST-OBC"),
  ] },
  { title: "Alumni", icon: "people_outline", url: "/web/alumni", subs: [] },
  { title: "People", icon: "person", url: "/web/people/faculty", subs: [] },
];

/** The route a link opens in-app (website home onClick). */
export function routeFor(url, vpn = false) {
  if (url.includes("/teaching-plan")) return { route: "teaching-plan" };
  if (url.toLowerCase().endsWith(".pdf")) return { route: "pdf", url };
  if (vpn) return { route: "website/vpnview", url };
  return { route: "website/section", url };
}

/* ── teaching plans (sample) ──────────────────────────────────── */
export async function loadTeachingPlans() {
  // No live path: WeLearn does not allow other websites to read these pages.
  return load("teaching-plan", null);
}

export const semesterOrder = (s) => s.year * 10 + (s.season === "Autumn" ? 1 : 0);

/* ── concept tree ─────────────────────────────────────────────── */
export const DEPARTMENT_NAMES = {
  CH: "Chemical Sciences", PH: "Physical Sciences", MA: "Mathematics & Statistics", ES: "Earth Sciences",
  CS: "Computer Science", LS: "Life Sciences", BS: "Biological Sciences", HS: "Humanities & Social Sciences",
  EE: "Electrical Engineering", EC: "Economics", GS: "General Studies", SE: "Science Education", ID: "Interdisciplinary",
};

const TOPIC_RE = /(?:^|\n)\s*(?:(?:[Mm]odule|[Uu]nit)\s*\d+[:.-]?|\d+[.)]|\*(?=\s)|-(?=\s)|[IVXLCDM]+\.(?=\s))\s*/g;

function shortLabel(text) {
  const colon = text.indexOf(":");
  if (colon >= 1 && colon <= 80) return text.slice(0, colon).trim();
  if (text.length <= 80) return text;
  const cut = text.lastIndexOf(" ", 80);
  return text.slice(0, cut > 0 ? cut : 80).replace(/[.,;:\s]+$/, "") + "…";
}

/** Topics from a syllabus: each list marker starts a topic that runs to the next one. */
export function extractTopics(syllabus) {
  const s = syllabus || "";
  const starts = [...s.matchAll(TOPIC_RE)];
  if (!starts.length) {
    return s.trim().length > 10 ? [{ label: "1. " + s.trim().slice(0, 120) + "…", text: s.trim() }] : [];
  }
  return starts.map((m, i) => {
    const from = m.index + m[0].length;
    const to = i + 1 < starts.length ? starts[i + 1].index : s.length;
    const text = s.slice(from, to).trim();
    return { label: `${i + 1}. ${shortLabel(text)}`, text };
  });
}

/** Build { nodes, stats } from course details: department → course → topic. */
export function buildConceptTree(courses) {
  const groups = new Map();
  for (const c of courses) {
    const prefix = c.code.slice(0, 2).toUpperCase();
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(c);
  }
  let topicCount = 0;
  const nodes = [...groups.keys()].sort().map((prefix) => {
    const list = groups.get(prefix).slice().sort((a, b) => a.code.localeCompare(b.code));
    const children = list.map((c) => {
      const topics = c.syllabus && c.syllabus.trim() ? extractTopics(c.syllabus) : [];
      topicCount += topics.length;
      return {
        type: "COURSE", id: c.code, label: `${c.code} — ${c.name}`,
        detail: c.syllabus && c.syllabus.trim() ? `${(c.instructors || []).join(", ")} | ${c.type} | ${c.credits} cr` : "",
        topicCount: topics.length,
        children: topics.map((t) => ({ type: "TOPIC", id: `${c.code}:${t.label}`, label: t.label, detail: t.text, children: [] })),
      };
    });
    return { type: "DEPARTMENT", id: prefix, label: `${DEPARTMENT_NAMES[prefix] || prefix} (${prefix})`, children };
  });
  return { nodes, stats: { departments: nodes.length, courses: courses.length, topics: topicCount } };
}
