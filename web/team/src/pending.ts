import { useSyncExternalStore } from "react";

/**
 * Changes this page has just saved, shown at once. The to-do list the server sends is re-read
 * every few seconds (it is computed from several Odoo tables), so without this a star or a
 * new title would appear only after that re-read. Each value is dropped once the server's
 * copy says the same, or after a minute.
 */
export type TodoPatch = Partial<{
  name: string;
  priority: "0" | "1" | "2" | "3";
  state: string;
  active: boolean;
  tag_ids: string;
  assignee_ids: string;
  assignees: string;
  date_deadline: string | null;
  notes: string;
  /** My board column for it, as text (a drop on the board). */
  stage_id: string;
}>;

/**
 * `contested`: this change replaced a different pending value for the same field (a card
 * dragged to Today and straight back to Inbox). The server's copy may still be the old one,
 * equal to the new value by chance, with the first change yet to arrive; such an entry waits
 * until the server's copy has changed (`stirred`) before it counts as caught up.
 */
type Entry = { patch: TodoPatch; at: number; contested: boolean; base?: string; stirred?: boolean };
export type PendingStore = Readonly<Record<string, Entry>>;
let store: Record<string, Entry> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setPending(id: string | number, patch: TodoPatch) {
  const key = String(id);
  const before: Record<string, unknown> = store[key]?.patch ?? {};
  const contested = Object.entries(patch).some(([k, v]) => k in before && String(before[k] ?? "") !== String(v ?? ""));
  store = { ...store, [key]: { patch: { ...before, ...patch }, at: Date.now(), contested } };
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * Every pending change, for a page that groups rows by one (the board puts a dropped card in
 * its new column at once). Read a value with `pendingValue`; the row's own `usePending` still
 * drops it once the server agrees.
 */
export const usePendingStore = (): PendingStore => useSyncExternalStore(subscribe, () => store);

export function pendingValue<K extends keyof TodoPatch>(all: PendingStore, id: string | number | null | undefined, key: K): TodoPatch[K] | undefined {
  const e = id == null ? undefined : all[String(id)];
  if (!e || Date.now() - e.at > 60_000 || !(key in e.patch)) return undefined;
  return e.patch[key];
}

/** The server's values with this page's unsaved-to-the-view changes on top. */
export function usePending<T extends Record<string, unknown>>(id: string | number | null | undefined, server: T): T {
  const all = useSyncExternalStore(subscribe, () => store);
  if (id == null) return server;
  const e = all[String(id)];
  if (!e) return server;
  if (Date.now() - e.at > 60_000) return server;
  const out: Record<string, unknown> = { ...server };
  let caughtUp = true;
  for (const [k, v] of Object.entries(e.patch)) {
    const same = String(server[k] ?? "") === String(v ?? "");
    if (!same) { out[k] = v; caughtUp = false; }
  }
  if (e.contested) {
    const now = Object.keys(e.patch).map((k) => String(server[k] ?? "")).join("\u0000");
    if (e.base === undefined) e.base = now;
    else if (now !== e.base) e.stirred = true;
    if (!e.stirred) { caughtUp = false; for (const [k, v] of Object.entries(e.patch)) out[k] = v; }
  }
  if (caughtUp) queueMicrotask(() => { if (store[String(id)] === e) { const { [String(id)]: _, ...rest } = store; store = rest; emit(); } });
  return out as T;
}
