import { useSyncExternalStore } from "react";

/**
 * Changes this page has just saved, shown at once. The to-do list the server sends is re-read
 * every few seconds (it is computed from several Odoo tables), so without this a star or a
 * new title would appear only after that re-read. Each value is dropped once the server's
 * copy says the same, or after a minute.
 */
export type TodoPatch = Partial<{
  name: string;
  priority: "0" | "1";
  state: string;
  active: boolean;
  tag_ids: string;
  assignee_ids: string;
  assignees: string;
  date_deadline: string | null;
  notes: string;
}>;

type Entry = { patch: TodoPatch; at: number };
let store: Record<string, Entry> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setPending(id: string | number, patch: TodoPatch) {
  const key = String(id);
  store = { ...store, [key]: { patch: { ...(store[key]?.patch ?? {}), ...patch }, at: Date.now() } };
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

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
  if (caughtUp) queueMicrotask(() => { if (store[String(id)] === e) { const { [String(id)]: _, ...rest } = store; store = rest; emit(); } });
  return out as T;
}
