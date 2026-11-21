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
