import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { observer, useCollection } from "@vantage-ui/client/react";
import { ArrowLeft, Check, RotateCcw, X } from "lucide-react";
import type { Todos } from "../vantage.gen";
import { auth, call, fromLocalInput, ids, isDone, tagColor, tagText, toLocalInput, useDb, type Outcome } from "../lib";
import { Avatar, DateTimePicker, MultiPicker, Priority, toast } from "../ui";
import { RichText } from "../ui/RichText";
import { setPending, usePending } from "../pending";

/**
 * One to-do: read it, edit it, set its priority, tag it, assign it, mark it done. It is read as
 * a collection of one row, as CRM's and Project's forms are: a record ref on a query-table
 * entity doesn't follow changes (FEEDBACK.md), a collection does.
 */
export const TodoForm = observer(() => {
  const db = useDb();
  const { id = "" } = useParams();
  const rows = useCollection(db.todos.where({ id }));
  const todo = rows.items[0];
  if (rows.error) return <p className="alert">{rows.error}</p>;
  if (!todo && rows.loadState !== "loading") return <p className="alert">This to-do isn't in your list. <Link to="/">Back to my to-dos</Link></p>;
  if (!todo) return <p className="muted" style={{ padding: 16 }}>Loading…</p>;
  return <Editor key={todo.id} todo={todo} />;
});

const Editor = observer(({ todo }: { todo: Todos }) => {
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
    description: todo.description ?? "",
  });
  const saved = { name: v.name ?? "", deadline: toLocalInput(v.date_deadline), notes: v.description ?? "" };
  const [name, setName] = useState(saved.name);
  const [deadline, setDeadline] = useState(saved.deadline);
  const [notes, setNotes] = useState(saved.notes);
  const [busy, setBusy] = useState(false);
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

  const save = async () => {
    const dl = fromLocalInput(deadline);
    if (!(await run(call(db.run.todo_save, { id, name, date_deadline: dl }), () => setPending(id, { name, date_deadline: dl || null })))) return;
    // The description is HTML: Odoo's own write cleans and stores it, and sends back what it kept.
    if (notes !== saved.notes) {
      const ok = await run(call<{ id: number; description: string }, { description: string | null }>(db.run.todo_set_description, { id, description: notes })
        .then((o) => { if (o.ok) setPending(id, { description: o.value.description ?? "" }); return o; }));
      if (!ok) return;
    }
    setEditing(false);
    toast("Saved");
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
      </div>
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
        <RichText label="Description" value={notes} placeholder="Add details about this to-do… Type / for commands."
          onChange={(html) => { setEditing(true); setNotes(html); }} />
        <p className="muted">Title, deadline and description are kept with Save; the priority, tags, assignees and done are saved at once.</p>
        <button className="btn" onClick={() => navigate(-1)}><ArrowLeft size={14} aria-hidden="true" /> Back</button>
      </div>
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
          title={s.id === current ? `In ${s.name}` : `Move to ${s.name}`}
          onClick={() => void move(s.id, s.name ?? "")}>
          {s.name}
        </button>
      ))}
    </nav>
  );
});

type PickerProps = { selected: string[]; disabled?: boolean; onChange: (ids: string[]) => void };

/** Tags as Odoo's coloured pills, removable; a search box adds one. */
const TagPicker = observer(({ selected, disabled, onChange }: PickerProps) => {
  const db = useDb();
  const { items } = useCollection(db.tags.sort("name", "asc"));
  const color = new Map(items.map((t) => [t.id, t.color]));
  return (
    <MultiPicker labelId="f-tags" addLabel="Add a tag" placeholder="Add a tag…" disabled={disabled}
      options={items.map((t) => ({ id: t.id, name: t.name ?? "" }))} selected={selected} onChange={onChange}
      chipStyle={(o) => ({ background: tagColor(color.get(o.id)), color: tagText(color.get(o.id)) })} />
  );
});

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
