import type { SyntheticEvent } from "react";
import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";
import { Check, CircleCheck, CircleX, Hourglass, TriangleAlert } from "lucide-react";
import { Hint } from "./Hint";

/** Odoo's task states, as stored in project_task.state. */
export type TaskStateValue = "01_in_progress" | "02_changes_requested" | "03_approved" | "04_waiting_normal" | "1_done" | "1_canceled";

export const TASK_STATES: { id: TaskStateValue; label: string }[] = [
  { id: "01_in_progress", label: "In Progress" },
  { id: "02_changes_requested", label: "Changes Requested" },
  { id: "03_approved", label: "Approved" },
  { id: "1_canceled", label: "Cancelled" },
  { id: "1_done", label: "Done" },
];
const WAITING = { id: "04_waiting_normal" as const, label: "Waiting" };
export const taskStateLabel = (v: string | null | undefined) =>
  [...TASK_STATES, WAITING].find((s) => s.id === v)?.label ?? "In Progress";

const stop = (e: SyntheticEvent) => e.stopPropagation();

/** The state's bubble: grey ring, orange warning, green dot, blue hourglass, green tick, red cross. */
export function TaskStateIcon({ value, size = 18 }: { value: string | null | undefined; size?: number }) {
  const kind: Record<string, string> = {
    "02_changes_requested": "changes", "03_approved": "approved", "04_waiting_normal": "waiting", "1_done": "done", "1_canceled": "canceled",
  };
  const cls = `tstate ${kind[value ?? ""] ?? "progress"}`;
  switch (value) {
    case "02_changes_requested": return <TriangleAlert className={cls} size={size} aria-hidden="true" />;
    case "03_approved": return <span className={cls} style={{ width: size, height: size }} aria-hidden="true"><Check size={size - 6} strokeWidth={3} /></span>;
    case "04_waiting_normal": return <Hourglass className={cls} size={size} aria-hidden="true" />;
    case "1_done": return <CircleCheck className={cls} size={size} aria-hidden="true" />;
    case "1_canceled": return <CircleX className={cls} size={size} aria-hidden="true" />;
    default: return <span className={cls} style={{ width: size, height: size }} aria-hidden="true" />;
  }
}

/**
 * A task's state as Odoo's kanban bubble: a click, Enter, Space or an arrow key opens In
 * Progress, Changes Requested, Approved, Cancelled and Done; picking one calls `onChange`.
 * Waiting is Odoo's to set (a blocking task is open): on a card a waiting task shows a plain
 * hourglass with no menu, as Odoo's card does; on the form (`waitingMenu`) it offers only
 * Cancelled and Done, as Odoo's form does.
 */
export function TaskState({ value, onChange, disabled, size = 18, waitingMenu }: {
  value: string | null | undefined;
  onChange: (state: TaskStateValue) => void;
  disabled?: boolean;
  size?: number;
  waitingMenu?: boolean;
}) {
  const current = value ?? "01_in_progress";
  const waiting = current === WAITING.id;
  if (waiting && !waitingMenu) {
    return (
      <span className="tstate-wrap" role="img" aria-label="State: Waiting" title="Waiting: a task this one is blocked by is still open">
        <TaskStateIcon value={current} size={size} />
      </span>
    );
  }
  const items = waiting ? [WAITING, ...TASK_STATES.filter((s) => s.id === "1_canceled" || s.id === "1_done")] : TASK_STATES;
  return (
    <span className="tstate-wrap" onClick={stop} onPointerDown={stop} onMouseDown={stop} onTouchStart={stop} onKeyDown={stop}>
      <Select aria-label="State" className="tstate-select" isDisabled={disabled} selectedKey={current} disabledKeys={[WAITING.id]}
        onSelectionChange={(k) => { if (k != null && String(k) !== current) onChange(String(k) as TaskStateValue); }}>
        <Hint text={`State: ${taskStateLabel(current)}`}>
          <Button className="tstate-btn">
            <TaskStateIcon value={current} size={size} />
            <SelectValue className="sr-only">{() => taskStateLabel(current)}</SelectValue>
          </Button>
        </Hint>
        <Popover className="popover" placement="bottom end" offset={4}>
          <ListBox className="menu" items={items}>
            {(s) => (
              <ListBoxItem id={s.id} textValue={s.label} className="menu-item">
                {({ isSelected }) => (
                  <>
                    <TaskStateIcon value={s.id} size={16} />
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
