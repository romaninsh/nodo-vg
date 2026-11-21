import type { SyntheticEvent } from "react";
import {
  KeyboardSensor, MouseSensor, TouchSensor, pointerWithin, useSensor, useSensors,
  type CollisionDetection, type KeyboardCoordinateGetter,
} from "@dnd-kit/core";

// Drag and drop for the kanban boards (To-do and CRM), on dnd-kit.

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
export const columnUnder: CollisionDetection = (args) => {
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

/** Mouse (after 5 px), touch (after a 200 ms press) and keyboard (Space, arrows, Space). */
export function useBoardSensors() {
  return useSensors(
    useSensor(CardMouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(CardTouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: columnKeys,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );
}

// A click that ends a drag is not a click on the card.
let lastDrop = 0;
export const markDrop = () => { lastDrop = Date.now(); };
export const justDropped = () => Date.now() - lastDrop <= 300;
