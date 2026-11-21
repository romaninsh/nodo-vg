import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from "react-aria-components";
import { ChevronRight } from "lucide-react";

export type Stage = { id: string; name: string; folded?: boolean };

/**
 * Odoo's status bar: the stages as arrows, the current one highlighted; a click on another
 * calls `onSelect`. Folded stages are greyed (still clickable). `badge` is drawn as a red pill
 * on the current stage (CRM's "8d" when an opportunity is rotting there). `label` names the bar
 * for screen readers ("Stage"); the current stage is marked aria-current="step".
 *
 * On a phone the arrows don't fit: the bar is then the current stage alone, "> Proposition",
 * opening the list of stages, as Odoo's phone layout does (the CSS picks which one shows).
 */
export function StageBar({ stages, current, onSelect, disabled, label, badge }: {
  stages: Stage[];
  current: string;
  onSelect: (stage: Stage) => void;
  disabled?: boolean;
  label: string;
  badge?: string | null;
}) {
  const here = stages.find((s) => s.id === current);
  return (
    <>
      <nav className="stagebar" aria-label={label}>
        {stages.map((s) => (
          <button key={s.id} type="button" className={`${s.id === current ? "on" : ""}${s.folded ? " folded" : ""}`}
            aria-current={s.id === current ? "step" : undefined} disabled={disabled}
            title={s.id === current ? `In ${s.name}` : `Move to ${s.name}`}
            onClick={() => { if (s.id !== current) onSelect(s); }}>
            {s.name}
            {s.id === current && badge && <span className="stage-badge">{badge}</span>}
          </button>
        ))}
      </nav>
      <Select aria-label={label} className="stagebar-compact" isDisabled={disabled} selectedKey={current || null}
        onSelectionChange={(k) => { const s = stages.find((x) => x.id === String(k)); if (s && s.id !== current) onSelect(s); }}>
        <Button className="btn stage-compact-btn">
          <ChevronRight size={14} aria-hidden="true" />
          <SelectValue>{() => here?.name ?? ""}</SelectValue>
          {badge && <span className="stage-badge">{badge}</span>}
        </Button>
        <Popover className="popover" placement="bottom end" offset={4}>
          <ListBox className="menu" items={stages}>
            {(s) => <ListBoxItem id={s.id} textValue={s.name} className="menu-item">{s.name}</ListBoxItem>}
          </ListBox>
        </Popover>
      </Select>
    </>
  );
}
