import { ToggleButton } from "react-aria-components";
import { Check } from "lucide-react";
import { Hint } from "./Hint";

/**
 * Odoo's done checkmark: a circle, ticked and green when the to-do is done; pressing it toggles.
 * Its name stays "Done"; aria-pressed says whether it is.
 */
export function DoneCheck({ done, onToggle, disabled }: { done: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <Hint text={done ? "Done. Click to open it again." : "Mark as done"}>
      <ToggleButton className="donecheck" aria-label="Done" isSelected={done} isDisabled={disabled} onChange={onToggle}>
        <Check size={12} strokeWidth={3} aria-hidden="true" />
      </ToggleButton>
    </Hint>
  );
}
