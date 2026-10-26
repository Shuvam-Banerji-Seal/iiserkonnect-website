# Parity with the Android app

Every screen of the IISERKonnect Android app (routes from `ui/navigation/Screen.kt`, plus the
settings sections, dialogs and overlays reached from them) and where it lives in this web app.

**Status**

- **done** — works in the browser the way it works in the app.
- **partial** — same screen and the same in-browser behaviour, but something the app does needs a
  phone or the campus network; the screen says what, in the app's own card style.
- **not possible** — a browser cannot do it at all; the app's screen is shown with an honest note.

Campus-data screens read live data only when this browser can reach the campus server. Campus
servers do not send the headers that let another website read them (and the intranet is plain
`http`), so in practice they show clearly labelled, made-up sample data. Settings → Advanced →
"Sample data only" turns off every campus request.

| Android route | Screen | Web route | Status | Note |
|---|---|---|---|---|
| `login` | Global sign-in | `#/login` | done | Saves the LDAP login in this browser only; Skip works. Campus portals do not accept it from another site. |
| `home` | Home dashboard | `#/home` | done | Greeting, codes, Today at a glance, sections in all four styles and accents, live cards. Today's figures are sample off campus. |
| `home-customize` | Customize Home | `#/home-customize` | done | Templates, sections, tiles, move/rename/hide/delete, Design dialog with preview. |
| `vpn` | VPN | `#/vpn` | not possible | Browsers cannot create an OpenVPN tunnel; screen and profile names shown, controls disabled. |
| `welearn/login` | WeLearn login | `#/welearn/login` | partial | Moodle does not accept sign-ins from another website. |
| `welearn/courses` | My Courses | `#/welearn/courses` | partial | Live where the browser can reach WeLearn, sample otherwise; no deep cache. |
| `welearn/courses/{id}/{title}/files` | Course files | same | partial | Files open/download through the browser; no in-app queue. |
| `welearn/downloads` | Download queue | `#/welearn/downloads` | partial | A list of files opened here; the browser's own downloads hold the files. |
| `welearn/notifications` | WeLearn notifications | `#/welearn/notifications` | partial | Sample only; read marks kept locally. |
| `website` | IISERK website home | `#/website` | done | Quick links and section navigation. |
| `website/section` | Website section | `#/website/section` | partial | Section structure shown; the page itself opens in a new tab (no scraping cross-site). |
| `website/vpnview` | WebView through VPN | `#/website/vpnview` | not possible | A web page cannot host another site behind a VPN; "Open in a new tab". |
| `pdf` | PDF viewer | `#/pdf` | partial | Opens in the browser's PDF viewer; public https PDFs can be shown inline after a tap. |
| `schedule` | Class schedule (timetable) | `#/schedule` | partial | Sample week; the official PDF cannot be read cross-site. |
| `teaching-plan` | Teaching plans | `#/teaching-plan` | partial | Sample plans. |
| `teaching-plan/course` | Course detail | `#/teaching-plan/course` | partial | Sample detail. |
| `calendar` | Academic calendar week | `#/calendar` | partial | Sample week, course filter, `.ics` export. |
| `campus-events` | Event Calendar | `#/campus-events` | partial | Week grid, details, Add to My Calendar, `.ics`; sample events off campus. |
| `profile` | My Profile | `#/profile` | partial | Sample ERP pages; editing the ERP is not possible from a browser. |
| `profile/page/{page}` | Profile page | `#/profile/page/:page` | partial | Read-only sample rows. |
| `macreg` | MAC registration | `#/macreg` | partial | Gateway needs a CAPTCHA sign-in on campus; sample devices + link. |
| `tcpcount` | TCP count / devices | `#/tcpcount` | partial | Same as above. |
| `foodmenu?meal=` | Mess menu | `#/foodmenu` | partial | Days, meals, specials, serving windows, `?meal=`; no menu history, calories or catalogue prices. |
| `library` | Library | `#/library` | partial | Catalogue search on samples, reading list; loans/holds need the library login. |
| `pyq` | Previous year questions | `#/pyq` | partial | Years → exams → departments; papers open on campus only. |
| `attendance` | Attendance | `#/attendance` | partial | Sample attendance with the app's summaries. |
| `grades` | Grade card | `#/grades` | partial | CAPTCHA sign-in impossible cross-site; SGPA/CGPA views on sample. |
| `course-selection` | Course selection | `#/course-selection` | partial | Choices work locally; nothing can be submitted. |
| `mess-transactions` | Mess transactions | `#/mess-transactions` | partial | Summary/transactions pager, filters, charts, CSV, sync to budget; live history needs the ERP login. |
| `mess/qr-billing` | QR billing | `#/mess/qr-billing` | partial | Same screen; opens the counter page in a new tab. A browser cannot see the network, sign you in, or set brightness — Bright presentation + Screen Wake Lock instead. |
| `helpdesk` | Helpdesk | `#/helpdesk` | partial | Categories link to the campus ticket system (campus only). |
| `notice-board` | Notice board | `#/notice-board` | partial | Student/admin tabs on sample notices. |
| `voip-directory` | VoIP directory | `#/voip-directory` | partial | Search, sections, tap-to-call; directory is sample unless the institute page is reachable. |
| `emergency-contacts` | Emergency contacts | `#/emergency-contacts` | partial | National numbers built in; campus numbers come from the intranet in the app and are not copied here. |
| `chat` | Campus Chat home | `#/chat` | partial | Contacts/Requests/Graph. Browser-to-browser WebRTC with invite codes instead of automatic discovery; cannot talk to the app's chat. |
| `chat/room/{peer}/{name}` | Chat thread | `#/chat/room/:peer/:name` | partial | Bubbles, date chips, ticks, typing, jump to latest, Markdown, files, message actions, export, search. Both people need the chat open. |
| `concept-tree` | Concept tree | `#/concept-tree` | done | Built in the browser from sample course data. |
| `iiser-card` | Digital ID card | `#/iiser-card` | done | Card with Code 128 barcode; Download as PNG. |
| `network-dashboard` | Network status | `#/network-dashboard` | partial | Verdict, services, monitors, charts from sample numbers; a browser cannot ping or open sockets. |
| `sftp` | SFTP file manager | `#/sftp` | not possible | Browsers cannot open SSH/SFTP connections; screen shown, nothing sent. |
| `settings` | Settings hub | `#/settings` | done | Profile card, search (same index), grouped rows, whole-row switches, Mess group with QR brightness level. |
| `settings/appearance` | Appearance | `#/settings/appearance` | done | All 12 theme modes, 9 Neko coats, custom colour picker and hex. |
| `settings/motion` | Motion & Haptics | `#/settings/motion` | done | Off/Subtle/Full (prefers-reduced-motion and E-Ink force Off); haptics via the Vibration API where it exists. |
| `settings/account` | Account | `#/settings/account` | partial | Credentials, saved accounts, ID card; stored unencrypted in this browser (said on screen). |
| `settings/security` | Security | `#/settings/security` | partial | PIN app lock with the app's PIN policy and lock-out; "fingerprint" uses the device's own unlock (WebAuthn). Hides the app; does not encrypt browser storage. |
| `settings/notifications` | Notifications & Features | `#/settings/notifications` | partial | Notification permission, chat button, SFTP switch, calorie reminder work; WeLearn deep cache and download folder are not possible. |
| `settings/chat` | Chat & Storage | `#/settings/chat` | partial | History retention and usage work; background chat and media folder are not possible. |
| `settings/advanced` | Advanced | `#/settings/advanced` | done | Logging, logs, error report, network debug, plus web-only data source, backup/restore and erase. |
| `settings/about` | About & Support | `#/settings/about` | partial | Version, developer, sign out; donating is left to the app (no payment details on the web). |
| `log` | Logs | `#/log` | done | Level filter, search, copy, download, clear. |
| `budget` | Budget analysis | `#/budget` | partial | Day/month charts, targets, CSV; calories are what you enter (no nutrition/price catalogue on the web). |
| `budget/ledger` | Budget ledger | `#/budget/ledger` | partial | Add/edit/delete, CSV; no macros. |
| `budget/sync` | Budget sync | `#/budget/sync` | done | The app's retired-sync notice plus rebuilding rows from mess transactions. |
| `research` | Research papers | `#/research` | partial | Latest / browse on samples. |
| `research/detail/{id}` | Paper detail | `#/research/detail/:id` | partial | PDF link opens in a new tab. |
| `deadlines` | Deadlines | `#/deadlines` | partial | Status, countdowns, grading cards on sample assignments. |
| `reminders` | Reminders | `#/reminders` | partial | Everything works; alarms ring only while a tab is open (said on screen). |
| `notes` | Notes | `#/notes` | done | Pin, search, share, alarm (rings while a tab is open). |
| `timer` | Timer | `#/timer` | done | Runs from its end time, survives reloads; the alert needs an open tab. |
| `stopwatch` | Stopwatch | `#/stopwatch` | done | Laps (99 max), fastest/slowest. |
| `focus` | Focus | `#/focus` | done | Focus/short/long cycle, skip, durations; alert needs an open tab. |
| `planner` | Planner | `#/planner` | done | Ordering, overdue, clear completed, day strip and agenda. |
| `my-calendar` | My Calendar | `#/my-calendar` | done | Month grid, agenda, repeats, reminder offsets. |

**Overlays and dialogs**

| Android | Web | Status | Note |
|---|---|---|---|
| Bottom navigation bar | bottom bar (phone) / rail (desktop) | done | Home, Chat, WeLearn, VPN, Settings; unread badge on Chat. |
| `MovableChatFab` | floating Campus Chat button | done | Drag to move, remembered; reset from Settings. |
| `AppLockScreen` | lock overlay | partial | See Security. |
| `FirstOpenAnimationOverlay` | welcome overlay | done | Once per browser. |
| `EditAvatarDialog` | profile photo dialog | done | Cropped square photo kept in this browser. |
| `CalendarPickerDialog` | "From calendar" picker | done | My Calendar + campus events (sample off campus). |
| `ChatImageViewer` | image viewer | done | Wheel / double-tap zoom. |
| Custom colour picker | colour picker dialog | done | Presets, hue/saturation/brightness. |
| `MondayDonationPopup` | — | not possible | Needs payment details, which this public site does not carry (owner's call). |
| Thinking orb loader | loading orb | done | CSS version; still frame on E-Ink / motion off. |
| Liquid Glass, Neko ears, E-Ink | theme classes | done | Glass panes (no gyroscope tilt), cat ears and paws, hairline e-paper. |

**Counts**: 74 entries — 63 screens/routes (the app's routes, with Settings' eight sections listed
separately) and 11 overlays/dialogs. 27 done, 43 partial, 4 not possible (VPN, VPN WebView, SFTP,
and the Monday donation popup).
