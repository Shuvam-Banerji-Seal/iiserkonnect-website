/**
 * data/schedule.data.js — class timetable. The Android app downloads the
 * official timetable PDF; a browser cannot read it from the campus site, so
 * the weekly grid is made-up sample data only.
 */

import { load } from "../services/source.js";

/** { slots: [{ day (1 = Mon … 5 = Fri), start, end, code, title, room, type }] } */
export const loadTimetable = () => load("schedule");

export const hm = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
