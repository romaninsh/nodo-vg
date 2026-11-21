import { useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { observer, useCollection } from "@vantage-ui/client/react";
import {
  DndContext, DragOverlay, useDraggable, useDroppable, type Announcements, type DragEndEvent, type UniqueIdentifier,
} from "@dnd-kit/core";
import { Button, Form, Input, TextField } from "react-aria-components";
import { Check, ChevronLeft, Clock, Plus, X } from "lucide-react";
import type { Cards, Stages } from "../vantage.gen";
import { call, deadlineLabel, fullDate, isDone, useDb } from "../lib";
import { pendingValue, setPending, usePending, usePendingStore } from "../pending";
import { TagPills, ViewSwitcher } from "../components";
import { Avatars, DoneCheck, Priority, PriorityStar, toast, type Level } from "../ui";
import { columnUnder, justDropped, markDrop, useBoardSensors } from "../dnd";

const INSTRUCTIONS =
  "Press Enter to open this to-do. To move it to another column, press Space, choose the column with the left and right arrow keys, then press Space to drop it or Escape to cancel.";

/** My to-dos as a board: one column per personal stage (Inbox, Today, …), like Odoo's To-do. */
export const Board = observer(() => {
  const db = useDb();
  const stages = useCollection(db.stages.sort("sequence", "asc"));
  // All my cards in one query, grouped into columns here: a query per column multiplied by
  // columns and open tabs.
  const cards = useCollection(db.cards.all);
  const pending = usePendingStore();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState<UniqueIdentifier | null>(null);
  const sensors = useBoardSensors();
  if (stages.error) return <p className="alert">{stages.error}</p>;

  const first = stages.items[0]?.id;
  // A card just dropped shows in its new column at once; the server's copy catches up later.
  const stageOf = (c: Cards) => pendingValue(pending, c.task_id, "stage_id") ?? String(c.stage_id ?? "");
  const byStage = new Map<string, Cards[]>();
  for (const c of cards.items) {
    const key = stageOf(c);
    byStage.set(key, [...(byStage.get(key) ?? []), c]);
  }
  const cardOf = (id: UniqueIdentifier | undefined) => cards.items.find((c) => String(c.task_id) === String(id));
  const stageName = (id: UniqueIdentifier | undefined) => stages.items.find((s) => s.id === String(id))?.name ?? "";
  const nameOf = (id: UniqueIdentifier) => cardOf(id)?.["task.name"] ?? "the to-do";

  const drop = async ({ active, over }: DragEndEvent) => {
    setDragging(null);
    markDrop();
    const card = cardOf(active.id);
    if (!over || !card || card.task_id == null) return;
    const from = stageOf(card);
    const to = String(over.id);
    if (from === to) return;
    setPending(card.task_id, { stage_id: to });
    const out = await call(db.run.todo_move, { id: card.task_id, stage: Number(to) });
    if (!out.ok) {
      setPending(card.task_id, { stage_id: from });
      toast(out.message);
    }
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => over ? `${nameOf(active.id)} is over ${stageName(over.id)}.` : `${nameOf(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) => over ? `${nameOf(active.id)} dropped in ${stageName(over.id)}.` : `${nameOf(active.id)} dropped where it was.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  };

  const lifted = dragging == null ? undefined : cardOf(dragging);
  return (
    <>
      <div className="cp">
        <div className="crumbs">My to-dos</div>
        <div className="grow" />
        <ViewSwitcher current="board" />
      </div>
      {stages.loadState === "loading" && <p className="muted pad">Loading…</p>}
      {stages.loadState !== "loading" && stages.items.length === 0 && (
        <p className="alert">You have no to-do columns yet. Open To-do in Odoo once to create them.</p>
      )}
      <DndContext sensors={sensors} collisionDetection={columnUnder}
        accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}
        onDragStart={({ active }) => setDragging(active.id)} onDragCancel={() => setDragging(null)}
        onDragEnd={(e) => void drop(e)}>
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
        <DragOverlay dropAnimation={null}>{lifted && <CardView card={lifted} lifted />}</DragOverlay>
      </DndContext>
    </>
  );
});

type ColumnProps = { stage: Stages; cards: Cards[]; error?: string | null; inbox: boolean; folded: boolean; onToggle: () => void };

const Column = observer(({ stage, cards, error, inbox, folded, onToggle }: ColumnProps) => {
  const [adding, setAdding] = useState(false);
  // Folded columns take drops too: dropping on "Done" is the quickest way to finish one.
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  if (folded) {
    const show = () => onToggle();
    return (
      <div ref={setNodeRef} className={`col folded${isOver ? " drop" : ""}`} role="button" tabIndex={0}
        aria-label={`${stage.name}, ${cards.length} to-dos, folded. Show`} onClick={show}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); show(); } }}>
        <h3>{stage.name} <span className="count">({cards.length})</span></h3>
      </div>
    );
  }
  return (
    <section ref={setNodeRef} className={`col${isOver ? " drop" : ""}`} aria-label={stage.name ?? undefined}>
      <h3>
        {stage.name} <span className="count">{cards.length}</span>
        <span className="col-tools">
          {stage.fold && (
            <Button className="icon-btn" aria-label={`Fold ${stage.name}`} onPress={onToggle}><ChevronLeft size={16} aria-hidden="true" /></Button>
          )}
          <Button className="icon-btn" aria-label={`Add a to-do to ${stage.name}`} onPress={() => setAdding(true)}><Plus size={16} aria-hidden="true" /></Button>
        </span>
      </h3>
      {adding && <QuickCreate stage={stage} inbox={inbox} onClose={() => setAdding(false)} />}
      {error && <p className="alert">{error}</p>}
      {cards.map((c) => <Card key={c.id} card={c} />)}
    </section>
  );
});

/** Odoo's quick create: type a title, Enter adds it (and keeps the box open for the next one). */
function QuickCreate({ stage, inbox, onClose }: { stage: Stages; inbox: boolean; onClose: () => void }) {
  const db = useDb();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async (e: FormEvent | null, edit = false) => {
    e?.preventDefault();
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
    <Form className="quick" onSubmit={(e) => void add(e)}>
      <TextField aria-label={`Title of the new to-do in ${stage.name}`} value={name} onChange={setName} autoFocus
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <Input className="input" placeholder="Title of the to-do" />
      </TextField>
      <div className="row">
        <Button type="submit" className="btn btn-primary" isDisabled={busy || !name.trim()}>Add</Button>
        <Button className="btn" isDisabled={busy || !name.trim()} onPress={() => void add(null, true)}>Edit</Button>
        <Button className="btn icon" aria-label="Close" onPress={onClose}><X size={14} aria-hidden="true" /></Button>
      </div>
    </Form>
  );
}

const Card = observer(({ card }: { card: Cards }) => {
  const navigate = useNavigate();
  const task = card.task_id;
  const { attributes: { "aria-pressed": _, ...attributes }, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: String(task ?? card.id),
    disabled: task == null,
    attributes: { role: "group", roleDescription: "draggable to-do" },
  });
  const openIt = () => { if (task != null && !justDropped()) navigate(`/todo/${task}`); };
  const ref = (el: HTMLElement | null) => { setNodeRef(el); setActivatorNodeRef(el); };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    listeners?.onKeyDown?.(e);
    if (e.key === "Enter" && e.target === e.currentTarget && !isDragging) openIt();
  };
  return (
    <CardView card={card} cardRef={ref} dimmed={isDragging}
      props={{ ...attributes, ...listeners, onKeyDown, onClick: openIt }} />
  );
});

/** A card's face, on the board and under the pointer while it is dragged (`lifted`, no controls). */
const CardView = observer(({ card, lifted, dimmed, cardRef, props }: {
  card: Cards;
  lifted?: boolean;
  dimmed?: boolean;
  cardRef?: (el: HTMLElement | null) => void;
  props?: React.HTMLAttributes<HTMLElement>;
}) => {
  const db = useDb();
  const task = card.task_id;
  const v = usePending(task, {
    name: card["task.name"],
    priority: card["task.priority"],
    state: card["task.state"],
    tag_ids: card["task.tag_ids"],
    assignees: card["task.assignees"],
    date_deadline: card["task.date_deadline"],
    stage_id: String(card.stage_id ?? ""),
  });
  const done = isDone(v.state);
  const due = card["task.due"];
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
  const cls = `card${done || v.state === "1_canceled" ? " done" : ""}${dimmed ? " dimmed" : ""}${lifted ? " lifted" : ""}`;
  return (
    <article ref={cardRef} className={cls} aria-label={v.name ?? undefined} {...props}>
      <div className="top">
        <span className="title">{v.name}</span>
      </div>
      {card["task.summary"] && <div className="summary">{card["task.summary"]}</div>}
      <TagPills tagIds={v.tag_ids} />
      <div className="bottom">
        {lifted ? <PriorityStar level={Number(v.priority ?? 0)} /> : <Priority value={v.priority} onChange={(p) => void setPriority(p)} />}
        {v.date_deadline && (
          <span className={`deadline${due === "overdue" ? " overdue" : due === "today" ? " today" : ""}`} title={fullDate(v.date_deadline)}>
            <Clock size={12} aria-hidden="true" /> {deadlineLabel(v.date_deadline)}
          </span>
        )}
        <Avatars names={v.assignees} />
        {lifted ? <span className="donecheck" data-selected={done || undefined} aria-hidden="true"><Check size={12} strokeWidth={3} /></span> : <DoneCheck done={done} onToggle={() => void toggleDone()} />}
      </div>
    </article>
  );
});
