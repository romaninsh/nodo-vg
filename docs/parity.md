# To-do: parity with Odoo

Written by `scripts/parity.py` from [todo.md](todo.md) and [parity-map.yaml](parity-map.yaml);
don't edit by hand.

**Complete** counts a feature as 1 when done, ½ when partly done and 0 when not yet; features
nodo won't build are left out. **Lines** are every line of the files that serve a section;
a file serving several sections is split by an estimated share. Odoo's side is the app code
To-do uses (the project_todo addon and the parts of project and mail it relies on), counted
on 2026-11-28 in `odoo:20.0`. Neither side counts its framework (Odoo's ORM
and web client; Vantage).

**Of it, mail** is the part of Odoo's lines in the mail and mail_tracking addons, which every
Odoo app shares (chatter, followers, activities); To-do gets them without code of its own.

| Section | Features | Done | Partly | Not yet | Won't | Complete | Odoo backend | Odoo frontend | of it, mail | nodo backend | nodo frontend |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Board | 21 | 9 | 10 | 2 | 0 | 67% | 191 | 378 | 288 | 274 | 605 |
| List | 12 | 4 | 3 | 5 | 0 | 46% | 27 | 289 | 222 | 106 | 198 |
| Form | 17 | 11 | 3 | 2 | 1 | 78% | 146 | 145 | 0 | 348 | 431 |
| Search and filters | 12 | 6 | 2 | 4 | 0 | 58% | 109 | 0 | 52 | 27 | 62 |
| Stages | 9 | 6 | 3 | 0 | 0 | 83% | 275 | 24 | 0 | 214 | 105 |
| Tags | 5 | 3 | 1 | 1 | 0 | 70% | 63 | 0 | 0 | 112 | 126 |
| Assignees | 6 | 3 | 1 | 2 | 0 | 58% | 128 | 424 | 435 | 248 | 166 |
| Activities and chatter | 10 | 3 | 2 | 5 | 0 | 40% | 5,359 | 7,104 | 11,955 | 441 | 199 |
| Other | 14 | 4 | 5 | 2 | 3 | 59% | 426 | 114 | 0 | 58 | 99 |
| Shared |  |  |  |  |  |  | 0 | 0 | 0 | 391 | 556 |
| **All** | **106** | **49** | **30** | **23** | **4** | **63%** | **6,724** | **8,478** | **12,952** | **2,219** | **2,547** |

## Files per section

### Board

| Odoo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `project_todo/views/project_task_views.xml` (todo kanban view, quick create form) | backend | 0.24 | 342 | 82 |
| `project/models/project_task.py` (personal stage grouping, quick-add parsing, colour, order) | backend | 0.045 | 2,414 | 109 |
| `project_todo/static/src/components/todo_done_checkmark/todo_done_checkmark.js` (checkmark on the card) | frontend | 0.4 | 76 | 30 |
| `project/static/src/views/project_task_kanban/project_task_kanban_view.js` (task kanban wiring) | frontend | 0.6 | 18 | 11 |
| `project/static/src/views/project_task_kanban/project_task_kanban_renderer.js` (renderer setup) | frontend | 0.3 | 36 | 11 |
| `project/static/src/views/project_task_kanban/project_task_kanban_model.js` (_webReadGroup) | frontend | 0.15 | 94 | 14 |
| `project/static/src/components/done_checkmark/task_done_checkmark.scss` (done button styles) | frontend | 0.4 | 26 | 10 |
| `project/static/src/views/components/project_task_template_dropdown.js` (plain New button) | frontend | 0.1 | 138 | 14 |
| `mail/static/src/views/web/fields/kanban_activity/kanban_activity.js` (card activity widget) | frontend | 1 | 39 | 39 |
| `mail/static/src/core/web/activity_button.js` (card activity clock) | frontend | 0.6 | 112 | 67 |
| `mail/static/src/core/web/activity_list_popover.js` (card activity popover) | frontend | 0.5 | 67 | 34 |
| `mail/static/src/core/web/activity_list_popover.xml` | frontend | 0.5 | 49 | 24 |
| `mail/static/src/core/web/activity_list_popover_item.js` | frontend | 0.5 | 179 | 90 |
| `mail/static/src/core/web/activity_list_popover_item.xml` | frontend | 0.5 | 68 | 34 |

| nodo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `page/board.yaml` | backend | 1 | 99 | 99 |
| `table/card.yaml` | backend | 1 | 52 | 52 |
| `action/todo_move.yaml` | backend | 1 | 20 | 20 |
| `action/todo_quick_add.yaml` | backend | 1 | 41 | 41 |
| `action/todo_set_color.yaml` | backend | 1 | 17 | 17 |
| `action/todo_set_priority.yaml` | backend | 0.4 | 26 | 10 |
| `action/todo_toggle_done.yaml` | backend | 0.4 | 22 | 9 |
| `lib/todo.rhai` (keywords() for quick add) | backend | 0.22 | 116 | 26 |
| `web/team/src/pages/Board.tsx` (board) | frontend | 0.84 | 576 | 484 |
| `web/team/src/ui/Priority.tsx` | frontend | 0.34 | 80 | 27 |
| `web/team/src/ui/DoneCheck.tsx` | frontend | 0.34 | 17 | 6 |
| `web/team/src/styles.css` (kanban and card rules) | frontend | 0.2 | 443 | 89 |

### List

| Odoo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `project_todo/views/project_task_views.xml` (todo list view) | backend | 0.08 | 342 | 27 |
| `project_todo/static/src/components/todo_done_checkmark/todo_done_checkmark.js` (checkmark in the row) | frontend | 0.3 | 76 | 23 |
| `project_todo/static/src/views/todo_list/todo_list_controller.js` (bulk actions on selected rows) | frontend | 1 | 13 | 13 |
| `project_todo/static/src/views/todo_list/todo_list_view.js` | frontend | 1 | 12 | 12 |
| `project/static/src/components/task_list_renderer.js` (Add a line) | frontend | 1 | 20 | 20 |
| `mail/static/src/views/web/fields/list_activity/list_activity.js` (activities column) | frontend | 1 | 62 | 62 |
| `mail/static/src/views/web/fields/list_activity/list_activity.xml` | frontend | 1 | 17 | 17 |
| `mail/static/src/core/web/activity_button.js` | frontend | 0.3 | 112 | 34 |
| `mail/static/src/core/web/activity_list_popover.js` | frontend | 0.3 | 67 | 20 |
| `mail/static/src/core/web/activity_list_popover.xml` | frontend | 0.3 | 49 | 15 |
| `mail/static/src/core/web/activity_list_popover_item.js` | frontend | 0.3 | 179 | 54 |
| `mail/static/src/core/web/activity_list_popover_item.xml` | frontend | 0.3 | 68 | 20 |

| nodo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `page/todos.yaml` | backend | 1 | 59 | 59 |
| `table/todo_open.yaml` | backend | 1 | 33 | 33 |
| `action/todo_set_priority.yaml` | backend | 0.3 | 26 | 8 |
| `action/todo_toggle_done.yaml` | backend | 0.3 | 22 | 7 |
| `web/team/src/pages/TodoList.tsx` (rows and groups) | frontend | 0.7 | 206 | 144 |
| `web/team/src/ui/Priority.tsx` | frontend | 0.33 | 80 | 26 |
| `web/team/src/ui/DoneCheck.tsx` | frontend | 0.33 | 17 | 6 |
| `web/team/src/styles.css` (list and group rules) | frontend | 0.05 | 443 | 22 |

### Form

| Odoo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `project_todo/views/project_task_views.xml` (todo form view) | backend | 0.18 | 342 | 62 |
| `project/models/project_task.py` (title, description, priority, state, deadline fields; description history) | backend | 0.035 | 2,414 | 84 |
| `project_todo/static/src/components/todo_done_checkmark/todo_done_checkmark.js` (checkmark on the form) | frontend | 0.3 | 76 | 23 |
| `project_todo/static/src/views/todo_form/todo_form_view.js` | frontend | 1 | 14 | 14 |
| `project_todo/static/src/views/todo_form/todo_form_controller.js` (version history) | frontend | 0.45 | 112 | 50 |
| `project_todo/static/src/views/todo_form/todo_form_controller.scss` | frontend | 1 | 12 | 12 |
| `project_todo/static/src/scss/todo.scss` (title, ribbon, state styles) | frontend | 0.55 | 30 | 16 |
| `project/static/src/components/project_task_priority_switch_field/project_task_priority_switch_field.js` (priority with Alt+R) | frontend | 1 | 29 | 29 |

| nodo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `page/todo.yaml` | backend | 1 | 111 | 111 |
| `table/todo.yaml` | backend | 1 | 79 | 79 |
| `table/stage_bar.yaml` | backend | 1 | 24 | 24 |
| `action/todo_create.yaml` | backend | 1 | 44 | 44 |
| `action/todo_save.yaml` | backend | 1 | 51 | 51 |
| `action/todo_edit_form.yaml` | backend | 1 | 13 | 13 |
| `action/todo_new_form.yaml` | backend | 1 | 12 | 12 |
| `action/todo_set_priority.yaml` | backend | 0.3 | 26 | 8 |
| `action/todo_toggle_done.yaml` | backend | 0.3 | 22 | 7 |
| `web/team/src/pages/TodoForm.tsx` (editor) | frontend | 0.52 | 466 | 242 |
| `web/team/src/ui/Priority.tsx` | frontend | 0.33 | 80 | 26 |
| `web/team/src/ui/DoneCheck.tsx` | frontend | 0.33 | 17 | 6 |
| `web/team/src/ui/DateTimePicker.tsx` | frontend | 1 | 41 | 41 |
| `web/team/src/styles.css` (sheet) | frontend | 0.26 | 443 | 115 |

### Search and filters

| Odoo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `project_todo/views/project_task_views.xml` (todo search view: filters, group-bys) | backend | 0.11 | 342 | 38 |
| `project/models/project_task.py` (_search_is_closed) | backend | 0.008 | 2,414 | 19 |
| `mail/models/mail_activity_mixin.py` (activity filter searches) | backend | 0.1 | 519 | 52 |

| nodo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `table/todo_archived.yaml` | backend | 1 | 27 | 27 |
| `web/team/src/pages/TodoList.tsx` (filter chips and group-by) | frontend | 0.3 | 206 | 62 |

### Stages

| Odoo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `project/models/project_task_stage_personal.py` (personal stage per task and user) | backend | 1 | 20 | 20 |
| `project/models/project_task_type.py` (personal stage fields, rules, deletion) | backend | 0.45 | 239 | 108 |
| `project/models/res_users.py` (7 default stages for a new user) | backend | 0.35 | 44 | 15 |
| `project/models/project_task.py` (personal_stage_* fields and defaults) | backend | 0.035 | 2,414 | 84 |
| `project/views/project_task_type_views.xml` (edit a column) | backend | 0.25 | 148 | 37 |
| `project_todo/security/ir.access.csv` | backend | 0.08 | 39 | 3 |
| `project/security/ir.access.csv` | backend | 0.05 | 147 | 7 |
| `project/static/src/views/project_task_kanban/project_task_kanban_renderer.js` (add a column) | frontend | 0.3 | 36 | 11 |
| `project/static/src/views/project_task_kanban/project_task_group_config_menu.js` (edit or delete a column) | frontend | 0.4 | 32 | 13 |

| nodo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `table/stage.yaml` | backend | 1 | 35 | 35 |
| `table/stage_names.yaml` | backend | 1 | 20 | 20 |
| `table/stage_open.yaml` | backend | 1 | 18 | 18 |
| `action/stage_create.yaml` | backend | 1 | 26 | 26 |
| `action/stage_rename.yaml` | backend | 1 | 18 | 18 |
| `action/stage_delete.yaml` | backend | 1 | 30 | 30 |
| `action/stage_fold.yaml` | backend | 1 | 15 | 15 |
| `action/stage_reorder.yaml` | backend | 1 | 23 | 23 |
| `action/stage_defaults.yaml` | backend | 1 | 29 | 29 |
| `web/team/src/pages/Board.tsx` (add) | frontend | 0.16 | 576 | 92 |
| `web/team/src/styles.css` (column management rules) | frontend | 0.03 | 443 | 13 |

### Tags

| Odoo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `project/models/project_tags.py` (tags, default colour, recent tags first, create from name) | backend | 0.5 | 119 | 60 |
| `project_todo/security/ir.access.csv` | backend | 0.08 | 39 | 3 |

| nodo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `table/tag.yaml` | backend | 1 | 26 | 26 |
| `table/todo_tag.yaml` | backend | 1 | 14 | 14 |
| `action/tag_create.yaml` | backend | 1 | 24 | 24 |
| `action/tag_set_color.yaml` | backend | 1 | 16 | 16 |
| `action/todo_set_tags.yaml` | backend | 1 | 22 | 22 |
| `action/todo_tags_form.yaml` | backend | 1 | 10 | 10 |
| `web/team/src/pages/TodoForm.tsx` (TagPicker) | frontend | 0.09 | 466 | 42 |
| `web/team/src/ui/MultiPicker.tsx` | frontend | 0.5 | 99 | 50 |
| `web/team/src/components.tsx` (TagPills) | frontend | 0.5 | 42 | 21 |
| `web/team/src/styles.css` (chips and swatches) | frontend | 0.03 | 443 | 13 |

### Assignees

| Odoo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `project_todo/security/ir.access.csv` (each person sees their own to-dos) | backend | 0.7 | 39 | 27 |
| `project/models/project_task.py` (user_ids, self-assign, assignment notification and followers) | backend | 0.03 | 2,414 | 72 |
| `project/data/mail_template_data.xml` (assignment notification) | backend | 0.13 | 137 | 18 |
| `mail/models/res_users.py` (avatar card fields) | backend | 0.015 | 722 | 11 |
| `mail/static/src/views/web/fields/many2many_avatar_user_field/many2many_avatar_user_field.js` (assignee avatars) | frontend | 0.8 | 127 | 102 |
| `mail/static/src/views/web/fields/many2many_avatar_user_field/many2many_avatar_user_field.xml` | frontend | 0.8 | 20 | 16 |
| `mail/static/src/views/web/fields/many2many_avatar_user_field/many2many_avatar_user_field.scss` | frontend | 0.8 | 26 | 21 |
| `mail/static/src/views/web/fields/assign_user_command_hook.js` (assign commands) | frontend | 0.5 | 167 | 84 |
| `mail/static/src/views/web/fields/avatar_autocomplete/avatar_many2x_autocomplete.js` (assignee picker) | frontend | 0.8 | 45 | 36 |
| `mail/static/src/core/web/avatar_card/avatar_card.js` (person card) | frontend | 0.9 | 131 | 118 |
| `mail/static/src/core/web/avatar_card/avatar_card.xml` | frontend | 0.9 | 34 | 31 |
| `mail/static/src/core/web/avatar_card/avatar_card.scss` | frontend | 0.9 | 20 | 18 |

| nodo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `table/todo_user.yaml` | backend | 1 | 54 | 54 |
| `table/person.yaml` | backend | 1 | 24 | 24 |
| `table/odoo_user.yaml` | backend | 1 | 15 | 15 |
| `table/web_session.yaml` | backend | 1 | 14 | 14 |
| `datasource/odoo_auth.yaml` | backend | 1 | 4 | 4 |
| `datasource/sessions.yaml` | backend | 1 | 4 | 4 |
| `action/todo_set_assignees.yaml` | backend | 1 | 53 | 53 |
| `action/todo_assign_form.yaml` | backend | 1 | 11 | 11 |
| `action/sign_in.yaml` | backend | 1 | 26 | 26 |
| `action/sign_out.yaml` | backend | 1 | 7 | 7 |
| `action/whoami.yaml` | backend | 1 | 7 | 7 |
| `action/switch_person.yaml` | backend | 1 | 12 | 12 |
| `action/switch_person_form.yaml` | backend | 1 | 11 | 11 |
| `action/restore_identity.yaml` | backend | 1 | 6 | 6 |
| `web/team/src/pages/Login.tsx` | frontend | 1 | 76 | 76 |
| `web/team/src/pages/TodoForm.tsx` (PeoplePicker) | frontend | 0.02 | 466 | 9 |
| `web/team/src/ui/MultiPicker.tsx` | frontend | 0.5 | 99 | 50 |
| `web/team/src/ui/Avatars.tsx` | frontend | 1 | 31 | 31 |

### Activities and chatter

| Odoo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `project_todo/models/project_task.py` (systray views, notification groups) | backend | 0.45 | 58 | 26 |
| `project_todo/models/res_users.py` (To-Do group in systray Activities) | backend | 0.6 | 80 | 48 |
| `project_todo/wizard/mail_activity_todo_create.py` (Add a To-Do (Alt+Shift+T)) | backend | 0.95 | 38 | 36 |
| `project_todo/wizard/mail_activity_todo_create.xml` | backend | 0.95 | 21 | 20 |
| `project_todo/views/project_task_views.xml` (activity view) | backend | 0.08 | 342 | 27 |
| `project_todo/data/digest_data.xml` | backend | 1 | 22 | 22 |
| `project/models/project_task.py` (tracking subtypes, creation message, followers) | backend | 0.03 | 2,414 | 72 |
| `project/data/mail_message_subtype_data.xml` (task subtypes) | backend | 0.2 | 167 | 33 |
| `mail/models/mail_thread.py` (tracking, log, message_post, followers API) | backend | 0.3 | 5,463 | 1,639 |
| `mail/models/mail_message.py` (message reading, edit, delete, access) | backend | 0.3 | 1,573 | 472 |
| `mail/models/mail_activity.py` (activities: state, done with feedback, reschedule) | backend | 0.65 | 1,037 | 674 |
| `mail/models/mail_activity_mixin.py` (activity fields and helpers) | backend | 0.5 | 519 | 260 |
| `mail/models/mail_activity_type.py` (type, delay, summary) | backend | 0.4 | 176 | 70 |
| `mail/models/mail_followers.py` (followers) | backend | 0.5 | 535 | 268 |
| `mail/models/mail_message_subtype.py` (follower subtypes) | backend | 0.4 | 147 | 59 |
| `mail/models/mail_track_mixin.py` (change history) | backend | 0.8 | 667 | 534 |
| `mail/models/res_users.py` (systray activity groups) | backend | 0.12 | 722 | 87 |
| `mail/controllers/thread.py` (messages and followers routes) | backend | 0.7 | 300 | 210 |
| `mail/controllers/attachment.py` (attachment routes) | backend | 0.4 | 344 | 138 |
| `mail/wizard/mail_activity_schedule.py` (schedule an activity) | backend | 0.5 | 528 | 264 |
| `mail/wizard/mail_activity_schedule_views.xml` | backend | 0.5 | 151 | 76 |
| `mail/wizard/mail_followers_edit.py` (add followers) | backend | 0.9 | 80 | 72 |
| `mail/wizard/mail_followers_edit_views.xml` | backend | 0.9 | 52 | 47 |
| `mail/views/mail_activity_views.xml` (activity forms) | backend | 0.18 | 546 | 98 |
| `mail_tracking/models/mail_tracking_value.py` (change history storage) | backend | 0.8 | 57 | 46 |
| `mail_tracking/models/mail_message.py` | backend | 0.5 | 78 | 39 |
| `mail_tracking/models/mail_thread.py` | backend | 0.4 | 59 | 24 |
| `project_todo/static/src/core/web/activity_menu_patch.js` (Add a To-Do, systray group) | frontend | 1 | 67 | 67 |
| `project_todo/static/src/components/todo_chatter_panel/todo_chatter_panel.js` | frontend | 1 | 33 | 33 |
| `project_todo/static/src/components/todo_chatter_panel/todo_chatter_panel.xml` | frontend | 1 | 19 | 19 |
| `project_todo/static/src/components/todo_chatter_panel/todo_chatter_panel.scss` | frontend | 1 | 12 | 12 |
| `project_todo/static/src/views/todo_form/todo_form_control_panel.js` (chatter toggle, remembered) | frontend | 1 | 40 | 40 |
| `project_todo/static/src/views/todo_form/todo_form_control_panel.xml` | frontend | 1 | 19 | 19 |
| `project_todo/static/src/views/todo_form/todo_form_renderer.js` | frontend | 0.6 | 18 | 11 |
| `project_todo/static/src/views/todo_activity_wizard/todo_activity_wizard_controller.js` | frontend | 1 | 12 | 12 |
| `project_todo/static/src/views/todo_activity_wizard/todo_activity_wizard_view.js` | frontend | 1 | 10 | 10 |
| `mail/static/src/chatter/web_portal_project/chatter.js` (chatter) | frontend | 0.85 | 179 | 152 |
| `mail/static/src/chatter/web_portal_project/chatter.scss` | frontend | 0.85 | 68 | 58 |
| `mail/static/src/chatter/web/chatter_patch.js` | frontend | 0.8 | 592 | 474 |
| `mail/static/src/chatter/web/chatter.xml` | frontend | 0.8 | 185 | 148 |
| `mail/static/src/core/common/thread.js` (message list) | frontend | 0.5 | 889 | 444 |
| `mail/static/src/core/common/thread.xml` | frontend | 0.6 | 120 | 72 |
| `mail/static/src/core/common/thread.scss` | frontend | 0.5 | 76 | 38 |
| `mail/static/src/core/common/thread_model.js` | frontend | 0.35 | 906 | 317 |
| `mail/static/src/core/common/message.js` (messages with tracking values) | frontend | 0.6 | 657 | 394 |
| `mail/static/src/core/common/message.xml` | frontend | 0.6 | 222 | 133 |
| `mail/static/src/core/common/message.scss` | frontend | 0.5 | 244 | 122 |
| `mail/static/src/core/common/message_model.js` | frontend | 0.5 | 927 | 464 |
| `mail/static/src/core/common/message_actions.js` | frontend | 0.4 | 273 | 109 |
| `mail/static/src/core/common/composer.js` (send message, log note) | frontend | 0.45 | 1,179 | 531 |
| `mail/static/src/core/common/composer.xml` | frontend | 0.5 | 249 | 124 |
| `mail/static/src/core/common/composer.scss` | frontend | 0.45 | 243 | 109 |
| `mail/static/src/core/common/composer_model.js` | frontend | 0.5 | 180 | 90 |
| `mail/static/src/core/common/composer_actions.js` | frontend | 0.4 | 222 | 89 |
| `mail/static/src/core/common/attachment_list.js` (attachments) | frontend | 0.6 | 241 | 145 |
| `mail/static/src/core/common/attachment_list.xml` | frontend | 0.6 | 207 | 124 |
| `mail/static/src/core/common/attachment_list.scss` | frontend | 0.6 | 72 | 43 |
| `mail/static/src/core/common/attachment_model.js` | frontend | 0.5 | 207 | 104 |
| `mail/static/src/core/common/attachment_upload_service.js` | frontend | 0.5 | 226 | 113 |
| `mail/static/src/core/common/activity_model.js` | frontend | 0.9 | 83 | 75 |
| `mail/static/src/core/common/follower_model.js` | frontend | 0.9 | 48 | 43 |
| `mail/static/src/core/common/message_search_hook.js` (search messages) | frontend | 0.8 | 159 | 127 |
| `mail/static/src/core/common/search_message_input.js` | frontend | 0.9 | 66 | 59 |
| `mail/static/src/core/web/activity.js` (activity: done, edit, cancel) | frontend | 0.9 | 193 | 174 |
| `mail/static/src/core/web/activity.xml` | frontend | 0.9 | 96 | 86 |
| `mail/static/src/core/web/activity.scss` | frontend | 0.9 | 34 | 31 |
| `mail/static/src/core/web/activity_markasdone_popover.js` | frontend | 0.9 | 82 | 74 |
| `mail/static/src/core/web/activity_markasdone_popover.xml` | frontend | 0.9 | 24 | 22 |
| `mail/static/src/core/web/activity_model_patch.js` | frontend | 0.9 | 86 | 77 |
| `mail/static/src/core/web/activity_menu.js` (systray Activities) | frontend | 0.8 | 139 | 111 |
| `mail/static/src/core/web/activity_menu.xml` | frontend | 0.8 | 51 | 41 |
| `mail/static/src/core/web/follower.js` (followers) | frontend | 0.9 | 45 | 40 |
| `mail/static/src/core/web/follower.xml` | frontend | 0.9 | 21 | 19 |
| `mail/static/src/core/web/follower_list.js` | frontend | 0.9 | 76 | 68 |
| `mail/static/src/core/web/follower_list.xml` | frontend | 0.9 | 34 | 31 |
| `mail/static/src/core/web/follower_subtype_dialog.js` | frontend | 0.9 | 164 | 148 |
| `mail/static/src/core/web/follower_subtype_dialog.xml` | frontend | 0.9 | 43 | 39 |
| `mail/static/src/core/web/message_patch.js` | frontend | 0.5 | 117 | 58 |
| `mail/static/src/core/web/message_patch.xml` | frontend | 0.5 | 58 | 29 |
| `mail/static/src/core/web/recipients_input.js` | frontend | 0.5 | 271 | 136 |
| `mail/static/src/views/web/activity/activity_controller.js` (activity view) | frontend | 0.9 | 152 | 137 |
| `mail/static/src/views/web/activity/activity_controller.scss` | frontend | 0.9 | 176 | 158 |
| `mail/static/src/views/web/activity/activity_renderer.js` | frontend | 0.9 | 219 | 197 |
| `mail/static/src/views/web/activity/activity_renderer.xml` | frontend | 0.9 | 137 | 123 |
| `mail/static/src/views/web/activity/activity_cell.js` | frontend | 0.9 | 83 | 75 |
| `mail/static/src/views/web/activity/activity_cell.xml` | frontend | 0.9 | 51 | 46 |
| `mail/static/src/views/web/activity/activity_compiler.js` | frontend | 0.9 | 91 | 82 |
| `mail/static/src/views/web/activity/activity_record.js` | frontend | 0.9 | 91 | 82 |
| `mail/static/src/views/web/activity/activity_arch_parser.js` | frontend | 0.9 | 53 | 48 |
| `mail/static/src/views/web/activity/activity_model.js` | frontend | 0.9 | 28 | 25 |
| `mail/static/src/views/web/activity/activity_view.js` | frontend | 0.9 | 26 | 23 |

| nodo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `table/todo_activity.yaml` | backend | 1 | 38 | 38 |
| `table/activity.yaml` | backend | 1 | 13 | 13 |
| `table/activity_write.yaml` | backend | 1 | 28 | 28 |
| `table/activity_type.yaml` | backend | 1 | 21 | 21 |
| `table/model_ref.yaml` | backend | 1 | 15 | 15 |
| `table/todo_message.yaml` | backend | 1 | 28 | 28 |
| `table/message.yaml` | backend | 1 | 23 | 23 |
| `table/mail_subtype.yaml` | backend | 1 | 15 | 15 |
| `table/todo_follower.yaml` | backend | 1 | 21 | 21 |
| `table/follower.yaml` | backend | 1 | 16 | 16 |
| `table/follower_subtype.yaml` | backend | 1 | 12 | 12 |
| `action/todo_schedule_activity.yaml` | backend | 1 | 35 | 35 |
| `action/todo_activity_done.yaml` | backend | 1 | 34 | 34 |
| `action/todo_activity_cancel.yaml` | backend | 1 | 14 | 14 |
| `action/todo_log_note.yaml` | backend | 1 | 30 | 30 |
| `action/todo_follow.yaml` | backend | 1 | 27 | 27 |
| `action/todo_unfollow.yaml` | backend | 1 | 18 | 18 |
| `lib/todo.rhai` (change history (tracking messages)) | backend | 0.46 | 116 | 53 |
| `web/team/src/pages/TodoForm.tsx` (Followers) | frontend | 0.36 | 466 | 168 |
| `web/team/src/styles.css` (chatter and activity rules) | frontend | 0.07 | 443 | 31 |

### Other

| Odoo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `project_todo/__manifest__.py` | backend | 1 | 39 | 39 |
| `project_todo/views/project_todo_menus.xml` | backend | 1 | 10 | 10 |
| `project_todo/views/project_task_views.xml` (convert to task, calendar view, empty board help) | backend | 0.22 | 342 | 75 |
| `project_todo/models/project_task.py` (untitled to-do on create, convert to task) | backend | 0.4 | 58 | 23 |
| `project_todo/models/res_users.py` (welcome to-do) | backend | 0.3 | 80 | 24 |
| `project_todo/data/todo_template.xml` (welcome to-do text) | backend | 1 | 218 | 218 |
| `project/models/project_task.py` (duplicate, archive, delete, calendar days, empty help) | backend | 0.015 | 2,414 | 36 |
| `project_todo/static/src/views/todo_form/todo_form_controller.js` (archive, duplicate, delete, convert) | frontend | 0.45 | 112 | 50 |
| `project_todo/static/src/views/todo_form/todo_form_cog_menu.js` | frontend | 1 | 8 | 8 |
| `project_todo/static/src/views/todo_conversion_form/todo_conversion_form_controller.js` | frontend | 1 | 18 | 18 |
| `project_todo/static/src/views/todo_conversion_form/todo_conversion_form_view.js` | frontend | 1 | 10 | 10 |
| `project_todo/static/src/webclient/share_target/todo_share_target_item.js` (share from the phone) | frontend | 1 | 28 | 28 |

| nodo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `action/todo_archive.yaml` | backend | 1 | 17 | 17 |
| `action/todo_duplicate.yaml` | backend | 1 | 21 | 21 |
| `action/todo_delete.yaml` | backend | 1 | 20 | 20 |
| `web/team/src/pages/Calendar.tsx` | frontend | 1 | 81 | 81 |
| `web/team/src/styles.css` (month view rules) | frontend | 0.04 | 443 | 18 |

### Shared

| nodo | side | share | lines | counted |
|---|---|--:|--:|--:|
| `application.yaml` | backend | 1 | 34 | 34 |
| `datasource/odoo.yaml` | backend | 1 | 90 | 90 |
| `api/team.yaml` | backend | 1 | 131 | 131 |
| `table/todo_view.yaml` | backend | 1 | 78 | 78 |
| `layout/nodo.yaml` | backend | 1 | 13 | 13 |
| `menu/left.yaml` | backend | 1 | 8 | 8 |
| `lib/todo.rhai` (deadline()) | backend | 0.32 | 116 | 37 |
| `web/team/index.html` | frontend | 1 | 12 | 12 |
| `web/team/src/main.tsx` | frontend | 1 | 22 | 22 |
| `web/team/src/App.tsx` | frontend | 1 | 85 | 85 |
| `web/team/src/lib.ts` | frontend | 1 | 110 | 110 |
| `web/team/src/pending.ts` | frontend | 1 | 84 | 84 |
| `web/team/src/settings.ts` | frontend | 1 | 38 | 38 |
| `web/team/src/components.tsx` (ViewSwitcher) | frontend | 0.5 | 42 | 21 |
| `web/team/src/ui/Toast.tsx` | frontend | 1 | 21 | 21 |
| `web/team/src/ui/Hint.tsx` | frontend | 1 | 12 | 12 |
| `web/team/src/ui/index.ts` | frontend | 1 | 9 | 9 |
| `web/team/src/styles.css` (base) | frontend | 0.32 | 443 | 142 |

