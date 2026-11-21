import { useEffect, useState, type ReactNode } from "react";
import { Button, ComboBox, Input, ListBox, ListBoxItem, Popover } from "react-aria-components";
import { ChevronDown, X } from "lucide-react";
import type { PickerOption } from "./MultiPicker";

/**
 * A many-to-one field the way Odoo shows one: an underlined search box holding the chosen
 * record's name; typing filters the options, Enter or a click picks one, and the clear button
 * empties it (when `clearable`). Behaviour from React Aria's ComboBox. `before` draws in front
 * of the box (an avatar for a person).
 */
export function OnePicker({ labelId, options, selected, onChange, placeholder, clearable, disabled, before }: {
  labelId: string;
  options: PickerOption[];
  selected: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  before?: (o: PickerOption) => ReactNode;
}) {
  const chosen = options.find((o) => o.id === selected) ?? null;
  const [text, setText] = useState(chosen?.name ?? "");
  // A pick made elsewhere (another tab, Odoo) shows its name, unless the box is being typed in.
  const [typing, setTyping] = useState(false);
  useEffect(() => { if (!typing) setText(chosen?.name ?? ""); }, [chosen?.name, typing]);
  return (
    <span className="onepicker">
      {chosen && before?.(chosen)}
      <ComboBox aria-labelledby={labelId} className="combo" isDisabled={disabled} menuTrigger="focus" allowsEmptyCollection
        items={typing && text ? options.filter((o) => o.name.toLowerCase().includes(text.toLowerCase())) : options}
        selectedKey={selected} inputValue={text}
        onInputChange={(t) => { setTyping(true); setText(t); }}
        onBlur={() => { setTyping(false); setText(chosen?.name ?? ""); }}
        onSelectionChange={(k) => {
          setTyping(false);
          if (k != null && String(k) !== selected) onChange(String(k));
          const o = options.find((x) => x.id === String(k));
          setText(o?.name ?? chosen?.name ?? "");
        }}>
        <span className="combo-field">
          <Input className="combo-input" placeholder={placeholder} />
          <Button className="combo-btn"><ChevronDown size={14} aria-hidden="true" /></Button>
        </span>
        <Popover className="popover" placement="bottom start" offset={2}>
          <ListBox className="menu" renderEmptyState={() => <div className="menu-empty">Nothing found</div>}>
            {(o: PickerOption) => <ListBoxItem id={o.id} textValue={o.name} className="menu-item">{o.name}</ListBoxItem>}
          </ListBox>
        </Popover>
      </ComboBox>
      {clearable && chosen && !disabled && (
        <Button className="combo-btn" aria-label="Clear" onPress={() => { setText(""); onChange(null); }}><X size={14} aria-hidden="true" /></Button>
      )}
    </span>
  );
}
