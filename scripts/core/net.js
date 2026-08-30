/**
 * core/net.js — campus fetch with static-data fallback.
 * Direct browser fetch when on campus; same-origin JSON when off-campus
 * or when CORS blocks. No backend at runtime.
 */

export const C = {
  WELEARN: "https://welearn.iiserkol.ac.in",
  WELEARN_LOGIN: "https://welearn.iiserkol.ac.in/login/index.php",
  WELEARN_MY: "https://welearn.iiserkol.ac.in/my/",
  WELEARN_MYPROFILE: "https://welearn.iiserkol.ac.in/myprofile/",
  WELEARN_MYPROFILE_LOGIN: "https://welearn.iiserkol.ac.in/myprofile/login/",
  WELEARN_MYPROFILE_GRADES: "https://welearn.iiserkol.ac.in/myprofile/grade_card/",
  ERP: "https://www.iiserkol.ac.in",
  ERP_LOGIN: "https://www.iiserkol.ac.in/myprofile/ldap/login/?next=/myprofile/dashboard/",
  ERP_DASHBOARD: "https://www.iiserkol.ac.in/myprofile/dashboard/",
  CANTEEN: "https://newsmerp.iiserkol.ac.in",
  CANTEEN_LOGIN: "https://newsmerp.iiserkol.ac.in/login/",
  CANTEEN_MINI: "https://newsmerp.iiserkol.ac.in/canteen/UserMinistatement/",
  CANTEEN_MENU: "https://newsmerp.iiserkol.ac.in/canteen/",
  CALENDAR: "https://calendar.iiserkol.ac.in",
  EVENTS_CAL: "https://calendar.iiserkol.ac.in/calendar_view/",
  INTRANET: "http://intranet.iiserkol.ac.in",
  WIKI: "http://intranet.iiserkol.ac.in/wiki",
  LIBRARY_HOME: "http://intranet.iiserkol.ac.in/wiki/Library:Home",
  STUDENT_NOTICES: "http://intranet.iiserkol.ac.in/wiki/GenNotice:Students%27Notice_Board",
  ADMIN_NOTICES: "http://intranet.iiserkol.ac.in/wiki/GenNotice:Administration_Notice_Board",
  GW: "https://gw.iiserkol.ac.in",
  MACREG: "https://gw.iiserkol.ac.in/macreg/",
  EPRINTS: "http://eprints.iiserkol.ac.in",
  LIBCAT: "http://lib.iiserkol.ac.in:9000",
  VOIP: "https://www.iiserkol.ac.in/voip-directory/",
  TIMETABLE_PDF: "https://www.iiserkol.ac.in/web/assets/images/ck_editor_image/1769612117_Time-Table-Spring-2026_28.01.2026.pdf",
};

const FALLBACKS = [
  [/welearn.*\/my\//, "data/welearn.json"],
  [/welearn.*course\/view/, "data/welearn.json"],
  [/welearn.*myprofile\/grade/, "data/welearn.json"],
  [/newsmerp.*canteen\/UserMinistatement/, "data/mess.json"],
  [/newsmerp.*canteen\//, "data/menu.json"],
  [/newsmerp.*login/, "data/mess.json"],
  [/calendar\.iiserkol/, "data/calendar.json"],
  [/intranet.*GenNotice/, "data/notices.json"],
  [/intranet.*Library:Home/, "data/pyq.json"],
  [/intranet.*Old_Question_Papers/, "data/pyq.json"],
  [/eprints\.iiserkol/, "data/research.json"],
  [/lib\.iiserkol/, "data/library.json"],
  [/voip-directory/, "data/voip.json"],
  [/gw\.iiserkol.*live/, "data/netmon.json"],
  [/gw\.iiserkol.*mrtg/, "data/netmon.json"],
  [/gw\.iiserkol.*macreg/, "data/netmon.json"],
];

async function tryFallback(url) {
  for (const [re, path] of FALLBACKS) {
    if (re.test(url)) {
      try {
        const r = await fetch(path, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          // Generate HTML from JSON so existing parsers work without changes
          let html = "";
          if (path.includes("welearn.json")) {
            html = `<html><body><a href="/login/logout.php">Logout</a>` +
              (j.courses || []).map(c => `<a class="list-group-item list-group-item-action" href="${c.url}">${c.title}</a>`).join("") +
              `</body></html>`;
            // For course files, check if url is for a specific course
            if (/course\/view/.test(url) && j.files) {
              const id = (url.match(/[?&]id=(\d+)/) || [])[1];
              const files = id && j.files[id] ? j.files[id] : [];
              html = `<html><body>` + files.map(f =>
                f.kind === "folder"
                  ? `<a href="${f.url}">${f.name}</a>`
                  : f.url.includes("pluginfile") ? `<a href="${f.url}">${f.name}</a>` : `<a href="${f.url}">${f.name}</a>`
              ).join("") + `</body></html>`;
            }
          } else if (path.includes("mess.json")) {
            html = `<html><body><table><tr><th>Food Taken</th></tr>` +
              (j.transactions || []).map(t =>
                `<tr><td>${t.foodItems}</td><td>${t.totalCost}</td><td>${t.type}</td><td>${t.balanceAdded}</td><td>${t.modeOfTran}</td><td>${t.balance}</td><td>${t.dateTime}</td><td>${t.remarks}</td></tr>`
              ).join("") + `</table></body></html>`;
          } else if (path.includes("menu.json")) {
            html = `<html><body><div class="tmenucon"><div class="headerText">${j.title || "Today's Menu"}</div><table>` +
              (j.meals || []).map(m =>
                `<tr bgcolor="#b8d1f3"><td>${m.type}:</td></tr>` +
                m.items.map(i => `<tr bgcolor="#dae5f4"><td>${i.startsWith("★") ? `<div class="blink_me">${i.slice(2)}</div>` : i}</td></tr>`).join("")
              ).join("") + `</table></div></body></html>`;
          } else if (path.includes("calendar.json")) {
            const cal = j.academic || j.events || j;
            const days = (cal.days || []).map(d => `<th class="${d.today ? "mon today" : "mon"}"><a>${d.day}<br/>${d.date}</a></th>`).join("");
            const rows = `<tr><th class="empty"></th>${days}</tr><tr></tr>` +
              [...new Set((cal.events || []).map(e => e.hour).filter(h => h != null))].sort((a,b) => a-b).map(h => {
                const evs = (cal.events || []).filter(e => e.hour === h);
                return `<tr><th class="row">${h}:00hr</th>` + (cal.days || []).map((_, di) => {
                  const de = evs.filter(e => e.day === di);
                  return `<td class="mon">${de.map(e => `<a class="entry" id="${e.id}" href="#">${e.start || ""} ${e.title}</a>`).join("")}</td>`;
                }).join("") + `</tr>`;
              }).join("");
            const popups = (cal.events || []).map(e => `<dl class="popup" id="eventinfo-${e.id}"><dt>Time:</dt><dd>${e.start || ""} - ${e.end || ""}</dd><dt>Venue:</dt><dd>${e.venue || ""}</dd></dl>`).join("");
            html = `<html><body><div class="topnav"><span class="date">${cal.monthLabel || ""}</span></div><table class="main">${rows}</table>${popups}</body></html>`;
          } else if (path.includes("notices.json")) {
            html = `<html><body><div id="mw-content-text">` +
              (j.notices || []).map(n => `<h2>${n.year}</h2><li><a href="${n.link || "#"}">${n.title} ${n.type ? `[${n.type}]` : ""}</a></li>`).join("") +
              `</div></body></html>`;
          } else if (path.includes("voip.json")) {
            html = `<html><body><mark>Central Pilot: ${j.pilot || ""}</mark>` +
              (j.sections || []).map(s => `<section id="${s.id}"><h2>${s.title}</h2><table><tbody>` +
                s.contacts.map(c => `<tr><td>${c.name}</td><td>${c.ext}</td><td>${c.location}</td></tr>`).join("") +
                `</tbody></table></section>`).join("") + `</body></html>`;
          } else if (path.includes("research.json")) {
            if (/latest_tool/.test(url)) {
              html = `<rss><channel>` + (j.latest || []).map(p => `<item><title>${p.title}</title><link>http://eprints.iiserkol.ac.in/${p.id}/</link><description>${p.id} (${p.year}) ${p.title}</description></item>`).join("") + `</channel></rss>`;
            } else {
              html = `<html><body>` + (j.divisions || []).map(d => `<a href="${d.id}/">${d.name}</a>`).join("") + `</body></html>`;
            }
          } else if (path.includes("library.json")) {
            html = JSON.stringify(j);
          } else if (path.includes("netmon.json")) {
            html = `<html><body><a class="whitegroup" href="1.html">Core</a><a class="greenhost" href="1/index.html">Router</a></body></html>`;
          } else if (path.includes("pyq.json")) {
            if (/Library:Home/.test(url)) {
              html = `<html><body><div id="mw-content-text">` +
                (j.years || []).map(y => `<p><a href="/wiki/Library:Old_Question_Papers_(${y.year})">${y.year}</a></p>`).join("") +
                `</div></body></html>`;
            } else {
              html = `<html><body><div id="mw-content-text"><font size="4">Mid Semester</font>` +
                (j.sections || []).map(s => `<p>${s.exam} - ${s.depts.map(d => `<a href="${d.url}">${d.name}</a>`).join("")}</p>`).join("") +
                `</div></body></html>`;
            }
          } else {
            html = JSON.stringify(j);
          }
          return { text: html, fallback: true, path };
        }
      } catch {}
    }
  }
  return null;
}

export async function get(url) {
  try {
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    const text = await res.text();
    // If the campus returned an error page and we have a fallback, use it
    if (!res.ok) {
      const fb = await tryFallback(url);
      if (fb) return { ok: true, status: 200, url, text: fb.text, fallback: true };
    }
    return { ok: res.ok, status: res.status, url: res.url || url, text };
  } catch (e) {
    const fb = await tryFallback(url);
    if (fb) return { ok: true, status: 200, url, text: fb.text, fallback: true };
    throw e;
  }
}

export async function postForm(url, fields) {
  try {
    const body = new URLSearchParams(fields).toString();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      credentials: "include",
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      const fb = await tryFallback(url);
      if (fb) return { ok: true, status: 200, url, text: fb.text, fallback: true };
    }
    return { ok: res.ok, status: res.status, url: res.url || url, text };
  } catch (e) {
    const fb = await tryFallback(url);
    if (fb) return { ok: true, status: 200, url, text: fb.text, fallback: true };
    throw e;
  }
}

export async function getBlob(url) {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  return res.blob();
}

export function fileUrl(url) { return url; }
