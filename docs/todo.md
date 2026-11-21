# To-do: porting decisions

Odoo's To-do (`project_todo`) has no tables of its own: a to-do is a `project_task` row with no
project, no parent and `is_template IS NOT TRUE` (Odoo's `= False` matches NULL, and the demo
rows have NULL). Each decision below is about one place where Vantage and Odoo's schema don't
line up yet. Gap IDs refer to vantage-ui's `agents/reviews/odoo/`.

## 1. Creating a to-do Odoo accepts

Odoo's create writes more than the row: the creator's `project_task_user_rel` row (assignee plus
personal stage, Inbox), the creator's seven default personal stages if they have none, and a
`mail_followers` row. State and assignee changes set `date_last_stage_update` and `date_assign`.

- **Cross-row writes go in atomic actions** (create, assign, move stage), offered over the
  WebSocket API. Plain inserts and assignee edits on `project_task` are refused (`deny:`), so no
  path writes a to-do Odoo would treat as broken. What these actions need is the input for
  MODEL-4 (after-write hooks).
- **REST is out for now.** A REST API can't run every action a WebSocket API can: VAN-631.
- **Same-row defaults live in `project_task`'s `normalise` hook**: `state = '01_in_progress'`,
  `active`, `priority = '0'`, `sequence = 10`, `display_in_project`, `create_uid`/`write_uid`,
  and `create_date`/`write_date` once timestamps can be written (TYPE-1).

## 2. Timestamps

Odoo stores every datetime as naive UTC in `timestamp without time zone` (`date_deadline`,
`create_date`, `write_date`, `date_assign`, `date_last_stage_update`) and shows it in the user's
zone (all demo users: Europe/Brussels). Demo deadlines carry real times, e.g. `16:01` stored,
`17:01` on Odoo's screen.

- **UTC end to end below the screen.** The database, the drivers and the API carry UTC only;
  the frontend converts to the viewer's local zone for display and input. Per-user zones from
  `res_partner.tz` (TYPE-2) can come later.
- **Postgres timestamp writes (TYPE-1)** were fixed in the drivers as an architectural
  change, not a nodo workaround: native dates in the CBOR carrier, converted by each driver,
  bound by a cross-driver contract check (vantage-ui
  `agents/specs/2026-11-20-native-dates-design.md`). No per-column storage setting.

**Implemented (2026-11-21).** Storage and the API carry UTC. Odoo's naive `timestamp` columns
read as UTC instants (`2026-11-19T16:01:00.000000Z`), and a column declared `type: timestamp`
writes them back as naive UTC, so Odoo sees what it wrote. The desktop shows and takes
timestamps in the machine's zone: the demo deadline stored as `16:01` shows as `17:01` on a
Brussels machine, as in Odoo. Dates and times of day never shift. `create_date`/`write_date`
can now be set in the `normalise` hook (§1).

## 3. Rich-text descriptions

`description` is an Odoo `html` field: Odoo's write cleans it with `html_sanitize` (no scripts,
event handlers or `javascript:` links). So nodo never stores HTML in the column itself:

- **The web's editor saves through Odoo.** `todo_set_description` checks the to-do is yours,
  sends the HTML to Odoo's own `project.task.write` (JSON-RPC, as you, with the password a web
  sign-in keeps; `table/odoo_task_write.yaml`), reads the row back and returns what Odoo kept.
- **Everything else is text.** A description written straight to `project_task` (the desktop's
  Edit dialog, `todo_create`) is escaped by the `normalise` hook, so it is stored as text.
- **Shown cleaned twice.** The API sends the stored HTML (`todo_view.description`); the browser
  cleans it again with DOMPurify before showing or editing it.
- **What the editor can't hold stays untouched.** A description with images, columns, banners
  or Odoo's embedded blocks would lose them on a save from nodo, so it is shown read-only with a
  note to change it in Odoo.

## Feature inventory

Odoo 20's To-do compared with nodo on 2026-11-21, from Odoo's source and both running apps
(Mitchell Admin, same records). The desktop app is judged from its YAML. Status is for nodo
as a whole: `partly` when one side lacks it or both have only part of it.

### Board

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Columns are my personal stages, with a card count | yes | yes, but each person's columns are typed into the page (3 people) | yes, read from my stages | partly (desktop per person) |
| Drag a card to another column, for me only | yes | yes | yes | done |
| Reorder cards inside a column by drag | yes | no | no | not yet |
| Card order: open first, then priority, then deadline | yes | no set order | no set order | not yet |
| Card title | yes | yes | yes | done |
| Card deadline as "2 days ago", red when past | yes | deadline date | yes, plus amber for today | done |
| Card tags in their colour | yes | tags as plain labels | yes | partly (desktop) |
| Card priority stars, clickable | three stars | none (desktop stays plain) | one star per level (outline, half, full, red with "!"); click opens a pick of the four levels | partly (desktop) |
| Card avatars, shown only when shared with others | photos, only if 2+ people | none | initials, always shown | partly |
| Card done checkmark, click to mark done | yes | no (Mark as done on the sheet) | checkmark circle, click toggles | partly (desktop) |
| Done and cancelled cards dimmed | yes | no | dimmed, title struck through | partly (desktop) |
| Card activity icon (next activity, schedule one) | yes | no | no | not yet |
| Card menu: colour, cover image, delete | yes | no | no | not yet |
| Column bar of activities (planned, today, late) | yes | no | no | not yet |
| Done and Cancelled folded, click to look inside | yes | yes | yes | done |
| Board shows only open to-dos by default | yes (Open filter) | shows all | shows all | not yet |
| Quick add on a column: title, Enter adds, box stays open, Edit opens it | yes | no (New dialog only) | yes | partly (desktop) |
| Quick add takes a deadline | yes | in the New dialog | no | partly |
| Quick add keywords: #tag, @person, ! / !! / !!! | yes | no | no | not yet |
| New button | quick add in first column | dialog (title, deadline), then opens it | none (per-column + only) | partly |
| Search and filters on the board | full search panel | search box | none | partly |

### List

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Open a row to see the to-do | yes | side sheet | full page | done |
| Title and deadline ("in 3 days", red when past) | yes | yes, plus a Due chip | yes | done |
| Priority star in the row, clickable | three stars | Priority column (Low, Medium, High, Urgent), read only | one star per level; click opens a pick of the four levels | partly (desktop) |
| Done checkmark in the row | yes | Status column (text) | checkmark circle, click toggles; done rows struck through and dimmed | partly (desktop) |
| Tags and assignees columns | optional, hidden | shown | shown | done |
| Personal stage column | optional | no | no | not yet |
| Activities column | optional | no | no | not yet |
| Show or hide optional columns | yes | no | no | not yet |
| Rows grouped by my column, with counts | yes | flat | flat | not yet |
| Edit rows in place, "Add a line" per group | yes | no | no | not yet |
| Select rows: bulk edit, archive, duplicate, delete, export | yes | no | no | not yet |
| Sort by a column header | yes | yes | fixed by deadline | partly (web) |

### Form

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Title edited in place | yes | Edit dialog | yes | done |
| Priority on the form | three stars (Medium, High, Urgent), Alt+R | none (desktop stays plain) | one star per level; click opens a pick of the four levels | partly (desktop; no Alt+R) |
| Mark as done / back to to-do | check circle | button | button | done |
| Column bar: my stages, click to move, folded ones under "…" | yes | "My column" list down the sheet | bar across, folded ones greyed | done |
| Assignees with avatars: add, remove | yes | checklist dialog | picker | done |
| Remove yourself (it leaves your list) | yes | no, you stay assigned | no, you stay assigned | won't (it would vanish from your board) |
| Tags: pick existing | yes | checklist dialog, asks your Odoo password | picker | done |
| Tags: create a new one here | yes | no | no | not yet |
| Tags: click one to change its colour | yes | no | no | not yet |
| Deadline with date and time, red when past | yes | typed in the Edit dialog, "(overdue)" | picker, Clear, Overdue mark | done |
| Description as rich text (bold, lists, checklists, links, images, / commands) | yes | shown as text, edited as plain text | rich-text editor, saved through Odoo (see Description below) | partly (desktop plain; no images on the web) |
| Description edited by several people at once, whiteboard | yes | no | no | not yet |
| Description version history, restore an old one | yes | no | no | not yet |
| Saving | saves by itself when you leave | dialog Save | Save/Discard for text, the rest at once | partly |
| Archived mark | red ribbon | "Archived" label | badge | done |
| Previous / next to-do (2 / 10) | yes | no | no | not yet |
| Back to the board | breadcrumb | close the sheet | breadcrumb and Back | done |

### Description (rich text)

Odoo's editor (`html_editor`, the `html` field widget) compared with the web's `RichText`
control (Tiptap's MIT core) on the same throwaway to-do, 2026-11-21. The desktop shows the
description as text and edits it as plain text, which its hook stores escaped.

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Bold, italic, underline, strikethrough, inline code | yes | no | yes, toolbar and Ctrl+B / I / U | partly (desktop) |
| Headings, plain text | Heading 1–3 from "/", 1–6 from the toolbar | no | Heading 1–3 from "/", 1–6 kept when loaded | partly (desktop) |
| Bulleted, numbered and check lists, nested | yes | no | yes; checklists stored as Odoo's `o_checklist` | partly (desktop) |
| Quote, code block, separator | yes | no | yes | partly (desktop) |
| Links: add, edit, remove; typed URLs become links | yes | no | yes (toolbar, Ctrl+K, "/" Link) | partly (desktop) |
| Tables: insert, add and delete rows and columns | yes, with handles on the table | no | insert from "/"; rows and columns from "/" inside a table | partly (no handles, no cell colours or borders) |
| Text colour and highlight | full palette, gradients, theme colours | no | 7 colours each; Odoo's theme colour classes shown and kept | partly |
| Floating toolbar on a selection | yes | no | yes; Alt+F10 reaches it from the keyboard | partly (desktop) |
| "/" command menu | yes, 40-odd commands | no | 11 commands, plus 5 table ones inside a table | partly |
| Markdown shortcuts (`#`, `>`, `-`, `1.`, `[ ]`, three backticks) | yes | no | yes | partly (desktop) |
| Undo and redo | yes | no | yes (Ctrl+Z, Ctrl+Shift+Z) | partly (desktop) |
| Paste HTML from another page | yes, cleaned | plain text | yes, cleaned in the browser, then by Odoo on save | partly (desktop) |
| Saved HTML cleaned by Odoo's `html_sanitize` | yes | escaped as text by the hook | yes, written through Odoo's own JSON-RPC write | done |
| Shown HTML cleaned in the browser | n/a | n/a | yes, DOMPurify, colours only in `style` | done |
| Font size, font family, text style dropdown | yes | no | no | not yet |
| Text alignment, text direction ("Switch direction") | yes | no | no | not yet |
| Images, icons, videos, file upload ("Media", "Upload a file") | yes | no | no; a description holding them stays read-only with a note | not yet |
| Columns (2, 3, 4), toggle list, banners, monospace block | yes | no | no; read-only with a note when present | not yet |
| Date and time chips, emoji picker, stars, signature, button, table of contents | yes | no | no | not yet |
| Embedded whiteboard | yes | no | no | not yet |
| Move blocks by their drag handle | yes | no | no | not yet |
| Generate or rewrite text with AI | yes (Odoo's IAP service) | no | no | won't (paid service) |

### Search and filters

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Search by title | yes | yes | list only | done |
| Search by tag | yes | no | no | not yet |
| Open, on by default | not done or cancelled | also hides my folded columns (your choice) | same as desktop | done |
| Closed (done or cancelled) | yes | Done only | Done only | partly |
| Closed on (date periods) | yes | no | no | not yet |
| Deadline by period (month, quarter, year) | yes | Overdue chip | Overdue chip | partly |
| Starred | group by priority | chip (Medium and up) | chip (Medium and up) | done |
| Archived | custom filter only | chip | chip | done |
| Group by priority, deadline, tags, any field | yes | no | no | not yet |
| Custom filter editor | yes | no | no | not yet |
| Saved searches (Favorites) | yes | no | no | not yet |
| Activity filters (mine, late, today, future) | yes, from the systray | no | no | not yet |

### Stages

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Each person has their own columns; others keep their own for the same to-do | yes | yes | yes | done |
| A new person gets the 7 default columns | automatically | no ("open To-do in Odoo once") | no (same message) | not yet |
| New person or new column shows up on the board | yes | needs a page edit | yes | partly (desktop) |
| Add a column | yes | no | no | not yet |
| Rename a column | yes | no | no | not yet |
| Delete a column | yes | no | no | not yet |
| Fold or unfold a column for good | yes | Done/Cancelled fixed as folded | unfold for the visit only | partly |
| Reorder columns by drag | yes | no | no | not yet |
| New to-do goes to the first column; quick add into a chosen one | yes | Inbox only | yes | partly (desktop) |

### Tags

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Tag colours | yes | no colours | Odoo's palette, darker shades | partly |
| Pick from existing tags | yes | yes (password asked each time) | yes | done |
| Create a tag (form or #tag) | yes | no | no | not yet |
| Change a tag's colour by clicking it | yes | no | no | not yet |
| Recently used tags first | yes | no | no | not yet |

### Assignees

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Share by assigning: they get it in their Inbox and follow it | yes | yes | yes | done |
| Each person sees only their own to-dos | yes | yes | yes | done |
| Use the app as another Odoo user | Odoo sign-in | "Switch person…" menu | Odoo login and password | done |
| Avatars | photos | names | coloured initials | partly |
| Click an avatar for the person's card (chat, email) | yes | no | no | not yet |
| Assignment notification (inbox, email) | yes | no | no | not yet |

### Activities and chatter

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Schedule an activity on a to-do | yes | no | no | not yet |
| Activity view (to-dos by activity type) | yes | no | no | not yet |
| Systray Activities with a To-Do group | yes | no | no | not yet |
| Add a To-Do from anywhere (Alt+Shift+T) with a reminder | yes | no | no | not yet |
| Chatter panel, toggled with D and remembered | yes | no | no | not yet |
| Send message, log note | yes | no | no | not yet |
| Change history in the chatter (stage, deadline, people) | yes | no | no | not yet |
| Followers: see, add, remove | yes | added on create and assign, not shown | same as desktop | partly |
| Attachments | yes | no | no | not yet |
| Search messages | yes | no | no | not yet |

### Other

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Archive and restore | yes | yes | yes | done |
| Duplicate | yes | no | no | not yet |
| Delete | yes | no | no | not yet |
| Convert to a project task | yes | no | no | won't (nodo has no Project app) |
| Calendar by deadline | yes | no | no | not yet |
| Welcome to-do for each new user | yes | shows existing ones | shows existing ones | not yet |
| Create with no title ("Untitled to-do", or first line of the description) | yes | title required | title required | won't (nodo asks for a title) |
| Empty board help ("No to-do found. Let's create one!") | yes | note for people with no board | note when no columns | partly |
| Changes by others appear live | at once | when the page reopens | within 10 to 30 s | partly |
| A reload shows your own last change | yes | n/a | not always: reloading seconds after a priority or done change can show the card as it was; a fresh sign-in shows it (seen in the end-to-end tests) | partly |
| Times in my time zone | user's zone | computer's zone | browser's zone | done |
| Phone layout | yes: menu behind a ☰, columns swiped one at a time, form fields stacked, New and search as icons | n/a | columns swiped one at a time, form fields stacked, About and Sign out as icons, finger-sized targets; the list drops its tags and people columns | partly (no ☰ menu, no New or search on the phone board) |
| Share from the phone into To-do | yes | no | no | won't (phone app only) |
| Switch apps from the top bar | every installed app | n/a | To-do and CRM | partly |
| Keyboard shortcuts (priority, chatter, add to-do) | yes | no | no | not yet |

### Next blocks

1. **Board order and default**: open-first card order (then priority, then deadline) and
   Open as the board default. Done checkmarks and the four-level priority on the web's cards,
   rows and form are in (`todo_set_priority`, `todo_toggle_done`; `Priority` and `DoneCheck`).
   The desktop stays plain CRUD: priority is a labelled column there.
2. **Chatter and activities**: messages, log notes, change history, followers, attachments,
   then scheduling activities, the activity icon and bar on cards, the activity view and
   Add a To-Do from anywhere.
3. **Column management**: add, rename, delete, reorder and fold columns; default columns
   for a new person; desktop board reading columns from the database.
4. **Tags**: create tags (form and #tag), change colours, colours on the desktop, search
   and group by tag.
5. **Rich description**: formatting is kept on the web (the editor saves through Odoo); next
   images and the other blocks in the Description table, the desktop, then version history.
6. **Faster capture**: quick add on the desktop board, deadline in web quick add, #tag,
   @person and ! keywords, a New button on the web.
7. **List power**: group by column, priority, deadline and tags; edit in place; select rows
   for bulk archive, delete and export; optional columns; closed and date filters; saved
   searches.
8. **Record housekeeping**: duplicate, delete, previous/next on the form.
9. **Calendar by deadline.**
10. **Polish**: avatar photos and person cards, assignment notifications, live updates,
    phone layout, keyboard shortcuts, welcome to-do for new users.
