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

// Odoo's quick-add keywords, read off the end of a title: "Call Ana #sales @marc !!" gives
// #{ name: "Call Ana", tags: ["sales"], users: ["marc"], priority: "2" }. Only a run of
// keywords at the end counts, at least one word stays the title, and a title that starts with
// #, @ or ! is left alone. "!" to "!!!" is priority 1 to 3. `priority` is () when none was
// given; who a "@word" is gets decided by the caller.
fn keywords(title) {
    let out = #{ name: title, tags: [], users: [], priority: () };
    let t = title;
    t.trim();
    if t == "" || ["#", "@", "!"].contains(t.sub_string(0, 1)) { return out; }
    let words = t.split(" ").filter(|w| w != "");
    let cut = words.len();
    while cut > 1 {
        let w = words[cut - 1];
        let tag_or_user = (w.starts_with("#") || w.starts_with("@")) && w.len() > 1;
        if tag_or_user || w == "!" || w == "!!" || w == "!!!" { cut -= 1; } else { break; }
    }
    for i in cut..words.len() {
        let w = words[i];
        if w.starts_with("#") { out.tags.push(w.sub_string(1)); }
        else if w.starts_with("@") { out.users.push(w.sub_string(1)); }
        else if out.priority == () { out.priority = w.len().to_string(); }
    }
    out.name = words.extract(0, cut).reduce(|acc, w| if acc == "" { w } else { acc + " " + w }, "");
    out
}

// ---- change history, as Odoo writes it into a to-do's chatter ----
// Odoo 20 keeps a tracked change as a message whose body reads
// "<div>old → <b>new</b> <i>(Field)</i><br>…\n</div>", one line per field.

fn escape(s) {
    let x = if s == () { "" } else { s.to_string() };
    x.replace("&", "&amp;"); x.replace("<", "&lt;"); x.replace(">", "&gt;");
    x
}

// Odoo's labels for a to-do's priority and state.
fn priority_label(p) {
    let labels = ["Low priority", "Medium priority", "High priority", "Urgent"];
    let n = if p == () || p == "" { 0 } else { parse_int(p.to_string()) };
    if n < 0 || n > 3 { "None" } else { labels[n] }
}

fn state_label(s) {
    let labels = #{ "01_in_progress": "In Progress", "02_changes_requested": "Changes Requested",
        "03_approved": "Approved", "04_waiting_normal": "Waiting", "1_done": "Done", "1_canceled": "Cancelled" };
    if s == () || !(s in labels) { "None" } else { labels[s] }
}

// A deadline as Odoo's tracking shows one ("Nov 24, 2026, 2:01 PM (GMT)"), from a stored value
// ("2026-11-24T14:01:00Z" or "2026-11-24 14:01:00"). nodo has no per-person time zone yet, so
// it's UTC, marked "(GMT)".
fn deadline_label(v) {
    if v == () { return "None"; }
    let s = v.to_string();
    if s.len() < 16 { return "None"; }
    let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let h = parse_int(s.sub_string(11, 2));
    let ampm = if h >= 12 { "PM" } else { "AM" };
    let h12 = if h % 12 == 0 { 12 } else { h % 12 };
    months[parse_int(s.sub_string(5, 2)) - 1] + " " + parse_int(s.sub_string(8, 2)) + ", " + s.sub_string(0, 4)
        + ", " + h12 + ":" + s.sub_string(14, 2) + " " + ampm + " (GMT)"
}

// The body of a tracking message from [old, new, field label] triples; () when nothing changed.
fn tracking_body(changes) {
    let lines = changes.filter(|c| c[0] != c[1]).map(|c| escape(c[0]) + " → <b>" + escape(c[1]) + "</b> <i>(" + c[2] + ")</i>");
    if lines.len() == 0 { return (); }
    "<div>" + lines.reduce(|a, l| if a == "" { l } else { a + "<br>" + l }, "") + "\n</div>"
}

// The mail_message row for a tracking message on to-do `id` by `partner`, or () when `body` is
// (). `subtype` is Odoo's: "Note" for most changes, "Task Done" when it was marked done.
fn tracking_message(id, body, partner, subtype, uid) {
    if body == () { return (); }
    #{
        model: "project.task", res_id: id, message_type: "tracking", subtype_id: subtype,
        author_id: partner, body: body, is_internal: true,
        date: now(), create_uid: uid, write_uid: uid, create_date: now(), write_date: now(),
    }
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
