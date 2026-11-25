# nodo: To-do, notes for you

## What you have

**Desktop app (the Vantage window).**
- **My to-dos** is a board with your own columns: Inbox, Today, This Week, This Month,
  Later, plus Done and Cancelled (folded). Dragging a card moves it for you only; the other
  people on that to-do keep their own column for it. Cards show the title, a short
  description, tags, the deadline and who has it. Double-click a card to open it.
- **List** shows your to-dos with a priority column (Low, Medium, High, Urgent), the deadline (as "in 3 days", with an
  Overdue/Today chip in red/amber), tags, who it's assigned to and the status. Chips at the
  top: Open and Active (on by default), Starred, Overdue, Done, Archived. There is a search box.
  **Open** works like Odoo's: it leaves out to-dos that are done or cancelled, and to-dos
  sitting in one of your folded columns (Done, Cancelled).
- **Opening a to-do** (a side sheet) shows it, with buttons: Edit (title, deadline,
  description), Mark as done / Open again, Tags, Assignees, Archive / Restore.
  Under **My column** it lists your columns with the to-do's current one marked (●, "here");
  click another to move the to-do there (for you only). The sheet is narrow, so the columns
  run down the page rather than across.
- **New** (on both pages) adds a to-do to your Inbox, assigned to you.
- **Who you are:** the name at the top right of the window. Its menu has "Switch person…"
  (Marc, Monica, or you) and "Back to Mitchell Admin". After a switch the whole window shows
  exactly that person's to-dos and columns, and anything you change is made as them.

**Web version for the team** at **http://127.0.0.1:52896** while the Vantage window has this
project open. It is also listed under Services in Vantage, with "Open in browser".
- Sign in with the Odoo login and password (admin/admin, demo/demo, light/light).
- A soft violet top bar (Odoo 20's `#71639e`) with "To-do", My to-dos / List, and who is
  signed in, with Sign out.
- **Board**: your columns; drag cards between them; the **+** on a column adds a to-do
  there (type, Enter); the star on a card shows the priority (outline Low, half Medium,
  full High, red with "!" Urgent) and a click opens a pick of the four levels; the circle marks it done or open again; folded Done/Cancelled
  columns open on click.
- **List**: search, filter chips (Open, Starred, Overdue, Done, All, Archived), click a row
  to open it; each row has the done circle and the priority star, as on a card. Open is
  Odoo's Open, as on the desktop.
- **To-do form**: Odoo's column bar across the top (your columns, the current one
  highlighted; click one to move the to-do there for you), title, the priority star (as
  on a card), assignees (add or
  remove people), deadline, tags (in Odoo's colours), description, Save/Discard, Mark as
  done, Archive.
- **Signing in again**: sign-ins live only in the server's memory. When the Vantage window
  closes or reopens the project, everyone signs in again. A sign-in also ends after 8 hours
  unused.

I tried it signed in as Marc (his board, a drag from Inbox to Today, tags, deadline,
description, star, assigning Monica, list search) and as Mitchell (his board, quick add into
This Week). Everything landed in Odoo's database the way Odoo writes it, and Odoo's own API
then showed the to-do in the right person's column with them following it. I removed the
test to-dos afterwards.

## How it works with Odoo (decisions)

- **No change to Odoo's database structure.** nodo reads and writes Odoo's existing tables:
  `project_task` (to-dos), `project_task_user_rel` (who has it, and in which of *their*
  columns), `project_task_type` (personal columns), `project_tags` and its link table,
  `mail_followers`, `res_users`/`res_partner`. nodo keeps no files or tables of its own:
  web sign-ins live in memory only.
- **A to-do** is a task with no project, no parent and not a template, as in Odoo. Archived
  to-dos are left off the board (as in Odoo) and appear under the list's Archived chip.
- **Adding a to-do** writes what Odoo's own create writes: the task (status "in progress",
  normal priority, sequence 10, creator, dates), your assignment row in your first column
  (Inbox), and you as a follower (with the "Discussions" subscription). Assigning someone
  gives them the to-do in their own Inbox and makes them a follower, as Odoo does. Removing
  someone takes their assignment away and, like Odoo, leaves them following it.
- **Marking done** sets Odoo's state "done" and its end date; opening it again clears them.
  The priority is Odoo's four levels ("0" Low, "1" Medium, "2" High, "3" Urgent), kept
  as Odoo stores them. Archive is Odoo's "active" flag.
- **Description**: nodo shows and edits it as plain text and saves it as simple paragraphs.
  A description written in Odoo with bold, links or lists loses that formatting if you edit
  and save it in nodo (reading it is fine).
- **Tags are saved through Odoo itself.** Odoo's tag link table has no id column of its own,
  and Vantage can't add rows to such a table (details in FEEDBACK.md). So nodo asks the
  running Odoo (port 8069) to save the tags, as you. That needs your Odoo password: the
  desktop Tags dialog asks for it; on the web, the server keeps the password you signed in
  with alongside your sign-in, in memory only, and the page never holds it. It is gone when
  you sign out, after 8 hours unused, or when the app restarts. No page, list or API answer
  shows it, and it is not written to the logs. nodo then reads the tags back and tells you if
  Odoo didn't take them.
- **Each person sees only their own** to-dos, assignments and columns. This is a rule on the
  database connection, so it holds on every page, in the web version and for any script, not
  only on the screens. Changing a to-do goes through actions that check it is yours first.
  Nobody can move a card into someone else's column or give themselves someone else's to-do;
  I tried both as Marc against Mitchell's and Monica's to-dos, and both were refused.
- **Sign-in** checks the password against Odoo's own stored hash (`res_users.password`).
  A web sign-in lives in the server's memory and ends after 8 hours unused, on sign-out, or
  when the app restarts. If someone is archived in Odoo, or their password changes, their nodo
  session ends.
- **The desktop is Mitchell's.** It opens as Mitchell Admin and is narrowed to Mitchell's
  rows like anyone else's. "Switch person…" shows another person's view without their
  password; that is a desktop-only tool on your own computer.
- **Times**: deadlines are stored in UTC as Odoo stores them. The web page shows them in the
  browser's time zone. The desktop shows them in this computer's zone, which is UTC here,
  while Odoo shows Brussels time (one hour later). A deadline typed on the desktop is taken
  as this computer's time.
- **Board columns on the desktop** are written into the page for Mitchell, Marc and Monica
  (a Vantage board can't read its columns from a table). Someone new, or a new personal
  column made in Odoo, needs a line added to `page/board.yaml`; until then their to-dos are
  on the List. The web board reads each person's columns from the database, so it needs no
  change.
- **Updates from Odoo**: changes made in Odoo show up in nodo within about 10 seconds on the
  web (30 seconds for the board), or when you reopen a page on the desktop.

## Where things are

- `datasource/odoo.yaml`: the connection to Odoo's database and the "only your own rows" rules.
- `datasource/odoo_auth.yaml`, `table/odoo_user.yaml`: Odoo's users, for sign-in only.
- `table/`: to-dos (`todo`, `todo_view`), assignments (`todo_user`), columns (`stage`),
  tags, people, followers; `stage_bar` (the to-do sheet's column list).
- `action/`: sign-in, create, save, move, done, priority, tags, assignees, archive, switch person.
- `page/board.yaml`, `page/todos.yaml`, `page/todo.yaml`, `menu/left.yaml`, `layout/nodo.yaml`.
- `api/team.yaml` and `web/team/`: the web version (React). Vantage builds it in a
  container; you don't need Node.
- `tests/scenarios/todo.yaml`: tests for adding a to-do and for columns staying private
  (run them from the test badge in the title bar). They are green. The "can't touch someone
  else's to-do" tests are marked skipped, because the database rules can't run in the test
  sandbox. I checked those refusals on the live app instead.

## What got in the way (with the exact messages)

1. **The web API wouldn't start without a sign-in table** in the first pass:
   ``auth for profile `local`: auth `session` needs application.yaml `session:` ``.
   Fixed in Vantage since; see "Second pass" below.
2. **Editing a deadline through the guarded table failed** inside Vantage's own rule check:
   first ``error returned from database: incorrect binary data format in bind parameter 19``
   (fixed by listing relation columns last in the table files), then, for any change to a
   date-time column, ``error returned from database: invalid byte sequence for encoding "UTF8": 0x00``.
   I routed every to-do change through actions that check ownership first, with a rule
   exception each.
3. **Tags**: adding a row to Odoo's tag link table was impossible. A plain insert silently
   did nothing; then ``id is held by a row outside this set``; with Postgres's row address
   ``insert returned no usable id — the row's id came back NULL`` and, inside an action,
   ``operator does not exist: tid = text``; also ``table takes no delete_all``. Hence the
   Odoo JSON-RPC route above. A wrong password also gets HTTP 200 from Odoo, so nodo reads
   the result back to confirm. **Fixed (Vantage 1.16):** the link table now has an id computed
   from the pair, and tags are written straight to the database; the JSON-RPC route and the
   password it needed are gone.
4. **Creating a to-do** was first refused by the "assigned to you" rule, because the task
   exists a moment before its assignment: ``record does not belong to this set (table: "project_task")``.
   The create action now has a rule exception and assigns the to-do in the same transaction.
5. **Board columns per person**: a Vantage board's columns must be written in the page,
   and must be text (`value: "5"`); numbers failed with a schema message ending in
   ``10 is not of type "string"``.
6. **Filtering through a relation** isn't possible: ``this shell doesn't evaluate a dotted path (column: "task.active")``.
   Archived to-dos are left off the board by the database rule instead.
7. **The API name** can't equal the app name: ``api `nodo`: its key is the desktop app's name (`app: nodo` in application.yaml); rename one of them``.
   The API is called `team`.
8. **Web search** found nothing at first: the server's `like` already means "contains" and
   escaped my `%` (`ILIKE '%$%kitchen$%%' ESCAPE '$'`).
9. **Tests**: the database rules can't run in Vantage's in-memory test copies:
   ``native condition isn't this table's condition type``.
10. **A `log_events:` block on the sign-in action** closed the whole project's data until I
    removed it: ``project policy: the project's data stays closed until this is fixed error=action `sign_in`: log_events needs `into:`: application.yaml sets no log_events default``.
11. **Port**: you said any free port, but Vantage chooses the API's port itself (52896 now;
    it may change when Vantage reopens; Services always shows the current one). It is
    reachable from this computer only. Odoo (8069) and the databases were not touched.
12. **Web page freshness**: the to-do list the web page reads is computed from several Odoo
    tables and is re-read every 10 seconds. The page shows your own changes at once and
    lets the server's copy catch up.

## Not done / later

- Activities, chatter and notifications aren't in nodo (Odoo still sends its own).
- Creating new tags, or new personal columns, is done in Odoo.
- The board's columns on the desktop need a YAML line per new person (see above).
- The web version stops when the Vantage window closes this project. To run it on its own
  it would need vantage-server or a container (not done; you asked to keep it local).

## Second pass (21 Nov 2026)

### What changed

1. **No sign-in file.** `data/sessions.sqlite`, its table (`table/session.yaml`) and its
   connection (`datasource/local.yaml`) are gone, and so is the `data/` folder. Web sign-ins
   live in the server's memory only. A restart of the app signs everyone out; a sign-in also
   ends after 8 hours unused.
2. **The Odoo password is out of the browser.** At sign-in the server keeps the password
   with that sign-in, in memory, as a secret field (`odoo_password` in `application.yaml`).
   Saving tags uses it there. The web page no longer stores it, and it also clears the copy
   an older version of the page may have left in an open tab. The desktop Tags dialog still
   asks for the password, because the desktop has no sign-in. *(Since removed: tags no longer
   go through Odoo, so nodo keeps no Odoo password at all.)*
3. **"Open" like Odoo.** Open now leaves out to-dos that are done or cancelled and to-dos
   in one of your folded columns (Done, Cancelled), on the desktop list and the web list.
   Behind it is a new `open_for` column on the to-do list: the people for whom that to-do is
   still open. A note on Odoo itself: Odoo's own "Open" filter in its source code
   (`project_todo`) only checks done/cancelled. What hides "Attend a Local Event" in Odoo is
   the board's folded Cancelled column. nodo now does both, as you asked.
4. **Column bar.** On the web form, your columns run across the top in Odoo's arrow style,
   with the current one highlighted. A click moves the to-do there, for you only (it uses
   the same move as dragging on the board). On the desktop, the to-do sheet has a **My
   column** section that lists your columns with the current one marked; a click moves it.
   The sheet is too narrow for a bar across, so the list runs down. It re-reads every 2
   seconds so a move shows straight away.
5. **Colour.** The web top bar, buttons, links and highlights use Odoo 20's soft violet
   `#71639e` instead of plum.

### What I checked

- The API started without a session table (no errors in Services).
- **Web, as Marc (demo):** signed in; the browser holds only the sign-in token and his name,
  with no password. Board loads in violet. Opened "Clean kitchen fridge": the bar showed This
  Week highlighted; clicking Today moved it, and Odoo's table showed it in Marc's own Today
  column. Added the Office tag: Odoo saved it as Marc (its `write_uid` is Marc) using the
  password kept on the server. Removed the tag and moved the to-do back to This Week. His
  list's Open shows the same 7 to-dos Odoo's database gives for him.
- **Web, as Mitchell (admin):** Open shows 10 to-dos, without "Attend a Local Event" (still
  under All, 14). His form for that to-do shows Cancelled highlighted. A tag added and removed
  through Odoo as him. Reloading the page kept him signed in.
- **Desktop:** the list's Open chip shows 10 for Mitchell, matching the database, and "Attend
  a Local Event" is gone. The to-do sheet's My column list marked Cancelled; I moved the to-do
  to Today, saw it marked, then clicked Cancelled and it moved back.
- No errors in the browser console or the API's log after the fixes; the API log doesn't
  contain the password. Scenario tests green (3 pass, 1 skipped as before). Everything I
  changed in your data during testing is back as it was.

## Performance (21 Nov 2026)

Measured with `query_log` and `query_stats` on a debug build, the board open in two browser
tabs and the desktop app on the list. "Before" is with refresh timers (API `refresh: 10` and
`30`, the desktop sheet's `refresh_interval: 2`) and one card query per board column.

| measure | before | after |
|---|---|---|
| queries while idle, per minute | 101 | 6 (the sign-in check re-reading the person) |
| database time while idle, per minute | 3,172 ms | 16 ms |
| a board card query (`todo_user` with the to-do's columns) | 64 ms | 10 ms |
| board queries per open tab | one per column (7) | one |
| sign-in to a full board | several seconds (debug build hashing the password) | 1.3 s |
| a change made in Odoo shows in nodo | after 10 to 30 s | the web re-reads at once but shows it one change late (VAN-637); the desktop not checked yet |

What changed: `seed/notify.sql` adds a statement-level trigger per Odoo table nodo shows, the
datasource has `notify: true`, every query table lists the tables it reads (`postgres: listen:`),
and every refresh timer is gone. The board reads its cards in one query and groups them by
column. Sign-in got faster in Vantage itself (its password check now runs at full speed).
