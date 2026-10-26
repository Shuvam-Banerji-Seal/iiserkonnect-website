/**
 * home/greeting.js — the greeting header's words (HomeViewModel.greetingWord,
 * contextCodeFor): a time-of-day greeting and a "code" naming the moment,
 * rotated through each bucket by day of the year so it changes day to day
 * without ever being random.
 */

export function greetingWord(hour) {
  if (hour <= 4) return "Good night";
  if (hour <= 11) return "Good morning";
  if (hour <= 16) return "Good afternoon";
  return "Good evening";
}

export const greetingTitle = (hour, name) => (name ? `${greetingWord(hour)}, ${name}!` : `${greetingWord(hour)}!`);

const CODES = {
  LATE_NIGHT: [
    ["Midnight Oil", "Burning the midnight oil? Don't forget to sleep."],
    ["Small Hours", "The small hours belong to problem sets and bad ideas."],
    ["Night Shift", "Night shift on campus. Hydrate, then continue."],
    ["Quiet Hours", "Everyone's asleep. Perfect focus, terrible bedtime."],
    ["Last Push", "One last push, then actually close the laptop."],
  ],
  PRE_DAWN: [
    ["Pre-Dawn", "Up before the sun — early start today."],
    ["First Light", "First light over the lake. You have the campus to yourself."],
    ["Dawn Patrol", "Dawn patrol. The library will be empty for once."],
  ],
  EARLY_MORNING: [
    ["Morning Brief", "Have a great day ahead — check your timetable before you leave."],
    ["Slow Start", "Breakfast first, lecture notes second."],
    ["Fresh Slate", "Fresh slate today. Pick the hard thing first."],
    ["Roll Call", "Classes soon — attendance counts more than you'd like."],
  ],
  MORNING_PUSH: [
    ["Deep Work", "Prime focus hours — spend them on the hard problem."],
    ["Lecture Run", "Back-to-back lectures? Keep a water bottle handy."],
    ["Momentum", "Good momentum. Don't break it for the group chat."],
    ["Clear Desk", "Clear the small tasks now, protect the afternoon."],
  ],
  AFTERNOON_LULL: [
    ["Afternoon Lull", "Afternoon lull — a walk around the lake helps."],
    ["Post-Lunch Dip", "Post-lunch dip is real. Ten minutes outside beats coffee."],
    ["Lab Hours", "Lab hours. Label everything, future-you is forgetful."],
    ["Second Wind", "Second wind incoming. Revisit whatever you shelved."],
  ],
  EVENING: [
    ["Evening Grind", "Evening grind — deadlines first, then everything else."],
    ["Wind Down", "Wrap the day: one deadline checked off, then rest."],
    ["Mess Run", "Mess closes sooner than you think."],
    ["Study Block", "Quiet study block. Phone face-down helps."],
  ],
  MIDWEEK: [
    ["Midweek Grind", "Midweek grind — deadlines first, then everything else."],
    ["Steady State", "Steady state. Keep chipping at the long assignment."],
    ["Halfway", "Halfway through the week — check what's due Friday."],
    ["Catch Up", "Good window to catch up on whatever slipped Monday."],
  ],
  FRIDAY_EVENING: [
    ["Friday Release", "Weekend's here — nice work making it through the week."],
    ["Clock Out", "Clocked out. The problem set can wait until tomorrow."],
    ["Campus Friday", "Campus Friday. Something's usually happening somewhere."],
  ],
  SATURDAY: [
    ["Slow Saturday", "It's Saturday — enjoy the slower campus morning."],
    ["Free Format", "No timetable today. Use it on the thing you keep postponing."],
    ["Lake Day", "Good day for the lake, or the library. Both are valid."],
  ],
  SUNDAY: [
    ["Sunday Setup", "Sunday! A good day to get ahead on the week."],
    ["Reset", "Reset day: laundry, notes, and next week's deadlines."],
    ["Prep Window", "Look at Monday now so Monday doesn't look at you."],
  ],
};

export function bucketFor(d) {
  const hour = d.getHours(), dow = d.getDay();
  if (hour >= 23 || hour < 4) return "LATE_NIGHT";
  if (hour >= 4 && hour <= 5) return "PRE_DAWN";
  if (dow === 6) return "SATURDAY";
  if (dow === 0) return "SUNDAY";
  if (dow === 5 && hour >= 17) return "FRIDAY_EVENING";
  if (hour < 9) return "EARLY_MORNING";
  if (hour >= 13 && hour <= 15) return "AFTERNOON_LULL";
  if (hour >= 20) return "EVENING";
  if (hour >= 9 && hour <= 12) return "MORNING_PUSH";
  return "MIDWEEK";
}

const dayOfYear = (d) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);

export function contextCodeFor(d = new Date()) {
  const variants = CODES[bucketFor(d)];
  const [label, line] = variants[dayOfYear(d) % variants.length];
  return { label, line };
}
