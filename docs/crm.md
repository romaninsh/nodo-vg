# CRM: porting decisions

Odoo's CRM keeps opportunities in `crm_lead` (`type = 'opportunity'`; leads are the same table
with `type = 'lead'`), its pipeline columns in `crm_stage`, lost reasons in `crm_lost_reason`,
tags in `crm_tag` with the link table `crm_tag_rel`, and sales teams in `crm_team` and
`crm_team_member`. nodo reads and writes those tables as they are. Each decision below is about
one place where Odoo's save does more than a row write.

## 1. What a stage change, Won, Lost and Restore write

Odoo's `crm.lead.write()` stamps more than the stage. nodo does the same, split by what each
part needs:

- **Same-row rules in the `lead` table's hooks** (`table/lead.yaml`), keyed on the fields a save
  actually changes, as Odoo keys on `vals`: a new stage sets `date_last_stage_update`; a won
  stage also sets `active`, `probability = 100` and `automated_probability = 100`; reaching
  100 % or archiving sets `date_closed` (to the second, as Odoo does; moving between two won
  stages keeps the first one); a stage change that doesn't win, or a probability above 0,
  clears it. Then the stored computed fields: `won_status` (won, lost, pending), the prorated
  revenues and `day_close`, plus `write_uid` and `write_date`.
- **Predictive lead scoring in the actions** (`lib/crm.rhai`), because it reads other tables.
  Odoo 20 has no probability per stage: a naive Bayes over `crm_lead_scoring_frequency`, the
  won and lost tallies per sales team for the stage and the fields in `crm.pls_fields`
  (`phone_state`, `email_state`, `state_id`, `country_id`, `source_id`, `lang_id`, tags). A move
  recomputes `automated_probability` for the new stage, and the probability follows it when it
  followed it before. Becoming won counts as won for every stage, becoming lost as lost for its
  stage and the earlier ones, and reopening takes that back. Restore and Won-from-lost
  unarchive first and score afterwards, as Odoo does; a move out of Won scores with the
  tallies before they are taken back, as Odoo does.
- **Checked against Odoo**: a move, Lost with a reason, Restore, Won and a move out of Won were
  each done once through Odoo's own API and once through nodo, from the same starting point.
  The rows and the whole frequency table came out the same, field for field, except
  `duration_tracking` (below). An independent 12-step paired test on throwaway opportunities
  matched every column at every step. Archive and Unarchive were checked the same way on a
  throwaway pair (Odoo's unarchive writes the rescored probability, which clears the closing
  date; nodo's does too).

**`duration_tracking` isn't written.** Odoo keeps the minutes spent in each stage in a `jsonb`
column; Vantage has no column type that writes `jsonb` yet (FEEDBACK.md). After a nodo move,
Odoo's stage bar shows the old time-in-stage figures. Rotting doesn't depend on it.

**Chatter isn't written.** Odoo logs every tracked change (stage, salesperson, won, lost) as a
message, and the lost dialog's closing note goes into that message. nodo writes no messages yet,
so a change made in nodo has no line in Odoo's chatter, and nodo's lost dialog has no closing
note.

## 2. What goes through Odoo itself

Some saves run library code or link tables that Vantage can't write. These go through Odoo's
JSON-RPC as the signed-in person, with the password the server keeps with the web sign-in (as
for To-do's tags), and nodo reads the row back to see that Odoo took it:

- **New opportunities** (quick create): Odoo's create fills the sales team, the company, the
  stage, the scoring, contact details from the customer, the followers and the "Opportunity
  Created" message. nodo creates through `crm.lead.create` and finds the new row afterwards.
- **Contact, email, phone**: picking a contact copies its name, company, email, phone and
  address; an email or phone typed on the opportunity is normalised, checked (with the
  `phonenumbers` library) and copied back to the contact.
- **Salesperson and sales team**: the new salesperson becomes a follower, the assignment date
  is set and the team follows the salesperson.
- **Tags**: `crm_tag_rel` has no id column.

## 3. Who sees what

Odoo's own groups decide, read from the database with implied groups followed
(`table/sales_right.yaml`, and the `user_id` rule in `datasource/odoo.yaml`): Sales "User: Own
Documents Only" sees their own and unassigned opportunities, "User: All Documents" and
Administrator see all, anyone without a Sales group sees none. Marc Demo sees 8 opportunities,
Mitchell Admin 18, Monica Light none, as in Odoo. The CRM actions check the same rights before
they write; only Administrator may delete, as Odoo's salesperson groups have no delete right.

The demo has three companies (San Francisco, US Company, Chicago), and Mitchell and Marc are
allowed in all three. Odoo's multi-company rule applies too: an opportunity with no company,
or one of the person's allowed companies (`res_company_users_rel`). Odoo narrows further to
the companies ticked in its company switcher; nodo has no switcher and uses all allowed ones.
The form's Extra Info shows the Company, saved through Odoo. Amounts are in the opportunity's
company currency, or the person's own company's when it has none.

## 4. Live updates

`seed/notify.sql` has a statement-level `NOTIFY` trigger on every CRM table the pipeline and
the form show (`crm_lead`, `crm_stage`, `crm_stage_crm_team_rel`, `crm_tag`, `crm_tag_rel`,
`crm_lost_reason`, `crm_team`, `crm_team_member`, `mail_activity`); the query tables list them
under `postgres: listen:`. No refresh timers.

The pipeline and the form both read live collections, so a change made anywhere (the form's
own buttons, the board, another tab, Odoo) shows within a moment. The form first read its row
as a single record, which never updated after it opened (found by the arbiter: after Won the
stage bar still showed the old stage); it now reads a collection of one row, as the board does.
Checked on a throwaway opportunity: nodo's Won, a stage click, Lost and Restore, and a revenue
and probability change written through Odoo's own API, each showed on the open form.

## Feature inventory

Odoo 20 CRM compared with nodo's web version on 2026-11-21, from Odoo's views and models
(`crm_lead_views.xml`, `crm_lead.py`, `crm_lead_lost.py`, the kanban JavaScript) and both apps
running on the same database as Mitchell Admin. The desktop app has no CRM pages yet.

### Pipeline board

| feature | Odoo | nodo | status |
|---|---|---|---|
| A column per stage, in stage order, empty ones too | yes | yes | done |
| Stages limited to the chosen team's (or shared) | yes | yes | done |
| All Teams: shared stages, the person's own teams' stages, and any stage holding a card | yes | yes | done |
| Every card in one query, grouped into columns | n/a | yes | done |
| Drag a card to another stage | yes | yes, with Odoo's stage write | done |
| Drag into Won: rainbow man with a message about the deal | yes (messages by revenue records, first deal, …) | a "Won. Congratulations!" toast | partly |
| Column total of expected revenue | yes | yes | done |
| Column total abbreviated ("$ 104k") | yes | full amount ("$ 104,000") | partly |
| Totals across companies with different currencies | converted to the person's company currency | summed as they are (all demo companies use USD) | partly |
| Recurring revenue (MRR) beside the total | with the recurring revenues setting | no | not yet (setting off in the demo) |
| Column activity bar: planned, today, overdue, none | yes | yes | done |
| Click a bar segment to show only those cards; total follows | yes | yes | done |
| Rotting count in the column header; a click shows only the rotting cards (total unchanged) | yes | yes | done |
| Stage requirements as the header's tooltip | yes | yes | done |
| Folded stages, click to look inside | yes | yes (for the visit) | partly |
| Fold, edit or delete a stage from the column menu | yes | no | not yet |
| Add a stage ("Add column") | yes | no | not yet |
| Reorder columns by drag | yes | no | not yet |
| Card order: priority, then newest | yes | yes | done |
| New card shown at the top of its column until reload | yes | sorted in with the others | partly |
| Sample cards on an empty pipeline | yes | no | won't (demo help, not data) |
| Phone layout: one column per screen, swipe between | yes | yes | done |

### Cards

| feature | Odoo | nodo | status |
|---|---|---|---|
| Name | yes | yes | done |
| Expected revenue (only when not zero), in the opportunity's company currency | yes | yes | done |
| Customer: contact with avatar, else contact name, else company name | yes (logo or photo) | yes (initials) | partly |
| Tags in their colours | yes | yes (teal and violet a shade darker, for contrast) | done |
| Click a tag to change its colour | yes | yes | done |
| Priority | three stars | one star per level (outline, half, full, red "!"), click picks one of the four | done |
| Next activity icon by type, coloured by state | yes | yes | done |
| Schedule or mark an activity from the card | yes | no | not yet |
| Rotting days badge | yes | yes | done |
| Sales team badge (when all teams show) | yes | yes | done |
| Salesperson avatar | photo | initials | partly |
| Lost and Archived ribbons | yes | yes | done |
| Card menu: edit, delete, colour | yes | no | not yet |
| Properties | yes | no | not yet |
| Click opens the form | yes | yes | done |

### Quick create

| feature | Odoo | nodo | status |
|---|---|---|---|
| "+" on a column, New in the first open column | yes | yes | done |
| Contact, name, email, phone, expected revenue, priority | yes | yes | done |
| Picking a contact fills email and phone | yes | yes | done |
| No name: "<contact>'s opportunity" | yes | yes | done |
| Add keeps the box open for the next | yes | yes | done |
| Edit opens the full form unsaved; discarding there creates nothing | yes | yes | done |
| Picking a contact overwrites email and phone already typed | yes | fills only empty ones | partly |
| Create a new contact from the box | yes | no | not yet |
| Saved the way Odoo saves it (team, stage, scoring, followers) | yes | through Odoo's own create | done |

### Opportunity form

| feature | Odoo | nodo | status |
|---|---|---|---|
| Stage bar, click to move | yes | yes | done |
| Folded stages collapsed into "…" on the stage bar | yes | greyed, shown in full | partly |
| Rotting days pill on the current stage | yes | yes | done |
| Time spent in each stage on the stage bar | yes | no (`duration_tracking` not written) | not yet |
| Won, Lost, Restore buttons by status | yes | yes | done |
| Hotkeys: Alt+W Won, Alt+L Lost, Alt+X Restore | yes | yes | done |
| Updates live while open (own actions, the board, Odoo) | yes (after its own actions; others' after a reload) | yes | done |
| Action menu: Duplicate (Odoo's copy rules) | yes | yes, through Odoo's own copy | done |
| Action menu: Archive and Unarchive | yes | yes, same rows | done |
| Action menu: Delete, for Sales administrators only | yes | yes, through Odoo's own unlink | done |
| Action menu: Mark Lost | yes | yes | done |
| Action menu: Send email, Send SMS, Edit properties | yes | no | not yet |
| Won, Lost, Archived ribbons | yes | yes | done |
| Name | yes | yes | done |
| Expected revenue "at" probability | yes | yes | done |
| Probability editable only while ongoing | yes | yes | done |
| Automated probability hint, click to use it | yes | yes | done |
| Why the probability is what it is (scoring tooltip) | yes | no | not yet |
| Contact: pick one | yes | yes, saved through Odoo | done |
| Contact: create one, show identifier | yes | no | not yet |
| Email and phone, saved to the contact too | yes | yes, saved through Odoo | done |
| Blacklisted email or phone, "will update the contact" warning | yes | no | not yet |
| Lost reason (when lost) | yes | yes | done |
| Salesperson with avatar | yes | yes, saved through Odoo | done |
| Expected closing date | yes | yes | done |
| Priority beside it | yes | yes | done |
| Tags: pick existing | yes | yes, saved through Odoo | done |
| Tags: create one | yes | no | not yet |
| Notes as rich text | yes | plain text, formatting lost on save | partly |
| Extra info: marketing (campaign, medium, source, referred) | yes | shown, not editable | partly |
| Extra info: company and contact details (debug mode) | yes | no | not yet |
| Extra info: Company (multi-company) | yes | yes, saved through Odoo | done |
| Extra info: sales team | yes | yes, saved through Odoo | done |
| Recurring revenue and plan | with the setting | no | not yet (setting off in the demo) |
| Smart buttons: meetings, similar leads | yes | no | not yet |
| Similar leads count includes records the person can't see (Odoo counts as superuser) | yes | no | not yet |
| New Quotation, Quotations (Sales app), Enrich (IAP) | other apps | no | won't (other Odoo apps) |
| Previous / next record | yes | no | not yet |
| Save on leaving, discard | yes | Save and Discard | partly |
| Chatter (messages, notes, activities, followers) | yes | no | not yet |
| Phone layout: fields stacked | yes | yes | done |
| Phone layout: stage bar as "> Stage", extra buttons in a menu | yes | yes (Lost moves to the gear menu) | done |
| Phone layout: smart buttons behind a grid button | yes | no smart buttons yet | not yet |
| Merge with similar opportunities | yes | no | not yet |

### Won and lost

| feature | Odoo | nodo | status |
|---|---|---|---|
| Won: unarchive, the next won stage, 100 %, closing date, scoring tallies | yes | yes, same rows | done |
| Lost dialog with reasons as badges | yes | yes | done |
| Lost without a reason | yes | yes | done |
| Lost: archived, 0 %, reason kept, closing date, scoring tallies | yes | yes, same rows | done |
| Closing note | in the chatter | no | not yet (chatter) |
| Restore: unarchive, reason cleared, automated probability | yes | yes, same rows | done |
| Mark several as lost from the list | yes | no | not yet |
| Lost reasons: manage | yes | no | not yet |

### List

| feature | Odoo | nodo | status |
|---|---|---|---|
| Opportunity, contact, email, salesperson, revenue (summed), stage | yes | no | not yet |
| Optional columns, grouping, inline edit, bulk actions | yes | no | not yet |
| Row actions: reschedule activity, send email | yes | no | not yet |
| Mass email and SMS to selected opportunities | yes | no | not yet |
| Sort by My Deadline (my next activity) | yes | no | not yet |

### Activities

| feature | Odoo | nodo | status |
|---|---|---|---|
| Activity view (opportunities by activity type) | yes | no | not yet |
| My Activities menu | yes | no | not yet |

### Search and filters

| feature | Odoo | nodo | status |
|---|---|---|---|
| My Pipeline by default | yes | yes | done |
| Unassigned | yes | yes | done |
| Everyone's | remove the filter | "Everyone" chip | done |
| Ongoing, Won, Lost, Rotting | yes | yes | done |
| Open opportunities, creation and closing date filters, activity filters | yes | no | not yet |
| Filters combine (mine or unassigned, …) | yes | one chip per group | partly |
| Search across name, contact, company, email | yes | yes | done |
| Search by tag, salesperson, team, country, phone | yes | no | not yet |
| Search by stage, city, activity state, properties | yes | no | not yet |
| Search a customer including its contacts (child_of) | yes | no | not yet |
| Unread Messages filter | yes | no | not yet (chatter) |
| Group by salesperson, team, city, … on the board | yes | stage only | not yet |
| Team switcher ("All Teams"), only shown with two teams or more | yes | yes | done |
| Team switcher lists the person's own teams (all with "All Documents") | yes | yes | done |
| A team's pipeline includes opportunities with no team sitting in its stages | yes | yes | done |
| The chosen team is remembered across reloads | yes | yes (this browser) | done |
| "Manage Teams" in the switcher | yes | no | not yet |
| Saved searches | yes | no | not yet |

### Sales teams, leads, the rest

| feature | Odoo | nodo | status |
|---|---|---|---|
| Who sees what: Odoo's Sales groups | yes | yes, read from Odoo's groups | done |
| Delete only for Sales administrators | yes | yes | done |
| Multi-company rule (allowed companies) | yes | yes | done |
| Company switcher narrowing to the ticked companies | yes | all allowed companies | partly |
| Teams overview (Sales > Teams) | yes | no | not yet |
| No Configuration menu and no Manage Teams for a plain salesperson | yes | nodo has no configuration at all yet | not yet |
| Scoring settings (fields, start date) and "Update Probabilities" | yes (CRM settings) | read, not editable | not yet |
| Leads (separate menu, convert to opportunity) | with the leads setting | no | not yet (setting off in the demo) |
| My Activities | yes | no | not yet |
| Calendar, pivot, graph, forecast, reporting | yes | no | not yet |
| Configuration: stages, tags, lost reasons, teams | yes | no | not yet |
| Lead generation, enrichment, email aliases | IAP and mail | no | won't (paid services, mail gateway) |
| Changes by others appear live, on the board and on an open form | after a reload | at once (NOTIFY) | done |
| App switcher entry | yes | yes | done |

### Next blocks

1. **List view** with the sum row, optional columns and grouping.
2. **Activities**: schedule from the card and the form, the activity popover, My Activities.
3. **Chatter**: messages and notes, change tracking, the lost closing note.
4. **Filters**: combined filters, dates, group-by on the board, search by field.
5. **Leads**: the leads setting, lead list and form, convert to opportunity.
6. **Configuration**: stages (with fold), tags, lost reasons, teams.

## Testing on Odoo's data

Writes are tried on throwaway opportunities created through Odoo's API and deleted afterwards,
never on demo rows. A won or lost throwaway changes the scoring tallies, and deleting it doesn't
take that back (Odoo's unlink doesn't either), so each test also reopens what it won or lost and
compares the tally table with a snapshot taken before. Rows Odoo adds at 0.1 / 0.1 on the way
are removed. The demo rows the first comparison runs changed were put back from the seed image
on 2026-11-21 (lead and partner columns, tracking messages, tallies), checked column by column
against a container started from `ghcr.io/romaninsh/nodo-vg-db:local`.

## Performance (2026-11-21)

Measured with `query_log` and `query_stats` against the local Odoo database, the pipeline open
as Mitchell Admin (10 cards in My Pipeline).

| measure | value |
|---|---|
| queries the pipeline itself sends | 6: opportunities (one query for every card), stages, teams, tags, and the person's own rights row (teams, currency) |
| the opportunities query | 5 to 9 ms for 10 cards, 9 to 15 ms for all 18 |
| database time for those | about 27 ms |
| the whole page load | 13 queries, about 90 ms: the 6 above, To-do's 6 entities the API sends at every connect, and the sign-in check |
| a drag to another stage | one action: 12 reads (rights, stage, settings, stages, tags, tallies twice, the opportunity) and one write; about 85 ms in the database, 37 of it the write. Every open pipeline then re-reads its one query (5 ms) |
| queries while the pipeline sits open | none from CRM (the sign-in check runs twice a minute, as for To-do) |
| sign-in to a full board | 1.6 to 2.5 s for the sign-in itself (Odoo's 600,000-round password hash, on the 1.14.9 dev build), then about 330 ms to the cards |

Two fixes came out of measuring: the CRM entities were first sent in full at every connect
(`load: instant`), To-do users included, and now load when a CRM page reads them; and the
currency row, a query table with nothing to listen to, was re-read every 10 seconds by every
client until it listened (to tables without triggers).

An intermittent "empty board right after sign-in" in the arbiter's runs (2 of 12) was a reload
made while the sign-in was still running: the scripts waited a fixed 2.5 s after "Log in", and
the sign-in takes up to that long here, so the page came back on the sign-in form. Over 40
further runs (admin and Marc, with and without a remembered team, with and without the
reload) every finished sign-in showed its cards; the WebSocket frames show the opportunities
arriving about 90 ms after the board asks for them, and no entity waiting on another. The e2e
spec now checks that the cards show within 5 s of a finished sign-in, before and after a
reload.
