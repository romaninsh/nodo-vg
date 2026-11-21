import { useId, type SyntheticEvent } from "react";
import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";
import { Check } from "lucide-react";
import { Hint } from "./Hint";

/** Odoo's four priority levels, stored as "0".."3" (To-do's names). */
export const PRIORITY_LABELS = ["Low", "Medium", "High", "Urgent"] as const;
/** CRM stores the same four levels and names the top one "Very High" (Odoo shows three stars). */
export const CRM_PRIORITY_LABELS = ["Low", "Medium", "High", "Very High"] as const;
type Labels = readonly [string, string, string, string];
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

// The popover is portalled, but React still bubbles its events through this component; the
// card or row underneath must not open, start a drag or see the keys.
const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * A record's priority as one star. A click, Enter, Space or an arrow key opens the four levels;
 * picking one calls `onChange`. Focus, keyboard, Esc and clicks outside come from React Aria's
 * Select. `labels` names the levels (To-do's by default, `CRM_PRIORITY_LABELS` for CRM).
 */
export function Priority({ value, onChange, size = 18, disabled, labels = PRIORITY_LABELS }: {
  value: string | null | undefined;
  onChange: (level: Level) => void;
  size?: number;
  disabled?: boolean;
  labels?: Labels;
}) {
  const level = levelOf(value);
  return (
    <span className="prio" onClick={stop} onPointerDown={stop} onMouseDown={stop} onTouchStart={stop} onKeyDown={stop}>
      <Select aria-label="Priority" className="prio-select" isDisabled={disabled} selectedKey={String(level)}
        onSelectionChange={(k) => { if (k != null && String(k) !== String(level)) onChange(String(k) as Level); }}>
        <Hint text={`Priority: ${labels[level]}`}>
          <Button className="prio-btn">
            <PriorityStar level={level} size={size} />
            <SelectValue className="sr-only" />
          </Button>
        </Hint>
        <Popover className="popover" placement="bottom start" offset={4}>
          <ListBox className="menu">
            {labels.map((label, n) => (
              <ListBoxItem key={label} id={String(n)} textValue={label} className="menu-item">
                {({ isSelected }) => (
                  <>
                    <PriorityStar level={n} size={16} />
                    <span>{label}</span>
                    {isSelected && <Check className="tick" size={14} aria-hidden="true" />}
                  </>
                )}
              </ListBoxItem>
            ))}
          </ListBox>
        </Popover>
      </Select>
    </span>
  );
}
