/**
 * app/routes.js — every destination, mirroring ui/navigation/Screen.kt.
 *
 * Patterns are the Android routes. `load` lazy-imports the page module and
 * `export` names the render function in it. `tab` is the bottom-bar
 * destination that lights up while the route is open (MainActivity's
 * activeTab mapping); `isTab` marks the five tab roots, between which the
 * transition fades instead of sliding (NavMotion.kt).
 */

import { route } from "../core/router.js";

const P = {
  home: () => import("../pages/home.page.js"),
  login: () => import("../pages/login.page.js"),
  settings: () => import("../pages/settings.page.js"),
  welearn: () => import("../pages/welearn.page.js"),
  website: () => import("../pages/website.page.js"),
  chat: () => import("../pages/chat.page.js"),
  vpn: () => import("../pages/vpn.page.js"),
  sftp: () => import("../pages/sftp.page.js"),
  schedule: () => import("../pages/schedule.page.js"),
  calendar: () => import("../pages/calendar.page.js"),
  events: () => import("../pages/events.page.js"),
  profile: () => import("../pages/profile.page.js"),
  macreg: () => import("../pages/macreg.page.js"),
  tcpcount: () => import("../pages/tcpcount.page.js"),
  foodmenu: () => import("../pages/foodmenu.page.js"),
  library: () => import("../pages/library.page.js"),
  pyq: () => import("../pages/pyq.page.js"),
  attendance: () => import("../pages/attendance.page.js"),
  grades: () => import("../pages/grades.page.js"),
  courseselection: () => import("../pages/courseselection.page.js"),
  mess: () => import("../pages/mess.page.js"),
  qrbilling: () => import("../pages/qrbilling.page.js"),
  helpdesk: () => import("../pages/helpdesk.page.js"),
  noticeboard: () => import("../pages/noticeboard.page.js"),
  voip: () => import("../pages/voip.page.js"),
  emergency: () => import("../pages/emergency.page.js"),
  iisercard: () => import("../pages/iisercard.page.js"),
  netmon: () => import("../pages/netmon.page.js"),
  budget: () => import("../pages/budget.page.js"),
  research: () => import("../pages/research.page.js"),
  deadlines: () => import("../pages/deadlines.page.js"),
  reminders: () => import("../pages/reminders.page.js"),
  notes: () => import("../pages/notes.page.js"),
  timer: () => import("../pages/timer.page.js"),
  stopwatch: () => import("../pages/stopwatch.page.js"),
  focus: () => import("../pages/focus.page.js"),
  planner: () => import("../pages/planner.page.js"),
  mycalendar: () => import("../pages/mycalendar.page.js"),
  log: () => import("../pages/log.page.js"),
};

/** [pattern, page, export, title, tab, isTab] */
const TABLE = [
  ["login", "login", "render", "Sign in", null],
  ["home", "home", "render", "Home", "home", true],
  ["home-customize", "home", "renderCustomize", "Customize Home", "home"],
  ["vpn", "vpn", "render", "VPN", "vpn", true],
  ["welearn/login", "welearn", "renderLogin", "WeLearn", "welearn", true],
  ["welearn/courses", "welearn", "renderCourses", "My Courses", "welearn"],
  ["welearn/courses/:courseId/:courseTitle/files", "welearn", "renderFiles", (c) => c.params.courseTitle || "Course files", "welearn"],
  ["welearn/downloads", "welearn", "renderDownloads", "Downloads", "welearn"],
  ["welearn/notifications", "welearn", "renderNotifications", "Notifications", "welearn"],
  ["website", "website", "renderHome", "IISER Kolkata", "home"],
  ["website/section", "website", "renderSection", (c) => c.query.title || "Website", "home"],
  ["website/vpnview", "website", "renderWebView", (c) => c.query.title || "Web page", "home"],
  ["pdf", "website", "renderPdf", (c) => c.query.title || "PDF", "home"],
  ["teaching-plan", "website", "renderTeachingPlan", "Teaching Plans", "home"],
  ["teaching-plan/course", "website", "renderCourseDetail", "Course detail", "home"],
  ["concept-tree", "website", "renderConceptTree", "Concept Tree", "home"],
  ["schedule", "schedule", "render", "Timetable", "home"],
  ["calendar", "calendar", "render", "Calendar", "home"],
  ["campus-events", "events", "render", "Event Calendar", "home"],
  ["profile", "profile", "render", "My Profile", "home"],
  ["profile/page/:page", "profile", "renderPage", "Profile", "home"],
  ["macreg", "macreg", "render", "MAC Registration", "home"],
  ["tcpcount", "tcpcount", "render", "TCP Count", "home"],
  ["foodmenu", "foodmenu", "render", "Mess Menu", "home"],
  ["library", "library", "render", "Library", "home"],
  ["pyq", "pyq", "render", "PYQs", "home"],
  ["attendance", "attendance", "render", "Attendance", "home"],
  ["grades", "grades", "render", "Grade Card", "home"],
  ["course-selection", "courseselection", "render", "Course Selection", "home"],
  ["mess-transactions", "mess", "render", "Mess Transactions", "home"],
  ["mess/qr-billing", "qrbilling", "render", "QR Billing", "home"],
  ["helpdesk", "helpdesk", "render", "Helpdesk", "home"],
  ["notice-board", "noticeboard", "render", "Notice Board", "home"],
  ["voip-directory", "voip", "render", "VoIP Directory", "home"],
  ["emergency-contacts", "emergency", "render", "Emergency Contacts", "home"],
  ["chat", "chat", "renderHome", "Campus Chat", "chat", true],
  ["chat/room/:peer/:name", "chat", "renderRoom", (c) => c.params.name || "Chat", "chat"],
  ["iiser-card", "iisercard", "render", "Digital ID Card", "settings"],
  ["network-dashboard", "netmon", "render", "Network Status", "home"],
  ["sftp", "sftp", "render", "SFTP", "home"],
  ["settings", "settings", "renderHub", "Settings", "settings", true],
  ["settings/:section", "settings", "renderDetail", (c) => c.title || "Settings", "settings"],
  ["log", "log", "render", "Logs", "settings"],
  ["budget", "budget", "renderAnalysis", "My Budget", "home"],
  ["budget/ledger", "budget", "renderLedger", "Ledger", "home"],
  ["budget/sync", "budget", "renderSync", "Budget Sync", "home"],
  ["research", "research", "render", "Research Papers", "home"],
  ["research/detail/:eprintId", "research", "renderDetail", (c) => c.query.title || "Paper", "home"],
  ["deadlines", "deadlines", "render", "Deadlines", "home"],
  ["reminders", "reminders", "render", "Reminders", "home"],
  ["notes", "notes", "render", "Notes", "home"],
  ["timer", "timer", "render", "Timer", "home"],
  ["stopwatch", "stopwatch", "render", "Stopwatch", "home"],
  ["focus", "focus", "render", "Focus", "home"],
  ["planner", "planner", "render", "Planner", "home"],
  ["my-calendar", "mycalendar", "render", "My Calendar", "home"],
];

export const ROUTE_PATTERNS = TABLE.map((r) => r[0]);

export function registerRoutes() {
  for (const [pattern, page, exp, title, tab, isTab] of TABLE) {
    route(pattern, { load: P[page], export: exp, title, tab, isTab: !!isTab });
  }
}

/** The five bottom-bar destinations (BottomNavItem.kt). */
export const TABS = [
  { id: "home", label: "Home", icon: "home", href: "#/home" },
  { id: "chat", label: "Chat", icon: "chat_bubble", href: "#/chat" },
  { id: "welearn", label: "WeLearn", icon: "school", href: "#/welearn/login" },
  { id: "vpn", label: "VPN", icon: "vpn_key", href: "#/vpn" },
  { id: "settings", label: "Settings", icon: "settings", href: "#/settings" },
];
