import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button, ComboBox, Input, ListBox, ListBoxItem, Popover, Tag, TagGroup, TagList } from "react-aria-components";
import { ChevronDown, X } from "lucide-react";

export type PickerOption = { id: string; name: string };

/**
 * A many-to-many field the way Odoo shows one: the chosen records as removable chips, then a
 * search box that offers the rest. Chips are a React Aria TagGroup (arrow keys, Delete or
 * Backspace remove one), the box a ComboBox (type to filter, Enter or a click adds).
 */
export function MultiPicker({ labelId, addLabel, placeholder, options, selected, onChange, chip, chipStyle, removable, disabled }: {
  /** The id of the field's visible label. */
  labelId: string;
  /** The search box's accessible name ("Assign someone"). */
  addLabel: string;
  placeholder: string;
  options: PickerOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** What a chip shows; the name by default. */
  chip?: (o: PickerOption) => ReactNode;
  chipStyle?: (o: PickerOption) => CSSProperties | undefined;
  /** Whether a chip can be removed; all can by default. */
  removable?: (id: string) => boolean;
  disabled?: boolean;
}) {
  // After a pick the box starts over, empty, with the focus still in it and the rest of the
  // options open for the next pick (Esc closes them): a fresh ComboBox, keyed by the number
  // of picks.
  const [round, setRound] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (refocus.current) {
      refocus.current = false;
      input.current?.focus();
    }
  }, [round]);
  const byId = new Map(options.map((o) => [o.id, o]));
  const chosen = selected.map((id) => byId.get(id) ?? { id, name: "…" });
  const available = options.filter((o) => !selected.includes(o.id));
  const canRemove = (id: string) => !disabled && (removable?.(id) ?? true);

  return (
    <span className="picker">
      <TagGroup aria-labelledby={labelId} className="chips-group"
        onRemove={(keys) => {
          const gone = new Set([...keys].map(String).filter(canRemove));
          if (gone.size) onChange(selected.filter((id) => !gone.has(id)));
        }}>
        <TagList className="chiplist" items={chosen}>
          {(o) => (
            <Tag id={o.id} textValue={o.name} className="chip-tag" style={chipStyle?.(o)}>
              {chip ? chip(o) : o.name}
              {canRemove(o.id) && <Button slot="remove" className="chip-remove"><X size={12} aria-hidden="true" /></Button>}
            </Tag>
          )}
        </TagList>
      </TagGroup>
      <ComboBox key={round} aria-label={addLabel} className="combo" isDisabled={disabled} menuTrigger="focus" allowsEmptyCollection
        defaultItems={available} selectedKey={null}
        onSelectionChange={(k) => {
          if (k == null) return;
          onChange([...selected, String(k)]);
          refocus.current = true;
          setRound((r) => r + 1);
        }}>
        <span className="combo-field">
          <Input ref={input} className="combo-input" placeholder={placeholder} />
          <Button className="combo-btn"><ChevronDown size={14} aria-hidden="true" /></Button>
        </span>
        <Popover className="popover" placement="bottom start" offset={2}>
          <ListBox className="menu" renderEmptyState={() => <div className="menu-empty">Nothing to add</div>}>
            {(o: PickerOption) => <ListBoxItem id={o.id} textValue={o.name} className="menu-item">{o.name}</ListBoxItem>}
          </ListBox>
        </Popover>
      </ComboBox>
    </span>
  );
}
