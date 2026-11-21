import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { observer, useCollection } from "@vantage-ui/client/react";
import type { Cards, Stages } from "../vantage.gen";
import { call, deadlineLabel, fullDate, isDone, useDb } from "../lib";
import { setPending, usePending } from "../pending";
import { Avatars, DoneCheck, Priority, TagPills, toast, type Level } from "../components";

/** My to-dos as a board: one column per personal stage (Inbox, Today, …), like Odoo's To-do. */
export const Board = observer(() => {
  const db = useDb();
  const stages = useCollection(db.stages.sort("sequence", "asc"));
  // All my cards in one query, grouped into columns here: a query per column multiplied by
  // columns and open tabs.
  const cards = useCollection(db.cards.all);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (stages.error) return <p className="alert">{stages.error}</p>;
  const first = stages.items[0]?.id;
  const byStage = new Map<string, Cards[]>();
  for (const c of cards.items) {
    const key = String(c.stage_id ?? "");
    byStage.set(key, [...(byStage.get(key) ?? []), c]);
  }
  return (
    <>
      <div className="cp">
        <div className="crumbs">My to-dos</div>
        <div className="grow" />
        <div className="switcher">
          <Link to="/" className="active" title="Board">▦ Board</Link>
          <Link to="/list" title="List">☰ List</Link>
        </div>
      </div>
      {stages.loadState === "loading" && <p className="muted" style={{ padding: 16 }}>Loading…</p>}
      {stages.loadState !== "loading" && stages.items.length === 0 && (
        <p className="alert">You have no to-do columns yet. Open To-do in Odoo once to create them.</p>
      )}
      <div className="board">
        {stages.items.map((s) => (
          <Column
            key={s.id}
            stage={s}
            cards={byStage.get(String(s.id)) ?? []}
            error={cards.error}
            inbox={s.id === first}
            folded={!!s.fold && !open[s.id]}
            onToggle={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
          />
        ))}
      </div>
    </>
  );
});

type ColumnProps = { stage: Stages; cards: Cards[]; error?: string | null; inbox: boolean; folded: boolean; onToggle: () => void };

const Column = observer(({ stage, cards, error, inbox, folded, onToggle }: ColumnProps) => {
  const db = useDb();
  const [over, setOver] = useState(false);
  const [adding, setAdding] = useState(false);

  const drop = async (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const task = Number(e.dataTransfer.getData("text/nodo-task"));
    const from = e.dataTransfer.getData("text/nodo-stage");
    if (!task || from === stage.id) return;
    const out = await call(db.run.todo_move, { id: task, stage: Number(stage.id) });
    if (!out.ok) toast(out.message);
  };

  if (folded) {
    return (
      <div className={`col folded${over ? " drop" : ""}`} onClick={onToggle} title="Show"
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => void drop(e)}>
        <h3>{stage.name} <span className="count">({cards.length})</span></h3>
      </div>
    );
  }
  return (
    <div className={`col${over ? " drop" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => void drop(e)}>
      <h3>
        {stage.name} <span className="count">{cards.length}</span>
        {stage.fold && <button title="Fold" onClick={onToggle}>‹</button>}
        <button title={`Add a to-do to ${stage.name}`} onClick={() => setAdding(true)}>+</button>
      </h3>
      {adding && <QuickCreate stage={stage} inbox={inbox} onClose={() => setAdding(false)} />}
      {error && <p className="alert">{error}</p>}
      {cards.map((c) => <Card key={c.id} card={c} />)}
    </div>
  );
});

/** Odoo's quick create: type a title, Enter adds it (and keeps the box open for the next one). */
function QuickCreate({ stage, inbox, onClose }: { stage: Stages; inbox: boolean; onClose: () => void }) {
  const db = useDb();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async (e: FormEvent, edit = false) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const out = await call<{ name: string }, { id: number }>(db.run.todo_create, { name: name.trim() });
    if (out.ok && !inbox) {
      const moved = await call(db.run.todo_move, { id: out.value.id, stage: Number(stage.id) });
      if (!moved.ok) toast(moved.message);
    }
    setBusy(false);
    if (!out.ok) { toast(out.message); return; }
    setName("");
    if (edit) navigate(`/todo/${out.value.id}`);
  };
  return (
    <form className="quick" onSubmit={(e) => void add(e)}>
      <input autoFocus placeholder="Title of the to-do" value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} />
      <div className="row">
        <button className="btn btn-primary" disabled={busy || !name.trim()}>Add</button>
        <button type="button" className="btn" disabled={busy || !name.trim()} onClick={(e) => void add(e, true)}>Edit</button>
        <button type="button" className="btn" onClick={onClose}>✕</button>
      </div>
    </form>
  );
}

const Card = observer(({ card }: { card: Cards }) => {
  const db = useDb();
  const navigate = useNavigate();
  const task = card.task_id;
  const v = usePending(task, {
    name: card["task.name"],
    priority: card["task.priority"],
    state: card["task.state"],
    tag_ids: card["task.tag_ids"],
    assignees: card["task.assignees"],
    date_deadline: card["task.date_deadline"],
  });
  const done = isDone(v.state);
  const due = card["task.due"];
  const fromControl = useRef(false);
  const setPriority = async (priority: Level) => {
    if (task == null) return;
    const out = await call(db.run.todo_set_priority, { id: task, priority });
    if (!out.ok) toast(out.message);
    else setPending(task, { priority });
  };
  const toggleDone = async () => {
    if (task == null) return;
    const out = await call(db.run.todo_toggle_done, { id: task });
    if (!out.ok) toast(out.message);
    else setPending(task, { state: done ? "01_in_progress" : "1_done" });
  };
  return (
    <div
      className={`card${done || v.state === "1_canceled" ? " done" : ""}`}
      draggable
      onMouseDownCapture={(e) => { fromControl.current = !!(e.target as Element).closest(".prio, .prio-menu, .donecheck"); }}
      onDragStart={(e) => {
        // A drag that starts on the priority star or the done check isn't a card move.
        if (fromControl.current) { e.preventDefault(); return; }
        e.dataTransfer.setData("text/nodo-task", String(task ?? ""));
        e.dataTransfer.setData("text/nodo-stage", String(card.stage_id ?? ""));
      }}
      onClick={() => task != null && navigate(`/todo/${task}`)}
    >
      <div className="top">
        <span className="title">{v.name}</span>
      </div>
      {card["task.summary"] && <div className="summary">{card["task.summary"]}</div>}
      <TagPills tagIds={v.tag_ids} />
      <div className="bottom">
        <Priority value={v.priority} onChange={(p) => void setPriority(p)} />
        {v.date_deadline && (
          <span className={`deadline${due === "overdue" ? " overdue" : due === "today" ? " today" : ""}`} title={fullDate(v.date_deadline)}>
            ⏱ {deadlineLabel(v.date_deadline)}
          </span>
        )}
        <Avatars names={v.assignees} />
        <DoneCheck done={done} onToggle={() => void toggleDone()} />
      </div>
    </div>
  );
});
