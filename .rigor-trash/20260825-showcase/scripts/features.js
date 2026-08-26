/**
 * data/features.js — ALL showcase copy lives here.
 * Add/edit a feature by editing one entry; the UI re-renders.
 * Icons reference keys from components/icons.js.
 */

export const academics = [
  {
    icon: "school",
    title: "WeLearn Integration",
    desc: "Courses, files and resources synced straight from Moodle with session-aware login and auto re-login.",
    tags: ["Moodle", "Session-aware"],
    featured: true,
  },
  {
    icon: "database",
    title: "Deep Cache Sync",
    desc: "One-tap archive of every course file. Incremental re-syncs skip what you already have — fully offline afterwards.",
    tags: ["Offline-first", "Incremental"],
  },
  {
    icon: "folder",
    title: "Course Files Browser",
    desc: "Recursive folder scanning, batch-select downloads and Content-Disposition aware renaming.",
    tags: ["Batch download"],
  },
  {
    icon: "book",
    title: "Teaching Plans",
    desc: "Semester-wise courses with levels, credits and instructors — plus full-text search across every syllabus.",
    tags: ["Syllabus search"],
  },
  {
    icon: "git-branch",
    title: "Concept Tree",
    desc: "Cached syllabi auto-indexed into a Department → Course → Topic hierarchy for fast revision lookup.",
    tags: ["Auto-indexed"],
  },
  {
    icon: "calendar",
    title: "Timetable",
    desc: "Weekly PDF timetable that silently renews itself every week, rendered natively — no external viewer.",
    tags: ["Auto-renew", "Native PDF"],
  },
  {
    icon: "check-circle",
    title: "Attendance",
    desc: "Every Moodle attendance session parsed into Present / Absent / Late with live percentage summaries.",
    tags: ["Per-course %"],
  },
  {
    icon: "award",
    title: "Grade Card",
    desc: "Captcha-gated MyProfile login fetches SGPA/CGPA for all semesters, cached for instant offline viewing.",
    tags: ["SGPA · CGPA"],
  },
  {
    icon: "edit-3",
    title: "Course Selection",
    desc: "View, save and reset your credit choices directly through the ERP formset — no browser needed.",
    tags: ["ERP forms"],
  },
  {
    icon: "archive",
    title: "PYQ Archive",
    desc: "Previous-year papers organised year → exam → department, one tap to download from the intranet wiki.",
    tags: ["PDF downloads"],
  },
  {
    icon: "bell",
    title: "Deadlines & Alerts",
    desc: "Assignments scraped per course, plus a Moodle notifications feed with mark-as-read and change detection.",
    tags: ["Push alerts"],
  },
];

export const campus = [
  {
    icon: "celebrate",
    title: "Event Calendar",
    desc: "The public campus events week-view with exact-alarm reminders fired minutes before each event starts.",
    tags: ["Exact alarms"],
    featured: true,
  },
  {
    icon: "calendar",
    title: "Academic Calendar",
    desc: "Your class schedule grid with venues and tutorial flags — exportable as RFC-5545 .ics files.",
    tags: ["ICS export"],
  },
  {
    icon: "utensils",
    title: "Mess Menu Live",
    desc: "Today's canteen menu, a rolling history of past weeks and automatic new-item variation detection.",
    tags: ["History", "Variations"],
  },
  {
    icon: "wallet",
    title: "Budget & Calories",
    desc: "Daily / weekly / monthly spend and calorie charts built from real ERP transactions, with targets and reminders.",
    tags: ["Charts", "Targets"],
  },
  {
    icon: "receipt",
    title: "Mess Transactions",
    desc: "Complete canteen ERP history via range queries — balances, credits, debits and one-tap CSV export.",
    tags: ["CSV export"],
  },
  {
    icon: "library",
    title: "Library Catalogue",
    desc: "Search the VTLS Chamo catalogue with live availability, barcodes and shelf locations per copy.",
    tags: ["Availability"],
  },
  {
    icon: "flask",
    title: "Research Papers",
    desc: "Browse the ePrints repository — latest deposits, division/year filters, abstracts and PDF viewer.",
    tags: ["ePrints"],
  },
  {
    icon: "megaphone",
    title: "Notice Board",
    desc: "Student and administration wiki notices grouped by year, always a swipe away.",
    tags: ["Intranet wiki"],
  },
  {
    icon: "life-buoy",
    title: "Helpdesk",
    desc: "Direct ticket shortcuts for computing, electrical, civil and housekeeping — plus vendor contacts.",
    tags: ["Tickets"],
  },
  {
    icon: "phone",
    title: "VoIP Directory",
    desc: "Searchable campus telephone extensions with department sections and the central pilot number.",
    tags: ["Extensions"],
  },
  {
    icon: "id-card",
    title: "Digital I-Card",
    desc: "Your student card with QR code and Code128 barcode, generated on-device and saveable to your gallery.",
    tags: ["QR + Barcode"],
  },
];

export const tools = [
  {
    icon: "shield",
    title: "VPN Manager",
    desc: "NKN and Alliance OpenVPN profiles with merged CA certs handed to OpenVPN, plus live tunnel state monitoring.",
    tags: ["OpenVPN"],
    featured: true,
  },
  {
    icon: "activity",
    title: "TCP Counter",
    desc: "Gateway MAC-registration and the live campus TCP device count — captcha login handled natively.",
    tags: ["Gateway"],
  },
  {
    icon: "radar",
    title: "Network Dashboard",
    desc: "Ten service health probes, Skipole campus monitors and MRTG traffic graphs refreshing every 90 seconds.",
    tags: ["Skipole", "MRTG"],
  },
  {
    icon: "user",
    title: "ERP Profile",
    desc: "The MyProfile dashboard scraped into native cards — modules, personal details and persistent sessions.",
    tags: ["Dashboard"],
  },
  {
    icon: "download",
    title: "Download Manager",
    desc: "A persistent download history across every feature — resume-safe listing, MIME resolution, open with any app.",
    tags: ["Persistent"],
  },
  {
    icon: "wifi",
    title: "Campus Detection",
    desc: "SSID, IP-range and DNS-suffix heuristics know when you're on campus and when a VPN is needed — app-wide.",
    tags: ["Smart prompts"],
  },
];
