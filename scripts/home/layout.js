/**
 * home/layout.js — the Home arrangement model (ui/home/HomeLayout.kt,
 * HomeTileRegistry.kt, HomePresets.kt, HomeRendering.kt).
 *
 * Stored as the same JSON shape the app stores (schema 3), in
 * prefs.homeLayout. Every edit is a pure function returning a new layout,
 * then sanitized (unknown tiles dropped, duplicates removed) before saving.
 */

import { prefs } from "../core/prefs.js";

export const CURRENT_SCHEMA = 3;
export const MIN_COLUMNS = 2, MAX_COLUMNS = 4;
export const WIDGET_TODAY = "widget_today";
export const STYLES = ["GRID", "LIST", "COMPACT", "CAROUSEL"];
export const ACCENTS = ["DEFAULT", "PRIMARY", "SECONDARY", "TERTIARY"];

/** HomeTileRegistry.all, with the Material icon each tile draws. */
export const TILES = [
  ["mess_menu", "Mess Menu", "restaurant"],
  ["mess_transactions", "Mess Transactions", "receipt"],
  ["event_calendar", "Event Calendar", "celebration"],
  ["qr_billing", "QR Billing", "qr_code_scanner"],
  ["calendar", "Calendar", "calendar_month"],
  ["my_budget", "My Budget", "paid"],
  ["library", "Library", "local_library"],
  ["helpdesk", "Helpdesk", "support"],
  ["voip", "VoIP Directory", "phone"],
  ["chat", "Campus Chat", "chat_bubble"],
  ["research", "Research Papers", "science"],
  ["mess_recharge", "Mess Recharge", "credit_card"],
  ["welearn", "WeLearn", "school"],
  ["teaching_plans", "Teaching Plans", "menu_book"],
  ["course_selection", "Course Selection", "menu_book"],
  ["timetable", "Timetable", "schedule"],
  ["course_material", "Course Material", "folder"],
  ["academic_calendar", "Academic Calendar", "event_note"],
  ["grade_card", "Grade Card", "grade"],
  ["pyq", "PYQs", "quiz"],
  ["attendance", "Attendance", "fact_check"],
  ["website", "Website", "language"],
  ["vpn", "VPN", "vpn_key"],
  ["tcp_count", "TCP Count", "network_check"],
  ["network_status", "Network Status", "speed"],
  ["sftp", "SFTP", "storage"],
  ["profile", "My Profile", "person"],
  ["downloads", "Downloads", "cloud_download"],
  ["reset_password", "Reset Password", "lock"],
  ["reminders", "Reminders", "alarm"],
  ["notes", "Notes", "edit_note"],
  ["timer", "Timer", "timer"],
  ["stopwatch", "Stopwatch", "av_timer"],
  ["focus", "Focus", "self_improvement"],
  ["planner", "Planner", "checklist"],
  ["my_calendar", "My Calendar", "edit_calendar"],
  ["home_customize", "Customize Home", "tune"],
  [WIDGET_TODAY, "Today at a glance", "today", true],
  ["widget_agenda", "Today's agenda", "event", true],
  ["widget_reminders", "Next reminders", "notifications", true],
  ["widget_timer", "Active timer", "timer", true],
  ["widget_notes", "Recent notes", "sticky_note_2", true],
].map(([id, label, icon, widget]) => ({ id, label, icon, isWidget: !!widget }));

export const TILE_BY_ID = Object.fromEntries(TILES.map((t) => [t.id, t]));
export const TILE_IDS = new Set(TILES.map((t) => t.id));

/** SFTP is offered only where the app's "SFTP file manager" switch is on. */
export const availableTileIds = (sftpEnabled) => new Set([...TILE_IDS].filter((id) => id !== "sftp" || sftpEnabled));

const item = (id, wide = false) => ({ id, wide });
const section = (o) => ({ items: [], custom: false, style: "GRID", columns: 3, accent: "DEFAULT", hidden: false, collapsed: false, showTitle: true, ...o });

export const todaySection = () => section({ id: "today", title: "Today", items: [item(WIDGET_TODAY)], showTitle: false });

export function defaultHomeLayout() {
  return {
    schema: CURRENT_SCHEMA,
    sections: [
      todaySection(),
      section({ id: "campus_life", title: "Campus Life", items: [
        item("mess_menu", true), item("mess_transactions", true), item("event_calendar"), item("qr_billing"),
        item("calendar"), item("my_budget"), item("library"), item("helpdesk"), item("voip"), item("chat"),
        item("research"), item("mess_recharge")] }),
      section({ id: "academics", title: "Academics", items: ["welearn", "teaching_plans", "course_selection", "timetable",
        "course_material", "academic_calendar", "grade_card", "pyq", "attendance"].map((i) => item(i)) }),
      section({ id: "productivity", title: "Productivity", items: ["reminders", "notes", "timer", "stopwatch", "focus",
        "planner", "my_calendar"].map((i) => item(i)) }),
      section({ id: "tools_network", title: "Tools & Network", items: ["website", "vpn", "tcp_count", "network_status", "sftp",
        "profile", "downloads", "reset_password", "home_customize"].map((i) => item(i)) }),
    ],
    seenTileIds: [...TILE_IDS],
  };
}

const allTilesSeen = (l) => ({ ...l, seenTileIds: [...TILE_IDS] });
const defaultItems = (id) => defaultHomeLayout().sections.find((s) => s.id === id).items;
const plainTileIds = () => TILES.filter((t) => !t.isWidget).map((t) => t.id);

export const PRESETS = [
  { id: "classic", name: "Classic", description: "The shipped arrangement: Campus Life, Academics, Productivity and Tools & Network.", build: defaultHomeLayout },
  { id: "focused", name: "Focused", description: "Today at a glance, then the handful of tiles used every day in one grid. Everything else sits compactly below.",
    build() {
      const daily = [item("mess_menu", true), item("mess_transactions", true), item("timetable"), item("welearn"), item("chat"), item("reminders"), item("planner")];
      const ids = new Set(daily.map((d) => d.id));
      return allTilesSeen({ schema: CURRENT_SCHEMA, sections: [todaySection(),
        section({ id: "daily", title: "Daily", items: daily, style: "GRID", columns: 3 }),
        section({ id: "more", title: "More", items: plainTileIds().filter((i) => !ids.has(i)).map((i) => item(i)), style: "COMPACT" })] });
    } },
  { id: "academic", name: "Academic", description: "Academics first, with your agenda beside Productivity. Campus life and tools follow in compact rows.",
    build() {
      return allTilesSeen({ schema: CURRENT_SCHEMA, sections: [todaySection(),
        section({ id: "academics", title: "Academics", items: defaultItems("academics"), style: "GRID", columns: 3 }),
        section({ id: "productivity", title: "Productivity", items: [item("widget_agenda"), ...defaultItems("productivity")], style: "LIST" }),
        section({ id: "campus_life", title: "Campus Life", items: defaultItems("campus_life"), style: "COMPACT" }),
        section({ id: "tools_network", title: "Tools & Network", items: defaultItems("tools_network"), style: "COMPACT" })] });
    } },
  { id: "minimal", name: "Minimal", description: "Today at a glance and five essentials in a single list.",
    build() {
      return allTilesSeen({ schema: CURRENT_SCHEMA, sections: [todaySection(),
        section({ id: "essentials", title: "Essentials", items: ["mess_menu", "welearn", "timetable", "chat", "home_customize"].map((i) => item(i)), style: "LIST" })] });
    } },
];

/* ── codec: decode → migrate → withNewTiles → sanitize ── */
export function sanitized(l) {
  const seen = new Set(), ids = new Set();
  return { ...l, sections: l.sections.filter((s) => (ids.has(s.id) ? false : (ids.add(s.id), true))).map((s) => ({
    ...section(s), items: (s.items || []).filter((i) => TILE_IDS.has(i.id) && (seen.has(i.id) ? false : (seen.add(i.id), true))).map((i) => item(i.id, !!i.wide)),
  })) };
}
function migrated(l) {
  if ((l.schema || 0) >= CURRENT_SCHEMA) return l;
  const hasToday = l.sections.some((s) => s.items.some((i) => i.id === WIDGET_TODAY));
  return { ...l, schema: CURRENT_SCHEMA, sections: (l.schema || 0) >= 2 || hasToday ? l.sections : [todaySection(), ...l.sections], seenTileIds: [...TILE_IDS] };
}
function withNewTiles(l) {
  const seen = new Set(l.seenTileIds || []);
  const unseen = TILES.filter((t) => !seen.has(t.id));
  if (!unseen.length) return l;
  const defaults = defaultHomeLayout();
  let result = l;
  const placed = new Set(l.sections.flatMap((s) => s.items.map((i) => i.id)));
  for (const t of unseen) {
    if (t.isWidget || placed.has(t.id)) continue;
    const natural = defaults.sections.find((d) => d.items.some((i) => i.id === t.id))?.id;
    const target = result.sections.find((s) => s.id === natural && !s.hidden) || [...result.sections].reverse().find((s) => !s.hidden);
    if (!target) {
      const nt = result.sections.find((s) => s.id === "new_tiles");
      result = nt ? update(result, "new_tiles", (s) => ({ ...s, items: [...s.items, item(t.id)], hidden: false }))
        : { ...result, sections: [...result.sections, section({ id: "new_tiles", title: "New", items: [item(t.id)], custom: true })] };
    } else result = update(result, target.id, (s) => ({ ...s, items: [...s.items, item(t.id)] }));
    placed.add(t.id);
  }
  return { ...result, seenTileIds: [...seen, ...unseen.map((t) => t.id)] };
}
export function decodeOrDefault(raw) {
  if (!raw || !Array.isArray(raw.sections)) return defaultHomeLayout();
  try { return sanitized(withNewTiles(migrated(raw))); } catch { return defaultHomeLayout(); }
}

export const loadLayout = () => decodeOrDefault(prefs.get("homeLayout"));
/** Read-modify-write the stored layout (HomeViewModel.editHomeLayout). */
export function editLayout(op) {
  const next = sanitized(op(loadLayout()));
  prefs.set("homeLayout", next);
  return next;
}

/* ── edits (HomeLayout.kt extension functions) ── */
const update = (l, id, fn) => ({ ...l, sections: l.sections.map((s) => (s.id === id ? fn(s) : s)) });
const moveIn = (arr, from, to) => { const a = arr.slice(); a.splice(to, 0, a.splice(from, 1)[0]); return a; };

export const ops = {
  moveSection(l, id, delta) {
    const i = l.sections.findIndex((s) => s.id === id), t = i + delta;
    return i < 0 || t < 0 || t >= l.sections.length ? l : { ...l, sections: moveIn(l.sections, i, t) };
  },
  moveSectionToEdge(l, id, toTop) {
    const i = l.sections.findIndex((s) => s.id === id), e = toTop ? 0 : l.sections.length - 1;
    return i < 0 || i === e ? l : { ...l, sections: moveIn(l.sections, i, e) };
  },
  rename: (l, id, title) => (title.trim() ? update(l, id, (s) => ({ ...s, title: title.trim() })) : l),
  deleteSection: (l, id) => ({ ...l, sections: l.sections.filter((s) => s.id !== id) }),
  addSection: (l, id, title) => ({ ...l, sections: [...l.sections, section({ id, title: title.trim() || "New section", custom: true })] }),
  addTile: (l, id, tileId) => update(l, id, (s) => ({ ...s, items: [...s.items, item(tileId)] })),
  removeTile: (l, id, tileId) => update(l, id, (s) => ({ ...s, items: s.items.filter((i) => i.id !== tileId) })),
  moveTile(l, id, tileId, delta) {
    return update(l, id, (s) => {
      const i = s.items.findIndex((x) => x.id === tileId), t = i + delta;
      return i < 0 || t < 0 || t >= s.items.length ? s : { ...s, items: moveIn(s.items, i, t) };
    });
  },
  moveTileToEdge(l, id, tileId, toTop) {
    return update(l, id, (s) => {
      const i = s.items.findIndex((x) => x.id === tileId), e = toTop ? 0 : s.items.length - 1;
      return i < 0 || i === e ? s : { ...s, items: moveIn(s.items, i, e) };
    });
  },
  moveTileToSection(l, from, tileId, to) {
    if (from === to) return l;
    const src = l.sections.find((s) => s.id === from); const it = src && src.items.find((i) => i.id === tileId);
    if (!it || !l.sections.some((s) => s.id === to)) return l;
    return { ...l, sections: l.sections.map((s) => {
      const without = s.items.filter((i) => i.id !== tileId);
      return s.id === to ? { ...s, items: [...without, it] } : { ...s, items: without };
    }) };
  },
  setTileWide: (l, id, tileId, wide) => update(l, id, (s) => ({ ...s, items: s.items.map((i) => (i.id === tileId ? { ...i, wide } : i)) })),
  setStyle: (l, id, style) => update(l, id, (s) => ({ ...s, style })),
  setColumns: (l, id, c) => update(l, id, (s) => ({ ...s, columns: Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, c)) })),
  setAccent: (l, id, accent) => update(l, id, (s) => ({ ...s, accent })),
  setHidden: (l, id, hidden) => update(l, id, (s) => ({ ...s, hidden })),
  setCollapsed: (l, id, collapsed) => update(l, id, (s) => ({ ...s, collapsed })),
  setShowTitle: (l, id, showTitle) => update(l, id, (s) => ({ ...s, showTitle })),
};

export const unplacedTileIds = (l, sftpEnabled) => {
  const placed = new Set(l.sections.flatMap((s) => s.items.map((i) => i.id)));
  return TILES.filter((t) => !placed.has(t.id) && availableTileIds(sftpEnabled).has(t.id)).map((t) => t.id);
};
export const columnsClamped = (s) => Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, s.columns || 3));
export const isExpandedOnHome = (s) => !s.showTitle || !s.collapsed;

/** HomeCustomizeScreen.sectionSummary */
export function sectionSummary(s) {
  const cards = s.items.filter((i) => TILE_BY_ID[i.id]?.isWidget).length;
  const tiles = s.items.length - cards;
  const style = tiles === 0 ? null : { GRID: `Grid · ${columnsClamped(s)} columns`, LIST: "List", COMPACT: "Compact", CAROUSEL: "Carousel" }[s.style];
  const accent = s.accent === "DEFAULT" || tiles === 0 ? null : accentLabel(s.accent);
  const contents = [];
  if (tiles > 0) contents.push(tiles === 1 ? "1 tile" : `${tiles} tiles`);
  if (cards > 0) contents.push(cards === 1 ? "1 live card" : `${cards} live cards`);
  if (!contents.length) contents.push("empty");
  const flags = [];
  if (!s.showTitle) flags.push("no title");
  if (s.collapsed && s.showTitle) flags.push("collapsed");
  return [style, accent, ...contents, ...flags].filter(Boolean).join("  ·  ");
}
export const accentLabel = (a) => ({ DEFAULT: "Default", PRIMARY: "Primary", SECONDARY: "Secondary", TERTIARY: "Tertiary" }[a] || "Default");

/** HomeRendering.renderGroups: wide tiles pair up in rows of two; widgets stand alone. */
export function renderGroups(items, wideAllowed) {
  const groups = [];
  let wide = [], flow = [];
  const flushWide = () => { for (let i = 0; i < wide.length; i += 2) groups.push({ kind: "wide", tiles: wide.slice(i, i + 2) }); wide = []; };
  const flushFlow = () => { if (flow.length) groups.push({ kind: "flow", tiles: flow }); flow = []; };
  for (const it of items) {
    if (it.tile.isWidget) { flushWide(); flushFlow(); groups.push({ kind: "widget", tile: it.tile }); }
    else if (wideAllowed && it.wide) { flushFlow(); wide.push(it.tile); }
    else { flushWide(); flow.push(it.tile); }
  }
  flushWide(); flushFlow();
  return groups;
}
/** COMPACT chips per row from the available width (80dp each, 3–6). */
export const compactColumns = (widthPx) => Math.max(3, Math.min(6, Math.floor(widthPx / 80)));
