# Project: porting decisions

Odoo's Project keeps projects in `project_project` and their tasks in `project_task`, the same
table To-do uses. A to-do is a task with no project; a project task is one with a project. The
task stages, tags, assignees and personal stages are shared too, so Project extends what To-do
already reads and writes. This document is the study for the Project app (Odoo 20 Community, the
demo database, 2026-11-21): what nodo would read, what Odoo writes, the full feature inventory
and the order to build it in. Blocks 1 to 3 (projects overview, a project's board, working the
board, the task form) are built in the web version; the inventory says what is done.

Sources: Odoo's `project` and `hr_timesheet` modules (models, views, access rules, the kanban
JavaScript), the running Odoo as Mitchell Admin (Project Administrator) and Marc Demo (Project
User), and the database read-only.

## Decisions

### Every project save is Odoo's own method

Each task and project change nodo offers goes through Odoo's JSON-RPC as the signed-in person
(`table/odoo_call.yaml`: `execute_kw` with the model, the method and its arguments), with the
password the web sign-in keeps, and the row is read back to see that Odoo took it. Checked
against the source, every one of these writes does more than the row:

| save | Odoo method | what Odoo writes beside the row |
|---|---|---|
| move to a stage (drag, stage bar) | `project.task.write({stage_id})` | `duration_tracking` (`jsonb`: minutes in the old stage), `date_last_stage_update`, `date_end` (folded stage), state back to In Progress, the stage's customer email, a rating request (demo: "Done"), a tracking message |
| priority, state, title, deadline, milestone | `write` | a tracking message per field; for state: the stage date, Waiting while a blocker is open, the next occurrence of a recurring task, dependants recomputed |
| assignees | `write({user_ids})` | personal-stage rows, followers, the assignment notification, `date_assign` |
| tags | `write({tag_ids})` | the link table has no id: Vantage can't add rows to it |
| description | `write({description})` | `html_sanitize`, `html_field_history` (`jsonb`) |
| quick create | `create([{display_name}])` with `default_project_id` and `default_stage_id` in the context, as Odoo's kanban sends it (without the context Odoo assigns the creator and leaves `date_assign` empty) | stage, company and customer from the project, keyword parsing (#tag, @person, !), personal stages, followers, the stage's customer email, "Task Created", `duration_tracking` |
| archive, restore | `action_archive`, `action_unarchive` | sub-tasks in the same project follow |
| star a project | `toggle_favorite` | the link table has no id; Odoo writes it as superuser so Project Users may star |
| project status | `write({last_update_status})` | a `project_update` ("Status Update - <date>", progress, a description built from milestones), `last_update_id`; Project Users may do it (Odoo writes the update, not the project) |

No Project save writes a row directly. The checks nodo makes first (the task or project is one
you can see, the stage is one of the project's, the values are Odoo's) are in the actions and
`lib/project.rhai`; Odoo checks its own access again as you.

Checked on a throwaway task and project (created and deleted through Odoo's API): quick create
with `#Bug !!` gave the tag and priority High, the reception email and "Task Created"; moves
filled `duration_tracking` (`{"1": 0, "2": 0, "s": 3, …}`) and the Done stage created the
rating request; Marc (a Project User) set a status, which Odoo turned into a status update.

### Datasource rules per table

`datasource/odoo.yaml`'s rules are keyed by column (`user_id`, `project_id`) and used to apply to
every table with that column. Both scripts now branch on `table_name`: the to-do rules for the
to-do tables, Odoo's own rules for `project`, `task` and `milestone` (Project Administrators see
all; others see open projects and the private ones they are a team member of; tasks also when
they follow them or are assigned; multi-company), and a table with such a column and no branch
fails loudly instead of being narrowed by a rule written for another. Counts match Odoo: Marc
sees 6 projects and 100 project tasks, Mitchell 108, as Odoo's own `search_count` gives.

### To-do: date_end and the stage date follow Odoo

`table/todo.yaml` set `date_end` when a to-do closed. Odoo never does that for to-dos: `date_end`
follows the stage's fold flag (folded stage: now; any other: cleared), and every state change
stamps `date_last_stage_update`. The hook now does both (the fold lookup in `before_patch` and
`before_update`, as `normalise` may not read tables); scenario branches `closed-later` and
`folded-stage` cover them.

## 1. The data model as nodo would read it

### Tables

| table | what it holds | notes |
|---|---|---|
| `project_project` | projects | `name` and `label_tasks` are translated `jsonb` (`name->>'en_US'`); `alias_id` is `NOT NULL` (a `mail_alias` row per project); `privacy_visibility`, `last_update_status`, `last_update_id`, `color`, `user_id` (manager), `partner_id` (customer), `date_start`/`date` (`date`), `allow_milestones`, `allow_task_dependencies`, `allow_recurring_tasks`, `allow_timesheets`, `allocated_hours`, `account_id` (analytic account), `stage_id`, `is_template`, `active`, `sequence` |
| `project_project_stage` | stages of projects (To Do, In Progress, Done, Cancelled) | only used with the "Project Stages" setting, which is off in the demo |
| `project_task` | tasks, to-dos, sub-tasks, task templates | `name` is plain `varchar`; `stage_id` (project stage), `state`, `priority`, `milestone_id`, `parent_id`, `display_in_project`, `partner_id`, `recurrence_id`, `recurring_task`, `allocated_hours`, `color`, `displayed_image_id`; stored computed `effective_hours`, `remaining_hours`, `progress`, `total_hours_spent`, `subtask_effective_hours`, `overtime`, `working_hours_open/close`, `working_days_open/close`, `rating_last_value`; `jsonb` `duration_tracking`, `html_field_history`, `task_properties` |
| `project_task_type` | task stages | `user_id IS NULL`: a project stage, shared between projects through `project_task_type_rel`. `user_id` set: someone's personal stage (To-do's columns, and My Tasks). `name` is `jsonb`; `fold`, `sequence`, `mail_template_id`, `rating_active`, `rating_template_id`, `sms_template_id`, `auto_validation_state`, `rotting_threshold_days` |
| `project_task_type_rel` | which stages a project has (`project_id`, `type_id`) | no id column |
| `project_task_user_rel` | assignees, each with their personal stage (`task_id`, `user_id`, `stage_id`) | the table To-do already writes; project tasks have rows here too |
| `project_tags`, `project_tags_project_task_rel`, `project_project_project_tags_rel` | tags, on tasks and on projects | names `jsonb`; link tables have no id |
| `project_milestone` | milestones per project (`name`, `deadline` date, `is_reached`, `reached_date`, `sequence`) | |
| `project_update` | status updates (`status`, `progress`, `name`, `description` HTML, `date`, `user_id`, `task_count`, `closed_task_count`) | the newest is `project_project.last_update_id` |
| `project_favorite_user_rel` | who starred which project (`project_id`, `user_id`) | no id column |
| `project_allowed_internal_users_rel` | team members of private projects | no id column |
| `project_collaborator` | portal users a project is shared with (`access_mode`: view, edit, advanced_edit) | |
| `task_dependencies_rel` | "blocked by" (`task_id`, `depends_on_id`) | no id column |
| `project_task_recurrence` | repeat rules (`repeat_interval`, `repeat_unit`, `repeat_type`, `repeat_until`) | |
| `project_role`, `project_role_project_task_rel` | roles on template tasks | Odoo 20 project templates |
| `rating_rating` | customer ratings (`res_model = 'project.task'`, `parent_res_model = 'project.project'`) | |
| `account_analytic_line` | timesheet lines (`project_id`, `task_id`, `employee_id`, `unit_amount` hours, `amount` cost, `date`, `name`) | `hr_timesheet` |
| `mail_followers`, `mail_message`, `mail_activity`, `mail_alias` | followers, chatter, activities, the project's email alias | shared with To-do and CRM |

### Which rows belong to what

| rows | condition | demo |
|---|---|---|
| to-dos (To-do app) | `project_task.project_id IS NULL AND parent_id IS NULL AND is_template IS NOT TRUE` | 23 |
| project tasks on a project's board | `project_id = :p AND has_template_ancestor IS NOT TRUE AND display_in_project` (Odoo's board hides sub-tasks unless "Show Sub-tasks" is ticked) | 98, 20 of them in template projects |
| sub-tasks | `parent_id IS NOT NULL`; `display_in_project` is false while the sub-task sits in its parent's project | 13 |
| task templates and their sub-tasks | `has_template_ancestor IS TRUE` | 5 |
| projects on the overview | `project_project.is_template IS NOT TRUE AND active`, minus each company's internal project (`res_company.internal_project_id`, hidden by `hr_timesheet`) | 8 of 15 for Mitchell |
| project templates | `project_project.is_template` | 3 |
| My Tasks | `project_task_user_rel.user_id = me`, tasks with or without a project, grouped by my personal stage | |
| a project's stages | `project_task_type` joined through `project_task_type_rel`, `user_id IS NULL` | New, In Progress, Done, Cancelled (Cancelled folded); "Internal" for the internal projects |
| personal stages | `project_task_type.user_id = me` | Inbox … Cancelled, created by Odoo |

**My Tasks is To-do's board with project tasks added.** Odoo's My Tasks reads the same
assignments and personal stages, without the `project_id IS NULL` condition. The To-do board is
My Tasks narrowed to private tasks; nodo's `todo_user` rule says so in SQL
(`datasource/odoo.yaml`). A project task assigned to someone also gets a row in
`project_task_user_rel` with that person's first personal stage, so moving it on My Tasks
changes only their personal column, as for a to-do.

### Feature switches in the demo

Milestones, task dependencies and recurring tasks are on (implied by `base.group_user`).
Project stages are off. Timesheets are on (`hr_timesheet`; 801 lines on projects), so cards and
lists show hours. Customer ratings are on for the "Done" stage. Gantt, Map and timesheet grid
views are Enterprise and not installed. Sales (`sale_project`, `sale_timesheet`), Accounting,
Purchase, Manufacturing and Expenses add smart buttons and fields to projects.

### Who sees what

From `security/ir.access.csv`:

- **Projects**: Project Administrators see and change all. Everyone else with the Project app
  reads projects with visibility "All internal users" (`employees`) or "All internal users and
  invited portal users" (`portal`), and the private ones (`followers`, `invited_users`) where they
  are a team member (`project_allowed_internal_users_rel`; the manager is added automatically).
  Only administrators create, edit or archive projects. Multi-company: no company or one of the
  person's companies.
- **Tasks**: administrators see every task with a project, plus their own private ones.
  Project Users read, write and create a task when they can read its project, follow it or are
  assigned to it.
- **Stages**: everyone reads project stages; only administrators change them; each person
  changes their own personal stages.
- **Demo**: Mitchell sees 8 projects on the overview, Marc 6 ("Research & Development" and
  "After-Sales Services" are team-members-only). Monica Light has no Project group and no
  Project app. Joel Willis is a portal user (Office Design and the Acme sales-order projects
  are shared with his company).

## 2. Feature inventory

Status is for nodo as a whole. `done` here means it works today through To-do or CRM and the
Project app reuses it as is. "Reuse" names the To-do or CRM piece a row would build on
(`web/team/src/ui`, `lib/`, `table/`).

### Projects overview

| feature | Odoo | ours | status |
|---|---|---|---|
| A card per project, favourites first, then sequence and name | yes | yes, every card from one query | done |
| Projects I can see (Odoo's visibility and company rules) | yes | yes (Mitchell 8, Marc 6, as in Odoo) | done |
| Each company's internal project left out, templates left out | yes | yes | done |
| Card: name (one line, cut with "…") | yes | yes | done |
| Card: customer | yes | yes | done |
| Card: planned dates "Sep 17 → Nov 27" | yes | yes | done |
| Card: open task count with the project's task label ("18 Tasks", "3 Services"); click opens the board | yes | yes (the whole card opens it) | done |
| Card: average customer rating, smiley coloured by mood | yes, on billable projects only (Sales: `sale_project/views/project_views.xml:154`) | yes, last 30 days, billable projects only | done |
| Card: remaining allocated hours ("-184h 30m", red when over) | with timesheets; red below 0, else green | the same | done |
| Card: project email (alias) | when set | yes | done |
| Card: tags in their colours, click to change a colour; tags with no colour hidden | yes | colours in Odoo's name order, colour 0 hidden | partly (no colour change) |
| Card: next activity icon, schedule from the card | yes | `ActivityIcon` (icon only) | partly |
| Card: milestones reached "1/3", red when one is late, green when the next can be marked done | yes | yes | done |
| Card: project manager avatar | photo | initials | partly |
| Card: status dot (On Track, At Risk, Off Track, On Hold, Complete, Set Status), click to set it | yes | `ProjectStatus`, through Odoo's write (Project Users too) | done |
| Card colour (`color`) | stored and picked in the card menu, but Odoo 20 draws no stripe (a plain grey border) | not drawn either | done |
| Star a project for me, from the card or the form | yes | `FavoriteStar` on the card, through Odoo's `toggle_favorite`; no project form yet | partly |
| Card menu: Tasks, Milestones, Timesheets, Sales Orders | yes | — | not yet |
| Card menu: Updates, Tasks Analysis, Burndown Chart, Time by Stage, Customer Ratings | administrators | — | not yet |
| Card menu: colour picker, Share Project, Settings | administrators | — | not yet |
| Reorder projects by drag | yes | — | not yet |
| Status bar across the top (share of projects per status), click to filter | yes | — | not yet |
| New: "New Project" dialog (name, planned dates, project email) | administrators | — | not yet |
| New from a template (Kitchen Assembly, Product Launch Campaign, Sales Order), with roles to fill | administrators | — | not yet |
| List of projects (favourite, name, customer, company, dates, milestone, manager, tags, status, stage, View Tasks) | yes | — | not yet |
| Calendar of projects by planned dates | yes | — | not yet |
| Activity view of projects | yes | — | not yet |
| Group by stage (project stages setting) with rotting days | setting off in the demo | — | not yet |
| Search: project, tags, manager, customer (with its contacts), activities | yes | project name | partly |
| Filters: My Projects, My Favorites, Unassigned, Late Milestones, Timesheets >100 %, Start/End date, Archived | yes | — | not yet |
| Group by manager, status, tags, company | yes | — | not yet |
| Empty overview help | yes | a one-line note | partly |
| Phone layout | one column of cards | the card grid wraps to one column | done |

### A project's task board

| feature | Odoo | ours | status |
|---|---|---|---|
| A column per stage of this project, in stage order, empty ones too | yes | yes | done |
| A column for a stage of another project that still holds a card | yes | no (the card isn't shown) | not yet |
| Every card in one query, grouped into columns | n/a | yes | done |
| Column count | yes | yes | done |
| Column bar of task states (in progress, changes requested, approved, waiting, done, cancelled); click a segment to filter | yes | `ColumnProgress` with two new tones (waiting, done) | done |
| Folded stages (Cancelled), click to look inside | yes | yes (for the visit) | partly |
| A hint that a stage emails the customer or asks for a rating | no | mail icon in the column header | done (nodo only) |
| Open filter on by default (not done or cancelled) | yes | Open, Closed, All chips | done |
| Sub-tasks hidden from the board; "Show Sub-tasks" toggle | yes | yes | done |
| Card order: priority, sequence, state, deadline, newest | yes | yes | done |
| Drag a card to another stage | yes | through Odoo's write: stage date, end date, In Progress, time in stage, customer email, rating request | done |
| Reorder cards inside a column by drag | yes | — | not yet |
| Card: title, lock icon for a private task | yes | yes | done |
| Card: parent task link on a sub-task | yes | the parent's name (no link) | partly |
| Card: customer | yes | yes | done |
| Card: milestone, red when late and unreached | yes | yes | done |
| Card: deadline "In 13 days", "In 3 weeks", "2 days ago" in red, hidden when closed | Odoo's relative date (days up to 13, then weeks, months, years) | the same rules (shared with To-do's cards and list), orange for today | done |
| Card: remaining hours ("-35h" red, "14h" green) | with timesheets | yes | done |
| Card: customer rating smiley | rating stages | yes | done |
| Card: properties | yes | — | not yet |
| Card: tags in their colours, click to change a colour; tags with no colour hidden | yes | colours, colour 0 hidden | partly (no colour change) |
| Card: activity icon | yes | `ActivityIcon` | partly (no scheduling) |
| Card: sub-task counter "0/1" (active sub-tasks), click unfolds the open sub-tasks on the card, add one there | yes | the counter, active sub-tasks only | partly |
| Card: priority stars, click to change | three stars | one star with four levels (grey, half, yellow, red with "!"), through Odoo's write | partly (the user chose this star for every nodo app) |
| Card: rotting days | stage setting (0 in the demo) | — | not yet |
| Card: assignee avatars | photos | initials | partly |
| Card: state bubble, click for In Progress, Changes Requested, Approved, Cancelled, Done; a waiting task a plain hourglass with no menu | yes | `TaskState`, through Odoo's write (Odoo's answer shown: Waiting when blocked) | done |
| Card: closed tasks dimmed | yes | yes | done |
| Card: cover image | yes | — | not yet |
| Card menu: Set Cover Image, Share Task, Duplicate, colour | yes | — | not yet |
| Quick create on a column: title, assignees; Add keeps it open, Edit opens the form | yes | title; Add keeps it open, Edit creates and opens it | partly (no assignee field: use @person) |
| Quick create keywords in the title: #tag (creates missing tags), @person, ! / !! / !!! | yes | through Odoo's create | done |
| New task from a task template | yes | — | not yet |
| Add a stage (">>" at the right, "Add a Stage" in the list) | administrators | — | not yet |
| Column menu: fold, edit, delete (delete wizard moves or archives the tasks) | administrators | — | not yet |
| Reorder stages by drag | administrators | — | not yet |
| Empty board: example stage sets to pick from | yes | — | won't (demo help, not data) |
| Embedded views bar: Overview, Updates, Burndown Chart, Time by Stage | yes | — | not yet |
| Breadcrumb back to the overview | yes | yes | done |
| Phone layout | one column per screen | as CRM (shared board styles) | done |

### Task form

| feature | Odoo | ours | status |
|---|---|---|---|
| Stage bar of the project's stages, click to move, folded ones under "…", time spent in each | yes | `StageBar`, moves through Odoo; folded ones greyed, no time spent | partly |
| Personal stage bar instead, for a private task | yes | To-do's form | done |
| Title edited in place | yes | yes, kept with Save | done |
| Priority stars, state bubble beside the title; a waiting task offers only Cancelled and Done | three stars | one four-level star, `TaskState`, saved at once | partly (the user chose the single star for every nodo app) |
| Project (change it, or empty for private) | yes | shown, a link to the board | partly |
| Milestone (when the project has them), create one here | yes | pick or clear | partly (no create) |
| Assignees with avatars (required for a private task) | yes | picker with initials, through Odoo (personal stages, followers) | done |
| Project roles (on tasks of template projects) | yes | — | not yet |
| Tags: pick, create, change colour | yes | pick | partly |
| A new tag's name is unique; typing an existing name in any case reuses that tag | yes | quick create's #tag goes through Odoo, so the same; no tag create elsewhere yet | partly |
| Customer | on billable projects only (Sales) | shown on billable projects | partly (not editable) |
| Sales Order Item (billable projects, with "Non-billable" placeholder and +) | Sales | — | not yet |
| Deadline, red when past and open | yes | `DateTimePicker`, Overdue mark | done |
| Recurrent toggle with "every N days/weeks/months/years, forever or until" | yes | "Recurrent" shown when it is | partly |
| Allocated time with progress | with timesheets | allocated, %, spent, sub-tasks, remaining (read) | partly (not editable) |
| Properties (defined per project) | yes | — | not yet |
| Description as rich text, collaborative, version history | yes | the shared rich-text editor, saved through Odoo's write (sanitised there) | partly (no collaboration or history) |
| Sub-tasks tab: list with state, title, assignees, deadline, priority, stage; add a line, drag to reorder | yes | list with state, title, assignees, deadline; a click opens one | partly (no add, reorder) |
| Blocked By tab: pick the tasks this one waits for | with dependencies | the list, shown when there are any | partly (no picking) |
| Timesheets tab: date, employee, description, hours; totals and remaining | with timesheets | — | not yet |
| Extra Info (debug mode): parent, company, sequence, assign and stage dates, working time to assign and close | yes | — | not yet |
| Smart buttons: Parent Task, Sub-tasks "0/1 (0 %)", Blocked Tasks, Recurring Tasks, Last Rating | yes | — | not yet |
| Smart buttons from other apps: Sales Order, products, worksheet | other apps | — | won't (other Odoo apps) |
| Archived and Template ribbons | yes | Archived ribbon | partly |
| Action menu: Share Task, Duplicate, Archive/Unarchive, Delete, Convert to sub-task, Convert to template | yes | Archive / Unarchive (Odoo's action_archive: in-project sub-tasks follow) | partly |
| Updates live while open (board, other tabs, Odoo) | after a reload | yes (a collection of one row over NOTIFY) | done |
| Previous / next task | yes | — | not yet |
| Chatter: messages, notes, activities, followers, attachments | yes | — | not yet |
| Saves by itself when you leave | yes | Save and Discard for title, deadline, description | partly |
| Phone layout | fields stacked | shared form styles (two groups stack) | done |

### Task states and stage rules

| feature | Odoo | ours | status |
|---|---|---|---|
| Six states: In Progress, Changes Requested, Approved, Waiting, Done, Cancelled | yes | `TaskState`; Waiting shown, not offered | done |
| Moving to another stage puts an open task back to In Progress (not waiting, not closed) | yes | Odoo's write | done |
| Done and Cancelled are states, not stages; a task in the "Done" stage can be open | yes | yes | done |
| Waiting while any task it is blocked by is open; back to In Progress when they all close | with dependencies | Odoo's write | done |
| A blocked task forced to Done goes back to Waiting when reopened | yes | Odoo's write | done |
| A task created with blockers stays In Progress until its next write | yes | nodo creates no dependencies yet | not yet |
| Folded stage stamps the end date; leaving it clears it | yes | Odoo's write for project tasks; `todo` hook too | done |
| Closing the last task of a recurrence creates the next one (deadline moved on, sub-tasks copied) | yes | Odoo's write | done |
| Stage with an email template mails the customer on arrival ("New": reception email) | yes | Odoo's write and create | done |
| Stage with ratings mails the customer a rating request on arrival ("Done") | yes | Odoo's write (checked: a rating row on the throwaway) | done |
| Customer's rating answer moves the state to Approved or Changes Requested | stage option | — | won't (needs the rating mail and portal) |

### Other task views

| feature | Odoo | ours | status |
|---|---|---|---|
| List grouped by stage: title, assignees, time spent, progress bar, priority, next activity, tags, state, stage; sums per group | yes | — | not yet |
| List optional columns (customer, milestone, deadline, allocated, remaining, rating, personal stage, created on, last stage update) | yes | — | not yet |
| List: edit in place, select rows for bulk edit, archive, duplicate, delete, export | yes | — | not yet |
| Calendar by deadline (day, week, month, year), coloured, stage filter | yes | — | not yet |
| Calendar side panel of unscheduled tasks, drag one onto a day to plan it (inside a project) | yes | — | not yet |
| Activity view (tasks by activity type) | yes | — | not yet |
| Pivot and graph (stages, assignees, hours) | yes | — | not yet |
| Gantt | Enterprise | — | won't (not in Community) |
| Map of tasks or projects | Enterprise; project form's Google map | — | won't (Enterprise, external service) |

### My Tasks, All Tasks, filters

| feature | Odoo | ours | status |
|---|---|---|---|
| My Tasks: my tasks with and without a project, columns are my personal stages | yes | To-do's board, private tasks only | partly |
| My Tasks on the phone (one column per screen) | yes | To-do's phone board, private tasks only | partly |
| My Tasks card shows the project | yes | — | not yet |
| My Tasks shows sub-tasks | yes | — | not yet |
| All Tasks: every task with a project, My Tasks filter on, grouped by project | yes | — | not yet |
| Search: title, assignee, project, tags, milestone, customer (with contacts), stage, properties | yes | title and tag as To-do | partly |
| Filters: My Tasks, Unassigned, Private Tasks, Favorite Projects, priority levels | yes | — | not yet |
| Filters: Open (default), Closed, Closed On (last 30 / 365 days), Rotting | yes | Open, Done as To-do | partly |
| Filters: Deadline (period, Future, Overdue), Creation Date, Unread Messages, Templates | yes | Overdue as To-do | partly |
| Group by assignees, project, priority, deadline, milestone, stage, properties | yes | — | not yet |
| Saved searches, custom filters | yes | — | not yet |

### Project form and settings

| feature | Odoo | ours | status |
|---|---|---|---|
| Name, favourite star | yes | — | not yet |
| Customer with address, phone, email (edits the contact) | yes | — | not yet |
| Choosing a customer switches Billable on (Sales) | yes | — | not yet |
| Tags | yes | — | not yet |
| Project manager, planned dates (start and end together) | yes | — | not yet |
| Description | yes | — | not yet |
| Settings: name of tasks, project email alias, accepted senders, company | yes | — | not yet |
| Settings: visibility (team members only, plus invited portal users, all internal users, all internal plus portal) and team members | yes | — | not yet |
| Settings: recurring tasks, task dependencies, milestones switches | yes | — | not yet |
| Switching a feature on for the first project (or off for the last) changes the group of every internal user; dependencies also show or hide their mail subtypes; saving reloads menus and visibility | yes | — (through Odoo's write when built) | not yet |
| Settings: timesheets, allocated hours, analytic account | with timesheets | — | not yet |
| Invoicing tab, billable, sales order item | Sales | — | won't (other Odoo apps) |
| Smart buttons: Tasks "0/18", Status, Milestones "1/3 (33 %)", Burndown Chart, Rating | yes | — | not yet |
| Smart buttons: Estimated and Real Costs, Sales Orders, Timesheets, Invoices, Vendor Bills, Expenses | Accounting, Sales, Timesheets | — | won't (other apps), except Timesheets: not yet |
| Archived and Template ribbons | yes | reuse `Ribbon` | not yet |
| Archive / unarchive a project (its tasks follow) | administrators | — | not yet |
| Duplicate a project: tasks copied, the same stage records shared, milestones copied only with milestones on, `last_update_status` copied (not the update), followers copied | administrators | — | not yet |
| Delete a project (refused when it has timesheets; a foreign key also refuses it while it has collaborators, which a portal project with a customer gets automatically) | administrators | — | not yet |
| Convert a project to a template and back | administrators | — | not yet |
| Project stage bar (project stages setting) | setting off | — | not yet |
| Chatter on the project | yes | — | not yet |

### Status updates and milestones

| feature | Odoo | ours | status |
|---|---|---|---|
| Set the status from the card's dot: writes a "Status Update - <date>" | yes | through Odoo's write, which writes the update | done |
| Updates page: updates as cards (status, progress, author, date), right panel with tasks, milestones, profitability | yes | — | not yet |
| New update: status, progress %, description pre-filled with milestones | yes | — | not yet |
| Milestones list per project: name, deadline, reached, View Tasks; mark reached | yes | — | not yet |
| Milestone reached date stamped when ticked | yes | — | not yet |
| Late milestone marks (cards, filter) | yes | on project and task cards; no filter | partly |

### Privacy, sharing and followers

| feature | Odoo | ours | status |
|---|---|---|---|
| Who sees which project and task (visibility, team members, followers, assignees, companies) | yes | Odoo's rules in `datasource/odoo.yaml`; counts match Odoo for Mitchell and Marc | done |
| Only administrators create, edit, archive projects and stages | yes | nodo writes no project row; Odoo decides on each call | done |
| Followers of a task: creator, assignees, the parent's followers, project followers with matching subtypes | yes | Odoo's create and write add them | done |
| Followers panel: see, add, remove; project followers' preferences flow to tasks | yes | — | not yet |
| Share Project with portal users (view, edit, advanced edit), the customer added as a viewer | administrators | — | won't (portal is Odoo's website) |
| Share a task by link | yes | — | won't (portal) |
| Portal users see and edit shared tasks in Odoo's portal | yes | — | won't (portal) |
| Project email alias: incoming mail creates tasks | yes | — | won't (mail gateway) |

### Recurring tasks, dependencies, sub-tasks

| feature | Odoo | ours | status |
|---|---|---|---|
| Recurrence on a task (interval, unit, forever or until) | yes | — | not yet |
| Recurring Tasks smart button (all occurrences) | yes | — | not yet |
| Stop the recurrence (untick, or switch it off on the project) | yes | — | not yet |
| Blocked By and Blocks; cycles refused | yes | — | not yet |
| Switching dependencies off on the project frees waiting tasks | yes | — | not yet |
| Sub-tasks: add, open, convert a task to a sub-task and back | yes | — | not yet |
| A private task can't have sub-tasks | yes | — | not yet |

### Timesheets

| feature | Odoo | ours | status |
|---|---|---|---|
| Time spent, remaining and progress on cards, lists and the form | yes | project and task cards, the form; no list yet | partly |
| Log time on a task (date, employee, description, hours) | yes | — | not yet |
| Timesheets menu (my timesheets, all, reporting) | Timesheets app | — | won't (separate Odoo app) |

### Customer ratings

| feature | Odoo | ours | status |
|---|---|---|---|
| Rating smiley and average on cards, project card and form | yes | project and task cards; no form button | partly |
| Customer Ratings report per project and overall | administrators | — | not yet |
| Rating request emails and the rating page for customers | yes | — | won't (mail and website) |

### Reporting and configuration

| feature | Odoo | ours | status |
|---|---|---|---|
| Reporting and Configuration menus, shown to administrators only | yes | nodo's Project menu has Projects only | not yet |
| Tasks Analysis (pivot and graph) | administrators | — | not yet |
| Burndown Chart, Time by Stage | yes | — | not yet |
| Configuration: project stages, task stages, tags, project templates, roles, activity types and plans | administrators | — | not yet |
| Settings page (features on and off) | system administrators | — | won't (Odoo's settings stay in Odoo) |

### Shared with To-do and CRM

| feature | Odoo | ours | status |
|---|---|---|---|
| Sign in with an Odoo login and password | yes | `sign_in` | done |
| Each person's personal stages, moves for that person only | yes | `todo_move` | done |
| Tag colours in Odoo's palette | yes | `tagColors` | done |
| Priority as four levels | three stars | `Priority`, one star with four levels | partly (the user chose this star for every nodo app) |
| Times in the person's zone, stored as naive UTC | yes | native dates | done |
| Changes by others appear at once (NOTIFY) | after a reload | triggers on every table the Project pages read (`seed/notify.sql`) | done |
| App switcher entry | yes | Project tile and its menu | done |
| Previous / next, saved searches, chatter, activities | yes | — | not yet |

### Counts

| status | rows |
|---|---|
| done | 59 |
| partly | 38 |
| not yet | 84 |
| won't | 14 |

After blocks 1 to 3 and the arbiter's corrections (2026-11-21): ten defects fixed, the priority
star marked partly (the user's choice for every app), and ten behaviours added that the study
had missed. The study's first count was 6 done, 7 partly, 156 not yet.

### Side by side

Odoo on the left, nodo on the right, Mitchell Admin, 1440x900 each:
`docs/screenshots/project-overview.png`, `project-board.png`, `project-quick-create.png`,
`project-state-menu.png`, `project-status-menu.png`, `project-form.png`.

### Performance (2026-11-21)

Measured with `query_log` and `query_stats` on the local Odoo database, Office Design's board
as Mitchell Admin.

| measure | value |
|---|---|
| queries the board itself sends | 3: the project (1 row, 10 ms), its stages (4 rows, 2 ms), every card in one query (14 rows, 34 ms) |
| the overview | 1 query for every card (8 to 10 rows, 12 to 14 ms) plus the person's rights row |
| first open of each entity | the unfiltered set is read first (tasks: 100 rows, 38 ms; projects: 10 rows) before the filtered one, and stays live (FEEDBACK.md) |
| a drag to another stage | one action, 101 ms end to end: 2 reads (task 4.5 ms, stage 5.4 ms), Odoo's write over JSON-RPC, a read back. Then NOTIFY makes every open set over `project_task` re-read once: the board's 14 cards, the unfiltered 100-task set (40 to 55 ms, twice), and To-do's sets (they listen to `project_task` too) |
| queries while the board sits open | none from Project (no refresh timers; the sign-in check as for To-do) |

Gallery stories for the new shared controls (`TaskState`, `ProjectStatus`, `FavoriteStar`, and
`ColumnProgress`'s task-state tones) pass (20 tests); `web/team/e2e/project.spec.ts` (overview
counts, board, form, read-only on demo data) passes against the running app.

## 3. The writes that matter

Read from `project_task.py`, `project_project.py`, `project_update.py`,
`project_task_recurrence.py`, `project_task_type.py`, `mail_tracking_duration_mixin.py` and
`hr_timesheet/models/project_project.py`.

### Task create (`project.task.create`)

- `priority` empty becomes `"0"`; `name` taken from `display_name`, which first strips and
  applies `#tag` (missing tags created), `@person` (when one user matches) and `!`, `!!`, `!!!`.
- `stage_id`: the given column, else the project's first stage ordered by `fold, sequence, id`
  (an unfolded one first). `company_id` from the project. `partner_id` from the parent task,
  else from the project. `display_in_project` true unless the parent is in the same project.
- `date_assign = now` when it has assignees; `date_last_stage_update = now`;
  `date_end = now` if the stage is folded. `state = '01_in_progress'`, `active`, `sequence = 10`.
- Each assignee gets a `project_task_user_rel` row with their first personal stage (Odoo
  creates the seven default personal stages for someone who has none).
- Followers: the parent task's followers, then the creator. Assignees follow through
  auto-subscribe and get a "You have been assigned to …" notification. Project followers with the
  "Task Created" subtype are notified.
- If the project's visibility is `portal` or `invited_users`, the task gets an `access_token`.
- A recurrence row when `recurring_task` comes with repeat fields.
- Chatter: "Task Created" message; the stage's `mail_template_id` is sent (the demo's "New"
  stage mails the customer a reception email). `duration_tracking` starts `{"s": stage, "d": now}`.
- The stage is linked to the project (`project_task_type_rel`) if it wasn't one of its stages.

### Stage move (`write({'stage_id'})`)

- Refused for a task with no project ("You can only set a personal stage on a private task").
- `date_last_stage_update = now`; `date_end = now` if the new stage is folded, else cleared.
- An open task that isn't waiting goes back to `01_in_progress`, unless the same write sets a
  state.
- `duration_tracking` (`jsonb`): minutes in the old stage added under its id, `s` and `d` reset.
- The new stage's `mail_template_id` is sent; if the stage has `rating_active` and
  `rating_status = 'stage'`, the customer gets a rating request (demo: "Done").
- Tracking message for the stage (subtype "Stage Changed"); `write_uid`, `write_date`.
- Drag inside or between columns also resequences: `sequence` on the cards of the column.

### State change (`write({'state'})`)

- `date_last_stage_update = now` for every state change.
- **In progress, changes requested, approved**: the value as given, except that a task blocked
  by an open task is forced to `04_waiting_normal`.
- **Done, cancelled**: closed. If it is the newest task of a recurrence, the next occurrence is
  created: a copy with priority `"0"`, the project's first stage, the deadline moved by the
  interval, sub-tasks copied the same way, dependencies remapped; not after `repeat_until`.
- Tasks blocked by this one are recomputed: when all their blockers are closed, a waiting task
  goes back to In Progress; reopening a blocker puts them back to Waiting.
- `date_end` is not touched by a state change (only by folded stages). Tracking message with
  the state's subtype (Task Done, Task Canceled, …).

**A correction for To-do.** `table/todo.yaml`'s `normalise` hook sets `date_end` when a to-do is
done or cancelled and clears it when reopened. Odoo never does that for to-dos (they have no
stage); it also sets `date_last_stage_update` on every state change, which the hook doesn't. Both
should follow Odoo when the task table is shared with Project.

### Assignee change (`write({'user_ids'})`)

- New assignees: a `project_task_user_rel` row with their first personal stage; they follow the
  task and get the assignment notification. Removed assignees lose their row.
- `date_assign = now` when the task had no assignees before; cleared when the last one goes.
- Portal assignees are dropped when the task moves to a project they don't follow.
- On a private task the creator always stays assigned (To-do's rule, already in nodo).

### Project create (`project.project.create`)

- `alias_id`: a `mail_alias` row is created for the project (the column is `NOT NULL`).
- `name` and `label_tasks` (default "Tasks") stored as translated `jsonb`.
- `user_id = me` (manager), `privacy_visibility = 'portal'`, `last_update_status = 'to_define'`,
  `date_last_stage_update = now`, `sequence = 10`, `active`.
- `stage_id`: the first project stage (when the stages setting is on).
- `allow_timesheets` true: an analytic account is created and set as `account_id`.
- Task stages: the "New Project" dialog passes no stages, so the project starts with none (the
  board offers example sets). Created otherwise, it gets New, In Progress, Done, Cancelled.
- `is_favorite` from the dialog adds a `project_favorite_user_rel` row.
- Portal visibility with a customer: a `project_collaborator` row (view).
- `allowed_internal_user_ids`: the manager, for private visibilities.
- Chatter: "Project created". The creator is not subscribed (`mail_create_nosubscribe`).

### Project archive and unarchive (`write({'active'})`)

- Every task of the project, archived ones included, gets the same `active`: unarchiving brings
  back tasks that were archived on their own before.
- Archiving a single task (`action_archive`) also archives its sub-tasks that sit in the same
  project (`display_in_project` false).

### Other project writes

- **Status from the card**: a `project_update` row (`name = "Status Update - <date>"`,
  `status`, `progress` = the last update's, `user_id = me`, `date = today`, `description` from
  Odoo's template, then `task_count` and `closed_task_count`), and the project's
  `last_update_id` and `last_update_status`.
- **Favourite**: a `project_favorite_user_rel` row added or removed for me (as superuser: Project
  Users may star projects they can't edit).
- **Visibility change**: tokens cleared; to a portal visibility the customer becomes a
  collaborator and follows the tasks; away from it collaborators are removed.
- **Dependencies off**: waiting tasks back to In Progress. **Recurring off**: `recurring_task`
  false on its tasks.
- **Rename**: the analytic account is renamed when only this project uses it.

## 4. Proposed blocks

Each block ends with side-by-side screenshots against Odoo, its scenario tests and its
performance numbers, as for CRM. The first three are sized for one PR each. Blocks 1 to 3 are
built (2026-11-21); what each left out is in the inventory as `partly` or `not yet`. Next: 4.

1. **Projects overview and a project's board (read, plus drag).** The overview cards (name,
   customer, dates, open task count with the task label, tags, manager, status dot, milestones
   x/y, rating, project email), favourites first, Odoo's visibility rules, Mitchell 8 and Marc 6 as in
   Odoo. Click opens the board: columns from the project's stages, one query for the cards, the
   state bar per column, folded stages, Open by default, sub-tasks hidden, card fields (title,
   customer, milestone, deadline, remaining hours, tags, priority, assignees, state bubble,
   sub-task counter as a number). Drag to another stage with Odoo's stage write. NOTIFY triggers
   on the new tables, with the owner's consent as before.
2. **Working the board.** Priority stars and the state menu on cards (with the waiting rule),
   quick create on a column through Odoo's create (keywords for free), star a project, set its
   status from the dot.
3. **Task form.** Stage bar, title, priority, state, project (read), milestone, assignees,
   tags, customer, deadline, plain-text description, sub-tasks and blocked-by tabs (read, open),
   time spent and remaining (read), archive and restore.
4. **My Tasks and All Tasks**, with To-do's board becoming My Tasks narrowed to private tasks;
   the project shown on cards.
5. **Filters and group-bys** on the board, list and My Tasks.
6. **List view** grouped by stage, with sums.
7. **Projects: create, edit, archive** through Odoo; the project form and settings
   (visibility, team members, feature switches).
8. **Milestones and status updates**: milestone list, reached, the updates page.
9. **Sub-tasks, dependencies, recurring tasks**: add sub-tasks, edit blocked-by, recurrence.
10. **Stages**: add, rename, fold, reorder, delete.
11. **Calendar and activity views.**
12. **Timesheets on tasks**: log time through Odoo.
13. **Chatter and activities**, shared with To-do and CRM.
14. **Ratings and reporting**: ratings report, tasks analysis, burndown.

## 5. Vantage limitations foreseen

Met while building blocks 1 to 3 (details and examples in FEEDBACK.md): rows 1 to 4 as
foreseen, row 4 now handled in nodo; row 6 widened (every Project action reads a ruled table,
so only refusals made before the first read and the pure helpers in `lib/project.rhai` can be
scenario-tested); and three new ones: an entity's unfiltered set is read and kept live beside
the filtered one, an Odoo refusal comes back without Odoo's message (only "Odoo didn't accept
the change"), and a hook's error names the hook but not the cause when it was the hook itself
that broke (a `table()` read in `normalise`).

| # | limitation | where Project meets it | in nodo | framework |
|---|---|---|---|---|
| 1 | No column type writes `jsonb` | project names and task labels, stage names, tag names, task `duration_tracking` on every stage move, `html_field_history` | create and rename projects, stages and tags through Odoo's JSON-RPC; stage moves through Odoo's `write` too, so the time-in-stage figures stay right | a `json` column type |
| 2 | No insert into a link table without its own id when the chosen id repeats | favourites, a project's stages, blocked-by, team members, project tags | favourites through Odoo's `toggle_favorite`; the others through Odoo's `write` | composite keys, or insert into a narrowed link table |
| 3 | An insert-only REST table returns nothing | project create, task create, duplicate | read the new row back (newest by creator, name and project); two identical creates at once could be confused | return the response body from `insert` |
| 4 | Datasource rules are keyed by column name | the `user_id` rule would narrow `project_project` (manager) and `project_update` (author) to "mine"; the `project_id` rule would hide every project task, milestone and update | branch on `table_name` in both scripts before any Project table is added | per-table rules, or a table opt-out |
| 5 | A rule's `with_condition` write check fails on timestamps and binds dotted columns out of order | every task write touching `date_last_stage_update`, `date_end`, `date_assign`, `date_deadline` | actions check access themselves and run under rule exceptions, as To-do does | fix the write check |
| 6 | Rule `with_condition` can't run in scenario tests | the visibility rules (followers, team members, groups) | skip those scenarios and check on the live app with Mitchell and Marc | memory evaluation of SQL rules, or a test hook |
| 7 | A record ref on a query table doesn't follow changes | the task form, the project form | read a collection of one row, as CRM's form does | make refs follow |
| 8 | Query tables don't refresh when an action writes the base table (without NOTIFY) | any page over a table with no trigger yet | add each new table to `seed/notify.sql` and `postgres: listen:` | none if triggers are allowed |
| 9 | Kanban lanes can't come from a table (desktop) | stages differ per project | build Project on the web only, as CRM | lanes from a table |
| 10 | No per-viewer value in a query table without passing the viewer | "is favourite", "open for me" | encode the ids (`",2,5,"`) and match on the page, as To-do's `open_for` | session values usable in a query table's SQL (to check first) |
| 11 | Actions can't call actions inside `atomic: true` | the waiting rule and recurrence after a state change, reused by board, form and list | shared functions in `lib/project.rhai`, each action repeating its reads | none (rule is fine), document it |
| 12 | No bulk update by condition | archiving a project archives all its tasks; switching dependencies off frees all waiting tasks | through Odoo's `write` (it also handles recurrences), or a loop of single writes in an action | `update_all` on a narrowed table (to check first) |
| 13 | Mail and chatter aren't written | task created and stage messages, assignment notifications, stage email templates, rating requests | create through Odoo; stage moves through Odoo (row 1); direct writes leave no chatter line, recorded per row in the inventory | out of scope for the framework; Odoo's API covers it |
| 14 | Odoo's stored computed fields after timesheet writes | `effective_hours`, `remaining_hours`, `progress`, `total_hours_spent`, `subtask_effective_hours`, `overtime`, the line's `amount` | log time through Odoo's API only | none |
| 15 | Rich text is written as escaped plain text | task and project descriptions, update descriptions | as To-do: plain text in, formatting lost on save | an HTML field with a sanitiser |

Rows 1, 2, 3 and 13 together decide the write path: task create, stage moves, project create,
favourites and anything touching a link table go through Odoo's JSON-RPC as the signed-in
person (the password kept with the web sign-in, as for tags and CRM). State, priority,
deadline, title, description, assignees (To-do's action, without the private-task conditions)
and milestones write the rows directly. Moving stages directly instead would be faster and
match CRM, at the cost of stale time-in-stage figures and no stage emails or rating requests;
that choice is open for block 1.
