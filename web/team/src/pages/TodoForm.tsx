import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { observer, useCollection, useRecord } from "@vantage-ui/client/react";
import type { Todos } from "../vantage.gen";
import { auth, avatarColor, call, fromLocalInput, ids, initials, isDone, toLocalInput, useDb, type Outcome } from "../lib";
import { TagPills, toast } from "../components";
import { setPending, usePending } from "../pending";

/** One to-do: read it, edit it, star it, tag it, assign it, mark it done. */
export const TodoForm = observer(() => {
  const db = useDb();
  const { id = "" } = useParams();
  const ref = useMemo(() => db.todos.ref(id), [db, id]);
  const { value: todo, status, error } = useRecord(ref);
  if (status === "error") return <p className="alert">{error}</p>;
  if (status === "missing") return <p className="alert">This to-do isn't in your list. <Link to="/">Back to my to-dos</Link></p>;
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
    notes: todo.notes ?? "",
  });
  const saved = { name: v.name ?? "", deadline: toLocalInput(v.date_deadline), notes: v.notes ?? "" };
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
  const starred = v.priority === "1";

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
            {done ? "↺ Open again" : "✓ Mark as done"}
          </button>
          {done && <span className="badge done">Done</span>}
          {archived && <span className="badge archived">Archived</span>}
          <div className="grow" />
          <StageBar id={id} />
        </div>
        <div className="titlerow">
          <button className={`star${starred ? " on" : ""}`} title={starred ? "Remove the star" : "Star"} disabled={busy}
            onClick={() => void run(call(db.run.todo_toggle_star, { id }), () => setPending(id, { priority: starred ? "0" : "1" }))}>★</button>
          <input aria-label="Title" value={name} placeholder="e.g. Call the supplier"
            onChange={(e) => { setEditing(true); setName(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter" && dirty) void save(); }} />
        </div>
        <div className="fields">
          <label>Assignees</label>
          <PeoplePicker selected={peopleIds} meId={me ? String(me.uid) : ""} onChange={(l) => void setPeople(l)} />
          <label htmlFor="deadline">Deadline</label>
          <span>
            <input id="deadline" type="datetime-local" value={deadline} onChange={(e) => { setEditing(true); setDeadline(e.target.value); }} />
            {deadline && <button className="btn" style={{ marginLeft: 6 }} onClick={() => { setEditing(true); setDeadline(""); }}>Clear</button>}
            {todo.due === "overdue" && !done && <span className="deadline overdue" style={{ marginLeft: 10 }}>Overdue</span>}
          </span>
          <label>Tags</label>
          <TagPicker selected={tagIds} onChange={(l) => void setTags(l)} />
        </div>
        <div className="tabs"><span>Description</span></div>
        <textarea className="desc" aria-label="Description" value={notes} placeholder="Add details about this to-do…"
          onChange={(e) => { setEditing(true); setNotes(e.target.value); }} />
        <p className="muted">Title, deadline and description are kept with Save; the star, tags, assignees and done are saved at once.</p>
        <button className="btn" onClick={() => navigate(-1)}>← Back</button>
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

const TagPicker = observer(({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) => {
  const db = useDb();
  const { items } = useCollection(db.tags.sort("name", "asc"));
  return (
    <span className="picker">
      <TagPills tagIds={selected.join(",")} onRemove={(t) => onChange(selected.filter((x) => x !== t))} />
      <select value="" aria-label="Add a tag" onChange={(e) => e.target.value && onChange([...selected, e.target.value])}>
        <option value="">Add a tag…</option>
        {items.filter((t) => !selected.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </span>
  );
});

const PeoplePicker = observer(({ selected, meId, onChange }: { selected: string[]; meId: string; onChange: (ids: string[]) => void }) => {
  const db = useDb();
  const { items } = useCollection(db.people.sort("name", "asc"));
  const byId = new Map(items.map((p) => [p.id, p]));
  return (
    <span className="picker">
      {selected.map((pid) => {
        const n = byId.get(pid)?.name ?? "…";
        return (
          <span key={pid} className="person">
            <span className="avatar lg" style={{ background: avatarColor(n) }}>{initials(n)}</span>
            {n}
            {pid !== meId && <button aria-label={`Unassign ${n}`} onClick={() => onChange(selected.filter((x) => x !== pid))}>×</button>}
          </span>
        );
      })}
      <select value="" aria-label="Assign someone" onChange={(e) => e.target.value && onChange([...selected, e.target.value])}>
        <option value="">Assign…</option>
        {items.filter((p) => !selected.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </span>
  );
});
