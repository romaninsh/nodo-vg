// Shared helpers for CRM: the lead hooks and the CRM actions. Helpers see only their arguments.

// A number from a decimal column (read back as text), a float, an int or text a caller typed;
// () and "" are 0. Anything that isn't a finite number (text, "NaN", "Infinity", "1e999")
// throws: NaN compares false with everything, so a range check written as `v < 0 || v > 100`
// would let it through.
fn num(v) {
    if v == () { return 0.0; }
    let t = type_of(v);
    let x = 0.0;
    if t == "f64" || t == "f32" { x = v; }
    else if t == "i64" || t == "i32" { x = v.to_float(); }
    else {
        let s = v.to_string();
        s.trim();
        if s == "" { return 0.0; }
        try { x = parse_float(s); } catch { throw `"${s}" isn't a number`; }
    }
    if !x.is_finite() { throw `"${v}" isn't a number`; }
    x
}

// Whether a number lies within [lo, hi], written so NaN is out of range too.
fn within(x, lo, hi) { x >= lo && x <= hi }

fn round2(x) { (x * 100.0).round() / 100.0 }

// Whether Odoo counts two probabilities as the same (float_compare to 2 digits).
fn same_probability(a, b) { round2(num(a)) == round2(num(b)) }

// What a salesperson may do with one lead (a `lead` row): see and change it when they are a
// salesperson and it is theirs or unassigned, or when they see every document. `rights` is
// their sales_right row (or ()).
fn can_change(lead, rights, uid) {
    if lead == () || rights == () || rights.salesman != true { return false; }
    // Odoo's multi-company rule: no company, or one of theirs.
    if lead.company_id != () && rights.company_ids != () &&
       !rights.company_ids.contains("," + lead.company_id.to_string() + ",") { return false; }
    rights.all_docs == true || lead.user_id == () || lead.user_id == uid
}

// The stage Odoo's "Won" moves a lead to: the first won stage after its current one, else the
// nearest won stage before it. `stages` in Odoo's order (sequence), already limited to the
// lead's team. () when there is no won stage.
fn won_stage(stages, current) {
    let here = 0;
    for s in stages { if current != () && s.id.to_string() == current.to_string() { here = s.sequence; } }
    let won = stages.filter(|s| s.is_won == true);
    if won.len() == 0 { return (); }
    for s in won { if s.sequence > here { return parse_int(s.id.to_string()); } }
    let back = ();
    for s in won { if s.sequence <= here { back = parse_int(s.id.to_string()); } }
    if back == () { parse_int(won[0].id.to_string()) } else { back }
}

// Whether a stage shows for a sales team (its team_ids are "" for every team, or "1,4").
fn stage_for_team(stage, team) {
    if stage.team_ids == () || stage.team_ids == "" { return true; }
    team != () && ("," + stage.team_ids + ",").contains("," + team.to_string() + ",")
}

// ---- predictive lead scoring (Odoo's "PLS") ----

// Leads created before crm.pls_start_date don't count in the frequency table.
fn pls_counts(create_date, start) {
    if create_date == () || start == () || start == "" { return false; }
    date(create_date.to_string()).start_of_day() >= date(start.to_string())
}

// The frequency changes a status change makes, in Odoo's order: [target, step] pairs.
fn pls_transitions(before, after) {
    let out = [];
    if after == "won" && before != "won" { out.push(["won", 1]); }
    if after != "won" && before == "won" { out.push(["won", -1]); }
    if after == "lost" && before != "lost" { out.push(["lost", 1]); }
    if after != "lost" && before == "lost" { out.push(["lost", -1]); }
    out
}

// The lead's (field, value) pairs the scoring counts, values as text the way Odoo stores them
// in its frequency table: the stage, each scoring field that is set (the two quality fields
// even when empty, as "False"), and one pair per tag. `fields` is crm.pls_fields as text.
fn pls_values(lead, fields, tag_ids) {
    let out = [];
    if lead.stage_id != () { out.push(["stage_id", lead.stage_id.to_string()]); }
    for f in fields.split(",") {
        f.trim();
        if f == "" || f == "tag_ids" || f == "stage_id" || f == "team_id" { continue; }
        let v = lead[f];
        if v != () && v != "" && v != false && v != 0 {
            out.push([f, v.to_string()]);
        } else if f == "email_state" || f == "phone_state" {
            out.push([f, "False"]);
        }
    }
    if fields.split(",").map(|x| { x.trim(); x }).contains("tag_ids") {
        for t in tag_ids { out.push(["tag_id", t.to_string()]); }
    }
    out
}

fn pls_empty(fields) {
    let m = #{};
    for f in fields { m[f] = #{ won_total: 0.0, lost_total: 0.0, values: #{} }; }
    m
}

// Add one frequency row to a team's tallies (a map of field -> totals and values).
fn pls_add(tally, f, value, w, l) {
    let e = tally[f];
    let vals = e.values;
    let cur = vals[value];
    vals[value] = if cur == () { [w, l] } else { [cur[0] + w, cur[1] + l] };
    e.values = vals;
    e.won_total += w;
    e.lost_total += l;
    tally[f] = e;
    tally
}

// The automated probability Odoo's naive Bayes gives a lead: `values` from pls_values, `team`
// the lead's sales team (or ()), `freqs` the frequency table rows, `won_stage_ids` the won
// stages, `first_stage` the first stage shared by every team. () when Odoo can't compute one
// (the lead then keeps its old value).
fn pls_probability(values, team, freqs, won_stage_ids, first_stage) {
    let fields = [];
    let has_stage = false;
    let won = false;
    for v in values {
        if !fields.contains(v[0]) { fields.push(v[0]); }
        if v[0] == "stage_id" {
            has_stage = true;
            if won_stage_ids.map(|x| x.to_string()).contains(v[1]) { won = true; }
        }
    }
    if !has_stage { return 0.0; }
    if won { return 100.0; }

    let teams = #{};
    let all = pls_empty(fields);
    for fr in freqs {
        let f = fr.variable;
        if !fields.contains(f) { continue; }
        let tk = if fr.team_id == () { () } else { fr.team_id.to_string() };
        if tk != () && !(tk in teams) { teams[tk] = pls_empty(fields); }
        let w = num(fr.won_count);
        let l = num(fr.lost_count);
        // Odoo ignores a tag until 50 leads with it were won or lost.
        if f == "tag_id" && w + l < 50.0 { continue; }
        if tk != () { teams[tk] = pls_add(teams[tk], f, fr.value.to_string(), w, l); }
        all = pls_add(all, f, fr.value.to_string(), w, l);
    }
    let key = if team != () && team.to_string() in teams { team.to_string() } else { () };
    let res = if key == () { all } else { teams[key] };

    let first = res["stage_id"].values[first_stage.to_string()];
    if first == () { return (); }
    let team_won = first[0];
    let team_lost = first[1];
    if team_won == 0.0 || team_lost == 0.0 { return (); }
    let s_won = team_won / (team_won + team_lost);
    let s_lost = team_lost / (team_won + team_lost);
    for v in values {
        let fr = res[v[0]];
        let vr = fr.values[v[1]];
        if vr == () { continue; }
        let tw = if v[0] == "stage_id" { team_won } else { fr.won_total };
        let tl = if v[0] == "stage_id" { team_lost } else { fr.lost_total };
        if tw == 0.0 || tl == 0.0 { continue; }
        s_won *= vr[0] / tw;
        s_lost *= vr[1] / tl;
    }
    let p = round2(100.0 * s_won / (s_won + s_lost));
    if p < 0.01 { 0.01 } else if p > 99.99 { 99.99 } else { p }
}

// The automated probability for a lead (a `lead` row) as if it were in `stage` (() keeps its
// own), from what the action read: settings row, its tag ids, every stage in Odoo's order and
// the frequency table. () when Odoo can't compute one (the lead keeps its old value).
fn rescore(lead, stage, setting, tag_ids, stages, freqs) {
    let l = lead;
    if stage != () { l.stage_id = stage; }
    let won = stages.filter(|s| s.is_won == true).map(|s| s.id);
    let common = stages.filter(|s| s.team_ids == () || s.team_ids == "");
    let first = if common.len() > 0 { common[0].id } else { 0 };
    pls_probability(pls_values(l, setting.pls_fields, tag_ids), l.team_id, freqs, won, first)
}

// The frequency table rows to write after a lead's won/lost status went from `before` to the
// lead's (re-read) won_status. Odoo applies each change in turn, re-reading the table between
// them; this works on a copy. Returns rows with an `id` to update and rows without to insert.
fn pls_writes(lead, before, setting, tag_ids, stages, freqs) {
    let todo = pls_transitions(before, lead.won_status);
    if todo.len() == 0 || !pls_counts(lead.create_date, setting.pls_start_date) { return []; }
    let values = pls_values(lead, setting.pls_fields, tag_ids);
    let rows = freqs.map(|f| #{ id: f.id, variable: f.variable, value: f.value.to_string(), team_id: f.team_id,
        won_count: num(f.won_count), lost_count: num(f.lost_count), dirty: false });
    for t in todo { rows = pls_increment(values, lead.team_id, t[0], t[1], stages, rows); }
    rows.filter(|r| r.dirty).map(|r| if r.id == () {
        #{ variable: r.variable, value: r.value, team_id: r.team_id, won_count: r.won_count, lost_count: r.lost_count }
    } else {
        #{ id: r.id, won_count: r.won_count, lost_count: r.lost_count }
    })
}

// One change to the frequency table copy: a lead becomes won or lost (`step` 1) or stops being
// so (`step` -1), `target` "won" or "lost". Won counts for every stage, lost for the lead's
// stage and the ones before it. Existing tallies move by one (never below 0.1); a new one
// starts at 0.1 plus its count, as in Odoo.
fn pls_increment(values, team, target, step, stages, rows) {
    let won = if target == "won" { 1.0 } else { 0.0 };
    let lost = if target == "lost" { 1.0 } else { 0.0 };
    let pairs = [];
    for p in values {
        if p[0] == "stage_id" {
            let here = 0;
            for s in stages { if s.id.to_string() == p[1] { here = s.sequence; } }
            for s in stages {
                if won > 0.0 || s.sequence <= here { pairs.push([p[0], s.id.to_string()]); }
            }
        } else {
            pairs.push(p);
        }
    }
    let seen = [];
    let team_id = if team == () || team == 0 { () } else { team };
    for pair in pairs {
        let f = pair[0];
        let v = pair[1];
        let k = f + "|" + v;
        if seen.contains(k) { continue; }
        seen.push(k);
        let at = -1;
        for i in 0..rows.len() {
            let r = rows[i];
            if r.variable == f && r.value == v && r.team_id == team_id { at = i; }
        }
        if at >= 0 {
            let r = rows[at];
            let nw = r.won_count + won * step.to_float();
            let nl = r.lost_count + lost * step.to_float();
            // Tallies hold tenths; rounding keeps float noise (1.1 - 1) out of the table.
            r.won_count = if nw > 0.0 { (nw * 1000000.0).round() / 1000000.0 } else { 0.1 };
            r.lost_count = if nl > 0.0 { (nl * 1000000.0).round() / 1000000.0 } else { 0.1 };
            r.dirty = true;
            rows[at] = r;
        } else {
            rows.push(#{ id: (), variable: f, value: v, team_id: team_id, won_count: won + 0.1, lost_count: lost + 0.1, dirty: true });
        }
    }
    rows
}
