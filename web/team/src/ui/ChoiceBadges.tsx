import { Label, Radio, RadioGroup } from "react-aria-components";

export type Choice = { id: string; name: string };

/**
 * Odoo's badge picker (a many2one shown as a row of badges, like the lost reasons): one badge
 * per choice, the picked one highlighted; picking it again clears it when `clearable`. Arrow
 * keys move between badges, as in any radio group.
 */
export function ChoiceBadges({ label, choices, value, onChange, clearable }: {
  label: string;
  choices: Choice[];
  value: string | null;
  onChange: (id: string | null) => void;
  clearable?: boolean;
}) {
  return (
    <RadioGroup className="badges" value={value ?? ""} orientation="horizontal"
      onChange={(v) => onChange(v === "" ? null : v)}>
      <Label className="sr-only">{label}</Label>
      {choices.map((c) => (
        <Radio key={c.id} value={c.id} className="badge-choice"
          onClick={() => { if (clearable && value === c.id) onChange(null); }}>
          {c.name}
        </Radio>
      ))}
    </RadioGroup>
  );
}
