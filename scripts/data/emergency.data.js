/**
 * data/emergency.data.js — Emergency contacts (ui/emergency/EmergencyScreen.kt).
 *
 * Public national numbers are listed in full. The campus section comes from a
 * live wiki page on the Android app; this build does not include those numbers,
 * so they are shown as placeholders rather than guessed.
 */

export const NATIONAL_CONTACTS = [
  { role: "Police", phone: "100" },
  { role: "Fire", phone: "101" },
  { role: "Ambulance", phone: "102" },
  { role: "Emergency (all services)", phone: "112" },
  { role: "Women helpline", phone: "1091" },
  { role: "Child helpline", phone: "1098" },
  { role: "Disaster management", phone: "108" },
];
