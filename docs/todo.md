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

## 3. Managing your columns (web)

Odoo's board adds a column with "+" at the end; a column's menu has Fold, Edit and Delete. Delete
removes the `project_task_type` row at once and moves its tasks to the previous column. Personal
columns hold project tasks too, and `project_task_user_rel.stage_id` is `ON DELETE RESTRICT`.

- **Web only.** The desktop app is for data review and debugging; its board keeps fixed lanes.
- **Add:** created as yours, last in order, the name under `en_US` and your language.
- **Rename:** writes your language only (`name_localised`), so other translations stay.
- **Fold:** saves Odoo's `fold`, so Odoo folds it too.
- **Delete:** asks first (Odoo doesn't). Everything in the column moves to the previous one (the
  next one for your first column), then the row is deleted. Your last column can't be deleted.
  The move includes your project-task assignments, which nodo doesn't show, because the database
  refuses the delete otherwise; it runs under a rule exception and touches only your own rows.

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
| Card order: open first, then priority, then deadline | yes | no set order | yes, Odoo's board order (state, priority, deadline, sequence, newest) | done (web) |
| Card title | yes | yes | yes | done |
| Card deadline as "2 days ago", red when past | yes | deadline date | yes, plus amber for today | done |
| Card tags in their colour | yes | tags as plain labels | yes | partly (desktop) |
| Card priority stars, clickable | three stars | none (desktop stays plain) | one star per level (outline, half, full, red with "!"); click opens a pick of the four levels | partly (desktop) |
| Card avatars, shown only when shared with others | photos, only if 2+ people | none | initials, always shown | partly |
| Card done checkmark, click to mark done | yes | no (Mark as done on the sheet) | checkmark circle, click toggles | partly (desktop) |
| Done and cancelled cards dimmed | yes | no | dimmed, title struck through | partly (desktop) |
| Card activity icon (next activity, schedule one) | yes | no | a clock in Odoo's colours when one is planned; scheduled from the form | partly |
| Card menu: colour, cover image, delete | yes | no | colour (a stripe on the card) and delete; no cover image | partly |
| Column bar of activities (planned, today, late) | yes | no | no | not yet |
| Done and Cancelled folded, click to look inside | yes | yes | yes | done |
| Board shows only open to-dos by default | yes (Open filter) | shows all | yes, Open / All chips | done (web) |
| Quick add on a column: title, Enter adds, box stays open, Edit opens it | yes | no (New dialog only) | yes | partly (desktop) |
| Quick add takes a deadline | yes | in the New dialog | yes, under the title | done (web) |
| Quick add keywords: #tag, @person, ! / !! / !!! | yes | no | yes, Odoo's rules (a run at the end of the title) | done (web) |
| New button | quick add in first column | dialog (title, deadline), then opens it | quick add in the first column | done (web) |
| Search and filters on the board | full search panel | search box | title search, Open / All | partly |

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
| Rows grouped by my column, with counts | yes | flat | yes, folded columns closed, Odoo's order in each | done (web) |
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
| Tags: create a new one here | yes | no | yes, `Create "…"` in the tags field | done (web) |
| Tags: click one to change its colour | yes | no | yes, Odoo's twelve colours | done (web) |
| Deadline with date and time, red when past | yes | typed in the Edit dialog, "(overdue)" | picker, Clear, Overdue mark | done |
| Description as rich text (bold, lists, checklists, links, images, / commands) | yes | shown as text, edited as plain text | plain text box | partly (formatting lost on save) |
| Description edited by several people at once, whiteboard | yes | no | no | not yet |
| Description version history, restore an old one | yes | no | no | not yet |
| Saving | saves by itself when you leave | dialog Save | Save/Discard for text, the rest at once | partly |
| Archived mark | red ribbon | "Archived" label | badge | done |
| Previous / next to-do (2 / 10) | yes | no | yes, through the board or list it was opened from | done (web) |
| Back to the board | breadcrumb | close the sheet | breadcrumb and Back | done |

### Search and filters

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Search by title | yes | yes | list only | done |
| Search by tag | yes | no | yes, the search box matches tag names too (board and list) | done (web) |
| Open, on by default | not done or cancelled | also hides my folded columns (your choice) | same as desktop | done |
| Closed (done or cancelled) | yes | Done only | yes, the list's Closed chip | done (web) |
| Closed on (date periods) | yes | no | no | not yet |
| Deadline by period (month, quarter, year) | yes | Overdue chip | Overdue chip | partly |
| Starred | group by priority | chip (Medium and up) | chip (Medium and up) | done |
| Archived | custom filter only | chip | chip | done |
| Group by priority, deadline, tags, any field | yes | no | my column, priority, or none | partly |
| Custom filter editor | yes | no | no | not yet |
| Saved searches (Favorites) | yes | no | no | not yet |
| Activity filters (mine, late, today, future) | yes, from the systray | no | no | not yet |

### Stages

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Each person has their own columns; others keep their own for the same to-do | yes | yes | yes | done |
| A new person gets the 7 default columns | automatically | no ("open To-do in Odoo once") | yes, on their first board visit, named as Odoo named them | done (web) |
| New person or new column shows up on the board | yes | needs a page edit | yes | partly (desktop) |
| Add a column | yes | no | yes (§3) | done (web) |
| Rename a column | yes, in your language | no | yes, in your language (§3) | done (web) |
| Delete a column | yes, at once | no | yes, after asking (§3) | done (web) |
| Fold or unfold a column for good | yes | Done/Cancelled fixed as folded | yes, saved in Odoo (§3) | done (web) |
| Reorder columns by drag | yes | no | Move left / right in the column menu, saved as Odoo's order | partly (no drag) |
| New to-do goes to the first column; quick add into a chosen one | yes | Inbox only | yes | partly (desktop) |

### Tags

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Tag colours | yes | no colours | Odoo's palette, darker shades | partly |
| Pick from existing tags | yes | yes (password asked each time) | yes | done |
| Create a tag (form or #tag) | yes | no | yes, from the form or #tag in a quick add | done (web) |
| Change a tag's colour by clicking it | yes | no | yes | done (web) |
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
| Schedule an activity on a to-do | yes | no | yes: type, due date (the type's delay), summary, who; mark done with feedback, cancel | done (web) |
| Activity view (to-dos by activity type) | yes | no | no | not yet |
| Systray Activities with a To-Do group | yes | no | no | not yet |
| Add a To-Do from anywhere (Alt+Shift+T) with a reminder | yes | no | no | not yet |
| Chatter panel, toggled with D and remembered | yes | no | under the form, always shown; messages as text | partly |
| Send message, log note | yes | no | log note (internal, notifies nobody); no send message | partly |
| Change history in the chatter (stage, deadline, people) | yes | no | yes: nodo's changes to title, priority, state, deadline and assignees are written as Odoo writes them, and shown (deadlines in UTC) | done (web) |
| Followers: see, add, remove | yes | added on create and assign, not shown | yes, in the chatter (internal users to add) | done (web) |
| Attachments | yes | no | no | not yet |
| Search messages | yes | no | no | not yet |

### Other

| feature | Odoo | nodo desktop | nodo web | status |
|---|---|---|---|---|
| Archive and restore | yes | yes | yes | done |
| Duplicate | yes | no | yes, ⚙ menu; the description keeps its text, not its formatting | done (web) |
| Delete | yes | no | yes, ⚙ menu after asking; followers, messages and activities go too | done (web) |
| Convert to a project task | yes | no | no | won't (nodo has no Project app) |
| Calendar by deadline | yes | no | a month view of open to-dos, Sunday first; no week or day view, no drag to reschedule | partly |
| Welcome to-do for each new user | yes | shows existing ones | shows existing ones | not yet |
| Create with no title ("Untitled to-do", or first line of the description) | yes | title required | title required | won't (nodo asks for a title) |
| Empty board help ("No to-do found. Let's create one!") | yes | note for people with no board | note when no columns | partly |
| Changes by others appear live | at once | when the page reopens | within 10 to 30 s | partly |
| A reload shows your own last change | yes | n/a | not always: reloading seconds after a priority or done change can show the card as it was; a fresh sign-in shows it (seen in the end-to-end tests) | partly |
| Times in my time zone | user's zone | computer's zone | browser's zone | done |
| Phone layout | yes: menu behind a ☰, columns swiped one at a time, form fields stacked, New and search as icons | n/a | columns swiped one at a time, form fields stacked, About and Sign out as icons, finger-sized targets; the list drops its tags and people columns | partly (no ☰ menu, no New or search on the phone board) |
| Share from the phone into To-do | yes | no | no | won't (phone app only) |
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
5. **Rich description**: formatting kept on save, then version history.
6. **Faster capture**: quick add on the desktop board, deadline in web quick add, #tag,
   @person and ! keywords, a New button on the web.
7. **List power**: group by column, priority, deadline and tags; edit in place; select rows
   for bulk archive, delete and export; optional columns; closed and date filters; saved
   searches.
8. **Record housekeeping**: duplicate, delete, previous/next on the form.
9. **Calendar by deadline.**
10. **Polish**: avatar photos and person cards, assignment notifications, live updates,
    phone layout, keyboard shortcuts, welcome to-do for new users.
