import { useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { observer, useCollection } from "@vantage-ui/client/react";
import { DndContext, DragOverlay, useDraggable, useDroppable, type Announcements, type DragEndEvent, type UniqueIdentifier } from "@dnd-kit/core";
import { Button, Form, Input, TextField, ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { CalendarClock, ChevronLeft, CornerDownRight, Flag, Lock, Mail, Plus, Timer, User, X } from "lucide-react";
import type { TaskStages, Tasks } from "../vantage.gen";
import { call, deadlineLabel, useDb } from "../lib";
import { pendingValue, setPending, usePending, usePendingStore } from "../pending";
import { columnUnder, justDropped, markDrop, useBoardSensors } from "../dnd";
import { ActivityIcon, Avatars, ColumnProgress, Priority, PriorityStar, TaskState, TaskStateIcon, toast, type Level, type Segment, type TaskStateValue } from "../ui";
import { Mood, ProjectTagPills, cardOrder, formatHours, hoursTone, isClosed, taskKey } from "./lib";

const CLOSED = ["1_done", "1_canceled"];
type Show = "open" | "closed" | "all";
const SHOWS: { id: Show; label: string }[] = [{ id: "open", label: "Open" }, { id: "closed", label: "Closed" }, { id: "all", label: "All" }];

const INSTRUCTIONS =
  "Press Enter to open this task. To move it to another stage, press Space, choose the stage with the left and right arrow keys, then press Space to drop it or Escape to cancel.";

// Odoo's column bar on a project board: one segment per task state.
const SEGMENTS: { key: string; label: string; tone: Segment["tone"] }[] = [
  { key: "1_done", label: "done", tone: "done" },
  { key: "03_approved", label: "approved", tone: "ok" },
  { key: "02_changes_requested", label: "changes requested", tone: "warn" },
  { key: "04_waiting_normal", label: "waiting", tone: "info" },
  { key: "1_canceled", label: "cancelled", tone: "danger" },
  { key: "01_in_progress", label: "in progress", tone: "none" },
];

/**
 * A project's tasks as Odoo's board: a column per stage of the project, the state bar and the
 * count in each header, folded stages, quick create, drag a card to another stage. Every card
 * comes from one query and is grouped into its column here.
 */
export const TaskBoard = observer(() => {
  const db = useDb();
  const { pid = "" } = useParams();
  const project = useCollection(db.projects.where({ id: pid })).items[0];
  const [show, setShow] = useState<Show>("open");
  const [subtasks, setSubtasks] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState<UniqueIdentifier | null>(null);
  const pending = usePendingStore();
  const sensors = useBoardSensors();

  let q = db.tasks.where({ project_id: pid, active: true });
  if (!subtasks) q = q.where({ display_in_project: true });
  if (show === "open") q = q.where({ state: { not_in: CLOSED } });
  if (show === "closed") q = q.where({ state: { in: CLOSED } });
  const cards = useCollection(q);
  const stages = useCollection(db.task_stages.where({ project_ids: { like: `,${pid},` } }).sort("sequence", "asc"));

  const stageOf = (c: Tasks) => String(pendingValue(pending, taskKey(c.id), "stage_id") ?? c.stage_id ?? "");
  const byStage = new Map<string, Tasks[]>();
  for (const c of [...cards.items].sort(cardOrder)) {
    const key = stageOf(c);
    byStage.set(key, [...(byStage.get(key) ?? []), c]);
  }
  const cardOf = (id: UniqueIdentifier | undefined) => cards.items.find((c) => String(c.id) === String(id));
  const stageName = (id: UniqueIdentifier | undefined) => stages.items.find((s) => s.id === String(id))?.name ?? "";
  const nameOf = (id: UniqueIdentifier) => cardOf(id)?.name ?? "the task";

  const drop = async ({ active, over }: DragEndEvent) => {
    setDragging(null);
    markDrop();
    const card = cardOf(active.id);
    if (!over || !card) return;
    const from = stageOf(card);
    const to = String(over.id);
    if (from === to) return;
    setPending(taskKey(card.id), { stage_id: to });
    const out = await call<{ id: number; stage: number }, { state: string }>(db.run.project_task_move, { id: Number(card.id), stage: Number(to) });
    if (!out.ok) {
      setPending(taskKey(card.id), { stage_id: from });
      toast(out.message);
    } else {
      setPending(taskKey(card.id), { state: out.value.state });
    }
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => over ? `${nameOf(active.id)} is over ${stageName(over.id)}.` : `${nameOf(active.id)} is not over a stage.`,
    onDragEnd: ({ active, over }) => over ? `${nameOf(active.id)} dropped in ${stageName(over.id)}.` : `${nameOf(active.id)} dropped where it was.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  };

  const lifted = dragging == null ? undefined : cardOf(dragging);
  const firstOpen = stages.items.find((s) => !s.fold)?.id ?? stages.items[0]?.id;
  const canAdd = project?.active !== false;
  return (
    <>
      <div className="cp">
        <div className="crumbs">
          <Link to="/project">Projects</Link><span className="sep">/</span><span>{project?.name ?? "…"}</span>
        </div>
        <Button className="btn btn-primary" isDisabled={!firstOpen || !canAdd} onPress={() => firstOpen && setAdding(firstOpen)}>New</Button>
        <span className="grow" />
        <ToggleButtonGroup aria-label="Show" className="chips" selectionMode="single" disallowEmptySelection
          selectedKeys={[show]} onSelectionChange={(k) => { const x = [...k][0]; if (x != null) setShow(String(x) as Show); }}>
          {SHOWS.map((s) => <ToggleButton key={s.id} id={s.id} className="chip">{s.label}</ToggleButton>)}
        </ToggleButtonGroup>
        <ToggleButton className="chip" isSelected={subtasks} onChange={setSubtasks}>Show sub-tasks</ToggleButton>
      </div>
      {cards.error && <p className="alert">{cards.error}</p>}
      {stages.loadState === "loading" && <p className="muted pad">Loading…</p>}
      {stages.loadState !== "loading" && stages.items.length === 0 && (
        <p className="muted pad">This project has no stages yet. Add them in Odoo for now.</p>
      )}
      <DndContext sensors={sensors} collisionDetection={columnUnder}
        accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}
        onDragStart={({ active }) => setDragging(active.id)} onDragCancel={() => setDragging(null)}
        onDragEnd={(e) => void drop(e)}>
        <div className="board project-board">
          {stages.items.map((s) => (
            <Column key={s.id} stage={s} project={pid} cards={byStage.get(String(s.id)) ?? []} canAdd={canAdd}
              folded={!!s.fold && !open[s.id]} onToggle={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
              adding={adding === s.id} onAdd={() => setAdding(s.id)} onAdded={() => setAdding(null)} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{lifted && <CardFace card={lifted} lifted />}</DragOverlay>
      </DndContext>
    </>
  );
});

type ColumnProps = {
  stage: TaskStages; project: string; cards: Tasks[]; folded: boolean; onToggle: () => void; canAdd: boolean;
  adding: boolean; onAdd: () => void; onAdded: () => void;
};

const Column = observer(({ stage, project, cards, folded, onToggle, canAdd, adding, onAdd, onAdded }: ColumnProps) => {
  const [only, setOnly] = useState<string | null>(null);
  const pending = usePendingStore();
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const stateOf = (c: Tasks) => String(pendingValue(pending, taskKey(c.id), "state") ?? c.state ?? "01_in_progress");
  const listed = only ? cards.filter((c) => stateOf(c) === only) : cards;

  if (folded) {
    return (
      <div ref={setNodeRef} className={`col folded${isOver ? " drop" : ""}`} role="button" tabIndex={0}
        aria-label={`${stage.name}, ${cards.length} tasks, folded. Show`} onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}>
        <h3>{stage.name} <span className="count">({cards.length})</span></h3>
      </div>
    );
  }
  const mails = stage.mails_customer || stage.asks_rating;
  return (
    <section ref={setNodeRef} className={`col${isOver ? " drop" : ""}`} aria-label={stage.name ?? undefined}>
      <h3>
        {stage.name}
        {mails && (
          <span className="col-mail" title={stage.asks_rating ? "Odoo asks the customer for a rating when a task arrives here" : "Odoo emails the customer when a task arrives here"}>
            <Mail size={13} aria-label="Emails the customer" />
          </span>
        )}
        <span className="col-tools">
          {stage.fold && (
            <Button className="icon-btn" aria-label={`Fold ${stage.name}`} onPress={onToggle}><ChevronLeft size={16} aria-hidden="true" /></Button>
          )}
          {canAdd && <Button className="icon-btn" aria-label={`Add a task to ${stage.name}`} onPress={onAdd}><Plus size={16} aria-hidden="true" /></Button>}
        </span>
      </h3>
      <div className="col-head">
        <ColumnProgress label={`Task states in ${stage.name}`} selected={only} onSelect={setOnly}
          segments={SEGMENTS.map((s) => ({ ...s, count: cards.filter((c) => stateOf(c) === s.key).length }))} />
        <span className="col-total">{cards.length}</span>
      </div>
      {adding && <QuickCreate stage={stage} project={project} onClose={onAdded} />}
      {listed.map((c) => <Card key={c.id} card={c} />)}
    </section>
  );
});

/**
 * Odoo's quick create on a project board: the task title (Odoo reads #tags, @people and ! out
 * of it) and the assignees. Add creates it in this column through Odoo and keeps the box open
 * for the next one; Edit opens the new task's form.
 */
const QuickCreate = observer(({ stage, project, onClose }: { stage: TaskStages; project: string; onClose: () => void }) => {
  const db = useDb();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!title.trim()) return null;
    setBusy(true);
    const out = await call<{ project: number; title: string; stage: number }, { id: number }>(db.run.project_task_create,
      { project: Number(project), title: title.trim(), stage: Number(stage.id) });
    setBusy(false);
    if (!out.ok) { toast(out.message); return null; }
    setTitle("");
    return out.value.id;
  };
  const add = async (e: FormEvent | null) => { e?.preventDefault(); await create(); };
  const edit = async () => { const id = await create(); if (id) navigate(`/project/${project}/tasks/${id}`); };
  return (
    <div onKeyDown={(e: ReactKeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) onClose(); }}>
      <Form className="quick" onSubmit={(e) => void add(e)}>
        <TextField aria-label="Task title" value={title} onChange={setTitle} autoFocus>
          <Input className="input" placeholder="Task title, #tag @person !" />
        </TextField>
        <div className="row">
          <Button type="submit" className="btn btn-primary" isDisabled={busy || !title.trim()}>Add</Button>
          <Button className="btn" isDisabled={busy || !title.trim()} onPress={() => void edit()}>Edit</Button>
          <span className="grow" />
          <Button className="btn icon" aria-label="Discard" onPress={onClose}><X size={14} aria-hidden="true" /></Button>
        </div>
      </Form>
    </div>
  );
});

const Card = observer(({ card }: { card: Tasks }) => {
  const navigate = useNavigate();
  const { attributes: { "aria-pressed": _, ...attributes }, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: String(card.id),
    attributes: { role: "group", roleDescription: "draggable task" },
  });
  const openIt = () => { if (!justDropped()) navigate(`/project/${card.project_id}/tasks/${card.id}`); };
  const ref = (el: HTMLElement | null) => { setNodeRef(el); setActivatorNodeRef(el); };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    listeners?.onKeyDown?.(e);
    if (e.key === "Enter" && e.target === e.currentTarget && !isDragging) openIt();
  };
  return <CardFace card={card} cardRef={ref} dimmed={isDragging} props={{ ...attributes, ...listeners, onKeyDown, onClick: openIt }} />;
});

/** A card's face, on the board and under the pointer while it is dragged (`lifted`, no controls). */
export const CardFace = observer(({ card, lifted, dimmed, cardRef, props }: {
  card: Tasks; lifted?: boolean; dimmed?: boolean;
  cardRef?: (el: HTMLElement | null) => void; props?: React.HTMLAttributes<HTMLElement>;
}) => {
  const db = useDb();
  const v = usePending(taskKey(card.id), { priority: card.priority as string | null, state: card.state as string | null });
  const save = async (patch: { priority?: Level; state?: TaskStateValue }) => {
    const before = { priority: v.priority, state: v.state };
    setPending(taskKey(card.id), patch);
    const out = await call<{ id: number; priority?: string; state?: string }, { state: string }>(db.run.project_task_save, { id: Number(card.id), ...patch });
    if (!out.ok) { setPending(taskKey(card.id), before); toast(out.message); }
    // Odoo may answer with another state (Waiting while a blocking task is open).
    else setPending(taskKey(card.id), { state: out.value.state });
  };
  const closed = isClosed(v.state);
  const due = card.date_deadline && !closed ? deadlineLabel(card.date_deadline) : "";
  const overdue = !!card.date_deadline && !closed && new Date(card.date_deadline) < new Date(new Date().toDateString());
  const showHours = card.allow_timesheets && (card.allocated_hours ?? 0) > 0;
  const cls = `card task-card${closed ? " closed" : ""}${dimmed ? " dimmed" : ""}${lifted ? " lifted" : ""}`;
  return (
    <article ref={cardRef} className={cls} aria-label={card.name ?? undefined} {...props}>
      {card.parent_id != null && <span className="parent"><CornerDownRight size={12} aria-hidden="true" />{card.parent_name}</span>}
      <div className="top">
        {card.project_id == null && <Lock size={14} aria-label="Private task" />}
        <span className="title">{card.name}</span>
      </div>
      <div className="meta">
        {card.customer && <span><User size={12} aria-label="Customer" />{card.customer}</span>}
        {card.allow_milestones && card.milestone && (
          <span className={card.milestone_late && !closed ? "late" : ""}><Flag size={12} aria-label="Milestone" />{card.milestone}</span>
        )}
        {due && <span className={`deadline${overdue ? " overdue" : due === "Today" ? " today" : ""}`}><CalendarClock size={12} aria-label="Deadline" />{due}</span>}
        {showHours && (
          <span><Timer size={12} aria-label="Remaining time" />
            <span className={`hours ${hoursTone(card.remaining_hours, card.allocated_hours)}`}>{formatHours(card.remaining_hours)}</span>
          </span>
        )}
        {card.rating_active && (card.rating_count ?? 0) > 0 && <span><Mood value={card.rating_avg} /></span>}
      </div>
      <ProjectTagPills tagIds={card.tag_ids} onCard />
      <div className="bottom">
        <ActivityIcon state={card.activity_state} icon={card.activity_icon} summary={card.activity_summary} />
        {(card.subtask_count ?? 0) > 0 && (
          <span className="subtasks-btn" title="Sub-tasks: closed / all">
            <CornerDownRight size={12} aria-hidden="true" />{card.closed_subtask_count}/{card.subtask_count}
          </span>
        )}
        {lifted ? <PriorityStar level={Number(v.priority ?? 0)} />
          : <Priority value={v.priority} onChange={(priority) => void save({ priority })} />}
        <span className="grow" />
        <Avatars names={card.assignees} />
        {lifted ? <TaskStateIcon value={v.state} /> : <TaskState value={v.state} onChange={(state) => void save({ state })} />}
      </div>
    </article>
  );
});
