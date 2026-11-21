import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { observer, useCollection } from "@vantage-ui/client/react";
import { Button, Input, SearchField } from "react-aria-components";
import { CalendarClock, Flag, ListChecks, Mail, Search, Timer, User, X } from "lucide-react";
import type { Projects as Project } from "../vantage.gen";
import { auth, call, useDb } from "../lib";
import { pendingValue, setPending, usePending, usePendingStore } from "../pending";
import { ActivityIcon, Avatar, FavoriteStar, ProjectStatus, toast } from "../ui";
import { Mood, ProjectTagPills, dateRange, formatHours, projectKey } from "./lib";

/** The signed-in person's Project rights (their own row only). */
export function useProjectRights() {
  const db = useDb();
  return useCollection(db.my_project.all).items[0];
}

const isFav = (favs: string | null | undefined) => {
  const me = auth.me();
  return !!me && (favs ?? "").includes(`,${me.uid},`);
};

/**
 * Odoo Project's overview: a card per project I can see, my favourites first, then Odoo's own
 * order. Every card comes from one query. A click opens the project's task board.
 */
export const ProjectsOverview = observer(() => {
  const db = useDb();
  const [text, setText] = useState("");
  let q = db.projects.where({ active: true });
  if (text.trim()) q = q.where({ name: { like: text.trim() } });
  const projects = useCollection(q.sort("sequence", "asc"));
  const rights = useProjectRights();
  const pending = usePendingStore();
  const rows = projects.items;
  // A star just pressed counts at once (the server's copy follows within a moment).
  const favs = new Map(rows.map((p) => [p.id, (pendingValue(pending, projectKey(p.id), "favorite") as boolean | undefined) ?? isFav(p.favorite_ids)]));
  const sorted = [...rows].sort((a, b) =>
    Number(favs.get(b.id)) - Number(favs.get(a.id)) || (a.sequence ?? 10) - (b.sequence ?? 10)
    || (a.name ?? "").localeCompare(b.name ?? "") || Number(a.id) - Number(b.id));
  return (
    <>
      <div className="cp">
        <div className="crumbs">Projects</div>
        <SearchField aria-label="Search projects" className="search" value={text} onChange={setText}>
          <Search size={14} aria-hidden="true" />
          <Input className="search-input" placeholder="Search…" />
          <Button className="search-clear"><X size={14} aria-hidden="true" /></Button>
        </SearchField>
        <span className="grow" />
        <span className="muted">{sorted.length ? `1-${sorted.length} / ${sorted.length}` : ""}</span>
      </div>
      {projects.error && <p className="alert">{projects.error}</p>}
      {projects.loadState === "loading" && <p className="muted pad">Loading…</p>}
      {projects.loadState !== "loading" && sorted.length === 0 && (
        <p className="muted pad">No projects found. Projects you can see in Odoo show here.</p>
      )}
      <div className="projects">
        {sorted.map((p) => <ProjectCard key={p.id} project={p} canEdit={!!rights?.user} />)}
      </div>
    </>
  );
});

const ProjectCard = observer(({ project: p, canEdit }: { project: Project; canEdit: boolean }) => {
  const db = useDb();
  const navigate = useNavigate();
  const v = usePending(projectKey(p.id), { favorite: isFav(p.favorite_ids), status: p.last_update_status as string | null });
  const open = () => navigate(`/project/${p.id}/tasks`);
  const onKey = (e: ReactKeyboardEvent) => { if (e.key === "Enter" && e.target === e.currentTarget) open(); };
  const toggleFav = async () => {
    const out = await call<{ id: number }, { favorite: boolean }>(db.run.project_toggle_favorite, { id: Number(p.id) });
    if (!out.ok) toast(out.message); else setPending(projectKey(p.id), { favorite: out.value.favorite });
  };
  const setStatus = async (status: string) => {
    const out = await call(db.run.project_set_status, { id: Number(p.id), status });
    if (!out.ok) toast(out.message); else setPending(projectKey(p.id), { status });
  };
  const dates = dateRange(p.date_start, p.date);
  const showHours = p.allow_timesheets && (p.allocated_hours ?? 0) > 0;
  const showMilestones = p.allow_milestones && (p.milestone_count ?? 0) > 0;
  return (
    <article className="pcard" tabIndex={0} aria-label={p.name ?? undefined} onClick={open} onKeyDown={onKey}>
      <div className="phead">
        <FavoriteStar on={!!v.favorite} onToggle={() => void toggleFav()} />
        <span className="pname" title={p.name ?? undefined}>{p.name}</span>
      </div>
      {p.customer && <div className="pline"><User size={14} aria-label="Customer" />{p.customer}</div>}
      {dates.length > 0 && <div className="pline"><CalendarClock size={14} aria-label="Planned date" />{dates.join(" → ")}</div>}
      {p.alias_email && <div className="pline" title={p.alias_email}><Mail size={14} aria-label="Project email" />{p.alias_email}</div>}
      <div className="pline"><ListChecks size={14} aria-hidden="true" /><span className="link">{p.open_task_count ?? 0} {p.label_tasks}</span></div>
      {/* With Sales installed, Odoo's card shows the rating only on billable projects. */}
      {p.show_ratings && p.allow_billable && (p.rating_count ?? 0) > 0 && <div className="pline"><Mood value={p.rating_avg} /></div>}
      {showHours && (
        <div className="pline">
          <Timer size={14} aria-label="Remaining time" />
          {/* The project card is only red (over) or green, unlike the task card's orange. */}
          <span className={`hours ${(p.remaining_hours ?? 0) < 0 ? "over" : "ok"}`}>{formatHours(p.remaining_hours)}</span>
        </div>
      )}
      <ProjectTagPills tagIds={p.tag_ids} onCard />
      <div className="pfoot">
        <ActivityIcon state={p.activity_state} icon={p.activity_icon} summary={p.activity_summary} />
        {showMilestones && (
          <span className={`ms-flag${p.milestone_late ? " late" : p.milestone_doable ? " doable" : ""}`}
            title={`${p.milestone_reached} Milestones reached out of ${p.milestone_count}`}>
            <Flag size={14} aria-hidden="true" />{p.milestone_reached}/{p.milestone_count}
          </span>
        )}
        <span className="grow" />
        {p.manager && <span title={p.manager}><Avatar name={p.manager} large /><span className="sr-only">Project manager: {p.manager}</span></span>}
        <ProjectStatus value={v.status} onChange={canEdit ? (s) => void setStatus(s) : undefined} />
      </div>
    </article>
  );
});
