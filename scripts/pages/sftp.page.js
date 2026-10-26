/**
 * pages/sftp.page.js — SFTP (ui/sftp/SftpScreen.kt).
 *
 * SFTP runs over a raw SSH socket, which a web page cannot open. The screen
 * shows the app's layout: the empty server list, the connection form and an
 * example file list. Nothing typed here is sent anywhere or saved.
 */

import { esc } from "../ui/dom.js";
import { icon, topBar, screen, browserNote, textField, button, emptyState } from "../ui/components.js";

const EXAMPLE_FILES = [
  { name: "reports", dir: true, meta: "Folder" },
  { name: "notes.txt", dir: false, meta: "2 KB" },
  { name: "thesis-draft.pdf", dir: false, meta: "1.4 MB" },
];

export async function render(el) {
  el.innerHTML = screen({ cls: "tools-body",
    bar: topBar({ title: "SFTP" }),
    body: `
      ${browserNote({
        icon: "lock",
        tone: "warn",
        title: "Browsers cannot open SFTP connections",
        body: "SFTP runs over a raw SSH connection, and a web page has no way to open one. Nothing typed here is sent anywhere or saved. Use the Android app, or an SFTP client on your computer with the server address and your credentials.",
      })}

      <section class="card card--high tools-empty-wrap">
        ${emptyState({
          icon: "storage",
          title: "No servers saved",
          body: "Add a machine's address, username and password to browse its files from here.",
        })}
      </section>

      <section class="card card--high tools-stack" aria-label="Add a server">
        <h2 class="t-title-m">Add a server</h2>
        ${textField({ id: "sftp-name", label: "Name", a: { autocomplete: "off" } })}
        ${textField({ id: "sftp-host", label: "Address (IP or hostname)", a: { autocomplete: "off", autocapitalize: "none", spellcheck: "false" } })}
        ${textField({ id: "sftp-port", label: "Port", value: "22", a: { inputmode: "numeric", autocomplete: "off" } })}
        ${textField({ id: "sftp-user", label: "Username", a: { autocomplete: "off", autocapitalize: "none", spellcheck: "false" } })}
        ${textField({ id: "sftp-pass", label: "Password", type: "password", a: { autocomplete: "off" } })}
        ${textField({ id: "sftp-dir", label: "Start in (optional)", a: { autocomplete: "off" } })}
        ${button("Connect", { block: true, disabled: true, icon: "login" })}
        <p class="tools-fine c-muted">Connecting is not possible in this browser.</p>
      </section>

      <h2 class="t-title-s tools-heading">File browser (example)</h2>
      <section class="card card--flush tools-filebrowser" aria-label="Example file list, not connected">
        <div class="tools-filebrowser__path">${icon("folder_open", { size: 18 })}<span>/ (not connected)</span></div>
        <ul class="tools-filelist tools-filelist--plain">
          ${EXAMPLE_FILES.map((f) => `<li class="tools-filelist__row" aria-disabled="true">
            ${icon(f.dir ? "folder" : "insert_drive_file", { size: 22 })}
            <span class="tools-filelist__name">${esc(f.name)}</span>
            <span class="t-label-s c-muted">${esc(f.meta)}</span>
          </li>`).join("")}
        </ul>
        <p class="tools-fine c-muted tools-filebrowser__foot">Example only. Connect to a server to see its files.</p>
      </section>
    `,
  });
}
