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
