import { Link } from "react-router";
import { observer, useCollection } from "@vantage-ui/client/react";
import { LayoutGrid, List } from "lucide-react";
import { ids, tagColor, tagText, useDb } from "./lib";

/** The Board / List toggle at the right of the control panel. */
export function ViewSwitcher({ current }: { current: "board" | "list" }) {
  return (
    <nav className="switcher" aria-label="View">
      <Link to="/" className={current === "board" ? "active" : ""} aria-current={current === "board" ? "page" : undefined}>
        <LayoutGrid size={14} aria-hidden="true" /> Board
      </Link>
      <Link to="/list" className={current === "list" ? "active" : ""} aria-current={current === "list" ? "page" : undefined}>
        <List size={14} aria-hidden="true" /> List
      </Link>
    </nav>
  );
}

/** Tag pills in Odoo's colours, from a "1,5" id list. */
export const TagPills = observer(({ tagIds }: { tagIds: string | null | undefined }) => {
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
          </span>
        );
      })}
    </span>
  );
});
