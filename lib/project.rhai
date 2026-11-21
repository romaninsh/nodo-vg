// Shared helpers for the project actions. Helpers see only their arguments: the actions read
// the rows, these decide what Odoo is asked to do.

// The Odoo password a web sign-in keeps with the session, or "".
fn password(pw) {
    if pw == () { return ""; }
    pw.to_string()
}

// Text from an argument, trimmed; "" when it is missing.
fn text(v) {
    if v == () { return ""; }
    let t = v.to_string();
    t.trim();
    t
}

// A list of ids from an array or "1,5" text.
fn ids(v) {
    let out = [];
    if v == () { return out; }
    if type_of(v) == "array" {
        for x in v { out.push(parse_int(x.to_string())); }
    } else {
        for x in v.to_string().split(",") { x.trim(); if x != "" { out.push(parse_int(x)); } }
    }
    out
}

// Whether a stage row is one of the project's stages (its `project_ids` is ",1,5,").
fn in_project(stage, project) {
    stage != () && stage.project_ids != () && stage.project_ids.contains("," + project.to_string() + ",")
}

// The states a person can pick on a task (Waiting is Odoo's to set, from dependencies).
fn pickable_state(state) {
    ["01_in_progress", "02_changes_requested", "03_approved", "1_done", "1_canceled"].contains(state)
}

// Odoo's quick create on a project's column, as its kanban sends it: only the title, as
// `display_name` (Odoo's create reads #tags, @people and ! / !! / !!! out of it), and the
// project and column in the context (`default_project_id`, `default_stage_id`). With the
// project in the context Odoo doesn't assign the creator, and an @person gets `date_assign`.
// Returns the call's positional args and kwargs.
fn quick_create_call(project, stage, title, users) {
    let vals = #{ display_name: title };
    if users.len() > 0 { vals.user_ids = [[6, 0, users]]; }
    let context = #{ default_project_id: project };
    if stage != () { context.default_stage_id = stage; }
    #{ params: [vals], kwargs: #{ context: context } }
}

// What a task save asks Odoo to write: only the fields that changed. `args` comes from the
// form, `task` is the stored row.
fn save_vals(task, args) {
    let vals = #{};
    if "name" in args && args.name != () {
        let n = text(args.name);
        if n == "" { throw "Give the task a title"; }
        if n != task.name { vals.name = n; }
    }
    if "priority" in args && args.priority != () {
        let p = args.priority.to_string();
        if !["0", "1", "2", "3"].contains(p) { throw "Priority must be 0 (Low), 1 (Medium), 2 (High) or 3 (Urgent)"; }
        if p != task.priority { vals.priority = p; }
    }
    if "state" in args && args.state != () {
        let s = args.state.to_string();
        if !pickable_state(s) { throw "That state can't be picked"; }
        if s != task.state { vals.state = s; }
    }
    if "date_deadline" in args && args.date_deadline != () {
        let d = text(args.date_deadline);
        // Odoo takes UTC as "YYYY-MM-DD HH:MM:SS" (replace changes the string in place).
        if d == "" { vals.date_deadline = false; } else {
            d.replace("T", " ");
            d.replace("Z", "");
            if d.len() > 19 { d = d.sub_string(0, 19); }
            if d.len() == 16 { d += ":00"; }
            vals.date_deadline = d;
        }
    }
    if "milestone_id" in args && args.milestone_id != () {
        let m = text(args.milestone_id);
        vals.milestone_id = if m == "" { false } else { parse_int(m) };
    }
    if "partner_id" in args && args.partner_id != () {
        let p = text(args.partner_id);
        vals.partner_id = if p == "" { false } else { parse_int(p) };
    }
    if "tags" in args && args.tags != () { vals.tag_ids = [[6, 0, ids(args.tags)]]; }
    if "users" in args && args.users != () { vals.user_ids = [[6, 0, ids(args.users)]]; }
    if "description" in args && args.description != () {
        let h = text(args.description);
        if h.len() > 200000 { throw "The description is too long to save"; }
        vals.description = if h == "" { false } else { h };
    }
    vals
}
