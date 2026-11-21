// Shared helpers for the to-do actions. Helpers see only their arguments.

// A deadline as typed ("YYYY-MM-DD", "YYYY-MM-DD HH:MM", RFC 3339) as a datetime, or ()
// for an empty value. Typed times are this computer's time (UTC here).
fn deadline(v) {
    if v == () { return (); }
    let d = v.to_string();
    d.trim();
    if d == "" { return (); }
    if d.contains("T") { return date(d); }
    if d.len() == 10 { d += " 00:00:00"; }
    if d.len() == 16 { d += ":00"; }
    date(d)
}

// Whether a todo_view row (or ()) is a to-do assigned to person `uid`: its assignee_ids
// ("2,6") come from Odoo's assignment table.
fn assigned(view, uid) {
    if view == () || uid == () || view.assignee_ids == () { return false; }
    ("," + view.assignee_ids.to_string() + ",").contains("," + uid.to_string() + ",")
}

// A list of ids from a checklist (array) or "1,5" text.
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
