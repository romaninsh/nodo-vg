import { ToggleButton } from "react-aria-components";
import { Hint } from "./Hint";

/** `info` (blue) and `done` (dark green) are Project's waiting and done tasks. */
export type Segment = { key: string; label: string; count: number; tone: "ok" | "warn" | "danger" | "none" | "info" | "done" };

/**
 * Odoo's kanban column bar: one coloured segment per group of cards (planned, today, overdue,
 * nothing scheduled), as wide as its share of the column. Pressing a segment shows only those
 * cards (`onSelect(key)`); pressing it again shows them all (`onSelect(null)`). Segments with
 * no cards aren't drawn; a column with no cards draws an empty grey bar.
 */
export function ColumnProgress({ segments, selected, onSelect, label }: {
  segments: Segment[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** Names the bar ("Activities in New"). */
  label: string;
}) {
  const total = segments.reduce((n, s) => n + s.count, 0);
  return (
    <div className="colbar" role="group" aria-label={label}>
      {total === 0 && <span className="colbar-empty" />}
      {segments.filter((s) => s.count > 0).map((s) => (
        <Hint key={s.key} text={`${s.count} ${s.label}`}>
          <ToggleButton className={`colbar-seg ${s.tone}`} style={{ flexGrow: s.count }} aria-label={`${s.count} ${s.label}`}
            isSelected={selected === s.key} onChange={(on) => onSelect(on ? s.key : null)}
            data-dim={selected !== null && selected !== s.key ? true : undefined} />
        </Hint>
      ))}
    </div>
  );
}
