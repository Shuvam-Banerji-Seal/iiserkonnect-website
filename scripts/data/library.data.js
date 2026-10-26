/**
 * data/library.data.js — the Library screen's data.
 *
 * Catalogue search runs against the campus OPAC when this browser can reach
 * it (dataSource "auto"); otherwise, and whenever that fails, the search runs
 * over the bundled sample catalogue. New arrivals come from the sample only.
 * Static option lists and the e-resource links come from LibraryResources.kt
 * and the library service companion.
 */

import { sample } from "../services/source.js";
import { search as liveSearch } from "../services/library.service.js";
import { sampleOnly } from "../core/net.js";

/* ── option lists (LibraryCatalogService companion) ───────────── */
export const SEARCH_FIELDS = [
  ["text", "Any Field"], ["t", "Title"], ["a", "Author"], ["s", "Subject"], ["isbn", "ISBN"],
  ["call_number", "Call Number"], ["p", "Publisher"], ["tse", "Series Title"],
];
export const SORT_OPTIONS = [
  ["relevance", "Relevance"], ["newly_added", "Recently added"], ["title", "Title A-Z"], ["author", "Author A-Z"],
  ["publishdate_desc", "Newest first"], ["publishdate_asc", "Oldest first"], ["call_number", "Call number"],
];
export const ITEM_CLASSES = [[null, "All"], ["1", "Books"], ["108", "Reference"], ["100", "Bound Volumes"], ["109", "Audio Visual"]];
export const LANGUAGES = [
  [null, "Any language"], ["eng", "English"], ["hin", "Hindi"], ["ben", "Bengali"], ["san", "Sanskrit"], ["fre", "French"],
  ["ger", "German"], ["ita", "Italian"], ["spa", "Spanish"], ["por", "Portuguese"],
];
export const FORMATS = [
  [null, "All formats"], ["book", "Books"], ["book.ebook", "eBooks"], ["serial", "Serials"], ["movies", "Movies"],
  ["movies.dvd", "DVDs"], ["computer_games", "Computer Games"],
];
export const MATERIAL_TYPES = [
  ["Book", "BOOK"], ["Serial (journal)", "SERIAL"], ["Computer File", "COMPUTER_FILE"], ["Music", "MUSIC"],
  ["Map", "MAP"], ["Visual Material", "VISUAL_MATERIAL"], ["Mixed Material", "MIXED_MATERIAL"],
];

/* ── LibraryResources.kt (verbatim) ───────────────────────────── */
const P = "http://intranet.iiserkol.ac.in/wiki/Library:";
export const SUBJECT_GUIDES = [
  { name: "Biological Sciences", url: P + "Biological_Sciences", description: "Journals, databases and resources for bio" },
  { name: "Chemical Sciences", url: P + "Chemical_Sciences", description: "Chemistry journals, databases, question papers" },
  { name: "Earth Sciences", url: P + "Earth_Sciences", description: "Earth science resources and question papers" },
  { name: "Mathematics & Statistics", url: P + "Mathematics_and_Statistics", description: "Math databases, e-books, journals" },
  { name: "Physical Sciences", url: P + "Physical_Sciences", description: "Physics resources and question papers" },
  { name: "Google Scholar Guide", url: P + "Google_Scholar", description: "How to use Google Scholar effectively" },
];
export const E_RESOURCES = [
  { name: "Elsevier Journals", url: P + "Complimentary_Access_:_Elsevier_Journals", category: "Journals" },
  { name: "Wiley Journals", url: P + "Journals-Wiley", category: "Journals" },
  { name: "Springer Journals", url: P + "Springer_Journals", category: "Journals" },
  { name: "ACM Digital Library", url: P + "ACM_Digital_Library", category: "Journals" },
  { name: "Royal Society of Chemistry", url: P + "Journal_:_Royal_Society_of_Chemistry", category: "Journals" },
  { name: "AMS Journals", url: P + "Journal_:_American_Mathematical_Society", category: "Journals" },
  { name: "SIAM (with LOCUS archive)", url: P + "New_Journal_:_SIAM", category: "Journals", note: "1953–current" },
  { name: "IOP Archive", url: P + "Journal_Archive_:_IOP", category: "Archives" },
  { name: "AIP Digital Archive", url: P + "New_Journal_Archive_:_AIP", category: "Archives" },
  { name: "Oxford Science Archive", url: P + "New_Journal_Archive:Oxford_Science", category: "Archives", note: "1878–1995" },
  { name: "Cambridge Univ. Press Archive (Math & CS)", url: P + "New_Archive:Cambridge_University_Press_:_Mathematics_and_Computer_Science", category: "Archives", note: "1883–2009" },
  { name: "Springer Archives (Math & Stats)", url: P + "New_Archive:Springer_:_Mathematics_and_Statistics", category: "Archives", note: "1858–1996" },
  { name: "Springer Archives (Physics & Astronomy)", url: P + "New_Archive:Springer_:_Physics_and_Astronomy", category: "Archives", note: "1843–1996" },
  { name: "Nature Publishing Group", url: P + "New_Journal/Archive:Nature_Publishing_Group", category: "Journals" },
  { name: "IEEE/IET Electronic Library (IEL)", url: P + "IEEE/IET_Electronic_Library", category: "Journals", note: "2005–current" },
  { name: "Institute of Mathematical Statistics", url: P + "Journal_:_Institute_of_Mathematical_Statistics", category: "Journals" },
  { name: "Applied Probability Trust", url: P + "Journal_:_Applied_Probability_Trust", category: "Journals" },
  { name: "Company of Biologists", url: P + "Journal_:_The_Company_of_Biologists", category: "Journals" },
  { name: "IMPAN (Polish Acad. Sciences)", url: P + "Journal_:_IMPAN", category: "Journals" },
  { name: "Turnitin", url: "https://www.turnitin.com", category: "Tools", note: "Plagiarism detection" },
  { name: "Cambridge Univ. Press Ebooks", url: P + "Cambridge_University_Press_Ebooks", category: "E-Books", note: "2015" },
  { name: "Springer Math & Stats Ebooks", url: P + "Springer_Mathematics_and_Statistics_E-books_(2024)", category: "E-Books", note: "2013–2024" },
  { name: "Oxford Univ. Press Math & Stats Ebooks", url: P + "Oxford_University_Press_Mathematics_and_Statistics_E-books_(Selected)", category: "E-Books" },
  { name: "SIAM E-Books", url: P + "New_E-Books:SIAM", category: "E-Books", note: "2011" },
  { name: "Wiley Math & Stats Ebooks", url: P + "New_E-Books:Wiley", category: "E-Books" },
  { name: "Lecture Notes in Computer Science", url: P + "Lecture_Notes_in_Computer_Science", category: "E-Books", note: "1973–current" },
  { name: "bioRxiv (Biological Sciences)", url: "https://biorxiv.org/", category: "Preprints" },
  { name: "arXiv (Physical Sciences)", url: "https://arxiv.org/", category: "Preprints" },
  { name: "Chemical Sciences Article Repository", url: "http://www.rsc.org/chemical-sciences-repository/articles/", category: "Preprints" },
  { name: "Union Catalogue of E-Resources", url: "http://library.iitgn.ac.in/unicat/", category: "Catalogues" },
  { name: "Free Journals: Earth Science", url: P + "Free_Journals_:_Earth_Science", category: "Free" },
  { name: "Free Journals: Mathematics", url: P + "Free_Journals_:_Mathematics", category: "Free" },
  { name: "Trial: QuillBot", url: "https://quillbot.com", category: "Trial", note: "Time-limited" },
  { name: "Trial: NPG Journals", url: P + "Announcement:_Trial_Access", category: "Trial", note: "Time-limited" },
  { name: "Summon Discovery", url: "http://iiser.summon.serialssolutions.com/", category: "Tools" },
];
export const PYQ_YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

/* ── data access ──────────────────────────────────────────────── */
const toBook = (r) => ({
  title: r.title || "", author: r.author || "", callNumber: r.callNumber || "", itemUrl: r.itemUrl || r.url || "",
  isbn: r.isbn || "", publication: r.publication || "", availabilityText: r.availabilityText || "",
  availableCopies: r.availableCopies ?? -1, totalCopies: r.totalCopies ?? -1,
  isAvailable: r.availableCopies == null || r.availableCopies < 0 ? null : r.availableCopies > 0,
  subjects: r.subjects || [], notes: r.notes || "", copies: r.copies || [],
  itemClass: r.itemClass || "", language: r.language || "", format: r.format || "",
});

export async function loadNewArrivals() {
  const s = await sample("library");
  return { data: s.newArrivals.map(toBook), sample: true };
}

/** Catalogue search. Live first when the browser may try it; otherwise sample. */
export async function searchCatalogue(term, { field = "text" } = {}) {
  const t = term.trim();
  if (!sampleOnly()) {
    try {
      const rows = await liveSearch(t);
      return { results: rows.map(toBook), sample: false };
    } catch { /* fall through to the sample catalogue */ }
  }
  const s = await sample("library");
  const needle = t.toLowerCase();
  const key = { text: ["title", "author", "callNumber", "publication"], t: ["title"], a: ["author"], s: ["subjects"], isbn: ["isbn"], call_number: ["callNumber"], p: ["publication"], tse: ["title"] }[field] || ["title", "author", "callNumber", "publication"];
  const hit = (b) => key.some((k) => {
    const v = b[k];
    return Array.isArray(v) ? v.some((x) => x.toLowerCase().includes(needle)) : String(v || "").toLowerCase().includes(needle);
  });
  return { results: s.catalogue.filter(hit).map(toBook), sample: true };
}

export const bookId = (b) => b.itemUrl || b.title;
