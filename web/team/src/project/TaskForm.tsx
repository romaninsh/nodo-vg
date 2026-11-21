import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { observer, useCollection } from "@vantage-ui/client/react";
import { ArrowLeft, X } from "lucide-react";
import type { Tasks } from "../vantage.gen";
import { call, fromLocalInput, ids, tagColor, tagText, toLocalInput, useDb, type Outcome } from "../lib";
import { setPending, usePending } from "../pending";
import { Avatar, Avatars, DateTimePicker, MultiPicker, OnePicker, Priority, Ribbon, StageBar, TaskState, TaskStateIcon, toast, type Level, type TaskStateValue } from "../ui";
import { RichText } from "../ui/RichText";
import { formatHours, isClosed, taskKey } from "./lib";

/**
 * One project task as Odoo's form: the stage bar, title, priority and state, project, milestone,
 * assignees, tags, customer, deadline, hours, the description, and its sub-tasks and the tasks
 * it waits for. Every change is Odoo's own write. The task is read as a collection of one row,
 * so changes made anywhere show while it is open.
 */
export const ProjectTaskForm = observer(() => {
  const db = useDb();
  const { pid = "", id = "" } = useParams();
  const rows = useCollection(db.tasks.where({ id }));
  const task = rows.items[0];
  if (rows.error) return <p className="alert">{rows.error}</p>;
  if (!task && rows.loadState !== "loading") return <p className="alert">This task isn't one you can see. <Link to={`/project/${pid}/tasks`}>Back to the board</Link></p>;
  if (!task) return <p className="muted pad">Loading…</p>;
  return <Editor key={task.id} task={task} />;
});

const Editor = observer(({ task }: { task: Tasks }) => {
  const db = useDb();
  const navigate = useNavigate();
  const id = Number(task.id);
  const v = usePending(taskKey(task.id), {
    name: task.name ?? "",
    priority: task.priority as string | null,
    state: task.state as string | null,
    stage_id: task.stage_id == null ? "" : String(task.stage_id),
    active: task.active,
    tag_ids: task.tag_ids ?? "",
    assignee_ids: task.assignee_ids ?? "",
    milestone_id: task.milestone_id == null ? "" : String(task.milestone_id),
    date_deadline: task.date_deadline,
    description: task.description ?? "",
  });
  const saved = { name: v.name ?? "", deadline: toLocalInput(v.date_deadline as string | null), notes: (v.description as string) ?? "" };
  const [name, setName] = useState(saved.name);
  const [deadline, setDeadline] = useState(saved.deadline);
  const [notes, setNotes] = useState(saved.notes);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"description" | "subtasks" | "blocked">("description");
  const dirty = name !== saved.name || deadline !== saved.deadline || notes !== saved.notes;
  useEffect(() => {
    if (!editing) { setName(saved.name); setDeadline(saved.deadline); setNotes(saved.notes); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.name, saved.deadline, saved.notes]);

  const stages = useCollection(db.task_stages.where({ project_ids: { like: `,${task.project_id},` } }).sort("sequence", "asc"));
  const milestones = useCollection(db.milestones.where({ project_id: String(task.project_id ?? "") }));

  const run = async (p: Promise<Outcome<Record<string, unknown>>>, ok?: (value: Record<string, unknown>) => void, message?: string) => {
    setBusy(true);
    const out = await p;
    setBusy(false);
    if (!out.ok) toast(out.message);
    else { ok?.(out.value); if (message) toast(message); }
    return out.ok;
  };
  type SaveArgs = { id: number; name?: string; priority?: string; state?: string; date_deadline?: string; milestone_id?: string; tags?: string; users?: string; description?: string };
  const saveField = (args: Omit<SaveArgs, "id">, patch: Record<string, string | boolean | null>) =>
    run(call<SaveArgs>(db.run.project_task_save, { id, ...args }), (out) => {
      setPending(taskKey(id), patch);
      if (typeof out.state === "string") setPending(taskKey(id), { state: out.state });
    });

  const save = async () => {
    const args: Omit<SaveArgs, "id"> = {};
    if (name !== saved.name) args.name = name;
    if (deadline !== saved.deadline) args.date_deadline = fromLocalInput(deadline);
    if (notes !== saved.notes) args.description = notes;
    const ok = await run(call<SaveArgs, { description?: string }>(db.run.project_task_save, { id, ...args }), (out) => {
      setPending(taskKey(id), { name, date_deadline: fromLocalInput(deadline) || null, description: (out.description as string) ?? notes });
    }, "Saved");
    if (ok) setEditing(false);
  };
  const discard = () => { setName(saved.name); setDeadline(saved.deadline); setNotes(saved.notes); setEditing(false); };
  const move = async (stage: string, stageName: string) => {
    const before = v.stage_id;
    setPending(taskKey(id), { stage_id: stage });
    const out = await call<{ id: number; stage: number }, { state: string }>(db.run.project_task_move, { id, stage: Number(stage) });
    if (!out.ok) { setPending(taskKey(id), { stage_id: before as string }); toast(out.message); return; }
    setPending(taskKey(id), { state: out.value.state });
    toast(`Moved to ${stageName}`);
  };
  const archived = v.active === false;
  const closed = isClosed(v.state as string);
  const overdue = !!v.date_deadline && !closed && new Date(v.date_deadline as string) < new Date();

  return (
    <>
      <div className="cp">
        <div className="crumbs">
          <Link to="/project">Projects</Link><span className="sep">/</span>
          <Link to={`/project/${task.project_id}/tasks`}>{task.project_name}</Link><span className="sep">/</span>
          <span>{v.name}</span>
        </div>
        <button className="btn btn-primary" disabled={busy || !dirty || !name.trim()} onClick={() => void save()}>Save</button>
        {dirty && <button className="btn" onClick={discard}>Discard</button>}
        <div className="grow" />
        <button className="btn" disabled={busy}
          onClick={() => void run(call(db.run.project_task_archive, { id }), () => setPending(taskKey(id), { active: archived }), archived ? "Restored" : "Archived")}>
          {archived ? "Unarchive" : "Archive"}
        </button>
      </div>
      <div className="sheet project-sheet" style={{ position: "relative", overflow: "hidden" }}>
        {archived && <Ribbon text="Archived" tone="danger" />}
        <div className="status">
          <div className="grow" />
          {stages.items.length > 0 && (
            <StageBar label="Stage" current={String(v.stage_id ?? "")} disabled={busy || archived}
              stages={stages.items.map((s) => ({ id: s.id, name: s.name ?? "", folded: !!s.fold }))}
              onSelect={(s) => void move(s.id, s.name)} />
          )}
        </div>
        <div className="titlerow">
          <input aria-label="Title" value={name} placeholder="Task Title..."
            onChange={(e) => { setEditing(true); setName(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter" && dirty) void save(); }} />
          <Priority value={v.priority as string} size={26} disabled={busy}
            onChange={(priority: Level) => void saveField({ priority }, { priority })} />
          <TaskState value={v.state as string} size={22} disabled={busy} waitingMenu
            onChange={(state: TaskStateValue) => void saveField({ state }, { state })} />
        </div>
        <div className="crm-groups">
          <div className="fields">
            <span className="flabel">Project</span>
            <span><Link to={`/project/${task.project_id}/tasks`}>{task.project_name}</Link></span>
            {task.allow_milestones && (
              <>
                <span className="flabel" id="f-milestone">Milestone</span>
                <OnePicker labelId="f-milestone" placeholder="e.g. Product Launch" clearable disabled={busy}
                  options={milestones.items.map((m) => ({ id: m.id, name: m.name ?? "" }))} selected={(v.milestone_id as string) || null}
                  onChange={(m) => void saveField({ milestone_id: m ?? "" }, { milestone_id: m ?? "" })} />
              </>
            )}
            <span className="flabel" id="f-assignees">Assignees</span>
            <PeoplePicker selected={ids(v.assignee_ids as string)} disabled={busy}
              onChange={(l) => void saveField({ users: l.join(",") }, { assignee_ids: [...l].sort((a, b) => Number(a) - Number(b)).join(",") })} />
          </div>
          <div className="fields">
            <span className="flabel" id="f-tags">Tags</span>
            <TagPicker selected={ids(v.tag_ids as string)} disabled={busy}
              onChange={(l) => void saveField({ tags: l.join(",") }, { tag_ids: [...l].sort((a, b) => Number(a) - Number(b)).join(",") })} />
            {/* With Sales installed, Odoo shows the customer only on billable projects. */}
            {task.allow_billable && (
              <>
                <span className="flabel">Customer</span>
                <span>{task.customer ?? <span className="muted">None</span>}</span>
              </>
            )}
            <span className="flabel" id="f-deadline">Deadline</span>
            <span className="deadline-field">
              <DateTimePicker labelId="f-deadline" value={deadline} onChange={(d) => { setEditing(true); setDeadline(d); }} />
              {deadline && (
                <button type="button" className="btn icon" aria-label="Clear the deadline" title="Clear"
                  onClick={() => { setEditing(true); setDeadline(""); }}><X size={14} aria-hidden="true" /></button>
              )}
              {overdue && <span className="deadline overdue">Overdue</span>}
            </span>
            {task.recurring_task && (
              <>
                <span className="flabel">Recurrent</span>
                <span className="muted">Repeats; change the recurrence in Odoo for now.</span>
              </>
            )}
            {task.allow_timesheets && (
              <>
                <span className="flabel">Allocated Time</span>
                <span className="task-hours">
                  <span>{formatHours(task.allocated_hours)}</span>
                  <span className="muted">{(task.allocated_hours ?? 0) > 0 ? `${Math.round((task.progress ?? 0) * 100)} %` : ""}</span>
                  <span className="muted">Time spent</span><span>{formatHours(task.effective_hours)}</span>
                  {(task.subtask_effective_hours ?? 0) > 0 && <><span className="muted">Sub-tasks</span><span>{formatHours(task.subtask_effective_hours)}</span></>}
                  {(task.allocated_hours ?? 0) > 0 && <><span className="muted">Remaining</span><span className={(task.remaining_hours ?? 0) < 0 ? "hours over" : ""}>{formatHours(task.remaining_hours)}</span></>}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="project-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "description"} onClick={() => setTab("description")}>Description</button>
          <button role="tab" aria-selected={tab === "subtasks"} onClick={() => setTab("subtasks")}>Sub-tasks ({task.closed_subtask_count}/{task.subtask_count})</button>
          {(task.depend_on_count ?? 0) > 0 && (
            <button role="tab" aria-selected={tab === "blocked"} onClick={() => setTab("blocked")}>Blocked By ({task.closed_depend_on_count}/{task.depend_on_count})</button>
          )}
        </div>
        {tab === "description" && (
          <RichText label="Description" value={notes} placeholder="Add details about this task… Type / for commands."
            onChange={(html) => { setEditing(true); setNotes(html); }} />
        )}
        {tab === "subtasks" && <TaskRows where={{ parent_id: String(task.id) }} project={String(task.project_id)} empty="No sub-tasks yet. Add them in Odoo for now." />}
        {tab === "blocked" && <TaskRows where={{ id: { in: ids(task.depend_on_ids) } }} project={String(task.project_id)} empty="Nothing blocks this task." />}
        <p className="muted">Title, deadline and description are kept with Save; the stage, priority, state, milestone, assignees and tags are saved at once.</p>
        <button className="btn" onClick={() => navigate(-1)}><ArrowLeft size={14} aria-hidden="true" /> Back</button>
      </div>
    </>
  );
});

/** Sub-tasks or blockers as Odoo's form lists them: state, title, assignees, deadline; a click opens one. */
const TaskRows = observer(({ where, project, empty }: { where: Record<string, unknown>; project: string; empty: string }) => {
  const db = useDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = useCollection(db.tasks.where(where as any).sort("sequence", "asc"));
  if (rows.loadState !== "loading" && rows.items.length === 0) return <p className="muted">{empty}</p>;
  return (
    <table className="subtask-list">
      <tbody>
        {rows.items.map((t) => (
          <tr key={t.id} className={isClosed(t.state) ? "closed" : ""}>
            <td style={{ width: 24 }}><TaskStateIcon value={t.state} size={16} /></td>
            <td><Link to={`/project/${t.project_id ?? project}/tasks/${t.id}`}>{t.name}</Link></td>
            <td><Avatars names={t.assignees} /></td>
            <td className="muted">{t.date_deadline && !isClosed(t.state) ? new Date(t.date_deadline).toLocaleDateString() : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
});

type PickerProps = { selected: string[]; disabled?: boolean; onChange: (ids: string[]) => void };

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

const PeoplePicker = observer(({ selected, disabled, onChange }: PickerProps) => {
  const db = useDb();
  const { items } = useCollection(db.people.sort("name", "asc"));
  return (
    <MultiPicker labelId="f-assignees" addLabel="Assign someone" placeholder="Assign…" disabled={disabled}
      options={items.map((p) => ({ id: p.id, name: p.name ?? "" }))} selected={selected} onChange={onChange}
      chip={(o) => <><Avatar name={o.name} large />{o.name}</>} />
  );
});
