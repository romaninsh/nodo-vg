import { useState } from "react";
import { useNavigate } from "react-router";
import { observer, useCollection } from "@vantage-ui/client/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Todos } from "../vantage.gen";
import { auth, isDone, rememberOrder, useDb } from "../lib";
import { ViewSwitcher } from "../components";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "YYYY-MM-DD" of a date in this computer's calendar. */
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Odoo's calendar view of to-dos: a month, each open to-do on its deadline's day (in your time
 * zone), Sunday first. Arrows move a month; Today comes back. A click opens the to-do.
 */
export const Calendar = observer(() => {
  const db = useDb();
  const navigate = useNavigate();
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  // Open to-dos with a deadline, as Odoo's calendar shows them under its Open filter.
  // `open_for` lists who still has a to-do open, as ",2,7,".
  const { items, error } = useCollection(db.todos.where({ open_for: { like: `,${auth.me()?.uid ?? 0},` } }).sort("date_deadline", "asc"));

  const byDay = new Map<string, Todos[]>();
  for (const t of items) {
    if (!t.date_deadline) continue;
    const key = dayKey(new Date(t.date_deadline));
    byDay.set(key, [...(byDay.get(key) ?? []), t]);
  }
  // Six weeks from the Sunday on or before the 1st, as Odoo's calendar lays out a month.
  const start = new Date(month);
  start.setDate(1 - month.getDay());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  rememberOrder(days.flatMap((d) => (byDay.get(dayKey(d)) ?? []).map((t) => String(t.id))));
  const step = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const title = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <>
      <div className="cp">
        <div className="crumbs">My to-dos</div>
        <button className="btn icon" aria-label="Previous month" onClick={() => step(-1)}><ChevronLeft size={14} aria-hidden="true" /></button>
        <button className="btn" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button>
        <button className="btn icon" aria-label="Next month" onClick={() => step(1)}><ChevronRight size={14} aria-hidden="true" /></button>
        <h2 className="month-title" aria-live="polite">{title}</h2>
        <div className="grow" />
        <ViewSwitcher current="calendar" />
      </div>
      {error && <p className="alert">{error}</p>}
      <div className="month" role="grid" aria-label={title}>
        <div className="month-row month-head" role="row">
          {WEEKDAYS.map((w) => <div key={w} role="columnheader" className="month-weekday">{w}</div>)}
        </div>
        {Array.from({ length: 6 }, (_, w) => (
          <div key={w} className="month-row" role="row">
            {days.slice(w * 7, w * 7 + 7).map((d) => {
              const key = dayKey(d);
              const todos = byDay.get(key) ?? [];
              const other = d.getMonth() !== month.getMonth();
              return (
                <div key={key} role="gridcell" aria-label={`${d.toLocaleDateString(undefined, { day: "numeric", month: "long" })}, ${todos.length} to-dos`}
                  className={`month-day${other ? " other" : ""}${key === dayKey(today) ? " today" : ""}`}>
                  <span className="month-date">{d.getDate()}</span>
                  {todos.map((t) => (
                    <button key={t.id} className={`month-todo${isDone(t.state) ? " done" : ""}${t.due === "overdue" ? " overdue" : ""}`}
                      title={t.name ?? ""} onClick={() => navigate(`/todo/${t.id}`)}>
                      {new Date(t.date_deadline!).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} {t.name}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
});
