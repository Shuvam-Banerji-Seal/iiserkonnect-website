/**
 * data/helpdesk.data.js — Helpdesk categories (ui/helpdesk/HelpdeskScreen.kt).
 * Categories are hardcoded in the Android app; the links are the campus
 * ticket pages, opened by the user in a new tab.
 */

const B = "https://intranet.iiserkol.ac.in";

export const HELPDESK_CATEGORIES = [
  { name: "Computing", description: "Hardware, software, network issues", url: `${B}/help-computing`, icon: "computer" },
  { name: "Academic", description: "Course, enrollment, exam issues", url: `${B}/help-academic`, icon: "school" },
  { name: "AC", description: "Air conditioner complaints", url: `${B}/help-electrical/newticket?component=Air+Conditioner+%28AC+Related+Issues%29%2FEmergency+Complaints`, icon: "ac_unit" },
  { name: "Electrical", description: "Power, lighting, electrical issues", url: `${B}/help-electrical`, icon: "electrical_services" },
  { name: "Civil", description: "Building, plumbing, structural issues", url: `${B}/help-civil`, icon: "construction" },
  { name: "Housekeeping", description: "Cleaning, waste management", url: `${B}/help-civil/newticket?component=Housekeeping%2FCleaning`, icon: "cleaning_services" },
  { name: "Horticulture", description: "Garden, grounds maintenance", url: `${B}/help-civil/newticket?component=Horticulture`, icon: "grass" },
  { name: "Dry Waste", description: "Waste disposal and recycling", url: `${B}/help-civil/newticket?component=Dry+Waste+Management`, icon: "delete" },
];
