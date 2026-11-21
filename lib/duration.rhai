// Odoo's time in each stage (mail.tracking.duration.mixin, `duration_tracking`): on a stage
// change the whole minutes since `d` are added under the stage it leaves (`s`), then `s`
// becomes the new stage and `d` the moment it arrived, as naive UTC text. `tracking` is the
// stored map (or ()), `stage` the new stage id, `now` the current instant.
fn track(tracking, stage, now) {
    let m = if tracking == () { #{} } else { tracking };
    if "s" in m && m.s != () && "d" in m && m.d != () {
        let secs = parse_int(now.format("%s")) - parse_int(date(m.d).format("%s"));
        // int((now - d) / timedelta(minutes=1)): truncated toward zero.
        let mins = if secs >= 0 { secs / 60 } else { -((-secs) / 60) };
        let key = m.s.to_string();
        let before = if key in m { m[key] } else { 0 };
        m[key] = before + mins;
    }
    m.s = if stage == () { 0 } else { stage };
    m.d = now.format("%Y-%m-%d %H:%M:%S");
    m
}
