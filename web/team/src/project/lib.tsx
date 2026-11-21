import { observer, useCollection } from "@vantage-ui/client/react";
import { Frown, Meh, Smile } from "lucide-react";
import { ids, tagColor, tagText, useDb } from "../lib";

/** The pending-store key of a project task, and of a project (to-dos use their bare id). */
export const taskKey = (id: string | number) => `task:${id}`;
export const projectKey = (id: string | number) => `project:${id}`;

/** Hours as Odoo's timesheet widget writes them on cards: "25h", "-184h 30m", "0h 15m". */
export function formatHours(hours: number | null | undefined) {
  const h = hours ?? 0;
  const sign = h < 0 ? "-" : "";
  const minutes = Math.round(Math.abs(h) * 60);
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${sign}${whole}h ${String(rest).padStart(2, "0")}m` : `${sign}${whole}h`;
}

/** Remaining hours: red when over, orange under 20 % left, green otherwise (Odoo's colours). */
export function hoursTone(remaining: number | null | undefined, allocated: number | null | undefined) {
  const r = remaining ?? 0;
  if (r < 0) return "over";
  if ((allocated ?? 0) > 0 && r / (allocated ?? 1) < 0.2) return "near";
  return "ok";
}

/** A planned date range as on Odoo's project card: "Sep 17 → Nov 27" (the year when not this one). */
export function dateRange(start: string | null | undefined, end: string | null | undefined) {
  const fmt = (s: string) => {
    const d = new Date(`${s.slice(0, 10)}T00:00:00`);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
  };
  return [start, end].filter((x): x is string => !!x).map(fmt);
}

/** An average rating out of 5 with Odoo's smiley: happy from 3.66, neutral from 2.33. */
export function Mood({ value }: { value: number | null | undefined }) {
  const v = value ?? 0;
  const mood = v >= 3.66 ? "happy" : v >= 2.33 ? "neutral" : "unhappy";
  const Icon = mood === "happy" ? Smile : mood === "neutral" ? Meh : Frown;
  const text = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return (
    <span className={`mood ${mood}`} title={`Average rating: ${mood[0]!.toUpperCase()}${mood.slice(1)}`}>
      <Icon size={14} aria-hidden="true" /> {text}/5
    </span>
  );
}

/**
 * Project tags in Odoo's colours, from a "1,5" id list (project_tags, shared with To-do). On
 * kanban cards (`onCard`) a tag with no colour (0) is hidden, as Odoo's tag help says.
 */
export const ProjectTagPills = observer(({ tagIds, onCard }: { tagIds: string | null | undefined; onCard?: boolean }) => {
  const db = useDb();
  const { items } = useCollection(db.tags.sort("name", "asc"));
  const byId = new Map(items.map((t) => [t.id, t]));
  const wanted = ids(tagIds).filter((id) => !onCard || (byId.get(id)?.color ?? 1) !== 0);
  if (wanted.length === 0) return null;
  return (
    <span className="tags">
      {wanted.map((id) => {
        const t = byId.get(id);
        return <span key={id} className="tag" style={{ background: tagColor(t?.color), color: tagText(t?.color) }}>{t?.name ?? "…"}</span>;
      })}
    </span>
  );
});

const closed = (s: string | null | undefined) => s === "1_done" || s === "1_canceled";
export const isClosed = closed;

type Sortable = { priority?: string | null; sequence?: number | null; state?: string | null; date_deadline?: string | null; id: string };

/** Odoo's card order: priority (high first), sequence, state, deadline (soonest, none last), newest. */
export function cardOrder(a: Sortable, b: Sortable) {
  const p = Number(b.priority ?? 0) - Number(a.priority ?? 0);
  if (p) return p;
  const s = (a.sequence ?? 10) - (b.sequence ?? 10);
  if (s) return s;
  const st = (a.state ?? "").localeCompare(b.state ?? "");
  if (st) return st;
  if (a.date_deadline !== b.date_deadline) {
    if (!a.date_deadline) return 1;
    if (!b.date_deadline) return -1;
    return a.date_deadline < b.date_deadline ? -1 : 1;
  }
  return Number(b.id) - Number(a.id);
}
