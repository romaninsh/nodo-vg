import { useRef, useState } from "react";
import { Button, ListBox, ListBoxItem, Popover } from "react-aria-components";
import { Check, Grip } from "lucide-react";
import { APPS, type NodoApp } from "./apps";

/**
 * Odoo's app switcher: the grid button at the left of the top bar opens the list of apps; picking
 * one goes to its home. Apps still to come are listed, greyed out. Built from the Popover and
 * ListBox the priority picker already ships (links as items), not React Aria's Menu: that would
 * add 13 kB to the first page load.
 */
export function AppSwitcher({ current }: { current: NodoApp }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button ref={trigger} className="apps" aria-label="Apps" aria-haspopup="listbox" aria-expanded={open} onPress={() => setOpen(true)}>
        <Grip size={18} aria-hidden="true" />
      </Button>
      <Popover className="popover app-menu" aria-label="Apps" triggerRef={trigger} isOpen={open} onOpenChange={setOpen} placement="bottom start" offset={4}>
        <ListBox aria-label="Apps" className="menu" autoFocus="first" disabledKeys={APPS.filter((a) => !a.ready).map((a) => a.id)}
          onAction={() => setOpen(false)}>
          {APPS.map((app) => (
            <ListBoxItem key={app.id} id={app.id} textValue={app.name} className="menu-item app-item" href={app.ready ? app.home : undefined}>
              <span className="app-tile" style={{ background: app.colour }} aria-hidden="true"><app.icon size={18} /></span>
              <span>{app.name}</span>
              {!app.ready && <span className="soon">soon</span>}
              {app.id === current.id && <Check className="tick" size={14} aria-label="current app" />}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </>
  );
}
