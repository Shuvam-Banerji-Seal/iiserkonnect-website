/**
 * ui/markdown.js — the small Markdown subset chat renders
 * (components/MarkdownText.kt): headings, bold, italic, strike, inline code,
 * fenced code, links, bullet / numbered lists, quotes. Everything is escaped
 * first, so a message can never inject markup.
 */

import { esc } from "./dom.js";

function inline(s) {
  let t = esc(s);
  const codes = [];
  t = t.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  t = t.replace(/\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`);
  t = t.replace(/(\*\*|__)(.+?)\1/g, "<strong>$2</strong>");
  t = t.replace(/~~(.+?)~~/g, "<del>$1</del>");
  t = t.replace(/(^|[^\w*])([*_])(?!\s)(.+?)(?<!\s)\2(?![\w*])/g, "$1<em>$3</em>");
  t = t.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (_, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>`);
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
}

export function renderMarkdown(src) {
  const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      closeList();
      const body = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) body.push(lines[i]);
      out.push(`<pre><code>${esc(body.join("\n"))}</code></pre>`);
      continue;
    }
    let m;
    if ((m = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line))) { closeList(); out.push(`<p class="md-h md-h${m[1].length}">${inline(m[2])}</p>`); continue; }
    if ((m = /^\s{0,3}>\s?(.*)$/.exec(line))) { closeList(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
    if ((m = /^\s{0,3}[-*+]\s+(.*)$/.exec(line))) { if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = /^\s{0,3}\d+[.)]\s+(.*)$/.exec(line))) { if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    closeList();
    out.push(line.trim() ? `<p>${inline(line)}</p>` : "");
  }
  closeList();
  return out.join("");
}
