import { useEffect, useState } from "react";
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
