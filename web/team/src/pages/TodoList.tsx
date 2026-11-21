import { useState } from "react";
import { useNavigate } from "react-router";
import { observer, useCollection } from "@vantage-ui/client/react";
import { Input, SearchField, ToggleButton, ToggleButtonGroup, Button } from "react-aria-components";
import { Search, Star, X } from "lucide-react";
import { auth, call, deadlineLabel, fullDate, isDone, useDb } from "../lib";
import { TagPills, ViewSwitcher } from "../components";
import { Avatars, DoneCheck, Priority, toast, type Level } from "../ui";
import { setPending, usePending } from "../pending";
import type { Todos } from "../vantage.gen";

type Filter = "open" | "done" | "starred" | "overdue" | "archived" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "starred", label: "Starred" },
  { key: "overdue", label: "Overdue" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
  { key: "archived", label: "Archived" },
];

/** My to-dos as a list, with the deadline, tags and who else has it. */
export const TodoList = observer(() => {
  const db = useDb();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("open");
  const [text, setText] = useState("");

  // The server filters and sorts; the page shows rows in the order they arrive.
  let q = db.todos.where({ active: filter !== "archived" });
  // Open, as in Odoo: not done or cancelled, and not sitting in one of my folded columns
  // (Done, Cancelled). `open_for` lists who still has it open, as ",2,7,".
  if (filter === "open") q = q.where({ open_for: { like: `,${auth.me()?.uid ?? 0},` } });
  if (filter === "done") q = q.where({ state: "1_done" });
  if (filter === "starred") q = q.where({ priority: { in: ["1", "2", "3"] } });
  if (filter === "overdue") q = q.where({ due: "overdue" });
  // `like` matches "contains", ignoring case (the server adds the wildcards).
  if (text.trim()) q = q.where({ name: { like: text.trim() } });
  const list = useCollection(q.sort("date_deadline", "asc"));
  // The server sorts on one column, so to-dos with the same deadline (or none) arrive in any
  // order; the id keeps them in one order between loads.
  const rows = [...list.items].sort((a, b) =>
    (a.date_deadline ?? "￿").localeCompare(b.date_deadline ?? "￿") || Number(a.id) - Number(b.id));

  const setPriority = async (id: string, priority: Level) => {
    const out = await call(db.run.todo_set_priority, { id: Number(id), priority });
    if (!out.ok) toast(out.message);
    else setPending(id, { priority });
  };
  const toggleDone = async (id: string, done: boolean) => {
    const out = await call(db.run.todo_toggle_done, { id: Number(id) });
    if (!out.ok) toast(out.message);
    else setPending(id, { state: done ? "01_in_progress" : "1_done" });
  };

  return (
    <>
      <div className="cp">
        <div className="crumbs">My to-dos</div>
        <SearchField aria-label="Search to-dos" className="search" value={text} onChange={setText}>
          <Search size={14} aria-hidden="true" />
          <Input className="search-input" placeholder="Search…" />
          <Button className="search-clear"><X size={14} aria-hidden="true" /></Button>
        </SearchField>
        <ToggleButtonGroup aria-label="Filter" className="chips" selectionMode="single" disallowEmptySelection
          selectedKeys={[filter]} onSelectionChange={(keys) => { const k = [...keys][0]; if (k) setFilter(k as Filter); }}>
          {FILTERS.map((f) => <ToggleButton key={f.key} id={f.key} className="chip">{f.label}</ToggleButton>)}
        </ToggleButtonGroup>
        <div className="grow" />
        <ViewSwitcher current="list" />
      </div>
      {list.error && <p className="alert">{list.error}</p>}
      <div className="list">
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}><span className="sr-only">Done</span></th>
              <th>To-do</th>
              <th style={{ width: 40 }} title="Priority"><Star size={14} aria-hidden="true" /><span className="sr-only">Priority</span></th>
              <th className="col-deadline">Deadline</th>
              <th className="col-wide">Tags</th>
              <th className="col-wide">Assigned to</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <Row key={t.id} t={t} onOpen={() => navigate(`/todo/${t.id}`)}
                onPriority={(p) => void setPriority(t.id, p)} onDone={(done) => void toggleDone(t.id, done)} />
            ))}
          </tbody>
        </table>
        {list.loadState !== "loading" && list.items.length === 0 && <div className="empty">No to-dos here.</div>}
      </div>
    </>
  );
});

const Row = observer(({ t, onOpen, onPriority, onDone }: {
  t: Todos;
  onOpen: () => void;
  onPriority: (level: Level) => void;
  onDone: (done: boolean) => void;
}) => {
  const v = usePending(t.id, { name: t.name, priority: t.priority, state: t.state, tag_ids: t.tag_ids, assignees: t.assignees, date_deadline: t.date_deadline });
  const done = isDone(v.state);
  return (
    <tr className={`row${done ? " done" : ""}`} onClick={onOpen}>
      <td><DoneCheck done={done} onToggle={() => onDone(done)} /></td>
      <td className="name">{v.name}</td>
      <td><Priority value={v.priority} onChange={onPriority} /></td>
      <td>
        <span className={`deadline${t.due === "overdue" ? " overdue" : t.due === "today" ? " today" : ""}`} title={fullDate(v.date_deadline)}>
          {deadlineLabel(v.date_deadline)}
        </span>
      </td>
      <td className="col-wide"><TagPills tagIds={v.tag_ids} /></td>
      <td className="col-wide"><span className="people"><Avatars names={v.assignees} /> <span className="muted">{v.assignees}</span></span></td>
    </tr>
  );
});
