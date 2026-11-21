import { useEffect, useId, useRef, useState } from "react";
import { observer, useCollection } from "@vantage-ui/client/react";
import { avatarColor, ids, initials, tagColor, tagText, useDb } from "./lib";

/** Tag pills in Odoo's colours, from a "1,5" id list. */
export const TagPills = observer(({ tagIds, onRemove }: { tagIds: string | null | undefined; onRemove?: (id: string) => void }) => {
  const db = useDb();
  const { items } = useCollection(db.tags.sort("name", "asc"));
  const wanted = ids(tagIds);
  if (wanted.length === 0) return null;
  const byId = new Map(items.map((t) => [t.id, t]));
  return (
    <span className="tags">
      {wanted.map((id) => {
        const t = byId.get(id);
        return (
          <span key={id} className="tag" style={{ background: tagColor(t?.color), color: tagText(t?.color) }}>
            {t?.name ?? "…"}
            {onRemove && <button aria-label={`Remove ${t?.name ?? "tag"}`} onClick={() => onRemove(id)}>×</button>}
          </span>
        );
      })}
    </span>
  );
});

/** Overlapping initials for the people a to-do is assigned to ("Marc Demo, Mitchell Admin"). */
export function Avatars({ names }: { names: string | null | undefined }) {
  const list = (names ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <span className="avatars" title={list.join(", ")}>
      {list.map((n) => (
        <span key={n} className="avatar" style={{ background: avatarColor(n) }}>{initials(n)}</span>
      ))}
    </span>
  );
}

// ---- priority and done, Odoo's priority and todo_done_checkmark widgets ----

/** Odoo's four priority levels, stored as "0".."3". */
export const PRIORITY_LABELS = ["Low", "Medium", "High", "Urgent"] as const;
export type Level = "0" | "1" | "2" | "3";
const levelOf = (v: string | null | undefined) => Math.min(3, Math.max(0, Number(v ?? "0") || 0));

const STAR = "M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z";

/** One star per level: Low an outline, Medium half yellow, High full yellow, Urgent red with "!". */
export function PriorityStar({ level, size = 18 }: { level: number; size?: number }) {
  const clip = useId().replace(/:/g, "");
  return (
    <svg className={`prio-star l${level}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {level === 1 && (
        <>
          <clipPath id={clip}><rect x="0" y="0" width="12" height="24" /></clipPath>
          <path d={STAR} fill="#f3cc00" clipPath={`url(#${clip})`} />
        </>
      )}
      <path d={STAR} fill={level === 2 ? "#f3cc00" : level === 3 ? "#e5484d" : "none"}
        stroke={level === 0 ? "#9ca3af" : level === 3 ? "#c9302c" : "#d4a900"} strokeWidth="1.5" strokeLinejoin="round" />
      {level === 3 && (
        <>
          <rect x="10.7" y="7.4" width="2.6" height="5.8" rx="1.3" fill="#fff" />
          <circle cx="12" cy="15.5" r="1.35" fill="#fff" />
        </>
      )}
    </svg>
  );
}

/**
 * A to-do's priority, Odoo's four levels as one star. A click (or Enter/Space) opens a small
 * list of the levels; picking one calls `onChange`, Esc or a click outside closes it unchanged.
 * Clicks and drags stay inside, so a card or row under it doesn't open or move.
 */
export function Priority({ value, onChange, size = 18, disabled }: {
  value: string | null | undefined;
  onChange: (level: Level) => void;
  size?: number;
  disabled?: boolean;
}) {
  const level = levelOf(value);
  const name = PRIORITY_LABELS[level];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(level);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const wrap = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const show = () => {
    const r = trigger.current!.getBoundingClientRect();
    // Fixed, so the board's scrolling columns don't clip it; above the star near the bottom.
    const below = r.bottom + 160 < window.innerHeight;
    setPos(below ? { left: r.left, top: r.bottom + 4 } : { left: r.left, bottom: window.innerHeight - r.top + 4 });
    setActive(level);
    setOpen(true);
  };
  const pick = (n: number) => {
    close(true);
    if (n !== level) onChange(String(n) as Level);
  };

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const outside = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const away = () => setOpen(false);
    document.addEventListener("mousedown", outside, true);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("mousedown", outside, true);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(3, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(3); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(active); }
    else if (e.key === "Escape") { e.preventDefault(); close(true); }
    else if (e.key === "Tab") setOpen(false);
  };

  const title = `Priority: ${name}. Click to change.`;
  return (
    <span ref={wrap} className="prio" draggable={false}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <button ref={trigger} type="button" className="prio-btn" title={title} aria-label={title} disabled={disabled} draggable={false}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); show(); }
        }}>
        <PriorityStar level={level} size={size} />
      </button>
      {open && (
        <ul ref={list} id={listId} className="prio-menu" role="listbox" tabIndex={-1} aria-label="Priority"
          aria-activedescendant={`${listId}-${active}`} style={pos} onKeyDown={onListKey}>
          {PRIORITY_LABELS.map((label, n) => (
            <li key={label} id={`${listId}-${n}`} role="option" aria-selected={n === level}
              className={`${n === active ? "active" : ""}${n === level ? " current" : ""}`}
              onMouseEnter={() => setActive(n)} onClick={() => pick(n)}>
              <PriorityStar level={n} size={16} />
              <span>{label}</span>
              {n === level && <span className="tick" aria-hidden="true">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

/** Odoo's done checkmark: a circle, ticked and green when the to-do is done; a click toggles. */
export function DoneCheck({ done, onToggle, disabled }: { done: boolean; onToggle: () => void; disabled?: boolean }) {
  const title = done ? "Done. Click to open it again." : "Mark as done";
  return (
    <button type="button" role="checkbox" aria-checked={done} className={`donecheck${done ? " on" : ""}`} title={title} aria-label={title}
      disabled={disabled} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
      ✓
    </button>
  );
}

// ---- a small toast, shared by every page ----
let push: ((text: string) => void) | null = null;
export const toast = (text: string) => push?.(text);

export function Toaster() {
  const [text, setText] = useState("");
  useEffect(() => {
    push = (t) => setText(t);
    return () => { push = null; };
  }, []);
  useEffect(() => {
    if (!text) return;
    const h = setTimeout(() => setText(""), 3500);
    return () => clearTimeout(h);
  }, [text]);
  return text ? <div className="toast" role="status">{text}</div> : null;
}
