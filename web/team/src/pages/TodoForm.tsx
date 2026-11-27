import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { observer, useCollection, useRecord } from "@vantage-ui/client/react";
import { AlarmClock, ArrowLeft, Check, Copy, RotateCcw, Settings, Trash2, X } from "lucide-react";
import type { Todo } from "../vantage.gen";
import { Button, Dialog, DialogTrigger, Heading, Menu, MenuItem, MenuTrigger, Modal, ModalOverlay, Popover } from "react-aria-components";
import { auth, call, fromLocalInput, fullDate, ids, isDone, TAG_COLOR_COUNT, tagColor, tagText, toLocalInput, useDb, type Outcome } from "../lib";
import { Avatar, DateTimePicker, MultiPicker, Priority, toast } from "../ui";
import { setPending, usePending } from "../pending";

/** One to-do: read it, edit it, set its priority, tag it, assign it, mark it done. */
export const TodoForm = observer(() => {
  const db = useDb();
  const { id = "" } = useParams();
  // `todo` serves one to-do by id, archived or not; the lists hold only their own sets.
  const ref = useMemo(() => db.todo.ref(id), [db, id]);
  const { value: todo, status, error } = useRecord(ref);
  if (status === "error") return <p className="alert">{error}</p>;
  if (status === "missing") return <p className="alert">This to-do isn't in your list. <Link to="/">Back to my to-dos</Link></p>;
  if (!todo) return <p className="muted" style={{ padding: 16 }}>Loading…</p>;
  return <Editor key={todo.id} todo={todo} />;
});

const Editor = observer(({ todo }: { todo: Todo }) => {
  const db = useDb();
  const navigate = useNavigate();
  const id = Number(todo.id);
  const v = usePending(todo.id, {
    name: todo.name ?? "",
    priority: todo.priority,
    state: todo.state,
    active: todo.active,
    tag_ids: todo.tag_ids ?? "",
    assignee_ids: todo.assignee_ids ?? "",
    date_deadline: todo.date_deadline,
    notes: todo.notes ?? "",
  });
  const saved = { name: v.name ?? "", deadline: toLocalInput(v.date_deadline), notes: v.notes ?? "" };
  const [name, setName] = useState(saved.name);
  const [deadline, setDeadline] = useState(saved.deadline);
  const [notes, setNotes] = useState(saved.notes);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const me = auth.me();
  const dirty = name !== saved.name || deadline !== saved.deadline || notes !== saved.notes;

  // When the to-do changes elsewhere (the board, Odoo), show the new values unless you are editing.
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) {
      setName(saved.name);
      setDeadline(saved.deadline);
      setNotes(saved.notes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.name, saved.deadline, saved.notes]);

  const run = async (p: Promise<Outcome>, ok?: () => void, message?: string) => {
    setBusy(true);
    const out = await p;
    setBusy(false);
    if (!out.ok) toast(out.message);
    else {
      ok?.();
      if (message) toast(message);
    }
    return out.ok;
  };

  const save = () => {
    const dl = fromLocalInput(deadline);
    return run(call(db.run.todo_save, { id, name, date_deadline: dl, description: notes }), () => {
      setPending(id, { name, date_deadline: dl || null, notes });
      setEditing(false);
    }, "Saved");
  };
  const discard = () => {
    setName(saved.name);
    setDeadline(saved.deadline);
    setNotes(saved.notes);
    setEditing(false);
  };
  const setTags = (list: string[]) =>
    run(call(db.run.todo_set_tags, { id, tags: list.join(",") }), () =>
      setPending(id, { tag_ids: [...list].sort((a, b) => Number(a) - Number(b)).join(",") }));
  const setPeople = (list: string[]) =>
    run(call(db.run.todo_set_assignees, { id, users: list.join(",") }), () =>
      setPending(id, { assignee_ids: [...list].sort((a, b) => Number(a) - Number(b)).join(",") }));

  const tagIds = ids(v.tag_ids);
  const peopleIds = ids(v.assignee_ids);
  const done = isDone(v.state);
  const archived = v.active === false;

  return (
    <>
      <div className="cp">
        <div className="crumbs"><Link to="/">My to-dos</Link><span className="sep">/</span><span>{v.name}</span></div>
        <button className="btn btn-primary" disabled={busy || !dirty || !name.trim()} onClick={() => void save()}>Save</button>
        {dirty && <button className="btn" onClick={discard}>Discard</button>}
        <div className="grow" />
        <button className="btn" disabled={busy}
          onClick={() => void run(call(db.run.todo_archive, { id }), () => setPending(id, { active: archived }), archived ? "Restored" : "Archived")}>
          {archived ? "Unarchive" : "Archive"}
        </button>
        {/* Odoo's ⚙ actions menu on a form. */}
        <MenuTrigger>
          <Button className="btn icon" aria-label="Actions" isDisabled={busy}><Settings size={14} aria-hidden="true" /></Button>
          <Popover className="popover" placement="bottom end" offset={4}>
            <Menu className="menu" onAction={(key) => {
              if (key === "duplicate") {
                void call<{ id: number }, { id: number }>(db.run.todo_duplicate, { id }).then((out) => {
                  if (!out.ok) { toast(out.message); return; }
                  toast("Duplicated");
                  navigate(`/todo/${out.value.id}`);
                });
              } else if (key === "delete") setDeleting(true);
            }}>
              <MenuItem id="duplicate" className="menu-item"><Copy size={14} aria-hidden="true" /> Duplicate</MenuItem>
              <MenuItem id="delete" className="menu-item"><Trash2 size={14} aria-hidden="true" /> Delete</MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
      {deleting && (
        <ModalOverlay className="modal-overlay" isOpen isDismissable onOpenChange={(o) => { if (!o) setDeleting(false); }}>
          <Modal className="modal">
            <Dialog className="dialog" role="alertdialog">
              <Heading slot="title" className="dialog-title">Delete "{v.name}"?</Heading>
              <p>It's gone for everyone it's assigned to, in Odoo too. Archive it instead to keep it.</p>
              <div className="row">
                <Button className="btn btn-danger" autoFocus isDisabled={busy}
                  onPress={() => void run(call(db.run.todo_delete, { id }), () => { setDeleting(false); navigate("/"); }, "Deleted")}>Delete</Button>
                <Button className="btn" onPress={() => setDeleting(false)}>Cancel</Button>
              </div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
      <div className="sheet">
        <div className="status">
          <button className={`btn${done ? "" : " btn-primary"}`} disabled={busy}
            onClick={() => void run(call(db.run.todo_toggle_done, { id }), () => setPending(id, { state: done ? "01_in_progress" : "1_done" }), done ? "Opened again" : "Marked as done")}>
            {done ? <><RotateCcw size={14} aria-hidden="true" /> Open again</> : <><Check size={14} aria-hidden="true" /> Mark as done</>}
          </button>
          {done && <span className="badge done">Done</span>}
          {archived && <span className="badge archived">Archived</span>}
          <div className="grow" />
          <StageBar id={id} />
        </div>
        <div className="titlerow">
          <Priority value={v.priority} size={30} disabled={busy}
            onChange={(priority) => void run(call(db.run.todo_set_priority, { id, priority }), () => setPending(id, { priority }))} />
          <input aria-label="Title" value={name} placeholder="e.g. Call the supplier"
            onChange={(e) => { setEditing(true); setName(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter" && dirty) void save(); }} />
        </div>
        <div className="fields">
          <span className="flabel" id="f-assignees">Assignees</span>
          <PeoplePicker selected={peopleIds} meId={me ? String(me.uid) : ""} onChange={(l) => void setPeople(l)} />
          <span className="flabel" id="f-deadline">Deadline</span>
          <span className="deadline-field">
            <DateTimePicker labelId="f-deadline" value={deadline} onChange={(d) => { setEditing(true); setDeadline(d); }} />
            {deadline && (
              <button type="button" className="btn icon" aria-label="Clear the deadline" title="Clear"
                onClick={() => { setEditing(true); setDeadline(""); }}><X size={14} aria-hidden="true" /></button>
            )}
            {todo.due === "overdue" && !done && <span className="deadline overdue">Overdue</span>}
          </span>
          <span className="flabel" id="f-tags">Tags</span>
          <TagPicker selected={tagIds} onChange={(l) => void setTags(l)} />
        </div>
        <div className="tabs"><span>Description</span></div>
        <textarea className="desc" aria-label="Description" value={notes} placeholder="Add details about this to-do…"
          onChange={(e) => { setEditing(true); setNotes(e.target.value); }} />
        <p className="muted">Title, deadline and description are kept with Save; the priority, tags, assignees and done are saved at once.</p>
        <button className="btn" onClick={() => navigate(-1)}><ArrowLeft size={14} aria-hidden="true" /> Back</button>
      </div>
      <Chatter id={id} />
    </>
  );
});

/**
 * Odoo's status bar on a to-do: my own columns (Inbox, Today, …), the to-do's current one
 * highlighted. A click moves it there for me only; the others keep their own column for it.
 */
const StageBar = observer(({ id }: { id: number }) => {
  const db = useDb();
  const stages = useCollection(db.stages.sort("sequence", "asc"));
  const mine = useCollection(db.cards.where({ task_id: id }));
  const stored = mine.items[0]?.stage_id;
  // The board's copy is re-read every 30 s: show a move at once, until the server agrees.
  const [moved, setMoved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (moved !== null && String(stored ?? "") === moved) setMoved(null);
  }, [stored, moved]);
  const current = moved ?? (stored == null ? "" : String(stored));
  if (stages.items.length === 0 || mine.items.length === 0) return null;
  const move = async (stage: string, name: string) => {
    if (stage === current) return;
    setBusy(true);
    const out = await call(db.run.todo_move, { id, stage: Number(stage) });
    setBusy(false);
    if (!out.ok) { toast(out.message); return; }
    setMoved(stage);
    toast(`Moved to ${name}`);
  };
  return (
    <nav className="stagebar" aria-label="My columns">
      {stages.items.map((s) => (
        <button key={s.id} className={`${s.id === current ? "on" : ""}${s.fold ? " folded" : ""}`}
          aria-current={s.id === current ? "step" : undefined} disabled={busy}
          title={s.id === current ? `In ${s.name_local}` : `Move to ${s.name_local}`}
          onClick={() => void move(s.id, s.name_local ?? "")}>
          {s.name_local}
        </button>
      ))}
    </nav>
  );
});

type PickerProps = { selected: string[]; disabled?: boolean; onChange: (ids: string[]) => void };

/** Tags as Odoo's coloured pills, removable; a search box adds one. */
const TagPicker = observer(({ selected, disabled, onChange }: PickerProps) => {
  const db = useDb();
  const { items } = useCollection(db.tags.sort("name_local", "asc"));
  const color = new Map(items.map((t) => [t.id, t.color]));
  // Odoo's "Create "…"": a new tag, or the existing one of that name, picked at once.
  const create = async (name: string) => {
    const out = await call<{ name: string }, { id: number }>(db.run.tag_create, { name });
    if (!out.ok) { toast(out.message); return null; }
    return String(out.value.id);
  };
  return (
    <MultiPicker labelId="f-tags" addLabel="Add a tag" placeholder="Add a tag…" disabled={disabled}
      options={items.map((t) => ({ id: t.id, name: t.name_local ?? "" }))} selected={selected} onChange={onChange}
      onCreate={create}
      chip={(o) => <TagColour id={o.id} name={o.name} color={color.get(o.id)} disabled={disabled} />}
      chipStyle={(o) => ({ background: tagColor(color.get(o.id)), color: tagText(color.get(o.id)) })} />
  );
});

/** Who follows the to-do (Odoo's Followers): remove one, or add one of the team. */
const Followers = observer(({ id }: { id: number }) => {
  const db = useDb();
  const followers = useCollection(db.followers.where({ res_id: id }).sort("name", "asc"));
  const people = useCollection(db.people.sort("name", "asc"));
  const following = new Set(followers.items.map((f) => f.name));
  const addable = people.items.filter((p) => !following.has(p.name));
  const run = async (p: Promise<Outcome>) => { const out = await p; if (!out.ok) toast(out.message); };
  return (
    <div className="followers">
      <span className="chatter-label" id="f-followers">Followers ({followers.items.length})</span>
      <ul className="follower-list" aria-labelledby="f-followers">
        {followers.items.map((f) => (
          <li key={f.id} className="chip-tag">
            {f.name}
            <button className="chip-remove" aria-label={`Remove ${f.name} from the followers`}
              onClick={() => void run(call(db.run.todo_unfollow, { id, follower: Number(f.id) }))}><X size={12} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
      {addable.length > 0 && (
        <select className="input follower-add" aria-label="Add a follower" value=""
          onChange={(e) => { if (e.target.value) void run(call(db.run.todo_follow, { id, person: Number(e.target.value) })); }}>
          <option value="">Add a follower…</option>
          {addable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
    </div>
  );
});

/** A date `days` from today as "YYYY-MM-DD", in this computer's calendar. */
const dayFromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Odoo's planned activities on the to-do: each with its due date in Odoo's colours, Mark done
 * (with optional feedback) and Cancel; a short form schedules a new one.
 */
const Activities = observer(({ id }: { id: number }) => {
  const db = useDb();
  const planned = useCollection(db.activities.where({ res_id: id }).sort("date_deadline", "asc"));
  const types = useCollection(db.activity_types.sort("sequence", "asc"));
  const people = useCollection(db.people.sort("name", "asc"));
  const me = auth.me();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [deadline, setDeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [person, setPerson] = useState("");
  const run = async (p: Promise<Outcome>) => { const out = await p; if (!out.ok) toast(out.message); return out.ok; };
  // Picking a type suggests its usual due date, as Odoo does.
  const pickType = (t: string) => {
    setType(t);
    const kind = types.items.find((k) => k.id === t);
    if (kind) setDeadline(dayFromToday(kind.delay_count ?? 0));
  };
  const schedule = async () => {
    const ok = await run(call(db.run.todo_schedule_activity, {
      id, type: Number(type), deadline, summary, ...(person ? { person: Number(person) } : {}),
    }));
    if (ok) { setOpen(false); setSummary(""); setType(""); setPerson(""); }
  };
  return (
    <div className="activities">
      <span className="chatter-label">Planned activities ({planned.items.length})</span>
      <ul className="activity-list">
        {planned.items.map((a) => (
          <li key={a.id} className="activity">
            <span className={`activity-clock ${a.state ?? ""}`} aria-hidden="true"><AlarmClock size={14} /></span>
            <span className={`activity-due ${a.state ?? ""}`}>{a.state === "today" ? "Today" : a.date_deadline}</span>
            <strong>{a.type}</strong>
            <span>{a.summary}</span>
            <span className="muted">for {a.assignee}</span>
            <span className="grow" />
            <button className="btn" onClick={() => {
              const feedback = window.prompt(`Mark "${a.summary ?? a.type}" done. Feedback (optional):`, "");
              if (feedback !== null) void run(call(db.run.todo_activity_done, { activity: Number(a.id), feedback }));
            }}>Mark done</button>
            <button className="btn" onClick={() => void run(call(db.run.todo_activity_cancel, { activity: Number(a.id) }))}>Cancel</button>
          </li>
        ))}
      </ul>
      {!open ? (
        <button className="btn" onClick={() => setOpen(true)}><AlarmClock size={14} aria-hidden="true" /> Schedule an activity</button>
      ) : (
        <div className="activity-form" role="group" aria-label="Schedule an activity">
          <select className="input" aria-label="Activity type" value={type} onChange={(e) => pickType(e.target.value)}>
            <option value="">Type…</option>
            {types.items.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input className="input" type="date" aria-label="Due date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <input className="input" aria-label="Summary" placeholder="Summary" value={summary} onChange={(e) => setSummary(e.target.value)} />
          <select className="input" aria-label="Assigned to" value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">{me?.name ?? "Me"}</option>
            {people.items.filter((p) => Number(p.id) !== me?.uid).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-primary" disabled={!type || !deadline} onClick={() => void schedule()}>Schedule</button>
          <button className="btn" onClick={() => setOpen(false)}>Discard</button>
        </div>
      )}
    </div>
  );
});

/** As Odoo's chatter dates a message: the time today, else the day and time. */
const messageDate = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${time}`;
};

/**
 * Odoo's chatter under the form: log an internal note, then the to-do's notes, messages and
 * Odoo's notices, newest first. Bodies show as text, never as HTML.
 */
const Chatter = observer(({ id }: { id: number }) => {
  const db = useDb();
  const { items, error } = useCollection(db.messages.where({ res_id: id }).sort("date", "desc"));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const log = async () => {
    if (!note.trim()) return;
    setBusy(true);
    const out = await call(db.run.todo_log_note, { id, note: note.trim() });
    setBusy(false);
    if (!out.ok) { toast(out.message); return; }
    setNote("");
  };
  return (
    <section className="chatter" aria-label="Chatter">
      <Followers id={id} />
      <Activities id={id} />
      <label className="chatter-label" htmlFor="log-note">Log note</label>
      <textarea id="log-note" className="input" rows={2} placeholder="Log an internal note…" value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void log(); } }} />
      <div className="row">
        <button className="btn btn-primary" disabled={busy || !note.trim()} onClick={() => void log()}>Log</button>
        <span className="muted">Internal: only people who see this to-do read it; nobody is notified.</span>
      </div>
      {error && <p className="alert">{error}</p>}
      <ol className="messages">
        {items.map((m) => (
          <li key={m.id} className={`message ${m.kind ?? ""}`}>
            <Avatar name={m.author ?? "?"} />
            <div>
              <div className="message-head">
                <strong>{m.author ?? "Someone"}</strong>
                <span className="muted" title={fullDate(m.date)}>{messageDate(m.date)}</span>
                {m.kind === "note" && <span className="badge">Note</span>}
              </div>
              <div className="message-text">{m.text}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
});

/** A tag's name; a click opens Odoo's twelve colours (tags are shared, so it changes for everyone). */
function TagColour({ id, name, color, disabled }: { id: string; name: string; color: number | null | undefined; disabled?: boolean }) {
  const db = useDb();
  if (disabled) return <>{name}</>;
  const set = async (c: number) => {
    const out = await call(db.run.tag_set_color, { id: Number(id), color: c });
    if (!out.ok) toast(out.message);
  };
  return (
    <DialogTrigger>
      {/* `slot={null}`: inside a Tag, a Button would otherwise take the Tag's "remove" slot. */}
      <Button slot={null} className="chip-name" aria-label={`${name}: change colour`}>{name}</Button>
      <Popover className="popover" placement="bottom start" offset={4}>
        <Dialog className="swatches" aria-label={`Colour of ${name}`}>
          {({ close }) => Array.from({ length: TAG_COLOR_COUNT }, (_, c) => (
            <Button key={c} className={`swatch${(color ?? 0) === c ? " on" : ""}`} style={{ background: tagColor(c) }}
              aria-label={c === 0 ? "No colour" : `Colour ${c}`} onPress={() => { void set(c); close(); }} />
          ))}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

/** Assignees with their initials; I can't take myself off (the to-do would leave my list). */
const PeoplePicker = observer(({ selected, meId, disabled, onChange }: PickerProps & { meId: string }) => {
  const db = useDb();
  const { items } = useCollection(db.people.sort("name", "asc"));
  return (
    <MultiPicker labelId="f-assignees" addLabel="Assign someone" placeholder="Assign…" disabled={disabled}
      options={items.map((p) => ({ id: p.id, name: p.name ?? "" }))} selected={selected} onChange={onChange}
      removable={(id) => id !== meId}
      chip={(o) => <><Avatar name={o.name} large />{o.name}</>} />
  );
});
