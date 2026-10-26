/**
 * data/profile.data.js — ERP profile pages (ui/profile/ProfileSchema.kt).
 *
 * The ERP dashboard sits behind a campus sign-in that a browser on another
 * site cannot complete, so every copy shown here is sample data
 * (data/samples/profile.json). Editing is not offered: changes would have to
 * be saved on the ERP website itself.
 */

import { load } from "../services/source.js";

export const ERP_LOGIN_URL = "https://www.iiserkol.ac.in/myprofile/ldap/login/?next=/myprofile/dashboard/";
export const ERP_DASHBOARD_URL = "https://www.iiserkol.ac.in/myprofile/dashboard/";

/** ProfileSchema.sections — the "Your details" groups, in the app's order. */
export const PROFILE_SECTIONS = [
  { title: "Identity", blurb: "Who the register says you are", slugs: ["home", "personal", "photo"] },
  { title: "Contact", blurb: "Where to reach you, and where you live", slugs: ["contact", "present_address", "permanent_address"] },
  { title: "Education", blurb: "Schooling and what you have paid the institute", slugs: ["education10", "education12", "registration_fees"] },
  { title: "Family", blurb: "The people listed against your record", slugs: ["father_mother", "guardian"] },
  { title: "Finance & documents", blurb: "Where money goes, and what proves it", slugs: ["bank_account", "aadhaar", "pwd"] },
  {
    title: "Work & research", blurb: "Projects, publications, patents and proceedings",
    slugs: ["summer_project", "article", "book", "book_chapter", "book_review", "conf_proceeding", "patent", "other_publication"],
  },
];

const TITLES = {
  home: "Summary", personal: "Personal", photo: "Photo", registration_fees: "Registration fees",
  summer_project: "Projects", article: "Publications", book: "Books", book_chapter: "Book chapters",
  book_review: "Book reviews", conf_proceeding: "Conference proceedings", patent: "Patents",
  other_publication: "Other publications", permanent_address: "Permanent address", present_address: "Present address",
  contact: "Contact", education10: "Education · Class 10", education12: "Education · Class 12",
  father_mother: "Father / Mother", guardian: "Guardian", bank_account: "Bank account", aadhaar: "Aadhaar", pwd: "Disability",
};

/** Pages the app edits on the ERP (ProfileSchema.forms). */
const EDITABLE = ["permanent_address", "present_address", "contact", "education10", "education12",
  "father_mother", "guardian", "bank_account", "aadhaar", "pwd"];

export const titleFor = (slug) => TITLES[slug] || "";
export const isEditable = (slug) => EDITABLE.includes(slug);

/** The ERP dashboard and its pages: always sample in a browser. */
export function loadErp() {
  return load("profile");
}
