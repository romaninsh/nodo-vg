import { useRef, useState, type RefObject, type SyntheticEvent } from "react";
import { Dialog, ListBox, ListBoxItem, Popover } from "react-aria-components";
import { Check } from "lucide-react";
import { TAG_COLORS, TAG_COLOR_NAMES, tagColor, tagText } from "./tagColors";

// The popover is portalled, but React still bubbles its events through this component; the
// card underneath must not open, start a drag or see the keys.
const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * Odoo's tag colour picker: the twelve tag colours as swatches beside `anchor`, the current one
 * ticked; picking one calls `onChange` with its index. On its own so a field whose chips are
 * a collection (a many2many TagGroup) can open it from outside the chip.
 */
export function TagColorPopover({ anchor, open, onOpenChange, name, color, onChange }: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  color: number;
  onChange: (color: number) => void;
}) {
  return (
    <Popover className="popover" triggerRef={anchor} isOpen={open} onOpenChange={onOpenChange} placement="bottom start" offset={4}>
      <Dialog className="swatch-dialog" aria-label={`Colour of ${name}`}>
        <ListBox aria-label={`Colour of ${name}`} className="swatches" layout="grid" selectionMode="single"
          selectedKeys={[String(color)]} autoFocus
          onSelectionChange={(keys) => {
            const k = [...keys][0];
            if (k != null && Number(k) !== color) onChange(Number(k));
            onOpenChange(false);
          }}>
          {TAG_COLORS.map((c, i) => (
            <ListBoxItem key={c} id={String(i)} textValue={TAG_COLOR_NAMES[i]} aria-label={TAG_COLOR_NAMES[i]} className="swatch"
              style={{ background: c, color: tagText(i) }}>
              {({ isSelected }) => (isSelected ? <Check size={14} aria-hidden="true" /> : null)}
            </ListBoxItem>
          ))}
        </ListBox>
      </Dialog>
    </Popover>
  );
}

/** A tag pill that opens the colour picker when clicked (a CRM card's tags). */
export function TagColorPicker({ name, color, onChange, disabled }: {
  name: string;
  color: number;
  onChange: (color: number) => void;
  disabled?: boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <span className="tagpick" onClick={stop} onPointerDown={stop} onMouseDown={stop} onTouchStart={stop}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }}>
      <button ref={trigger} type="button" className="tag tag-btn" disabled={disabled} aria-haspopup="dialog" aria-expanded={open}
        aria-label={`${name}: change its colour`} style={{ background: tagColor(color), color: tagText(color) }}
        onClick={() => setOpen(true)}>
        {name}
      </button>
      <TagColorPopover anchor={trigger} open={open} onOpenChange={setOpen} name={name} color={color} onChange={onChange} />
    </span>
  );
}
