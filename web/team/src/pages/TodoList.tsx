import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { observer, useCollection } from "@vantage-ui/client/react";
import { auth, call, deadlineLabel, fullDate, isDone, useDb } from "../lib";
import { Avatars, TagPills, toast } from "../components";
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
  if (filter === "starred") q = q.where({ priority: "1" });
  if (filter === "overdue") q = q.where({ due: "overdue" });
  // `like` matches "contains", ignoring case (the server adds the wildcards).
  if (text.trim()) q = q.where({ name: { like: text.trim() } });
  const list = useCollection(q.sort("date_deadline", "asc"));

  const star = async (e: React.MouseEvent, id: string, starred: boolean) => {
    e.stopPropagation();
    const out = await call(db.run.todo_toggle_star, { id: Number(id) });
    if (!out.ok) toast(out.message);
    else setPending(id, { priority: starred ? "0" : "1" });
  };

  return (
    <>
      <div className="cp">
        <div className="crumbs">My to-dos</div>
        <input className="search" placeholder="Search…" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="chips">
          {FILTERS.map((f) => (
            <button key={f.key} className={`chip${filter === f.key ? " on" : ""}`} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
        <div className="grow" />
        <div className="switcher">
          <Link to="/" title="Board">▦ Board</Link>
          <Link to="/list" className="active" title="List">☰ List</Link>
        </div>
      </div>
      {list.error && <p className="alert">{list.error}</p>}
      <div className="list">
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th>To-do</th>
              <th style={{ width: 150 }}>Deadline</th>
              <th>Tags</th>
              <th>Assigned to</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((t) => (
              <Row key={t.id} t={t} onOpen={() => navigate(`/todo/${t.id}`)} onStar={(e, starred) => void star(e, t.id, starred)} />
            ))}
          </tbody>
        </table>
        {list.loadState !== "loading" && list.items.length === 0 && <div className="empty">No to-dos here.</div>}
      </div>
    </>
  );
});

const Row = observer(({ t, onOpen, onStar }: { t: Todos; onOpen: () => void; onStar: (e: React.MouseEvent, starred: boolean) => void }) => {
  const v = usePending(t.id, { name: t.name, priority: t.priority, state: t.state, tag_ids: t.tag_ids, assignees: t.assignees, date_deadline: t.date_deadline });
  const starred = v.priority === "1";
  return (
    <tr className={`row${isDone(v.state) ? " done" : ""}`} onClick={onOpen}>
      <td><button className={`star${starred ? " on" : ""}`} onClick={(e) => onStar(e, starred)} title="Star">★</button></td>
      <td className="name">{v.name}</td>
      <td>
        <span className={`deadline${t.due === "overdue" ? " overdue" : t.due === "today" ? " today" : ""}`} title={fullDate(v.date_deadline)}>
          {deadlineLabel(v.date_deadline)}
        </span>
      </td>
      <td><TagPills tagIds={v.tag_ids} /></td>
      <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Avatars names={v.assignees} /> <span className="muted">{v.assignees}</span></span></td>
    </tr>
  );
});
