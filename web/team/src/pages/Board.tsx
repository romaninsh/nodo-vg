import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type SyntheticEvent } from "react";
import { useNavigate } from "react-router";
import { observer, useCollection } from "@vantage-ui/client/react";
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor,
  useSensors, type Announcements, type CollisionDetection, type DragEndEvent, type KeyboardCoordinateGetter, type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  Button, Dialog, DialogTrigger, Form, Heading, Input, Menu, MenuItem, MenuTrigger, Modal, ModalOverlay, Popover, SearchField, TextField, ToggleButton,
  ToggleButtonGroup,
} from "react-aria-components";
import { AlarmClock, Check, Clock, MoreHorizontal, Plus, Search, X } from "lucide-react";
import type { Cards, Stages } from "../vantage.gen";
import { call, deadlineLabel, fullDate, isDone, rememberOrder, TAG_COLOR_COUNT, tagColor, useDb } from "../lib";
import { pendingValue, setPending, usePending, usePendingStore } from "../pending";
import { TagPills, ViewSwitcher } from "../components";
import { Avatars, DoneCheck, Priority, PriorityStar, toast, type Level } from "../ui";

// ---- drag and drop (dnd-kit) ----

// A press on a control inside a card (priority, done, a link) or in a popover portalled out of
// it is not the start of a drag.
const isCardPress = (e: SyntheticEvent) => {
  const target = e.target as Element;
  return (e.currentTarget as Element).contains(target) && !target.closest("button, a, input, textarea, [role=option]");
};

class CardMouseSensor extends MouseSensor {
  static activators = [{
    eventName: "onMouseDown" as const,
    handler: (e: React.MouseEvent) => e.nativeEvent.button === 0 && isCardPress(e),
  }];
}

class CardTouchSensor extends TouchSensor {
  static activators = [{
    eventName: "onTouchStart" as const,
    handler: (e: React.TouchEvent) => e.nativeEvent.touches.length <= 1 && isCardPress(e),
  }];
}

const centreX = (r: { left: number; width: number }) => r.left + r.width / 2;

/**
 * The mouse drops on the column under the pointer, or under it lower down (a short column
 * still takes a drop below its last card). The keyboard drops on the column nearest the card
 * left to right.
 */
const columnUnder: CollisionDetection = (args) => {
  const p = args.pointerCoordinates;
  if (p) {
    const hits = pointerWithin(args);
    if (hits.length) return hits;
    const below = args.droppableContainers.find((c) => {
      const r = args.droppableRects.get(c.id);
      return r && p.x >= r.left && p.x <= r.right && p.y >= r.top;
    });
    return below ? [{ id: below.id, data: { droppableContainer: below, value: 0 } }] : [];
  }
  let best: { c: (typeof args.droppableContainers)[number]; d: number } | null = null;
  for (const c of args.droppableContainers) {
    const r = args.droppableRects.get(c.id);
    if (!r) continue;
    const d = Math.abs(centreX(r) - centreX(args.collisionRect));
    if (!best || d < best.d) best = { c, d };
  }
  return best ? [{ id: best.c.id, data: { droppableContainer: best.c, value: best.d } }] : [];
};

/** Left and right arrows move a picked-up card one column; up and down do nothing. */
const columnKeys: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const step = event.code === "ArrowRight" ? 1 : event.code === "ArrowLeft" ? -1 : 0;
  if (!step) return undefined;
  event.preventDefault();
  const { collisionRect, droppableRects, droppableContainers } = context;
  if (!collisionRect) return undefined;
  const cols = droppableContainers.getEnabled()
    .map((c) => droppableRects.get(c.id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort((a, b) => a.left - b.left);
  const here = centreX(collisionRect);
  let at = 0;
  cols.forEach((r, i) => { if (Math.abs(centreX(r) - here) < Math.abs(centreX(cols[at]!) - here)) at = i; });
  const next = cols[at + step];
  if (!next) return currentCoordinates;
  return { x: centreX(next) - collisionRect.width / 2, y: currentCoordinates.y };
};

const INSTRUCTIONS =
  "Press Enter to open this to-do. To move it to another column, press Space, choose the column with the left and right arrow keys, then press Space to drop it or Escape to cancel.";

// A click that ends a drag is not a click on the card.
let lastDrop = 0;

/** My to-dos as a board: one column per personal stage (Inbox, Today, …), like Odoo's To-do. */
export const Board = observer(() => {
  const db = useDb();
  const stages = useCollection(db.stages.sort("sequence", "asc"));
  // All my cards in one query, grouped into columns here: a query per column multiplied by
  // columns and open tabs.
  const cards = useCollection(db.cards.all);
  const pending = usePendingStore();
  // Odoo's board opens with its "Open" filter: done and cancelled to-dos stay out until asked.
  const [show, setShow] = useState<"open" | "all">("open");
  const [text, setText] = useState("");
  // Each press of New opens the first column's quick add.
  const [asked, setAsked] = useState(0);
  // To-dos seen open during this visit, which stay on the board when they're closed.
  const seenOpen = useRef(new Set<string>());
  const [dragging, setDragging] = useState<UniqueIdentifier | null>(null);
  const sensors = useSensors(
    useSensor(CardMouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(CardTouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: columnKeys,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );
  // Odoo gives a person its seven default columns on their first visit; so does the board.
  const noColumns = stages.loadState !== "loading" && !stages.error && stages.items.length === 0;
  useEffect(() => {
    if (!noColumns) return;
    void call(db.run.stage_defaults, {}).then((out) => { if (!out.ok) toast(out.message); });
  }, [noColumns, db]);
  if (stages.error) return <p className="alert">{stages.error}</p>;

  const first = stages.items[0]?.id;
  // A card just dropped shows in its new column at once; the server's copy catches up later.
  const stageOf = (c: Cards) => pendingValue(pending, c.task_id, "stage_id") ?? String(c.stage_id ?? "");
  const needle = text.trim().toLowerCase();
  const shown = cards.items.filter((c) => {
    const state = pendingValue(pending, c.task_id, "state") ?? c["task.state"];
    const closed = state === "1_done" || state === "1_canceled";
    // Like Odoo's board, a card you mark done stays (dimmed) until you come back: only to-dos
    // that were already closed when you arrived are left out.
    if (!closed) seenOpen.current.add(String(c.task_id));
    if (show === "open" && closed && !seenOpen.current.has(String(c.task_id))) return false;
    return !needle || (c["task.name"] ?? "").toLowerCase().includes(needle);
  });
  // The order of Odoo's To-do board: state (open ones before done and cancelled), priority
  // (Urgent first), the nearest deadline (none last), sequence, then the newest.
  const stateOf = (c: Cards) => pendingValue(pending, c.task_id, "state") ?? c["task.state"] ?? "";
  const rank = (c: Cards) => Number(pendingValue(pending, c.task_id, "priority") ?? c["task.priority"] ?? 0);
  const due = (c: Cards) => pendingValue(pending, c.task_id, "date_deadline") ?? c["task.date_deadline"] ?? null;
  const byDeadline = (a: Cards, b: Cards) => {
    const x = due(a), y = due(b);
    return x === y ? 0 : x === null ? 1 : y === null ? -1 : x < y ? -1 : 1;
  };
  shown.sort((a, b) =>
    (stateOf(a) < stateOf(b) ? -1 : stateOf(a) > stateOf(b) ? 1 : 0)
    || rank(b) - rank(a)
    || byDeadline(a, b)
    || (a["task.sequence"] ?? 10) - (b["task.sequence"] ?? 10)
    || (b.task_id ?? 0) - (a.task_id ?? 0));
  const byStage = new Map<string, Cards[]>();
  for (const c of shown) {
    const key = stageOf(c);
    byStage.set(key, [...(byStage.get(key) ?? []), c]);
  }
  // The form's pager steps through the board column by column, top to bottom.
  const order = stages.items.flatMap((s) => (byStage.get(String(s.id)) ?? []).map((c) => String(c.task_id)));
  rememberOrder(order);
  const cardOf = (id: UniqueIdentifier | undefined) => cards.items.find((c) => String(c.task_id) === String(id));
  const stageName = (id: UniqueIdentifier | undefined) => stages.items.find((s) => s.id === String(id))?.name_local ?? "";
  const nameOf = (id: UniqueIdentifier) => cardOf(id)?.["task.name"] ?? "the to-do";

  const drop = async ({ active, over }: DragEndEvent) => {
    setDragging(null);
    lastDrop = Date.now();
    const card = cardOf(active.id);
    if (!over || !card || card.task_id == null) return;
    const from = stageOf(card);
    const to = String(over.id);
    if (from === to) return;
    setPending(card.task_id, { stage_id: to });
    const out = await call(db.run.todo_move, { id: card.task_id, stage: Number(to) });
    if (!out.ok) {
      setPending(card.task_id, { stage_id: from });
      toast(out.message);
    }
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => over ? `${nameOf(active.id)} is over ${stageName(over.id)}.` : `${nameOf(active.id)} is not over a column.`,
    onDragEnd: ({ active, over }) => over ? `${nameOf(active.id)} dropped in ${stageName(over.id)}.` : `${nameOf(active.id)} dropped where it was.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} was cancelled.`,
  };

  const lifted = dragging == null ? undefined : cardOf(dragging);
  return (
    <>
      <div className="cp">
        {/* Odoo's New on a board: quick add in the first column. */}
        <Button className="btn btn-primary" onPress={() => setAsked((n) => n + 1)} isDisabled={!first}>New</Button>
        <div className="crumbs">My to-dos</div>
        <SearchField aria-label="Search the board" className="search" value={text} onChange={setText}>
          <Search size={14} aria-hidden="true" />
          <Input className="search-input" placeholder="Search…" />
          <Button className="search-clear"><X size={14} aria-hidden="true" /></Button>
        </SearchField>
        <ToggleButtonGroup aria-label="Show" className="chips" selectionMode="single" disallowEmptySelection
          selectedKeys={[show]} onSelectionChange={(keys) => { const k = [...keys][0]; if (k) setShow(k as "open" | "all"); }}>
          <ToggleButton id="open" className="chip">Open</ToggleButton>
          <ToggleButton id="all" className="chip">All</ToggleButton>
        </ToggleButtonGroup>
        <div className="grow" />
        <ViewSwitcher current="board" />
      </div>
      {stages.loadState === "loading" && <p className="muted pad">Loading…</p>}
      {stages.loadState !== "loading" && stages.items.length === 0 && (
        <p className="muted pad">Setting up your columns…</p>
      )}
      <DndContext sensors={sensors} collisionDetection={columnUnder}
        accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}
        onDragStart={({ active }) => setDragging(active.id)} onDragCancel={() => setDragging(null)}
        onDragEnd={(e) => void drop(e)}>
        <div className="board">
          {stages.items.map((s, i) => (
            <Column
              key={s.id}
              stage={s}
              cards={byStage.get(String(s.id)) ?? []}
              error={cards.error}
              inbox={s.id === first}
              asked={s.id === first ? asked : 0}
              // Odoo moves what's in a deleted column to the one before it; the first column's
              // go to the next one.
              heir={stages.items[i > 0 ? i - 1 : 1]}
              // Odoo reorders columns by dragging a header; here the column menu moves one a
              // place left or right, and the new order is saved as Odoo's `sequence`.
              onMove={i > 0 || i < stages.items.length - 1 ? (step) => {
                const order = stages.items.map((x) => x.id);
                const j = i + step;
                if (j < 0 || j >= order.length) return;
                [order[i], order[j]] = [order[j]!, order[i]!];
                void call(db.run.stage_reorder, { ids: order.join(",") }).then((out) => { if (!out.ok) toast(out.message); });
              } : undefined}
              first={i === 0}
              last={i === stages.items.length - 1}
            />
          ))}
          {stages.loadState !== "loading" && <AddColumn />}
        </div>
        <DragOverlay dropAnimation={null}>{lifted && <CardView card={lifted} lifted />}</DragOverlay>
      </DndContext>
    </>
  );
});

type ColumnProps = {
  stage: Stages; cards: Cards[]; error?: string | null; inbox: boolean; heir: Stages | undefined;
  onMove?: (step: -1 | 1) => void; first: boolean; last: boolean;
  /** Bumped by the board's New button: open this column's quick add. */
  asked: number;
};

const Column = observer(({ stage, cards, error, inbox, heir, onMove, first, last, asked }: ColumnProps) => {
  const db = useDb();
  const [adding, setAdding] = useState(false);
  useEffect(() => { if (asked > 0) setAdding(true); }, [asked]);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Folded columns take drops too: dropping on "Done" is the quickest way to finish one.
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const name = stage.name_local ?? "";
  // Folding is saved in Odoo (its `fold`), so both apps show the column the same way.
  const toggleFold = async () => {
    const out = await call(db.run.stage_fold, { id: Number(stage.id) });
    if (!out.ok) toast(out.message);
  };

  if (stage.fold) {
    return (
      <div ref={setNodeRef} className={`col folded${isOver ? " drop" : ""}`} role="button" tabIndex={0}
        aria-label={`${name}, ${cards.length} to-dos, folded. Unfold`} onClick={() => void toggleFold()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void toggleFold(); } }}>
        <h3>{name} <span className="count">({cards.length})</span></h3>
      </div>
    );
  }
  return (
    <section ref={setNodeRef} className={`col${isOver ? " drop" : ""}`} aria-label={name || undefined}>
      {renaming ? (
        <RenameColumn stage={stage} onClose={() => setRenaming(false)} />
      ) : (
        <h3>
          {name} <span className="count">{cards.length}</span>
          <span className="col-tools">
            <Button className="icon-btn" aria-label={`Add a to-do to ${name}`} onPress={() => setAdding(true)}><Plus size={16} aria-hidden="true" /></Button>
            <MenuTrigger>
              <Button className="icon-btn" aria-label={`${name}: column menu`}><MoreHorizontal size={16} aria-hidden="true" /></Button>
              <Popover className="popover" placement="bottom end" offset={4}>
                <Menu className="menu" onAction={(key) => {
                  if (key === "fold") void toggleFold();
                  else if (key === "rename") setRenaming(true);
                  else if (key === "delete") setDeleting(true);
                  else if (key === "left") onMove?.(-1);
                  else if (key === "right") onMove?.(1);
                }} disabledKeys={[...(first ? ["left"] : []), ...(last ? ["right"] : [])]}>
                  <MenuItem id="fold" className="menu-item">Fold</MenuItem>
                  <MenuItem id="rename" className="menu-item">Rename</MenuItem>
                  {onMove && <MenuItem id="left" className="menu-item">Move left</MenuItem>}
                  {onMove && <MenuItem id="right" className="menu-item">Move right</MenuItem>}
                  <MenuItem id="delete" className="menu-item">Delete</MenuItem>
                </Menu>
              </Popover>
            </MenuTrigger>
          </span>
        </h3>
      )}
      {deleting && <DeleteColumn stage={stage} count={cards.length} heir={heir} onClose={() => setDeleting(false)} />}
      {adding && <QuickCreate stage={stage} inbox={inbox} onClose={() => setAdding(false)} />}
      {error && <p className="alert">{error}</p>}
      {cards.map((c) => <Card key={c.id} card={c} />)}
    </section>
  );
});

/** The column's name as a field: Enter saves it in your language, Escape leaves it. */
function RenameColumn({ stage, onClose }: { stage: Stages; onClose: () => void }) {
  const db = useDb();
  const [name, setName] = useState(stage.name_local ?? "");
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === stage.name_local) { onClose(); return; }
    setBusy(true);
    const out = await call(db.run.stage_rename, { id: Number(stage.id), name: name.trim() });
    setBusy(false);
    if (!out.ok) { toast(out.message); return; }
    onClose();
  };
  return (
    <Form className="col-rename" onSubmit={(e) => void save(e)}>
      <TextField aria-label="Column name" value={name} onChange={setName} autoFocus isDisabled={busy}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <Input className="input" />
      </TextField>
    </Form>
  );
}

/** Asks before deleting (Odoo doesn't), saying where the column's to-dos go. */
function DeleteColumn({ stage, count, heir, onClose }: { stage: Stages; count: number; heir: Stages | undefined; onClose: () => void }) {
  const db = useDb();
  const [busy, setBusy] = useState(false);
  const name = stage.name_local ?? "";
  const remove = async () => {
    setBusy(true);
    const out = await call(db.run.stage_delete, { id: Number(stage.id) });
    setBusy(false);
    if (!out.ok) { toast(out.message); return; }
    onClose();
  };
  const what = !heir ? "It's your only column, so it stays."
    : count === 0 ? "It has no to-dos."
    : `Its ${count === 1 ? "to-do moves" : `${count} to-dos move`} to "${heir.name_local}".`;
  return (
    <ModalOverlay className="modal-overlay" isOpen isDismissable onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal className="modal">
        <Dialog className="dialog" role="alertdialog">
          <Heading slot="title" className="dialog-title">Delete "{name}"?</Heading>
          <p>{what}</p>
          <div className="row">
            <Button className="btn btn-danger" isDisabled={busy || !heir} onPress={() => void remove()} autoFocus>Delete</Button>
            <Button className="btn" onPress={onClose}>Cancel</Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Odoo's "+" after the last column: name a new one, Enter adds it at the end. */
function AddColumn() {
  const db = useDb();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <Button className="col-add" aria-label="Add a column" onPress={() => setOpen(true)}><Plus size={16} aria-hidden="true" /> Column</Button>
    );
  }
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const out = await call(db.run.stage_create, { name: name.trim() });
    setBusy(false);
    if (!out.ok) { toast(out.message); return; }
    setName("");
    setOpen(false);
  };
  return (
    <Form className="col col-new quick" onSubmit={(e) => void add(e)}>
      <TextField aria-label="Name of the new column" value={name} onChange={setName} autoFocus
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
        <Input className="input" placeholder="Column name" />
      </TextField>
      <div className="row">
        <Button type="submit" className="btn btn-primary" isDisabled={busy || !name.trim()}>Add</Button>
        <Button className="btn icon" aria-label="Close" onPress={() => setOpen(false)}><X size={14} aria-hidden="true" /></Button>
      </div>
    </Form>
  );
}

/** Odoo's quick create: type a title, Enter adds it (and keeps the box open for the next one). */
function QuickCreate({ stage, inbox, onClose }: { stage: Stages; inbox: boolean; onClose: () => void }) {
  const db = useDb();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async (e: FormEvent | null, edit = false) => {
    e?.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    // Odoo's keywords work here: "Call Ana #sales @marc !!".
    const out = await call<{ name: string; stage?: number }, { id: number }>(db.run.todo_quick_add,
      inbox ? { name: name.trim() } : { name: name.trim(), stage: Number(stage.id) });
    setBusy(false);
    if (!out.ok) { toast(out.message); return; }
    setName("");
    if (edit) navigate(`/todo/${out.value.id}`);
  };
  return (
    <Form className="quick" onSubmit={(e) => void add(e)}>
      <TextField aria-label={`Title of the new to-do in ${stage.name_local}`} value={name} onChange={setName} autoFocus
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <Input className="input" placeholder="Title  #tag  @person  !" />
      </TextField>
      <div className="row">
        <Button type="submit" className="btn btn-primary" isDisabled={busy || !name.trim()}>Add</Button>
        <Button className="btn" isDisabled={busy || !name.trim()} onPress={() => void add(null, true)}>Edit</Button>
        <Button className="btn icon" aria-label="Close" onPress={onClose}><X size={14} aria-hidden="true" /></Button>
      </div>
    </Form>
  );
}

const Card = observer(({ card }: { card: Cards }) => {
  const navigate = useNavigate();
  const task = card.task_id;
  const { attributes: { "aria-pressed": _, ...attributes }, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: String(task ?? card.id),
    disabled: task == null,
    attributes: { role: "group", roleDescription: "draggable to-do" },
  });
  const openIt = () => { if (task != null && Date.now() - lastDrop > 300) navigate(`/todo/${task}`); };
  const ref = (el: HTMLElement | null) => { setNodeRef(el); setActivatorNodeRef(el); };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    listeners?.onKeyDown?.(e);
    if (e.key === "Enter" && e.target === e.currentTarget && !isDragging) openIt();
  };
  return (
    <CardView card={card} cardRef={ref} dimmed={isDragging}
      props={{ ...attributes, ...listeners, onKeyDown, onClick: openIt }} />
  );
});

// The menu is portalled, but React still bubbles its events through the card, which must not
// open or start a drag.
const stopCard = (e: SyntheticEvent) => e.stopPropagation();

/** Odoo's card menu: the card's colour (Odoo's twelve) and Delete. */
function CardMenu({ task, name, color }: { task: number; name: string; color: number }) {
  const db = useDb();
  const setColor = async (c: number) => {
    setPending(task, { color: String(c) });
    const out = await call(db.run.todo_set_color, { id: task, color: c });
    if (!out.ok) { setPending(task, { color: String(color) }); toast(out.message); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete "${name}"? It's gone for everyone it's assigned to, in Odoo too.`)) return;
    const out = await call(db.run.todo_delete, { id: task });
    toast(out.ok ? "Deleted" : out.message);
  };
  return (
    <span className="card-menu" onClick={stopCard} onPointerDown={stopCard} onMouseDown={stopCard} onTouchStart={stopCard} onKeyDown={stopCard}>
      <DialogTrigger>
        <Button className="icon-btn" aria-label={`${name}: card menu`}><MoreHorizontal size={14} aria-hidden="true" /></Button>
        <Popover className="popover" placement="bottom end" offset={4}>
          <Dialog className="card-menu-panel" aria-label={`${name}: card menu`}>
            {({ close }) => (
              <>
                <div className="swatches">
                  {Array.from({ length: TAG_COLOR_COUNT }, (_, c) => (
                    <Button key={c} className={`swatch${color === c ? " on" : ""}`} style={{ background: tagColor(c) }}
                      aria-label={c === 0 ? "No colour" : `Colour ${c}`} onPress={() => { void setColor(c); close(); }} />
                  ))}
                </div>
                <Button className="menu-item danger" onPress={() => { close(); void remove(); }}>Delete</Button>
              </>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
    </span>
  );
}

/** A card's face, on the board and under the pointer while it is dragged (`lifted`, no controls). */
const CardView = observer(({ card, lifted, dimmed, cardRef, props }: {
  card: Cards;
  lifted?: boolean;
  dimmed?: boolean;
  cardRef?: (el: HTMLElement | null) => void;
  props?: React.HTMLAttributes<HTMLElement>;
}) => {
  const db = useDb();
  const task = card.task_id;
  const v = usePending(task, {
    name: card["task.name"],
    priority: card["task.priority"],
    state: card["task.state"],
    tag_ids: card["task.tag_ids"],
    assignees: card["task.assignees"],
    date_deadline: card["task.date_deadline"],
    stage_id: String(card.stage_id ?? ""),
    color: String(card["task.color"] ?? 0),
  });
  const done = isDone(v.state);
  const due = card["task.due"];
  const setPriority = async (priority: Level) => {
    if (task == null) return;
    const out = await call(db.run.todo_set_priority, { id: task, priority });
    if (!out.ok) toast(out.message);
    else setPending(task, { priority });
  };
  const toggleDone = async () => {
    if (task == null) return;
    const out = await call(db.run.todo_toggle_done, { id: task });
    if (!out.ok) toast(out.message);
    else setPending(task, { state: done ? "01_in_progress" : "1_done" });
  };
  const cls = `card${done || v.state === "1_canceled" ? " done" : ""}${dimmed ? " dimmed" : ""}${lifted ? " lifted" : ""}`;
  const color = Number(v.color ?? 0);
  return (
    <article ref={cardRef} className={cls} aria-label={v.name ?? undefined} {...props}
      style={color ? { borderLeft: `4px solid ${tagColor(color)}` } : undefined}>
      <div className="top">
        <span className="title">{v.name}</span>
        {!lifted && task != null && <CardMenu task={task} name={v.name ?? ""} color={color} />}
      </div>
      {card["task.summary"] && <div className="summary">{card["task.summary"]}</div>}
      <TagPills tagIds={v.tag_ids} />
      <div className="bottom">
        {lifted ? <PriorityStar level={Number(v.priority ?? 0)} /> : <Priority value={v.priority} onChange={(p) => void setPriority(p)} />}
        {v.date_deadline && (
          <span className={`deadline${due === "overdue" ? " overdue" : due === "today" ? " today" : ""}`} title={fullDate(v.date_deadline)}>
            <Clock size={12} aria-hidden="true" /> {deadlineLabel(v.date_deadline)}
          </span>
        )}
        {card["task.activity_state"] && (
          <span className={`activity-clock ${card["task.activity_state"]}`} role="img"
            aria-label={`Next activity ${card["task.activity_state"] === "planned" ? "planned" : card["task.activity_state"] === "today" ? "due today" : "overdue"}`}
            title={`Next activity ${card["task.activity_state"] === "planned" ? "planned" : card["task.activity_state"] === "today" ? "due today" : "overdue"}`}>
            <AlarmClock size={14} aria-hidden="true" />
          </span>
        )}
        <Avatars names={v.assignees} />
        {lifted ? <span className="donecheck" data-selected={done || undefined} aria-hidden="true"><Check size={12} strokeWidth={3} /></span> : <DoneCheck done={done} onToggle={() => void toggleDone()} />}
      </div>
    </article>
  );
});
