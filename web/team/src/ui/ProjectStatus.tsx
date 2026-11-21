import type { SyntheticEvent } from "react";
import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";
import { Check } from "lucide-react";
import { Hint } from "./Hint";

/** Odoo's project status (the last status update), as stored in last_update_status. */
export type ProjectStatusValue = "on_track" | "at_risk" | "off_track" | "on_hold" | "done" | "to_define";

export const PROJECT_STATUSES: { id: Exclude<ProjectStatusValue, "to_define">; label: string }[] = [
  { id: "on_track", label: "On Track" },
  { id: "at_risk", label: "At Risk" },
  { id: "off_track", label: "Off Track" },
  { id: "on_hold", label: "On Hold" },
  { id: "done", label: "Complete" },
];
export const projectStatusLabel = (v: string | null | undefined) =>
  PROJECT_STATUSES.find((s) => s.id === v)?.label ?? "Set Status";

const stop = (e: SyntheticEvent) => e.stopPropagation();

export function StatusDot({ value, size = 18 }: { value: string | null | undefined; size?: number }) {
  return <span className={`pstatus ${value ?? "to_define"}`} style={{ width: size, height: size }} aria-hidden="true" />;
}

/**
 * A project's status as Odoo's coloured dot (green on track, orange at risk, red off track, blue
 * on hold, purple complete, an empty ring before any status). A click, Enter, Space or an arrow
 * key opens the five statuses; picking one calls `onChange` (Odoo then writes a status update).
 * Without `onChange` the dot only shows the status.
 */
export function ProjectStatus({ value, onChange, disabled, size = 18 }: {
  value: string | null | undefined;
  onChange?: (status: Exclude<ProjectStatusValue, "to_define">) => void;
  disabled?: boolean;
  size?: number;
}) {
  const current = value ?? "to_define";
  const label = `Status: ${projectStatusLabel(current)}`;
  if (!onChange) return <span role="img" aria-label={label} title={label}><StatusDot value={current} size={size} /></span>;
  return (
    <span className="pstatus-wrap" onClick={stop} onPointerDown={stop} onMouseDown={stop} onTouchStart={stop} onKeyDown={stop}>
      <Select aria-label="Status" className="pstatus-select" isDisabled={disabled} selectedKey={current === "to_define" ? null : current}
        onSelectionChange={(k) => { if (k != null && String(k) !== current) onChange(String(k) as Exclude<ProjectStatusValue, "to_define">); }}>
        <Hint text={label}>
          <Button className="pstatus-btn">
            <StatusDot value={current} size={size} />
            <SelectValue className="sr-only">{() => projectStatusLabel(current)}</SelectValue>
          </Button>
        </Hint>
        <Popover className="popover" placement="bottom end" offset={4}>
          <ListBox className="menu" items={PROJECT_STATUSES}>
            {(s) => (
              <ListBoxItem id={s.id} textValue={s.label} className="menu-item">
                {({ isSelected }) => (
                  <>
                    <StatusDot value={s.id} size={14} />
                    <span>{s.label}</span>
                    {isSelected && <Check className="tick" size={14} aria-hidden="true" />}
                  </>
                )}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </Select>
    </span>
  );
}
